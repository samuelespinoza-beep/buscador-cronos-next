"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { splitHighlights, extractMarks } from "@/lib/highlights";

const PageViewer = dynamic(() => import("@/components/PageViewer"), { ssr: false });

export default function BuscadorPage() {
    const [keyword, setKeyword] = useState("");
    const [activeSearchTerm, setActiveSearchTerm] = useState("");
    const [searchType, setSearchType] = useState("word");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [resultsList, setResultsList] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingCoords, setLoadingCoords] = useState(false);
    const [blocks, setBlocks] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, currentPage: 1, lastPage: 1 });
    const [lupaEnabled, setLupaEnabled] = useState(true);
    const [searchError, setSearchError] = useState(null);
    const [coordsMessage, setCoordsMessage] = useState(null);
    const currentResult = selectedIndex !== null ? resultsList[selectedIndex] : null;

    const selectResult = (index) => {
        setSelectedIndex(index);
        setBlocks([]);
        setCoordsMessage(null);
    };

    const clearResults = () => {
        setResultsList([]);
        setPagination({ total: 0, currentPage: 1, lastPage: 1 });
        setSelectedIndex(null);
        setBlocks([]);
    };

    const handleSearch = async (e, pageNumber = 1) => {
        if (e) e.preventDefault();
        if (!keyword.trim()) return;
        setActiveSearchTerm(keyword);
        setLoading(true);
        setSearchError(null);
        try {
            // Pasa por el route handler propio, que agrega el token del lado del servidor
            // y traduce el modo a una de sus queries. Acá no hay ni token ni GraphQL.
            const response = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: searchType,
                    keyword,
                    page: pageNumber,
                    start: startDate || null,
                    end: endDate || null,
                }),
            });

            const json = await response.json().catch(() => null);

            // El route handler ya distingue un backend caído de una query rechazada, y
            // manda el motivo en "error" para poder mostrarlo tal cual.
            if (!response.ok) {
                throw new Error(json?.error || `El servidor respondió ${response.status}.`);
            }

            const result = json?.result;

            if (!result) {
                throw new Error("La respuesta del servidor no tiene el formato esperado.");
            }

            setResultsList(result.data || []);
            setPagination({ total: result.total || 0, currentPage: result.current_page || 1, lastPage: result.last_page || 1 });
            setSelectedIndex(null);
            setBlocks([]);
        } catch (error) {
            console.error("Error al buscar:", error);
            setSearchError(error.message);
            // Los resultados de la búsqueda anterior se limpian: dejarlos en pantalla
            // haría creer que son los del término que se acaba de escribir.
            clearResults();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentResult || !activeSearchTerm) return;
        setLoadingCoords(true);
        setCoordsMessage(null);

        // Por palabras se buscan los términos distintos; por frase, la secuencia completa
        // en el orden en que aparece. Antes esta rama usaba innerHTML sobre un div suelto
        // para leer los <mark>; ahora sale del mismo parseo que usa el render.
        const marks = extractMarks(currentResult.highlighted_content);
        const words = searchType === "word" ? [...new Set(marks)] : marks;
        const wordsToSearch = words.length > 0 ? words.join(" ") : activeSearchTerm;

        const controller = new AbortController();

        // Pasa por el route handler propio, que agrega la API key del lado del servidor.
        fetch("/api/coordinates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: searchType, ocr_coordinates: currentResult.ocr_coordinates, keyword: wordsToSearch }),
            signal: controller.signal,
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                // Que el servicio falle y que la palabra no esté en la imagen se veían
                // igual —sin recuadros y sin explicación—, así que se distinguen.
                if (ok && data?.status === "success" && Array.isArray(data.coordinates)) {
                    setBlocks(data.coordinates.map(item => ({ x: item.geometria.Left, y: item.geometria.Top, w: item.geometria.Width, h: item.geometria.Height })));
                    if (data.coordinates.length === 0) {
                        setCoordsMessage("No se ubicaron las coincidencias en esta imagen");
                    }
                    return;
                }

                console.error("No se pudieron obtener las coordenadas", data);
                setBlocks([]);
                setCoordsMessage("No se pudo resaltar las coincidencias");
            })
            .catch(error => {
                if (controller.signal.aborted) return; // se cambió de página, no es un fallo
                console.error("Error al obtener coordenadas:", error);
                setBlocks([]);
                setCoordsMessage("No se pudo resaltar las coincidencias");
            })
            .finally(() => {
                // Si se abortó ya hay otra búsqueda en curso, y apagar el spinner acá lo
                // dejaría oculto mientras esa sigue cargando.
                if (!controller.signal.aborted) setLoadingCoords(false);
            });

        // Descarta la respuesta en vuelo al cambiar de resultado: si llegara tarde,
        // pintaría las coordenadas de la página anterior sobre la nueva.
        return () => controller.abort();
    }, [currentResult, activeSearchTerm, searchType]);

    // La imagen de página completa es el mismo archivo que el PDF pero sin comprimir:
    // el ejemplar guarda "<pagina>_compress.pdf" junto a "<pagina>.jpg" en el bucket.
    // No viene un campo con la URL de la imagen, hay que derivarla del nombre.
    const imageUrl = currentResult?.document
        ? currentResult.document.replace(/_compress\.pdf$/i, ".jpg")
        : null;

    const renderPageNumbers = () => {
        const pages = [];
        const { currentPage, lastPage } = pagination;
        let startPage = Math.max(1, currentPage - 3);
        let endPage = Math.min(lastPage, startPage + 6);
        if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <button key={i} onClick={() => handleSearch(null, i)}
                    style={{ ...styles.pageNumberBtn, backgroundColor: i === currentPage ? "#ffcc00" : "#333", color: i === currentPage ? "black" : "white" }}>
                    {i}
                </button>
            );
        }
        return pages;
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2>Buscador de Impresos Cronos</h2>
                <form onSubmit={(e) => handleSearch(e, 1)} style={styles.searchForm}>
                    <div style={styles.inputWrapper}>
                        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Buscar..." style={styles.input} />
                        <select value={searchType} onChange={(e) => setSearchType(e.target.value)} style={styles.selectType}>
                            <option value="word">Palabras</option>
                            <option value="phrase">Frase Exacta</option>
                        </select>
                    </div>

                    <div style={styles.dateGroup}>
                        <label style={styles.dateLabel}>Desde:</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
                        <label style={styles.dateLabel}>Hasta:</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", color: lupaEnabled ? "#ffcc00" : "#aaa", whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={lupaEnabled} onChange={(e) => setLupaEnabled(e.target.checked)} style={{ cursor: "pointer", accentColor: "#ffcc00" }} />
                            Lupa Activa
                        </label>
                    </div>

                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? "..." : "Buscar"}
                    </button>
                </form>
            </header>

            <div style={styles.mainContent}>
                <aside style={styles.sidebar}>
                    <h3>Resultados ({pagination.total})</h3>

                    {searchError && (
                        <div style={styles.errorBanner} role="alert">
                            <strong>No se pudo completar la búsqueda</strong>
                            <span style={styles.errorDetail}>{searchError}</span>
                        </div>
                    )}

                    {/* Un mensaje explícito para distinguir "no hay coincidencias" de un
                        fallo del backend, que antes se veían igual: la lista vacía. */}
                    {!loading && !searchError && activeSearchTerm && resultsList.length === 0 && (
                        <div style={styles.noResults}>Sin coincidencias para «{activeSearchTerm}».</div>
                    )}

                    {/* listbox/option en vez de divs: así los resultados se recorren con Tab
                        y se abren con Enter o Espacio, sin necesidad de mouse. */}
                    <div style={styles.resultsScroll} role="listbox" aria-label="Resultados de la búsqueda">
                        {resultsList.map((res, index) => (
                            <div key={res._id || index}
                                role="option"
                                aria-selected={selectedIndex === index}
                                tabIndex={0}
                                onClick={() => selectResult(index)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        selectResult(index);
                                    }
                                }}
                                style={{ ...styles.resultCard, backgroundColor: selectedIndex === index ? "#444" : "#333", borderLeft: selectedIndex === index ? "4px solid #ffcc00" : "4px solid transparent" }}>
                                {res.thumbnail && <img src={res.thumbnail} alt="Página" style={styles.thumbImg} loading="lazy" decoding="async" />}
                                <div style={{ flex: 1 }}>
                                    <strong style={{ fontSize: "13px", display: "block" }}>{res.title}</strong>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                        <small style={{ color: "#ffcc00" }}>Pag: {res.page_number}</small>
                                        <small style={{ color: "#888" }}>{res.date ? res.date.split("T")[0] : ""}</small>
                                    </div>
                                    <p style={styles.resultSnippet}>
                                        {splitHighlights(res.highlighted_content).map((segment, i) => (
                                            segment.mark ? <mark key={i}>{segment.text}</mark> : segment.text
                                        ))}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {pagination.total > 0 && (
                        <div style={styles.paginationContainer}>
                            <button style={styles.pageNavBtn} disabled={pagination.currentPage === 1} onClick={() => handleSearch(null, 1)}>Primera</button>
                            <button style={styles.pageNavBtn} disabled={pagination.currentPage === 1} onClick={() => handleSearch(null, pagination.currentPage - 1)}>«</button>
                            {renderPageNumbers()}
                            <button style={styles.pageNavBtn} disabled={pagination.currentPage === pagination.lastPage} onClick={() => handleSearch(null, pagination.currentPage + 1)}>»</button>
                        </div>
                    )}
                </aside>

                <main style={styles.viewerContainer}>
                    {currentResult ? (
                        <div style={styles.viewerLayout}>
                            <div style={styles.toolbar}>
                                <span style={styles.toolbarTitle}>{currentResult.title} - Página {currentResult.page_number}</span>
                                {coordsMessage && <span style={styles.coordsMessage} role="status">{coordsMessage}</span>}
                            </div>
                            <div style={styles.pageWrapper}>
                                <PageViewer
                                    key={imageUrl}
                                    imageUrl={imageUrl}
                                    blocks={blocks}
                                    loadingCoords={loadingCoords}
                                    lupaEnabled={lupaEnabled}
                                />
                            </div>
                        </div>
                    ) : (
                        !loading && <div style={styles.emptyState}>Seleccione un ejemplar para visualizar</div>
                    )}
                </main>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: "10px", backgroundColor: "#121212", minHeight: "100vh", color: "white", fontFamily: "'Segoe UI', Roboto, sans-serif", display: "flex", flexDirection: "column" },
    header: { borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "15px" },
    searchForm: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
    inputWrapper: { display: "flex", backgroundColor: "#222", borderRadius: "4px", border: "1px solid #444", overflow: "hidden", flex: "0 1 450px", minWidth: "280px" },
    input: { padding: "10px 15px", width: "100%", border: "none", backgroundColor: "transparent", color: "white", outline: "none" },
    selectType: { padding: "0 10px", backgroundColor: "#333", color: "#ffcc00", border: "none", borderLeft: "1px solid #444", outline: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
    dateGroup: { display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#222", padding: "8px 12px", borderRadius: "4px", border: "1px solid #444", flexWrap: "wrap" },
    dateLabel: { fontSize: "10px", color: "#aaa", textTransform: "uppercase", fontWeight: "bold" },
    dateInput: { backgroundColor: "transparent", border: "none", color: "white", fontSize: "12px", outline: "none", cursor: "pointer" },
    button: { padding: "10px 25px", backgroundColor: "#ffcc00", color: "black", fontWeight: "900", border: "none", borderRadius: "4px", cursor: "pointer", textTransform: "uppercase", transition: "0.2s" },
    mainContent: { display: "flex", gap: "20px", flex: 1, flexWrap: "wrap" },
    sidebar: { flex: "0 1 450px", maxWidth: "100%", display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e", borderRadius: "8px", padding: "15px", border: "1px solid #333", maxHeight: "85vh", boxSizing: "border-box" },
    resultsScroll: { overflowY: "auto", flex: 1, marginTop: "10px", paddingRight: "5px" },
    resultCard: { padding: "12px", marginBottom: "12px", cursor: "pointer", borderRadius: "8px", transition: "0.2s", display: "flex", gap: "10px", alignItems: "start" },
    thumbImg: { width: "60px", height: "85px", objectFit: "cover", borderRadius: "4px" },
    resultSnippet: { fontSize: "11px", color: "#aaa", marginTop: "8px", lineHeight: "1.3" },
    errorBanner: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px", padding: "10px 12px", backgroundColor: "#3a1d1d", border: "1px solid #7f2c2c", borderRadius: "6px", fontSize: "12px", color: "#ffb3b3" },
    errorDetail: { fontSize: "11px", color: "#e08e8e" },
    noResults: { marginTop: "16px", fontSize: "12px", color: "#888", fontStyle: "italic", textAlign: "center" },
    viewerContainer: { flex: "1 1 600px", display: "flex", justifyContent: "center", alignItems: "flex-start", backgroundColor: "#090909", padding: "10px", borderRadius: "8px", overflow: "auto", border: "1px solid #333", minHeight: "500px" },
    pageWrapper: { boxShadow: "0 10px 30px rgba(0,0,0,0.8)", backgroundColor: "white", maxWidth: "100%" },
    emptyState: { color: "#444", alignSelf: "center", fontSize: "1rem", fontStyle: "italic", textAlign: "center", padding: "20px" },
    paginationContainer: { display: "flex", justifyContent: "center", alignItems: "center", gap: "5px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #333", flexWrap: "wrap" },
    pageNumberBtn: { padding: "6px 10px", border: "1px solid #444", borderRadius: "4px", cursor: "pointer", fontSize: "11px" },
    pageNavBtn: { backgroundColor: "transparent", color: "#ffcc00", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" },
    viewerLayout: { display: "flex", flexDirection: "column", gap: "10px", width: "100%", alignItems: "center" },
    toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "1100px", padding: "10px 15px", backgroundColor: "#1e1e1e", borderRadius: "6px", border: "1px solid #333", boxSizing: "border-box" },
    toolbarTitle: { fontSize: "14px", fontWeight: "bold", color: "#ffcc00" },
    coordsMessage: { fontSize: "11px", color: "#e08e8e", fontStyle: "italic", paddingLeft: "12px", textAlign: "right" },
};

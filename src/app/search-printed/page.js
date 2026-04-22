"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL;
const REST_API_URL = process.env.NEXT_PUBLIC_REST_API_URL;

const SEARCH_QUERIES = {
    word: `query Search($text: String!, $page: Int, $limit: Int, $sort: String, $start: String, $end: String) {
      searchPrinted(keyword: $text, page: $page, limit: $limit, sort: $sort, start_date: $start, end_date: $end) {
        data { _id title page_number document ocr_coordinates highlighted_content thumbnail date }
        total current_page last_page
      }
    }`,
    phrase: `query SearchPhrase($text: String!, $page: Int, $limit: Int, $sort: String, $start: String, $end: String) {
      searchPrintedPhrase(keyword: $text, page: $page, limit: $limit, sort: $sort, start_date: $start, end_date: $end) {
        data { _id title page_number document ocr_coordinates highlighted_content thumbnail date }
        total current_page last_page
      }
    }`,
};

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
    const currentResult = selectedIndex !== null ? resultsList[selectedIndex] : null;
    const handleSearch = async (e, pageNumber = 1) => {
        if (e) e.preventDefault();
        if (!keyword.trim()) return;
        setActiveSearchTerm(keyword);
        setLoading(true);
        try {
            const response = await fetch(GRAPHQL_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: SEARCH_QUERIES[searchType],
                    variables: { text: keyword, page: pageNumber, limit: 10, sort: "ASC", start: startDate || null, end: endDate || null },
                }),
            });
            if (!response.ok) {
                console.log(`Error en la respuesta, no se pudo consultar en ${GRAPHQL_URL}`, response);
                return;
            }
            const json = await response.json();
            const resultKey = searchType === "word" ? "searchPrinted" : "searchPrintedPhrase";
            const result = json.data?.[resultKey];
            setResultsList(result?.data || []);
            setPagination({ total: result?.total || 0, currentPage: result?.current_page || 1, lastPage: result?.last_page || 1 });
            setSelectedIndex(null);
            setBlocks([]);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (!currentResult || !activeSearchTerm) return;
        setLoadingCoords(true);

        let wordsToSearch = "";

        if (searchType === "word") {
            const regex = /<mark>(.*?)<\/mark>/gi;
            const matches = [];
            let match;
            while ((match = regex.exec(currentResult.highlighted_content)) !== null) {
                matches.push(match[1]);
            }
            wordsToSearch = matches.length > 0 ? [...new Set(matches)].join(" ") : activeSearchTerm;
        } else {
            const html = currentResult.highlighted_content;
            const phraseRegex = /<mark>(.*?)<\/mark>(?:\s*<mark>(.*?)<\/mark>)*/gi;
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            const marks = tempDiv.querySelectorAll("mark");

            if (marks.length > 0) {
                wordsToSearch = Array.from(marks)
                    .map(m => m.textContent)
                    .join(" ");
            } else {
                wordsToSearch = activeSearchTerm;
            }
        }

        const endpoint = searchType === "word" ? "/search/coordinates" : "/search/coordinates-line";

        fetch(`${REST_API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ocr_coordinates: currentResult.ocr_coordinates, keyword: wordsToSearch }),
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && data.coordinates) {
                    setBlocks(data.coordinates.map(item => ({ x: item.geometria.Left, y: item.geometria.Top, w: item.geometria.Width, h: item.geometria.Height })));
                }
            })
            .finally(() => setLoadingCoords(false));
    }, [selectedIndex, currentResult, activeSearchTerm, searchType]);

    const pdfUrl = currentResult ? `${REST_API_URL}/pdf-proxy?url=${encodeURIComponent(currentResult.document)}` : null;

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
                    <div style={styles.resultsScroll}>
                        {resultsList.map((res, index) => (
                            <div key={res._id || index} onClick={() => { setSelectedIndex(index); setBlocks([]); }}
                                style={{ ...styles.resultCard, backgroundColor: selectedIndex === index ? "#444" : "#333", borderLeft: selectedIndex === index ? "4px solid #ffcc00" : "4px solid transparent" }}>
                                {res.thumbnail && <img src={res.thumbnail} alt="Página" style={styles.thumbImg} />}
                                <div style={{ flex: 1 }}>
                                    <strong style={{ fontSize: "13px", display: "block" }}>{res.title}</strong>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                        <small style={{ color: "#ffcc00" }}>Pag: {res.page_number}</small>
                                        <small style={{ color: "#888" }}>{res.date ? res.date.split("T")[0] : ""}</small>
                                    </div>
                                    <p style={styles.resultSnippet} dangerouslySetInnerHTML={{ __html: res.highlighted_content }} />
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
                            <button style={styles.pageNavBtn} disabled={pagination.currentPage === pagination.lastPage} onClick={() => handleSearch(null, pagination.lastPage)}>Ultima</button>
                        </div>
                    )}
                </aside>

                <main style={styles.viewerContainer}>
                    {currentResult ? (
                        <div style={styles.pdfWrapper}>
                            <PdfViewer
                                pdfUrl={pdfUrl}
                                blocks={blocks}
                                loadingCoords={loadingCoords}
                                lupaEnabled={lupaEnabled}
                            />
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
    viewerContainer: { flex: "1 1 600px", display: "flex", justifyContent: "center", alignItems: "flex-start", backgroundColor: "#090909", padding: "10px", borderRadius: "8px", overflow: "auto", border: "1px solid #333", minHeight: "500px" },
    pdfWrapper: { boxShadow: "0 10px 30px rgba(0,0,0,0.8)", backgroundColor: "white", maxWidth: "100%" },
    emptyState: { color: "#444", alignSelf: "center", fontSize: "1rem", fontStyle: "italic", textAlign: "center", padding: "20px" },
    paginationContainer: { display: "flex", justifyContent: "center", alignItems: "center", gap: "5px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #333", flexWrap: "wrap" },
    pageNumberBtn: { padding: "6px 10px", border: "1px solid #444", borderRadius: "4px", cursor: "pointer", fontSize: "11px" },
    pageNavBtn: { backgroundColor: "transparent", color: "#ffcc00", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" },
};
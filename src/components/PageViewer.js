"use client";
import React, { useState, useRef, useEffect } from "react";

// Ancho al que se pide mostrar la página. La imagen del bucket es el escaneo a
// resolución completa (mucho más grande y de tamaño variable entre ejemplares).
// Es un máximo, no el ancho real: en un visor más angosto la imagen se encoge.
const DISPLAY_WIDTH = 1100;

const ZOOM = 2;
const LUPA_SIZE = 600;

// Los mismos bloques se dibujan dos veces: sobre la página y dentro de la lupa.
// La capa de la página está por encima de todo, así que no debe robar el mousemove
// que mueve la lupa; la de dentro ya viaja en un contenedor inerte.
const BOX_VARIANTS = {
    page: { backgroundColor: "rgba(255, 255, 0, 0.35)", border: "1.5px solid #d4af37", pointerEvents: "none", zIndex: 100 },
    magnifier: { backgroundColor: "rgba(255, 255, 0, 0.3)", border: "1px solid #ffcc00" },
};

// Memoizado aparte del movimiento del cursor: así mover la lupa solo cambia el
// transform de la capa y no vuelve a construir un elemento por bloque.
const HighlightBoxes = React.memo(function HighlightBoxes({ blocks, pageSize, variant }) {
    if (pageSize.width === 0) return null;

    return blocks.map((block, i) => (
        <div key={i} style={{
            position: "absolute", ...BOX_VARIANTS[variant],
            left: block.x * pageSize.width, top: block.y * pageSize.height,
            width: block.w * pageSize.width, height: block.h * pageSize.height,
        }} />
    ));
});

export default function PageViewer({ imageUrl, blocks, loadingCoords, lupaEnabled }) {
    const containerRef = useRef(null);
    const imgRef = useRef(null);
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
    const [magnifier, setMagnifier] = useState({ x: 0, y: 0, show: false });
    const [failed, setFailed] = useState(false);

    // Un solo reposicionamiento de la lupa por frame: mousemove se dispara decenas
    // de veces por segundo y solo importa la última posición del cursor.
    const frameRef = useRef(null);
    const pointerRef = useRef({ x: 0, y: 0 });

    // No queda ningún frame pendiente al desmontar. El estado de la página anterior
    // (tamaño, error, lupa) se descarta remontando el componente: quien lo usa le
    // pasa key={imageUrl}.
    useEffect(() => () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    }, []);

    const hideMagnifier = () => {
        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        setMagnifier(prev => ({ ...prev, show: false }));
    };

    const handleMouseMove = (e) => {
        if (!containerRef.current || !lupaEnabled) return;

        const { left, top } = containerRef.current.getBoundingClientRect();
        pointerRef.current = { x: e.clientX - left, y: e.clientY - top };

        if (frameRef.current !== null) return;

        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            setMagnifier({ ...pointerRef.current, show: true });
        });
    };

    // Las coordenadas del OCR son relativas (0..1), así que hay que multiplicarlas por
    // el tamaño con el que la imagen quedó realmente en pantalla, no por DISPLAY_WIDTH:
    // con el visor angosto la imagen se encoge y los recuadros se irían de lugar.
    // El observer también cubre el primer render (la imagen todavía no ha cargado y mide
    // 0 de alto) y cualquier cambio de tamaño posterior de la ventana.
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setPageSize({ width, height });
        });

        observer.observe(img);
        return () => observer.disconnect();
    }, []);

    if (!imageUrl || failed) {
        return (
            <div style={{ padding: "40px 30px", color: "#888", fontStyle: "italic", textAlign: "center", backgroundColor: "#1e1e1e", minWidth: "320px" }}>
                {imageUrl
                    ? "No se pudo cargar la imagen de esta página"
                    : "Este resultado no tiene una página asociada"}
            </div>
        );
    }

    return (
        <div style={{ position: "relative", display: "inline-block", cursor: lupaEnabled ? "crosshair" : "default", backgroundColor: "white" }}
            ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={hideMagnifier}>

            {loadingCoords && (
                <div style={{ position: "absolute", top: "15px", right: "15px", backgroundColor: "#ffcc00", color: "black", padding: "6px 16px", borderRadius: "20px", fontSize: "11px", fontWeight: "bold", zIndex: 1000, display: "flex", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
                    <div style={{ width: "12px", height: "12px", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "black", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px" }} />
                    Buscando Coordenadas...
                </div>
            )}

            {/* next/image no encaja acá: recomprime y redimensiona, y la lupa necesita el
                escaneo tal cual para que las coordenadas del OCR calcen. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                ref={imgRef}
                src={imageUrl}
                alt="Página del ejemplar"
                onError={() => setFailed(true)}
                style={{ display: "block", width: DISPLAY_WIDTH, maxWidth: "100%", height: "auto" }}
            />

            <HighlightBoxes blocks={blocks} pageSize={pageSize} variant="page" />

            {lupaEnabled && magnifier.show && pageSize.width > 0 && (
                <div style={{ position: "absolute", pointerEvents: "none", zIndex: 500, width: LUPA_SIZE, height: LUPA_SIZE, borderRadius: "50%", border: "4px solid #ffcc00", boxShadow: "0 0 25px rgba(0,0,0,0.7)", left: magnifier.x - LUPA_SIZE / 2, top: magnifier.y - LUPA_SIZE / 2, backgroundColor: "white", overflow: "hidden" }}>
                    <div style={{
                        position: "absolute", width: pageSize.width, height: pageSize.height,
                        transformOrigin: "0 0",
                        transform: `scale(${ZOOM}) translate(${-magnifier.x + LUPA_SIZE / 2 / ZOOM}px, ${-magnifier.y + LUPA_SIZE / 2 / ZOOM}px)`,
                        // Entre comillas dobles y con encodeURI, que escapa las comillas: así una
                        // URL con paréntesis o comillas no puede romper la declaración CSS.
                        backgroundImage: `url("${encodeURI(imageUrl)}")`,
                        backgroundSize: "100% 100%",
                    }}>
                        <HighlightBoxes blocks={blocks} pageSize={pageSize} variant="magnifier" />
                    </div>
                </div>
            )}
        </div>
    );
}

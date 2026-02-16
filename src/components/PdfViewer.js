"use client";
import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ pdfUrl, blocks, loadingCoords, lupaEnabled }) {
    const containerRef = useRef(null);
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
    const [magnifier, setMagnifier] = useState({ x: 0, y: 0, show: false });
    const [pdfImage, setPdfImage] = useState(null);
    const [pageRendered, setPageRendered] = useState(false);

    const ZOOM = 2;
    const LUPA_SIZE = 600;

    // Inyectar animación para el spinner
    useEffect(() => {
        if (typeof window !== "undefined" && !document.getElementById("spin-animation")) {
            const style = document.createElement("style");
            style.id = "spin-animation";
            style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }, []);

    const handleMouseMove = (e) => {
        if (!containerRef.current || !lupaEnabled) return;
        const { left, top } = containerRef.current.getBoundingClientRect();
        setMagnifier({ x: e.clientX - left, y: e.clientY - top, show: true });
    };

    return (
        <div style={{ position: "relative", display: "inline-block", cursor: lupaEnabled ? "crosshair" : "default", backgroundColor: "white" }}
            ref={containerRef} onMouseMove={handleMouseMove}
            onMouseLeave={() => setMagnifier(prev => ({ ...prev, show: false }))}>

            {loadingCoords && (
                <div style={{ position: "absolute", top: "15px", right: "15px", backgroundColor: "#ffcc00", color: "black", padding: "6px 16px", borderRadius: "20px", fontSize: "11px", fontWeight: "bold", zIndex: 1000, display: "flex", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
                    <div style={{ width: "12px", height: "12px", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "black", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px" }} />
                    Buscando Coordenadas...
                </div>
            )}

            <Document
                file={pdfUrl}
                loading={null}
                onLoadStart={() => setPageRendered(false)}
            >
                <Page
                    pageNumber={1}
                    width={1100}
                    loading={null}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={({ width, height }) => setPageSize({ width, height })}
                    onRenderSuccess={() => {
                        setPageRendered(true);
                        setTimeout(() => {
                            const canvas = containerRef.current?.querySelector("canvas");
                            if (canvas) setPdfImage(canvas.toDataURL("image/jpeg", 0.7));
                        }, 200);
                    }}
                />
            </Document>

            {/* Highlights - Sincronizados con el renderizado */}
            {pageRendered && pageSize.width > 0 && blocks.map((block, i) => (
                <div key={i} style={{ position: "absolute", backgroundColor: "rgba(255, 255, 0, 0.35)", border: "1.5px solid #d4af37", pointerEvents: "none", zIndex: 100, left: block.x * pageSize.width, top: block.y * pageSize.height, width: block.w * pageSize.width, height: block.h * pageSize.height }} />
            ))}

            {/* Lupa - Controlada por prop */}
            {lupaEnabled && magnifier.show && pageSize.width > 0 && pdfImage && (
                <div style={{ position: "absolute", pointerEvents: "none", zIndex: 500, width: LUPA_SIZE, height: LUPA_SIZE, borderRadius: "50%", border: "4px solid #ffcc00", boxShadow: "0 0 25px rgba(0,0,0,0.7)", left: magnifier.x - LUPA_SIZE / 2, top: magnifier.y - LUPA_SIZE / 2, backgroundColor: "white", overflow: "hidden" }}>
                    <div style={{ position: "absolute", width: pageSize.width, height: pageSize.height, transformOrigin: "0 0", transform: `scale(${ZOOM}) translate(${-magnifier.x + LUPA_SIZE / 2 / ZOOM}px, ${-magnifier.y + LUPA_SIZE / 2 / ZOOM}px)`, backgroundImage: `url(${pdfImage})`, backgroundSize: "100% 100%" }}>
                        {blocks.map((block, i) => (
                            <div key={`zoom-${i}`} style={{ position: "absolute", backgroundColor: "rgba(255, 255, 0, 0.3)", border: "1px solid #ffcc00", left: block.x * pageSize.width, top: block.y * pageSize.height, width: block.w * pageSize.width, height: block.h * pageSize.height }} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
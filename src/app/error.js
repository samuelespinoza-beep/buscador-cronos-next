"use client";
import { useEffect } from "react";

// Frontera de error de la app. Sin esto, un fallo de render en el buscador deja la
// pantalla en blanco con la página genérica de Next, en inglés y sin forma de reintentar.
export default function Error({ error, reset }) {
    useEffect(() => {
        console.error("Error no controlado en el buscador:", error);
    }, [error]);

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Algo falló en el buscador</h2>
            <p style={styles.text}>
                Ocurrió un error inesperado. Puedes reintentar; si vuelve a pasar, avisa al
                equipo indicando qué estabas buscando.
            </p>
            {error?.digest && <code style={styles.digest}>Referencia: {error.digest}</code>}
            <button onClick={reset} style={styles.button}>Reintentar</button>
        </div>
    );
}

const styles = {
    container: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "100vh", padding: "20px", backgroundColor: "#121212", color: "white", fontFamily: "'Segoe UI', Roboto, sans-serif", textAlign: "center" },
    title: { color: "#ffcc00", fontSize: "20px", margin: 0 },
    text: { color: "#aaa", fontSize: "14px", maxWidth: "460px", lineHeight: "1.5", margin: 0 },
    digest: { color: "#666", fontSize: "11px" },
    button: { padding: "10px 25px", backgroundColor: "#ffcc00", color: "black", fontWeight: "900", border: "none", borderRadius: "4px", cursor: "pointer", textTransform: "uppercase" },
};

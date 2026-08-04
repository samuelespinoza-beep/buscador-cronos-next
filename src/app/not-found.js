import Link from "next/link";

export default function NotFound() {
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Esta página no existe</h2>
            <p style={styles.text}>
                La dirección que abriste no corresponde a ninguna sección del buscador.
            </p>
            <Link href="/" style={styles.link}>Ir al buscador</Link>
        </div>
    );
}

const styles = {
    container: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "100vh", padding: "20px", backgroundColor: "#121212", color: "white", fontFamily: "'Segoe UI', Roboto, sans-serif", textAlign: "center" },
    title: { color: "#ffcc00", fontSize: "20px", margin: 0 },
    text: { color: "#aaa", fontSize: "14px", maxWidth: "460px", lineHeight: "1.5", margin: 0 },
    link: { padding: "10px 25px", backgroundColor: "#ffcc00", color: "black", fontWeight: "900", borderRadius: "4px", textDecoration: "none", textTransform: "uppercase", fontSize: "14px" },
};

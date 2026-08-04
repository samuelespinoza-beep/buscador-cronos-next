import "./globals.css";

export const metadata = {
  title: "Buscador de Impresos Cronos",
  description: "Búsqueda de texto sobre las ediciones impresas digitalizadas de Cronos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

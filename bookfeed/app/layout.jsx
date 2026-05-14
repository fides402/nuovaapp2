import "./globals.css";

export const metadata = {
  title: "BookFeed — private concept feed from your books",
  description: "Carica un libro, ottieni un feed privato di caroselli con i concetti più potenti.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

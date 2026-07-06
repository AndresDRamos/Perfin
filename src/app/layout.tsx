import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfin",
  description: "Rastreador de finanzas personales — MXN",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" style={{ colorScheme: "light dark" }}>
      <body className="bg-surface text-text min-h-screen antialiased">{children}</body>
    </html>
  );
}

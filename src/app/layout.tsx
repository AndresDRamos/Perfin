import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Perfin",
  description: "Rastreador de finanzas personales — MXN",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" style={{ colorScheme: "light dark" }} className={manrope.variable}>
      <body className="bg-surface text-text min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

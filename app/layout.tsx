import type { Metadata } from "next";
import { Inter } from "next/font/google"; 
import "./globals.css";

// Usamos la fuente Inter que se descarga sola
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KitchenOS",
  description: "Sistema de Gestión de Cocina",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
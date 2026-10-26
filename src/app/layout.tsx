import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "HF Runner · Modelos, sin descargas",
  description:
    "Encuentra cómo usar modelos de Hugging Face en infraestructura remota.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

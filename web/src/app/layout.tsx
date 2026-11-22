
import type { Metadata } from "next";
import AuthGate from "@/lib/auth/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "CECYFIT GO! | Plataforma profesional",
  description:
    "Plataforma de seguimiento integral y personalizado de la salud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}

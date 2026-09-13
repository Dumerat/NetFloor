import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetFloor Architect — Cartographie Spatiale & Câblage Réseau",
  description: "Solution DCIM et topologie réseau d'entreprise pour parcs de 800+ collaborateurs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased h-screen w-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

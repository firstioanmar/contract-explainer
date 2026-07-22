import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SavedAnalysesProvider } from "@/components/providers/saved-analyses-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KontrakJelas — Pahami Kontrak dengan Bahasa Awam",
  description: "Analisis kontrak dan invoice menjadi ringkasan yang mudah dipahami, data penting, dan klausul yang perlu diwaspadai.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${plusJakarta.variable} antialiased`}>
        <AuthProvider><SavedAnalysesProvider>{children}</SavedAnalysesProvider></AuthProvider>
      </body>
    </html>
  );
}

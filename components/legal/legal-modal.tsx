"use client";

import { FileText, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const content = {
  privacy: {
    title: "Privasi dokumen Anda",
    description: "Cara KontrakJelas menangani data pada versi demo.",
    icon: ShieldCheck,
    sections: [
      ["Pemrosesan", "Teks atau dokumen dikirim ke penyedia AI hanya setelah Anda memberi persetujuan dan menekan tombol analisis."],
      ["Penyimpanan", "Dokumen asli dan hasil analisis tidak disimpan di server aplikasi. Hasil yang Anda simpan berada di penyimpanan lokal browser dan terpisah berdasarkan akun Google."],
      ["Kontrol Anda", "Anda dapat menghapus hasil tersimpan dari menu akun. Hindari mengunggah rahasia yang tidak perlu untuk tujuan analisis."],
    ],
  },
  terms: {
    title: "Ketentuan penggunaan",
    description: "Batas penggunaan layanan analisis KontrakJelas.",
    icon: FileText,
    sections: [
      ["Bukan nasihat hukum", "Hasil AI ditujukan untuk membantu pemahaman awal dan tidak menggantikan pemeriksaan atau nasihat dari profesional hukum."],
      ["Periksa kembali", "AI dapat melewatkan konteks atau membuat kekeliruan. Cocokkan setiap temuan dengan dokumen sumber sebelum mengambil keputusan."],
      ["Penggunaan wajar", "Jangan mengunggah konten ilegal, berbahaya, atau data yang tidak berhak Anda proses. Ketersediaan model gratis dapat berubah atau dibatasi."],
    ],
  },
} as const;

interface LegalModalProps {
  type: keyof typeof content;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function LegalModal({ type, triggerLabel, triggerClassName }: LegalModalProps) {
  const item = content[type];
  const Icon = item.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn("rounded outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary", triggerClassName)}>
          {triggerLabel ?? (type === "privacy" ? "Privasi" : "Ketentuan")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/[.08] text-primary"><Icon className="size-5" /></span>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>
        <div className="mt-6 space-y-3">
          {item.sections.map(([title, body]) => (
            <section key={title} className="rounded-xl border bg-muted/25 p-4">
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}


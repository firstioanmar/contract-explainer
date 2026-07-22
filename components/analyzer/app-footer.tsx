import { Code2, ShieldCheck } from "lucide-react";
import { LegalModal } from "@/components/legal/legal-modal";

export function AppFooter() {
  return (
    <footer className="border-t border-border/70 bg-white/55">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-4 px-4 py-7 text-center text-[11px] text-muted-foreground sm:flex-row sm:text-left sm:px-6 lg:px-8">
        <div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" /><span>KontrakJelas membantu Anda memahami, bukan menggantikan penasihat hukum.</span></div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
          <LegalModal type="privacy" />
          <LegalModal type="terms" />
          <a href="https://github.com/firstioanmar" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded font-semibold text-foreground/70 outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
            <Code2 className="size-3.5" /> Eksperimen produk AI oleh firstioanmar
          </a>
        </div>
      </div>
    </footer>
  );
}

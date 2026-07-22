import { Heart, ShieldCheck } from "lucide-react";
import { LegalModal } from "@/components/legal/legal-modal";

export function AppFooter() {
  return (
    <footer className="border-t border-border/70 bg-white/55">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-4 px-4 py-7 text-[11px] text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" /><span>KontrakJelas membantu Anda memahami, bukan menggantikan penasihat hukum.</span></div>
        <div className="flex items-center gap-5"><LegalModal type="privacy" /><LegalModal type="terms" /><span className="flex items-center gap-1">Dibuat dengan <Heart className="size-3 fill-rose-400 text-rose-400" /> di Indonesia</span></div>
      </div>
    </footer>
  );
}

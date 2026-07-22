import { ArrowDown, Check, FileText, ScanSearch, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 pb-9 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1fr_380px] lg:px-8 lg:pb-12 lg:pt-16">
      <div className="relative z-10 max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-teal-500" />
          </span>
          AI yang menerjemahkan bahasa hukum untuk Anda
        </div>
        <h1 className="max-w-3xl text-balance text-[2.35rem] font-extrabold leading-[1.09] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-[3.45rem]">
          Pahami isi kontrak tanpa tenggelam dalam <span className="bg-gradient-to-r from-primary via-violet-500 to-teal-500 bg-clip-text text-transparent">bahasa hukum.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
          Ubah kontrak rumit menjadi ringkasan bahasa awam, data penting, dan peringatan yang bisa langsung ditindaklanjuti.
        </p>
        <a href="#analyzer" className="mt-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-primary outline-none transition hover:gap-3 focus-visible:ring-4 focus-visible:ring-primary/15">
          Mulai analisis <ArrowDown className="size-4" />
        </a>
      </div>

      <div className="relative hidden h-[220px] lg:block" aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-teal-300/20 blur-3xl" />
        <div className="animate-float absolute left-10 top-2 w-64 rotate-[-3deg] rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_28px_60px_-24px_rgba(65,45,160,.35)] backdrop-blur">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-100 text-primary"><FileText className="size-4" /></div>
            <div><div className="h-2 w-24 rounded bg-slate-200" /><div className="mt-2 h-1.5 w-16 rounded bg-slate-100" /></div>
          </div>
          <div className="space-y-2"><div className="h-1.5 rounded bg-slate-100" /><div className="h-1.5 w-5/6 rounded bg-slate-100" /><div className="h-1.5 w-3/4 rounded bg-slate-100" /></div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-amber-600"><span className="size-1.5 rounded-full bg-amber-400" /> Klausul berisiko terdeteksi</div>
        </div>
        <div className="absolute bottom-2 right-2 w-52 rotate-[4deg] rounded-2xl border border-primary/10 bg-white p-4 shadow-[0_24px_50px_-25px_rgba(15,23,42,.4)]">
          <div className="flex items-center justify-between"><ScanSearch className="size-4 text-primary" /><Sparkles className="size-3.5 text-teal-500" /></div>
          <div className="mt-3 text-[10px] font-semibold text-muted-foreground">Ringkasan selesai</div>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold"><span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check className="size-3" /></span> 8 data ditemukan</div>
        </div>
      </div>
    </section>
  );
}

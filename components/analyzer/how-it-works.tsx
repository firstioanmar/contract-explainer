import { FileInput, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";

const steps = [
  { icon: FileInput, number: "01", title: "Masukkan dokumen", text: "Tempel teks atau unggah PDF/DOCX hingga 10 MB." },
  { icon: ScanSearch, number: "02", title: "AI membaca konteks", text: "Data, kewajiban, penalti, dan risiko diidentifikasi." },
  { icon: Sparkles, number: "03", title: "Dapatkan penjelasan", text: "Lihat ringkasan awam dan tindakan yang disarankan." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="cara-kerja-title">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Sederhana & transparan</p><h2 id="cara-kerja-title" className="mt-2 text-2xl font-extrabold tracking-tight">Dari dokumen rumit menjadi jelas.</h2></div>
        <div className="flex max-w-md items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[11px] leading-5 text-emerald-800"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span><strong>Privasi demo:</strong> dokumen tidak disimpan setelah sesi analisis berakhir.</span></div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => <article key={step.number} className="group relative overflow-hidden rounded-2xl border bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_20px_45px_-30px_rgba(91,67,210,.35)]"><span className="absolute right-4 top-2 text-5xl font-black tracking-tighter text-slate-100 transition group-hover:text-primary/[.07]">{step.number}</span><span className="relative grid size-10 place-items-center rounded-xl bg-primary/[.07] text-primary"><step.icon className="size-5" /></span><h3 className="relative mt-5 text-sm font-extrabold">{step.title}</h3><p className="relative mt-2 text-xs leading-5 text-muted-foreground">{step.text}</p></article>)}
      </div>
    </section>
  );
}

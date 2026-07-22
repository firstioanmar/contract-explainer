"use client";

import { Download, History, LogOut, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useSavedAnalyses } from "@/components/providers/saved-analyses-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { downloadAnalysisPdf } from "@/lib/export-analysis-pdf";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { analyses, remove } = useSavedAnalyses();
  if (!user) return null;

  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="bg-white"><History /> <span className="hidden sm:inline">Riwayat</span>{analyses.length > 0 && <span className="grid size-4 place-items-center rounded-full bg-primary text-[9px] text-white">{analyses.length}</span>}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Analisis tersimpan</DialogTitle><DialogDescription>Disimpan secara lokal di perangkat ini untuk akun {user.email}.</DialogDescription></DialogHeader>
          <div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">
            {analyses.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">Belum ada hasil yang disimpan.</div> : analyses.map((item) => <article key={item.id} className="rounded-xl border p-3.5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-bold">{item.result.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.savedAt).toLocaleString("id-ID")} · Perhatian {item.result.attention}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => downloadAnalysisPdf(item.result)} aria-label="Unduh PDF"><Download /></Button><Button variant="ghost" size="icon" className="text-rose-600" onClick={() => remove(item.id)} aria-label="Hapus analisis"><Trash2 /></Button></div></div></article>)}
          </div>
        </DialogContent>
      </Dialog>
      <div className="hidden items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2 sm:flex"><span className="grid size-7 place-items-center rounded-full bg-primary/[.1] text-[10px] font-bold text-primary">{initials || <UserRound className="size-3.5" />}</span><span className="max-w-24 truncate text-[11px] font-semibold">{user.name}</span></div>
      <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Keluar dari akun Google" title="Keluar"><LogOut /></Button>
    </div>
  );
}

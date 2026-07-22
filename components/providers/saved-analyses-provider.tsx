"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { ContractResult } from "@/lib/contract-types";
import type { SavedAnalysis } from "@/lib/saved-analysis";

interface SavedAnalysesContextValue {
  analyses: SavedAnalysis[];
  save: (result: ContractResult) => SavedAnalysis | null;
  remove: (id: string) => void;
}

const SavedAnalysesContext = createContext<SavedAnalysesContextValue | null>(null);

function storageKey(userId: string) {
  return `kontrakjelas:analyses:${userId}`;
}

export function SavedAnalysesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);

  useEffect(() => {
    let active = true;
    const next = (() => {
      if (!user) return [];
      try {
        const raw = localStorage.getItem(storageKey(user.id));
        return raw ? JSON.parse(raw) as SavedAnalysis[] : [];
      } catch {
        return [];
      }
    })();

    queueMicrotask(() => { if (active) setAnalyses(next); });
    return () => { active = false; };
  }, [user]);

  const persist = useCallback((next: SavedAnalysis[]) => {
    if (!user) return;
    localStorage.setItem(storageKey(user.id), JSON.stringify(next));
    setAnalyses(next);
  }, [user]);

  const save = useCallback((result: ContractResult) => {
    if (!user) return null;
    const saved: SavedAnalysis = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), result };
    persist([saved, ...analyses].slice(0, 20));
    return saved;
  }, [analyses, persist, user]);

  const remove = useCallback((id: string) => persist(analyses.filter((item) => item.id !== id)), [analyses, persist]);

  const value = useMemo(() => ({ analyses, save, remove }), [analyses, save, remove]);
  return <SavedAnalysesContext.Provider value={value}>{children}</SavedAnalysesContext.Provider>;
}

export function useSavedAnalyses() {
  const context = useContext(SavedAnalysesContext);
  if (!context) throw new Error("useSavedAnalyses harus digunakan di dalam SavedAnalysesProvider.");
  return context;
}

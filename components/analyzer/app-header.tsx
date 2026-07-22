"use client";

import { Scale, Sparkles } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/components/providers/auth-provider";

export function AppHeader() {
  const { user, error } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#main" className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-primary/15" aria-label="KontrakJelas, kembali ke workspace">
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-transform group-hover:rotate-3">
            <Scale className="size-[19px]" strokeWidth={2.3} />
            <Sparkles className="absolute right-0.5 top-0.5 size-2.5 text-teal-200" />
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.04em]">Kontrak<span className="text-primary">Jelas</span></span>
          <span className="hidden rounded-full border border-primary/15 bg-primary/[.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary sm:inline">Beta</span>
        </a>
        <div className="relative flex items-center gap-2">
          {!user && <span className="hidden text-xs text-muted-foreground lg:inline">Masuk untuk menyimpan hasil</span>}
          {user ? <UserMenu /> : <GoogleLoginButton />}
          {error && <span className="absolute right-0 top-11 w-64 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[10px] leading-4 text-rose-700 shadow-lg" role="alert">{error}</span>}
        </div>
      </div>
    </header>
  );
}

"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { GOOGLE_CLIENT_ID } from "@/lib/auth/config";
import { useAuth } from "@/components/providers/auth-provider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode: "popup" }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

export function GoogleLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const { loginWithGoogle, loading } = useAuth();

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: "popup",
      callback: ({ credential }) => void loginWithGoogle(credential).catch(() => undefined),
    });
    containerRef.current.replaceChildren();
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "medium",
      shape: "pill",
      text: "continue_with",
      locale: "id",
      width: 210,
    });
  }, [loginWithGoogle, ready]);

  return (
    <div className="relative min-h-10 min-w-[92px]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      {(!ready || loading) && <div className="absolute inset-0 z-10 grid place-items-center rounded-full border bg-white text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /><span className="sr-only">Memuat login Google</span></div>}
      <div ref={containerRef} aria-label="Masuk dengan Google" />
    </div>
  );
}

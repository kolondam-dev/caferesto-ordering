"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
    __turnstileOnload?: () => void;
  }
}

export const TURNSTILE_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Widget Cloudflare Turnstile. Tanpa NEXT_PUBLIC_TURNSTILE_SITE_KEY komponen
 * tidak merender apa pun (dev/CI). onToken("") dipanggil saat token kedaluwarsa.
 */
export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const el = ref.current;

    const render = () => {
      if (widgetId.current || !window.turnstile) return; // guard StrictMode double-run
      widgetId.current = window.turnstile.render(el, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
        theme: "light",
      });
    };

    if (window.turnstile) render();
    else {
      window.__turnstileOnload = render;
      if (!document.querySelector("script[data-turnstile]")) {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__turnstileOnload";
        s.async = true;
        s.setAttribute("data-turnstile", "1");
        document.head.appendChild(s);
      }
    }

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="my-2 flex justify-center" />;
}

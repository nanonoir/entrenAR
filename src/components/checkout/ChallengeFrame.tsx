"use client";

import { useEffect, useRef } from "react";
import { isTrustedChallengeMessage } from "@/lib/api/payments/challenge-url";

interface ChallengeFrameProps {
  /** Already validated against the https Mercado Pago host allowlist by the payments mapper. */
  url: string;
  /** Called when the trusted frame signals completion; the caller only refreshes the backend status. */
  onSignal: () => void;
}

export function ChallengeFrame({ onSignal, url }: ChallengeFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const signalRef = useRef(onSignal);

  useEffect(() => {
    signalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isTrustedChallengeMessage(event, frameRef.current?.contentWindow)) return;
      signalRef.current();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      className="h-[28rem] w-full rounded-card border border-border bg-surface sm:h-[34rem]"
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
      src={url}
      title="Verificación de seguridad de tu tarjeta"
    />
  );
}

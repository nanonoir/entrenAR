"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/stores/admin-auth-store";

const BOOTSTRAP_STATE = { LOADING: "loading", READY: "ready", FAILED: "failed" } as const;
type BootstrapState = (typeof BOOTSTRAP_STATE)[keyof typeof BOOTSTRAP_STATE];

export function AdminBootstrapBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<BootstrapState>(BOOTSTRAP_STATE.LOADING);
  const bootstrap = useAdminAuthStore((current) => current.bootstrap);
  const recordHumanActivity = useAdminAuthStore((current) => current.recordHumanActivity);

  useEffect(() => {
    let cancelled = false;
    void bootstrap()
      .then((success) => {
        if (cancelled) return;
        setState(success ? BOOTSTRAP_STATE.READY : BOOTSTRAP_STATE.FAILED);
        if (!success) router.replace("/admin/login?expired=true");
      })
      .catch(() => {
        if (cancelled) return;
        setState(BOOTSTRAP_STATE.FAILED);
        router.replace("/admin/login?expired=true");
      });
    return () => { cancelled = true; };
  }, [bootstrap, router]);

  useEffect(() => {
    const events = ["click", "keydown", "pointerdown", "touchstart", "input"] as const;
    const onActivity = () => recordHumanActivity();
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    return () => { for (const event of events) window.removeEventListener(event, onActivity); };
  }, [recordHumanActivity]);

  if (state === BOOTSTRAP_STATE.LOADING) return <div className="min-h-screen bg-zinc-50" aria-busy="true" />;
  if (state === BOOTSTRAP_STATE.FAILED) return <div className="min-h-screen bg-zinc-50" />;
  return children;
}

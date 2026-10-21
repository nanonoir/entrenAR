"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { nextPollDelayMs, POLL_FAST_MS, retrySecondsRemaining } from "@/lib/api/payments/payment-result";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";

/**
 * Re-reads the backend status while `active`: every 3s, every 10s after the first minute, or the server hint.
 * Pauses while the tab is hidden or offline, resumes immediately afterwards, and aborts on unmount.
 */
export function usePaymentStatusPolling(active: boolean): void {
  const refresh = useCheckoutPaymentStore((state) => state.refresh);
  const readNextDelay = useEffectEvent((elapsedMs: number) => {
    const view = useCheckoutPaymentStore.getState().view;
    return view ? nextPollDelayMs(view, elapsedMs) : POLL_FAST_MS;
  });
  const poll = useEffectEvent((signal: AbortSignal) => refresh(signal));

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let paused = false;

    const canPoll = () => !document.hidden && navigator.onLine;

    function schedule() {
      const delay = readNextDelay(Date.now() - startedAt);
      if (delay === null || controller.signal.aborted) return;
      timer = setTimeout(() => void tick(), delay);
    }

    async function tick() {
      if (controller.signal.aborted) return;
      if (!canPoll()) {
        paused = true;
        return;
      }
      await poll(controller.signal);
      schedule();
    }

    function resume() {
      if (!paused || !canPoll()) return;
      paused = false;
      void tick();
    }

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    schedule();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [active]);
}

/** Whole seconds left until `until`, ticking once per second. */
export function useRetryCountdown(until: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [until]);

  return retrySecondsRemaining(until, now);
}

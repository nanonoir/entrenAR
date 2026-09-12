"use client";

import { create } from "zustand";
import type { AccountUser } from "@/types/account";
import { clearAdminAccessToken, getAdminAccessToken, setAdminAccessToken } from "@/lib/api/admin/auth/admin-access-token";
import { invalidateAdminRequests } from "@/lib/api/admin/client";
import { invalidateAdminSession } from "@/lib/api/admin/auth/admin-session-generation";
import { resetAdminState } from "@/stores/admin-reset";

const IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
const ACTIVITY_THROTTLE_MS = 5_000;
const CHANNEL_NAME = "entrenar-admin-session";
const MESSAGE = { ACTIVITY: "activity", EXPIRED: "session-expired", LOGOUT: "logout", REFRESH_COMPLETED: "refresh-completed", REFRESH_STARTED: "refresh-started" } as const;
type AdminSessionMessage = (typeof MESSAGE)[keyof typeof MESSAGE];

export interface AdminAuthState {
  user: AccountUser | null;
  isAuthenticated: boolean;
  isBootstrapped: boolean;
  isExpired: boolean;
  lastActivityAt: number | null;
  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  expire: () => Promise<void>;
  recordHumanActivity: () => void;
}

let refreshPromise: Promise<boolean> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivityBroadcast = 0;
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return channel ??= new BroadcastChannel(CHANNEL_NAME);
}

function publish(type: AdminSessionMessage, at?: number): void { getChannel()?.postMessage({ at, type }); }

function armIdleTimer(at: number): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { void useAdminAuthStore.getState().expire(); }, Math.max(0, at + IDLE_TIMEOUT_MS - Date.now()));
}

async function readSession(path: string, body?: unknown): Promise<{ accessToken: string; user: AccountUser }> {
  const response = await fetch(path, { body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", credentials: "include", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, method: "POST" });
  const payload = await response.json().catch(() => undefined) as unknown;
  if (!response.ok || !isSession(payload)) throw new Error("The administrator session could not be established.");
  return payload;
}

function isSession(value: unknown): value is { accessToken: string; user: AccountUser } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === "string" && typeof record.user === "object" && record.user !== null;
}

async function terminate(mode: "expired" | "logout"): Promise<void> {
  clearAdminAccessToken();
  invalidateAdminSession();
  invalidateAdminRequests();
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  refreshPromise = null;
  await resetAdminState();
  if (mode === "expired") publish(MESSAGE.EXPIRED);
  else publish(MESSAGE.LOGOUT);
  useAdminAuthStore.setState({ isAuthenticated: false, isBootstrapped: true, isExpired: mode === "expired", lastActivityAt: null, user: null });
}

export const useAdminAuthStore = create<AdminAuthState>()((set, get) => {
  const currentChannel = getChannel();
  if (currentChannel) currentChannel.onmessage = (event: MessageEvent<{ at?: number; type?: string }>) => {
    const message = event.data;
    if (message.type === MESSAGE.ACTIVITY && typeof message.at === "number" && message.at > (get().lastActivityAt ?? 0)) {
      set({ lastActivityAt: message.at }); armIdleTimer(message.at);
    }
    if (message.type === MESSAGE.LOGOUT || message.type === MESSAGE.EXPIRED) void terminate(message.type === MESSAGE.EXPIRED ? "expired" : "logout");
    if (message.type === MESSAGE.REFRESH_COMPLETED) armIdleTimer(get().lastActivityAt ?? Date.now());
  };

  return {
    user: null,
    isAuthenticated: Boolean(getAdminAccessToken()),
    isBootstrapped: false,
    isExpired: false,
    lastActivityAt: null,
    bootstrap: async () => {
      if (get().isAuthenticated && getAdminAccessToken()) return true;
      return get().refresh();
    },
    login: async (email, password) => {
      try {
        const session = await readSession("/api/admin-session/login", { email: email.trim().toLowerCase(), password });
        const at = Date.now(); setAdminAccessToken(session.accessToken); set({ isAuthenticated: true, isBootstrapped: true, isExpired: false, lastActivityAt: at, user: session.user }); armIdleTimer(at); publish(MESSAGE.REFRESH_COMPLETED, at); return true;
      } catch { await terminate("expired"); return false; }
    },
    refresh: async () => {
      if (!refreshPromise) {
        publish(MESSAGE.REFRESH_STARTED);
        refreshPromise = readSession("/api/admin-session/refresh").then((session) => { const at = Date.now(); setAdminAccessToken(session.accessToken); set({ isAuthenticated: true, isBootstrapped: true, isExpired: false, lastActivityAt: get().lastActivityAt ?? at, user: session.user }); armIdleTimer(get().lastActivityAt ?? at); publish(MESSAGE.REFRESH_COMPLETED, at); return true; }).catch(async () => { await terminate("expired"); return false; }).finally(() => { refreshPromise = null; });
      }
      return refreshPromise;
    },
    logout: async () => { try { await fetch("/api/admin-session/logout", { credentials: "include", method: "POST" }); } finally { await terminate("logout"); } },
    expire: () => terminate("expired"),
    recordHumanActivity: () => {
      const at = Date.now(); set({ lastActivityAt: at }); armIdleTimer(at);
      if (at - lastActivityBroadcast >= ACTIVITY_THROTTLE_MS) { lastActivityBroadcast = at; publish(MESSAGE.ACTIVITY, at); }
    },
  };
});

"use client";

// Client-side singleton store for the AI batch analysis, mirroring
// sweep-store.ts. The loop lives OUTSIDE React, so starting a batch on the
// dashboard and then walking over to Leads no longer kills it — it keeps
// analyzing in the background and the dashboard shows its live progress when
// you come back.

import { api, ApiError } from "@/lib/client";

// Pace the calls for the Gemini free-tier rate limit (~12/min max).
const BATCH_DELAY_MS = 5000;

export type AnalyzeState = {
  running: boolean;
  total: number;
  done: number;
  msg: string;
  /** leads still waiting, as last reported by the server */
  remaining: number | null;
  toast: { msg: string; seq: number } | null;
};

let state: AnalyzeState = {
  running: false,
  total: 0,
  done: 0,
  msg: "",
  remaining: null,
  toast: null,
};

const listeners = new Set<() => void>();
function set(patch: Partial<AnalyzeState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
function toast(msg: string) {
  set({ toast: { msg, seq: (state.toast?.seq ?? 0) + 1 } });
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function getSnapshot(): AnalyzeState {
  return state;
}

export const batch = {
  /** Start, or pause a running batch. `waiting` = leads not yet analyzed. */
  async toggle(waiting: number) {
    if (state.running) {
      set({ running: false });
      return;
    }
    if (!waiting) return;
    if (!state.total || state.done >= state.total) {
      set({ total: waiting + state.done });
    }
    set({ running: true });
    // The loop reads the live module `state`, so a pause from any page is seen
    // on the next iteration. It is not tied to a component's lifetime.
    while (state.running) {
      try {
        const r = await api<{
          analyzed: { id: number; name: string; score: number; dropped?: boolean } | null;
          remaining: number;
        }>("/api/analyze/step", { method: "POST" });
        if (!r.analyzed) {
          set({ running: false, msg: "", remaining: 0 });
          break;
        }
        set({
          done: state.done + 1,
          remaining: r.remaining,
          msg: r.analyzed.dropped
            ? `${r.analyzed.name} → has a website, removed`
            : `${r.analyzed.name} → ${r.analyzed.score}`,
        });
        if (r.remaining === 0) {
          set({ running: false });
          break;
        }
      } catch (e) {
        set({ running: false });
        if (e instanceof ApiError && e.quotaBlocked) toast("⛨ Quota Guardian stopped the batch");
        else toast(e instanceof Error ? e.message : "batch failed");
        break;
      }
      if (state.running) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  },
};

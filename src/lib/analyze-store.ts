"use client";

// Client-side singleton store for the AI batch analysis, mirroring
// sweep-store.ts. The loop lives OUTSIDE React, so starting a batch on the
// dashboard and then walking over to Leads no longer kills it — it keeps
// analyzing in the background and the dashboard shows its live progress when
// you come back.

import { api, ApiError } from "@/lib/client";

// Pace the calls for the Gemini free-tier rate limit (~12/min max).
const BATCH_DELAY_MS = 5000;
// A failed step is usually Gemini's per-minute rate limit or a network blip, not
// a reason to stop: back off and keep going. Only a Guardian block or this many
// failures in a row ends the run.
const MAX_FAILS = 6;
const BACKOFF_MS = [15000, 30000, 45000, 60000, 60000, 60000];

export type AnalyzeState = {
  running: boolean;
  total: number;
  done: number;
  msg: string;
  /** consecutive failed steps — shown while it retries */
  retrying: number;
  /** leads still waiting, as last reported by the server */
  remaining: number | null;
  toast: { msg: string; seq: number } | null;
};

let state: AnalyzeState = {
  running: false,
  total: 0,
  done: 0,
  msg: "",
  retrying: 0,
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
    set({ running: true, retrying: 0 });
    // The loop reads the live module `state`, so a pause from any page is seen
    // on the next iteration. It is not tied to a component's lifetime.
    let fails = 0;
    while (state.running) {
      let wait = BATCH_DELAY_MS;
      try {
        const r = await api<{
          analyzed: { id: number; name: string; score: number; dropped?: boolean } | null;
          remaining: number;
        }>("/api/analyze/step", { method: "POST" });
        fails = 0;
        if (!r.analyzed) {
          set({ running: false, msg: "", remaining: 0, retrying: 0 });
          break;
        }
        set({
          done: state.done + 1,
          remaining: r.remaining,
          retrying: 0,
          msg: r.analyzed.dropped
            ? `${r.analyzed.name} → has a website, deleted`
            : `${r.analyzed.name} → ${r.analyzed.score}`,
        });
        if (r.remaining === 0) {
          set({ running: false });
          break;
        }
      } catch (e) {
        // The Guardian is the one hard stop — that one really is out of budget.
        if (e instanceof ApiError && e.quotaBlocked) {
          set({ running: false, retrying: 0 });
          toast("⛨ Quota Guardian stopped the batch");
          break;
        }
        fails++;
        if (fails >= MAX_FAILS) {
          set({ running: false, retrying: 0 });
          toast(e instanceof Error ? `paused after ${fails} failures — ${e.message}` : "batch failed");
          break;
        }
        wait = BACKOFF_MS[Math.min(fails - 1, BACKOFF_MS.length - 1)];
        set({
          retrying: fails,
          msg: `rate-limited or a hiccup — retrying in ${Math.round(wait / 1000)}s (attempt ${fails}/${MAX_FAILS})`,
        });
      }
      if (state.running) await new Promise((r) => setTimeout(r, wait));
    }
  },
};

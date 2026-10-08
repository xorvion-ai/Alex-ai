"use client";

// Client-side singleton store for the Discover sweep. It lives OUTSIDE React so
// a running sweep — its polling loop, live feed, progress, and form — survives
// navigation between pages. Leave Discover for Leads and the sweep keeps going;
// come back and the scan is still running (or its final result is still shown),
// instead of the page resetting.

import { api, ApiError } from "@/lib/client";
import { DEFAULT_COUNTRY } from "@/lib/config";

export type FeedItem = {
  name: string;
  src: "G" | "OSM" | "TT";
  meta: string;
  tag: "NO_SITE" | "SOCIAL";
};

export type Progress = {
  status: "running" | "stopped" | "complete";
  cursor: number;
  total: number;
  requests: number;
  scanned: number;
  added: number;
  quotaBlocked?: boolean;
  error?: string;
  partial?: boolean;
};

export type SweepState = {
  country: string;
  city: string;
  keyword: string;
  catSel: Record<string, boolean>;
  srcSel: Record<string, boolean>;
  keyAvail: Record<string, boolean>;
  moreCats: boolean;
  running: boolean;
  doneState: "idle" | "done" | "stopped";
  feed: FeedItem[];
  prog: Progress | null;
  searchId: number | null;
  /** the last sweep stopped on errors, not by STOP — RESUME can carry it on */
  resumable: boolean;
  settingsLoaded: boolean;
  // A one-shot message for the page to surface as a toast (seq de-dupes it).
  toast: { msg: string; seq: number } | null;
};

let state: SweepState = {
  country: DEFAULT_COUNTRY,
  city: "",
  keyword: "",
  catSel: { restaurant: true, salon: true },
  srcSel: { google: true, osm: true, tomtom: true },
  keyAvail: { google: true, tomtom: true },
  moreCats: false,
  running: false,
  doneState: "idle",
  feed: [],
  prog: null,
  searchId: null,
  resumable: false,
  settingsLoaded: false,
  toast: null,
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<SweepState>) {
  state = { ...state, ...patch };
  emit();
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
export function getSnapshot(): SweepState {
  return state;
}

export const sweep = {
  setCountry: (v: string) => set({ country: v }),
  setCity: (v: string) => set({ city: v }),
  setKeyword: (v: string) => set({ keyword: v }),
  setMoreCats: (v: boolean) => set({ moreCats: v }),

  toggleCat(id: string) {
    if (id === "any") {
      set({ catSel: { any: true } });
      return;
    }
    const next = { ...state.catSel, [id]: !state.catSel[id] };
    delete next.any;
    if (!Object.values(next).some(Boolean)) return;
    set({ catSel: next });
  },

  toggleSource(k: string) {
    if (k !== "osm" && !state.keyAvail[k]) {
      toast(`${k} needs an API key — add it to .env (see .env.example)`);
      return;
    }
    set({ srcSel: { ...state.srcSel, [k]: !state.srcSel[k] } });
  },

  // Load defaults from settings once per browser session (not on every mount),
  // so returning to Discover never clobbers a configured/running sweep.
  async loadSettings() {
    if (state.settingsLoaded) return;
    set({ settingsLoaded: true });
    try {
      const r = await api<{
        settings: { defaultCountry: string; defaultCategories: string[] };
        keys: { googlePlaces: string | null; tomtom: string | null };
      }>("/api/settings");
      const sel: Record<string, boolean> = {};
      for (const c of r.settings.defaultCategories) sel[c] = true;
      const avail = { google: !!r.keys.googlePlaces, tomtom: !!r.keys.tomtom };
      set({
        country: r.settings.defaultCountry,
        catSel: Object.keys(sel).length ? sel : state.catSel,
        keyAvail: avail,
        srcSel: { google: avail.google, osm: true, tomtom: avail.tomtom },
      });
    } catch {
      // keep defaults if settings can't be read
    }
  },

  async toggle() {
    // STOP
    if (state.running) {
      const id = state.searchId;
      set({ running: false, doneState: "stopped", resumable: false });
      if (id)
        api("/api/sweep/stop", { method: "POST", body: JSON.stringify({ searchId: id }) }).catch(
          () => {},
        );
      return;
    }
    // START
    const cats = Object.keys(state.catSel).filter((k) => state.catSel[k]);
    const sources = Object.keys(state.srcSel).filter((k) => state.srcSel[k]);
    if (!state.city.trim()) {
      toast("enter a city / area first");
      return;
    }
    if (!sources.length) {
      toast("pick at least one lead source");
      return;
    }
    set({ feed: [], prog: null, doneState: "idle", running: true, searchId: null, resumable: false });
    try {
      const start = await api<{ id: number; total: number; warning?: string }>("/api/sweep", {
        method: "POST",
        body: JSON.stringify({
          country: state.country,
          city: state.city,
          keyword: state.keyword,
          categories: cats,
          sources,
        }),
      });
      if (start.warning) toast(start.warning);
      set({ searchId: start.id });
      await drive(start.id);
    } catch (e) {
      set({ running: false, doneState: "stopped" });
      if (e instanceof ApiError && e.quotaBlocked) toast("⛨ Quota Guardian stopped the sweep");
      else toast(e instanceof Error ? e.message : "sweep failed");
    }
  },

  /** Pick a stopped sweep back up where it left off, instead of starting over. */
  async resume() {
    const id = state.searchId;
    if (!id || state.running) return;
    set({ running: true, doneState: "idle", resumable: false });
    try {
      await api("/api/sweep/resume", { method: "POST", body: JSON.stringify({ searchId: id }) });
    } catch (e) {
      set({ running: false, doneState: "stopped", resumable: true });
      toast(e instanceof Error ? e.message : "could not resume");
      return;
    }
    await drive(id);
  },
};

// How long to wait before each retry of a step that failed outright — a network
// blip, or the server being busy. Six tries spread over ~3 minutes.
const BACKOFF_MS = [3_000, 8_000, 15_000, 30_000, 45_000, 60_000];

/**
 * Step a sweep until it finishes, stops, or fails for good.
 *
 * It used to give up on the FIRST failed step: one network blip and the sweep
 * stopped, and the only way on was START, which began a brand-new sweep from
 * zero and paid again for every Google query already done. Now a failed step
 * is retried with backoff, and if it still fails the sweep is left resumable —
 * RESUME continues the same sweep, on the same query.
 *
 * The loop reads the live module `state`, so a STOP (or unmount) elsewhere is
 * seen on the next iteration. It is NOT tied to any component.
 */
async function drive(searchId: number) {
  let fails = 0;
  while (state.running) {
    let r: { progress: Progress; newLeads: FeedItem[] };
    try {
      r = await api<{ progress: Progress; newLeads: FeedItem[] }>("/api/sweep/step", {
        method: "POST",
        body: JSON.stringify({ searchId }),
      });
    } catch (e) {
      if (e instanceof ApiError && e.quotaBlocked) {
        set({ running: false, doneState: "stopped" });
        toast("⛨ Quota Guardian stopped the sweep");
        return;
      }
      if (fails >= BACKOFF_MS.length) {
        set({ running: false, doneState: "stopped", resumable: true });
        toast("sweep paused — the server kept failing. Press RESUME to carry on where it stopped.");
        return;
      }
      const wait = BACKOFF_MS[fails++];
      toast(`step failed — retrying in ${Math.round(wait / 1000)}s (${fails}/${BACKOFF_MS.length})`);
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    fails = 0;

    const patch: Partial<SweepState> = { prog: r.progress };
    if (r.newLeads.length)
      patch.feed = [...r.newLeads.slice().reverse(), ...state.feed].slice(0, 200);
    set(patch);
    if (r.progress.error) toast(r.progress.error);
    if (r.progress.status !== "running") {
      set({
        running: false,
        doneState: r.progress.status === "complete" ? "done" : "stopped",
      });
      if (r.progress.quotaBlocked) toast("⛨ Quota Guardian stopped the sweep");
      return;
    }
    // a partial step means more of the same query is waiting — go straight on
    await new Promise((res) => setTimeout(res, r.progress.partial ? 0 : 350));
  }
}

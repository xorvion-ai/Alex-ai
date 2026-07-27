"use client";

// Client-side singleton store for the Discover sweep. It lives OUTSIDE React so
// a running sweep — its polling loop, live feed, progress, and form — survives
// navigation between pages. Leave Discover for Leads and the sweep keeps going;
// come back and the scan is still running (or its final result is still shown),
// instead of the page resetting.

import { api, ApiError } from "@/lib/client";

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
  settingsLoaded: boolean;
  // A one-shot message for the page to surface as a toast (seq de-dupes it).
  toast: { msg: string; seq: number } | null;
};

let state: SweepState = {
  country: "🌍 Global",
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
      set({ running: false, doneState: "stopped" });
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
    set({ feed: [], prog: null, doneState: "idle", running: true, searchId: null });
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
      // The loop reads the live module `state`, so a STOP (or unmount) elsewhere
      // is seen on the next iteration. It is NOT tied to any component.
      while (state.running) {
        const r = await api<{ progress: Progress; newLeads: FeedItem[] }>("/api/sweep/step", {
          method: "POST",
          body: JSON.stringify({ searchId: start.id }),
        });
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
          break;
        }
        await new Promise((res) => setTimeout(res, 350));
      }
    } catch (e) {
      set({ running: false, doneState: "stopped" });
      if (e instanceof ApiError && e.quotaBlocked) toast("⛨ Quota Guardian stopped the sweep");
      else toast(e instanceof Error ? e.message : "sweep failed");
    }
  },
};

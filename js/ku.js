// Kansas men's basketball games. When switched on (More → Settings), the app
// loads the Jayhawks' schedule from ESPN and keeps each game as an Event, so
// games show on their day, in Week and Month view, and in "Coming up" the day
// before. The schedule is refreshed at most every 6 hours while the app is open.

import * as S from './store.js';

const SCHEDULE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/2305/schedule';
const KANSAS_ID = '2305';
const REFRESH_MS = 6 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Turn ESPN's schedule into simple game records.
export function parseSchedule(json) {
  const out = [];
  for (const ev of json?.events || []) {
    const comp = ev.competitions?.[0];
    const teams = comp?.competitors || [];
    const ku = teams.find((c) => String(c.id ?? c.team?.id) === KANSAS_ID);
    const opp = teams.find((c) => c !== ku);
    if (!ev.id || !ev.date || !ku || !opp) continue;
    const oppName = opp.team?.shortDisplayName || opp.team?.location || opp.team?.displayName || 'TBD';
    const where = ku.homeAway === 'home' || comp.neutralSite ? 'vs.' : 'at';
    const timeKnown = comp.timeValid !== false && ev.timeValid !== false;
    const d = new Date(ev.date);
    const tv = (comp.broadcasts || []).map((b) => b.media?.shortName || b.names?.[0]).filter(Boolean);
    const status = comp.status?.type || ev.status?.type;
    let result = '';
    if (status?.completed && ku.score != null && opp.score != null) {
      const k = Number(ku.score?.value ?? ku.score?.displayValue ?? ku.score);
      const o = Number(opp.score?.value ?? opp.score?.displayValue ?? opp.score);
      if (!Number.isNaN(k) && !Number.isNaN(o)) result = `${k > o ? 'W' : 'L'} ${k}–${o}`;
    }
    out.push({
      extId: String(ev.id),
      title: `🏀 Kansas ${where} ${oppName}`,
      date: timeKnown ? localKey(d) : ev.date.slice(0, 10),
      time: timeKnown ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null,
      notes: [result && `Final: ${result}`, tv.length && `TV: ${tv.join(', ')}`, comp.venue?.fullName].filter(Boolean).join('\n'),
    });
  }
  return out;
}

export async function syncKU({ force = false } = {}) {
  const st = S.getData().settings;
  if (!st.kuGames) return;
  if (!force && st.kuSyncedAt && Date.now() - Date.parse(st.kuSyncedAt) < REFRESH_MS) return;
  try {
    const res = await fetch(SCHEDULE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const games = parseSchedule(await res.json());
    if (!games.length) throw new Error('no games');
    S.syncExternalEvents('ku', games);
    S.setSettings({ kuSyncedAt: new Date().toISOString(), kuError: null, kuCount: games.length });
  } catch (e) {
    S.setSettings({ kuError: navigator.onLine === false ? 'You are offline' : "Couldn't load the schedule from ESPN" });
  }
}

export function startKU() {
  syncKU();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncKU(); });
}

import React, { useEffect, useMemo, useState } from "react";

/**
 * Sleeper Lineup Completeness Checker — client-only
 *
 * What it does
 * - Fetches the current NFL week from Sleeper
 * - Loads league users, rosters, and matchups for that week
 * - Checks each starter's injury status from the /players/nfl dictionary
 * - Marks teams as:
 *    • Complete (green) — all starters eligible
 *    • Potential to be Incomplete (orange) — at least one starter Questionable/Doubtful
 *    • Incomplete (red) — at least one starter Out/IR/Suspended or on BYE
 * - Shows dynasty team names and their avatars
 * - Defaults to League ID 1180160954902351872 (editable input)
 *
 * Notes
 * - The Sleeper API doesn't expose a simple week-by-week schedule/bye feed.
 *   We include a hardcoded 2025 bye map below (source: FantasyAlarm May 14, 2025).
 *   You can update BYE_MAP_2025 for accuracy each season, or wire a schedule API.
 */

const DEFAULT_LEAGUE_ID = "1180160954902351872";
const API = "https://api.sleeper.app/v1";

// --- 2025 NFL Bye Weeks map (teams by Sleeper/standard abbreviations) ---
// Keep this mapping updated per season. Weeks are NFL regular-season weeks.
// Source: FantasyAlarm "2025 NFL Bye Weeks" (May 14, 2025).
// If a team appears under the current week, its players/DST are treated as OUT.
// Abbreviations should match Sleeper player.team (e.g., "KC", "PHI").
const BYE_MAP_2025: Record<number, string[]> = {
  // Example structure; update with actual 2025 data as needed.
  // Week: ["TEAM1", "TEAM2", ...]
  5: ["DET", "SEA"],
  6: ["GB", "IND", "LV", "MIA"],
  7: ["BUF", "CIN", "DAL"],
  8: ["BAL", "CAR", "JAX", "TB"],
  9: ["CHI", "CLE", "DEN", "LAR", "NE", "NYJ"],
  10: ["ARI", "MIN", "NO", "NYG"],
  11: ["ATL", "HOU", "KC", "PHI", "PIT", "TEN"],
  12: ["LAC", "SF", "WAS"],
  13: ["DAL", "BAL", "CIN"],
  14: ["BUF", "CAR", "JAX", "TB"],
};

// Color tokens
const BG = {
  OK: "bg-emerald-600",
  POTENTIAL: "bg-amber-500",
  INCOMPLETE: "bg-rose-600",
};

const LIGHT = {
  OK: "bg-emerald-50 ring-1 ring-emerald-200",
  POTENTIAL: "bg-amber-50 ring-1 ring-amber-200",
  INCOMPLETE: "bg-rose-50 ring-1 ring-rose-200",
};

function avatarUrl(avatarId?: string | null, size: "thumbs" | "full" = "thumbs") {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/${size === "thumbs" ? "thumbs/" : ""}${avatarId}`;
}

function displayTeamName(user: any) {
  return (
    user?.metadata?.team_name || user?.display_name || user?.username || `Team ${user?.user_id}`
  );
}

function isDSTStarterId(pid: string) {
  return /^[A-Z]{2,4}$/.test(pid); // e.g., "PHI", "KC" as D/ST codes
}

function classifyInjury(player: any): "OK" | "POTENTIAL" | "INCOMPLETE" {
  const inj = String(player?.injury_status || "").toLowerCase();
  const status = String(player?.status || "").toLowerCase();
  // Treat IR/Suspended as OUT as requested
  if (["out", "ir", "suspended"].includes(inj) || ["ir", "suspension"].includes(status))
    return "INCOMPLETE";
  if (["questionable", "doubtful"].includes(inj)) return "POTENTIAL";
  return "OK";
}

function useSleeper(leagueId: string) {
  const [state, setState] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);
  const [matchups, setMatchups] = useState<any[]>([]);
  const [players, setPlayers] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const nfl = await fetch(`${API}/state/nfl`).then((r) => r.json());
        if (aborted) return;
        setState(nfl);
        const week = nfl.display_week || nfl.week || nfl.leg;
        const [u, r, m, p] = await Promise.all([
          fetch(`${API}/league/${leagueId}/users`).then((r) => r.json()),
          fetch(`${API}/league/${leagueId}/rosters`).then((r) => r.json()),
          fetch(`${API}/league/${leagueId}/matchups/${week}`).then((r) => r.json()),
          fetch(`${API}/players/nfl`).then((r) => r.json()), // large — cacheable
        ]);
        if (aborted) return;
        setUsers(u);
        setRosters(r);
        setMatchups(Array.isArray(m) ? m : []);
        setPlayers(p);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load data");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [leagueId]);

  return { state, users, rosters, matchups, players, loading, error };
}

function Section({ title, items, tone }: { title: string; items: any[]; tone: keyof typeof LIGHT }) {
  return (
    <div className={`rounded-2xl p-4 ${LIGHT[tone]} shadow-sm`}> 
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-3 w-3 rounded-full ${BG[tone]}`} />
        <h3 className="font-semibold text-gray-900">{title} <span className="text-gray-500 font-normal">({items.length})</span></h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">No teams in this category.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.roster_id} className="flex items-start gap-3">
              {t.avatar ? (
                <img src={t.avatar} alt="avatar" className="h-8 w-8 rounded-full ring-1 ring-black/5"/>
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-200" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{t.name}</div>
                {t.flagged?.length ? (
                  <ul className="mt-1 text-xs text-gray-700 list-disc ml-5">
                    {t.flagged.map((f: any, i: number) => (
                      <li key={i}>
                        {f.name || f.pid}{" "}
                        {f.reason ? <span className="text-gray-500">— {f.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [leagueId, setLeagueId] = useState<string>(DEFAULT_LEAGUE_ID);
  const { state, users, rosters, matchups, players, loading, error } = useSleeper(leagueId);

  const week = state?.display_week || state?.week || state?.leg;
  const byeTeamsThisWeek = useMemo(() => new Set((BYE_MAP_2025[Number(week)] || [])), [week]);

  const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
  const rosterById = useMemo(() => new Map(rosters.map((r) => [r.roster_id, r])), [rosters]);

  const teams = useMemo(() => {
    if (!players) return [] as any[];
    const out: any[] = [];

    for (const m of matchups) {
      const roster = rosterById.get(m.roster_id);
      const owner = userById.get(roster?.owner_id);
      const starters: string[] = (m.starters || []).filter(Boolean);

      let status: "OK" | "POTENTIAL" | "INCOMPLETE" = "OK";
      const flagged: any[] = [];

      for (const pid of starters) {
        // Handle D/ST (team codes) separately for BYE detection
        if (isDSTStarterId(pid)) {
          if (byeTeamsThisWeek.has(pid)) {
            status = "INCOMPLETE";
            flagged.push({ pid, name: `${pid} D/ST`, reason: "BYE" });
            break; // one OUT is enough
          }
          continue;
        }

        const p = players[pid];
        if (!p) continue;

        // Treat BYE as OUT when player's NFL team is on bye this week
        const team = p.team; // e.g., "KC"
        if (team && byeTeamsThisWeek.has(team)) {
          status = "INCOMPLETE";
          flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: "BYE" });
          break;
        }

        const bucket = classifyInjury(p);
        if (bucket === "INCOMPLETE") {
          status = "INCOMPLETE";
          flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: (p.injury_status || p.status || "Out").toString() });
          break;
        } else if (bucket === "POTENTIAL" && status !== "INCOMPLETE") {
          status = "POTENTIAL";
          flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: p.injury_status || "Questionable" });
        }
      }

      out.push({
        roster_id: m.roster_id,
        name: displayTeamName(owner),
        avatar: avatarUrl(owner?.avatar || null, "thumbs"),
        status,
        flagged,
      });
    }

    return out;
  }, [matchups, players, rosterById, userById, byeTeamsThisWeek]);

  const grouped = useMemo(() => {
    const g = { OK: [], POTENTIAL: [], INCOMPLETE: [] } as Record<string, any[]>;
    for (const t of teams) g[t.status].push(t);
    return g;
  }, [teams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sleeper Lineup Completeness Checker</h1>
            <p className="text-sm text-gray-600 mt-1">Week {week ?? "-"} • League: {leagueId}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="px-3 py-2 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
              placeholder="Enter League ID"
              defaultValue={DEFAULT_LEAGUE_ID}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLeagueId((e.target as HTMLInputElement).value.trim());
                }
              }}
            />
            <button
              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-500 active:bg-blue-700"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>("input[placeholder='Enter League ID']");
                if (el?.value) setLeagueId(el.value.trim());
              }}
            >
              Load
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Section title="Complete" items={grouped.OK} tone="OK" />
          <Section title="Potential to be Incomplete" items={grouped.POTENTIAL} tone="POTENTIAL" />
          <Section title="Incomplete" items={grouped.INCOMPLETE} tone="INCOMPLETE" />
        </div>

        <footer className="text-xs text-gray-500 pt-2">
          <p>
            Injury data and rosters via Sleeper public API. Team BYEs for 2025 are hardcoded
            and treated as OUT. Update BYE_MAP_2025 as needed each season.
          </p>
          <p className="mt-1">Tip: Click in the League ID box and press Enter to reload with a different league.</p>
        </footer>

        {loading && (
          <div className="fixed bottom-4 right-4 px-3 py-2 rounded-xl bg-black text-white text-xs shadow-lg animate-pulse">
            Loading…
          </div>
        )}
        {error && (
          <div className="fixed bottom-4 right-4 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs shadow-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

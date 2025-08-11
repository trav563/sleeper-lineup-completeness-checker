import React, { useEffect, useMemo, useState, useCallback } from "react";

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
// Source: User provided 2025 NFL Bye Week schedule
// If a team appears under the current week, its players/DST are treated as OUT.
// Abbreviations should match Sleeper player.team (e.g., "KC", "PHI").
const BYE_MAP_2025 = {
  5: ["PIT", "CHI", "GB", "ATL"],
  6: ["HOU", "MIN"],
  7: ["BAL", "BUF"],
  8: ["JAX", "LV", "DET", "ARI", "SEA", "LAR"],
  9: ["PHI", "CLE", "NYJ", "TB"],
  10: ["KC", "CIN", "TEN", "DAL"],
  11: ["IND", "NO"],
  12: ["MIA", "DEN", "LAC", "WAS"],
  13: [], // No teams on bye in Week 13
  14: ["NYG", "NE", "CAR", "SF"],
};

// Color tokens
const BG = {
  OK: "bg-emerald-600",
  POTENTIAL: "bg-amber-500",
  INCOMPLETE: "bg-rose-600",
};

const LIGHT = {
  OK: "bg-emerald-50 border border-emerald-200",
  POTENTIAL: "bg-amber-50 border border-amber-200",
  INCOMPLETE: "bg-rose-50 border border-rose-200",
};

const DOT = {
  OK: "bg-emerald-600",
  POTENTIAL: "bg-amber-500",
  INCOMPLETE: "bg-rose-600",
};

const TEXT = {
  OK: "text-emerald-600",
  POTENTIAL: "text-amber-500",
  INCOMPLETE: "text-rose-600",
};

// Position display order for lineup
const POSITION_ORDER = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  FLEX: 5,
  K: 6,
  DEF: 7,
};

function avatarUrl(avatarId, size = "thumbs") {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/${size === "thumbs" ? "thumbs/" : ""}${avatarId}`;
}

function displayTeamName(user) {
  return (
    user?.metadata?.team_name || user?.display_name || user?.username || `Team ${user?.user_id}`
  );
}

function isDSTStarterId(pid) {
  return /^[A-Z]{2,4}$/.test(pid); // e.g., "PHI", "KC" as D/ST codes
}

function classifyInjury(player) {
  const inj = String(player?.injury_status || "").toLowerCase();
  const status = String(player?.status || "").toLowerCase();
  // Treat IR/Suspended/PUP as OUT as requested
  if (["out", "ir", "suspended", "pup"].includes(inj) || ["ir", "suspension", "pup"].includes(status))
    return "INCOMPLETE";
  if (["questionable", "doubtful"].includes(inj)) return "POTENTIAL";
  return "OK";
}

function useSleeper(leagueId) {
  const [state, setState] = useState(null);
  const [users, setUsers] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [players, setPlayers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        // Add timestamp to prevent caching
        const timestamp = Date.now();
        const nfl = await fetch(`${API}/state/nfl?_=${timestamp}`).then((r) => r.json());
        if (aborted) return;
        setState(nfl);
        const week = nfl.display_week || nfl.week || nfl.leg;
        const [u, r, m, p] = await Promise.all([
          fetch(`${API}/league/${leagueId}/users?_=${timestamp}`).then((r) => r.json()),
          fetch(`${API}/league/${leagueId}/rosters?_=${timestamp}`).then((r) => r.json()),
          fetch(`${API}/league/${leagueId}/matchups/${week}?_=${timestamp}`).then((r) => r.json()),
          fetch(`${API}/players/nfl?_=${timestamp}`).then((r) => r.json()), // large — cacheable
        ]);
        if (aborted) return;
        setUsers(u);
        setRosters(r);
        setMatchups(Array.isArray(m) ? m : []);
        setPlayers(p);
      } catch (e) {
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

function TeamLineupModal({ team, onClose, matchup, players, byeTeamsThisWeek }) {
  if (!team || !matchup) return null;
  
  const starters = matchup.starters || [];
  const starterDetails = starters.map(pid => {
    // Handle D/ST separately
    if (isDSTStarterId(pid)) {
      const isDST = true;
      const onBye = byeTeamsThisWeek.has(pid);
      return {
        pid,
        name: `${pid} D/ST`,
        position: "DEF",
        status: onBye ? "INCOMPLETE" : "OK",
        reason: onBye ? "BYE" : null,
        isDST
      };
    }
    
    const player = players[pid];
    if (!player) return { pid, name: pid, position: "Unknown", status: "OK" };
    
    const fullName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
    const position = player.position || "Unknown";
    
    // Check for bye week
    const onBye = player.team && byeTeamsThisWeek.has(player.team);
    if (onBye) {
      return {
        pid,
        name: fullName,
        position,
        status: "INCOMPLETE",
        reason: "BYE"
      };
    }
    
    // Check injury status
    const status = classifyInjury(player);
    const reason = player.injury_status || (status === "INCOMPLETE" ? "Out" : null);
    
    return {
      pid,
      name: fullName,
      position,
      status,
      reason
    };
  });
  
  // Sort by position order
  const sortedStarters = [...starterDetails].sort((a, b) => {
    const orderA = POSITION_ORDER[a.position] || 99;
    const orderB = POSITION_ORDER[b.position] || 99;
    return orderA - orderB;
  });
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              {team.avatar ? (
                <img src={team.avatar} alt="avatar" className="h-12 w-12 rounded-full border border-gray-200 shadow-sm"/>
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-200" />
              )}
              <h2 className="text-xl font-bold">{team.name}</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <h3 className="font-semibold text-gray-700 mb-3">Starting Lineup</h3>
          
          <ul className="space-y-2">
            {sortedStarters.map((player) => (
              <li key={player.pid} className="flex items-center p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className="w-10 text-xs font-medium text-gray-500">{player.position}</div>
                <div className="flex-1 font-medium">{player.name}</div>
                <div className={`text-sm font-medium ${TEXT[player.status]}`}>
                  {player.reason === "pup" ? "PUP" : player.reason || (player.status === "OK" ? "Healthy" : "")}
                </div>
              </li>
            ))}
          </ul>
          
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items, tone, onTeamClick }) {
  return (
    <div className={`rounded-2xl p-6 ${LIGHT[tone]} shadow-sm`}> 
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-4 w-4 rounded-full ${DOT[tone]}`} />
        <h3 className="font-semibold text-gray-900">{title} <span className="text-gray-500 font-normal">({items.length})</span></h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">No teams in this category.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((t) => (
            <li key={t.roster_id} className="flex items-start gap-3">
              {t.avatar ? (
                <img src={t.avatar} alt="avatar" className="h-10 w-10 rounded-full border border-gray-200 shadow-sm"/>
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200" />
              )}
              <div className="min-w-0 flex-1">
                <div 
                  className="font-medium text-gray-900 truncate cursor-pointer hover:underline"
                  onClick={() => onTeamClick(t)}
                >
                  {t.name}
                </div>
                {t.flagged?.length ? (
                  <ul className="mt-1 text-xs text-gray-700 space-y-1">
                    {t.flagged.map((f, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-1.5">•</span>
                        <span>
                          {f.name || f.pid}{" "}
                          {f.reason ? <span className="text-gray-500">— {f.reason}</span> : null}
                        </span>
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

function LineupCompletenessChecker() {
  const [leagueId, setLeagueId] = useState(DEFAULT_LEAGUE_ID);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const { state, users, rosters, matchups, players, loading, error } = useSleeper(leagueId);

  const week = state?.display_week || state?.week || state?.leg;
  const seasonType = state?.season_type || "regular";
  const isPreseason = seasonType === "pre";
  
  // Season type detection for preseason vs regular season
  const byeTeamsThisWeek = useMemo(() => new Set((BYE_MAP_2025[Number(week)] || [])), [week]);

  const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
  const rosterById = useMemo(() => new Map(rosters.map((r) => [r.roster_id, r])), [rosters]);

  const teams = useMemo(() => {
    if (!players) return [];
    const out = [];

    for (const m of matchups) {
      const roster = rosterById.get(m.roster_id);
      const owner = userById.get(roster?.owner_id);
      const starters = (m.starters || []).filter(Boolean);

      let status = "OK";
      const flagged = [];

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
        matchup_id: m.matchup_id,
      });
    }

    return out;
  }, [matchups, players, rosterById, userById, byeTeamsThisWeek]);

  const grouped = useMemo(() => {
    const g = { OK: [], POTENTIAL: [], INCOMPLETE: [] };
    for (const t of teams) g[t.status].push(t);
    return g;
  }, [teams]);
  
  // Find the matchup for a specific team
  const getMatchupForTeam = useCallback((team) => {
    if (!team || !matchups) return null;
    return matchups.find(m => m.roster_id === team.roster_id);
  }, [matchups]);
  
  // Handle team click
  const handleTeamClick = useCallback((team) => {
    const matchup = getMatchupForTeam(team);
    setSelectedTeam(team);
    setSelectedMatchup(matchup);
  }, [getMatchupForTeam]);
  
  // Close modal
  const handleCloseModal = useCallback(() => {
    setSelectedTeam(null);
    setSelectedMatchup(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sleeper Lineup Completeness Checker</h1>
            <p className="text-sm text-gray-600 mt-1">
              {isPreseason ? "Preseason " : ""}Week {week ?? "-"} • League: {leagueId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="px-4 py-2 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
              placeholder="Enter League ID"
              defaultValue={DEFAULT_LEAGUE_ID}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLeagueId(e.target.value.trim());
                }
              }}
            />
            <button
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-500 active:bg-blue-700"
              onClick={() => {
                const el = document.querySelector("input[placeholder='Enter League ID']");
                if (el?.value) setLeagueId(el.value.trim());
              }}
            >
              Load
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Section title="Complete" items={grouped.OK} tone="OK" onTeamClick={handleTeamClick} />
          <Section title="Potential to be Incomplete" items={grouped.POTENTIAL} tone="POTENTIAL" onTeamClick={handleTeamClick} />
          <Section title="Incomplete" items={grouped.INCOMPLETE} tone="INCOMPLETE" onTeamClick={handleTeamClick} />
        </div>
        
        {selectedTeam && selectedMatchup && (
          <TeamLineupModal 
            team={selectedTeam} 
            matchup={selectedMatchup} 
            players={players}
            byeTeamsThisWeek={byeTeamsThisWeek}
            onClose={handleCloseModal} 
          />
        )}

        <footer className="text-xs text-gray-500 pt-4 border-t border-gray-100">
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

export default LineupCompletenessChecker;

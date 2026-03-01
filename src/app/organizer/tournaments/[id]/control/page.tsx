'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import type { MatchState, CurrentMatch, SportMode, Profile, AthleteProfile } from '@/types/database';
import { DEFAULT_MATCH_STATE } from '@/types/database';
import { countryCodeToEmoji } from '@/lib/countries';

/* ═══════════════════════════════════════════════════════════════
   Design tokens
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg: '#0B0B0D', bgSurface: '#111114', bgElevated: '#18181C',
  redCorner: '#8B1A1A', redBright: '#B22222',
  blueCorner: '#1A3A6B', blueBright: '#2255A4',
  white: '#FFFFFF', g100: '#E8E8EA', g300: '#A0A0A8',
  g500: '#6B6B75', g700: '#3A3A42', g900: '#1E1E24',
  advantage: '#27AE60', penalty: '#C0392B', neutral: '#555560',
  gold: '#C9A227',
};

const MODES: Record<SportMode, { label: string; points: number[]; negPoints: number[]; hasAdv: boolean; hasPen: boolean; hasKD?: boolean; roundBased?: boolean; winMethods: string[] }> = {
  BJJ:        { label: 'BJJ',        points: [1,2,3,4], negPoints: [1,2], hasAdv: true, hasPen: true, winMethods: ['By Points','By Submission','By Disqualification','By Referee Decision'] },
  Grappling:  { label: 'Grappling',  points: [1,2,3,4], negPoints: [1,2], hasAdv: true, hasPen: true, winMethods: ['By Points','By Submission','By Disqualification','By Referee Decision'] },
  MMA:        { label: 'MMA',        points: [1,2,3],   negPoints: [1],   hasAdv: false,hasPen: true, winMethods: ['By Points','By Submission','By TKO/KO','By Disqualification','By Referee Decision'] },
  Kickboxing: { label: 'Kickboxing', points: [1],       negPoints: [1],   hasAdv: false,hasPen: true, hasKD: true, roundBased: true, winMethods: ['By Decision','By KO/TKO','By Disqualification','By Referee Stoppage'] },
  Muaythai:   { label: 'Muaythai',   points: [1],       negPoints: [1],   hasAdv: false,hasPen: true, hasKD: true, roundBased: true, winMethods: ['By Decision','By KO/TKO','By Disqualification','By Referee Stoppage'] },
  Boxing:     { label: 'Boxing',     points: [1],       negPoints: [1],   hasAdv: false,hasPen: true, hasKD: true, roundBased: true, winMethods: ['By Decision','By KO/TKO','By Disqualification','By Referee Stoppage'] },
  Other:      { label: 'Other',      points: [1,2,3],   negPoints: [1],   hasAdv: false,hasPen: false, winMethods: ['By Points','By Disqualification','By Referee Decision'] },
};

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/* ═══════════════════════════════════════════════════════════════
   Approved athlete type
   ═══════════════════════════════════════════════════════════════ */
type ApprovedAthlete = {
  athlete_id: string;
  registration_id: string;
  first_name: string;
  last_name: string;
  club_name: string | null;
  country_code: string | null;
};

const MATCH_QUERY = '*, red_profile:profiles!current_matches_red_athlete_id_fkey(*, athlete_profiles(*)), blue_profile:profiles!current_matches_blue_athlete_id_fkey(*, athlete_profiles(*))';

/* ═══════════════════════════════════════════════════════════════ */

export default function ControlBoardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ background: '#0B0B0D', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif" }}>Loading...</div>}>
      <ControlBoardPage />
    </Suspense>
  );
}

function ControlBoardPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;
  const matNumber = parseInt(searchParams.get('mat') || '1') || 1;

  /* ── Core state ── */
  const [match, setMatch] = useState<CurrentMatch | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [winModal, setWinModal] = useState<'red' | 'blue' | null>(null);
  const [winMethod, setWinMethod] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fighter selection state ── */
  const [athletes, setAthletes] = useState<ApprovedAthlete[]>([]);
  const [redSearch, setRedSearch] = useState('');
  const [blueSearch, setBlueSearch] = useState('');
  const [redSelected, setRedSelected] = useState<string | null>(null);
  const [blueSelected, setBlueSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tournamentSportMode, setTournamentSportMode] = useState<SportMode>('BJJ');

  /* ── Load initial data ── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?role=organizer'); return; }

      // Load tournament to get sport_mode
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('sport_mode')
        .eq('id', tournamentId)
        .single();
      const sportMode = (tournament?.sport_mode as SportMode) || 'BJJ';
      setTournamentSportMode(sportMode);

      // Load approved athletes for this tournament
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, athlete_id, profiles(first_name, last_name, athlete_profiles(club_name, country_code))')
        .eq('tournament_id', tournamentId)
        .eq('status', 'APPROVED');

      if (regs) {
        setAthletes(regs.map((r: any) => ({
          athlete_id: r.athlete_id,
          registration_id: r.id,
          first_name: r.profiles?.first_name || '',
          last_name: r.profiles?.last_name || '',
          club_name: r.profiles?.athlete_profiles?.club_name || null,
          country_code: r.profiles?.athlete_profiles?.country_code || null,
        })));
      }

      // Load current match (scoped to mat)
      const { data: cm } = await supabase
        .from('current_matches')
        .select(MATCH_QUERY)
        .eq('tournament_id', tournamentId)
        .eq('mat_number', matNumber)
        .single();
      if (cm) setMatch(cm as any);

      // Load match state (scoped to mat)
      const { data: ms } = await supabase
        .from('match_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('mat_number', matNumber)
        .single();
      if (ms) setState(ms as MatchState);

      setLoading(false);
    })();
  }, [tournamentId, matNumber]);

  /* ── Realtime — STRICTLY scoped to tournament_id + mat_number ── */
  useEffect(() => {
    const channelName = `scoreboard:tournament:${tournamentId}:mat:${matNumber}`;
    const myMat = matNumber; // capture in closure

    const chan = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_state', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const rowMat = row.mat_number;
          // HARD GUARD: reject if mat_number missing, null, or different mat
          if (rowMat == null || Number(rowMat) !== myMat) return;
          setState(row as MatchState);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_matches', filter: `tournament_id=eq.${tournamentId}` },
        async (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const rowMat = row.mat_number;
          if (rowMat == null || Number(rowMat) !== myMat) return;
          const { data: cm } = await supabase
            .from('current_matches').select(MATCH_QUERY)
            .eq('tournament_id', tournamentId).eq('mat_number', myMat).single();
          if (cm) setMatch(cm as any);
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [tournamentId, matNumber]);

  /* ── DB helpers (mat-scoped) — declared before useEffects that reference them ── */
  const updateState = useCallback(async (patch: Partial<MatchState>) => {
    await supabase.from('match_state').update(patch).eq('tournament_id', tournamentId).eq('mat_number', matNumber);
  }, [tournamentId, matNumber]);

  const updateMatch = useCallback(async (patch: Partial<CurrentMatch>) => {
    await supabase.from('current_matches').update(patch).eq('tournament_id', tournamentId).eq('mat_number', matNumber);
  }, [tournamentId, matNumber]);

  /* Keep a ref so intervals always call the latest mat-scoped updateState */
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  /* Stable refs for IDs so interval closures never go stale */
  const tournamentIdRef = useRef(tournamentId);
  tournamentIdRef.current = tournamentId;
  const matNumberRef = useRef(matNumber);
  matNumberRef.current = matNumber;

  /* ── Timer tick — direct DB call with explicit WHERE clause ── */
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!state?.timer_running || !state || state.match_seconds <= 0) return;

    const tid = tournamentIdRef.current;
    const mat = matNumberRef.current;

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (!prev || prev.match_seconds <= 1) {
          supabase.from('match_state').update({ match_seconds: 0, timer_running: false })
            .eq('tournament_id', tid).eq('mat_number', mat).then(() => {});
          return prev ? { ...prev, match_seconds: 0, timer_running: false } : prev;
        }
        const next = prev.match_seconds - 1;
        supabase.from('match_state').update({ match_seconds: next })
          .eq('tournament_id', tid).eq('mat_number', mat).then(() => {});
        return { ...prev, match_seconds: next };
      });
    }, 1000);

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [state?.timer_running]);

  /* ── Stalling tick — direct DB call with explicit WHERE clause ── */
  useEffect(() => {
    if (stallRef.current) { clearInterval(stallRef.current); stallRef.current = null; }
    if (!state?.stalling_running) return;

    const side = state.stalling_running;
    const tid = tournamentIdRef.current;
    const mat = matNumberRef.current;
    const field = side === 'red' ? 'red_stalling_seconds' : 'blue_stalling_seconds';

    stallRef.current = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;
        const next = prev[field] + 1;
        supabase.from('match_state').update({ [field]: next })
          .eq('tournament_id', tid).eq('mat_number', mat).then(() => {});
        return { ...prev, [field]: next };
      });
    }, 1000);

    return () => { if (stallRef.current) { clearInterval(stallRef.current); stallRef.current = null; } };
  }, [state?.stalling_running]);

  /* ── CONFIRM FIGHT — creates/resets fight ── */
  const confirmFight = useCallback(async () => {
    if (!redSelected || !blueSelected || redSelected === blueSelected) return;
    setConfirming(true);

    const redAthlete = athletes.find(a => a.athlete_id === redSelected);
    const blueAthlete = athletes.find(a => a.athlete_id === blueSelected);

    // Upsert current_matches (composite PK: tournament_id + mat_number)
    await supabase.from('current_matches').upsert({
      tournament_id: tournamentId,
      mat_number: matNumber,
      red_athlete_id: redSelected,
      blue_athlete_id: blueSelected,
      red_registration_id: redAthlete?.registration_id || null,
      blue_registration_id: blueAthlete?.registration_id || null,
      status: 'confirmed',
      fight_id: crypto.randomUUID(),
    }, { onConflict: 'tournament_id,mat_number' });

    // Upsert match_state (full reset, composite PK) — use tournament sport_mode
    await supabase.from('match_state').upsert({
      tournament_id: tournamentId,
      mat_number: matNumber,
      ...DEFAULT_MATCH_STATE,
      sport_mode: tournamentSportMode,
    }, { onConflict: 'tournament_id,mat_number' });

    // Reload
    const { data: cm } = await supabase.from('current_matches').select(MATCH_QUERY).eq('tournament_id', tournamentId).eq('mat_number', matNumber).single();
    if (cm) setMatch(cm as any);
    const { data: ms } = await supabase.from('match_state').select('*').eq('tournament_id', tournamentId).eq('mat_number', matNumber).single();
    if (ms) setState(ms as MatchState);

    setConfirming(false);
  }, [redSelected, blueSelected, athletes, tournamentId, matNumber, tournamentSportMode]);

  /* ── Control actions (unchanged logic) ── */
  const adj = useCallback((field: keyof MatchState, delta: number) => {
    if (!state) return;
    const val = Math.max(0, (state[field] as number) + delta);
    setState(prev => prev ? { ...prev, [field]: val } : prev);
    updateState({ [field]: val } as any);
  }, [state, updateState]);

  const timerAction = useCallback((action: string) => {
    if (!state) return;
    if (action === 'start') {
      setState(p => p ? { ...p, timer_running: true } : p);
      updateState({ timer_running: true });
      if (match?.status === 'confirmed') updateMatch({ status: 'live' });
    } else if (action === 'pause') {
      setState(p => p ? { ...p, timer_running: false } : p);
      updateState({ timer_running: false });
    } else if (action === 'reset') {
      setState(p => p ? { ...p, timer_running: false, match_seconds: 300 } : p);
      updateState({ timer_running: false, match_seconds: 300 });
    } else if (action === 'plus10') {
      const v = state.match_seconds + 10;
      setState(p => p ? { ...p, match_seconds: v } : p);
      updateState({ match_seconds: v });
    } else if (action === 'minus10') {
      const v = Math.max(0, state.match_seconds - 10);
      setState(p => p ? { ...p, match_seconds: v } : p);
      updateState({ match_seconds: v });
    }
  }, [state, updateState, match, updateMatch]);

  const stallingAction = useCallback((action: string, corner: 'red' | 'blue') => {
    if (!state) return;
    if (action === 'start') {
      setState(p => p ? { ...p, stalling_running: corner } : p);
      updateState({ stalling_running: corner });
    } else if (action === 'stop') {
      setState(p => p ? { ...p, stalling_running: null } : p);
      updateState({ stalling_running: null });
    } else if (action === 'reset') {
      const field = corner === 'red' ? 'red_stalling_seconds' : 'blue_stalling_seconds';
      const patch: any = { [field]: 0 };
      if (state.stalling_running === corner) patch.stalling_running = null;
      setState(p => p ? { ...p, ...patch } : p);
      updateState(patch);
    }
  }, [state, updateState]);

  const confirmWin = useCallback(async () => {
    if (!winModal || !winMethod || !state) return;
    const patch: Partial<MatchState> = {
      winner_side: winModal, win_method: winMethod,
      winner_overlay_visible: true, timer_running: false, stalling_running: null,
    };
    setState(p => p ? { ...p, ...patch } as MatchState : p);
    await updateState(patch);
    await updateMatch({ status: 'finished' });

    // Save to fight history
    await supabase.from('fight_history').insert({
      tournament_id: tournamentId,
      mat_number: matNumber,
      red_athlete_id: match?.red_athlete_id,
      blue_athlete_id: match?.blue_athlete_id,
      red_score: state.red_score, blue_score: state.blue_score,
      red_adv: state.red_adv, blue_adv: state.blue_adv,
      red_pen: state.red_pen, blue_pen: state.blue_pen,
      winner_side: winModal, win_method: winMethod,
      sport_mode: state.sport_mode,
      duration_seconds: 300 - state.match_seconds,
    });

    setWinModal(null);
    setWinMethod(null);
  }, [winModal, winMethod, state, updateState, updateMatch, match, tournamentId]);

  const resetAll = useCallback(async () => {
    const reset = { ...DEFAULT_MATCH_STATE, sport_mode: tournamentSportMode };
    setState(p => p ? { ...p, ...reset } as MatchState : p);
    await updateState(reset as any);
    await updateMatch({ status: 'confirmed' });
  }, [updateState, updateMatch, tournamentSportMode]);

  /* ── Filtered athlete lists ── */
  const filteredRed = useMemo(() => {
    const q = redSearch.toLowerCase().trim();
    return athletes.filter(a => {
      if (a.athlete_id === blueSelected) return false;
      if (!q) return true;
      return `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.club_name || '').toLowerCase().includes(q);
    });
  }, [athletes, redSearch, blueSelected]);

  const filteredBlue = useMemo(() => {
    const q = blueSearch.toLowerCase().trim();
    return athletes.filter(a => {
      if (a.athlete_id === redSelected) return false;
      if (!q) return true;
      return `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.club_name || '').toLowerCase().includes(q);
    });
  }, [athletes, blueSearch, redSelected]);

  /* ── Derived ── */
  const modeConfig = MODES[tournamentSportMode] || MODES[state?.sport_mode || 'BJJ'];
  const fightStatus = match?.status || 'idle';
  const hasFight = match && match.red_athlete_id && match.blue_athlete_id && (fightStatus === 'confirmed' || fightStatus === 'live' || fightStatus === 'finished');
  const redName = match?.red_profile ? `${match.red_profile.first_name} ${match.red_profile.last_name}` : 'Red Corner';
  const blueName = match?.blue_profile ? `${match.blue_profile.first_name} ${match.blue_profile.last_name}` : 'Blue Corner';
  const redClub = (match?.red_profile as any)?.athlete_profiles?.club_name || '';
  const blueClub = (match?.blue_profile as any)?.athlete_profiles?.club_name || '';
  const redCountry = (match?.red_profile as any)?.athlete_profiles?.country_code || '';
  const blueCountry = (match?.blue_profile as any)?.athlete_profiles?.country_code || '';

  if (loading) {
    return <div style={{ background: C.bg, color: C.white, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif" }}>Loading...</div>;
  }

  const s = state;
  const isStalling = (corner: 'red' | 'blue') => s?.stalling_running === corner;

  return (
    <div style={{ width: '100vw', height: '100vh', background: C.bg, color: C.white, fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative', userSelect: 'none' }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ═══ NAV BAR ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', flexShrink: 0, borderBottom: `1px solid ${C.g700}` }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500, fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.g500 }}>
          RRR ARENA — {tournamentSportMode}{matNumber > 1 ? ` — MAT ${matNumber}` : ''}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Fight status indicator */}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '3px 8px', background: fightStatus === 'live' ? C.advantage + '30' : fightStatus === 'confirmed' ? C.gold + '30' : fightStatus === 'finished' ? C.penalty + '30' : C.g700, color: fightStatus === 'live' ? C.advantage : fightStatus === 'confirmed' ? C.gold : fightStatus === 'finished' ? C.penalty : C.g500, border: `1px solid ${fightStatus === 'live' ? C.advantage + '60' : fightStatus === 'confirmed' ? C.gold + '60' : fightStatus === 'finished' ? C.penalty + '60' : C.g700}` }}>
            {fightStatus.toUpperCase()}
          </span>
          <Link href={`/organizer/tournaments/${tournamentId}/registrations`} style={{ color: C.g500, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', border: `1px solid ${C.g700}`, textDecoration: 'none' }}>REGISTRATIONS</Link>
          <a href={`/arena/display/${tournamentId}?mat=${matNumber}`} target="_blank" style={{ color: C.g500, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', border: `1px solid ${C.g700}`, textDecoration: 'none' }}>DISPLAY ↗</a>
        </div>
      </div>

      {/* ═══ FIGHTER SELECTION PANEL ═══ */}
      <div style={{ flexShrink: 0, padding: '10px 16px', borderBottom: `1px solid ${C.g700}`, background: C.bgSurface }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {/* Red selector */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.redBright, marginBottom: 4 }}>RED CORNER</div>
            <input
              type="text" placeholder="Search athlete..." value={redSearch}
              onChange={e => setRedSearch(e.target.value)}
              style={{ width: '100%', background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.white, fontSize: 12, padding: '5px 8px', fontFamily: 'inherit', marginBottom: 3, outline: 'none' }}
            />
            <select
              value={redSelected || ''} onChange={e => setRedSelected(e.target.value || null)}
              style={{ width: '100%', background: C.bgElevated, border: `1px solid ${redSelected ? C.redBright : C.g700}`, color: C.white, fontSize: 12, padding: '5px 6px', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="">Select Red Fighter...</option>
              {filteredRed.map(a => (
                <option key={a.athlete_id} value={a.athlete_id}>
                  {a.country_code ? countryCodeToEmoji(a.country_code) + ' ' : ''}{a.first_name} {a.last_name}{a.club_name ? ` — ${a.club_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* VS divider */}
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: C.g500, paddingBottom: 6 }}>VS</div>

          {/* Blue selector */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.blueBright, marginBottom: 4 }}>BLUE CORNER</div>
            <input
              type="text" placeholder="Search athlete..." value={blueSearch}
              onChange={e => setBlueSearch(e.target.value)}
              style={{ width: '100%', background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.white, fontSize: 12, padding: '5px 8px', fontFamily: 'inherit', marginBottom: 3, outline: 'none' }}
            />
            <select
              value={blueSelected || ''} onChange={e => setBlueSelected(e.target.value || null)}
              style={{ width: '100%', background: C.bgElevated, border: `1px solid ${blueSelected ? C.blueBright : C.g700}`, color: C.white, fontSize: 12, padding: '5px 6px', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="">Select Blue Fighter...</option>
              {filteredBlue.map(a => (
                <option key={a.athlete_id} value={a.athlete_id}>
                  {a.country_code ? countryCodeToEmoji(a.country_code) + ' ' : ''}{a.first_name} {a.last_name}{a.club_name ? ` — ${a.club_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Confirm fight */}
          <button
            onClick={confirmFight}
            disabled={!redSelected || !blueSelected || redSelected === blueSelected || confirming}
            style={{
              background: redSelected && blueSelected && redSelected !== blueSelected ? C.gold : C.g700,
              border: 'none', color: C.white, fontFamily: "'Oswald', sans-serif",
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '8px 18px', cursor: redSelected && blueSelected ? 'pointer' : 'default',
              opacity: redSelected && blueSelected && redSelected !== blueSelected ? 1 : 0.35,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {confirming ? 'CONFIRMING...' : 'CONFIRM FIGHT'}
          </button>
        </div>
      </div>

      {/* ═══ SCOREBOARD PREVIEW ═══ */}
      {hasFight && s ? (
        <>
          <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', padding: '8px 16px 0', minHeight: 0 }}>
            {/* Red */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.redBright }} />
              <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 2vw, 28px)', textTransform: 'uppercase', letterSpacing: '0.07em', color: C.white, marginBottom: 2 }}>{redName}</div>
              {redClub && <div style={{ fontSize: 'clamp(8px, 0.9vw, 12px)', color: C.g500, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>{redClub}</div>}
              <div style={{ background: C.redCorner, width: 'clamp(56px, 7vw, 100px)', height: 'clamp(56px, 7vw, 100px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(30px, 5vw, 64px)', fontWeight: 700 }}>{s.red_score}</span>
              </div>
              {s.show_adv_pen && modeConfig.hasAdv && <div style={{ marginTop: 6, fontSize: 11, color: s.red_adv > 0 ? C.advantage : C.neutral }}><span style={{ color: C.g500, fontSize: 9 }}>ADV </span>{s.red_adv}</div>}
              {s.show_adv_pen && modeConfig.hasPen && <div style={{ fontSize: 11, color: s.red_pen > 0 ? C.penalty : C.neutral }}><span style={{ color: C.g500, fontSize: 9 }}>PEN </span>{s.red_pen}</div>}
            </div>

            {/* Timer */}
            <div style={{ width: 'clamp(100px, 12vw, 180px)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: C.g500, textTransform: 'uppercase', marginBottom: 4 }}>TIME</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(28px, 4.5vw, 60px)', fontWeight: 700, lineHeight: 1, color: C.white }}>{fmt(s.match_seconds)}</div>
            </div>

            {/* Blue */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.blueBright }} />
              <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 2vw, 28px)', textTransform: 'uppercase', letterSpacing: '0.07em', color: C.white, marginBottom: 2 }}>{blueName}</div>
              {blueClub && <div style={{ fontSize: 'clamp(8px, 0.9vw, 12px)', color: C.g500, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>{blueClub}</div>}
              <div style={{ background: C.blueCorner, width: 'clamp(56px, 7vw, 100px)', height: 'clamp(56px, 7vw, 100px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(30px, 5vw, 64px)', fontWeight: 700 }}>{s.blue_score}</span>
              </div>
              {s.show_adv_pen && modeConfig.hasAdv && <div style={{ marginTop: 6, fontSize: 11, color: s.blue_adv > 0 ? C.advantage : C.neutral }}><span style={{ color: C.g500, fontSize: 9 }}>ADV </span>{s.blue_adv}</div>}
              {s.show_adv_pen && modeConfig.hasPen && <div style={{ fontSize: 11, color: s.blue_pen > 0 ? C.penalty : C.neutral }}><span style={{ color: C.g500, fontSize: 9 }}>PEN </span>{s.blue_pen}</div>}
            </div>
          </div>

          {/* ═══ CONTROLS ═══ */}
          <div style={{ flexShrink: 0, padding: '12px 16px 16px', borderTop: `1px solid ${C.g700}`, background: C.bgSurface }}>
            {/* Winner overlay */}
            {s.winner_overlay_visible && (
              <div style={{ textAlign: 'center', marginBottom: 12, padding: '10px 0', background: s.winner_side === 'red' ? C.redCorner + '40' : C.blueCorner + '40', border: `1px solid ${s.winner_side === 'red' ? C.redBright : C.blueBright}` }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: C.white }}>
                  {s.winner_side === 'red' ? redName : blueName} WINS
                </div>
                <div style={{ fontSize: 12, color: C.g300, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.win_method}</div>
                <button onClick={resetAll} style={{ marginTop: 8, background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.g300, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 20px', cursor: 'pointer' }}>
                  RESET FOR NEXT FIGHT
                </button>
              </div>
            )}

            {!s.winner_overlay_visible && (
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Red controls */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: C.g500, textTransform: 'uppercase' }}>RED — POINTS</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {modeConfig.points.map(n => <Btn key={`r+${n}`} label={`+${n}`} onClick={() => adj('red_score', n)} bg={C.redCorner} w={34} />)}
                    {modeConfig.negPoints.map(n => <Btn key={`r-${n}`} label={`−${n}`} onClick={() => adj('red_score', -n)} bg={C.g900} w={34} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {modeConfig.hasAdv && <><Btn label="+A" onClick={() => adj('red_adv', 1)} bg={C.advantage + '35'} w={34} /><Btn label="−A" onClick={() => adj('red_adv', -1)} bg={C.g900} w={34} /></>}
                    {modeConfig.hasPen && <><Btn label="+P" onClick={() => adj('red_pen', 1)} bg={C.penalty + '40'} w={34} /><Btn label="−P" onClick={() => adj('red_pen', -1)} bg={C.g900} w={34} /></>}
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <Btn label={isStalling('red') ? 'STOP' : 'STALL'} onClick={() => stallingAction(isStalling('red') ? 'stop' : 'start', 'red')} bg={isStalling('red') ? C.gold + '30' : C.bgElevated} w={50} />
                    <Btn label="RST" onClick={() => stallingAction('reset', 'red')} bg={C.bgElevated} w={36} />
                  </div>
                  {s.red_stalling_seconds > 0 && <span style={{ fontSize: 10, color: C.gold }}>{fmt(s.red_stalling_seconds)}</span>}
                </div>

                {/* Center controls */}
                <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <Btn label="START" onClick={() => timerAction('start')} bg={C.bgElevated} w={52} />
                    <Btn label="PAUSE" onClick={() => timerAction('pause')} bg={C.bgElevated} w={52} />
                    <Btn label="RESET" onClick={() => timerAction('reset')} bg={C.bgElevated} w={52} />
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <Btn label="−10s" onClick={() => timerAction('minus10')} bg={C.g900} w={46} />
                    <Btn label="+10s" onClick={() => timerAction('plus10')} bg={C.g900} w={46} />
                  </div>
                  <button onClick={() => { const v = !s.show_adv_pen; setState(p => p ? { ...p, show_adv_pen: v } : p); updateState({ show_adv_pen: v }); }} style={{ background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.g300, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 12px', cursor: 'pointer' }}>
                    {s.show_adv_pen ? 'HIDE ADV & PEN' : 'SHOW ADV & PEN'}
                  </button>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                    <button onClick={() => setWinModal('red')} style={{ background: C.redCorner, border: 'none', color: C.white, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 14px', cursor: 'pointer' }}>RED WINS</button>
                    <button onClick={() => setWinModal('blue')} style={{ background: C.blueCorner, border: 'none', color: C.white, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 14px', cursor: 'pointer' }}>BLUE WINS</button>
                  </div>
                  <button onClick={resetAll} style={{ background: 'transparent', border: `1px solid ${C.g700}`, color: C.g500, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 16px', cursor: 'pointer', marginTop: 2 }}>RESET ALL</button>
                </div>

                {/* Blue controls */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: C.g500, textTransform: 'uppercase' }}>BLUE — POINTS</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {modeConfig.points.map(n => <Btn key={`b+${n}`} label={`+${n}`} onClick={() => adj('blue_score', n)} bg={C.blueCorner} w={34} />)}
                    {modeConfig.negPoints.map(n => <Btn key={`b-${n}`} label={`−${n}`} onClick={() => adj('blue_score', -n)} bg={C.g900} w={34} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {modeConfig.hasAdv && <><Btn label="+A" onClick={() => adj('blue_adv', 1)} bg={C.advantage + '35'} w={34} /><Btn label="−A" onClick={() => adj('blue_adv', -1)} bg={C.g900} w={34} /></>}
                    {modeConfig.hasPen && <><Btn label="+P" onClick={() => adj('blue_pen', 1)} bg={C.penalty + '40'} w={34} /><Btn label="−P" onClick={() => adj('blue_pen', -1)} bg={C.g900} w={34} /></>}
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <Btn label={isStalling('blue') ? 'STOP' : 'STALL'} onClick={() => stallingAction(isStalling('blue') ? 'stop' : 'start', 'blue')} bg={isStalling('blue') ? C.gold + '30' : C.bgElevated} w={50} />
                    <Btn label="RST" onClick={() => stallingAction('reset', 'blue')} bg={C.bgElevated} w={36} />
                  </div>
                  {s.blue_stalling_seconds > 0 && <span style={{ fontSize: 10, color: C.gold }}>{fmt(s.blue_stalling_seconds)}</span>}
                </div>
              </div>
            )}
          </div>

          {/* ═══ DISPLAY LABEL EDITOR ═══ */}
          <div style={{ flexShrink: 0, padding: '8px 16px', borderTop: `1px solid ${C.g700}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g500, whiteSpace: 'nowrap' }}>DISPLAY LABEL</div>
            <input
              type="text"
              placeholder={modeConfig.label}
              value={s.display_label_1 || ''}
              onChange={e => {
                const v = e.target.value || null;
                setState(p => p ? { ...p, display_label_1: v } : p);
                updateState({ display_label_1: v } as any);
              }}
              style={{ flex: 1, background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.gold, fontSize: 12, fontWeight: 700, padding: '4px 8px', fontFamily: "'Oswald', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', outline: 'none', maxWidth: 140 }}
            />
            <input
              type="text"
              placeholder="Subtitle (optional)"
              value={s.display_label_2 || ''}
              onChange={e => {
                const v = e.target.value || null;
                setState(p => p ? { ...p, display_label_2: v } : p);
                updateState({ display_label_2: v } as any);
              }}
              style={{ flex: 1, background: C.bgElevated, border: `1px solid ${C.g700}`, color: C.g300, fontSize: 11, fontWeight: 500, padding: '4px 8px', fontFamily: 'inherit', letterSpacing: '0.06em', outline: 'none', maxWidth: 140 }}
            />
          </div>
        </>
      ) : (
        /* ═══ IDLE STATE — no fight confirmed ═══ */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: '0.15em', color: C.g500, textTransform: 'uppercase' }}>
            SELECT FIGHTERS ABOVE
          </div>
          <div style={{ fontSize: 13, color: C.g700, letterSpacing: '0.1em' }}>
            Choose Red and Blue corners, then press CONFIRM FIGHT
          </div>
        </div>
      )}

      {/* ═══ WIN MODAL ═══ */}
      {winModal && s && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: `${C.bg}e8`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.g700}`, width: 'min(380px, 88vw)', padding: '24px 26px' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.g300, marginBottom: 16, textAlign: 'center' }}>
              {winModal === 'red' ? redName : blueName} WINS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              {modeConfig.winMethods.map(m => (
                <button key={m} onClick={() => setWinMethod(m)} style={{
                  background: winMethod === m ? (winModal === 'red' ? C.redCorner : C.blueCorner) : C.bgElevated,
                  border: `1px solid ${winMethod === m ? (winModal === 'red' ? C.redBright : C.blueBright) : C.g700}`,
                  color: winMethod === m ? C.white : C.g300, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 14px', cursor: 'pointer', textAlign: 'left',
                }}>{m}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setWinModal(null); setWinMethod(null); }} style={{ flex: 1, background: C.g900, border: `1px solid ${C.g700}`, color: C.g300, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 0', cursor: 'pointer' }}>CANCEL</button>
              <button onClick={confirmWin} disabled={!winMethod} style={{ flex: 1.5, background: winMethod ? (winModal === 'red' ? C.redBright : C.blueBright) : C.g700, border: 'none', color: C.white, fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 0', cursor: winMethod ? 'pointer' : 'default', opacity: winMethod ? 1 : 0.35 }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ label, onClick, bg, w }: { label: string; onClick: () => void; bg: string; w?: number }) {
  return (
    <button onClick={onClick} style={{
      background: bg, border: `1px solid ${C.g700}`, color: C.white,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '5px 0', width: w || 'auto', minWidth: w || 52, cursor: 'pointer',
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>{label}</button>
  );
}

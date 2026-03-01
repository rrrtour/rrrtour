'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import type { MatchState, CurrentMatch } from '@/types/database';
import { countryCodeToEmoji } from '@/lib/countries';

/* ═══════════════════════════════════════════════════════════════
   Design tokens — RRR ARENA broadcast system
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg: '#0B0B0D', bgSurface: '#111114', bgElevated: '#18181C',
  redCorner: '#8B1A1A', redBright: '#B22222',
  blueCorner: '#1A3A6B', blueBright: '#2255A4',
  white: '#FFFFFF', g100: '#E8E8EA', g300: '#A0A0A8',
  g500: '#6B6B75', g700: '#3A3A42', g900: '#1E1E24',
  advantage: '#27AE60', penalty: '#C0392B', neutral: '#555560',
  gold: '#C9A227', goldDim: '#9E7E1E',
};

const MODES: Record<string, { hasAdv: boolean; hasPen: boolean; hasKD?: boolean; roundBased?: boolean }> = {
  BJJ: { hasAdv: true, hasPen: true }, Grappling: { hasAdv: true, hasPen: true },
  MMA: { hasAdv: false, hasPen: true }, Kickboxing: { hasAdv: false, hasPen: true, hasKD: true, roundBased: true },
  Muaythai: { hasAdv: false, hasPen: true, hasKD: true, roundBased: true }, Boxing: { hasAdv: false, hasPen: true, hasKD: true, roundBased: true },
  Other: { hasAdv: false, hasPen: false },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Oswald:wght@400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{overflow:hidden;height:100%;background:${C.bg};margin:0;padding:0}
  body>nav,body>header,body>footer,body>.navbar{display:none!important}
  body>main{min-height:0!important;padding:0!important;margin:0!important}
  @keyframes overlayFade{from{opacity:0}to{opacity:1}}
  @keyframes contentReveal{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
`;

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const MATCH_QUERY = '*, red_profile:profiles!current_matches_red_athlete_id_fkey(*, athlete_profiles(*)), blue_profile:profiles!current_matches_blue_athlete_id_fkey(*, athlete_profiles(*))';

/* ═══════════════════════════════════════════════════════════════ */

export default function DisplayBoardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0B0B0D', color: '#6B6B75', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif" }}>CONNECTING...</div>}>
      <DisplayBoardPage />
    </Suspense>
  );
}

function DisplayBoardPage() {
  const supabase = createClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;
  const matNumber = parseInt(searchParams.get('mat') || '1') || 1;

  const [match, setMatch] = useState<CurrentMatch | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cm } = await supabase.from('current_matches').select(MATCH_QUERY).eq('tournament_id', tournamentId).eq('mat_number', matNumber).single();
      if (cm) setMatch(cm as any);
      const { data: ms } = await supabase.from('match_state').select('*').eq('tournament_id', tournamentId).eq('mat_number', matNumber).single();
      if (ms) setState(ms as MatchState);
      setLoading(false);
    })();
  }, [tournamentId, matNumber]);

  /* ── Realtime — STRICTLY scoped to tournament_id + mat_number ── */
  useEffect(() => {
    const channelName = `scoreboard:tournament:${tournamentId}:mat:${matNumber}`;
    const myMat = matNumber;

    const chan = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_state', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const rowMat = row.mat_number;
          if (rowMat == null || Number(rowMat) !== myMat) return;
          setState(row as MatchState);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_matches', filter: `tournament_id=eq.${tournamentId}` },
        async (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const rowMat = row.mat_number;
          if (rowMat == null || Number(rowMat) !== myMat) return;
          const { data: cm } = await supabase.from('current_matches').select(MATCH_QUERY).eq('tournament_id', tournamentId).eq('mat_number', myMat).single();
          if (cm) setMatch(cm as any);
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [tournamentId, matNumber]);

  const mc = MODES[state?.sport_mode || 'BJJ'] || MODES.BJJ;
  const redName = match?.red_profile ? `${match.red_profile.first_name} ${match.red_profile.last_name}` : 'Red Corner';
  const blueName = match?.blue_profile ? `${match.blue_profile.first_name} ${match.blue_profile.last_name}` : 'Blue Corner';
  const redClub = (match?.red_profile as any)?.athlete_profiles?.club_name || '';
  const blueClub = (match?.blue_profile as any)?.athlete_profiles?.club_name || '';
  const redCountry = (match?.red_profile as any)?.athlete_profiles?.country_code || '';
  const blueCountry = (match?.blue_profile as any)?.athlete_profiles?.country_code || '';
  const fightReady = match && match.red_athlete_id && match.blue_athlete_id;

  if (loading || !state || !fightReady) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500, fontSize: 'clamp(10px, 1.15vw, 15px)', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.g500, marginBottom: 24 }}>RRR Arena</span>
        <span style={{ color: C.g700, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {loading ? 'CONNECTING...' : 'WAITING FOR FIGHT'}
        </span>
      </div>
    );
  }

  const s = state;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      width: '100vw', height: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      color: C.white, overflow: 'hidden', userSelect: 'none',
    }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', flexDirection: 'column', background: C.bgSurface, overflow: 'hidden', flex: 1 }}>
        <FighterRow name={redName} club={redClub} countryCode={redCountry} score={s.red_score} adv={s.red_adv} pen={s.red_pen} accentColor={C.redBright} scoreBg={C.redCorner} hasAdv={mc.hasAdv} hasPen={mc.hasPen} showAdvPen={s.show_adv_pen} stallingActive={s.stalling_running === 'red'} stallingSec={s.red_stalling_seconds} />
        <div style={{ height: 'clamp(2px, 0.3vh, 4px)', background: C.bg, flexShrink: 0 }} />
        <FighterRow name={blueName} club={blueClub} countryCode={blueCountry} score={s.blue_score} adv={s.blue_adv} pen={s.blue_pen} accentColor={C.blueBright} scoreBg={C.blueCorner} hasAdv={mc.hasAdv} hasPen={mc.hasPen} showAdvPen={s.show_adv_pen} stallingActive={s.stalling_running === 'blue'} stallingSec={s.blue_stalling_seconds} />
        <div style={{ height: 'clamp(2px, 0.3vh, 4px)', background: C.bg, flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', background: C.bgElevated, flexShrink: 0, height: 'clamp(64px, 14vh, 140px)' }}>
          <div style={{ flex: 1, padding: '0 clamp(18px, 2.5vw, 40px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'clamp(2px, 0.4vh, 6px)' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 2vw, 28px)', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold, lineHeight: 1.1 }}>{s.display_label_1 || (mc.roundBased ? `Round ${s.round}` : s.sport_mode)}</div>
            <div style={{ fontWeight: 500, fontSize: 'clamp(11px, 1.3vw, 18px)', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g300, lineHeight: 1.2 }}>{s.display_label_2 || s.sport_mode}</div>
          </div>
          <div style={{ flexShrink: 0, padding: '0 clamp(20px, 3vw, 50px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(48px, 9vw, 130px)', fontWeight: 700, lineHeight: 1, color: C.g300, letterSpacing: '0.03em' }}>{fmt(s.match_seconds)}</span>
          </div>
        </div>
      </div>

      {s.winner_overlay_visible && s.winner_side && (
        <div style={{ position: 'absolute', inset: 0, background: `${C.bg}f2`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'overlayFade 0.3s ease-out' }}>
          <div style={{ textAlign: 'center', animation: 'contentReveal 0.35s ease-out 0.06s both' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(12px, 1.3vw, 18px)', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase', color: s.winner_side === 'red' ? C.redBright : C.blueBright, marginBottom: 'clamp(6px, 1vh, 14px)' }}>{s.winner_side === 'red' ? 'RED WINS' : 'BLUE WINS'}</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(30px, 4.8vw, 62px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.white, lineHeight: 1.1, marginBottom: 'clamp(6px, 0.9vh, 12px)' }}>{s.winner_side === 'red' ? redName : blueName}</div>
            <div style={{ width: 'clamp(36px, 4.5vw, 64px)', height: 3, background: s.winner_side === 'red' ? C.redBright : C.blueBright, margin: '0 auto', marginBottom: 'clamp(8px, 1.4vh, 16px)' }} />
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(12px, 1.4vw, 19px)', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.g300 }}>Wins {s.win_method}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FIGHTER ROW — ADV/PEN VERTICALLY STACKED, Stalling near name
   ═══════════════════════════════════════════════════════════════ */

function FighterRow({ name, club, countryCode, score, adv, pen, accentColor, scoreBg, hasAdv, hasPen, showAdvPen, stallingActive, stallingSec }: {
  name: string; club: string; countryCode: string; score: number; adv: number; pen: number;
  accentColor: string; scoreBg: string; hasAdv: boolean; hasPen: boolean;
  showAdvPen: boolean; stallingActive: boolean; stallingSec: number;
}) {
  const flag = countryCode ? countryCodeToEmoji(countryCode) : '';
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', background: C.bgSurface, minHeight: 0 }}>
      <div style={{ width: 'clamp(4px, 0.4vw, 6px)', background: accentColor, flexShrink: 0 }} />

      {/* Name + Club + Stalling */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(8px, 1vh, 16px) clamp(16px, 2.2vw, 36px)', minWidth: 0, gap: 'clamp(1px, 0.3vh, 4px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.6vw, 12px)' }}>
          {flag && <span style={{ fontSize: 'clamp(18px, 2.8vw, 40px)', lineHeight: 1 }}>{flag}</span>}
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(24px, 4.2vw, 60px)', textTransform: 'uppercase', letterSpacing: '0.04em', color: C.white, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        </div>
        {club && <div style={{ fontWeight: 500, fontSize: 'clamp(10px, 1.15vw, 16px)', textTransform: 'uppercase', letterSpacing: '0.18em', color: C.g500, lineHeight: 1.2 }}>{club}</div>}
        {stallingActive && (
          <div style={{ marginTop: 'clamp(4px, 0.5vh, 8px)', display: 'inline-flex', alignItems: 'center', gap: 'clamp(6px, 0.6vw, 10px)', background: C.gold + '1a', border: `1px solid ${C.gold}44`, borderRadius: 3, alignSelf: 'flex-start', padding: 'clamp(3px, 0.4vh, 6px) clamp(8px, 0.8vw, 14px)' }}>
            <span style={{ fontWeight: 700, fontSize: 'clamp(7px, 0.6vw, 9px)', letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold }}>STALLING</span>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 'clamp(13px, 1.4vw, 20px)', color: stallingSec >= 30 ? C.goldDim : C.gold, lineHeight: 1 }}>{fmt(stallingSec)}</span>
          </div>
        )}
      </div>

      {/* ADV / PEN — VERTICALLY STACKED */}
      {showAdvPen && (hasAdv || hasPen) && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0, gap: 'clamp(6px, 0.8vh, 14px)', padding: '0 clamp(10px, 1.2vw, 20px)', minWidth: 'clamp(50px, 5vw, 80px)' }}>
          {hasAdv && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 'clamp(7px, 0.6vw, 9px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.g500, marginBottom: 'clamp(1px, 0.2vh, 3px)' }}>ADVANTAGE</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(22px, 3vw, 42px)', fontWeight: 700, color: adv > 0 ? C.advantage : C.neutral, lineHeight: 1 }}>{adv}</div>
            </div>
          )}
          {hasPen && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 'clamp(7px, 0.6vw, 9px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.g500, marginBottom: 'clamp(1px, 0.2vh, 3px)' }}>PENALTY</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(22px, 3vw, 42px)', fontWeight: 700, color: pen > 0 ? C.penalty : C.neutral, lineHeight: 1 }}>{pen}</div>
            </div>
          )}
        </div>
      )}

      {/* SCORE */}
      <div style={{ width: 'clamp(80px, 12vw, 180px)', flexShrink: 0, background: scoreBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(52px, 9vw, 130px)', fontWeight: 700, lineHeight: 1, color: C.white }}>{score}</span>
      </div>

      <div style={{ width: 'clamp(3px, 0.3vw, 5px)', background: accentColor, flexShrink: 0 }} />
    </div>
  );
}

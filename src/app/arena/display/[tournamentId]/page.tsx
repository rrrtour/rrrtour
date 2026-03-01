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
  bg: '#0B0B0B', bgSurface: '#111111', bgElevated: '#111111',
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
  html,body{overflow:hidden;height:100%;background:#0B0B0B;margin:0;padding:0}
  /* Hide all website chrome — Navbar, main wrapper, any parent layout */
  body>nav,body>header,body>footer,body>.navbar{display:none!important}
  body>main{min-height:0!important;padding:0!important;margin:0!important}
  @keyframes overlayFade{from{opacity:0}to{opacity:1}}
  @keyframes contentReveal{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
`;

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const MATCH_QUERY = '*, red_profile:profiles!current_matches_red_athlete_id_fkey(*, athlete_profiles(*)), blue_profile:profiles!current_matches_blue_athlete_id_fkey(*, athlete_profiles(*))';

/* ═══════════════════════════════════════════════════════════════ */

export default function ArenaDisplayPageWrapper() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0B0B0B', color: '#6B6B75', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif" }}>CONNECTING...</div>}>
      <ArenaDisplayPage />
    </Suspense>
  );
}

function ArenaDisplayPage() {
  const supabase = createClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.tournamentId as string;
  const matNumber = parseInt(searchParams.get('mat') || '1') || 1;

  const [match, setMatch] = useState<CurrentMatch | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Load initial data (mat-scoped) ── */
  useEffect(() => {
    (async () => {
      const { data: cm } = await supabase
        .from('current_matches')
        .select(MATCH_QUERY)
        .eq('tournament_id', tournamentId)
        .eq('mat_number', matNumber)
        .single();
      if (cm) setMatch(cm as any);

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
          const { data: cm } = await supabase
            .from('current_matches')
            .select(MATCH_QUERY)
            .eq('tournament_id', tournamentId)
            .eq('mat_number', myMat)
            .single();
          if (cm) setMatch(cm as any);
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [tournamentId, matNumber]);

  /* ── Derived ── */
  const mc = MODES[state?.sport_mode || 'BJJ'] || MODES.BJJ;
  const redName = match?.red_profile ? `${match.red_profile.first_name} ${match.red_profile.last_name}` : 'Red Corner';
  const blueName = match?.blue_profile ? `${match.blue_profile.first_name} ${match.blue_profile.last_name}` : 'Blue Corner';
  const redClub = (match?.red_profile as any)?.athlete_profiles?.club_name || '';
  const blueClub = (match?.blue_profile as any)?.athlete_profiles?.club_name || '';
  const redCountry = (match?.red_profile as any)?.athlete_profiles?.country_code || '';
  const blueCountry = (match?.blue_profile as any)?.athlete_profiles?.country_code || '';
  const fightReady = match && match.red_athlete_id && match.blue_athlete_id;

  /* ── Loading / idle states ── */
  if (loading || !state || !fightReady) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500, fontSize: 'clamp(10px, 1.15vw, 15px)', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.g500, marginBottom: 24 }}>
          RRR Arena
        </span>
        <span style={{ color: C.g700, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {loading ? 'CONNECTING...' : 'WAITING FOR FIGHT'}
        </span>
      </div>
    );
  }

  const s = state;
  const redFlag = redCountry ? countryCodeToEmoji(redCountry) : '';
  const blueFlag = blueCountry ? countryCodeToEmoji(blueCountry) : '';

  /*  Smoothcomp reference — pixel-matched proportions
      ─────────────────────────────────────────────────────────────
      Canvas: 16:9, centered in viewport, scales proportionally.
      All sizes use % of a single unit (cw = canvas width) so
      every element keeps its ratio on any screen.

      Vertical:  Row 37% | gap | Row 37% | gap | Bar 26%
      Horizontal per row:
        Flag 11% | Name block flex | ADV/PEN 7% | Score 22%
      Bottom bar:
        Labels left (flex) | Timer right (~35% width)
  */

  /* u = universal unit = 1% of the narrowest canvas dimension.
     On a 1920×1080 display in 16:9 this equals 10.8px.
     Using min(Xvw, X*16/9 vh) keeps everything locked to canvas. */

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      width: '100vw', height: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      color: C.white, overflow: 'hidden', userSelect: 'none',
    }}>
      <style>{CSS}</style>

      {/* 16:9 canvas — scales to fit, letterboxed if needed */}
      <div style={{
        width: '100%', height: '100%',
        maxWidth: 'calc(100vh * 16 / 9)',
        maxHeight: 'calc(100vw * 9 / 16)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* ════════════ ROW 1 — RED FIGHTER (37%) ════════════ */}
        <div style={{ flex: 37, display: 'flex', alignItems: 'stretch', background: '#111111', minHeight: 0 }}>

          {/* FLAG — 11% width */}
          <div style={{ width: '11%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {redFlag && <span style={{ fontSize: 'min(5vw, 8.9vh)', lineHeight: 1 }}>{redFlag}</span>}
          </div>

          {/* NAME + CLUB — flex fill */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 'min(1vw, 1.8vh)', minWidth: 0 }}>
            {/* Fighter name — big bold */}
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontWeight: 700,
              fontSize: 'min(4.8vw, 8.5vh)',
              textTransform: 'uppercase', letterSpacing: '0.02em',
              color: C.white, lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{redName}</div>

            {/* Club line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'min(0.8vw, 1.4vh)', marginTop: 'min(0.2vw, 0.35vh)' }}>
              {redClub && <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 500,
                fontSize: 'min(1.3vw, 2.3vh)', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: C.g500, lineHeight: 1.2,
              }}>{redClub}</span>}
            </div>

            {/* Stalling tile — reference-matched: gold rounded rect, large timer + "STALLING" label */}
            {s.stalling_running === 'red' && (
              <div style={{
                marginTop: 'min(0.6vw, 1.1vh)',
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: C.gold, borderRadius: 'clamp(6px, min(0.6vw, 1vh), 12px)',
                alignSelf: 'flex-start',
                padding: 'clamp(8px, min(1vw, 1.8vh), 24px) clamp(14px, min(2vw, 3.5vh), 48px)',
                border: `2px solid ${C.goldDim}`,
              }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(28px, min(3.2vw, 5.7vh), 80px)', color: '#3A1A00', lineHeight: 1 }}>{fmt(s.red_stalling_seconds)}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(10px, min(1vw, 1.8vh), 24px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#5A2A00', marginTop: 'min(0.2vw, 0.35vh)' }}>STALLING</span>
              </div>
            )}
          </div>

          {/* ADV / PEN — stacked vertically, reference-matched proportions */}
          {s.show_adv_pen && (mc.hasAdv || mc.hasPen) && (
            <div style={{ width: '10%', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'min(0.3vw, 0.5vh)' }}>
              {mc.hasAdv && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(8px, min(0.85vw, 1.5vh), 16px)', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g300, marginBottom: 'min(0.1vw, 0.2vh)' }}>ADVANTAGE</div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, min(5vw, 9vh), 120px)', fontWeight: 700, color: s.red_adv > 0 ? C.advantage : '#9A9AA0', lineHeight: 0.9 }}>{s.red_adv}</div>
                </div>
              )}
              {mc.hasPen && (
                <div style={{ textAlign: 'center', marginTop: 'min(0.5vw, 0.9vh)' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(8px, min(0.85vw, 1.5vh), 16px)', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g300, marginBottom: 'min(0.1vw, 0.2vh)' }}>PENALTY</div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, min(5vw, 9vh), 120px)', fontWeight: 700, color: s.red_pen > 0 ? C.penalty : '#9A9AA0', lineHeight: 0.9 }}>{s.red_pen}</div>
                </div>
              )}
            </div>
          )}

          {/* SCORE BLOCK — 22% width, solid red */}
          <div style={{ width: '22%', flexShrink: 0, background: '#C62828', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(0.5vw, 0.9vh)' }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(80px, 18vh, 320px)', fontWeight: 700, lineHeight: 1, color: C.white }}>{s.red_score}</span>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ height: 'min(0.35vw, 0.6vh)', background: C.bg, flexShrink: 0 }} />

        {/* ════════════ ROW 2 — BLUE FIGHTER (37%) ════════════ */}
        <div style={{ flex: 37, display: 'flex', alignItems: 'stretch', background: '#111111', minHeight: 0 }}>

          <div style={{ width: '11%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {blueFlag && <span style={{ fontSize: 'min(5vw, 8.9vh)', lineHeight: 1 }}>{blueFlag}</span>}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 'min(1vw, 1.8vh)', minWidth: 0 }}>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontWeight: 700,
              fontSize: 'min(4.8vw, 8.5vh)',
              textTransform: 'uppercase', letterSpacing: '0.02em',
              color: C.white, lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{blueName}</div>

            {/* Country code + club on same sub-line (like reference: "USA  BRUCE LEE ACADEMY") */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'min(0.8vw, 1.4vh)', marginTop: 'min(0.2vw, 0.35vh)' }}>
              {blueCountry && <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 'min(1.3vw, 2.3vh)', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#5B8DBF', lineHeight: 1.2,
              }}>{blueCountry}</span>}
              {blueClub && <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 500,
                fontSize: 'min(1.3vw, 2.3vh)', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: C.g500, lineHeight: 1.2,
              }}>{blueClub}</span>}
            </div>

            {s.stalling_running === 'blue' && (
              <div style={{
                marginTop: 'min(0.6vw, 1.1vh)',
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: C.gold, borderRadius: 'clamp(6px, min(0.6vw, 1vh), 12px)',
                alignSelf: 'flex-start',
                padding: 'clamp(8px, min(1vw, 1.8vh), 24px) clamp(14px, min(2vw, 3.5vh), 48px)',
                border: `2px solid ${C.goldDim}`,
              }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(28px, min(3.2vw, 5.7vh), 80px)', color: '#3A1A00', lineHeight: 1 }}>{fmt(s.blue_stalling_seconds)}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(10px, min(1vw, 1.8vh), 24px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#5A2A00', marginTop: 'min(0.2vw, 0.35vh)' }}>STALLING</span>
              </div>
            )}
          </div>

          {s.show_adv_pen && (mc.hasAdv || mc.hasPen) && (
            <div style={{ width: '10%', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'min(0.3vw, 0.5vh)' }}>
              {mc.hasAdv && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(8px, min(0.85vw, 1.5vh), 16px)', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g300, marginBottom: 'min(0.1vw, 0.2vh)' }}>ADVANTAGE</div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, min(5vw, 9vh), 120px)', fontWeight: 700, color: s.blue_adv > 0 ? C.advantage : '#9A9AA0', lineHeight: 0.9 }}>{s.blue_adv}</div>
                </div>
              )}
              {mc.hasPen && (
                <div style={{ textAlign: 'center', marginTop: 'min(0.5vw, 0.9vh)' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(8px, min(0.85vw, 1.5vh), 16px)', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.g300, marginBottom: 'min(0.1vw, 0.2vh)' }}>PENALTY</div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, min(5vw, 9vh), 120px)', fontWeight: 700, color: s.blue_pen > 0 ? C.penalty : '#9A9AA0', lineHeight: 0.9 }}>{s.blue_pen}</div>
                </div>
              )}
            </div>
          )}

          <div style={{ width: '22%', flexShrink: 0, background: '#1565C0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(0.5vw, 0.9vh)' }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(80px, 18vh, 320px)', fontWeight: 700, lineHeight: 1, color: C.white }}>{s.blue_score}</span>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ height: 'min(0.35vw, 0.6vh)', background: C.bg, flexShrink: 0 }} />

        {/* ═══ RRR LOGO — absolute bottom center ═══ */}
        <div style={{
          position: 'absolute',
          left: '50%', bottom: 'clamp(10px, 1.2vh, 20px)',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <img
            src="/rrr-logo.svg"
            alt="RRR Arena"
            style={{
              width: 'clamp(100px, 12vw, 180px)',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>

        {/* ════════════ BOTTOM BAR (26%) ════════════ */}
        <div style={{ flex: 26, display: 'flex', alignItems: 'stretch', background: '#111111', minHeight: 0 }}>

          {/* Left: Division / Label */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 min(3vw, 5.3vh)', minWidth: 0 }}>
            {/* Line 1: big yellow title + optional smaller inline text */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'min(1vw, 1.8vh)', flexWrap: 'nowrap' }}>
              <span style={{
                fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                fontSize: 'min(3vw, 5.3vh)', letterSpacing: '0.04em',
                textTransform: 'uppercase', color: C.gold, lineHeight: 1.15,
                textDecoration: 'underline', textDecorationColor: C.gold + '60',
                textUnderlineOffset: 'min(0.3vw, 0.5vh)', textDecorationThickness: 'min(0.15vw, 0.27vh)',
              }}>
                {s.display_label_1 || (mc.roundBased ? `Round ${s.round}` : s.sport_mode)}
              </span>
            </div>
            {/* Line 2: secondary info */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: 'min(1.8vw, 3.2vh)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: C.g300, lineHeight: 1.25,
              marginTop: 'min(0.15vw, 0.27vh)',
            }}>
              {s.display_label_2 || s.sport_mode}
            </div>
          </div>

          {/* Right: TIMER */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 'min(3vw, 5.3vh)', paddingLeft: 'min(1vw, 1.8vh)' }}>
            <span style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 'min(9vw, 16vh)', fontWeight: 700,
              lineHeight: 1, letterSpacing: '0.01em',
              color: s.match_seconds <= 30 && s.timer_running ? C.penalty : '#FFFFFF',
            }}>{fmt(s.match_seconds)}</span>
          </div>
        </div>
      </div>

      {/* ═══ WINNER OVERLAY ═══ */}
      {s.winner_overlay_visible && s.winner_side && (
        <div style={{
          position: 'absolute', inset: 0, background: `${C.bg}f2`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, animation: 'overlayFade 0.3s ease-out',
        }}>
          <div style={{ textAlign: 'center', animation: 'contentReveal 0.35s ease-out 0.06s both' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'min(1.4vw, 2.5vh)', fontWeight: 700,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: s.winner_side === 'red' ? '#C62828' : '#1565C0',
              marginBottom: 'min(0.8vw, 1.4vh)',
            }}>
              {s.winner_side === 'red' ? 'RED WINS' : 'BLUE WINS'}
            </div>
            <div style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 'min(5vw, 9vh)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              color: C.white, lineHeight: 1.1, marginBottom: 'min(0.6vw, 1vh)',
            }}>
              {s.winner_side === 'red' ? redName : blueName}
            </div>
            <div style={{
              width: 'min(4.5vw, 8vh)', height: 3,
              background: s.winner_side === 'red' ? '#C62828' : '#1565C0',
              margin: '0 auto', marginBottom: 'min(1vw, 1.8vh)',
            }} />
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'min(1.4vw, 2.5vh)', fontWeight: 500,
              letterSpacing: '0.2em', textTransform: 'uppercase', color: C.g300,
            }}>
              Wins {s.win_method}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

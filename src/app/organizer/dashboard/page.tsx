'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { TournamentStatusBadge } from '@/components/ui/StatusBadges';
import CopyLinkButton from '@/components/ui/CopyLinkButton';
import type { Profile, Tournament, TournamentStatus } from '@/types/database';

export default function OrganizerDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tournaments, setTournaments] = useState<(Tournament & { pending_count: number; approved_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TournamentStatus>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?role=organizer'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!prof || prof.role !== 'organizer') { router.push('/'); return; }
    setProfile(prof);

    const { data: tourns } = await supabase
      .from('tournaments')
      .select('*')
      .eq('organizer_id', user.id)
      .order('created_at', { ascending: false });

    if (tourns) {
      const withCounts = await Promise.all(
        tourns.map(async (t) => {
          const { count: pendingCount } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', t.id)
            .eq('status', 'PENDING');
          const { count: approvedCount } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', t.id)
            .eq('status', 'APPROVED');
          return { ...t, pending_count: pendingCount || 0, approved_count: approvedCount || 0 };
        })
      );
      setTournaments(withCounts);
    }
    setLoading(false);
  }

  const changeStatus = async (id: string, newStatus: TournamentStatus) => {
    setActionLoading(id);
    const { error } = await supabase.from('tournaments').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setTournaments(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    }
    setActionLoading(null);
  };

  const filtered = statusFilter === 'ALL'
    ? tournaments
    : tournaments.filter(t => t.status === statusFilter);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-surface-700 rounded" />
          <div className="grid gap-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface-700 rounded-xl" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">Organizer Dashboard</h1>
          <p className="text-text-secondary mt-1">Welcome back, {profile?.first_name}</p>
        </div>
        <Link href="/organizer/tournaments/create" className="btn-primary text-sm w-fit">+ Create Tournament</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-text-muted text-sm">Total</p>
          <p className="font-display font-bold text-3xl mt-1">{tournaments.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-muted text-sm">Pending</p>
          <p className="font-display font-bold text-3xl mt-1 text-yellow-400">{tournaments.reduce((s, t) => s + t.pending_count, 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-muted text-sm">Approved</p>
          <p className="font-display font-bold text-3xl mt-1 text-green-400">{tournaments.reduce((s, t) => s + t.approved_count, 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-muted text-sm">Live</p>
          <p className="font-display font-bold text-3xl mt-1 text-red-400">{tournaments.filter(t => t.status === 'LIVE').length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {(['ALL', 'DRAFT', 'OPEN', 'LIVE', 'ARCHIVED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === f ? 'bg-brand-red text-white' : 'bg-surface-700 text-text-muted hover:text-text-primary'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Tournaments list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-muted">No tournaments found.</p>
          <Link href="/organizer/tournaments/create" className="text-brand-red hover:text-brand-red-light text-sm font-medium mt-2 inline-block">Create your first tournament →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => {
            const date = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const isLive = t.status === 'LIVE';
            const isArchived = t.status === 'ARCHIVED';

            return (
              <div key={t.id} className="card p-5 hover:border-surface-500 transition-colors">
                <div className="flex flex-col gap-4">
                  {/* Top row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-lg truncate">{t.name}</h3>
                        <TournamentStatusBadge status={t.status} />
                        <span className={t.registration_type === 'FREE' ? 'badge-free' : 'badge-paid'}>{t.registration_type}</span>
                        {t.is_private && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">Private</span>
                        )}
                      </div>
                      <p className="text-text-muted text-sm">{date} · {t.location_text}</p>
                    </div>

                    <div className="flex items-center gap-3 text-sm shrink-0">
                      <span className="text-yellow-400 font-medium">{t.pending_count} pending</span>
                      <span className="text-surface-500">|</span>
                      <span className="text-green-400 font-medium">{t.approved_count} approved</span>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status transitions */}
                    {t.status === 'DRAFT' && (
                      <button
                        onClick={() => changeStatus(t.id, 'OPEN')}
                        disabled={actionLoading === t.id}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Open Registration
                      </button>
                    )}
                    {t.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => changeStatus(t.id, 'DRAFT')}
                          disabled={actionLoading === t.id}
                          className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Back to Draft
                        </button>
                        <button
                          onClick={() => changeStatus(t.id, 'LIVE')}
                          disabled={actionLoading === t.id}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Close Registration &amp; Go Live
                        </button>
                      </>
                    )}
                    {t.status === 'LIVE' && (
                      <button
                        onClick={() => changeStatus(t.id, 'ARCHIVED')}
                        disabled={actionLoading === t.id}
                        className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Archive Tournament
                      </button>
                    )}
                    {t.status === 'ARCHIVED' && (
                      <button
                        onClick={() => changeStatus(t.id, 'DRAFT')}
                        disabled={actionLoading === t.id}
                        className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reactivate to Draft
                      </button>
                    )}

                    <div className="flex-1" />

                    {/* Edit (disabled when LIVE) */}
                    {!isLive && !isArchived && (
                      <Link
                        href={`/organizer/tournaments/${t.id}/edit`}
                        className="btn-ghost text-xs !px-3 !py-1.5"
                      >
                        Edit
                      </Link>
                    )}
                    {isLive && (
                      <span className="text-text-muted text-xs italic">Editing locked while live</span>
                    )}

                    <CopyLinkButton tournamentId={t.id} />

                    {/* Control Board links — respect control_board_enabled */}
                    {t.control_board_enabled !== false && (t.status === 'OPEN' || t.status === 'LIVE') && (
                      <>
                        {(t.mats_count || 1) === 1 ? (
                          <>
                            <Link
                              href={`/organizer/tournaments/${t.id}/control?mat=1`}
                              className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Control Board
                            </Link>
                            <a
                              href={`/arena/display/${t.id}?mat=1`}
                              target="_blank"
                              className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Display ↗
                            </a>
                          </>
                        ) : (
                          Array.from({ length: t.mats_count || 1 }, (_, i) => i + 1).map(mat => (
                            <div key={mat} className="flex gap-1">
                              <Link
                                href={`/organizer/tournaments/${t.id}/control?mat=${mat}`}
                                className="bg-surface-600 hover:bg-surface-500 text-text-secondary text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
                              >
                                Mat {mat}
                              </Link>
                              <a
                                href={`/arena/display/${t.id}?mat=${mat}`}
                                target="_blank"
                                className="bg-surface-700 hover:bg-surface-500 text-text-muted text-[10px] font-semibold px-1.5 py-1 rounded-lg transition-colors"
                              >
                                ↗
                              </a>
                            </div>
                          ))
                        )}
                      </>
                    )}

                    <Link
                      href={`/organizer/tournaments/${t.id}/registrations`}
                      className="btn-secondary text-sm !px-4 !py-2"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

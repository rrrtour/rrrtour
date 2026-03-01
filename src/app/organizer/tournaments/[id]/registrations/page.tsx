'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { calculateAge } from '@/lib/utils';
import BeltBadge from '@/components/ui/BeltBadge';
import { TournamentStatusBadge } from '@/components/ui/StatusBadges';
import CopyLinkButton from '@/components/ui/CopyLinkButton';
import type {
  Tournament,
  Registration,
  RegistrationStatus,
  Profile,
  AthleteProfile,
} from '@/types/database';
import { DEFAULT_MATCH_STATE } from '@/types/database';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

/** Shape returned by the nested Supabase join:
 *  registrations → profiles(*, athlete_profiles(*))
 *  athlete_profiles is nested INSIDE profiles, not at the top level. */
type RegistrationRow = Omit<Registration, 'profiles' | 'athlete_profiles'> & {
  profiles: Profile & {
    athlete_profiles: AthleteProfile | null;
  };
};

type FilterKey = 'ALL' | RegistrationStatus;

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

/* ═══════════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════════ */

export default function ManageRegistrationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  /* ── core state ── */
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── filters & search ── */
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');

  /* ── selection ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ── action state ── */
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noteModal, setNoteModal] = useState<{
    regIds: string[];
    isBulk: boolean;
  } | null>(null);
  const [note, setNote] = useState('');

  /* ── confirm dialog ── */
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'green' | 'red' | 'yellow';
  } | null>(null);

  /* ── send to board ── */
  const [boardRed, setBoardRed] = useState<string | null>(null);
  const [boardBlue, setBoardBlue] = useState<string | null>(null);
  const [sendingToBoard, setSendingToBoard] = useState(false);

  const approvedAthletes = useMemo(
    () => registrations.filter((r) => r.status === 'APPROVED'),
    [registrations],
  );

  const handleSendToBoard = async () => {
    if (!boardRed || !boardBlue || boardRed === boardBlue) return;
    setSendingToBoard(true);

    const redReg = registrations.find((r) => r.profiles?.id === boardRed);
    const blueReg = registrations.find((r) => r.profiles?.id === boardBlue);

    // Upsert current_matches
    const { error: matchErr } = await supabase
      .from('current_matches')
      .upsert({
        tournament_id: tournamentId,
        red_athlete_id: boardRed,
        blue_athlete_id: boardBlue,
        red_registration_id: redReg?.id || null,
        blue_registration_id: blueReg?.id || null,
        status: 'READY',
      }, { onConflict: 'tournament_id' });

    if (matchErr) {
      showToast('error', `Failed to set match: ${matchErr.message}`);
      setSendingToBoard(false);
      return;
    }

    // Upsert match_state (reset all scores)
    const { error: stateErr } = await supabase
      .from('match_state')
      .upsert({
        tournament_id: tournamentId,
        ...DEFAULT_MATCH_STATE,
      }, { onConflict: 'tournament_id' });

    if (stateErr) {
      showToast('error', `Failed to reset match state: ${stateErr.message}`);
      setSendingToBoard(false);
      return;
    }

    showToast('success', 'Athletes sent to board! Open Control Board to start.');
    setBoardRed(null);
    setBoardBlue(null);
    setSendingToBoard(false);
  };

  /* ── toasts ── */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /* ── data loading ── */
  useEffect(() => {
    loadData();
  }, [tournamentId]);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login?role=organizer');
      return;
    }

    const { data: t } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .eq('organizer_id', user.id)
      .single();

    if (!t) {
      router.push('/organizer/dashboard');
      return;
    }
    setTournament(t);

    /* ── KEY FIX: nested join through profiles ── */
    const { data: regs } = await supabase
      .from('registrations')
      .select('*, profiles(*, athlete_profiles(*))')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    setRegistrations((regs as RegistrationRow[]) || []);
    setLoading(false);
  }

  /* ── computed / derived ── */
  const counts = useMemo(
    () => ({
      all: registrations.length,
      pending: registrations.filter((r) => r.status === 'PENDING').length,
      approved: registrations.filter((r) => r.status === 'APPROVED').length,
      rejected: registrations.filter((r) => r.status === 'REJECTED').length,
    }),
    [registrations],
  );

  const filtered = useMemo(() => {
    let list =
      filter === 'ALL'
        ? registrations
        : registrations.filter((r) => r.status === filter);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => {
        const p = r.profiles;
        const fullName = `${p?.first_name || ''} ${p?.last_name || ''}`.toLowerCase();
        const phone = (p?.phone || '').toLowerCase();
        return fullName.includes(q) || phone.includes(q);
      });
    }

    return list;
  }, [registrations, filter, search]);

  /* Clear selection when filter / search changes */
  useEffect(() => {
    setSelected(new Set());
  }, [filter, search]);

  /* ── selection helpers ── */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  const selectedPendingIds = useMemo(
    () =>
      Array.from(selected).filter((id) => {
        const r = registrations.find((reg) => reg.id === id);
        return r?.status === 'PENDING';
      }),
    [selected, registrations],
  );

  /* ── single action ── */
  const handleSingleAction = async (
    regId: string,
    status: RegistrationStatus,
    rejectionNote?: string,
  ) => {
    setActionLoading(regId);

    const updateData: Record<string, string> = { status };
    if (status === 'REJECTED' && rejectionNote) {
      updateData.rejection_note = rejectionNote;
    }
    if (status === 'APPROVED') {
      updateData.rejection_note = '';
    }

    const { error } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', regId);

    if (error) {
      showToast('error', 'Failed to update registration.');
    } else {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === regId
            ? ({
                ...r,
                status,
                rejection_note: rejectionNote || null,
              } as RegistrationRow)
            : r,
        ),
      );
      showToast(
        'success',
        `Registration ${status === 'APPROVED' ? 'approved' : 'rejected'}.`,
      );
    }

    setActionLoading(null);
    setNoteModal(null);
    setNote('');
  };

  /* ── bulk action ── */
  const handleBulkAction = async (
    ids: string[],
    status: RegistrationStatus,
    rejectionNote?: string,
  ) => {
    if (ids.length === 0) return;
    setBulkLoading(true);

    const updateData: Record<string, string> = { status };
    if (status === 'REJECTED' && rejectionNote) {
      updateData.rejection_note = rejectionNote;
    }
    if (status === 'APPROVED') {
      updateData.rejection_note = '';
    }

    const { error } = await supabase
      .from('registrations')
      .update(updateData)
      .in('id', ids);

    if (error) {
      showToast('error', `Bulk update failed: ${error.message}`);
    } else {
      setRegistrations((prev) =>
        prev.map((r) =>
          ids.includes(r.id)
            ? ({
                ...r,
                status,
                rejection_note:
                  status === 'REJECTED' ? rejectionNote || null : null,
              } as RegistrationRow)
            : r,
        ),
      );
      setSelected(new Set());
      showToast('success', `${ids.length} registration(s) ${status.toLowerCase()}.`);
    }

    setBulkLoading(false);
    setNoteModal(null);
    setNote('');
    setConfirmDialog(null);
  };

  /* ── approve all pending ── */
  const handleApproveAllPending = () => {
    const pendingIds = registrations
      .filter((r) => r.status === 'PENDING')
      .map((r) => r.id);

    if (pendingIds.length === 0) {
      showToast('error', 'No pending registrations to approve.');
      return;
    }

    setConfirmDialog({
      title: 'Approve All Pending',
      message: `Are you sure you want to approve all ${pendingIds.length} pending registration(s)?`,
      variant: 'green',
      onConfirm: () => handleBulkAction(pendingIds, 'APPROVED'),
    });
  };

  /* ── bulk approve selected ── */
  const handleBulkApproveSelected = () => {
    if (selectedPendingIds.length === 0) {
      showToast('error', 'No pending registrations selected.');
      return;
    }
    setConfirmDialog({
      title: 'Approve Selected',
      message: `Approve ${selectedPendingIds.length} selected pending registration(s)?`,
      variant: 'green',
      onConfirm: () => handleBulkAction(selectedPendingIds, 'APPROVED'),
    });
  };

  /* ── bulk reject selected ── */
  const handleBulkRejectSelected = () => {
    if (selectedPendingIds.length === 0) {
      showToast('error', 'No pending registrations selected.');
      return;
    }
    setNoteModal({ regIds: selectedPendingIds, isBulk: true });
  };

  /* ── screenshot viewer ── */
  const viewScreenshot = async (path: string) => {
    const { data } = await supabase.storage
      .from('payment-screenshots')
      .createSignedUrl(path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-surface-700 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-surface-700 rounded-xl" />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 bg-surface-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <Link
        href="/organizer/dashboard"
        className="text-text-muted hover:text-text-secondary text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">
            {tournament?.name}
          </h1>
          <p className="text-text-secondary mt-1">Manage registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <TournamentStatusBadge status={tournament?.status || 'DRAFT'} />
          <span
            className={
              tournament?.registration_type === 'FREE'
                ? 'badge-free'
                : 'badge-paid'
            }
          >
            {tournament?.registration_type}
          </span>
          <CopyLinkButton tournamentId={tournamentId} />
          <Link
            href={`/organizer/tournaments/${tournamentId}/control`}
            className="bg-surface-600 hover:bg-surface-500 text-text-primary text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-surface-500 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Control Board
          </Link>
        </div>
      </div>

      {/* ── Send to Board ── */}
      {approvedAthletes.length >= 2 && (tournament?.status === 'LIVE' || tournament?.status === 'OPEN') && (
        <div className="card p-5 mb-6">
          <h3 className="font-display font-semibold text-sm text-text-secondary uppercase tracking-wider mb-3">
            Send to Scoreboard
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="label text-xs">Red Corner</label>
              <select
                value={boardRed || ''}
                onChange={(e) => setBoardRed(e.target.value || null)}
                className="input-field !py-2.5 text-sm"
              >
                <option value="">Select athlete...</option>
                {approvedAthletes.map((r) => (
                  <option key={r.id} value={r.profiles?.id} disabled={r.profiles?.id === boardBlue}>
                    {r.profiles?.first_name} {r.profiles?.last_name}
                    {r.profiles?.athlete_profiles?.club_name ? ` (${r.profiles.athlete_profiles.club_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-text-muted font-bold text-lg px-2 hidden sm:block">VS</span>
            <div className="flex-1 w-full">
              <label className="label text-xs">Blue Corner</label>
              <select
                value={boardBlue || ''}
                onChange={(e) => setBoardBlue(e.target.value || null)}
                className="input-field !py-2.5 text-sm"
              >
                <option value="">Select athlete...</option>
                {approvedAthletes.map((r) => (
                  <option key={r.id} value={r.profiles?.id} disabled={r.profiles?.id === boardRed}>
                    {r.profiles?.first_name} {r.profiles?.last_name}
                    {r.profiles?.athlete_profiles?.club_name ? ` (${r.profiles.athlete_profiles.club_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSendToBoard}
              disabled={!boardRed || !boardBlue || boardRed === boardBlue || sendingToBoard}
              className="btn-primary !py-2.5 text-sm whitespace-nowrap disabled:opacity-40"
            >
              {sendingToBoard ? 'Sending...' : 'Send to Board'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(
          [
            { label: 'Total', count: counts.all, key: 'ALL' as FilterKey, color: 'text-text-primary' },
            { label: 'Pending', count: counts.pending, key: 'PENDING' as FilterKey, color: 'text-yellow-400' },
            { label: 'Approved', count: counts.approved, key: 'APPROVED' as FilterKey, color: 'text-green-400' },
            { label: 'Rejected', count: counts.rejected, key: 'REJECTED' as FilterKey, color: 'text-red-400' },
          ] as const
        ).map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`card p-4 text-left transition-all duration-200 ${
              filter === s.key
                ? 'border-brand-red shadow-lg shadow-brand-red/5'
                : 'hover:border-surface-500'
            }`}
          >
            <p className="text-text-muted text-xs uppercase tracking-wider font-medium">
              {s.label}
            </p>
            <p className={`font-display font-bold text-3xl mt-1 ${s.color}`}>
              {s.count}
            </p>
          </button>
        ))}
      </div>

      {/* ── Search + bulk actions toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-field !pl-10 !py-2.5 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {counts.pending > 0 && (
            <button
              onClick={handleApproveAllPending}
              disabled={bulkLoading}
              className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Approve All Pending ({counts.pending})
            </button>
          )}

          {selected.size > 0 && selectedPendingIds.length > 0 && (
            <>
              <button
                onClick={handleBulkApproveSelected}
                disabled={bulkLoading}
                className="bg-green-700/80 hover:bg-green-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Approve Selected ({selectedPendingIds.length})
              </button>
              <button
                onClick={handleBulkRejectSelected}
                disabled={bulkLoading}
                className="bg-red-700/80 hover:bg-red-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject Selected ({selectedPendingIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Select all checkbox (when results exist) ── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            checked={selected.size === filtered.length && filtered.length > 0}
            indeterminate={selected.size > 0 && selected.size < filtered.length}
            onChange={toggleSelectAll}
          />
          <span className="text-text-muted text-xs font-medium">
            {selected.size > 0
              ? `${selected.size} of ${filtered.length} selected`
              : `Select all (${filtered.length})`}
          </span>
        </div>
      )}

      {/* ── Registration cards ── */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-text-muted text-lg">
            {search
              ? 'No registrations match your search.'
              : `No ${filter !== 'ALL' ? filter.toLowerCase() : ''} registrations yet.`}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-brand-red hover:text-brand-red-light text-sm font-medium mt-2"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((reg) => (
            <AthleteRegistrationCard
              key={reg.id}
              registration={reg}
              isSelected={selected.has(reg.id)}
              onToggleSelect={() => toggleSelect(reg.id)}
              actionLoading={actionLoading}
              onApprove={(id) => handleSingleAction(id, 'APPROVED')}
              onReject={(id) =>
                setNoteModal({ regIds: [id], isBulk: false })
              }
              onViewScreenshot={viewScreenshot}
            />
          ))}
        </div>
      )}

      {/* ── Rejection note modal ── */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display font-semibold text-lg mb-1">
              Reject {noteModal.isBulk ? `${noteModal.regIds.length} Registration(s)` : 'Registration'}
            </h3>
            <p className="text-text-muted text-sm mb-5">
              Provide an optional note for the athlete{noteModal.isBulk ? '(s)' : ''}.
            </p>
            <div>
              <label className="label">
                Rejection Note{' '}
                <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field min-h-[100px] resize-y"
                placeholder="Reason for rejection..."
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setNoteModal(null);
                  setNote('');
                }}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (noteModal.isBulk) {
                    handleBulkAction(noteModal.regIds, 'REJECTED', note || undefined);
                  } else {
                    handleSingleAction(noteModal.regIds[0], 'REJECTED', note || undefined);
                  }
                }}
                disabled={bulkLoading || actionLoading !== null}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex-1 text-sm disabled:opacity-50"
              >
                {bulkLoading ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display font-semibold text-lg mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                disabled={bulkLoading}
                className={`flex-1 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm disabled:opacity-50 ${
                  confirmDialog.variant === 'green'
                    ? 'bg-green-600 hover:bg-green-500'
                    : confirmDialog.variant === 'red'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-yellow-600 hover:bg-yellow-500'
                }`}
              >
                {bulkLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Athlete Registration Card
   ═══════════════════════════════════════════════════════════════ */

interface AthleteCardProps {
  registration: RegistrationRow;
  isSelected: boolean;
  onToggleSelect: () => void;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewScreenshot: (path: string) => void;
}

function AthleteRegistrationCard({
  registration: reg,
  isSelected,
  onToggleSelect,
  actionLoading,
  onApprove,
  onReject,
  onViewScreenshot,
}: AthleteCardProps) {
  /* ── DATA FIX: athlete_profiles is NESTED inside profiles ── */
  const p = reg.profiles;
  const a = p?.athlete_profiles ?? null;

  const fullName = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';
  const initials = `${p?.first_name?.[0] || ''}${p?.last_name?.[0] || ''}`;
  const age = calculateAge(a?.date_of_birth);
  const phone = p?.phone || '—';
  const weight = a?.weight_kg != null ? `${a.weight_kg} kg` : '—';
  const beltRank = a?.belt_rank ?? null;
  const clubName = a?.club_name ?? null;

  return (
    <div
      className={`card flex flex-col transition-all duration-200 ${
        isSelected ? 'border-brand-red ring-1 ring-brand-red/30' : ''
      }`}
    >
      {/* Card header: checkbox + status + receipt */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Checkbox checked={isSelected} onChange={onToggleSelect} />
          <StatusBadge status={reg.status} />
        </div>
        {reg.payment_screenshot_url && (
          <button
            onClick={() => onViewScreenshot(reg.payment_screenshot_url!)}
            className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            Receipt
          </button>
        )}
      </div>

      {/* Athlete identity */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-surface-600 border border-surface-500 flex items-center justify-center text-sm font-bold text-text-secondary shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base text-text-primary truncate">
              {fullName}
            </h3>
            {clubName && (
              <p className="text-text-muted text-xs truncate">{clubName}</p>
            )}
          </div>
        </div>

        {/* Structured data grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
          <DataField label="Age" value={age !== null ? `${age} yrs` : '—'} />
          <DataField label="Weight" value={weight} />
          <DataField label="Phone" value={phone} className="col-span-2" />
        </div>

        {/* Belt badge */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs font-medium">Belt:</span>
          <BeltBadge rank={beltRank} size="sm" />
        </div>
      </div>

      {/* Rejection note */}
      {reg.status === 'REJECTED' && reg.rejection_note && (
        <div className="mx-5 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
          <span className="font-semibold">Note:</span> {reg.rejection_note}
        </div>
      )}

      {/* Action buttons */}
      {reg.status === 'PENDING' && (
        <div className="mt-auto border-t border-surface-600 px-5 py-3 flex gap-2">
          <button
            onClick={() => onApprove(reg.id)}
            disabled={actionLoading === reg.id}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Approve
          </button>
          <button
            onClick={() => onReject(reg.id)}
            disabled={actionLoading === reg.id}
            className="flex-1 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Checkbox
   ═══════════════════════════════════════════════════════════════ */

function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all duration-150 ${
        checked || indeterminate
          ? 'bg-brand-red border-brand-red'
          : 'bg-transparent border-surface-500 hover:border-surface-400'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
        </svg>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Data Field
   ═══════════════════════════════════════════════════════════════ */

function DataField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-text-muted text-[10px] uppercase tracking-wider font-medium leading-none mb-0.5">
        {label}
      </p>
      <p className="text-text-primary text-sm font-medium truncate">{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Status Badge
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return <span className="badge-pending">Pending</span>;
    case 'APPROVED':
      return <span className="badge-approved">Approved</span>;
    case 'REJECTED':
      return <span className="badge-rejected">Rejected</span>;
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Toast Container
   ═══════════════════════════════════════════════════════════════ */

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm animate-[slideInRight_0.3s_ease-out] ${
            toast.type === 'success'
              ? 'bg-green-500/15 border-green-500/25 text-green-400'
              : 'bg-red-500/15 border-red-500/25 text-red-400'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { TournamentStatusBadge } from '@/components/ui/StatusBadges';
import type { Profile, Registration, Tournament } from '@/types/database';

export default function AthleteDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registrations, setRegistrations] = useState<(Registration & { tournament: Tournament })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?role=athlete'); return; }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!prof || prof.role !== 'athlete') { router.push('/'); return; }
      setProfile(prof);

      const { data: regs } = await supabase
        .from('registrations')
        .select('*, tournament:tournaments(*)')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false });

      setRegistrations((regs as any) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-surface-700 rounded" />
          <div className="h-48 bg-surface-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">
            Welcome, {profile?.first_name}
          </h1>
          <p className="text-text-secondary mt-1">Manage your tournament registrations</p>
        </div>
        <Link href="/athlete/tournaments" className="btn-primary text-sm w-fit">
          Browse Tournaments
        </Link>
      </div>

      {/* Profile link */}
      <Link href="/athlete/profile" className="card p-5 flex items-center justify-between group hover:border-surface-500 transition-colors mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-red/20 border border-brand-red/30 flex items-center justify-center text-lg font-bold text-brand-red">
            {profile?.first_name?.[0]}{profile?.last_name?.[0]}
          </div>
          <div>
            <p className="font-semibold">{profile?.first_name} {profile?.last_name}</p>
            <p className="text-text-muted text-sm">{profile?.phone}</p>
          </div>
        </div>
        <span className="text-text-muted group-hover:text-text-secondary text-sm">Edit Profile →</span>
      </Link>

      {/* Registrations */}
      <h2 className="font-display font-semibold text-xl mb-4">My Registrations</h2>

      {registrations.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-muted">You haven&apos;t registered for any tournaments yet.</p>
          <Link href="/athlete/tournaments" className="text-brand-red hover:text-brand-red-light text-sm font-medium mt-2 inline-block">
            Browse Tournaments →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const t = reg.tournament;
            const date = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <div key={reg.id} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <Link href={`/athlete/tournaments/${t.id}`} className="font-semibold hover:text-brand-red transition-colors">
                      {t.name}
                    </Link>
                    <p className="text-text-muted text-sm mt-0.5">{date} · {t.location_text}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={t.registration_type === 'FREE' ? 'badge-free' : 'badge-paid'}>
                      {t.registration_type}
                    </span>
                    <TournamentStatusBadge status={t.status} />
                    <StatusBadge status={reg.status} />
                  </div>
                </div>
                {reg.status === 'REJECTED' && reg.rejection_note && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                    <span className="font-medium">Rejection note:</span> {reg.rejection_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING': return <span className="badge-pending">Pending</span>;
    case 'APPROVED': return <span className="badge-approved">Approved</span>;
    case 'REJECTED': return <span className="badge-rejected">Rejected</span>;
    default: return null;
  }
}

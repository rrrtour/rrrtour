'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { calculateAge, formatCountdown, isRegistrationOpen } from '@/lib/utils';
import { TournamentStatusBadge, RegistrationStatusBadge } from '@/components/ui/StatusBadges';
import type { Tournament, Registration, Profile } from '@/types/database';

export default function TournamentDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const idOrSlug = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [regCount, setRegCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState('');
  const [regCloseCountdown, setRegCloseCountdown] = useState('');

  useEffect(() => {
    async function load() {
      // Try slug first, then fall back to id
      let t: Tournament | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(idOrSlug);

      if (!isUuid) {
        const { data } = await supabase
          .from('tournaments')
          .select('*')
          .eq('slug', idOrSlug)
          .single();
        t = data;
      }

      if (!t) {
        const { data } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', idOrSlug)
          .single();
        t = data;
      }

      if (!t || t.status === 'DRAFT') {
        router.push('/athlete/tournaments');
        return;
      }
      setTournament(t);

      // Get registration count
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.id);
      setRegCount(count || 0);

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);

        const { data: reg } = await supabase
          .from('registrations')
          .select('*')
          .eq('tournament_id', t.id)
          .eq('athlete_id', user.id)
          .single();
        if (reg) setRegistration(reg);
      }

      setLoading(false);
    }
    load();
  }, [idOrSlug]);

  // Countdown tickers
  useEffect(() => {
    if (!tournament) return;
    function tick() {
      setCountdown(formatCountdown(tournament!.date));
      if (tournament!.registration_closes_at && tournament!.status === 'OPEN') {
        setRegCloseCountdown(formatCountdown(tournament!.registration_closes_at));
      }
    }
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [tournament]);

  const handleRegister = async () => {
    if (!profile) { router.push('/auth/login?role=athlete'); return; }
    if (profile.role !== 'athlete') { setError('Only athletes can register.'); return; }
    if (!tournament) return;

    const check = isRegistrationOpen(tournament, regCount);
    if (!check.open) { setError(check.reason); return; }

    setRegistering(true);
    setError('');

    const { data, error: regError } = await supabase
      .from('registrations')
      .insert({ tournament_id: tournament.id, athlete_id: profile.id, status: 'PENDING' })
      .select()
      .single();

    if (regError) {
      setError(
        regError.message.includes('duplicate') || regError.message.includes('unique')
          ? 'You are already registered for this tournament.'
          : regError.message,
      );
    } else {
      setRegistration(data);
      setRegCount((c) => c + 1);
      setSuccess('Registration successful! Your status is Pending.');
    }
    setRegistering(false);
  };

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !registration || !profile) return;
    setUploading(true);
    setError('');

    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/${registration.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-screenshots')
      .upload(filePath, file, { upsert: true });

    if (uploadError) { setError('Upload failed: ' + uploadError.message); setUploading(false); return; }

    const { error: updateError } = await supabase
      .from('registrations')
      .update({ payment_screenshot_url: filePath })
      .eq('id', registration.id);

    if (updateError) {
      setError('Failed to update registration.');
    } else {
      setRegistration({ ...registration, payment_screenshot_url: filePath });
      setSuccess('Payment screenshot uploaded successfully!');
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-surface-700 rounded" />
          <div className="h-64 bg-surface-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const date = new Date(tournament.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const isPaid = tournament.registration_type === 'PAID';
  const regCheck = isRegistrationOpen(tournament, regCount);
  const capacityPct = tournament.max_participants
    ? Math.min((regCount / tournament.max_participants) * 100, 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link href="/athlete/tournaments" className="text-text-muted hover:text-text-secondary text-sm mb-6 inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Tournaments
      </Link>

      {tournament.poster_image_url && (
        <div className="rounded-xl overflow-hidden mb-8 aspect-[21/9]">
          <img src={tournament.poster_image_url} alt={tournament.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <TournamentStatusBadge status={tournament.status} />
              <span className={isPaid ? 'badge-paid' : 'badge-free'}>{tournament.registration_type}</span>
              {tournament.is_private && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">Private</span>
              )}
            </div>
            <h1 className="font-display font-bold text-3xl md:text-4xl">{tournament.name}</h1>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <div>
                <p className="font-medium">{date}</p>
                {countdown && countdown !== 'Passed' && (
                  <p className="text-text-muted text-sm">Starts in {countdown}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <div>
                <p className="font-medium">{tournament.location_text}</p>
                {tournament.location_map_url && (
                  <a href={tournament.location_map_url} target="_blank" rel="noopener noreferrer" className="text-brand-red hover:text-brand-red-light text-sm">View on Map →</a>
                )}
              </div>
            </div>

            {/* Capacity */}
            {tournament.max_participants && (
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="flex-1">
                  <p className="font-medium">{regCount} / {tournament.max_participants} registered</p>
                  <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden mt-1.5 max-w-xs">
                    <div
                      className={`h-full rounded-full transition-all ${capacityPct! >= 100 ? 'bg-red-500' : capacityPct! >= 80 ? 'bg-amber-500' : 'bg-brand-red'}`}
                      style={{ width: `${capacityPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Registration deadline */}
            {tournament.registration_closes_at && tournament.status === 'OPEN' && (
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="font-medium">Registration closes {new Date(tournament.registration_closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  {regCloseCountdown && regCloseCountdown !== 'Passed' && (
                    <p className="text-amber-400 text-sm">Closes in {regCloseCountdown}</p>
                  )}
                  {regCloseCountdown === 'Passed' && (
                    <p className="text-red-400 text-sm">Registration deadline passed</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display font-semibold text-xl mb-3">Description</h2>
            <div className="text-text-secondary leading-relaxed whitespace-pre-wrap">{tournament.description}</div>
          </div>
        </div>

        {/* Registration sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24 space-y-4">
            <h3 className="font-display font-semibold text-lg">Registration</h3>

            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg p-3">{success}</div>}

            {!regCheck.open && !registration ? (
              <p className="text-text-muted text-sm">{regCheck.reason}</p>
            ) : registration ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">Your status:</span>
                  <RegistrationStatusBadge status={registration.status} />
                </div>

                {registration.status === 'REJECTED' && registration.rejection_note && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                    <span className="font-medium">Note:</span> {registration.rejection_note}
                  </div>
                )}

                {isPaid && (
                  <div className="space-y-3 pt-2 border-t border-surface-600">
                    {tournament.external_payment_url && (
                      <a href={tournament.external_payment_url} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full text-center block text-sm">
                        Go to Payment Page →
                      </a>
                    )}
                    {registration.payment_screenshot_url ? (
                      <p className="text-green-400 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Screenshot uploaded
                      </p>
                    ) : (
                      <div>
                        <p className="text-text-muted text-sm mb-2">Upload payment screenshot:</p>
                        <label className="btn-secondary w-full text-center block text-sm cursor-pointer">
                          {uploading ? 'Uploading...' : 'Choose File'}
                          <input type="file" accept="image/*" onChange={handleUploadScreenshot} disabled={uploading} className="hidden" />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {isPaid && tournament.external_payment_url && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
                    This is a paid tournament. After registering, complete payment and upload a screenshot.
                  </div>
                )}
                {!profile ? (
                  <Link href="/auth/login?role=athlete" className="btn-primary w-full text-center block">Login to Register</Link>
                ) : profile.role !== 'athlete' ? (
                  <p className="text-text-muted text-sm">Only athletes can register.</p>
                ) : (
                  <button onClick={handleRegister} disabled={registering} className="btn-primary w-full">
                    {registering ? 'Registering...' : 'Register Now'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

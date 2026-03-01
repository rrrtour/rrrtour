'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import type { Tournament } from '@/types/database';

export default function EditTournamentPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', date: '', location_text: '',
    location_map_url: '', registration_type: 'FREE' as 'FREE' | 'PAID',
    external_payment_url: '', max_participants: '', is_private: false,
    registration_closes_at: '',
    sport_mode: 'BJJ',
    control_board_enabled: true,
    mats_count: '1',
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?role=organizer'); return; }

      const { data: t } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .eq('organizer_id', user.id)
        .single();

      if (!t) { router.push('/organizer/dashboard'); return; }

      // Lock editing for LIVE/ARCHIVED
      if (t.status === 'LIVE' || t.status === 'ARCHIVED') {
        router.push('/organizer/dashboard');
        return;
      }

      setTournament(t);
      const dateLocal = t.date ? new Date(t.date).toISOString().slice(0, 16) : '';
      const deadlineLocal = t.registration_closes_at ? new Date(t.registration_closes_at).toISOString().slice(0, 16) : '';

      setForm({
        name: t.name, description: t.description, date: dateLocal,
        location_text: t.location_text, location_map_url: t.location_map_url || '',
        registration_type: t.registration_type, external_payment_url: t.external_payment_url || '',
        max_participants: t.max_participants ? String(t.max_participants) : '',
        is_private: t.is_private, registration_closes_at: deadlineLocal,
        sport_mode: t.sport_mode || 'BJJ',
        control_board_enabled: t.control_board_enabled !== false,
        mats_count: String(Math.min(t.mats_count || 1, 2)),
      });
      setLoading(false);
    }
    load();
  }, [tournamentId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let posterUrl = tournament?.poster_image_url || null;
    if (posterFile) {
      const fileExt = posterFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from('tournament-posters').upload(filePath, posterFile);
      if (upErr) { setError('Poster upload failed.'); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from('tournament-posters').getPublicUrl(filePath);
      posterUrl = urlData.publicUrl;
    }

    const { error: updateErr } = await supabase.from('tournaments').update({
      name: form.name,
      description: form.description,
      date: new Date(form.date).toISOString(),
      location_text: form.location_text,
      location_map_url: form.location_map_url || null,
      poster_image_url: posterUrl,
      registration_type: form.registration_type,
      external_payment_url: form.registration_type === 'PAID' ? form.external_payment_url : null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      is_private: form.is_private,
      registration_closes_at: form.registration_closes_at ? new Date(form.registration_closes_at).toISOString() : null,
      sport_mode: form.sport_mode,
      control_board_enabled: form.control_board_enabled,
      mats_count: (form.sport_mode === 'BJJ' || form.sport_mode === 'Grappling') ? Math.min(parseInt(form.mats_count) || 1, 2) : 1,
    }).eq('id', tournamentId);

    if (updateErr) { setError(updateErr.message); } else { router.push('/organizer/dashboard'); }
    setSaving(false);
  };

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-12"><div className="animate-pulse h-96 bg-surface-700 rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link href="/organizer/dashboard" className="text-text-muted hover:text-text-secondary text-sm mb-6 inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Dashboard
      </Link>

      <h1 className="font-display font-bold text-2xl md:text-3xl mb-8">Edit Tournament</h1>

      <div className="card p-8">
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="label">Tournament Name</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} className="input-field min-h-[120px] resize-y" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Date &amp; Time</label><input type="datetime-local" value={form.date} onChange={e => update('date', e.target.value)} className="input-field" required /></div>
            <div>
              <label className="label">Capacity <span className="text-text-muted">(optional)</span></label>
              <input type="number" value={form.max_participants} onChange={e => update('max_participants', e.target.value)} className="input-field" placeholder="No limit" />
            </div>
          </div>
          <div><label className="label">Location</label><input type="text" value={form.location_text} onChange={e => update('location_text', e.target.value)} className="input-field" required /></div>
          <div><label className="label">Map URL <span className="text-text-muted">(optional)</span></label><input type="url" value={form.location_map_url} onChange={e => update('location_map_url', e.target.value)} className="input-field" /></div>
          <div>
            <label className="label">Poster Image <span className="text-text-muted">(optional, upload to replace)</span></label>
            <label className="input-field flex items-center justify-center cursor-pointer min-h-[80px] border-dashed hover:border-surface-500 transition-colors">
              {posterFile ? <span className="text-text-secondary text-sm">{posterFile.name}</span> : <span className="text-text-muted text-sm">{tournament?.poster_image_url ? 'Replace poster' : 'Upload poster'}</span>}
              <input type="file" accept="image/*" onChange={e => setPosterFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
          </div>

          <hr className="border-surface-600" />

          {/* Fight Engine Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sport Mode</label>
              <select value={form.sport_mode} onChange={e => { update('sport_mode', e.target.value); if (e.target.value !== 'BJJ' && e.target.value !== 'Grappling') update('mats_count', '1'); }} className="input-field">
                <option value="BJJ">BJJ</option>
                <option value="Grappling">Grappling</option>
                <option value="MMA">MMA</option>
                <option value="Kickboxing">Kickboxing</option>
                <option value="Muaythai">Muay Thai</option>
                <option value="Boxing">Boxing</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {form.control_board_enabled && (form.sport_mode === 'BJJ' || form.sport_mode === 'Grappling') && (
              <div>
                <label className="label">Number of Mats</label>
                <select value={form.mats_count} onChange={e => update('mats_count', e.target.value)} className="input-field">
                  {[1,2].map(n => <option key={n} value={String(n)}>{n} {n === 1 ? 'mat' : 'mats'}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-text-primary">Control Board</p><p className="text-xs text-text-muted">Enable live scoreboard and fight controls</p></div>
            <button type="button" onClick={() => update('control_board_enabled', !form.control_board_enabled as any)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.control_board_enabled ? 'bg-brand-red' : 'bg-surface-600'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.control_board_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <hr className="border-surface-600" />

          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-text-primary">Private Tournament</p><p className="text-xs text-text-muted">Only accessible via direct link</p></div>
            <button type="button" onClick={() => update('is_private', !form.is_private)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_private ? 'bg-brand-red' : 'bg-surface-600'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_private ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Registration Type</label><select value={form.registration_type} onChange={e => update('registration_type', e.target.value)} className="input-field"><option value="FREE">Free</option><option value="PAID">Paid</option></select></div>
            <div><label className="label">Reg. Deadline <span className="text-text-muted">(optional)</span></label><input type="datetime-local" value={form.registration_closes_at} onChange={e => update('registration_closes_at', e.target.value)} className="input-field" /></div>
          </div>

          {form.registration_type === 'PAID' && (
            <div><label className="label">External Payment URL</label><input type="url" value={form.external_payment_url} onChange={e => update('external_payment_url', e.target.value)} className="input-field" required /></div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>
    </div>
  );
}

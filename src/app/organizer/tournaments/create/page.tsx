'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { generateSlug } from '@/lib/utils';

export default function CreateTournamentPage() {
  const supabase = createClient();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    location_text: '',
    location_map_url: '',
    registration_type: 'FREE' as 'FREE' | 'PAID',
    external_payment_url: '',
    max_participants: '',
    status: 'DRAFT' as 'DRAFT' | 'OPEN',
    is_private: false,
    registration_closes_at: '',
    sport_mode: 'BJJ',
    control_board_enabled: true,
    mats_count: '1',
  });

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?role=organizer'); return; }

    if (form.registration_type === 'PAID' && !form.external_payment_url) {
      setError('Payment URL is required for paid tournaments.');
      setLoading(false);
      return;
    }

    let posterUrl: string | null = null;
    if (posterFile) {
      const fileExt = posterFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('tournament-posters').upload(filePath, posterFile);
      if (uploadError) { setError('Poster upload failed: ' + uploadError.message); setLoading(false); return; }
      const { data: urlData } = supabase.storage.from('tournament-posters').getPublicUrl(filePath);
      posterUrl = urlData.publicUrl;
    }

    const slug = generateSlug(form.name);

    const { error: insertError } = await supabase.from('tournaments').insert({
      organizer_id: user.id,
      name: form.name,
      slug,
      description: form.description,
      date: new Date(form.date).toISOString(),
      location_text: form.location_text,
      location_map_url: form.location_map_url || null,
      poster_image_url: posterUrl,
      registration_type: form.registration_type,
      external_payment_url: form.registration_type === 'PAID' ? form.external_payment_url : null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      status: form.status,
      is_private: form.is_private,
      registration_closes_at: form.registration_closes_at ? new Date(form.registration_closes_at).toISOString() : null,
      sport_mode: form.sport_mode,
      control_board_enabled: form.control_board_enabled,
      mats_count: (form.sport_mode === 'BJJ' || form.sport_mode === 'Grappling') ? Math.min(parseInt(form.mats_count) || 1, 2) : 1,
    });

    if (insertError) {
      if (insertError.message.includes('slug')) {
        // Retry with new slug
        const retrySlug = generateSlug(form.name);
        const { error: retryError } = await supabase.from('tournaments').insert({
          organizer_id: user.id, name: form.name, slug: retrySlug,
          description: form.description, date: new Date(form.date).toISOString(),
          location_text: form.location_text, location_map_url: form.location_map_url || null,
          poster_image_url: posterUrl, registration_type: form.registration_type,
          external_payment_url: form.registration_type === 'PAID' ? form.external_payment_url : null,
          max_participants: form.max_participants ? parseInt(form.max_participants) : null,
          status: form.status, is_private: form.is_private,
          registration_closes_at: form.registration_closes_at ? new Date(form.registration_closes_at).toISOString() : null,
          sport_mode: form.sport_mode, control_board_enabled: form.control_board_enabled,
          mats_count: (form.sport_mode === 'BJJ' || form.sport_mode === 'Grappling') ? Math.min(parseInt(form.mats_count) || 1, 2) : 1,
        });
        if (retryError) { setError(retryError.message); setLoading(false); return; }
      } else {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/organizer/dashboard');
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-display font-bold text-2xl md:text-3xl mb-8">Create Tournament</h1>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="label">Tournament Name</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="input-field" placeholder="e.g. Spring Championship 2025" required />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} className="input-field min-h-[120px] resize-y" placeholder="Describe your tournament..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date &amp; Time</label>
              <input type="datetime-local" value={form.date} onChange={e => update('date', e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label">Initial Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className="input-field">
                <option value="DRAFT">Draft (hidden)</option>
                <option value="OPEN">Open (visible, registration on)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <input type="text" value={form.location_text} onChange={e => update('location_text', e.target.value)} className="input-field" placeholder="e.g. Sports Arena, 123 Main St" required />
          </div>

          <div>
            <label className="label">Map URL <span className="text-text-muted">(optional)</span></label>
            <input type="url" value={form.location_map_url} onChange={e => update('location_map_url', e.target.value)} className="input-field" placeholder="https://maps.google.com/..." />
          </div>

          <div>
            <label className="label">Poster Image <span className="text-text-muted">(optional)</span></label>
            <label className="input-field flex items-center justify-center cursor-pointer min-h-[100px] border-dashed hover:border-surface-500 transition-colors">
              {posterFile ? <span className="text-text-secondary text-sm">{posterFile.name}</span> : <span className="text-text-muted text-sm">Click to upload poster image</span>}
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
            <div>
              <p className="text-sm font-medium text-text-primary">Control Board</p>
              <p className="text-xs text-text-muted">Enable live scoreboard and fight controls</p>
            </div>
            <button
              type="button"
              onClick={() => update('control_board_enabled', !form.control_board_enabled as any)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.control_board_enabled ? 'bg-brand-red' : 'bg-surface-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.control_board_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <hr className="border-surface-600" />

          {/* Visibility */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Private Tournament</p>
              <p className="text-xs text-text-muted">Only accessible via direct link</p>
            </div>
            <button
              type="button"
              onClick={() => update('is_private', !form.is_private)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_private ? 'bg-brand-red' : 'bg-surface-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_private ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Registration Type</label>
              <select value={form.registration_type} onChange={e => update('registration_type', e.target.value)} className="input-field">
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label className="label">Capacity <span className="text-text-muted">(optional)</span></label>
              <input type="number" value={form.max_participants} onChange={e => update('max_participants', e.target.value)} className="input-field" placeholder="No limit" />
            </div>
          </div>

          <div>
            <label className="label">Registration Deadline <span className="text-text-muted">(optional)</span></label>
            <input type="datetime-local" value={form.registration_closes_at} onChange={e => update('registration_closes_at', e.target.value)} className="input-field" />
            <p className="text-text-muted text-xs mt-1">Registration automatically closes at this time.</p>
          </div>

          {form.registration_type === 'PAID' && (
            <div>
              <label className="label">External Payment URL</label>
              <input type="url" value={form.external_payment_url} onChange={e => update('external_payment_url', e.target.value)} className="input-field" placeholder="https://payment.example.com/..." required />
              <p className="text-text-muted text-xs mt-1">Athletes will be directed to this link for payment.</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </form>
      </div>
    </div>
  );
}

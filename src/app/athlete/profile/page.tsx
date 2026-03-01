'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import BeltSelect from '@/components/ui/BeltSelect';
import BeltBadge from '@/components/ui/BeltBadge';
import { COUNTRIES, countryCodeToEmoji } from '@/lib/countries';
import type { BeltRank } from '@/types/database';

export default function AthleteProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    weight_kg: '',
    gender: '',
    club_name: '',
    height_cm: '',
    belt_rank: '',
    country_code: '',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?role=athlete'); return; }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: athlete } = await supabase.from('athlete_profiles').select('*').eq('id', user.id).single();

      if (profile && athlete) {
        setForm({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          date_of_birth: athlete.date_of_birth,
          weight_kg: String(athlete.weight_kg),
          gender: athlete.gender || '',
          club_name: athlete.club_name || '',
          height_cm: athlete.height_cm ? String(athlete.height_cm) : '',
          belt_rank: athlete.belt_rank || '',
          country_code: athlete.country_code || '',
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: e1 } = await supabase.from('profiles').update({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
    }).eq('id', user.id);

    const { error: e2 } = await supabase.from('athlete_profiles').update({
      date_of_birth: form.date_of_birth,
      weight_kg: parseFloat(form.weight_kg),
      gender: form.gender || null,
      club_name: form.club_name || null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      belt_rank: form.belt_rank || null,
      country_code: form.country_code || null,
    }).eq('id', user.id);

    if (e1 || e2) {
      setMessage('Error saving profile');
    } else {
      setMessage('Profile saved successfully');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-700 rounded" />
          <div className="h-96 bg-surface-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-display font-bold text-2xl md:text-3xl mb-8">Edit Profile</h1>

      <div className="card p-8">
        <form onSubmit={handleSave} className="space-y-5">
          {message && (
            <div className={`text-sm rounded-lg p-3 ${message.includes('Error') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} className="input-field" required />
            </div>
            <div className="col-span-2">
              <label className="label">Phone</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="input-field" required />
            </div>
          </div>

          <hr className="border-surface-600" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label">Gender <span className="text-text-muted">(optional)</span></label>
              <select value={form.gender} onChange={e => update('gender', e.target.value)} className="input-field">
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Height (cm) <span className="text-text-muted">(optional)</span></label>
              <input type="number" step="0.1" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="label">Country <span className="text-text-muted">(optional)</span></label>
              <select value={form.country_code} onChange={e => update('country_code', e.target.value)} className="input-field">
                <option value="">Select country...</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{countryCodeToEmoji(c.code)} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Club Name <span className="text-text-muted">(optional)</span></label>
              <input type="text" value={form.club_name} onChange={e => update('club_name', e.target.value)} className="input-field" />
            </div>
            <div className="col-span-2">
              <BeltSelect value={form.belt_rank} onChange={(v) => update('belt_rank', v)} />
              {form.belt_rank && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-text-muted text-xs">Preview:</span>
                  <BeltBadge rank={form.belt_rank as BeltRank} size="md" />
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

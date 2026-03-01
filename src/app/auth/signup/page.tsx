'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import BeltSelect from '@/components/ui/BeltSelect';

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = (searchParams.get('role') === 'organizer' ? 'organizer' : 'athlete') as 'athlete' | 'organizer';

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    // Athlete fields
    date_of_birth: '',
    weight_kg: '',
    gender: '',
    club_name: '',
    height_cm: '',
    belt_rank: '',
    // Organizer fields
    organization_name: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Sign up auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError('Signup failed. Please try again.');
      setLoading(false);
      return;
    }

    // 2. Create base profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: roleParam,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // 3. Create role-specific profile
    if (roleParam === 'athlete') {
      const { error: athleteError } = await supabase.from('athlete_profiles').insert({
        id: userId,
        date_of_birth: form.date_of_birth,
        weight_kg: parseFloat(form.weight_kg),
        gender: form.gender || null,
        club_name: form.club_name || null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        belt_rank: form.belt_rank || null,
      });

      if (athleteError) {
        setError(athleteError.message);
        setLoading(false);
        return;
      }

      router.push('/athlete/dashboard');
    } else {
      const { error: orgError } = await supabase.from('organizer_profiles').insert({
        id: userId,
        organization_name: form.organization_name || null,
      });

      if (orgError) {
        setError(orgError.message);
        setLoading(false);
        return;
      }

      router.push('/organizer/dashboard');
    }

    router.refresh();
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl">
            {roleParam === 'organizer' ? 'Organizer' : 'Athlete'} Sign Up
          </h1>
          <p className="text-text-secondary mt-2">Create your account to get started</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Auth fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="input-field" placeholder="you@example.com" required />
              </div>
              <div className="col-span-2">
                <label className="label">Password</label>
                <input type="password" value={form.password} onChange={e => update('password', e.target.value)} className="input-field" placeholder="Min 6 characters" minLength={6} required />
              </div>
            </div>

            <hr className="border-surface-600" />

            {/* Base profile fields */}
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
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="input-field" placeholder="+1 (555) 000-0000" required />
              </div>
            </div>

            {/* Role-specific fields */}
            {roleParam === 'athlete' ? (
              <>
                <hr className="border-surface-600" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date of Birth</label>
                    <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} className="input-field" required />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input type="number" step="0.1" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} className="input-field" placeholder="75.0" required />
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
                    <input type="number" step="0.1" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} className="input-field" placeholder="175" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Club Name <span className="text-text-muted">(optional)</span></label>
                    <input type="text" value={form.club_name} onChange={e => update('club_name', e.target.value)} className="input-field" placeholder="Your gym or club" />
                  </div>
                  <div className="col-span-2">
                    <BeltSelect value={form.belt_rank} onChange={(v) => update('belt_rank', v)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <hr className="border-surface-600" />
                <div>
                  <label className="label">Organization Name <span className="text-text-muted">(optional)</span></label>
                  <input type="text" value={form.organization_name} onChange={e => update('organization_name', e.target.value)} className="input-field" placeholder="Your organization" />
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href={`/auth/login?role=${roleParam}`} className="text-brand-red hover:text-brand-red-light font-medium">
              Sign In
            </Link>
          </div>

          {roleParam === 'athlete' ? (
            <div className="mt-3 text-center text-sm">
              <Link href="/auth/signup?role=organizer" className="text-text-muted hover:text-text-secondary">
                Sign up as organizer instead →
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-center text-sm">
              <Link href="/auth/signup?role=athlete" className="text-text-muted hover:text-text-secondary">
                Sign up as athlete instead →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

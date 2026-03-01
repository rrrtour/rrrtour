'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') || 'athlete';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        setError('Profile not found. Please sign up first.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (profile.role === 'organizer') {
        router.push('/organizer/dashboard');
      } else {
        router.push('/athlete/dashboard');
      }
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl">
            {roleParam === 'organizer' ? 'Organizer' : 'Athlete'} Login
          </h1>
          <p className="text-text-secondary mt-2">Sign in to your account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href={`/auth/signup?role=${roleParam}`} className="text-brand-red hover:text-brand-red-light font-medium">
              Sign Up
            </Link>
          </div>

          {roleParam === 'athlete' ? (
            <div className="mt-3 text-center text-sm">
              <Link href="/auth/login?role=organizer" className="text-text-muted hover:text-text-secondary">
                Are you an organizer? →
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-center text-sm">
              <Link href="/auth/login?role=athlete" className="text-text-muted hover:text-text-secondary">
                Are you an athlete? →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

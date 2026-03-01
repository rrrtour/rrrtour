'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import type { Profile } from '@/types/database';

export default function Navbar() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    router.push('/');
    router.refresh();
  };

  const dashboardLink = profile?.role === 'organizer'
    ? '/organizer/dashboard'
    : '/athlete/dashboard';

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200" style={{ background: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/rrr-logo.svg" alt="RRR Arena" className="h-9 sm:h-10 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>Home</Link>
            <Link href="/athlete/tournaments" className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>Tournaments</Link>

            {loading ? (
              <div className="w-20 h-9 rounded-lg animate-pulse ml-1" style={{ background: '#E10600', opacity: 0.3 }} />
            ) : profile ? (
              <div className="flex items-center gap-3 ml-1">
                <Link href={dashboardLink} className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>
                  Sign Out
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#E10600', color: '#FFFFFF' }}>
                  {profile.first_name?.[0]}{profile.last_name?.[0]}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 ml-1">
                <Link href="/auth/login?role=athlete" className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>
                  Athlete Login
                </Link>
                <Link href="/auth/login?role=organizer" className="text-sm font-semibold rounded-lg px-4 py-2 transition-all duration-200 active:scale-[0.98]" style={{ background: '#E10600', color: '#FFFFFF' }} onMouseEnter={e => (e.currentTarget.style.background = '#C00500')} onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}>
                  Organizer Login
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2"
            style={{ color: '#333333' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 pt-3 space-y-2">
            <Link href="/" className="block text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }} onClick={() => setMenuOpen(false)}>Home</Link>
            <Link href="/athlete/tournaments" className="block text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }} onClick={() => setMenuOpen(false)}>Tournaments</Link>
            {profile ? (
              <>
                <Link href={dashboardLink} className="block text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleSignOut} className="block w-full text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }}>Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/auth/login?role=athlete" className="block text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }} onClick={() => setMenuOpen(false)}>Athlete Login</Link>
                <Link href="/auth/login?role=organizer" className="block text-sm font-semibold rounded-lg px-4 py-2 text-center transition-all duration-200" style={{ background: '#E10600', color: '#FFFFFF' }} onClick={() => setMenuOpen(false)}>Organizer Login</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

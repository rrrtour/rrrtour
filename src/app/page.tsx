import { createServerSupabaseClient } from '@/lib/supabase-server';
import Link from 'next/link';
import TournamentCard from '@/components/ui/TournamentCard';
import type { Tournament } from '@/types/database';

export const revalidate = 0;

export default async function HomePage() {
  const supabase = createServerSupabaseClient();

  // Fetch OPEN + LIVE public tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['OPEN', 'LIVE'])
    .eq('is_private', false)
    .order('date', { ascending: true })
    .limit(12);

  // Fetch registration counts for capacity display
  let regCounts: Record<string, number> = {};
  if (tournaments && tournaments.length > 0) {
    const ids = tournaments.map((t: Tournament) => t.id);
    const { data: countData } = await supabase
      .from('registrations')
      .select('tournament_id')
      .in('tournament_id', ids);

    if (countData) {
      for (const r of countData) {
        regCounts[r.tournament_id] = (regCounts[r.tournament_id] || 0) + 1;
      }
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/10 via-surface-900 to-surface-900" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <h1 className="font-display font-extrabold text-4xl md:text-6xl lg:text-7xl tracking-tight max-w-3xl">
            Compete at the
            <span className="text-brand-red"> Highest Level</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-xl leading-relaxed">
            Find tournaments, register with ease, and track your competition status — all in one place.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/athlete/tournaments" className="btn-primary text-base">
              Browse Tournaments
            </Link>
            <Link href="/auth/signup?role=organizer" className="btn-secondary text-base">
              Host a Tournament
            </Link>
          </div>
        </div>
      </section>

      {/* Tournament cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display font-bold text-2xl md:text-3xl">Upcoming Tournaments</h2>
          <Link href="/athlete/tournaments" className="text-brand-red hover:text-brand-red-light text-sm font-medium transition-colors">
            View all →
          </Link>
        </div>

        {!tournaments || tournaments.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-text-muted text-lg">No open tournaments at the moment.</p>
            <p className="text-text-muted text-sm mt-2">Check back soon or create your own!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t: Tournament) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                registrationCount={regCounts[t.id] || 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

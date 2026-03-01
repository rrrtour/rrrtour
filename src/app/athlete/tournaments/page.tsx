import { createServerSupabaseClient } from '@/lib/supabase-server';
import TournamentCard from '@/components/ui/TournamentCard';
import type { Tournament } from '@/types/database';

export const revalidate = 0;

export default async function TournamentsListPage() {
  const supabase = createServerSupabaseClient();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['OPEN', 'LIVE'])
    .eq('is_private', false)
    .order('date', { ascending: true });

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-display font-bold text-2xl md:text-3xl mb-8">Tournaments</h1>

      {!tournaments || tournaments.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-muted text-lg">No open tournaments at the moment.</p>
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
    </div>
  );
}

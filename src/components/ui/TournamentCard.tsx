'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Tournament } from '@/types/database';
import { formatCountdown, statusLabel } from '@/lib/utils';

export default function TournamentCard({
  tournament: t,
  registrationCount,
}: {
  tournament: Tournament;
  registrationCount?: number;
}) {
  const formattedDate = new Date(t.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const [countdown, setCountdown] = useState('');
  const [regCloseCountdown, setRegCloseCountdown] = useState('');

  useEffect(() => {
    function tick() {
      setCountdown(formatCountdown(t.date));
      if (t.registration_closes_at && t.status === 'OPEN') {
        const rc = formatCountdown(t.registration_closes_at);
        setRegCloseCountdown(rc);
      }
    }
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
  }, [t.date, t.registration_closes_at, t.status]);

  const label = statusLabel(t);
  const capacityPct =
    t.max_participants && registrationCount !== undefined
      ? Math.min((registrationCount / t.max_participants) * 100, 100)
      : null;

  return (
    <Link
      href={`/athlete/tournaments/${t.slug || t.id}`}
      className="card group hover:border-surface-500 transition-all duration-300 flex flex-col"
    >
      {/* Poster */}
      <div className="aspect-[16/9] bg-surface-700 relative overflow-hidden">
        {t.poster_image_url ? (
          <img
            src={t.poster_image_url}
            alt={t.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-700 to-surface-800">
            <svg className="w-12 h-12 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          <StatusPill status={t.status} label={label} />
          <span className={t.registration_type === 'FREE' ? 'badge-free' : 'badge-paid'}>
            {t.registration_type}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-lg text-text-primary group-hover:text-brand-red transition-colors line-clamp-1">
          {t.name}
        </h3>
        <p className="text-text-muted text-sm mt-1 line-clamp-2">{t.description}</p>

        <div className="flex items-center gap-4 mt-4 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formattedDate}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate max-w-[120px]">{t.location_text}</span>
          </span>
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-4 space-y-2">
          {/* Countdown */}
          {countdown && countdown !== 'Passed' && (
            <p className="text-xs text-text-muted">
              Starts in <span className="text-text-secondary font-medium">{countdown}</span>
            </p>
          )}

          {/* Registration close countdown */}
          {regCloseCountdown && regCloseCountdown !== 'Passed' && t.status === 'OPEN' && (
            <p className="text-xs text-amber-400">
              Closes in {regCloseCountdown}
            </p>
          )}

          {/* Capacity bar */}
          {t.max_participants && (
            <div>
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>{registrationCount ?? 0} / {t.max_participants}</span>
                {capacityPct !== null && capacityPct >= 100 && (
                  <span className="text-red-400 font-medium">Full</span>
                )}
              </div>
              <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    capacityPct !== null && capacityPct >= 100
                      ? 'bg-red-500'
                      : capacityPct !== null && capacityPct >= 80
                        ? 'bg-amber-500'
                        : 'bg-brand-red'
                  }`}
                  style={{ width: `${capacityPct ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const cls = {
    DRAFT: 'bg-surface-600/90 text-text-muted border-surface-500',
    OPEN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    LIVE: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
    ARCHIVED: 'bg-surface-500/50 text-text-muted border-surface-500',
  }[status] || 'bg-surface-600 text-text-muted border-surface-500';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${cls}`}>
      {status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
      {label}
    </span>
  );
}

import type { Tournament } from '@/types/database';

/** Calculate age from date of birth string. */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Generate a URL-safe slug from a tournament name. */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 7);
  return base ? `${base}-${suffix}` : suffix;
}

/** Format a relative countdown string like "3d 5h" or "2h 30m" */
export function formatCountdown(targetDateStr: string): string {
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return 'Passed';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Whether registration is effectively open for a tournament. */
export function isRegistrationOpen(t: Tournament, regCount?: number): {
  open: boolean;
  reason: string;
} {
  if (t.status !== 'OPEN') {
    return { open: false, reason: t.status === 'DRAFT' ? 'Tournament is in draft.' : t.status === 'LIVE' ? 'Registration is closed.' : 'Tournament is archived.' };
  }
  if (t.registration_closes_at && new Date(t.registration_closes_at).getTime() < Date.now()) {
    return { open: false, reason: 'Registration deadline has passed.' };
  }
  if (t.max_participants && regCount !== undefined && regCount >= t.max_participants) {
    return { open: false, reason: 'Tournament is full.' };
  }
  return { open: true, reason: '' };
}

/** Status badge label for display */
export function statusLabel(t: Tournament): string {
  if (t.status === 'DRAFT') return 'Draft';
  if (t.status === 'OPEN') return 'Registration Open';
  if (t.status === 'LIVE') return 'LIVE NOW';
  return 'Archived';
}

import type { TournamentStatus } from '@/types/database';

export function TournamentStatusBadge({ status }: { status: TournamentStatus | string }) {
  switch (status) {
    case 'DRAFT':
      return <span className="badge-draft">Draft</span>;
    case 'OPEN':
      return <span className="badge-open">Open</span>;
    case 'LIVE':
      return (
        <span className="badge-live">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Live
        </span>
      );
    case 'ARCHIVED':
      return <span className="badge-archived">Archived</span>;
    default:
      return <span className="badge-closed">{status}</span>;
  }
}

export function RegistrationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return <span className="badge-pending">Pending</span>;
    case 'APPROVED':
      return <span className="badge-approved">Approved</span>;
    case 'REJECTED':
      return <span className="badge-rejected">Rejected</span>;
    default:
      return null;
  }
}

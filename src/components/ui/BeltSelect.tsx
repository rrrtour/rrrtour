import { BELT_RANK_OPTIONS, type BeltRank } from '@/types/database';

interface BeltSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function BeltSelect({ value, onChange, required = false }: BeltSelectProps) {
  return (
    <div>
      <label className="label">
        Belt Rank {!required && <span className="text-text-muted">(optional)</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        required={required}
      >
        <option value="">Select belt rank</option>
        {BELT_RANK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

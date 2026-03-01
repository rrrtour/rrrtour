import type { BeltRank } from '@/types/database';

interface BeltBadgeProps {
  rank: BeltRank | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

interface BeltStyle {
  label: string;
  bg: string;
  text: string;
  border: string;
  gradient?: string;
}

const BELT_STYLES: Record<BeltRank, BeltStyle> = {
  white: {
    label: 'White',
    bg: 'bg-white/90',
    text: 'text-gray-800',
    border: 'border-gray-300',
  },
  grey_white: {
    label: 'Grey & White',
    bg: '',
    text: 'text-white',
    border: 'border-gray-400',
    gradient: 'background: linear-gradient(90deg, #9CA3AF 0%, #9CA3AF 50%, #F9FAFB 50%, #F9FAFB 100%)',
  },
  grey: {
    label: 'Grey',
    bg: 'bg-gray-400',
    text: 'text-gray-900',
    border: 'border-gray-500',
  },
  grey_black: {
    label: 'Grey & Black',
    bg: '',
    text: 'text-white',
    border: 'border-gray-600',
    gradient: 'background: linear-gradient(90deg, #9CA3AF 0%, #9CA3AF 50%, #1F2937 50%, #1F2937 100%)',
  },
  yellow_white: {
    label: 'Yellow & White',
    bg: '',
    text: 'text-gray-800',
    border: 'border-yellow-400',
    gradient: 'background: linear-gradient(90deg, #FACC15 0%, #FACC15 50%, #F9FAFB 50%, #F9FAFB 100%)',
  },
  yellow: {
    label: 'Yellow',
    bg: 'bg-yellow-400',
    text: 'text-yellow-950',
    border: 'border-yellow-500',
  },
  yellow_black: {
    label: 'Yellow & Black',
    bg: '',
    text: 'text-white',
    border: 'border-yellow-500',
    gradient: 'background: linear-gradient(90deg, #FACC15 0%, #FACC15 50%, #1F2937 50%, #1F2937 100%)',
  },
  orange_white: {
    label: 'Orange & White',
    bg: '',
    text: 'text-gray-800',
    border: 'border-orange-400',
    gradient: 'background: linear-gradient(90deg, #FB923C 0%, #FB923C 50%, #F9FAFB 50%, #F9FAFB 100%)',
  },
  orange: {
    label: 'Orange',
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
  },
  orange_black: {
    label: 'Orange & Black',
    bg: '',
    text: 'text-white',
    border: 'border-orange-500',
    gradient: 'background: linear-gradient(90deg, #FB923C 0%, #FB923C 50%, #1F2937 50%, #1F2937 100%)',
  },
  green_white: {
    label: 'Green & White',
    bg: '',
    text: 'text-gray-800',
    border: 'border-green-400',
    gradient: 'background: linear-gradient(90deg, #4ADE80 0%, #4ADE80 50%, #F9FAFB 50%, #F9FAFB 100%)',
  },
  green: {
    label: 'Green',
    bg: 'bg-green-500',
    text: 'text-white',
    border: 'border-green-600',
  },
  green_black: {
    label: 'Green & Black',
    bg: '',
    text: 'text-white',
    border: 'border-green-500',
    gradient: 'background: linear-gradient(90deg, #4ADE80 0%, #4ADE80 50%, #1F2937 50%, #1F2937 100%)',
  },
  blue: {
    label: 'Blue',
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-700',
  },
  purple: {
    label: 'Purple',
    bg: 'bg-purple-600',
    text: 'text-white',
    border: 'border-purple-700',
  },
  brown: {
    label: 'Brown',
    bg: 'bg-amber-800',
    text: 'text-amber-100',
    border: 'border-amber-900',
  },
  black: {
    label: 'Black',
    bg: 'bg-gray-900',
    text: 'text-gray-100',
    border: 'border-gray-700',
  },
};

const SIZE_CLASSES = {
  sm: 'h-5 px-2 text-[10px] min-w-[60px] rounded',
  md: 'h-7 px-3 text-xs min-w-[80px] rounded-md',
  lg: 'h-9 px-4 text-sm min-w-[100px] rounded-lg',
};

export default function BeltBadge({ rank, size = 'md' }: BeltBadgeProps) {
  if (!rank) {
    return (
      <span
        className={`
          ${SIZE_CLASSES[size]}
          inline-flex items-center justify-center font-semibold tracking-wide uppercase
          bg-surface-600 text-text-muted border border-surface-500
        `}
      >
        No Belt
      </span>
    );
  }

  const style = BELT_STYLES[rank];
  if (!style) return null;

  const isStriped = !!style.gradient;

  // Striped belts need a text shadow or outlined text for readability on split colors
  const stripedTextClass = isStriped
    ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
    : '';

  return (
    <span
      className={`
        ${SIZE_CLASSES[size]}
        inline-flex items-center justify-center font-bold tracking-wider uppercase
        border
        ${isStriped ? '' : style.bg}
        ${isStriped ? 'text-white' : style.text}
        ${style.border}
        ${stripedTextClass}
        relative overflow-hidden
      `}
      style={isStriped ? { ...parseGradient(style.gradient!) } : undefined}
      title={style.label + ' Belt'}
    >
      {/* Inner highlight for depth */}
      <span className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
      <span className="relative z-10">{style.label}</span>
    </span>
  );
}

/** Parse CSS gradient string into a React style object */
function parseGradient(gradient: string): React.CSSProperties {
  // Extract the background value
  const match = gradient.match(/background:\s*(.+)/);
  if (match) {
    return { background: match[1] };
  }
  return {};
}

export type UserRole = 'athlete' | 'organizer';
export type RegistrationType = 'FREE' | 'PAID';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'LIVE' | 'ARCHIVED';

export type BeltRank =
  | 'white'
  | 'grey_white'
  | 'grey'
  | 'grey_black'
  | 'yellow_white'
  | 'yellow'
  | 'yellow_black'
  | 'orange_white'
  | 'orange'
  | 'orange_black'
  | 'green_white'
  | 'green'
  | 'green_black'
  | 'blue'
  | 'purple'
  | 'brown'
  | 'black';

export const BELT_RANK_OPTIONS: { value: BeltRank; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'grey_white', label: 'Grey & White' },
  { value: 'grey', label: 'Grey' },
  { value: 'grey_black', label: 'Grey & Black' },
  { value: 'yellow_white', label: 'Yellow & White' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'yellow_black', label: 'Yellow & Black' },
  { value: 'orange_white', label: 'Orange & White' },
  { value: 'orange', label: 'Orange' },
  { value: 'orange_black', label: 'Orange & Black' },
  { value: 'green_white', label: 'Green & White' },
  { value: 'green', label: 'Green' },
  { value: 'green_black', label: 'Green & Black' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'brown', label: 'Brown' },
  { value: 'black', label: 'Black' },
];

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
  athlete_profiles?: AthleteProfile | null;
}

export interface AthleteProfile {
  id: string;
  date_of_birth: string;
  weight_kg: number;
  gender: string | null;
  club_name: string | null;
  height_cm: number | null;
  belt_rank: BeltRank | null;
  country_code: string | null;
  created_at: string;
}

export interface OrganizerProfile {
  id: string;
  organization_name: string | null;
  created_at: string;
}

export interface Tournament {
  id: string;
  organizer_id: string;
  name: string;
  slug: string;
  description: string;
  date: string;
  location_text: string;
  location_map_url: string | null;
  poster_image_url: string | null;
  registration_type: RegistrationType;
  external_payment_url: string | null;
  max_participants: number | null;
  status: TournamentStatus;
  is_private: boolean;
  registration_closes_at: string | null;
  sport_mode: SportMode;
  control_board_enabled: boolean;
  mats_count: number;
  created_at: string;
  // Virtual (joined in queries)
  registration_count?: number;
}

export interface Registration {
  id: string;
  tournament_id: string;
  athlete_id: string;
  status: RegistrationStatus;
  payment_screenshot_url: string | null;
  rejection_note: string | null;
  created_at: string;
  tournament?: Tournament;
  profiles?: Profile;
  athlete_profiles?: AthleteProfile;
}

/* ═══════════════════════════════════════════════════════════════
   Scoreboard Types
   ═══════════════════════════════════════════════════════════════ */

export type MatchStatus = 'idle' | 'confirmed' | 'live' | 'finished' | 'READY' | 'RUNNING' | 'FINISHED';
export type FightStatus = 'idle' | 'confirmed' | 'live' | 'finished';
export type WinnerSide = 'red' | 'blue';
export type SportMode = 'BJJ' | 'Grappling' | 'MMA' | 'Kickboxing' | 'Muaythai' | 'Boxing' | 'Other';

export interface CurrentMatch {
  tournament_id: string;
  red_athlete_id: string | null;
  blue_athlete_id: string | null;
  red_registration_id: string | null;
  blue_registration_id: string | null;
  status: MatchStatus;
  fight_id?: string;
  mat_number?: number;
  created_at: string;
  updated_at: string;
  // Joined
  red_profile?: Profile & { athlete_profiles?: AthleteProfile | null };
  blue_profile?: Profile & { athlete_profiles?: AthleteProfile | null };
}

export interface FightHistory {
  id: string;
  tournament_id: string;
  mat_number: number;
  red_athlete_id: string | null;
  blue_athlete_id: string | null;
  red_score: number;
  blue_score: number;
  red_adv: number;
  blue_adv: number;
  red_pen: number;
  blue_pen: number;
  winner_side: WinnerSide | null;
  win_method: string | null;
  sport_mode: SportMode;
  duration_seconds: number | null;
  status: string;
  created_at: string;
}

export interface MatchState {
  tournament_id: string;
  mat_number: number;
  round: number;
  match_seconds: number;
  timer_running: boolean;
  red_score: number;
  blue_score: number;
  red_adv: number;
  blue_adv: number;
  red_pen: number;
  blue_pen: number;
  red_kd: number;
  blue_kd: number;
  show_adv_pen: boolean;
  red_stalling_seconds: number;
  blue_stalling_seconds: number;
  stalling_running: 'red' | 'blue' | null;
  winner_side: WinnerSide | null;
  win_method: string | null;
  winner_overlay_visible: boolean;
  sport_mode: SportMode;
  display_label_1: string | null;
  display_label_2: string | null;
  updated_at: string;
}

/** Resettable fields only — never includes tournament_id, mat_number, or updated_at */
export const DEFAULT_MATCH_STATE: Omit<MatchState, 'tournament_id' | 'mat_number' | 'updated_at'> = {
  round: 1,
  match_seconds: 300,
  timer_running: false,
  red_score: 0,
  blue_score: 0,
  red_adv: 0,
  blue_adv: 0,
  red_pen: 0,
  blue_pen: 0,
  red_kd: 0,
  blue_kd: 0,
  show_adv_pen: true,
  red_stalling_seconds: 0,
  blue_stalling_seconds: 0,
  stalling_running: null,
  winner_side: null,
  win_method: null,
  winner_overlay_visible: false,
  sport_mode: 'BJJ',
  display_label_1: null,
  display_label_2: null,
};

export type VehicleType = 'car' | 'bike';
export type LiveryStyle = 'twin' | 'center' | 'clean';
export type SpoilerStyle = 'gt' | 'hyper' | 'none';
export type GameMode = 'levels' | 'free' | 'multi';
export type GameState = 'GARAGE' | 'RACING' | 'GAMEOVER';

export interface CarSpec {
  id: string;
  name: string;
  type: VehicleType;
  classTag: string;
  perk: string;
  price: number;
  baseSpeed: number;
  baseAccel: number;
  baseHandling: number;
  baseNitro: number;
  primaryColor: number;
  neonColor: number;
  logoText: string;
  livery?: LiveryStyle;
  spoiler?: SpoilerStyle;
}

export interface VehicleUpgrade {
  speed: number;
  accel: number;
  handling: number;
  nitro: number;
}

export interface VehicleCustomization {
  primaryColor?: number;
  neonColor?: number;
  emblemText?: string;
  livery?: LiveryStyle;
  spoiler?: SpoilerStyle;
}

export interface SaveState {
  cash: number;
  selectedCarId: string;
  unlockedCars: string[];
  gameMode: GameMode;
  currentLevel: number;
  highestUnlockedLevel: number;
  bestScore: number;
  bestFreeDistance: number;
  playerName: string;
  customizations: Record<string, VehicleCustomization>;
  upgrades: Record<string, VehicleUpgrade>;
}

export interface AtmosphereTheme {
  id: string;
  name: string;
  sky: number;
  fog: number;
  road: number;
  grid: number;
  accent: number;
  sun: number;
}

export interface LevelSpec {
  num: number;
  name: string;
  distance: number;
  reward: number;
  theme: AtmosphereTheme;
  trafficRate: number;
  curveFactor: number;
}

export interface MultiplayerPlayer {
  uid: string;
  name: string;
  carId: string;
  primaryColor: number;
  neonColor: number;
  logoText: string;
  livery: string;
  spoiler: string;
  x: number;
  dist: number;
  kmh: number;
  finished: boolean;
  finishTime: number;
  updatedAt: number;
  isAi?: boolean;
}

export interface MultiplayerRoom {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'RACING';
  startedAt: number;
  raceDistance: number;
  players: Record<string, MultiplayerPlayer>;
}

export interface HudSnapshot {
  kmh: number;
  nitro: number;
  isNitroActive: boolean;
  isWheelieActive: boolean;
  isDrifting: boolean;
  canWheelie: boolean;
  distance: number;
  targetDistance: number;
  runCash: number;
  score: number;
  combo: number;
  nearMissCount: number;
  knockdownCount: number;
  curveLabel: string;
  raceTime: number;
  countdown: string | null;
}

export interface ToastMessage {
  id: number;
  text: string;
  colorClass: string;
}

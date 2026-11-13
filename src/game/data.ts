import type {
  AtmosphereTheme,
  CarSpec,
  LevelSpec,
  SaveState,
  VehicleUpgrade,
} from './types';

export const MAX_LEVELS = 100;

export const CAR_MODELS: CarSpec[] = [
  {
    id: 'viper',
    name: 'VIPER GT',
    type: 'car',
    classTag: 'STREET CLASS',
    perk: 'Balanced Grip',
    price: 0,
    baseSpeed: 285,
    baseAccel: 1.05,
    baseHandling: 1.15,
    baseNitro: 1.1,
    primaryColor: 0x00e5ff,
    neonColor: 0x00ffff,
    logoText: 'VGT',
  },
  {
    id: 'streetfighter',
    name: 'KAWASAKI Z-9',
    type: 'bike',
    classTag: 'SUPERBIKE',
    perk: 'Wheelie Cash +35%',
    price: 1100,
    baseSpeed: 305,
    baseAccel: 1.28,
    baseHandling: 1.38,
    baseNitro: 1.22,
    primaryColor: 0x10b981,
    neonColor: 0x00ff88,
    logoText: 'KZ9',
  },
  {
    id: 'neon_apex',
    name: 'NEON APEX',
    type: 'car',
    classTag: 'DRIFT SPEC',
    perk: 'Quick Nitro Fill',
    price: 2200,
    baseSpeed: 320,
    baseAccel: 1.32,
    baseHandling: 1.44,
    baseNitro: 1.35,
    primaryColor: 0xff007f,
    neonColor: 0xff3399,
    logoText: 'APX',
  },
  {
    id: 'cyber_ninja',
    name: 'CYBER NINJA H2',
    type: 'bike',
    classTag: 'HYPERBIKE',
    perk: 'Narrow Lane Slice',
    price: 3600,
    baseSpeed: 345,
    baseAccel: 1.52,
    baseHandling: 1.62,
    baseNitro: 1.48,
    primaryColor: 0xa855f7,
    neonColor: 0xd946ef,
    logoText: 'NH2',
  },
  {
    id: 'phantom_x',
    name: 'PHANTOM X-7',
    type: 'car',
    classTag: 'SUPERCAR',
    perk: 'Heavy Knockdown',
    price: 5400,
    baseSpeed: 365,
    baseAccel: 1.6,
    baseHandling: 1.55,
    baseNitro: 1.6,
    primaryColor: 0xfacc15,
    neonColor: 0xfde047,
    logoText: 'PX7',
  },
  {
    id: 'hyperion',
    name: 'HYPERION V12',
    type: 'car',
    classTag: 'PROTOTYPE',
    perk: 'Twin-Turbo Boost',
    price: 8200,
    baseSpeed: 388,
    baseAccel: 1.75,
    baseHandling: 1.68,
    baseNitro: 1.75,
    primaryColor: 0xff1e38,
    neonColor: 0xff4d6d,
    logoText: 'HYP',
  },
  {
    id: 'valkyrie_gtr',
    name: 'VALKYRIE GTR',
    type: 'car',
    classTag: 'APEX LEGEND',
    perk: 'Ultimate Aero',
    price: 12000,
    baseSpeed: 408,
    baseAccel: 1.88,
    baseHandling: 1.82,
    baseNitro: 1.92,
    primaryColor: 0xf8fafc,
    neonColor: 0x00ffff,
    logoText: 'VKY',
  },
];

export const CUSTOM_PAINT_PALETTE = [
  { name: 'Cyber Cyan', hex: 0x00e5ff, css: '#00e5ff' },
  { name: 'Crimson Red', hex: 0xff1e38, css: '#ff1e38' },
  { name: 'Hyper Pink', hex: 0xff007f, css: '#ff007f' },
  { name: 'Emerald Venom', hex: 0x10b981, css: '#10b981' },
  { name: 'Solar Gold', hex: 0xfacc15, css: '#facc15' },
  { name: 'Ultra Violet', hex: 0xa855f7, css: '#a855f7' },
  { name: 'Arctic White', hex: 0xf8fafc, css: '#f8fafc' },
  { name: 'Stealth Carbon', hex: 0x1e293b, css: '#1e293b' },
  { name: 'Blaze Orange', hex: 0xf97316, css: '#f97316' },
];

export const CUSTOM_NEON_PALETTE = [
  { name: 'Electric Cyan', hex: 0x00ffff, css: '#00ffff' },
  { name: 'Neon Magenta', hex: 0xff3399, css: '#ff3399' },
  { name: 'Toxic Lime', hex: 0x00ff88, css: '#00ff88' },
  { name: 'Amber Plasma', hex: 0xfde047, css: '#fde047' },
  { name: 'Violet Pulse', hex: 0xd946ef, css: '#d946ef' },
  { name: 'Ruby Laser', hex: 0xff4d6d, css: '#ff4d6d' },
];

export const ATMOSPHERE_THEMES: AtmosphereTheme[] = [
  {
    id: 'harbor',
    name: 'NEON HARBOR',
    sky: 0x070d1f,
    fog: 0x0a132c,
    road: 0x111827,
    grid: 0x00e5ff,
    accent: 0x22d3ee,
    sun: 0xff007f,
  },
  {
    id: 'sunset',
    name: 'SYNTHWAVE SUNSET',
    sky: 0x1d0b2b,
    fog: 0x2b103f,
    road: 0x181326,
    grid: 0xf43f5e,
    accent: 0xfb923c,
    sun: 0xfacc15,
  },
  {
    id: 'emerald',
    name: 'EMERALD MATRIX',
    sky: 0x041715,
    fog: 0x06231f,
    road: 0x0c1918,
    grid: 0x10b981,
    accent: 0x34d399,
    sun: 0x22d3ee,
  },
  {
    id: 'midnight',
    name: 'TOKYO MIDNIGHT',
    sky: 0x050714,
    fog: 0x090d24,
    road: 0x0f172a,
    grid: 0xa855f7,
    accent: 0xe879f9,
    sun: 0x38bdf8,
  },
  {
    id: 'crimson',
    name: 'REDLINE CANYON',
    sky: 0x1a080c,
    fog: 0x2a0c13,
    road: 0x191216,
    grid: 0xff3b30,
    accent: 0xfbbf24,
    sun: 0xff5722,
  },
];

const STAGE_PREFIXES = [
  'NEON HARBOR',
  'CYBER EXPRESSWAY',
  'SYNTHWAVE BAY',
  'TOKYO OVERPASS',
  'MIDNIGHT TUNNEL',
  'REDLINE CANYON',
  'HYPERION LOOP',
  'PLASMA VIADUCT',
  'CHROME SKYWAY',
  'APEX SUMMIT',
];

export function getLevelSpec(levelNum: number): LevelSpec {
  const num = Math.max(1, Math.min(MAX_LEVELS, Math.floor(levelNum)));
  const theme = ATMOSPHERE_THEMES[(num - 1) % ATMOSPHERE_THEMES.length];
  const prefix = STAGE_PREFIXES[(num - 1) % STAGE_PREFIXES.length];
  const sector = Math.floor((num - 1) / STAGE_PREFIXES.length) + 1;
  const name = sector > 1 ? `${prefix} S${sector}` : prefix;

  // Level 1 matches 1.27 KM & +$225 reward
  const distance = Math.round(1270 + (num - 1) * 95);
  const reward = Math.round(225 + (num - 1) * 35);
  const trafficRate = Math.min(1.8, 0.72 + (num - 1) * 0.011);
  const curveFactor = Math.min(1.35, 0.35 + (num - 1) * 0.01);

  return {
    num,
    name,
    distance,
    reward,
    theme,
    trafficRate,
    curveFactor,
  };
}

const SAVE_KEY = 'nitro_rush_3d_save_v2';

function createDefaultUpgrades(): Record<string, VehicleUpgrade> {
  const map: Record<string, VehicleUpgrade> = {};
  CAR_MODELS.forEach((c) => {
    map[c.id] = { speed: 1, accel: 1, handling: 1, nitro: 1 };
  });
  return map;
}

export function createInitialSaveState(): SaveState {
  return {
    cash: 600,
    selectedCarId: 'viper',
    unlockedCars: ['viper'],
    gameMode: 'levels',
    currentLevel: 1,
    highestUnlockedLevel: 1,
    bestScore: 0,
    bestFreeDistance: 0,
    playerName: `Racer${Math.floor(100 + Math.random() * 899)}`,
    customizations: {},
    upgrades: createDefaultUpgrades(),
  };
}

export function loadSave(): SaveState {
  const base = createInitialSaveState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      Object.assign(base, parsed);
      if (!base.customizations) base.customizations = {};
      if (!base.playerName) base.playerName = `Racer${Math.floor(100 + Math.random() * 899)}`;
      if (!Array.isArray(base.unlockedCars) || base.unlockedCars.length === 0) {
        base.unlockedCars = ['viper'];
      }
      if (!CAR_MODELS.some((c) => c.id === base.selectedCarId)) {
        base.selectedCarId = 'viper';
      }
      if (!base.upgrades) base.upgrades = createDefaultUpgrades();
      CAR_MODELS.forEach((c) => {
        if (!base.upgrades[c.id]) {
          base.upgrades[c.id] = { speed: 1, accel: 1, handling: 1, nitro: 1 };
        }
      });
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return base;
}

export function persistSave(save: SaveState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage errors
  }
}

export function getEffectiveCarSpec(save: SaveState, carId: string): CarSpec {
  const base = CAR_MODELS.find((c) => c.id === carId) || CAR_MODELS[0];
  const custom = save.customizations[base.id] || {};
  return {
    ...base,
    primaryColor: custom.primaryColor !== undefined ? custom.primaryColor : base.primaryColor,
    neonColor: custom.neonColor !== undefined ? custom.neonColor : base.neonColor,
    logoText: custom.emblemText || base.logoText,
    livery: custom.livery || 'twin',
    spoiler: custom.spoiler || 'gt',
  };
}

export function getCarStats(save: SaveState, carId: string) {
  const car = getEffectiveCarSpec(save, carId);
  const up = save.upgrades[car.id] || { speed: 1, accel: 1, handling: 1, nitro: 1 };
  return {
    car,
    up,
    topSpeedKmh: Math.round(car.baseSpeed + (up.speed - 1) * 18),
    accelMult: car.baseAccel + (up.accel - 1) * 0.12,
    handlingMult: car.baseHandling + (up.handling - 1) * 0.14,
    nitroMult: car.baseNitro + (up.nitro - 1) * 0.15,
  };
}

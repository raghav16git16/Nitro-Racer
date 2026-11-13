import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Flame,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { audio } from './game/audio';
import {
  ATMOSPHERE_THEMES,
  CAR_MODELS,
  CUSTOM_NEON_PALETTE,
  CUSTOM_PAINT_PALETTE,
  MAX_LEVELS,
  getCarStats,
  getEffectiveCarSpec,
  getLevelSpec,
  loadSave,
  persistSave,
} from './game/data';
import { MultiplayerClient } from './game/multiplayer';
import { NitroEngine } from './game/NitroEngine';
import type {
  GameMode,
  GameState,
  HudSnapshot,
  LiveryStyle,
  MultiplayerRoom,
  SaveState,
  SpoilerStyle,
  ToastMessage,
} from './game/types';

interface RaceResult {
  won: boolean;
  title: string;
  subtitle: string;
  runCash: number;
  distance: number;
  nearMissCount: number;
  knockdownCount: number;
  score: number;
}

const INITIAL_HUD: HudSnapshot = {
  kmh: 35,
  nitro: 45,
  isNitroActive: false,
  isWheelieActive: false,
  isDrifting: false,
  canWheelie: false,
  distance: 0,
  targetDistance: 1270,
  runCash: 0,
  score: 0,
  combo: 1,
  nearMissCount: 0,
  knockdownCount: 0,
  curveLabel: 'STRAIGHT',
  raceTime: 0,
  countdown: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NitroEngine | null>(null);
  const mpRef = useRef<MultiplayerClient | null>(null);
  const toastIdRef = useRef(1);

  const [save, setSave] = useState<SaveState>(() => loadSave());
  const saveRef = useRef<SaveState>(save);

  const [gameState, setGameState] = useState<GameState>('GARAGE');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [themeName, setThemeName] = useState(ATMOSPHERE_THEMES[0].name);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [mpRoom, setMpRoom] = useState<MultiplayerRoom | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = (text: string, colorClass = 'text-cyan-300') => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text, colorClass }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1300);
  };

  const commitSave = (updater: (prev: SaveState) => SaveState) => {
    setSave((prev) => {
      const next = updater(prev);
      saveRef.current = next;
      persistSave(next);
      engineRef.current?.setSaveState(next);
      return next;
    });
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const mp = new MultiplayerClient({
      onRoomUpdate: (room) => setMpRoom(room ? { ...room } : null),
      onAutoStartRace: () => {
        if (engineRef.current && engineRef.current.state === 'GARAGE' && saveRef.current.gameMode === 'multi') {
          setIsEditorOpen(false);
          setRaceResult(null);
          engineRef.current.startRace(true);
        }
      },
      onToast: pushToast,
    });
    mpRef.current = mp;

    const engine = new NitroEngine(container, saveRef.current, mp, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onToast: pushToast,
      onRaceFinish: (res) => setRaceResult(res),
      onSaveMutated: () => {
        const cloned: SaveState = { ...saveRef.current };
        saveRef.current = cloned;
        persistSave(cloned);
        setSave(cloned);
      },
      onStateChange: (nextState) => setGameState(nextState),
    });
    engineRef.current = engine;

    return () => {
      mp.stopPolling();
      engine.dispose();
      engineRef.current = null;
      mpRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const next = audio.toggleMute();
    setMuted(next);
  };

  const handleCycleAtmosphere = () => {
    const theme = engineRef.current?.cycleAtmosphere();
    if (theme) {
      setThemeName(theme.name);
      pushToast(`ATMOSPHERE: ${theme.name}`, 'text-cyan-300');
    }
  };

  const handleSelectCar = (carId: string) => {
    commitSave((prev) => ({ ...prev, selectedCarId: carId }));
    window.setTimeout(() => engineRef.current?.refreshPlayerCarMesh(), 0);
  };

  const handleSetMode = (mode: GameMode) => {
    commitSave((prev) => ({ ...prev, gameMode: mode }));
  };

  const handleChangeLevel = (delta: number) => {
    commitSave((prev) => ({
      ...prev,
      currentLevel: Math.max(1, Math.min(prev.highestUnlockedLevel, prev.currentLevel + delta)),
    }));
  };

  const handleBuyUpgrade = (key: 'speed' | 'accel' | 'handling' | 'nitro', cost: number) => {
    const carId = save.selectedCarId;
    const up = save.upgrades[carId];
    if (!up || up[key] >= 5 || save.cash < cost) return;
    audio.playCoin();
    commitSave((prev) => ({
      ...prev,
      cash: prev.cash - cost,
      upgrades: {
        ...prev.upgrades,
        [carId]: {
          ...prev.upgrades[carId],
          [key]: prev.upgrades[carId][key] + 1,
        },
      },
    }));
    pushToast(`UPGRADED ${key.toUpperCase()} TO LVL ${up[key] + 1}!`, 'text-emerald-300');
  };

  const handleMainCTA = () => {
    const stats = getCarStats(save, save.selectedCarId);
    const isUnlocked = save.unlockedCars.includes(stats.car.id);
    if (isUnlocked) {
      if (save.gameMode === 'multi') {
        if (!mpRef.current?.roomCode) {
          mpRef.current?.createRoom(saveRef.current);
          return;
        }
        if (!mpRef.current.isHost) {
          pushToast('WAITING FOR ROOM HOST TO LAUNCH RACE!', 'text-cyan-300');
          return;
        }
      }
      setIsEditorOpen(false);
      setRaceResult(null);
      engineRef.current?.startRace(false);
    } else if (save.cash >= stats.car.price) {
      audio.playCoin();
      commitSave((prev) => ({
        ...prev,
        cash: prev.cash - stats.car.price,
        unlockedCars: [...prev.unlockedCars, stats.car.id],
      }));
      pushToast(`UNLOCKED ${stats.car.name}!`, 'text-amber-300');
    }
  };

  const handleReturnToGarage = () => {
    setRaceResult(null);
    engineRef.current?.returnToGarage();
  };

  const handleRaceAgain = () => {
    setRaceResult(null);
    engineRef.current?.startRace(false);
  };

  // Customizer mutators
  const updateCustomization = (patch: Partial<SaveState['customizations'][string]>) => {
    const carId = save.selectedCarId;
    commitSave((prev) => ({
      ...prev,
      customizations: {
        ...prev.customizations,
        [carId]: {
          ...(prev.customizations[carId] || {}),
          ...patch,
        },
      },
    }));
    window.setTimeout(() => engineRef.current?.refreshPlayerCarMesh(), 0);
  };

  const resetCustomization = () => {
    const carId = save.selectedCarId;
    commitSave((prev) => {
      const nextCustom = { ...prev.customizations };
      delete nextCustom[carId];
      return { ...prev, customizations: nextCustom };
    });
    window.setTimeout(() => engineRef.current?.refreshPlayerCarMesh(), 0);
    pushToast('RESTORED FACTORY STOCK SPEC', 'text-cyan-300');
  };

  const isCountdownLocked = gameState === 'RACING' && hud.countdown !== null && hud.countdown !== 'GO!';

  const setControlInput = (key: keyof NitroEngine['input'], active: boolean) => {
    if (!engineRef.current) return;
    if (isCountdownLocked && active) return;
    engineRef.current.input[key] = active;
  };

  const activeLevel = getLevelSpec(save.currentLevel);
  const selectedStats = getCarStats(save, save.selectedCarId);
  const isSelectedUnlocked = save.unlockedCars.includes(selectedStats.car.id);
  const effectiveSpec = getEffectiveCarSpec(save, save.selectedCarId);

  const mpPlayers = mpRoom ? Object.values(mpRoom.players || {}) : [];
  const mpSorted = [...mpPlayers].sort((a, b) => (b.dist || 0) - (a.dist || 0));

  const progressPct =
    save.gameMode === 'free'
      ? 100
      : Math.min(100, (hud.distance / Math.max(1, hud.targetDistance)) * 100);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* Center Event Callouts / Toasts */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`callout-pop px-4 py-1.5 rounded-full bg-slate-950/90 border border-white/20 font-display font-black text-xs sm:text-sm tracking-wider shadow-xl ${t.colorClass}`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* ==================== GARAGE OVERLAY ==================== */}
      {gameState === 'GARAGE' && !isEditorOpen && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
          {/* Top Brand & Economy Strip */}
          <header className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto w-full pointer-events-auto">
            <div className="cyber-panel px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <Flame className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <h1 className="font-display font-black text-sm sm:text-lg tracking-wider text-white whitespace-nowrap">
                  NITRO RUSH 3D
                </h1>
                <p className="text-[11px] text-slate-400 whitespace-nowrap">
                  Highway Arcade Racer · Free Cash Garage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="cyber-panel px-3.5 py-2 rounded-xl flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">CASH</span>
                <span className="font-display font-black text-sm sm:text-base text-emerald-300 font-mono-num">
                  ${save.cash.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleCycleAtmosphere}
                title="Cycle Track Atmosphere"
                className="btn-3d btn-3d-slate px-3 py-2 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sun className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">{themeName}</span>
              </button>

              <button
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="btn-3d btn-3d-slate p-2.5 rounded-xl cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                )}
              </button>
            </div>
          </header>

          {/* Collapsible Bottom Garage Deck */}
          <div className="w-full max-w-6xl mx-auto flex flex-col items-center pointer-events-auto">
            <button
              onClick={() => setIsDockCollapsed((v) => !v)}
              className="cyber-panel px-4 py-1.5 rounded-t-xl border-b-0 text-[11px] font-display font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer hover:text-white transition"
            >
              {isDockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  SHOW GARAGE DECK
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  HIDE DECK (INSPECT 3D)
                </>
              )}
            </button>

            {!isDockCollapsed && (
              <div className="w-full cyber-panel rounded-2xl p-3.5 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 7 Cols: Mode Selector, Stage/Lobby Bar & Vehicle Roster */}
                <div className="lg:col-span-7 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 border border-white/15 rounded-xl p-1">
                      <button
                        onClick={() => handleSetMode('levels')}
                        className={`btn-3d ${
                          save.gameMode === 'levels' ? 'btn-3d-emerald' : 'btn-3d-slate'
                        } px-2.5 py-1.5 rounded-lg font-display font-bold text-[10px] sm:text-xs cursor-pointer whitespace-nowrap`}
                      >
                        100 LEVELS
                      </button>
                      <button
                        onClick={() => handleSetMode('free')}
                        className={`btn-3d ${
                          save.gameMode === 'free' ? 'btn-3d-cyan' : 'btn-3d-slate'
                        } px-2.5 py-1.5 rounded-lg font-display font-bold text-[10px] sm:text-xs cursor-pointer whitespace-nowrap`}
                      >
                        FREE CURVE
                      </button>
                      <button
                        onClick={() => handleSetMode('multi')}
                        className={`btn-3d ${
                          save.gameMode === 'multi' ? 'btn-3d-amber' : 'btn-3d-slate'
                        } px-2.5 py-1.5 rounded-lg font-display font-bold text-[10px] sm:text-xs cursor-pointer whitespace-nowrap`}
                      >
                        MULTIPLAYER
                      </button>
                      <button
                        onClick={() => setIsEditorOpen(true)}
                        className="btn-3d btn-3d-purple px-2.5 py-1.5 rounded-lg font-display font-bold text-[10px] sm:text-xs text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Palette className="w-3.5 h-3.5" />
                        CUSTOMIZE
                      </button>
                    </div>

                    <span className="text-[11px] font-bold text-amber-300 tracking-wider uppercase whitespace-nowrap">
                      {save.gameMode === 'levels'
                        ? 'CAMPAIGN · 100 STAGES'
                        : save.gameMode === 'free'
                          ? 'ENDLESS CURVING HIGHWAY'
                          : 'LIVE MULTIPLAYER SPRINT'}
                    </span>
                  </div>

                  {/* Mode Context Bar */}
                  {save.gameMode === 'levels' && (
                    <div className="mb-2.5 p-2 rounded-xl bg-slate-900/90 border border-emerald-400/35 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleChangeLevel(-5)}
                          disabled={activeLevel.num <= 1}
                          title="Back 5 Levels"
                          className="btn-3d btn-3d-slate px-2 py-1 rounded-lg font-display font-bold text-[10px] sm:text-xs disabled:opacity-40 cursor-pointer"
                        >
                          ◀◀
                        </button>
                        <button
                          onClick={() => handleChangeLevel(-1)}
                          disabled={activeLevel.num <= 1}
                          aria-label="Previous Level"
                          className="btn-3d btn-3d-slate px-2 py-1 rounded-lg font-display font-bold text-xs disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center flex-1 min-w-0">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-display font-black text-xs sm:text-sm text-emerald-300 truncate">
                            LEVEL {activeLevel.num}/{MAX_LEVELS} · {activeLevel.name}
                          </span>
                          {activeLevel.num < save.highestUnlockedLevel && (
                            <span className="text-[10px] font-bold text-emerald-300 shrink-0">
                              CLEARED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          Goal: {(activeLevel.distance / 1000).toFixed(2)} KM · Win Bonus: +$
                          {activeLevel.reward} Free Cash
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleChangeLevel(1)}
                          disabled={activeLevel.num >= save.highestUnlockedLevel}
                          aria-label="Next Level"
                          className="btn-3d btn-3d-slate px-2 py-1 rounded-lg font-display font-bold text-xs disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleChangeLevel(5)}
                          disabled={activeLevel.num >= save.highestUnlockedLevel}
                          title="Forward 5 Levels"
                          className="btn-3d btn-3d-slate px-2 py-1 rounded-lg font-display font-bold text-[10px] sm:text-xs disabled:opacity-40 cursor-pointer"
                        >
                          ▶▶
                        </button>
                      </div>
                    </div>
                  )}

                  {save.gameMode === 'free' && (
                    <div className="mb-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-400/35 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-display font-black text-xs sm:text-sm text-cyan-300">
                          ENDLESS CURVING HIGHWAY
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Infinite winding S-curves · No finish line · Survive & collect cash
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold text-amber-300/80">BEST RUN</div>
                        <div className="font-display font-black text-xs sm:text-sm text-amber-300 font-mono-num">
                          {(save.bestFreeDistance / 1000).toFixed(2)} KM
                        </div>
                      </div>
                    </div>
                  )}

                  {save.gameMode === 'multi' && (
                    <div className="mb-2.5 p-2.5 rounded-xl bg-slate-900/95 border border-cyan-400/40 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-display font-bold text-cyan-300">
                            DRIVER:
                          </span>
                          <input
                            type="text"
                            maxLength={12}
                            value={save.playerName}
                            onChange={(e) =>
                              commitSave((prev) => ({
                                ...prev,
                                playerName: e.target.value.slice(0, 12),
                              }))
                            }
                            placeholder="Racer"
                            className="w-24 sm:w-28 px-2 py-1 rounded-lg bg-slate-950/90 border border-white/20 text-xs font-display font-bold text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        {!mpRoom ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => mpRef.current?.createRoom(saveRef.current)}
                              className="btn-3d btn-3d-emerald px-2.5 py-1 rounded-lg font-display font-bold text-[10px] sm:text-xs cursor-pointer whitespace-nowrap"
                            >
                              + CREATE ROOM
                            </button>
                            <input
                              type="text"
                              maxLength={4}
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                              placeholder="CODE"
                              className="w-16 px-2 py-1 rounded-lg bg-slate-950/90 border border-cyan-400/40 text-center font-display font-black text-xs uppercase text-cyan-300 focus:outline-none"
                            />
                            <button
                              onClick={() => mpRef.current?.joinRoom(joinCode, saveRef.current)}
                              className="btn-3d btn-3d-cyan px-2.5 py-1 rounded-lg font-display font-bold text-[10px] sm:text-xs cursor-pointer"
                            >
                              JOIN
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-400/50 flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">ROOM:</span>
                              <span className="font-display font-black text-xs sm:text-sm text-amber-300 tracking-widest">
                                {mpRoom.code}
                              </span>
                              <button
                                onClick={() => mpRef.current?.copyRoomCode()}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                COPY
                              </button>
                            </div>
                            <button
                              onClick={() => mpRef.current?.leaveRoom()}
                              className="btn-3d btn-3d-slate px-2 py-1 rounded-lg font-display font-bold text-[10px] text-rose-300 cursor-pointer"
                            >
                              LEAVE
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-white/10">
                        <span className="text-slate-300 truncate">
                          {mpRoom
                            ? `${
                                mpRef.current?.isHost
                                  ? 'Host Ready'
                                  : 'Waiting for Host to press START RACE'
                              } · Racers: ${mpPlayers
                                .map((p) => `${p.name}${p.uid === mpRoom.hostId ? ' (Host)' : ''}`)
                                .join(' · ')}`
                            : 'Create a room or enter a 4-character friend code to race live!'}
                        </span>
                        <span className="font-display font-bold text-cyan-300 shrink-0 ml-2">
                          {mpPlayers.length} RACER{mpPlayers.length === 1 ? '' : 'S'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Vehicle Roster Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[24vh] pr-1 garage-scroll">
                    {CAR_MODELS.map((car) => {
                      const eff = getEffectiveCarSpec(save, car.id);
                      const isUnlocked = save.unlockedCars.includes(car.id);
                      const isSelected = save.selectedCarId === car.id;
                      const hexColor = `#${eff.primaryColor.toString(16).padStart(6, '0')}`;
                      return (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => handleSelectCar(car.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/10'
                              : 'bg-slate-900/75 border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full inline-block border border-white/40 shrink-0"
                                style={{ background: hexColor }}
                              />
                              <span className="font-display font-bold text-xs text-white truncate">
                                {car.name}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                isUnlocked ? 'text-emerald-300' : 'text-amber-300'
                              }`}
                            >
                              {isUnlocked
                                ? isSelected
                                  ? 'EQUIPPED'
                                  : 'OWNED'
                                : `$${car.price.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1 flex items-center justify-between w-full">
                            <span>
                              {car.type === 'bike' ? 'BIKE' : 'CAR'} · {car.classTag}
                            </span>
                            <span className="text-cyan-300/90">{car.perk}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right 5 Cols: Selected Stats, Upgrades & Launch CTA */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-3 border-t lg:border-t-0 lg:border-l border-white/10 pt-3 lg:pt-0 lg:pl-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <h2 className="font-display font-black text-base sm:text-lg text-white">
                        {selectedStats.car.name}
                      </h2>
                      <span className="text-[11px] font-semibold text-cyan-300">
                        {selectedStats.car.classTag} · {selectedStats.car.perk}
                      </span>
                    </div>

                    {/* 4 Stat Bars */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
                      <StatBar
                        label="TOP SPEED"
                        valueText={`${selectedStats.topSpeedKmh} KM/H`}
                        pct={Math.min(100, (selectedStats.topSpeedKmh / 480) * 100)}
                        barClass="bg-cyan-400"
                      />
                      <StatBar
                        label="ACCEL"
                        valueText={`${Math.min(100, Math.round((selectedStats.accelMult / 2.2) * 100))}%`}
                        pct={Math.min(100, Math.round((selectedStats.accelMult / 2.2) * 100))}
                        barClass="bg-emerald-400"
                      />
                      <StatBar
                        label="HANDLING"
                        valueText={`${Math.min(100, Math.round((selectedStats.handlingMult / 2.2) * 100))}%`}
                        pct={Math.min(100, Math.round((selectedStats.handlingMult / 2.2) * 100))}
                        barClass="bg-amber-400"
                      />
                      <StatBar
                        label="NITRO"
                        valueText={`${Math.min(100, Math.round((selectedStats.nitroMult / 2.3) * 100))}%`}
                        pct={Math.min(100, Math.round((selectedStats.nitroMult / 2.3) * 100))}
                        barClass="bg-fuchsia-400"
                      />
                    </div>

                    {/* 4 Upgrade Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: 'speed', label: 'TOP SPEED' },
                          { key: 'accel', label: 'ENGINE' },
                          { key: 'handling', label: 'DRIFT TIRES' },
                          { key: 'nitro', label: 'NITRO TANK' },
                        ] as const
                      ).map((u) => {
                        const curLvl = selectedStats.up[u.key];
                        const isMax = curLvl >= 5;
                        const cost = curLvl * 350;
                        const canAfford = isSelectedUnlocked && !isMax && save.cash >= cost;
                        return (
                          <button
                            key={u.key}
                            disabled={!canAfford}
                            onClick={() => handleBuyUpgrade(u.key, cost)}
                            className={`p-2 rounded-xl border text-left transition flex items-center justify-between ${
                              !isSelectedUnlocked
                                ? 'bg-slate-900/40 border-white/5 opacity-45 cursor-not-allowed'
                                : isMax
                                  ? 'bg-emerald-500/15 border-emerald-400/30 cursor-default'
                                  : canAfford
                                    ? 'bg-slate-800/90 hover:bg-slate-700/90 border-cyan-400/40 cursor-pointer active:scale-95'
                                    : 'bg-slate-900/60 border-white/10 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <div>
                              <div className="text-[10px] font-bold text-slate-300">{u.label}</div>
                              <div className="text-[11px] font-display font-bold text-cyan-300">
                                LVL {curLvl}/5
                              </div>
                            </div>
                            <span
                              className={`text-xs font-display font-bold font-mono-num ${
                                isMax ? 'text-emerald-300' : 'text-amber-300'
                              }`}
                            >
                              {isMax ? 'MAX' : `$${cost}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Action CTA */}
                  <button
                    onClick={handleMainCTA}
                    disabled={!isSelectedUnlocked && save.cash < selectedStats.car.price}
                    className={`btn-3d w-full py-3 rounded-xl font-display font-black text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                      isSelectedUnlocked
                        ? save.gameMode === 'multi'
                          ? !mpRoom
                            ? 'btn-3d-amber'
                            : mpRef.current?.isHost
                              ? 'btn-3d-emerald'
                              : 'btn-3d-cyan'
                          : 'btn-3d-cyan'
                        : save.cash >= selectedStats.car.price
                          ? 'btn-3d-amber'
                          : 'btn-3d-slate'
                    }`}
                  >
                    {isSelectedUnlocked
                      ? save.gameMode === 'multi'
                        ? !mpRoom
                          ? 'CREATE / JOIN ROOM FIRST'
                          : mpRef.current?.isHost
                            ? `START ROOM ${mpRoom.code} RACE`
                            : `READY IN ROOM ${mpRoom.code}`
                        : save.gameMode === 'levels'
                          ? `RACE LEVEL ${activeLevel.num}`
                          : 'RACE FREE CURVE'
                      : save.cash >= selectedStats.car.price
                        ? `UNLOCK ${selectedStats.car.name} ($${selectedStats.car.price.toLocaleString()})`
                        : `NEED $${selectedStats.car.price.toLocaleString()} FREE CASH`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 3D VEHICLE CUSTOMIZER / EDITOR OVERLAY ==================== */}
      {gameState === 'GARAGE' && isEditorOpen && (
        <div className="fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-6 pointer-events-none">
          <div className="flex items-center justify-between max-w-6xl mx-auto w-full pointer-events-auto">
            <div className="cyber-panel px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <Palette className="w-5 h-5 text-fuchsia-400" />
              <div>
                <h2 className="font-display font-black text-sm sm:text-lg text-white tracking-wider">
                  3D CUSTOM SHOP
                </h2>
                <p className="text-[11px] text-cyan-300 font-semibold">
                  {effectiveSpec.name} · Free Livery & Aero Studio
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditorOpen(false)}
              className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl font-display font-black text-xs sm:text-sm tracking-wider cursor-pointer"
            >
              SAVE & GARAGE
            </button>
          </div>

          <div className="w-full max-w-5xl mx-auto cyber-panel rounded-2xl p-4 sm:p-5 pointer-events-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Body Paint & Neon */}
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    BODY PAINT FINISH (FREE)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_PAINT_PALETTE.map((p) => {
                      const active = effectiveSpec.primaryColor === p.hex;
                      return (
                        <button
                          key={p.name}
                          onClick={() => updateCustomization({ primaryColor: p.hex })}
                          title={p.name}
                          style={{ background: p.css }}
                          className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                            active
                              ? 'border-white scale-110 ring-2 ring-cyan-400'
                              : 'border-white/30 opacity-85 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    NEON TRIM & UNDERGLOW
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_NEON_PALETTE.map((p) => {
                      const active = effectiveSpec.neonColor === p.hex;
                      return (
                        <button
                          key={p.name}
                          onClick={() => updateCustomization({ neonColor: p.hex })}
                          title={p.name}
                          style={{ background: p.css }}
                          className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                            active
                              ? 'border-white scale-110 ring-2 ring-amber-300'
                              : 'border-white/30 opacity-85 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Emblem Tag & Livery */}
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    CUSTOM EMBLEM TAG (3 CHARS)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={3}
                      value={save.customizations[save.selectedCarId]?.emblemText ?? effectiveSpec.logoText}
                      onChange={(e) => {
                        const cleaned = e.target.value
                          .replace(/[^a-zA-Z0-9]/g, '')
                          .toUpperCase()
                          .slice(0, 3);
                        updateCustomization({ emblemText: cleaned || undefined });
                      }}
                      placeholder={selectedStats.car.logoText}
                      className="w-24 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-400/50 font-display font-black text-sm uppercase text-center text-white focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400">
                      Appears on 3D hood & tank crest
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    RACING LIVERY PATTERN
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'twin', label: 'TWIN STRIPE' },
                        { id: 'center', label: 'APEX CENTER' },
                        { id: 'clean', label: 'STEALTH' },
                      ] as Array<{ id: LiveryStyle; label: string }>
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => updateCustomization({ livery: item.id })}
                        className={`btn-3d ${
                          effectiveSpec.livery === item.id ? 'btn-3d-cyan' : 'btn-3d-slate'
                        } py-1.5 rounded-lg font-display font-bold text-[10px] cursor-pointer`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aero Wing & Reset */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    AERO SPOILER / TAIL KIT
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'gt', label: 'GT WING' },
                        { id: 'hyper', label: 'DUAL HYPER' },
                        { id: 'none', label: 'SLEEK' },
                      ] as Array<{ id: SpoilerStyle; label: string }>
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => updateCustomization({ spoiler: item.id })}
                        className={`btn-3d ${
                          effectiveSpec.spoiler === item.id ? 'btn-3d-cyan' : 'btn-3d-slate'
                        } py-1.5 rounded-lg font-display font-bold text-[10px] cursor-pointer`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    100% Free Customization
                  </span>
                  <button
                    onClick={resetCustomization}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-display font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    RESET STOCK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== IN-GAME RACING HUD OVERLAY ==================== */}
      {gameState === 'RACING' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
          {/* Top HUD Bar */}
          <div className="w-full max-w-6xl mx-auto flex flex-col gap-2">
            <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center pointer-events-auto">
              {/* Speed & Nitro */}
              <div className="col-span-5 sm:col-span-4 cyber-panel px-3 py-2 rounded-2xl">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-display font-black text-xl sm:text-3xl text-white font-mono-num">
                    {hud.kmh}
                    <span className="text-[10px] sm:text-xs text-cyan-300 ml-1">KM/H</span>
                  </div>
                  <span
                    className={`text-[10px] font-display font-bold ${
                      hud.isWheelieActive
                        ? 'text-amber-300'
                        : hud.canWheelie
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {hud.isWheelieActive
                      ? 'WHEELIE!'
                      : hud.canWheelie
                        ? 'WHEELIE READY'
                        : `NITRO ${Math.round(hud.nitro)}%`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mt-1.5 border border-white/10">
                  <div
                    className={`h-full transition-all duration-75 ${
                      hud.isNitroActive ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, hud.nitro))}%` }}
                  />
                </div>
              </div>

              {/* Stage Progress / Free Curve Indicator */}
              <div className="col-span-7 sm:col-span-4 cyber-panel px-3 py-2 rounded-2xl">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-display font-black text-[11px] sm:text-xs whitespace-nowrap ${
                      save.gameMode === 'levels'
                        ? 'text-emerald-300'
                        : save.gameMode === 'multi'
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                    }`}
                  >
                    {save.gameMode === 'levels'
                      ? `LVL ${activeLevel.num}/${MAX_LEVELS}`
                      : save.gameMode === 'multi'
                        ? 'MULTI SPRINT'
                        : 'FREE CURVE'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-200 font-mono-num whitespace-nowrap">
                    {save.gameMode === 'free'
                      ? `${(hud.distance / 1000).toFixed(2)} KM · ${hud.curveLabel}`
                      : `${(hud.distance / 1000).toFixed(2)} / ${(hud.targetDistance / 1000).toFixed(2)} KM`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mt-1.5 border border-white/10">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-100"
                    style={{ width: `${progressPct.toFixed(1)}%` }}
                  />
                </div>
              </div>

              {/* Score, Cash & Quick Actions */}
              <div className="col-span-12 sm:col-span-4 cyber-panel px-3 py-2 rounded-2xl flex items-center justify-between gap-2">
                <div>
                  <div className="font-display font-black text-base sm:text-xl text-white font-mono-num">
                    {hud.score.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-amber-300 font-mono-num">
                    {hud.combo.toFixed(1)}x COMBO · +${hud.runCash}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleMute}
                    aria-label="Toggle Mute"
                    className="btn-3d btn-3d-slate p-2 rounded-xl cursor-pointer"
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-300" />
                    )}
                  </button>
                  <button
                    onClick={handleReturnToGarage}
                    className="btn-3d btn-3d-slate px-2.5 py-2 rounded-xl font-display font-bold text-[10px] cursor-pointer"
                  >
                    GARAGE
                  </button>
                </div>
              </div>
            </div>

            {/* Live Multiplayer Standings Strip */}
            {save.gameMode === 'multi' && mpRoom && (
              <div className="cyber-panel px-3 py-1.5 rounded-xl border border-cyan-400/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-display font-bold">
                <span className="text-cyan-300">
                  LIVE RACE ROOM <span className="text-amber-300">{mpRoom.code}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-white">
                  {mpSorted.map((r, idx) => {
                    const isMe = r.uid === mpRef.current?.userId;
                    const km = ((r.dist || 0) / 1000).toFixed(2);
                    return (
                      <span
                        key={r.uid}
                        className={`px-2 py-0.5 rounded font-mono-num ${
                          isMe
                            ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        #{idx + 1} {r.name} ({km}km{r.finished ? ' FIN' : ''})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3-2-1-GO! Animated Race Start Countdown Overlay */}
          {hud.countdown !== null && (
            <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div
                key={hud.countdown}
                className="countdown-pop flex flex-col items-center justify-center text-center"
              >
                <div
                  className={`px-10 py-6 rounded-3xl border-2 shadow-2xl ${
                    hud.countdown === 'GO!'
                      ? 'bg-emerald-950/90 border-emerald-400 shadow-emerald-500/30'
                      : 'bg-slate-950/90 border-amber-400/80 shadow-amber-500/20'
                  }`}
                >
                  <div
                    className={`font-display font-black tracking-wider leading-none ${
                      hud.countdown === 'GO!'
                        ? 'text-6xl sm:text-8xl text-emerald-300'
                        : 'text-7xl sm:text-9xl text-amber-300 font-mono-num'
                    }`}
                  >
                    {hud.countdown}
                  </div>
                  <div
                    className={`mt-2 font-display font-bold text-xs sm:text-sm tracking-widest uppercase ${
                      hud.countdown === 'GO!' ? 'text-cyan-200' : 'text-slate-300'
                    }`}
                  >
                    {hud.countdown === 'GO!' ? 'FULL THROTTLE' : 'GET READY · CONTROLS LOCKED'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Interactive Driving Controls */}
          <div
            className={`w-full max-w-6xl mx-auto flex items-end justify-between gap-3 transition-opacity duration-150 ${
              isCountdownLocked ? 'pointer-events-none opacity-45' : 'pointer-events-auto'
            }`}
          >
            {/* Left/Right Steer Pad */}
            <div className="flex items-center gap-2">
              <button
                onPointerDown={() => setControlInput('left', true)}
                onPointerUp={() => setControlInput('left', false)}
                onPointerLeave={() => setControlInput('left', false)}
                onPointerCancel={() => setControlInput('left', false)}
                aria-label="Steer Left"
                className="btn-3d btn-3d-slate w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-7 h-7 text-cyan-300" />
              </button>
              <button
                onPointerDown={() => setControlInput('right', true)}
                onPointerUp={() => setControlInput('right', false)}
                onPointerLeave={() => setControlInput('right', false)}
                onPointerCancel={() => setControlInput('right', false)}
                aria-label="Steer Right"
                className="btn-3d btn-3d-slate w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronRight className="w-7 h-7 text-cyan-300" />
              </button>
            </div>

            {/* Subtle Desktop Key Legend */}
            <div className="hidden md:flex cyber-panel-subtle px-3.5 py-1.5 rounded-xl text-[11px] text-slate-300 gap-3">
              <span>A / D Steer</span>
              <span>·</span>
              <span>W / S Speed</span>
              <span>·</span>
              <span>SPACE Nitro</span>
              <span>·</span>
              <span>E Wheelie (60%+ Nitro)</span>
            </div>

            {/* Action Pedals: Brake, Wheelie, Nitro */}
            <div className="flex items-center gap-2">
              <button
                onPointerDown={() => setControlInput('down', true)}
                onPointerUp={() => setControlInput('down', false)}
                onPointerLeave={() => setControlInput('down', false)}
                onPointerCancel={() => setControlInput('down', false)}
                className="btn-3d btn-3d-slate px-3.5 h-14 sm:h-16 rounded-2xl font-display font-bold text-xs cursor-pointer"
              >
                BRAKE
              </button>
              <button
                onPointerDown={() => setControlInput('wheelie', true)}
                onPointerUp={() => setControlInput('wheelie', false)}
                onPointerLeave={() => setControlInput('wheelie', false)}
                onPointerCancel={() => setControlInput('wheelie', false)}
                className={`btn-3d ${
                  hud.canWheelie ? 'btn-3d-amber' : 'btn-3d-slate opacity-75'
                } px-3.5 h-14 sm:h-16 rounded-2xl font-display font-black text-xs cursor-pointer`}
              >
                WHEELIE
              </button>
              <button
                onPointerDown={() => setControlInput('nitro', true)}
                onPointerUp={() => setControlInput('nitro', false)}
                onPointerLeave={() => setControlInput('nitro', false)}
                onPointerCancel={() => setControlInput('nitro', false)}
                className="btn-3d btn-3d-cyan px-4 sm:px-5 h-14 sm:h-16 rounded-2xl font-display font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                NITRO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GAME OVER / LEVEL COMPLETE MODAL ==================== */}
      {gameState === 'GAMEOVER' && raceResult && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/65">
          <div className="cyber-panel w-full max-w-lg rounded-3xl p-6 text-center space-y-5">
            <div className="flex flex-col items-center gap-2">
              <Trophy
                className={`w-10 h-10 ${
                  raceResult.won ? 'text-emerald-300' : 'text-amber-400'
                }`}
              />
              <h2
                className={`font-display font-black text-2xl sm:text-3xl tracking-wide ${
                  raceResult.won ? 'text-emerald-300' : 'text-rose-400'
                }`}
              >
                {raceResult.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">{raceResult.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
              <ResultMetric
                label="FREE CASH"
                value={`+$${raceResult.runCash.toLocaleString()}`}
                valueClass="text-emerald-300"
              />
              <ResultMetric
                label="DISTANCE"
                value={`${(raceResult.distance / 1000).toFixed(2)} KM`}
                valueClass="text-cyan-300"
              />
              <ResultMetric
                label="SCORE"
                value={raceResult.score.toLocaleString()}
                valueClass="text-white"
              />
              <ResultMetric
                label="NEAR MISSES"
                value={String(raceResult.nearMissCount)}
                valueClass="text-amber-300"
              />
              <ResultMetric
                label="KNOCKDOWNS"
                value={String(raceResult.knockdownCount)}
                valueClass="text-fuchsia-300"
              />
              <ResultMetric
                label="BANK TOTAL"
                value={`$${save.cash.toLocaleString()}`}
                valueClass="text-emerald-200"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={handleRaceAgain}
                className="btn-3d btn-3d-emerald flex-1 py-3 rounded-xl font-display font-black text-xs sm:text-sm tracking-wider cursor-pointer"
              >
                RACE AGAIN
              </button>
              <button
                onClick={handleReturnToGarage}
                className="btn-3d btn-3d-cyan flex-1 py-3 rounded-xl font-display font-black text-xs sm:text-sm tracking-wider cursor-pointer"
              >
                GARAGE & UPGRADES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({
  label,
  valueText,
  pct,
  barClass,
}: {
  label: string;
  valueText: string;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 mb-1">
        <span>{label}</span>
        <span className="font-mono-num text-white">{valueText}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
        <div
          className={`h-full ${barClass} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/85 border border-white/10">
      <div className="text-[10px] font-bold text-slate-400">{label}</div>
      <div className={`font-display font-black text-base font-mono-num mt-0.5 ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

import { getEffectiveCarSpec } from './data';
import type { MultiplayerPlayer, MultiplayerRoom, SaveState } from './types';

function getOrCreateUserId(): string {
  try {
    const existing = sessionStorage.getItem('nitro_mp_uid');
    if (existing) return existing;
    const created = `racer_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('nitro_mp_uid', created);
    return created;
  } catch {
    return `racer_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class MultiplayerClient {
  public userId = getOrCreateUserId();
  public roomCode: string | null = null;
  public isHost = false;
  public roomData: MultiplayerRoom | null = null;
  public readonly raceDistance = 3600;

  private pollTimer: number | null = null;
  private lastSyncTime = 0;
  private onRoomUpdate: (room: MultiplayerRoom | null) => void;
  private onAutoStartRace: () => void;
  private onToast: (text: string, colorClass?: string) => void;

  constructor(callbacks: {
    onRoomUpdate: (room: MultiplayerRoom | null) => void;
    onAutoStartRace: () => void;
    onToast: (text: string, colorClass?: string) => void;
  }) {
    this.onRoomUpdate = callbacks.onRoomUpdate;
    this.onAutoStartRace = callbacks.onAutoStartRace;
    this.onToast = callbacks.onToast;
  }

  private buildPlayerPayload(save: SaveState): MultiplayerPlayer {
    const spec = getEffectiveCarSpec(save, save.selectedCarId);
    return {
      uid: this.userId,
      name: save.playerName || 'Racer',
      carId: spec.id,
      primaryColor: spec.primaryColor,
      neonColor: spec.neonColor,
      logoText: spec.logoText,
      livery: spec.livery || 'twin',
      spoiler: spec.spoiler || 'gt',
      x: 0,
      dist: 0,
      kmh: 30,
      finished: false,
      finishTime: 0,
      updatedAt: Date.now(),
    };
  }

  public async createRoom(save: SaveState): Promise<void> {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: this.buildPlayerPayload(save),
          raceDistance: this.raceDistance,
        }),
      });
      if (!res.ok) throw new Error('Room creation failed');
      const room = (await res.json()) as MultiplayerRoom;
      this.roomCode = room.code;
      this.roomData = room;
      this.isHost = room.hostId === this.userId;
      this.startPolling();
      this.onRoomUpdate(room);
      this.onToast(`ROOM ${room.code} CREATED! SHARE CODE WITH FRIENDS`, 'text-emerald-300');
    } catch {
      this.onToast('COULD NOT REACH MULTIPLAYER SERVER', 'text-rose-300');
    }
  }

  public async joinRoom(codeInput: string, save: SaveState): Promise<void> {
    const code = (codeInput || '').trim().toUpperCase();
    if (code.length < 4) {
      this.onToast('ENTER A 4-CHARACTER ROOM CODE', 'text-amber-300');
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: this.buildPlayerPayload(save) }),
      });
      if (!res.ok) {
        this.onToast(`ROOM ${code} NOT FOUND`, 'text-rose-300');
        return;
      }
      const room = (await res.json()) as MultiplayerRoom;
      this.roomCode = room.code;
      this.roomData = room;
      this.isHost = room.hostId === this.userId;
      this.startPolling();
      this.onRoomUpdate(room);
      this.onToast(`JOINED ROOM ${room.code}!`, 'text-cyan-300');
    } catch {
      this.onToast('COULD NOT JOIN ROOM', 'text-rose-300');
    }
  }

  public async triggerRoomRaceStart(): Promise<void> {
    if (!this.roomCode) return;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(this.roomCode)}/start`, {
        method: 'POST',
      });
      if (res.ok) {
        const room = (await res.json()) as MultiplayerRoom;
        this.roomData = room;
        this.onRoomUpdate(room);
      }
    } catch {
      // Ignore transient error
    }
  }

  public async resetRoomToLobby(): Promise<void> {
    if (!this.roomCode || !this.isHost) return;
    try {
      await fetch(`/api/rooms/${encodeURIComponent(this.roomCode)}/reset`, {
        method: 'POST',
      });
    } catch {
      // Ignore
    }
  }

  public async syncPlayerTelemetry(
    save: SaveState,
    x: number,
    dist: number,
    kmh: number,
    finished = false,
    finishTime = 0
  ): Promise<void> {
    if (!this.roomCode) return;
    const now = Date.now();
    if (!finished && now - this.lastSyncTime < 150) return;
    this.lastSyncTime = now;

    const spec = getEffectiveCarSpec(save, save.selectedCarId);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(this.roomCode)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this.userId,
          x: Number(x.toFixed(2)),
          dist: Number(dist.toFixed(1)),
          kmh: Math.round(kmh),
          finished,
          finishTime,
          carId: spec.id,
          primaryColor: spec.primaryColor,
          neonColor: spec.neonColor,
          logoText: spec.logoText,
          livery: spec.livery || 'twin',
          spoiler: spec.spoiler || 'gt',
        }),
      });
      if (res.ok) {
        const room = (await res.json()) as MultiplayerRoom;
        this.roomData = room;
        this.isHost = room.hostId === this.userId;
        this.onRoomUpdate(room);
      }
    } catch {
      // Ignore transient network hiccups
    }
  }

  public copyRoomCode(): void {
    if (!this.roomCode) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(this.roomCode)
        .then(() => this.onToast(`COPIED CODE: ${this.roomCode}`, 'text-cyan-300'))
        .catch(() => this.onToast(`ROOM CODE: ${this.roomCode}`, 'text-cyan-300'));
    } else {
      this.onToast(`ROOM CODE: ${this.roomCode}`, 'text-cyan-300');
    }
  }

  public async leaveRoom(silent = false): Promise<void> {
    const code = this.roomCode;
    this.stopPolling();
    this.roomCode = null;
    this.roomData = null;
    this.isHost = false;
    this.onRoomUpdate(null);

    if (code) {
      try {
        await fetch(`/api/rooms/${encodeURIComponent(code)}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: this.userId }),
        });
      } catch {
        // Ignore
      }
    }
    if (!silent) {
      this.onToast('LEFT MULTIPLAYER ROOM', 'text-slate-300');
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const poll = async () => {
      if (!this.roomCode) return;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(this.roomCode)}`);
        if (!res.ok) {
          await this.leaveRoom(true);
          return;
        }
        const room = (await res.json()) as MultiplayerRoom;
        const prevStatus = this.roomData?.status;
        this.roomData = room;
        this.isHost = room.hostId === this.userId;
        this.onRoomUpdate(room);
        if (room.status === 'RACING' && prevStatus !== 'RACING') {
          this.onAutoStartRace();
        }
      } catch {
        // Ignore polling hiccup
      }
      if (this.roomCode) {
        this.pollTimer = window.setTimeout(poll, 350);
      }
    };
    this.pollTimer = window.setTimeout(poll, 350);
  }

  public stopPolling(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

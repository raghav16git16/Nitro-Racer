import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audio } from './audio';
import {
  ATMOSPHERE_THEMES,
  CAR_MODELS,
  getCarStats,
  getEffectiveCarSpec,
  getLevelSpec,
} from './data';
import {
  createFinishLineMesh,
  createFloatingNameTag,
  createHypercarMesh,
  createMotorbikeMesh,
  createRoadTexture,
  createTrafficVehicleMesh,
} from './meshes';
import type { MultiplayerClient } from './multiplayer';
import type {
  AtmosphereTheme,
  GameState,
  HudSnapshot,
  MultiplayerPlayer,
  SaveState,
} from './types';

interface TrafficEntity {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  isTruck: boolean;
  nearMissed: boolean;
  knockedOut: boolean;
  vy: number;
  vx: number;
  rotSpeed: number;
}

interface PickupEntity {
  mesh: THREE.Group;
  x: number;
  z: number;
  type: 'cash' | 'nitro';
}

interface ParticleEntity {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface RivalEntity {
  mesh: THREE.Group;
  currentX: number;
  currentRelZ: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onToast: (text: string, colorClass?: string) => void;
  onRaceFinish: (result: {
    won: boolean;
    title: string;
    subtitle: string;
    runCash: number;
    distance: number;
    nearMissCount: number;
    knockdownCount: number;
    score: number;
  }) => void;
  onSaveMutated: () => void;
  onStateChange: (state: GameState) => void;
}

const ROAD_WIDTH = 16;
const LANE_CENTERS = [-5.4, -1.8, 1.8, 5.4];
const SEGMENT_COUNT = 26;
const SEGMENT_LENGTH = 12;

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class NitroEngine {
  private container: HTMLElement;
  private save: SaveState;
  private multiplayer: MultiplayerClient;
  private callbacks: EngineCallbacks;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private maxAnisotropy = 4;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private sunMesh: THREE.Mesh;

  private roadSegments: THREE.Mesh[] = [];
  private roadTexture: THREE.CanvasTexture;
  private sideGantries: THREE.Group[] = [];
  private skylineTowers: THREE.Mesh[] = [];
  private carPreviewGroup: THREE.Group;
  private playerCarMesh: THREE.Group | null = null;
  private finishLineMesh: THREE.Group | null = null;

  private trafficList: TrafficEntity[] = [];
  private pickupList: PickupEntity[] = [];
  private particleList: ParticleEntity[] = [];
  private rivals: Record<string, RivalEntity> = {};

  // Shared particle geometry/materials for zero-allocation spawns
  private particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  private nitroMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  private fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  private smokeMat = new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.65,
  });

  // Reusable scratch vector
  private _camLook = new THREE.Vector3();

  public state: GameState = 'GARAGE';
  public themeIndex = 0;

  // Race state
  private playerX = 0;
  private playerVx = 0;
  private speed = 35 / 3.6;
  private nitro = 45;
  private isNitroActive = false;
  private isWheelieActive = false;
  private wheelieAngle = 0;
  private wheelieCashBuffer = 0;
  private isDrifting = false;
  private distance = 0;
  private raceTime = 0;
  private runCash = 0;
  private score = 0;
  private combo = 1.0;
  private comboTimer = 0;
  private countdownRemaining = 0;
  private goBannerTimer = 0;
  private lastCountdownDigit = 0;
  private nearMissCount = 0;
  private knockdownCount = 0;
  private lastSpawnDist = 20;
  private levelTargetDist = 1270;
  private curveAmount = 0;
  private curveTarget = 0;
  private curveTimer = 0;
  private hudSyncAccum = 0;

  // Input flags
  public input = {
    left: false,
    right: false,
    up: false,
    down: false,
    nitro: false,
    wheelie: false,
  };

  private frameId = 0;
  private lastTime = performance.now();
  private disposed = false;

  constructor(
    container: HTMLElement,
    save: SaveState,
    multiplayer: MultiplayerClient,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.save = save;
    this.multiplayer = multiplayer;
    this.callbacks = callbacks;

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 420);
    this.camera.position.set(0, 3.2, 7.6);

    // 3-point warm/cool lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x67e8f9, 0x0f172a, 0.95);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1e0, 1.55);
    this.keyLight.position.set(16, 28, 18);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.left = -22;
      this.keyLight.shadow.camera.right = 22;
      this.keyLight.shadow.camera.top = 22;
      this.keyLight.shadow.camera.bottom = -22;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-14, 10, -24);
    this.scene.add(rimLight);

    // Horizon Sun Disc
    this.sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(36, 32),
      new THREE.MeshBasicMaterial({ color: 0xff007f, fog: false })
    );
    this.sunMesh.position.set(0, 26, -240);
    this.scene.add(this.sunMesh);

    // Road segments + Neon Gantries + Skyline
    this.roadTexture = createRoadTexture(0x00e5ff, this.maxAnisotropy);
    this.buildEnvironment();

    // Player Car Preview Group
    this.carPreviewGroup = new THREE.Group();
    this.scene.add(this.carPreviewGroup);
    this.refreshPlayerCarMesh();

    this.applyTheme(ATMOSPHERE_THEMES[0]);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    this.lastTime = performance.now();
    this.tick();
  }

  private buildEnvironment(): void {
    // Ground plane outside road
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({
        color: 0x050914,
        roughness: 0.92,
        metalness: 0.1,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.04, -120);
    this.scene.add(ground);

    const segGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
    const segMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.48,
      metalness: 0.22,
    });

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = new THREE.Mesh(segGeo, segMat);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(0, 0, -i * SEGMENT_LENGTH + 18);
      seg.receiveShadow = true;
      this.scene.add(seg);
      this.roadSegments.push(seg);

      // Every 3rd segment gets neon roadside light arch pillars
      if (i % 3 === 0) {
        const gantry = new THREE.Group();
        const postGeo = new THREE.BoxGeometry(0.32, 4.6, 0.32);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.7,
          roughness: 0.3,
        });
        const stripMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-ROAD_WIDTH / 2 - 0.65, 2.3, 0);
        const postR = new THREE.Mesh(postGeo, postMat);
        postR.position.set(ROAD_WIDTH / 2 + 0.65, 2.3, 0);

        const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.8, 0.36), stripMat);
        stripL.position.set(-ROAD_WIDTH / 2 - 0.55, 2.3, 0);
        const stripR = stripL.clone();
        stripR.position.x = ROAD_WIDTH / 2 + 0.55;

        gantry.add(postL, postR, stripL, stripR);
        gantry.position.set(0, 0, -i * SEGMENT_LENGTH + 18);
        this.scene.add(gantry);
        this.sideGantries.push(gantry);
      }
    }

    // Distant procedural city skyline towers along left and right sides
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0b1224,
      roughness: 0.6,
      metalness: 0.4,
    });
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 14 + Math.random() * 38;
      const w = 6 + Math.random() * 8;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
      tower.position.set(
        side * (24 + Math.random() * 28),
        h / 2 - 0.05,
        -i * 11 + 10
      );
      this.scene.add(tower);
      this.skylineTowers.push(tower);
    }
  }

  public applyTheme(theme: AtmosphereTheme): void {
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.FogExp2(theme.fog, 0.0082);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(theme.sun);
    this.hemiLight.color.setHex(theme.accent);

    // Update road texture shoulder neon accent
    const nextTex = createRoadTexture(theme.grid, this.maxAnisotropy);
    this.roadSegments.forEach((seg) => {
      const mat = seg.material as THREE.MeshStandardMaterial;
      mat.map = nextTex;
      mat.needsUpdate = true;
    });
    this.roadTexture.dispose();
    this.roadTexture = nextTex;

    this.sideGantries.forEach((g) => {
      g.children.forEach((child, idx) => {
        if (idx >= 2 && child instanceof THREE.Mesh) {
          (child.material as THREE.MeshBasicMaterial).color.setHex(theme.grid);
        }
      });
    });
  }

  public cycleAtmosphere(): AtmosphereTheme {
    this.themeIndex = (this.themeIndex + 1) % ATMOSPHERE_THEMES.length;
    const theme = ATMOSPHERE_THEMES[this.themeIndex];
    this.applyTheme(theme);
    return theme;
  }

  public refreshPlayerCarMesh(): void {
    if (this.playerCarMesh) {
      this.carPreviewGroup.remove(this.playerCarMesh);
    }
    const spec = getEffectiveCarSpec(this.save, this.save.selectedCarId);
    this.playerCarMesh =
      spec.type === 'bike'
        ? createMotorbikeMesh(spec, false, this.maxAnisotropy)
        : createHypercarMesh(spec, false, this.maxAnisotropy);
    this.playerCarMesh.position.set(0, 0.42, 0);
    this.carPreviewGroup.add(this.playerCarMesh);
  }

  public setSaveState(save: SaveState): void {
    this.save = save;
  }

  public startRace(fromRemoteStart = false): void {
    audio.resume();
    this.state = 'RACING';
    this.callbacks.onStateChange('RACING');

    this.playerX = 0;
    this.playerVx = 0;
    this.speed = 0;
    this.nitro = 45;
    this.isNitroActive = false;
    this.isWheelieActive = false;
    this.wheelieAngle = 0;
    this.wheelieCashBuffer = 0;
    this.isDrifting = false;
    this.countdownRemaining = 3.0;
    this.goBannerTimer = 0;
    this.lastCountdownDigit = 3;
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.input.down = false;
    this.input.nitro = false;
    this.input.wheelie = false;
    audio.playCountdownBeep(false);
    this.distance = 0;
    this.raceTime = 0;
    this.runCash = 0;
    this.score = 0;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.nearMissCount = 0;
    this.knockdownCount = 0;
    this.lastSpawnDist = 24;
    this.curveAmount = 0;
    this.curveTarget = 0;
    this.curveTimer = 0;

    // Reset player mesh orientation
    this.carPreviewGroup.position.set(0, 0, 0);
    this.carPreviewGroup.rotation.set(0, 0, 0);
    this.refreshPlayerCarMesh();

    const isLevels = this.save.gameMode === 'levels';
    const isMulti = this.save.gameMode === 'multi';
    const lvl = getLevelSpec(this.save.currentLevel);
    this.levelTargetDist = isLevels
      ? lvl.distance
      : isMulti
        ? this.multiplayer.raceDistance
        : Infinity;

    if (isLevels) {
      this.applyTheme(lvl.theme);
    }

    // Clear old entities
    this.clearEntities();

    if (isMulti && this.multiplayer.roomCode && !fromRemoteStart) {
      this.multiplayer.triggerRoomRaceStart();
    }

    if (isLevels || isMulti) {
      this.finishLineMesh = createFinishLineMesh(this.maxAnisotropy);
      this.finishLineMesh.position.set(0, 0, -this.levelTargetDist);
      this.scene.add(this.finishLineMesh);
    }

    this.emitHud();
  }

  public returnToGarage(): void {
    this.state = 'GARAGE';
    this.callbacks.onStateChange('GARAGE');
    audio.updateEngine(0, false, false);
    this.clearEntities();
    this.carPreviewGroup.position.set(0, 0, 0);
    this.carPreviewGroup.rotation.set(0, 0, 0);
    this.curveAmount = 0;
    this.curveTarget = 0;
    this.resetRoadGeometry();
    this.refreshPlayerCarMesh();
  }

  private clearEntities(): void {
    this.trafficList.forEach((t) => this.scene.remove(t.mesh));
    this.trafficList.length = 0;
    this.pickupList.forEach((p) => this.scene.remove(p.mesh));
    this.pickupList.length = 0;
    this.particleList.forEach((pt) => this.scene.remove(pt.mesh));
    this.particleList.length = 0;
    if (this.finishLineMesh) {
      this.scene.remove(this.finishLineMesh);
      this.finishLineMesh = null;
    }
    Object.values(this.rivals).forEach((r) => this.scene.remove(r.mesh));
    this.rivals = {};
  }

  private resetRoadGeometry(): void {
    this.roadSegments.forEach((seg, i) => {
      seg.position.x = 0;
      seg.position.z = -i * SEGMENT_LENGTH + 18;
      seg.rotation.z = 0;
    });
    this.sideGantries.forEach((g, i) => {
      g.position.x = 0;
      g.position.z = -i * 3 * SEGMENT_LENGTH + 18;
      g.rotation.y = 0;
    });
  }

  private getCurveOffsetAtZ(z: number): number {
    // Player sits at z = 0; negative Z extends into horizon
    const distAhead = Math.max(0, -z);
    return this.curveAmount * distAhead * distAhead * 0.42;
  }

  private spawnTrafficAndPickups(): void {
    const isLevels = this.save.gameMode === 'levels';
    const lvl = getLevelSpec(this.save.currentLevel);
    const rate = isLevels ? lvl.trafficRate : 1.05;
    const spacing = Math.max(22, 42 / rate);

    if (this.distance - this.lastSpawnDist < spacing) return;
    this.lastSpawnDist = this.distance;

    const laneIdx = Math.floor(Math.random() * LANE_CENTERS.length);
    const laneX = LANE_CENTERS[laneIdx];
    const isTruck = Math.random() < 0.24;
    const palette = [0xef4444, 0x3b82f6, 0xf59e0b, 0x8b5cf6, 0x94a3b8, 0x10b981];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const mesh = createTrafficVehicleMesh(color, isTruck);
    const spawnZ = -195;
    mesh.position.set(laneX + this.getCurveOffsetAtZ(spawnZ), 0, spawnZ);
    this.scene.add(mesh);

    this.trafficList.push({
      mesh,
      x: laneX,
      z: spawnZ,
      speed: (isTruck ? 68 : 85 + Math.random() * 35) / 3.6,
      isTruck,
      nearMissed: false,
      knockedOut: false,
      vy: 0,
      vx: 0,
      rotSpeed: 0,
    });

    // Spawn a pickup in a different lane 65% of the time
    if (Math.random() < 0.65) {
      const otherLanes = LANE_CENTERS.filter((_, idx) => idx !== laneIdx);
      const px = otherLanes[Math.floor(Math.random() * otherLanes.length)];
      const type: 'cash' | 'nitro' = Math.random() < 0.62 ? 'cash' : 'nitro';
      const pGroup = new THREE.Group();
      if (type === 'cash') {
        const coin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.6, 0.16, 16),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0x92400e,
            metalness: 0.85,
            roughness: 0.2,
          })
        );
        coin.rotation.x = Math.PI / 2;
        pGroup.add(coin);
      } else {
        const can = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 1.05, 14),
          new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x0891b2,
            metalness: 0.7,
            roughness: 0.25,
          })
        );
        pGroup.add(can);
      }
      const pz = -182;
      pGroup.position.set(px + this.getCurveOffsetAtZ(pz), 0.9, pz);
      this.scene.add(pGroup);
      this.pickupList.push({ mesh: pGroup, x: px, z: pz, type });
    }
  }

  private spawnParticles(x: number, y: number, z: number, count: number, kind: 'nitro' | 'fire' | 'spark' | 'smoke'): void {
    const mat =
      kind === 'nitro'
        ? this.nitroMat
        : kind === 'fire'
          ? this.fireMat
          : kind === 'spark'
            ? this.sparkMat
            : this.smokeMat;

    for (let i = 0; i < count; i++) {
      if (this.particleList.length > 140) break;
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, y + Math.random() * 0.2, z);
      this.scene.add(mesh);
      this.particleList.push({
        mesh,
        vx: (Math.random() - 0.5) * (kind === 'spark' ? 14 : 3.5),
        vy: Math.random() * (kind === 'spark' ? 9 : 2.5),
        vz: kind === 'nitro' || kind === 'fire' ? 8 + Math.random() * 8 : (Math.random() - 0.5) * 6,
        life: 0,
        maxLife: kind === 'spark' ? 0.55 : 0.35,
      });
    }
  }

  private updateRivals(dt: number): void {
    if (this.save.gameMode !== 'multi' || !this.multiplayer.roomData?.players) return;
    const players: Record<string, MultiplayerPlayer> = this.multiplayer.roomData.players;
    const activeIds = new Set<string>();

    Object.values(players).forEach((p) => {
      if (!p || p.uid === this.multiplayer.userId) return;
      activeIds.add(p.uid);

      let rival = this.rivals[p.uid];
      if (!rival) {
        const baseSpec = CAR_MODELS.find((c) => c.id === p.carId) || CAR_MODELS[0];
        const customSpec = {
          ...baseSpec,
          primaryColor: p.primaryColor ?? baseSpec.primaryColor,
          neonColor: p.neonColor ?? baseSpec.neonColor,
          logoText: p.logoText || baseSpec.logoText,
          livery: (p.livery as 'twin' | 'center' | 'clean') || 'twin',
          spoiler: (p.spoiler as 'gt' | 'hyper' | 'none') || 'gt',
        };
        const mesh =
          customSpec.type === 'bike'
            ? createMotorbikeMesh(customSpec, false, this.maxAnisotropy)
            : createHypercarMesh(customSpec, false, this.maxAnisotropy);
        const tag = createFloatingNameTag(
          p.name || 'RIVAL',
          '#' + (customSpec.neonColor || 0x00ffff).toString(16).padStart(6, '0')
        );
        tag.position.set(0, 2.35, -1.5);
        mesh.add(tag);
        this.scene.add(mesh);
        rival = { mesh, currentX: p.x || 0, currentRelZ: 0 };
        this.rivals[p.uid] = rival;
      }

      const targetRelZ = -(p.dist - this.distance);
      rival.currentX += ((p.x || 0) - rival.currentX) * Math.min(1, dt * 10);
      rival.currentRelZ += (targetRelZ - rival.currentRelZ) * Math.min(1, dt * 10);

      rival.mesh.position.set(
        rival.currentX + this.getCurveOffsetAtZ(rival.currentRelZ),
        0.42,
        rival.currentRelZ
      );
      rival.mesh.visible = Math.abs(rival.currentRelZ) < 260;
    });

    Object.keys(this.rivals).forEach((uid) => {
      if (!activeIds.has(uid)) {
        this.scene.remove(this.rivals[uid].mesh);
        delete this.rivals[uid];
      }
    });
  }

  private completeLevel(): void {
    if (this.state !== 'RACING') return;
    this.state = 'GAMEOVER';
    this.callbacks.onStateChange('GAMEOVER');
    audio.updateEngine(0, false, false);
    audio.playLevelWin();

    const isMulti = this.save.gameMode === 'multi';
    const lvl = getLevelSpec(this.save.currentLevel);
    let mpRank = 1;

    if (isMulti && this.multiplayer.roomData?.players) {
      const sorted = Object.values(this.multiplayer.roomData.players).sort(
        (a, b) => (b.dist || 0) - (a.dist || 0)
      );
      mpRank = Math.max(
        1,
        sorted.findIndex((p) => p.uid === this.multiplayer.userId) + 1
      );
      this.multiplayer.syncPlayerTelemetry(
        this.save,
        this.playerX,
        this.distance,
        this.speed * 3.6,
        true,
        this.raceTime
      );
      if (this.multiplayer.isHost) {
        this.multiplayer.resetRoomToLobby();
      }
    }

    const stageBonus = isMulti ? Math.max(250, 900 - (mpRank - 1) * 200) : lvl.reward;
    this.runCash += stageBonus;
    this.save.cash += this.runCash;

    if (!isMulti && lvl.num >= this.save.highestUnlockedLevel && lvl.num < 100) {
      this.save.highestUnlockedLevel = lvl.num + 1;
      this.save.currentLevel = lvl.num + 1;
    }
    if (this.score > this.save.bestScore) {
      this.save.bestScore = Math.floor(this.score);
    }
    this.callbacks.onSaveMutated();

    this.callbacks.onRaceFinish({
      won: true,
      title: isMulti
        ? `🏁 P${mpRank} FINISH • ROOM ${this.multiplayer.roomCode || ''}!`
        : `🏆 LEVEL ${lvl.num} COMPLETE!`,
      subtitle: isMulti
        ? `Finished in ${this.raceTime.toFixed(1)}s • +$${stageBonus} Podium Bonus!`
        : `${lvl.name} Cleared • +$${stageBonus} Stage Bonus!`,
      runCash: this.runCash,
      distance: this.distance,
      nearMissCount: this.nearMissCount,
      knockdownCount: this.knockdownCount,
      score: Math.floor(this.score),
    });
  }

  private triggerCrash(): void {
    if (this.state !== 'RACING') return;
    this.state = 'GAMEOVER';
    this.callbacks.onStateChange('GAMEOVER');
    audio.updateEngine(0, false, false);
    audio.playCrash();

    this.spawnParticles(this.playerX, 0.9, 0, 28, 'spark');

    this.save.cash += this.runCash;
    if (this.score > this.save.bestScore) {
      this.save.bestScore = Math.floor(this.score);
    }
    if (this.save.gameMode === 'free' && this.distance > this.save.bestFreeDistance) {
      this.save.bestFreeDistance = Math.floor(this.distance);
    }
    this.callbacks.onSaveMutated();

    this.callbacks.onRaceFinish({
      won: false,
      title: '💥 WRECKED ON HIGHWAY!',
      subtitle:
        this.save.gameMode === 'free'
          ? `Free Curve Run Ended • Kept +$${this.runCash} Free Cash!`
          : `Traffic Collision • Kept +$${this.runCash} Free Cash!`,
      runCash: this.runCash,
      distance: this.distance,
      nearMissCount: this.nearMissCount,
      knockdownCount: this.knockdownCount,
      score: Math.floor(this.score),
    });
  }

  private emitHud(): void {
    const kmh = Math.round(this.speed * 3.6);
    const curveLabel =
      Math.abs(this.curveAmount) < 0.0005
        ? 'STRAIGHT'
        : this.curveAmount > 0
          ? 'CURVE ▶'
          : '◀ CURVE';
    const countdown =
      this.countdownRemaining > 0
        ? String(Math.min(3, Math.max(1, Math.ceil(this.countdownRemaining))))
        : this.goBannerTimer > 0
          ? 'GO!'
          : null;

    this.callbacks.onHudUpdate({
      kmh,
      nitro: this.nitro,
      isNitroActive: this.isNitroActive,
      isWheelieActive: this.isWheelieActive,
      isDrifting: this.isDrifting,
      canWheelie: this.nitro >= 60,
      distance: this.distance,
      targetDistance: this.levelTargetDist,
      runCash: this.runCash,
      score: Math.floor(this.score),
      combo: this.combo,
      nearMissCount: this.nearMissCount,
      knockdownCount: this.knockdownCount,
      curveLabel,
      raceTime: this.raceTime,
      countdown,
    });
  }

  private updateRace(dt: number): void {
    if (this.countdownRemaining > 0) {
      // Prevent all player input until the GO! signal
      this.input.left = false;
      this.input.right = false;
      this.input.up = false;
      this.input.down = false;
      this.input.nitro = false;
      this.input.wheelie = false;

      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.countdownRemaining = 0;
        this.goBannerTimer = 0.8;
        this.lastCountdownDigit = 0;
        this.speed = 35 / 3.6;
        audio.playCountdownBeep(true);
        this.emitHud();
      } else {
        const digit = Math.min(3, Math.max(1, Math.ceil(this.countdownRemaining)));
        if (digit !== this.lastCountdownDigit) {
          this.lastCountdownDigit = digit;
          audio.playCountdownBeep(false);
          this.emitHud();
        }
      }

      // Smoothly move chase camera into starting grid position
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 62, 7, dt);
      this.camera.updateProjectionMatrix();
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0, 8, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 3.25, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 7.1, 6, dt);
      this._camLook.set(0, 1.15, -18);
      this.camera.lookAt(this._camLook);

      audio.updateEngine(22, false, false);
      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.05) {
        this.hudSyncAccum = 0;
        this.emitHud();
      }
      return;
    }

    if (this.goBannerTimer > 0) {
      this.goBannerTimer = Math.max(0, this.goBannerTimer - dt);
      if (this.goBannerTimer === 0) {
        this.emitHud();
      }
    }

    const stats = getCarStats(this.save, this.save.selectedCarId);
    const maxSpeedMs = (stats.topSpeedKmh / 3.6) * (this.isNitroActive ? 1.32 : 1.0);
    const minSpeedMs = 30 / 3.6;

    // 1. Speed & Nitro
    if (this.input.nitro && this.nitro > 1) {
      this.isNitroActive = true;
      this.nitro = Math.max(0, this.nitro - dt * (24 / stats.nitroMult));
      this.speed += dt * 42 * stats.accelMult;
      this.spawnParticles(this.playerX, 0.38, 1.8, 2, 'fire');
    } else {
      this.isNitroActive = false;
      this.nitro = Math.min(100, this.nitro + dt * 3.8 * stats.nitroMult);
      if (this.input.down) {
        this.speed -= dt * 48;
      } else {
        const accelFactor = this.input.up ? 28 : 16;
        this.speed += dt * accelFactor * stats.accelMult;
      }
    }
    this.speed = THREE.MathUtils.clamp(this.speed, minSpeedMs, maxSpeedMs);

    // 2. Wheelie (requires >= 60% Nitro or holding wheelie while > 50% once started)
    if (this.input.wheelie && (this.nitro >= 60 || (this.isWheelieActive && this.nitro > 15))) {
      this.isWheelieActive = true;
      this.wheelieCashBuffer += dt * (stats.car.type === 'bike' ? 28 : 18);
      if (this.wheelieCashBuffer >= 25) {
        const payout = Math.floor(this.wheelieCashBuffer);
        this.wheelieCashBuffer -= payout;
        this.runCash += payout;
        this.callbacks.onToast(`WHEELIE +$${payout}!`, 'text-amber-300');
      }
    } else {
      this.isWheelieActive = false;
    }

    const targetWheelieAngle = this.isWheelieActive ? (stats.car.type === 'bike' ? 0.42 : 0.24) : 0;
    this.wheelieAngle = THREE.MathUtils.damp(this.wheelieAngle, targetWheelieAngle, 10, dt);

    // 3. Highway Curves (dynamic S-curves in Free Curve mode, gentler in campaign)
    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      const intensity =
        this.save.gameMode === 'free'
          ? 0.0022
          : this.save.gameMode === 'levels'
            ? 0.0009 * getLevelSpec(this.save.currentLevel).curveFactor
            : 0.0007;
      this.curveTarget = (Math.random() * 2 - 1) * intensity;
      this.curveTimer = 3.5 + Math.random() * 3.5;
    }
    this.curveAmount = THREE.MathUtils.damp(this.curveAmount, this.curveTarget, 1.4, dt);

    // 4. Steering & Drift Physics
    const steerInput = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const steerForce = 34 * stats.handlingMult;
    const centrifugalPush = -this.curveAmount * this.speed * 18;
    this.playerVx += (steerInput * steerForce + centrifugalPush) * dt;
    this.playerVx *= Math.exp(-7.5 * dt);
    this.playerX += this.playerVx * dt;

    const maxBound = ROAD_WIDTH / 2 - 1.25;
    if (Math.abs(this.playerX) > maxBound) {
      this.playerX = Math.sign(this.playerX) * maxBound;
      this.playerVx *= -0.25;
    }

    this.isDrifting = Math.abs(steerInput) > 0 && Math.abs(this.playerVx) > 5.5 && this.speed > 45;
    if (this.isDrifting) {
      this.spawnParticles(this.playerX - 0.7, 0.14, 1.4, 1, 'smoke');
      this.spawnParticles(this.playerX + 0.7, 0.14, 1.4, 1, 'smoke');
      this.score += dt * 45;
    }

    // Apply player transform + wheelie pivot
    this.carPreviewGroup.position.set(this.playerX, 0, 0);
    const bankRoll = THREE.MathUtils.clamp(-this.playerVx * 0.025, -0.28, 0.28);
    const yawAngle = THREE.MathUtils.clamp(-this.playerVx * 0.018, -0.22, 0.22);
    this.carPreviewGroup.rotation.set(0, yawAngle, bankRoll);

    const pivot = this.playerCarMesh?.getObjectByName('wheeliePivot');
    if (pivot) {
      pivot.rotation.x = this.wheelieAngle;
    }

    // 5. Distance Progression & Finish Line
    const dz = this.speed * dt;
    this.distance += dz;
    this.raceTime += dt;
    this.score += dz * 1.5 * this.combo * (this.isWheelieActive ? 1.5 : 1.0);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1.0;
    }

    // Scroll & bend road segments
    this.roadSegments.forEach((seg) => {
      seg.position.z += dz;
      if (seg.position.z > 24) {
        seg.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
      }
      seg.position.x = this.getCurveOffsetAtZ(seg.position.z);
    });

    this.sideGantries.forEach((g) => {
      g.position.z += dz;
      if (g.position.z > 24) {
        g.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
      }
      g.position.x = this.getCurveOffsetAtZ(g.position.z);
    });

    this.skylineTowers.forEach((t) => {
      t.position.z += dz * 0.45;
      if (t.position.z > 30) {
        t.position.z -= 308;
      }
    });

    if (this.save.gameMode === 'levels' || this.save.gameMode === 'multi') {
      if (this.finishLineMesh) {
        this.finishLineMesh.position.z += dz;
        this.finishLineMesh.position.x = this.getCurveOffsetAtZ(this.finishLineMesh.position.z);
      }

      if (this.save.gameMode === 'multi') {
        this.multiplayer.syncPlayerTelemetry(
          this.save,
          this.playerX,
          this.distance,
          this.speed * 3.6,
          false,
          0
        );
        this.updateRivals(dt);
      }

      if (this.distance >= this.levelTargetDist) {
        this.completeLevel();
        return;
      }
    } else if (this.distance > this.save.bestFreeDistance) {
      this.save.bestFreeDistance = Math.floor(this.distance);
    }

    // 6. Traffic & Pickups
    this.spawnTrafficAndPickups();

    const playerHalfW = stats.car.type === 'bike' ? 0.45 : 0.95;
    for (let i = this.trafficList.length - 1; i >= 0; i--) {
      const t = this.trafficList[i];
      if (t.knockedOut) {
        t.z += dz * 0.5;
        t.x += t.vx * dt;
        t.vy -= 26 * dt;
        t.mesh.position.y = Math.max(0, t.mesh.position.y + t.vy * dt);
        t.mesh.position.x = t.x + this.getCurveOffsetAtZ(t.z);
        t.mesh.position.z = t.z;
        t.mesh.rotation.y += t.rotSpeed * dt;
        t.mesh.rotation.z += t.rotSpeed * 0.7 * dt;
      } else {
        t.z += (this.speed - t.speed) * dt;
        t.mesh.position.set(t.x + this.getCurveOffsetAtZ(t.z), 0, t.z);

        const hitHalfW = (t.isTruck ? 1.15 : 0.92) + playerHalfW;
        const hitHalfL = t.isTruck ? 4.2 : 3.2;

        if (Math.abs(t.z) < hitHalfL && Math.abs(this.playerX - t.x) < hitHalfW) {
          if (this.isNitroActive) {
            // Knockdown!
            t.knockedOut = true;
            t.vy = 11 + Math.random() * 5;
            t.vx = (this.playerX <= t.x ? 1 : -1) * (14 + Math.random() * 8);
            t.rotSpeed = (Math.random() > 0.5 ? 1 : -1) * 7;
            this.knockdownCount += 1;
            this.runCash += 125;
            this.score += 500 * this.combo;
            this.combo = Math.min(5.0, Number((this.combo + 0.5).toFixed(1)));
            this.comboTimer = 4.0;
            audio.playKnockdown();
            this.spawnParticles(t.x, 0.9, t.z, 18, 'spark');
            this.callbacks.onToast('💥 KNOCKDOWN +$125!', 'text-amber-300');
          } else {
            this.triggerCrash();
            return;
          }
        } else if (!t.nearMissed && t.z > 2.8 && t.z < 7.5 && Math.abs(this.playerX - t.x) < hitHalfW + 1.45) {
          t.nearMissed = true;
          this.nearMissCount += 1;
          this.runCash += 45;
          this.nitro = Math.min(100, this.nitro + 14);
          this.score += 200 * this.combo;
          this.combo = Math.min(5.0, Number((this.combo + 0.25).toFixed(2)));
          this.comboTimer = 3.5;
          audio.playNearMiss();
          this.callbacks.onToast(`⚡ NEAR MISS +$45 (${this.combo.toFixed(1)}x)`, 'text-cyan-300');
        }
      }

      if (t.z > 28 || t.z < -240) {
        this.scene.remove(t.mesh);
        this.trafficList.splice(i, 1);
      }
    }

    for (let i = this.pickupList.length - 1; i >= 0; i--) {
      const p = this.pickupList[i];
      p.z += dz;
      p.mesh.position.set(p.x + this.getCurveOffsetAtZ(p.z), 0.9, p.z);
      p.mesh.rotation.y += dt * 3.2;

      if (Math.abs(p.z) < 2.6 && Math.abs(this.playerX - p.x) < 1.85) {
        if (p.type === 'cash') {
          this.runCash += 75;
          this.score += 150 * this.combo;
          this.callbacks.onToast('💵 CASH +$75', 'text-emerald-300');
        } else {
          this.nitro = Math.min(100, this.nitro + 28);
          this.score += 100 * this.combo;
          this.callbacks.onToast('🚀 NITRO +28%', 'text-cyan-300');
        }
        audio.playCoin();
        this.scene.remove(p.mesh);
        this.pickupList.splice(i, 1);
        continue;
      }

      if (p.z > 22) {
        this.scene.remove(p.mesh);
        this.pickupList.splice(i, 1);
      }
    }

    // 7. Particles
    for (let i = this.particleList.length - 1; i >= 0; i--) {
      const pt = this.particleList[i];
      pt.life += dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      const scale = Math.max(0.01, 1 - pt.life / pt.maxLife);
      pt.mesh.scale.setScalar(scale);
      if (pt.life >= pt.maxLife) {
        this.scene.remove(pt.mesh);
        this.particleList.splice(i, 1);
      }
    }

    // 8. Smooth Camera Choreography (FOV widening + chase lag + tilt)
    const targetFov = 62 + (this.speed / 120) * 16 + (this.isNitroActive ? 9 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    const targetCamX = this.playerX * 0.72;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.isNitroActive ? 2.95 : 3.25, 6, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.isNitroActive ? 7.9 : 7.1, 6, dt);

    this._camLook.set(this.playerX * 0.5 + this.curveAmount * 600, 1.15, -18);
    this.camera.lookAt(this._camLook);

    audio.updateEngine(this.speed * 3.6, this.isNitroActive, this.isWheelieActive);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.05) {
      this.hudSyncAccum = 0;
      this.emitHud();
    }
  }

  private updateGarageShowcase(dt: number, elapsedSec: number): void {
    this.carPreviewGroup.rotation.y += dt * 0.48;
    this.carPreviewGroup.position.set(0, Math.sin(elapsedSec * 2) * 0.03, 0);

    const targetFov = 54;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 4.1, 5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 2.15, 5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 5.6, 5, dt);
    this._camLook.set(0, -0.48, -0.5);
    this.camera.lookAt(this._camLook);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.state === 'RACING') {
      this.updateRace(dt);
    } else {
      this.updateGarageShowcase(dt, now / 1000);
    }

    this.renderer.render(this.scene, this.camera);
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (this.state === 'RACING' && this.countdownRemaining > 0) {
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') this.input.left = true;
    if (k === 'arrowright' || k === 'd') this.input.right = true;
    if (k === 'arrowup' || k === 'w') this.input.up = true;
    if (k === 'arrowdown' || k === 's') this.input.down = true;
    if (k === ' ' || k === 'shift') this.input.nitro = true;
    if (k === 'e' || k === 'q') this.input.wheelie = true;
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') this.input.left = false;
    if (k === 'arrowright' || k === 'd') this.input.right = false;
    if (k === 'arrowup' || k === 'w') this.input.up = false;
    if (k === 'arrowdown' || k === 's') this.input.down = false;
    if (k === ' ' || k === 'shift') this.input.nitro = false;
    if (k === 'e' || k === 'q') this.input.wheelie = false;
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    audio.updateEngine(0, false, false);
    this.roadTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

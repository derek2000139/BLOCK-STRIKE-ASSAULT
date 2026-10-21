import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameMode, GameSettings, HudState, KillEvent, MatchResult, PlayerStats, Team, WeaponHudInfo } from './types';
import { MAP_BOXES, MAP_BOUNDS, NAV_NODES, NAV_EXPLICIT, SPAWNS, FFA_SPAWNS, BOMB_SITES, type MapBox, type NavNode } from './map';
import { getMaterial, getTexture, makeSolidPixelMaterial } from './textures';
import { Entity, STAND_H, CROUCH_H, RADIUS, makeWeapon, type WeaponInst } from './entity';
import { WEAPONS, GUNGAME_ORDER, GEAR_PRICES } from './weapons';
import { ViewModel } from './viewmodel';
import { BotBrain } from './bot';
import { audio } from './audio';

const BOT_NAMES = ['小明', '阿强', '老王', '大熊', '狙神', '闪电', '幽灵', '铁拳', '夜枭', '毒蛇', '猎鹰', '狂狼', '冰霜', '烈焰', '黑豹', '疾风', '雷霆', '暗影', '钢牙', '白鲨', '猛虎', '苍鹰'];

interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; gravity: number }
interface Tracer { mesh: THREE.Mesh; life: number }
interface Grenade { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; kind: 'he' | 'flash' | 'smoke'; fuse: number; owner: Entity; bounces: number }
interface Smoke { group: THREE.Group; pos: THREE.Vector3; life: number; t: number }
interface Hit { dist: number; point: THREE.Vector3; normal: THREE.Vector3; entity?: Entity; head: boolean }

export interface InputState { mx: number; mz: number; jump: boolean; fire: boolean; crouch: boolean; walk: boolean; use: boolean }

const PLAYER_SPEED = 5.4;
const GRAVITY = 24;
const JUMP_V = 7.2;
const STEP_H = 0.6;

export class Engine {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  settings: GameSettings;
  mode: GameMode;
  time = 0;
  private last = 0;
  running = false;
  paused = false;
  private raf = 0;

  solids: MapBox[] = [];
  navNodes: NavNode[] = NAV_NODES;
  navAdj: Map<number, number[]> = new Map();
  entities: Entity[] = [];
  player: Entity;
  bots: Entity[] = [];
  view: ViewModel;
  input: InputState = { mx: 0, mz: 0, jump: false, fire: false, crouch: false, walk: false, use: false };
  keys = new Set<string>();
  mouseDx = 0;
  mouseDy = 0;
  mouseDown = false;
  mouse2Down = false;
  scoped = false;
  pointerLocked = false;

  particles: Particle[] = [];
  tracers: Tracer[] = [];
  grenades: Grenade[] = [];
  smokes: Smoke[] = [];
  private cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  private particleMats: Record<string, THREE.MeshLambertMaterial> = {};

  // match state
  phase: HudState['roundPhase'] = 'warmup';
  phaseT = 0;
  roundTime = 0;
  roundNumber = 1;
  scoreCT = 0;
  scoreT = 0;
  lossStreak: Record<Team, number> = { CT: 0, T: 0 };
  kills: KillEvent[] = [];
  killId = 0;
  bombPlanted = false;
  bombPos: THREE.Vector3 | null = null;
  bombTimer = 0;
  bombMesh: THREE.Mesh | null = null;
  bombLight: THREE.PointLight | null = null;
  bombCarrier: Entity | null = null;
  droppedBomb: THREE.Vector3 | null = null;
  droppedBombMesh: THREE.Mesh | null = null;
  bombDefuser: Entity | null = null;
  nextBeep = 0;
  matchTime = 0;
  matchLimitTime = 0;
  announcement = '';
  announcementT = 0;
  killStreakText = '';
  killStreakT = 0;
  hitMarkerT = 0;
  damageDirs: { angle: number; t: number }[] = [];
  spectateTarget: Entity | null = null;
  deathCamT = 0;
  ended = false;
  playerSpottedT = 0;
  spotted = new Map<number, number>();
  lastHud = 0;
  fps = 60;
  private fpsAcc = 0;
  private fpsN = 0;
  buyOpen = false;
  playerLoadout: { primary: string | null; secondary: string | null; grenades: string[] } = { primary: null, secondary: null, grenades: [] };
  matchStart = 0;
  shakeT = 0;

  onHud: (h: HudState) => void = () => {};
  onEnd: (r: MatchResult) => void = () => {};
  onBuyToggle: (open: boolean) => void = () => {};
  onScoreboard: (open: boolean) => void = () => {};
  onPause: (p: boolean) => void = () => {};

  // temps
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, settings: GameSettings) {
    this.canvas = canvas;
    this.settings = settings;
    this.mode = settings.mode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 400);
    this.scene.add(this.camera);
    this.scene.background = new THREE.Color('#7fb2e5');
    this.scene.fog = new THREE.Fog('#9cc4ea', 90, 260);
    this.view = new ViewModel(this.camera);

    this.buildWorld();
    this.buildNav();

    this.player = new Entity(0, settings.playerName || '玩家', settings.team, true);
    this.entities.push(this.player);
    const botTotal = settings.mode === 'ffa' ? settings.botCount * 2 : settings.botCount * 2 - 1;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < botTotal; i++) {
      let team: Team;
      if (settings.mode === 'ffa') team = i % 2 === 0 ? 'T' : 'CT';
      else {
        // team sizes: player's team gets botCount-1 bots
        const own = settings.team;
        const other: Team = own === 'CT' ? 'T' : 'CT';
        team = i < settings.botCount - 1 ? own : other;
      }
      const b = new Entity(i + 1, `${names[i % names.length]}`, team, false);
      b.skinVariant = i;
      b.bot = new BotBrain(b, this, settings.difficulty);
      b.buildModel(this.scene, settings.mode !== 'ffa' && team === settings.team);
      this.bots.push(b);
      this.entities.push(b);
    }
    this.bindInput();
    audio.init();
    audio.setVolume(settings.volume);
  }

  // ---------------- World ----------------
  private buildWorld() {
    const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
    sun.position.set(60, 90, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80; sun.shadow.camera.right = 80; sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 250;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight('#bcd9ff', '#6b5a44', 1.1));
    // interior lights of warehouse
    for (const [x, z] of [[-12, -30], [10, -14], [-10, -12], [12, -32]]) {
      const l = new THREE.PointLight('#ffe0b2', 30, 40, 1.5);
      l.position.set(x, 10, z);
      this.scene.add(l);
    }
    // ground plane
    const gm = getMaterial('asphalt', 200, 200);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gm);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // merge map boxes by texture
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const b of MAP_BOXES) {
      if (!b.thin) this.solids.push(b);
      const w = b.x2 - b.x1, h = b.y2 - b.y1, d = b.z2 - b.z1;
      const top = b.top || b.tex;
      const makeFace = (tex: string, geo: THREE.BufferGeometry) => {
        if (!groups.has(tex)) groups.set(tex, []);
        groups.get(tex)!.push(geo);
      };
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(b.x1 + w / 2, b.y1 + h / 2, b.z1 + d / 2);
      // scale UVs per face so textures tile per 1 unit (2 texels per meter => 1 tile per 1m)
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const faceDims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) {
        const [fu, fv] = faceDims[f];
        for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * fu, uv.getY(i) * fv);
      }
      if (top !== b.tex) {
        // split top face (face index 2) into separate geometry
        const topGeo = geo.clone();
        const idx = geo.index!;
        // faces: each face 6 indices (2 tris) starting at f*6
        const sideIdx: number[] = [];
        const topIdx: number[] = [];
        for (let f = 0; f < 6; f++) for (let k = 0; k < 6; k++) (f === 2 ? topIdx : sideIdx).push(idx.getX(f * 6 + k));
        geo.setIndex(sideIdx);
        topGeo.setIndex(topIdx);
        makeFace(b.tex, geo.toNonIndexed());
        makeFace(top, topGeo.toNonIndexed());
      } else makeFace(b.tex, geo.toNonIndexed());
    }
    for (const [tex, geos] of groups) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mat = new THREE.MeshLambertMaterial({ map: getTexture(tex) });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    // sky: large gradient-ish dome via big sphere basic material
    const skyGeo = new THREE.SphereGeometry(350, 16, 8);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color('#3f7fd0') }, bottom: { value: new THREE.Color('#bcdcf5') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = clamp(h*1.8+0.2,0.0,1.0); t = floor(t*6.0)/6.0; gl_FragColor = vec4(mix(bottom, top, t),1.0); }',
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
    // blocky clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random() * 16, 1.5, 6 + Math.random() * 10), cloudMat);
      c.position.set((Math.random() - 0.5) * 400, 60 + Math.random() * 20, (Math.random() - 0.5) * 400);
      this.scene.add(c);
    }
  }

  private buildNav() {
    const adj = new Map<number, number[]>();
    const add = (a: number, b: number) => { if (!adj.has(a)) adj.set(a, []); if (!adj.get(a)!.includes(b)) adj.get(a)!.push(b); };
    for (const e of NAV_EXPLICIT) { add(e.a, e.b); if (!e.oneWay) add(e.b, e.a); }
    const N = this.navNodes;
    for (let i = 0; i < N.length; i++)
      for (let j = i + 1; j < N.length; j++) {
        const a = N[i], b = N[j];
        if (a.tag === 'drop' || b.tag === 'drop') continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > 13 || Math.abs(a.y - b.y) > 0.6) continue;
        if (this.segmentClear(a, b, 0.9) && this.segmentClear(a, b, 1.5)) { add(i, j); add(j, i); }
      }
    this.navAdj = adj;
  }

  private segmentClear(a: NavNode, b: NavNode, yOff: number): boolean {
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const px = -dz / l, pz = dx / l; // perpendicular
    for (const off of [0, 0.45, -0.45]) {
      const o = this._v1.set(a.x + px * off, a.y + yOff, a.z + pz * off);
      const t = this._v2.set(b.x + px * off, b.y + yOff, b.z + pz * off);
      const dir = this._v3.subVectors(t, o);
      const len = dir.length();
      dir.normalize();
      if (this.raycastBoxes(o, dir, len)) return false;
    }
    return true;
  }

  nearestNode(x: number, y: number, z: number): number {
    let best = 0, bd = Infinity;
    for (const n of this.navNodes) {
      if (n.tag === 'drop') continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2 + ((n.y - y) * 3) ** 2;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }
  randomNode(): number {
    let n: NavNode;
    do { n = this.navNodes[Math.floor(Math.random() * this.navNodes.length)]; } while (n.tag === 'drop');
    return n.id;
  }
  randomNodeNear(x: number, z: number, r: number, minCount = 1): number {
    const c = this.navNodes.filter((n) => n.tag !== 'drop' && Math.hypot(n.x - x, n.z - z) <= r);
    if (c.length < minCount) return this.nearestNode(x, 0, z);
    return c[Math.floor(Math.random() * c.length)].id;
  }

  findPath(start: number, goal: number): number[] {
    if (start === goal) return [start];
    const N = this.navNodes;
    const open = new Set<number>([start]);
    const came = new Map<number, number>();
    const g = new Map<number, number>([[start, 0]]);
    const f = new Map<number, number>([[start, this.hDist(start, goal)]]);
    while (open.size) {
      let cur = -1, bf = Infinity;
      for (const n of open) { const v = f.get(n) ?? Infinity; if (v < bf) { bf = v; cur = n; } }
      if (cur === goal) {
        const path = [cur];
        while (came.has(cur)) { cur = came.get(cur)!; path.push(cur); }
        return path.reverse();
      }
      open.delete(cur);
      for (const nb of this.navAdj.get(cur) || []) {
        const ng = (g.get(cur) ?? Infinity) + this.hDist(cur, nb);
        if (ng < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, ng);
          f.set(nb, ng + this.hDist(nb, goal));
          open.add(nb);
        }
      }
    }
    void N;
    return [start];
  }
  private hDist(a: number, b: number) {
    const A = this.navNodes[a], B = this.navNodes[b];
    return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
  }

  // ---------------- Input ----------------
  private onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code === 'Tab') { ev.preventDefault(); this.onScoreboard(true); return; }
    if (ev.repeat) return;
    this.keys.add(ev.code);
    if (ev.code === 'KeyB') { this.toggleBuy(); return; }
    if (ev.code === 'Escape') return;
    if (!this.player.alive) {
      if (ev.code === 'Space' || ev.code === 'KeyE') this.cycleSpectate();
      return;
    }
    const p = this.player;
    const slotKeys: Record<string, () => WeaponInst | null | undefined> = {
      Digit1: () => p.primary, Digit2: () => p.secondary, Digit3: () => p.melee, Digit4: () => {
        if (!p.grenades.length) return null;
        const i = p.grenades.indexOf(p.current);
        return p.grenades[(i + 1) % p.grenades.length];
      }, Digit5: () => p.bomb,
    };
    if (slotKeys[ev.code]) { const w = slotKeys[ev.code](); if (w) this.switchTo(p, w); }
    if (ev.code === 'KeyQ' && p.lastWeapon && this.hasWeapon(p, p.lastWeapon)) this.switchTo(p, p.lastWeapon);
    if (ev.code === 'KeyR') this.startReload(p);
    if (ev.code === 'KeyG') this.dropWeapon(p);
  };
  private onKeyUp = (ev: KeyboardEvent) => {
    this.keys.delete(ev.code);
    if (ev.code === 'Tab') { ev.preventDefault(); this.onScoreboard(false); }
  };
  private onMouseMove = (ev: MouseEvent) => {
    if (!this.pointerLocked) return;
    if (Math.abs(ev.movementX) > 300 || Math.abs(ev.movementY) > 300) return; // pointer-lock jump guard
    this.mouseDx += ev.movementX;
    this.mouseDy += ev.movementY;
  };
  private onMouseDown = (ev: MouseEvent) => {
    if (!this.pointerLocked) { if (!this.buyOpen && this.running && !this.ended) this.requestLock(); return; }
    if (ev.button === 0) { this.mouseDown = true; if (!this.player.alive) this.cycleSpectate(); }
    if (ev.button === 2) this.mouse2Down = true;
  };
  private onMouseUp = (ev: MouseEvent) => {
    if (ev.button === 0) this.mouseDown = false;
    if (ev.button === 2) this.mouse2Down = false;
  };
  private onWheel = (ev: WheelEvent) => {
    if (!this.pointerLocked || !this.player.alive) return;
    const list = this.player.inventoryList();
    const i = list.indexOf(this.player.current);
    const n = (i + (ev.deltaY > 0 ? 1 : -1) + list.length) % list.length;
    this.switchTo(this.player, list[n]);
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) {
      this.mouseDown = false; this.mouse2Down = false; this.keys.clear();
      if (!this.buyOpen && this.running && !this.ended) { this.paused = true; this.onPause(true); }
    } else {
      this.paused = false; this.onPause(false);
    }
  };
  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('contextmenu', this.onContext);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }
  requestLock() {
    audio.resume();
    this.canvas.requestPointerLock?.();
  }
  toggleBuy(force?: boolean) {
    const open = force !== undefined ? force : !this.buyOpen;
    if (open && !this.canBuy()) { this.announce('现在无法购买', 1.5); return; }
    this.buyOpen = open;
    this.onBuyToggle(open);
    if (open) { if (this.pointerLocked) document.exitPointerLock(); }
    else this.requestLock();
  }
  resume() { this.requestLock(); }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('contextmenu', this.onContext);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.renderer.dispose();
  }

  // ---------------- Match start / rounds ----------------
  start() {
    this.running = true;
    this.matchStart = performance.now();
    this.last = performance.now();
    if (this.mode === 'bomb') {
      this.startRound();
    } else {
      this.matchLimitTime = this.mode === 'gungame' ? 15 * 60 : 10 * 60;
      this.phase = 'live';
      for (const e of this.entities) this.spawnEntity(e, true);
      this.announce(this.modeIntro(), 4);
      audio.roundStart();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  private modeIntro() {
    switch (this.mode) {
      case 'tdm': return `团队死斗 · 率先击杀 ${this.settings.scoreLimit} 次的队伍获胜`;
      case 'ffa': return `死亡竞赛 · 率先达到 ${this.settings.scoreLimit} 击杀者获胜`;
      case 'gungame': return `军备竞赛 · 每次击杀升级武器，用军刀完成最后一击！`;
      default: return '';
    }
  }

  isEnemy(a: Entity, b: Entity) {
    if (a === b) return false;
    if (this.mode === 'ffa' || this.mode === 'gungame') return true;
    return a.team !== b.team;
  }

  private startRound() {
    this.phase = 'freeze';
    this.phaseT = this.roundNumber === 1 ? 10 : 7;
    this.roundTime = 115;
    this.bombPlanted = false;
    this.bombPos = null;
    this.bombCarrier = null;
    this.droppedBomb = null;
    this.bombDefuser = null;
    if (this.bombMesh) { this.scene.remove(this.bombMesh); this.bombMesh = null; }
    if (this.bombLight) { this.scene.remove(this.bombLight); this.bombLight = null; }
    if (this.droppedBombMesh) { this.scene.remove(this.droppedBombMesh); this.droppedBombMesh = null; }
    for (const s of this.smokes) this.scene.remove(s.group);
    this.smokes = [];
    for (const g of this.grenades) this.scene.remove(g.mesh);
    this.grenades = [];
    for (const e of this.entities) this.spawnEntity(e, false);
    // give bomb to random T
    const ts = this.entities.filter((e) => e.team === 'T');
    if (ts.length) {
      const c = ts[Math.floor(Math.random() * ts.length)];
      c.giveWeapon('c4');
      this.bombCarrier = c;
      if (c.isPlayer) this.announce('你携带了炸弹！前往 A 或 B 点安放', 4);
    }
    for (const b of this.bots) this.botBuy(b);
    this.announce(`第 ${this.roundNumber} 回合 · 购买阶段`, 3);
    audio.roundStart();
  }

  private spawnEntity(e: Entity, fullReset: boolean) {
    e.alive = true;
    e.hp = 100;
    e.vel.set(0, 0, 0);
    e.crouch = false;
    e.height = STAND_H;
    e.damagers.clear();
    e.lastAttacker = null;
    e.planting = 0; e.defusing = 0;
    e.flashUntil = 0;
    e.reloading = false;
    e.streak = 0;
    if (this.mode === 'bomb') {
      // keep weapons between rounds if survived (handled: if died we reset)
      if (fullReset || !e.primary && !e.secondary || e.deathTime > 0) {
        const keepPrimary = e.deathTime === 0 && e.primary ? e.primary : null;
        const keepSecondary = e.deathTime === 0 && e.secondary ? e.secondary : null;
        const keepNades = e.deathTime === 0 ? e.grenades : [];
        const keepArmor = e.deathTime === 0 ? e.armor : 0;
        const keepHelmet = e.deathTime === 0 ? e.helmet : false;
        const keepDef = e.deathTime === 0 ? e.defuser : false;
        e.resetLoadout();
        e.primary = keepPrimary; e.secondary = keepSecondary; e.grenades = keepNades;
        e.armor = keepArmor; e.helmet = keepHelmet; e.defuser = keepDef;
      } else {
        e.bomb = null; e.reloading = false;
      }
      if (!e.secondary) e.secondary = makeWeapon(e.team === 'CT' ? 'usp' : 'glock');
      if (e.primary) { e.primary.ammo = e.primary.def.mag; e.primary.reserve = e.primary.def.reserve; }
      e.secondary.ammo = e.secondary.def.mag; e.secondary.reserve = e.secondary.def.reserve;
      e.current = e.bestWeapon();
      e.deathTime = 0;
    } else {
      e.resetLoadout();
      e.armor = 100; e.helmet = true;
      if (this.mode === 'gungame') {
        const id = GUNGAME_ORDER[Math.min(e.gunLevel, GUNGAME_ORDER.length - 1)];
        if (id === 'knife') e.current = e.melee; else { const w = e.giveWeapon(id); w.reserve = 999; e.current = w; }
        if (id !== 'knife' && WEAPONS[id].slot === 'primary') { e.secondary = null; }
      } else if (e.isPlayer) {
        const L = this.playerLoadout;
        if (!L.primary && !L.secondary) { L.primary = e.team === 'CT' ? 'm4' : 'ak47'; L.secondary = e.team === 'CT' ? 'usp' : 'glock'; L.grenades = ['hegrenade', 'flashbang']; }
        if (L.primary) e.giveWeapon(L.primary);
        if (L.secondary) e.giveWeapon(L.secondary);
        for (const g of L.grenades) e.giveWeapon(g);
        e.current = e.bestWeapon();
      } else {
        this.botRandomLoadout(e);
      }
    }
    e.money = Math.min(16000, e.money);
    // position
    const spawn = this.pickSpawn(e);
    e.pos.set(spawn[0], spawn[1] + 0.05, spawn[2]);
    // face toward map center-ish
    e.yaw = Math.atan2(-(0 - e.pos.x), -(-20 - e.pos.z));
    if (this.mode === 'bomb') e.yaw = e.team === 'CT' ? Math.PI : (Math.random() - 0.5) * 2;
    e.pitch = 0;
    e.spawnProtectUntil = this.mode === 'bomb' ? 0 : this.time + 2.5;
    if (e.bot) { e.bot.reset(); e.bot.aimYaw = e.yaw; e.setGunColor(e.current.def.color); }
    if (e.isPlayer) {
      this.view.build(e.current.def);
      this.spectateTarget = null;
      this.scoped = false;
    }
  }

  private pickSpawn(e: Entity): [number, number, number] {
    let list: [number, number, number][];
    if (this.mode === 'bomb' || this.mode === 'tdm') list = SPAWNS[e.team];
    else list = FFA_SPAWNS;
    if (this.mode === 'bomb') {
      // deterministic distinct spawns per team
      const teamIdx = this.entities.filter((x) => x.team === e.team).indexOf(e);
      return list[teamIdx % list.length];
    }
    // choose spawn farthest from enemies, with randomness
    let best = list[0], bs = -1;
    const cands = [...list].sort(() => Math.random() - 0.5).slice(0, 8);
    for (const s of cands) {
      let md = Infinity;
      for (const o of this.entities) { if (o === e || !o.alive || !this.isEnemy(e, o)) continue; md = Math.min(md, Math.hypot(o.pos.x - s[0], o.pos.z - s[2])); }
      if (md > bs) { bs = md; best = s; }
    }
    return best;
  }

  private botRandomLoadout(e: Entity) {
    const prim = e.team === 'CT' ? ['m4', 'm4', 'famas', 'aug', 'mp9', 'mp5', 'awp', 'ssg08', 'xm1014', 'nova', 'm249'] : ['ak47', 'ak47', 'galil', 'sg553', 'mac10', 'mp5', 'awp', 'ssg08', 'xm1014', 'nova', 'm249'];
    const w = e.giveWeapon(prim[Math.floor(Math.random() * prim.length)]);
    w.reserve = 999;
    const s = e.giveWeapon(e.team === 'CT' ? 'usp' : 'glock');
    s.reserve = 999;
    if (Math.random() < 0.5) e.giveWeapon('hegrenade');
    if (Math.random() < 0.3) e.giveWeapon('flashbang');
    e.current = e.bestWeapon();
  }

  private botBuy(e: Entity) {
    if (this.mode !== 'bomb') return;
    const ct = e.team === 'CT';
    const buy = (id: string) => { const p = WEAPONS[id]?.price ?? GEAR_PRICES[id]?.price ?? 0; if (e.money >= p) { e.money -= p; return true; } return false; };
    if (!e.primary) {
      const m = e.money;
      if (m >= 4750 + 1000 && Math.random() < 0.25) { buy('awp'); e.giveWeapon('awp'); }
      else if (m >= (ct ? 2900 : 2700) + 1000) { buy(ct ? 'm4' : 'ak47'); e.giveWeapon(ct ? 'm4' : 'ak47'); }
      else if (m >= (ct ? 2050 : 1800) + 650) { buy(ct ? 'famas' : 'galil'); e.giveWeapon(ct ? 'famas' : 'galil'); }
      else if (m >= 2000 && Math.random() < 0.3) { buy('ssg08'); e.giveWeapon('ssg08'); }
      else if (m >= 1500 + 650) { buy(ct ? 'mp9' : 'mac10'); e.giveWeapon(ct ? 'mp9' : 'mac10'); }
      else if (m >= 1050 + 650 && Math.random() < 0.4) { buy('nova'); e.giveWeapon('nova'); }
    }
    if (e.armor < 50) {
      if (e.money >= 1000 && (e.primary || e.money >= 1700)) { buy('kevlarhelmet'); e.armor = 100; e.helmet = true; }
      else if (e.money >= 650 && Math.random() < 0.6) { buy('kevlar'); e.armor = 100; }
    }
    if (!e.primary && e.money >= 700 && Math.random() < 0.4 && e.secondary?.def.id !== 'deagle') { buy('deagle'); e.giveWeapon('deagle'); }
    else if (!e.primary && e.money >= 300 && Math.random() < 0.4 && e.secondary?.def.id !== 'p250') { buy('p250'); e.giveWeapon('p250'); }
    if (e.money >= 300 + 1000 && Math.random() < 0.7) { buy('hegrenade'); e.giveWeapon('hegrenade'); }
    if (e.money >= 200 + 1000 && Math.random() < 0.6) { buy('flashbang'); e.giveWeapon('flashbang'); }
    if (e.money >= 300 + 1500 && Math.random() < 0.4) { buy('smoke'); e.giveWeapon('smoke'); }
    if (ct && e.money >= 400 + 1500 && Math.random() < 0.7) { buy('defuser'); e.defuser = true; }
    e.current = e.bestWeapon();
    e.setGunColor(e.current.def.color);
  }

  canBuy() {
    if (this.ended) return false;
    if (this.mode !== 'bomb') return true;
    if (!this.player.alive) return false;
    if (this.phase === 'freeze') return true;
    if (this.phase === 'live' && 115 - this.roundTime < 20 && this.inSpawnZone(this.player)) return true;
    return false;
  }
  private inSpawnZone(e: Entity) {
    if (e.team === 'CT') return e.pos.z > 12;
    void e;
    return e.pos.z < -20 && Math.abs(e.pos.x) < 24;
  }

  buy(id: string): string | null {
    const p = this.player;
    if (!this.canBuy()) return '现在无法购买';
    const free = this.mode !== 'bomb';
    if (GEAR_PRICES[id]) {
      const g = GEAR_PRICES[id];
      if (id === 'defuser' && p.team !== 'CT') return '仅 CT 可购买';
      if (id === 'defuser' && p.defuser) return '已拥有';
      if (id === 'kevlar' && p.armor >= 100) return '护甲已满';
      if (id === 'kevlarhelmet' && p.armor >= 100 && p.helmet) return '已拥有';
      let price = g.price;
      if (id === 'kevlarhelmet' && p.armor >= 100) price = 350;
      if (!free && p.money < price) return '资金不足';
      if (!free) p.money -= price;
      if (id === 'defuser') p.defuser = true;
      if (id === 'kevlar') p.armor = 100;
      if (id === 'kevlarhelmet') { p.armor = 100; p.helmet = true; }
      audio.buy();
      return null;
    }
    const def = WEAPONS[id];
    if (!def) return '未知物品';
    if (def.teamOnly && def.teamOnly !== p.team && this.mode === 'bomb') return `仅 ${def.teamOnly} 可购买`;
    if (def.slot === 'grenade') {
      const ex = p.grenades.find((g) => g.def.id === id);
      const max = id === 'flashbang' ? 2 : 1;
      if (ex && ex.ammo >= max) return '已达上限';
      if (p.grenades.reduce((s, g) => s + g.ammo, 0) >= 4) return '投掷物已满';
    } else if (def.slot === 'primary' && p.primary?.def.id === id) return '已拥有';
    else if (def.slot === 'secondary' && p.secondary?.def.id === id) return '已拥有';
    if (!free && p.money < def.price) return '资金不足';
    if (!free) p.money -= def.price;
    const old = def.slot === 'primary' ? p.primary : def.slot === 'secondary' ? p.secondary : null;
    const w = p.giveWeapon(id);
    if (free) w.reserve = 999;
    if (def.slot !== 'grenade' || p.current === p.melee) {
      if (def.slot !== 'grenade') { if (old === p.current || p.current === p.melee || p.current.def.slot === def.slot) this.switchTo(p, w); }
    }
    // remember loadout for respawn modes
    if (free) {
      if (def.slot === 'primary') this.playerLoadout.primary = id;
      if (def.slot === 'secondary') this.playerLoadout.secondary = id;
      if (def.slot === 'grenade' && !this.playerLoadout.grenades.includes(id)) this.playerLoadout.grenades.push(id);
    }
    audio.buy();
    return null;
  }

  // ---------------- Weapon handling ----------------
  hasWeapon(e: Entity, w: WeaponInst) { return e.inventoryList().includes(w); }

  switchTo(e: Entity, w: WeaponInst) {
    if (e.current === w) return;
    e.lastWeapon = e.current;
    e.current = w;
    e.reloading = false;
    e.switchEnd = this.time + (w.def.cls === 'knife' ? 0.3 : 0.55);
    e.nextFire = Math.max(e.nextFire, e.switchEnd);
    e.shotsFired = 0;
    if (e.isPlayer) { this.view.build(w.def); audio.swap(); this.scoped = false; }
    else e.setGunColor(w.def.color);
  }

  startReload(e: Entity) {
    const w = e.current;
    if (e.reloading || w.def.cls === 'knife' || w.def.cls === 'grenade' || w.def.cls === 'c4') return;
    if (w.ammo >= w.def.mag || w.reserve <= 0) return;
    e.reloading = true;
    e.reloadStart = this.time;
    e.reloadEnd = this.time + w.def.reloadTime;
    if (e.isPlayer) { audio.reload(0); this.scoped = false; }
  }

  private finishReload(e: Entity) {
    const w = e.current;
    const need = w.def.mag - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take;
    if (w.reserve < 900) w.reserve -= take;
    e.reloading = false;
    e.shotsFired = 0;
    if (e.isPlayer) audio.reload(2);
  }

  dropWeapon(e: Entity) {
    const w = e.current;
    if (w.def.cls === 'knife') return;
    if (w.def.cls === 'c4') { this.dropBomb(e); return; }
    e.removeWeapon(w);
    if (e.isPlayer) this.view.build(e.current.def);
  }

  private dropBomb(e: Entity) {
    if (!e.bomb) return;
    e.bomb = null;
    if (e.current.def.cls === 'c4') e.current = e.bestWeapon();
    this.bombCarrier = null;
    this.droppedBomb = e.pos.clone();
    if (!this.droppedBombMesh) {
      this.droppedBombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshLambertMaterial({ map: getTexture('c4') }));
      this.scene.add(this.droppedBombMesh);
    }
    this.droppedBombMesh.position.set(e.pos.x, e.pos.y + 0.13, e.pos.z);
    this.droppedBombMesh.visible = true;
    if (e.isPlayer) this.view.build(e.current.def);
    this.announce('炸弹已掉落', 2);
  }

  tryFire(e: Entity, held: boolean) {
    if (!e.alive || this.phase === 'freeze' || this.phase === 'end') return;
    const w = e.current;
    if (this.time < e.nextFire || e.reloading) return;
    if (!w.def.auto && held) return; // semi-auto requires fresh click
    const def = w.def;
    if (def.cls === 'c4') return;
    if (def.cls === 'grenade') {
      this.throwGrenade(e, w);
      return;
    }
    if (def.cls === 'knife') {
      e.nextFire = this.time + 60 / def.rpm;
      if (e.isPlayer) { this.view.swing(); audio.shoot('knife'); }
      const origin = e.eyePos(this._v1);
      const dir = e.forward(this._v2);
      const hit = this.raycastAll(origin, dir, def.range, e);
      if (hit?.entity) {
        // backstab
        const victimFwd = hit.entity.forward(this._v3);
        const back = victimFwd.dot(dir) > 0.5;
        this.damage(hit.entity, e, back ? 180 : def.damage, hit.head, def, hit.point);
      } else if (hit) this.spawnImpact(hit.point, hit.normal, '#bbb');
      return;
    }
    if (w.ammo <= 0) {
      if (e.isPlayer) audio.dryFire();
      if (w.reserve > 0) this.startReload(e);
      e.nextFire = this.time + 0.2;
      return;
    }
    w.ammo--;
    e.nextFire = this.time + 60 / def.rpm;
    if (this.time - e.lastShot > 0.35) e.shotsFired = 0;
    e.shotsFired++;
    e.lastShot = this.time;
    // spread
    const speed = Math.hypot(e.vel.x, e.vel.z);
    const moveFrac = Math.min(1, speed / PLAYER_SPEED);
    let spread = def.spread + def.moveSpread * moveFrac;
    if (!e.grounded) spread += 0.08;
    if (e.crouch) spread *= 0.75;
    spread += Math.min(0.05, e.shotsFired * (def.auto ? 0.0025 : 0.004)) * (e.isPlayer ? 1 : 1 - (e.bot?.p.recoilControl ?? 0.5) * 0.8);
    if (def.scope) {
      const scopedNow = e.isPlayer ? this.scoped : true;
      if (!scopedNow) spread += def.cls === 'sniper' ? 0.12 : 0.03;
      else spread *= def.cls === 'sniper' ? 1 : 0.6;
    }
    if (def.cls === 'sniper' && e.isPlayer) this.scoped = false;
    const origin = e.eyePos(this._v1).clone();
    const base = e.forward(this._v2).clone();
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dir = base.clone();
      const sp = pellets > 1 ? spread : spread;
      dir.x += (Math.random() - 0.5) * 2 * sp;
      dir.y += (Math.random() - 0.5) * 2 * sp;
      dir.z += (Math.random() - 0.5) * 2 * sp;
      dir.normalize();
      const hit = this.raycastAll(origin, dir, def.range * 2.5, e);
      let endPoint: THREE.Vector3;
      if (hit) {
        endPoint = hit.point;
        if (hit.entity) {
          const dist = hit.dist;
          let dmg = def.damage * Math.max(0.4, 1 - Math.max(0, dist - def.range * 0.25) / def.range * 0.5);
          if (pellets > 1) dmg *= Math.max(0.2, 1 - dist / def.range);
          this.damage(hit.entity, e, dmg, hit.head, def, hit.point);
        } else this.spawnImpact(hit.point, hit.normal, '#c9c9c9');
      } else endPoint = origin.clone().addScaledVector(dir, def.range * 2.5);
      if (!e.isPlayer || i === 0 || pellets > 1) this.spawnTracer(e, endPoint);
    }
    // recoil
    if (e.isPlayer) {
      const r = def.recoil;
      const pattern = Math.min(e.shotsFired, 12);
      e.pitch += r * (1 + Math.min(pattern, 6) * 0.1);
      e.yaw += (Math.sin(pattern * 0.9) * 0.6 + (Math.random() - 0.5) * 0.4) * r * 0.5;
      e.pitch = Math.min(1.5, e.pitch);
      this.view.flash(def.cls);
      audio.shoot(def.cls);
    } else {
      // bot recoil climbs aim
      if (e.bot) e.bot.aimPitch += def.recoil * (1 - e.bot.p.recoilControl) * 0.8;
      const d = e.pos.distanceTo(this.player.pos);
      const pan = this.panFor(e.pos);
      const quiet = def.id === 'usp' || def.id === 'mp5';
      if (d < (quiet ? 25 : 120)) audio.shoot(def.cls, d * (quiet ? 2 : 1), pan);
      this.botMuzzle(e);
    }
    // notify bots about the noise
    const quiet = def.id === 'usp' || def.id === 'mp5';
    for (const b of this.bots) if (b !== e && b.bot && b.alive && b.pos.distanceTo(e.pos) < (quiet ? 12 : 40)) b.bot.hear(e.pos, e);
    if (w.ammo === 0 && w.reserve > 0 && !e.isPlayer) this.startReload(e);
  }

  private panFor(p: THREE.Vector3) {
    const dx = p.x - this.player.pos.x, dz = p.z - this.player.pos.z;
    const right = Math.cos(this.player.yaw) * dx - Math.sin(this.player.yaw) * dz;
    const d = Math.hypot(dx, dz) || 1;
    return Math.max(-0.8, Math.min(0.8, right / d));
  }

  private botMuzzle(e: Entity) {
    if (!e.parts) return;
    const flash = new THREE.Mesh(this.cubeGeo, this.pmat('#ffe082', true));
    const f = e.forward(this._v3);
    flash.position.set(e.pos.x + f.x * 0.9, e.eyeY() - 0.25 + f.y * 0.9, e.pos.z + f.z * 0.9);
    flash.scale.setScalar(0.25);
    this.scene.add(flash);
    this.particles.push({ mesh: flash, vel: new THREE.Vector3(), life: 0.05, maxLife: 0.05, gravity: 0 });
  }

  private pmat(color: string, basic = false): THREE.MeshLambertMaterial {
    const key = color + (basic ? 'b' : '');
    if (!this.particleMats[key]) this.particleMats[key] = basic ? (new THREE.MeshBasicMaterial({ color }) as unknown as THREE.MeshLambertMaterial) : new THREE.MeshLambertMaterial({ color });
    return this.particleMats[key];
  }

  private spawnImpact(p: THREE.Vector3, n: THREE.Vector3, color: string) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.cubeGeo, this.pmat(color));
      m.position.copy(p).addScaledVector(n, 0.05);
      m.scale.setScalar(0.06 + Math.random() * 0.06);
      this.scene.add(m);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3 + n.x * 2.5, Math.random() * 3 + n.y * 2, (Math.random() - 0.5) * 3 + n.z * 2.5);
      this.particles.push({ mesh: m, vel, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, gravity: 12 });
    }
  }

  private spawnBlood(p: THREE.Vector3) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(this.cubeGeo, this.pmat('#b71c1c'));
      m.position.copy(p);
      m.scale.setScalar(0.06 + Math.random() * 0.08);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.5 + Math.random() * 0.4, maxLife: 0.9, gravity: 14 });
    }
  }

  private spawnTracer(e: Entity, end: THREE.Vector3) {
    const start = e.isPlayer
      ? this._v3.set(e.pos.x, e.eyeY() - 0.2, e.pos.z).addScaledVector(e.forward(new THREE.Vector3()), 0.9).clone()
      : e.eyePos(new THREE.Vector3()).addScaledVector(e.forward(new THREE.Vector3()), 0.8);
    if (e.isPlayer) {
      // offset to the gun on the right
      const right = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
      start.addScaledVector(right, 0.25);
    }
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.5) return;
    const m = new THREE.Mesh(this.cubeGeo, this.pmat('#fff3b0', true));
    m.position.copy(start).addScaledVector(dir, 0.5);
    m.scale.set(0.025, 0.025, len);
    m.lookAt(end);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.06 });
  }

  // ---------------- Raycasting ----------------
  raycastBoxes(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): Hit | null {
    let best = maxDist;
    let hitBox: MapBox | null = null;
    let nAxis = 0, nSign = 1;
    const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z;
    for (const b of this.solids) {
      let tmin = 0, tmax = best;
      let axis = 0, sign = 1;
      // x
      let t1 = (b.x1 - o.x) * ix, t2 = (b.x2 - o.x) * ix;
      let s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 0; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      t1 = (b.y1 - o.y) * iy; t2 = (b.y2 - o.y) * iy; s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 1; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      t1 = (b.z1 - o.z) * iz; t2 = (b.z2 - o.z) * iz; s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 2; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      if (tmin < best && tmin > 0) { best = tmin; hitBox = b; nAxis = axis; nSign = sign; }
    }
    // ground plane y=0
    if (d.y < 0) {
      const t = -o.y / d.y;
      if (t > 0 && t < best) { best = t; hitBox = null; nAxis = 1; nSign = 1; return { dist: t, point: o.clone().addScaledVector(d, t), normal: new THREE.Vector3(0, 1, 0), head: false }; }
    }
    if (!hitBox) return null;
    const n = new THREE.Vector3(nAxis === 0 ? nSign : 0, nAxis === 1 ? nSign : 0, nAxis === 2 ? nSign : 0);
    return { dist: best, point: o.clone().addScaledVector(d, best), normal: n, head: false };
  }

  private rayEntity(o: THREE.Vector3, d: THREE.Vector3, e: Entity, maxDist: number): { dist: number; head: boolean } | null {
    // head sphere
    const hp = e.headPos(this._v3);
    const r = 0.27;
    const ox = o.x - hp.x, oy = o.y - hp.y, oz = o.z - hp.z;
    const bq = ox * d.x + oy * d.y + oz * d.z;
    const c = ox * ox + oy * oy + oz * oz - r * r;
    const disc = bq * bq - c;
    let headT = Infinity;
    if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t > 0 && t < maxDist) headT = t; }
    // body aabb
    const hw = 0.32;
    const bx1 = e.pos.x - hw, bx2 = e.pos.x + hw, by1 = e.pos.y, by2 = e.pos.y + e.height - 0.35, bz1 = e.pos.z - hw, bz2 = e.pos.z + hw;
    let tmin = 0, tmax = maxDist;
    const slabs: [number, number, number, number][] = [[bx1, bx2, o.x, d.x], [by1, by2, o.y, d.y], [bz1, bz2, o.z, d.z]];
    let bodyT = Infinity;
    let ok = true;
    for (const [a, b, oo, dd] of slabs) {
      const inv = 1 / dd;
      let t1 = (a - oo) * inv, t2 = (b - oo) * inv;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && tmin > 0) bodyT = tmin;
    if (headT === Infinity && bodyT === Infinity) return null;
    if (headT <= bodyT) return { dist: headT, head: true };
    return { dist: bodyT, head: false };
  }

  raycastAll(o: THREE.Vector3, d: THREE.Vector3, maxDist: number, ignore: Entity | null): Hit | null {
    const wall = this.raycastBoxes(o, d, maxDist);
    let best = wall ? wall.dist : maxDist;
    let hitE: Entity | null = null;
    let head = false;
    for (const e of this.entities) {
      if (e === ignore || !e.alive) continue;
      const r = this.rayEntity(o, d, e, best);
      if (r && r.dist < best) { best = r.dist; hitE = e; head = r.head; }
    }
    if (hitE) return { dist: best, point: o.clone().addScaledVector(d, best), normal: d.clone().negate(), entity: hitE, head };
    return wall;
  }

  canSee(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const d = this._v3.subVectors(to, from);
    const len = d.length();
    if (len < 0.01) return true;
    d.divideScalar(len);
    // smoke check
    for (const s of this.smokes) {
      if (s.t < 0.6) continue;
      const r = 4.2;
      const fx = from.x - s.pos.x, fy = from.y - (s.pos.y + 1.5), fz = from.z - s.pos.z;
      const b = fx * d.x + fy * d.y + fz * d.z;
      const c = fx * fx + fy * fy + fz * fz - r * r;
      const disc = b * b - c;
      if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < len) return false; if (c < 0) return false; }
    }
    return !this.raycastBoxes(from, d, len);
  }

  // ---------------- Damage ----------------
  damage(victim: Entity, attacker: Entity | null, amount: number, head: boolean, def: { id: string; name: string; headMult: number; penetration: number; cls: string } | null, point?: THREE.Vector3) {
    if (!victim.alive) return;
    if (attacker && attacker !== victim && !this.isEnemy(attacker, victim)) return; // no friendly fire
    if (victim.spawnProtectUntil > this.time) return;
    let dmg = amount;
    if (def && head) dmg *= def.headMult;
    // armor
    if (victim.armor > 0 && (!head || victim.helmet) && def && def.cls !== 'knife') {
      const pen = def.penetration;
      const reduced = dmg * pen;
      victim.armor = Math.max(0, victim.armor - Math.round((dmg - reduced) * 0.5));
      dmg = reduced;
      if (victim.armor === 0) victim.helmet = false;
    }
    dmg = Math.round(dmg);
    if (dmg <= 0) return;
    victim.hp -= dmg;
    if (point) this.spawnBlood(point);
    if (attacker && attacker !== victim) {
      attacker.damageDealt += dmg;
      const rec = victim.damagers.get(attacker.id) || { dmg: 0, t: 0 };
      rec.dmg += dmg; rec.t = this.time;
      victim.damagers.set(attacker.id, rec);
      victim.lastAttacker = attacker;
      if (attacker.isPlayer) { this.hitMarkerT = 0.15; audio.hit(head); }
      if (victim.bot) victim.bot.onDamaged(attacker);
    }
    if (victim.isPlayer) {
      audio.hurt();
      this.shakeT = 0.25;
      if (attacker && attacker !== victim) {
        const dx = attacker.pos.x - victim.pos.x, dz = attacker.pos.z - victim.pos.z;
        const ang = Math.atan2(-dx, -dz) - victim.yaw;
        this.damageDirs.push({ angle: ang, t: 1.2 });
      }
    }
    if (victim.hp <= 0) this.kill(victim, attacker, def ? def.name : '世界', head);
  }

  private kill(victim: Entity, killer: Entity | null, weapon: string, headshot: boolean) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.deathTime = this.time;
    victim.respawnAt = this.time + 3.5;
    victim.reloading = false;
    victim.streak = 0;
    if (victim.group) victim.group.visible = false;
    this.spawnBlood(victim.chestPos(new THREE.Vector3()));
    // death body particles (blocky "gibs")
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.cubeGeo, this.pmat(victim.team === 'CT' ? '#35587f' : '#8c7a4a'));
      m.position.copy(victim.pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 0.5));
      m.scale.setScalar(0.15 + Math.random() * 0.15);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5), life: 2 + Math.random(), maxLife: 3, gravity: 18 });
    }
    if (this.mode === 'bomb' && victim.bomb) this.dropBomb(victim);
    if (this.bombDefuser === victim) this.bombDefuser = null;
    const suicide = !killer || killer === victim;
    if (!suicide && killer) {
      killer.kills++;
      killer.score += headshot ? 3 : 2;
      killer.streak++;
      if (headshot) killer.headshots++;
      const wdef = Object.values(WEAPONS).find((w) => w.name === weapon);
      if (this.mode === 'bomb') killer.money = Math.min(16000, killer.money + (wdef?.killReward ?? 300));
      // assists
      for (const [id, rec] of victim.damagers) {
        if (id === killer.id) continue;
        if (rec.dmg >= 40 && this.time - rec.t < 6) { const a = this.entities.find((x) => x.id === id); if (a) { a.assists++; a.score += 1; } }
      }
      if (killer.isPlayer) {
        audio.kill();
        const streaks: Record<number, string> = { 2: '双杀！', 3: '三连杀！', 4: '四连杀！', 5: '五连杀！ACE！' };
        if (this.mode === 'bomb' && killer.streak >= 2) { this.killStreakText = streaks[Math.min(killer.streak, 5)]; this.killStreakT = 2.5; }
        else if (killer.streak >= 3) { this.killStreakText = `${killer.streak} 连杀！`; this.killStreakT = 2; }
        if (headshot) { this.killStreakText = this.killStreakText || '爆头！'; this.killStreakT = Math.max(this.killStreakT, 1.2); }
      }
      // gun game progression
      if (this.mode === 'gungame') {
        const cur = GUNGAME_ORDER[Math.min(killer.gunLevel, GUNGAME_ORDER.length - 1)];
        if (cur === 'knife') { this.endMatch(killer); }
        else {
          const need = WEAPONS[cur].cls === 'pistol' ? 2 : 2;
          killer.gunLevelKills++;
          if (weapon === '军刀' && victim.gunLevel > 0) victim.gunLevel--; // humiliation
          if (killer.gunLevelKills >= need || weapon === '军刀') {
            killer.gunLevel++;
            killer.gunLevelKills = 0;
            if (killer.alive) this.applyGunLevel(killer);
            if (killer.isPlayer) { audio.levelUp(); this.announce(`升级：${WEAPONS[GUNGAME_ORDER[Math.min(killer.gunLevel, GUNGAME_ORDER.length - 1)]].name}`, 1.5); }
          }
        }
      }
    }
    this.kills.push({ id: this.killId++, killer: suicide ? victim.name : killer!.name, killerTeam: suicide ? victim.team : killer!.team, victim: victim.name, victimTeam: victim.team, weapon: suicide ? '自杀' : weapon, headshot, time: this.time });
    if (this.kills.length > 6) this.kills.shift();
    if (victim.isPlayer) {
      this.deathCamT = 2.5;
      this.spectateTarget = null;
      this.scoped = false;
      if (this.buyOpen) this.toggleBuy(false);
    }
    // mode checks
    if (this.mode === 'tdm' && killer && !suicide) {
      if (killer.team === 'CT') this.scoreCT++; else this.scoreT++;
      if (this.scoreCT >= this.settings.scoreLimit || this.scoreT >= this.settings.scoreLimit) this.endMatch(null);
    }
    if (this.mode === 'ffa' && killer && !suicide && killer.kills >= this.settings.scoreLimit) this.endMatch(killer);
    if (this.mode === 'bomb') this.checkRoundEnd();
  }

  private applyGunLevel(e: Entity) {
    const id = GUNGAME_ORDER[Math.min(e.gunLevel, GUNGAME_ORDER.length - 1)];
    e.primary = null; e.secondary = null;
    if (id === 'knife') { e.current = e.melee; }
    else { const w = e.giveWeapon(id); w.reserve = 999; e.current = w; }
    e.reloading = false;
    e.switchEnd = this.time + 0.4; e.nextFire = e.switchEnd;
    if (e.isPlayer) this.view.build(e.current.def);
    else e.setGunColor(e.current.def.color);
  }

  // ---------------- Grenades ----------------
  private throwGrenade(e: Entity, w: WeaponInst) {
    if (!w.def.grenade) return;
    w.ammo--;
    e.nextFire = this.time + 1;
    const col = w.def.grenade === 'he' ? '#2e7d32' : w.def.grenade === 'flash' ? '#90a4ae' : '#607d8b';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), makeSolidPixelMaterial(col, 10, 5));
    const origin = e.eyePos(new THREE.Vector3());
    const dir = e.forward(new THREE.Vector3());
    const vel = dir.clone().multiplyScalar(17).add(e.vel.clone().multiplyScalar(0.5));
    vel.y += 2.5;
    mesh.position.copy(origin).addScaledVector(dir, 0.5);
    this.scene.add(mesh);
    this.grenades.push({ mesh, pos: mesh.position.clone(), vel, kind: w.def.grenade, fuse: w.def.grenade === 'smoke' ? 1.8 : 1.7, owner: e, bounces: 0 });
    if (e.isPlayer) audio.throwPin();
    if (w.ammo <= 0) {
      e.removeWeapon(w);
      const next = e.lastWeapon && this.hasWeapon(e, e.lastWeapon) ? e.lastWeapon : e.bestWeapon();
      e.current = next;
      e.switchEnd = this.time + 0.5; e.nextFire = e.switchEnd;
      if (e.isPlayer) this.view.build(next.def);
    }
  }

  botThrow(e: Entity, g: WeaponInst, target: THREE.Vector3) {
    // aim toward target with elevation
    const dx = target.x - e.pos.x, dz = target.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const oldYaw = e.yaw, oldPitch = e.pitch;
    e.yaw = Math.atan2(-dx, -dz);
    e.pitch = Math.min(0.8, 0.15 + d / 60);
    const prev = e.current;
    e.current = g;
    this.throwGrenade(e, g);
    if (this.hasWeapon(e, prev)) e.current = prev;
    e.yaw = oldYaw; e.pitch = oldPitch;
    e.setGunColor(e.current.def.color);
  }

  private updateGrenades(dt: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= GRAVITY * 0.8 * dt;
      // move with bounces per axis
      const r = 0.12;
      const tryAxis = (axis: 'x' | 'y' | 'z') => {
        const prev = g.pos[axis];
        g.pos[axis] += g.vel[axis] * dt;
        for (const b of this.solids) {
          if (g.pos.x + r > b.x1 && g.pos.x - r < b.x2 && g.pos.y + r > b.y1 && g.pos.y - r < b.y2 && g.pos.z + r > b.z1 && g.pos.z - r < b.z2) {
            g.pos[axis] = prev;
            g.vel[axis] *= -0.45;
            if (axis !== 'y') { g.vel.x *= 0.8; g.vel.z *= 0.8; }
            else { g.vel.x *= 0.7; g.vel.z *= 0.7; }
            if (Math.abs(g.vel[axis]) > 1.5) { g.bounces++; audio.bounce(g.pos.distanceTo(this.player.pos)); }
            return;
          }
        }
        if (axis === 'y' && g.pos.y < r) { g.pos.y = r; g.vel.y *= -0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; if (Math.abs(g.vel.y) > 1.5) audio.bounce(g.pos.distanceTo(this.player.pos)); }
      };
      tryAxis('x'); tryAxis('z'); tryAxis('y');
      if (Math.abs(g.vel.y) < 0.3 && g.pos.y <= r + 0.01) g.vel.y = 0;
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      if (g.fuse <= 0) {
        this.detonate(g);
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  private detonate(g: Grenade) {
    const dPlayer = g.pos.distanceTo(this.player.pos);
    if (g.kind === 'he') {
      audio.explosion(dPlayer, this.panFor(g.pos));
      // visual
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(this.cubeGeo, this.pmat(i % 3 === 0 ? '#ff9800' : i % 3 === 1 ? '#424242' : '#ffeb3b', i % 3 !== 1));
        m.position.copy(g.pos);
        m.scale.setScalar(0.15 + Math.random() * 0.35);
        this.scene.add(m);
        this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14), life: 0.6 + Math.random() * 0.8, maxLife: 1.4, gravity: 10 });
      }
      const light = new THREE.PointLight('#ffa726', 80, 20);
      light.position.copy(g.pos).add(new THREE.Vector3(0, 0.5, 0));
      this.scene.add(light);
      setTimeout(() => this.scene.remove(light), 120);
      for (const e of this.entities) {
        if (!e.alive) continue;
        const d = e.chestPos(this._v1).distanceTo(g.pos);
        if (d > 9) continue;
        const los = this.canSee(this._v2.copy(g.pos).add(new THREE.Vector3(0, 0.3, 0)), e.chestPos(this._v1)) || d < 1.5;
        if (!los) continue;
        const dmg = 98 * Math.pow(Math.max(0, 1 - d / 9), 1.4);
        if (dmg > 1) this.damage(e, g.owner, dmg, false, { id: 'hegrenade', name: '高爆手雷', headMult: 1, penetration: 0.57, cls: 'grenade' });
      }
      if (dPlayer < 10) this.shakeT = 0.5;
      for (const b of this.bots) if (b.bot && b.alive && b.pos.distanceTo(g.pos) < 45) b.bot.hear(g.pos, g.owner);
    } else if (g.kind === 'flash') {
      for (const e of this.entities) {
        if (!e.alive) continue;
        const eye = e.eyePos(this._v1);
        const d = eye.distanceTo(g.pos);
        if (d > 40) continue;
        if (!this.canSee(eye, g.pos)) continue;
        const dir = this._v2.subVectors(g.pos, eye).normalize();
        const facing = e.forward(this._v3).dot(dir); // 1 facing, -1 away
        let dur = facing > 0.5 ? 4.2 : facing > -0.2 ? 2.5 : 0.9;
        dur *= Math.max(0.3, 1 - d / 45);
        if (dur > e.flashUntil - this.time) { e.flashUntil = this.time + dur; e.flashPeak = 1; }
        if (e.isPlayer) audio.flash();
        if (e.bot && g.owner !== e && this.isEnemy(e, g.owner)) e.bot.target = null;
      }
      const light = new THREE.PointLight('#ffffff', 120, 30);
      light.position.copy(g.pos);
      this.scene.add(light);
      setTimeout(() => this.scene.remove(light), 100);
    } else {
      audio.smokePop();
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: '#b0b8bd' });
      for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(this.cubeGeo, mat);
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 2.6;
        m.position.set(Math.cos(a) * rr, 0.8 + Math.random() * 2.6, Math.sin(a) * rr);
        m.scale.setScalar(1.6 + Math.random() * 1.6);
        m.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(m);
      }
      group.position.copy(g.pos);
      group.scale.setScalar(0.1);
      this.scene.add(group);
      this.smokes.push({ group, pos: g.pos.clone(), life: 16, t: 0 });
    }
  }

  // ---------------- Bomb ----------------
  inBombSite(p: THREE.Vector3) {
    return BOMB_SITES.some((s) => p.x >= s.x1 && p.x <= s.x2 && p.z >= s.z1 && p.z <= s.z2 && p.y < 2);
  }
  private siteAt(p: THREE.Vector3) {
    return BOMB_SITES.find((s) => p.x >= s.x1 && p.x <= s.x2 && p.z >= s.z1 && p.z <= s.z2);
  }

  private plantBomb(e: Entity) {
    e.bomb = null;
    e.current = e.bestWeapon();
    if (e.isPlayer) this.view.build(e.current.def);
    else e.setGunColor(e.current.def.color);
    this.bombCarrier = null;
    this.bombPlanted = true;
    this.bombTimer = 40;
    this.bombPos = e.pos.clone();
    this.phase = 'planted';
    this.nextBeep = 0;
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshLambertMaterial({ map: getTexture('c4') }));
    this.bombMesh.position.set(e.pos.x, e.pos.y + 0.13, e.pos.z);
    this.scene.add(this.bombMesh);
    this.bombLight = new THREE.PointLight('#ff1744', 0, 8);
    this.bombLight.position.set(e.pos.x, e.pos.y + 0.6, e.pos.z);
    this.scene.add(this.bombLight);
    if (this.mode === 'bomb') e.money = Math.min(16000, e.money + 300);
    const site = this.siteAt(e.pos);
    this.announce(`炸弹已安放在 ${site?.name ?? ''} 点！`, 3);
    audio.plant();
    for (const b of this.bots) b.bot?.reset();
    for (const b of this.bots) if (b.bot) b.bot.goalNode = -1;
  }

  private defuseBomb(e: Entity) {
    this.bombPlanted = false;
    if (this.bombMesh) { this.scene.remove(this.bombMesh); this.bombMesh = null; }
    if (this.bombLight) { this.scene.remove(this.bombLight); this.bombLight = null; }
    e.score += 3;
    if (this.mode === 'bomb') e.money = Math.min(16000, e.money + 300);
    this.endRound('CT', '炸弹已拆除');
  }

  private explodeBomb() {
    if (!this.bombPos) return;
    const p = this.bombPos;
    audio.explosion(p.distanceTo(this.player.pos) * 0.3);
    this.shakeT = 1.2;
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(this.cubeGeo, this.pmat(i % 3 === 0 ? '#ff9800' : i % 3 === 1 ? '#424242' : '#ffeb3b', i % 3 !== 1));
      m.position.copy(p);
      m.scale.setScalar(0.3 + Math.random() * 0.8);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 22, (Math.random() - 0.5) * 30), life: 1 + Math.random() * 1.5, maxLife: 2.5, gravity: 10 });
    }
    const light = new THREE.PointLight('#ffa726', 300, 60);
    light.position.copy(p).add(new THREE.Vector3(0, 2, 0));
    this.scene.add(light);
    setTimeout(() => this.scene.remove(light), 300);
    for (const e of this.entities) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(p);
      if (d < 18) this.damage(e, null, 500 * (1 - d / 18) + 50, false, { id: 'c4', name: 'C4 炸弹', headMult: 1, penetration: 1, cls: 'c4' });
    }
    this.bombPlanted = false;
    if (this.bombMesh) { this.scene.remove(this.bombMesh); this.bombMesh = null; }
    if (this.bombLight) { this.scene.remove(this.bombLight); this.bombLight = null; }
    this.endRound('T', '炸弹已爆炸');
  }

  private checkRoundEnd() {
    if (this.mode !== 'bomb' || this.phase === 'end' || this.phase === 'freeze') return;
    const ctAlive = this.entities.some((e) => e.team === 'CT' && e.alive);
    const tAlive = this.entities.some((e) => e.team === 'T' && e.alive);
    if (!ctAlive && !tAlive) { this.endRound(this.bombPlanted ? 'T' : 'CT', '同归于尽'); return; }
    if (!ctAlive) { this.endRound('T', 'CT 全灭'); return; }
    if (!tAlive && !this.bombPlanted) { this.endRound('CT', 'T 全灭'); return; }
  }

  private endRound(winner: Team, reason: string) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.phaseT = 6;
    if (winner === 'CT') this.scoreCT++; else this.scoreT++;
    const loser: Team = winner === 'CT' ? 'T' : 'CT';
    this.lossStreak[winner] = 0;
    this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
    const lossBonus = 1400 + 500 * (this.lossStreak[loser] - 1);
    for (const e of this.entities) {
      if (e.team === winner) e.money += 3250;
      else e.money += lossBonus;
      if (e.team === 'T' && reason === '炸弹已爆炸') e.money += 350;
      e.money = Math.min(16000, e.money);
      if (!e.alive) e.deathTime = this.time; // mark for loadout reset
    }
    const playerWon = winner === this.player.team;
    this.announce(`${winner === 'CT' ? '反恐精英' : '恐怖分子'}获胜 · ${reason}`, 4);
    if (playerWon) audio.roundWin(); else audio.roundLose();
    const half = Math.ceil(this.settings.roundLimit);
    if (this.scoreCT >= half || this.scoreT >= half) {
      setTimeout(() => { if (this.running) this.endMatch(null); }, 3500);
    }
  }

  private endMatch(winnerEntity: Entity | null) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'end';
    const stats = this.statsList();
    let winner: MatchResult['winner'] = 'draw';
    let winnerName = '平局';
    if (this.mode === 'bomb' || this.mode === 'tdm') {
      if (this.scoreCT > this.scoreT) { winner = 'CT'; winnerName = '反恐精英'; }
      else if (this.scoreT > this.scoreCT) { winner = 'T'; winnerName = '恐怖分子'; }
    } else {
      const top = winnerEntity || [...this.entities].sort((a, b) => (this.mode === 'gungame' ? b.gunLevel - a.gunLevel || b.kills - a.kills : b.kills - a.kills))[0];
      winner = top.isPlayer ? 'player' : 'bot';
      winnerName = top.name;
    }
    const mvp = [...this.entities].sort((a, b) => b.score - a.score || b.kills - a.kills)[0];
    const result: MatchResult = {
      winner, winnerName, scoreCT: this.scoreCT, scoreT: this.scoreT, stats, mvp: mvp.name,
      playerKills: this.player.kills, playerDeaths: this.player.deaths, playerHeadshots: this.player.headshots, playerDamage: this.player.damageDealt,
      mode: this.mode, duration: (performance.now() - this.matchStart) / 1000,
    };
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.running = false;
    setTimeout(() => this.onEnd(result), 200);
  }

  announce(text: string, t: number) { this.announcement = text; this.announcementT = t; }

  // ---------------- Physics ----------------
  private overlapsAny(_e: Entity, x: number, y: number, z: number, h: number): MapBox | null {
    const r = RADIUS;
    for (const b of this.solids) {
      if (x + r > b.x1 && x - r < b.x2 && y + h > b.y1 && y < b.y2 && z + r > b.z1 && z - r < b.z2) return b;
    }
    return null;
  }

  private moveEntity(e: Entity, dt: number) {
    const p = e.pos;
    // X
    let dx = e.vel.x * dt;
    if (dx !== 0) {
      const nx = p.x + dx;
      const b = this.overlapsAny(e, nx, p.y + 0.01, p.z, e.height - 0.01);
      if (!b) p.x = nx;
      else {
        const step = b.y2 - p.y;
        if (step > 0 && step <= STEP_H && !this.overlapsAny(e, nx, b.y2 + 0.01, p.z, e.height - 0.01)) { p.x = nx; p.y = b.y2 + 0.001; e.vel.y = Math.max(0, e.vel.y); }
        else { p.x = dx > 0 ? b.x1 - RADIUS - 0.001 : b.x2 + RADIUS + 0.001; e.vel.x = 0; }
      }
    }
    // Z
    let dz = e.vel.z * dt;
    if (dz !== 0) {
      const nz = p.z + dz;
      const b = this.overlapsAny(e, p.x, p.y + 0.01, nz, e.height - 0.01);
      if (!b) p.z = nz;
      else {
        const step = b.y2 - p.y;
        if (step > 0 && step <= STEP_H && !this.overlapsAny(e, p.x, b.y2 + 0.01, nz, e.height - 0.01)) { p.z = nz; p.y = b.y2 + 0.001; e.vel.y = Math.max(0, e.vel.y); }
        else { p.z = dz > 0 ? b.z1 - RADIUS - 0.001 : b.z2 + RADIUS + 0.001; e.vel.z = 0; }
      }
    }
    // Y
    const dy = e.vel.y * dt;
    const ny = p.y + dy;
    const wasGrounded = e.grounded;
    e.grounded = false;
    const b = this.overlapsAny(e, p.x, ny, p.z, e.height);
    if (!b) {
      p.y = ny;
      if (p.y <= 0) { p.y = 0; e.grounded = true; if (e.vel.y < 0) this.onLand(e, wasGrounded); e.vel.y = 0; }
    } else {
      if (dy <= 0) { p.y = b.y2 + 0.001; e.grounded = true; this.onLand(e, wasGrounded); e.vel.y = 0; }
      else { p.y = b.y1 - e.height - 0.001; e.vel.y = 0; }
    }
    // clamp bounds
    p.x = Math.max(MAP_BOUNDS.x1 + 0.5, Math.min(MAP_BOUNDS.x2 - 0.5, p.x));
    p.z = Math.max(MAP_BOUNDS.z1 + 0.5, Math.min(MAP_BOUNDS.z2 - 0.5, p.z));
  }

  private onLand(e: Entity, wasGrounded: boolean) {
    if (wasGrounded) return;
    const v = -e.vel.y;
    if (v > 13) {
      const dmg = Math.round((v - 13) * 4);
      if (dmg > 0) this.damage(e, null, dmg, false, null);
    }
    if (e.isPlayer && v > 4) audio.land();
  }

  private updateMovement(e: Entity, input: InputState, dt: number) {
    if (!e.alive) return;
    const frozen = this.phase === 'freeze' || (e.isPlayer && (this.paused || this.buyOpen));
    const w = e.current.def;
    // crouch
    const wantCrouch = input.crouch && !frozen;
    if (wantCrouch && !e.crouch) { e.crouch = true; e.height = CROUCH_H; }
    else if (!wantCrouch && e.crouch) {
      if (!this.overlapsAny(e, e.pos.x, e.pos.y + 0.01, e.pos.z, STAND_H)) { e.crouch = false; e.height = STAND_H; }
    }
    let speed = PLAYER_SPEED * w.moveSpeed;
    if (e.crouch) speed *= 0.42; else if (input.walk) speed *= 0.5;
    if (e.isPlayer && this.scoped) speed *= 0.55;
    if (e.reloading && !e.isPlayer) speed *= 0.9;
    const busy = e.planting > 0 || e.defusing > 0;
    let mx = frozen || busy ? 0 : input.mx, mz = frozen || busy ? 0 : input.mz;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    const tx = (fx * mz + rx * mx) * speed, tz = (fz * mz + rz * mx) * speed;
    const accel = e.grounded ? 45 : 6;
    const k = Math.min(1, accel * dt / Math.max(1, speed));
    if (e.grounded) {
      e.vel.x += (tx - e.vel.x) * Math.min(1, dt * 12);
      e.vel.z += (tz - e.vel.z) * Math.min(1, dt * 12);
    } else {
      e.vel.x += (tx - e.vel.x) * k * 0.5;
      e.vel.z += (tz - e.vel.z) * k * 0.5;
    }
    if (input.jump && e.grounded && !frozen && !busy) { e.vel.y = JUMP_V; e.grounded = false; }
    e.vel.y -= GRAVITY * dt;
    if (e.vel.y < -40) e.vel.y = -40;
    this.moveEntity(e, dt);
    // footsteps
    const sp = Math.hypot(e.vel.x, e.vel.z);
    if (e.grounded && sp > 2.5 && !input.walk && !e.crouch) {
      e.moveDist += sp * dt;
      if (e.moveDist > 2.4) {
        e.moveDist = 0;
        if (e.isPlayer) audio.footstep(0, 0);
        else { const d = e.pos.distanceTo(this.player.pos); if (d < 22) audio.footstep(this.panFor(e.pos), d); }
        for (const b of this.bots) if (b !== e && b.bot && b.alive && !b.bot.target && b.pos.distanceTo(e.pos) < 9 && this.isEnemy(b, e) && Math.random() < 0.3) b.bot.hear(e.pos, e);
      }
    }
  }

  // ---------------- Main loop ----------------
  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (!this.paused || this.ended) this.update(dt);
    else { this.mouseDx = 0; this.mouseDy = 0; }
    this.render(dt);
    if (now - this.lastHud > 33) { this.lastHud = now; this.onHud(this.buildHud()); }
  };

  private update(dt: number) {
    this.time += dt;
    this.matchTime += dt;
    const p = this.player;
    // ---- player input ----
    if (p.alive && this.pointerLocked && !this.buyOpen) {
      const sens = this.settings.sensitivity * 0.0022 * (this.scoped ? 0.45 : 1);
      p.yaw -= this.mouseDx * sens;
      p.pitch -= this.mouseDy * sens;
      p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    }
    const mdx = this.mouseDx, mdy = this.mouseDy;
    this.mouseDx = 0; this.mouseDy = 0;
    const k = this.keys;
    const locked = this.pointerLocked && !this.buyOpen;
    this.input.mx = locked ? (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) : 0;
    this.input.mz = locked ? (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) : 0;
    this.input.jump = locked && k.has('Space');
    this.input.crouch = locked && (k.has('ControlLeft') || k.has('KeyC'));
    this.input.walk = locked && k.has('ShiftLeft');
    this.input.use = locked && k.has('KeyE');
    this.input.fire = locked && this.mouseDown;

    // phases
    if (this.mode === 'bomb') this.updateBombMode(dt);
    else {
      if (this.matchTime >= this.matchLimitTime) this.endMatch(null);
    }

    // movement
    this.updateMovement(p, this.input, dt);
    const botInput: InputState = { mx: 0, mz: 0, jump: false, fire: false, crouch: false, walk: false, use: false };
    for (const b of this.bots) {
      if (!b.alive) continue;
      b.bot!.update(dt, botInput);
      this.updateMovement(b, botInput, dt);
      if (botInput.fire) this.tryFire(b, b.current.def.auto ? false : false);
      this.handleUse(b, botInput.use, dt);
    }
    // player fire
    if (p.alive && this.input.fire) {
      this.tryFire(p, this.fireHeld);
      this.fireHeld = true;
    } else this.fireHeld = false;
    // scope / secondary
    if (p.alive) {
      const def = p.current.def;
      if (this.mouse2Down && !this.mouse2Prev) {
        if (def.scope) { this.scoped = !this.scoped; audio.click(); }
        else if (def.cls === 'knife' && this.time >= p.nextFire) { // heavy stab
          p.nextFire = this.time + 1.0;
          this.view.swing(); audio.shoot('knife');
          const hit = this.raycastAll(p.eyePos(this._v1), p.forward(this._v2), 2.0, p);
          if (hit?.entity) { const back = hit.entity.forward(this._v3).dot(p.forward(this._v2)) > 0.5; this.damage(hit.entity, p, back ? 180 : 65, hit.head, def, hit.point); }
        }
      }
      this.mouse2Prev = this.mouse2Down;
      if (!def.scope) this.scoped = false;
      this.handleUse(p, this.input.use, dt);
    }
    // reload completion
    for (const e of this.entities) {
      if (e.reloading && this.time >= e.reloadEnd) this.finishReload(e);
      if (e.isPlayer && e.reloading && !this.reloadMidPlayed && this.time >= e.reloadStart + e.current.def.reloadTime * 0.5) { audio.reload(1); this.reloadMidPlayed = true; }
      if (e.isPlayer && !e.reloading) this.reloadMidPlayed = false;
      // bomb pickup
      if (this.droppedBomb && e.alive && e.team === 'T' && this.mode === 'bomb' && e.pos.distanceTo(this.droppedBomb) < 1.4) {
        e.giveWeapon('c4');
        this.bombCarrier = e;
        this.droppedBomb = null;
        if (this.droppedBombMesh) this.droppedBombMesh.visible = false;
        if (e.isPlayer) this.announce('你捡起了炸弹', 2);
      }
    }
    // respawns
    if (this.mode !== 'bomb') {
      for (const e of this.entities) if (!e.alive && this.time >= e.respawnAt && !this.ended) this.spawnEntity(e, false);
    }
    // pickups of dead player's weapon? skip.

    // ---- misc updates ----
    this.updateGrenades(dt);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t += dt; s.life -= dt;
      const sc = Math.min(1, s.t / 1.2);
      s.group.scale.setScalar(sc * (s.life < 2 ? Math.max(0.01, s.life / 2) : 1));
      s.group.rotation.y += dt * 0.1;
      if (s.life <= 0) { this.scene.remove(s.group); this.smokes.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.vel.y -= pt.gravity * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.mesh.position.y < 0.03 && pt.gravity > 0) { pt.mesh.position.y = 0.03; pt.vel.y *= -0.3; pt.vel.x *= 0.7; pt.vel.z *= 0.7; }
      pt.mesh.rotation.x += dt * 3; pt.mesh.rotation.y += dt * 2;
      if (pt.life <= 0) { this.scene.remove(pt.mesh); this.particles.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.mesh); this.tracers.splice(i, 1); }
    }
    for (const b of this.bots) b.updateModel(dt);
    // visibility spotting (for radar)
    this.playerSpottedT -= dt;
    if (this.playerSpottedT <= 0) {
      this.playerSpottedT = 0.25;
      const eye = p.eyePos(this._v1);
      for (const e of this.entities) {
        if (e === p || !e.alive || !this.isEnemy(p, e)) continue;
        let seen = false;
        if (p.alive) {
          const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
          const ang = Math.atan2(-dx, -dz);
          const diff = Math.abs(((ang - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
          if (diff < 1.1 && this.canSee(eye, e.chestPos(this._v2))) seen = true;
        }
        if (!seen && this.mode !== 'ffa' && this.mode !== 'gungame') for (const t of this.bots) { if (t.team === p.team && t.alive && t.bot?.target === e) { seen = true; break; } }
        if (seen) this.spotted.set(e.id, this.time + 1.5);
      }
    }
    this.hitMarkerT -= dt;
    this.announcementT -= dt;
    this.killStreakT -= dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    for (let i = this.damageDirs.length - 1; i >= 0; i--) { this.damageDirs[i].t -= dt; if (this.damageDirs[i].t <= 0) this.damageDirs.splice(i, 1); }
    if (this.deathCamT > 0) this.deathCamT -= dt;
    // view model
    const moving = p.alive && Math.hypot(p.vel.x, p.vel.z) > 0.5 && p.grounded;
    const rp = p.reloading ? (this.time - p.reloadStart) / (p.reloadEnd - p.reloadStart) : 0;
    this.view.update(dt, moving, Math.hypot(p.vel.x, p.vel.z), mdx, mdy, p.reloading, rp, p.current.def.cls, this.scoped);
    // bomb beep
    if (this.bombPlanted && this.bombLight) {
      const freq = Math.max(0.1, this.bombTimer / 40);
      this.bombLight.intensity = Math.sin(this.time * (6 + (1 - freq) * 20)) > 0.6 ? 6 : 0;
    }
  }
  private fireHeld = false;
  private mouse2Prev = false;
  private reloadMidPlayed = false;

  private handleUse(e: Entity, use: boolean, dt: number) {
    if (this.mode !== 'bomb' || !e.alive) { e.planting = 0; e.defusing = 0; return; }
    if (e.team === 'T' && e.bomb && !this.bombPlanted && (this.phase === 'live') && this.inBombSite(e.pos) && (use || (e.isPlayer && this.input.fire && e.current === e.bomb)) && e.grounded) {
      if (e.current !== e.bomb) { if (e.isPlayer) this.switchTo(e, e.bomb); }
      if (e.current === e.bomb && this.time >= e.switchEnd) {
        e.planting += dt / 3.2;
        if (e.isPlayer && Math.floor(e.planting * 16) !== Math.floor((e.planting - dt / 3.2) * 16)) audio.defuseTick();
        if (e.planting >= 1) { e.planting = 0; this.plantBomb(e); }
      }
    } else e.planting = 0;
    if (e.team === 'CT' && this.bombPlanted && this.bombPos && use && e.pos.distanceTo(this.bombPos) < 1.8 && this.phase === 'planted') {
      if (this.bombDefuser && this.bombDefuser !== e && this.bombDefuser.alive && this.bombDefuser.defusing > 0) return;
      this.bombDefuser = e;
      e.defusing += dt / (e.defuser ? 5 : 10);
      if (e.isPlayer && Math.floor(e.defusing * 20) !== Math.floor((e.defusing - dt / (e.defuser ? 5 : 10)) * 20)) audio.defuseTick();
      if (e.defusing >= 1) { e.defusing = 0; this.defuseBomb(e); }
    } else { if (this.bombDefuser === e) this.bombDefuser = null; e.defusing = 0; }
  }

  private updateBombMode(dt: number) {
    if (this.ended) return;
    if (this.phase === 'freeze') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.phase = 'live'; this.announce('回合开始！', 2); audio.roundStart(); if (this.buyOpen) this.toggleBuy(false); }
    } else if (this.phase === 'live') {
      this.roundTime -= dt;
      if (this.roundTime <= 0) { this.roundTime = 0; this.endRound('CT', '时间耗尽'); }
    } else if (this.phase === 'planted') {
      this.bombTimer -= dt;
      if (this.time >= this.nextBeep) {
        const interval = Math.max(0.12, this.bombTimer / 40 * 1.0);
        this.nextBeep = this.time + interval;
        if (this.bombPos && this.bombPos.distanceTo(this.player.pos) < 45) audio.bombBeep();
      }
      if (this.bombTimer <= 0) this.explodeBomb();
    } else if (this.phase === 'end') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.roundNumber++;
        this.startRound();
      }
    }
    if (this.buyOpen && !this.canBuy()) this.toggleBuy(false);
  }

  cycleSpectate() {
    const mates = this.entities.filter((e) => e.alive && e !== this.player && (this.mode === 'ffa' || this.mode === 'gungame' ? true : e.team === this.player.team));
    if (!mates.length) { this.spectateTarget = null; return; }
    const i = this.spectateTarget ? mates.indexOf(this.spectateTarget) : -1;
    this.spectateTarget = mates[(i + 1) % mates.length];
    this.deathCamT = 0;
  }

  private render(dt: number) {
    const p = this.player;
    const cam = this.camera;
    if (p.alive) {
      cam.position.set(p.pos.x, p.eyeY(), p.pos.z);
      cam.rotation.set(0, 0, 0, 'YXZ');
      cam.rotation.y = p.yaw;
      cam.rotation.x = p.pitch;
      if (this.shakeT > 0) {
        const s = this.shakeT * 0.03;
        cam.rotation.x += (Math.random() - 0.5) * s;
        cam.rotation.z += (Math.random() - 0.5) * s;
      }
      const targetFov = this.scoped && p.current.def.scope ? p.current.def.scope : this.settings.fov;
      cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 14);
      cam.updateProjectionMatrix();
      this.view.root.visible = !this.scoped;
    } else {
      this.view.root.visible = false;
      if (this.deathCamT > 0 || !this.spectateTarget || !this.spectateTarget.alive) {
        if (this.spectateTarget && !this.spectateTarget.alive) this.spectateTarget = null;
        if (this.deathCamT <= 0 && !this.spectateTarget) this.cycleSpectate();
        if (this.deathCamT > 0 || !this.spectateTarget) {
          // death cam: rise & look at killer
          const h = 0.6 + (2.5 - Math.max(0, this.deathCamT)) * 0.6;
          cam.position.set(p.pos.x, p.pos.y + h, p.pos.z);
          if (p.lastAttacker && p.lastAttacker !== p) {
            const t = p.lastAttacker.chestPos(this._v1);
            const dx = t.x - cam.position.x, dz = t.z - cam.position.z, dy = t.y - cam.position.y;
            const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
            p.yaw += (((ty - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
            p.pitch += (tp - p.pitch) * Math.min(1, dt * 4);
          }
          cam.rotation.set(0, 0, 0, 'YXZ');
          cam.rotation.y = p.yaw; cam.rotation.x = p.pitch;
        }
      }
      if (this.spectateTarget && this.spectateTarget.alive && this.deathCamT <= 0) {
        const s = this.spectateTarget;
        cam.position.set(s.pos.x, s.eyeY(), s.pos.z);
        cam.rotation.set(0, 0, 0, 'YXZ');
        cam.rotation.y = s.yaw; cam.rotation.x = s.pitch;
        if (s.group) s.group.visible = false;
      }
      cam.fov += (this.settings.fov - cam.fov) * Math.min(1, dt * 10);
      cam.updateProjectionMatrix();
    }
    // bomb mesh float (dropped)
    if (this.droppedBombMesh && this.droppedBombMesh.visible) this.droppedBombMesh.rotation.y += dt;
    this.renderer.render(this.scene, cam);
    // restore spectated model visibility
    if (this.spectateTarget?.group) this.spectateTarget.group.visible = this.spectateTarget.alive;
  }

  // ---------------- HUD ----------------
  statsList(): PlayerStats[] {
    return this.entities.map((e) => ({ id: e.id, name: e.name, team: e.team, kills: e.kills, deaths: e.deaths, assists: e.assists, alive: e.alive, isPlayer: e.isPlayer, money: e.money, score: e.score, gunLevel: e.gunLevel, ping: e.isPlayer ? 5 : e.ping }));
  }

  private whud(w: WeaponInst | null): WeaponHudInfo | null {
    if (!w) return null;
    return { id: w.def.id, name: w.def.name, slot: w.def.slot, ammo: w.def.cls === 'grenade' ? w.ammo : w.ammo, reserve: w.reserve >= 900 ? -1 : w.reserve, count: w.def.cls === 'grenade' ? w.ammo : undefined };
  }

  private buildHud(): HudState {
    const p = this.player;
    const view = p.alive ? p : (this.spectateTarget && this.deathCamT <= 0 ? this.spectateTarget : p);
    let phaseLabel = '';
    if (this.mode === 'bomb') {
      phaseLabel = this.phase === 'freeze' ? '购买阶段' : this.phase === 'planted' ? '炸弹已安放' : this.phase === 'end' ? '回合结束' : '';
    }
    const radarEnts = this.entities.filter((e) => e !== p).map((e) => ({ x: e.pos.x, z: e.pos.z, team: e.team, alive: e.alive, isPlayer: false, visible: !this.isEnemy(p, e) || (this.spotted.get(e.id) ?? 0) > this.time })).filter((e) => e.visible && e.alive);
    const flash = p.flashUntil > this.time ? Math.min(1, (p.flashUntil - this.time) / 1.6) : 0;
    const nearBomb = !!(this.bombPlanted && this.bombPos && p.pos.distanceTo(this.bombPos) < 1.8 && p.team === 'CT');
    return {
      health: Math.max(0, Math.round(view.hp)), armor: Math.round(view.armor), helmet: view.helmet, money: p.money, team: p.team,
      weapon: this.whud(view.current), inventory: view.inventoryList().map((w) => this.whud(w)!),
      reloading: view.reloading, reloadProgress: view.reloading ? (this.time - view.reloadStart) / (view.reloadEnd - view.reloadStart) : 0,
      roundTime: this.mode === 'bomb' ? (this.phase === 'freeze' ? this.phaseT : this.phase === 'planted' ? this.bombTimer : this.roundTime) : Math.max(0, this.matchLimitTime - this.matchTime),
      roundPhase: this.phase, phaseLabel, scoreCT: this.scoreCT, scoreT: this.scoreT, roundNumber: this.roundNumber,
      kills: this.kills.filter((k) => this.time - k.time < 7), stats: this.statsList(), hitMarker: this.hitMarkerT,
      damageDirs: this.damageDirs.map((d) => ({ ...d })), flash, bombPlanted: this.bombPlanted, bombTimer: this.bombTimer, hasBomb: !!p.bomb,
      planting: p.planting, defusing: p.defusing, canBuy: this.canBuy(), announcement: this.announcementT > 0 ? this.announcement : '', announcementT: this.announcementT,
      mode: this.mode, scoped: this.scoped && p.alive, gunLevel: p.gunLevel, gunLevelMax: GUNGAME_ORDER.length,
      radar: { px: view.pos.x, pz: view.pos.z, yaw: view.yaw, entities: radarEnts, bomb: this.bombPos ? { x: this.bombPos.x, z: this.bombPos.z } : this.droppedBomb ? { x: this.droppedBomb.x, z: this.droppedBomb.z } : undefined },
      killStreakText: this.killStreakT > 0 ? this.killStreakText : '', fps: this.fps,
      spectating: !p.alive && this.spectateTarget && this.deathCamT <= 0 ? this.spectateTarget.name : '', respawnIn: !p.alive && this.mode !== 'bomb' ? Math.max(0, p.respawnAt - this.time) : 0, dead: !p.alive,
      nearBombSite: p.alive && this.mode === 'bomb' && !!p.bomb && this.inBombSite(p.pos) && !this.bombPlanted, nearBomb, lowAmmo: !!(view.current.def.mag > 1 && view.current.ammo <= Math.ceil(view.current.def.mag * 0.2)),
    };
  }
}

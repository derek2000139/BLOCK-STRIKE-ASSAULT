import * as THREE from 'three';
import type { Team, WeaponDef } from './types';
import { WEAPONS } from './weapons';
import { makeSkinTexture, makeSolidPixelMaterial } from './textures';
import type { BotBrain } from './bot';

export interface WeaponInst {
  def: WeaponDef;
  ammo: number;
  reserve: number;
}

export function makeWeapon(id: string): WeaponInst {
  const def = WEAPONS[id];
  return { def, ammo: def.mag, reserve: def.reserve };
}

export const STAND_H = 1.8;
export const CROUCH_H = 1.25;
export const EYE_OFF = 0.17; // eye below top of head
export const RADIUS = 0.36;

export class Entity {
  id: number;
  name: string;
  team: Team;
  isPlayer: boolean;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  hp = 100;
  armor = 0;
  helmet = false;
  defuser = false;
  money = 800;
  alive = true;
  grounded = false;
  crouch = false;
  walking = false;
  height = STAND_H;
  kills = 0;
  deaths = 0;
  assists = 0;
  score = 0;
  headshots = 0;
  damageDealt = 0;
  gunLevel = 0;
  gunLevelKills = 0;
  skinVariant = 0;

  primary: WeaponInst | null = null;
  secondary: WeaponInst | null = null;
  melee: WeaponInst = makeWeapon('knife');
  grenades: WeaponInst[] = [];
  bomb: WeaponInst | null = null;
  current: WeaponInst;
  lastWeapon: WeaponInst | null = null;
  nextFire = 0;
  reloading = false;
  reloadStart = 0;
  reloadEnd = 0;
  switchEnd = 0;
  shotsFired = 0; // for recoil pattern
  lastShot = 0;
  flashUntil = 0;
  flashPeak = 0;
  planting = 0; // progress 0..1
  defusing = 0;
  lastFootstep = 0;
  moveDist = 0;
  respawnAt = 0;
  damagers: Map<number, { dmg: number; t: number }> = new Map();
  lastAttacker: Entity | null = null;
  deathTime = 0;
  spawnProtectUntil = 0;
  streak = 0;
  ping = 20 + Math.floor(Math.random() * 60);

  bot: BotBrain | null = null;

  // visuals (bots & remote view)
  group: THREE.Group | null = null;
  parts: { head: THREE.Mesh; body: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; gun: THREE.Mesh; tag?: THREE.Sprite } | null = null;
  animT = 0;

  constructor(id: number, name: string, team: Team, isPlayer: boolean) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.isPlayer = isPlayer;
    this.current = this.melee;
  }

  eyeY() { return this.pos.y + this.height - EYE_OFF; }
  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.eyeY(), this.pos.z); }
  headPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height - 0.25, this.pos.z); }
  chestPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }
  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  inventoryList(): WeaponInst[] {
    const l: WeaponInst[] = [];
    if (this.primary) l.push(this.primary);
    if (this.secondary) l.push(this.secondary);
    l.push(this.melee);
    l.push(...this.grenades);
    if (this.bomb) l.push(this.bomb);
    return l;
  }

  giveWeapon(id: string) {
    const w = makeWeapon(id);
    if (w.def.slot === 'primary') this.primary = w;
    else if (w.def.slot === 'secondary') this.secondary = w;
    else if (w.def.slot === 'grenade') {
      const ex = this.grenades.find((g) => g.def.id === id);
      if (ex) { ex.ammo = Math.min(ex.ammo + 1, id === 'flashbang' ? 2 : 1); return ex; }
      this.grenades.push(w);
    } else if (w.def.slot === 'bomb') this.bomb = w;
    return w;
  }

  removeWeapon(w: WeaponInst) {
    if (this.primary === w) this.primary = null;
    if (this.secondary === w) this.secondary = null;
    if (this.bomb === w) this.bomb = null;
    const gi = this.grenades.indexOf(w);
    if (gi >= 0) this.grenades.splice(gi, 1);
    if (this.current === w) this.current = this.primary || this.secondary || this.melee;
  }

  resetLoadout() {
    this.primary = null;
    this.secondary = null;
    this.grenades = [];
    this.bomb = null;
    this.melee = makeWeapon('knife');
    this.current = this.melee;
    this.lastWeapon = null;
    this.reloading = false;
    this.defuser = false;
  }

  bestWeapon(): WeaponInst {
    return this.primary || this.secondary || this.melee;
  }

  // ---- visuals ----
  buildModel(scene: THREE.Scene, showTag: boolean) {
    const g = new THREE.Group();
    const tex = makeSkinTexture(this.team, this.skinVariant);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const s = 0.9; // scale: MC 2.0 tall -> 1.8
    const uvBox = (w: number, h: number, d: number, region: [number, number, number, number]) => {
      // simple: map entire region to all faces
      const geo = new THREE.BoxGeometry(w * s, h * s, d * s);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const [rx, ry, rw, rh] = region;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (rx + uv.getX(i) * rw) / 64, 1 - (ry + (1 - uv.getY(i)) * rh) / 32);
      }
      return geo;
    };
    const headGeo = new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.5 * s);
    // head faces: +x, -x, +y, -y, +z(front), -z(back) in BoxGeometry order: px, nx, py, ny, pz, nz
    {
      const uv = headGeo.attributes.uv as THREE.BufferAttribute;
      const faceRegions: [number, number, number, number][] = [[0, 8, 8, 8], [16, 8, 8, 8], [8, 0, 8, 8], [16, 0, 8, 8], [8, 8, 8, 8], [24, 8, 8, 8]];
      for (let f = 0; f < 6; f++) {
        const [rx, ry, rw, rh] = faceRegions[f];
        for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / 64, 1 - (ry + (1 - uv.getY(i)) * rh) / 32);
      }
    }
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.75 * s;
    const body = new THREE.Mesh(uvBox(0.5, 0.75, 0.25, [32, 0, 32, 16]), mat);
    body.position.y = 1.125 * s;
    const armL = new THREE.Mesh(uvBox(0.25, 0.75, 0.25, [0, 16, 16, 16]), mat);
    armL.geometry.translate(0, -0.3 * s, 0);
    armL.position.set(-0.375 * s, 1.45 * s, 0);
    const armR = new THREE.Mesh(uvBox(0.25, 0.75, 0.25, [16, 16, 16, 16]), mat);
    armR.geometry.translate(0, -0.3 * s, 0);
    armR.position.set(0.375 * s, 1.45 * s, 0);
    const legL = new THREE.Mesh(uvBox(0.25, 0.75, 0.25, [32, 16, 16, 16]), mat);
    legL.geometry.translate(0, -0.375 * s, 0);
    legL.position.set(-0.125 * s, 0.75 * s, 0);
    const legR = new THREE.Mesh(uvBox(0.25, 0.75, 0.25, [48, 16, 16, 16]), mat);
    legR.geometry.translate(0, -0.375 * s, 0);
    legR.position.set(0.125 * s, 0.75 * s, 0);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.7), makeSolidPixelMaterial('#333', 8, 3));
    gun.position.set(0.2, 1.35 * s, -0.4);
    for (const m of [head, body, armL, armR, legL, legR, gun]) { m.castShadow = true; g.add(m); }
    let tag: THREE.Sprite | undefined;
    if (showTag) {
      tag = makeTag(this.name, this.team === 'CT' ? '#64b5f6' : '#ffcc80');
      tag.position.y = 2.25;
      g.add(tag);
    }
    this.parts = { head, body, armL, armR, legL, legR, gun, tag };
    this.group = g;
    scene.add(g);
  }

  setGunColor(color: string) {
    if (!this.parts) return;
    (this.parts.gun.material as THREE.MeshLambertMaterial).dispose();
    this.parts.gun.material = makeSolidPixelMaterial(color, 8, 3);
  }

  updateModel(dt: number) {
    if (!this.group || !this.parts) return;
    this.group.visible = this.alive;
    if (!this.alive) return;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.animT += dt * speed * 1.8;
    const swing = Math.sin(this.animT) * Math.min(1, speed / 4) * 0.7;
    const { head, body, armL, armR, legL, legR, gun } = this.parts;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    // aiming pose: arms forward
    armR.rotation.x = -Math.PI / 2 + this.pitch * 0.6;
    armL.rotation.x = -Math.PI / 2 + this.pitch * 0.6;
    armL.rotation.y = 0.5;
    gun.rotation.x = this.pitch * 0.6;
    head.rotation.x = -this.pitch * 0.5;
    const crouchScale = this.crouch ? 0.72 : 1;
    body.scale.y = crouchScale;
    body.position.y = 1.125 * 0.9 * crouchScale;
    head.position.y = 1.75 * 0.9 * crouchScale + (this.crouch ? 0.05 : 0);
    armL.position.y = armR.position.y = 1.45 * 0.9 * crouchScale;
    gun.position.y = 1.35 * 0.9 * crouchScale;
    legL.scale.y = legR.scale.y = this.crouch ? 0.6 : 1;
    legL.position.y = legR.position.y = 0.75 * 0.9 * (this.crouch ? 0.6 : 1);
  }
}

function makeTag(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const w = ctx.measureText(text).width + 24;
  ctx.fillRect(128 - w / 2, 10, w, 48);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sp = new THREE.Sprite(m);
  sp.scale.set(1.6, 0.4, 1);
  return sp;
}

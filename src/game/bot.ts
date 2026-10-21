import * as THREE from 'three';
import type { Entity } from './entity';
import type { Difficulty } from './types';
import type { Engine } from './Engine';
import { BOMB_SITES } from './map';

export interface DiffParams { reaction: number; aimSpeed: number; aimError: number; vision: number; fov: number; headshotBias: number; burst: number; recoilControl: number }
export const DIFFICULTY: Record<Difficulty, DiffParams> = {
  easy: { reaction: 0.9, aimSpeed: 2.5, aimError: 0.09, vision: 40, fov: 100, headshotBias: 0.1, burst: 3, recoilControl: 0.3 },
  normal: { reaction: 0.5, aimSpeed: 4.5, aimError: 0.05, vision: 60, fov: 120, headshotBias: 0.25, burst: 4, recoilControl: 0.55 },
  hard: { reaction: 0.28, aimSpeed: 7.5, aimError: 0.028, vision: 80, fov: 140, headshotBias: 0.45, burst: 6, recoilControl: 0.75 },
  expert: { reaction: 0.14, aimSpeed: 12, aimError: 0.014, vision: 110, fov: 170, headshotBias: 0.65, burst: 8, recoilControl: 0.9 },
};

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class BotBrain {
  e: Entity;
  eng: Engine;
  p: DiffParams;
  path: number[] = [];
  pathIdx = 0;
  goalNode = -1;
  repathT = 0;
  target: Entity | null = null;
  lastSeen = new THREE.Vector3();
  lastSeenT = -100;
  reactionUntil = 0;
  perceiveT = 0;
  strafeDir = 1;
  strafeT = 0;
  burstCount = 0;
  burstPause = 0;
  stuckT = 0;
  lastPos = new THREE.Vector3();
  aimYaw = 0;
  aimPitch = 0;
  investigate: THREE.Vector3 | null = null;
  holdT = 0;
  wantCrouch = false;
  grenadeCd = 0;
  personality = Math.random(); // 0 = cautious, 1 = aggressive
  siteChoice = 0;
  unstickT = 0;
  unstickX = 0;
  unstickZ = 0;

  constructor(e: Entity, eng: Engine, diff: Difficulty) {
    this.e = e;
    this.eng = eng;
    this.p = DIFFICULTY[diff];
    this.aimYaw = e.yaw;
  }

  reset() {
    this.path = [];
    this.pathIdx = 0;
    this.goalNode = -1;
    this.target = null;
    this.investigate = null;
    this.lastSeenT = -100;
    this.holdT = 0;
    this.aimYaw = this.e.yaw;
    this.aimPitch = 0;
    this.siteChoice = Math.random() < 0.5 ? 0 : 1;
  }

  hear(pos: THREE.Vector3, from: Entity) {
    if (!this.e.alive || from === this.e) return;
    if (!this.eng.isEnemy(this.e, from)) return;
    if (this.target) return;
    if (this.investigate && Math.random() < 0.5) return;
    this.investigate = pos.clone();
    this.lastSeen.copy(pos);
    this.lastSeenT = this.eng.time - 1;
  }

  onDamaged(attacker: Entity) {
    if (!this.eng.isEnemy(this.e, attacker)) return;
    this.lastSeen.copy(attacker.pos);
    this.lastSeenT = this.eng.time;
    this.investigate = attacker.pos.clone();
    if (!this.target) {
      // turn toward attacker quickly
      const dx = attacker.pos.x - this.e.pos.x, dz = attacker.pos.z - this.e.pos.z;
      this.aimYaw = Math.atan2(-dx, -dz);
      this.reactionUntil = Math.min(this.reactionUntil, this.eng.time + this.p.reaction * 0.5);
    }
  }

  private perceive() {
    const eng = this.eng;
    const e = this.e;
    let best: Entity | null = null;
    let bestD = Infinity;
    const eye = e.eyePos(tmp);
    const fwdYaw = e.yaw;
    for (const o of eng.entities) {
      if (o === e || !o.alive || !eng.isEnemy(e, o)) continue;
      const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > this.p.vision) continue;
      // FOV check
      const ang = Math.atan2(-dx, -dz);
      let diff = Math.abs(((ang - fwdYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      if (d > 3 && diff > (this.p.fov * Math.PI) / 360) continue;
      // flashed bots can't see
      if (e.flashUntil > eng.time && (e.flashUntil - eng.time) > 1.2) continue;
      const chest = o.chestPos(tmp2);
      if (!eng.canSee(eye, chest) && !eng.canSee(eye, o.headPos(tmp2))) continue;
      // distance scoring: prefer closer, prefer the ones who damaged us
      const score = d * (o === e.lastAttacker ? 0.6 : 1);
      if (score < bestD) { bestD = score; best = o; }
    }
    if (best) {
      if (this.target !== best) {
        this.reactionUntil = eng.time + this.p.reaction * (0.7 + Math.random() * 0.6);
        this.burstCount = 0;
      }
      this.target = best;
      this.lastSeen.copy(best.pos);
      this.lastSeenT = eng.time;
      this.investigate = null;
    } else {
      if (this.target) {
        this.investigate = this.lastSeen.clone();
      }
      this.target = null;
    }
  }

  private chooseGoal() {
    const eng = this.eng;
    const e = this.e;
    const nodes = eng.navNodes;
    let goal = -1;
    if (eng.mode === 'bomb') {
      const site = BOMB_SITES[this.siteChoice];
      if (e.team === 'T') {
        if (eng.bombPlanted && eng.bombPos) {
          // defend bomb: node within 14m of bomb
          goal = eng.randomNodeNear(eng.bombPos.x, eng.bombPos.z, 14, 2);
        } else if (eng.droppedBomb && !eng.bombCarrier) {
          goal = eng.nearestNode(eng.droppedBomb.x, eng.droppedBomb.y, eng.droppedBomb.z);
        } else if (e.bomb) {
          goal = eng.nearestNode(site.cx, 0, site.cz);
        } else {
          // escort / spread around chosen site
          const carrier = eng.bombCarrier;
          const s = carrier && carrier.bot ? BOMB_SITES[carrier.bot.siteChoice] : site;
          goal = Math.random() < 0.6 ? eng.randomNodeNear(s.cx, s.cz, 16, 1) : eng.randomNode();
        }
      } else {
        if (eng.bombPlanted && eng.bombPos) {
          goal = eng.nearestNode(eng.bombPos.x, eng.bombPos.y, eng.bombPos.z);
        } else {
          const r = Math.random();
          if (r < 0.35) goal = eng.randomNodeNear(BOMB_SITES[0].cx, BOMB_SITES[0].cz, 14, 1);
          else if (r < 0.6) goal = eng.randomNodeNear(BOMB_SITES[1].cx, BOMB_SITES[1].cz, 14, 1);
          else if (r < 0.8 && this.personality > 0.4) goal = eng.randomNode();
          else goal = eng.randomNodeNear(0, 0, 22, 1);
        }
      }
    } else {
      // deathmatch-like: hunt
      const enemies = eng.entities.filter((o) => o !== e && o.alive && eng.isEnemy(e, o));
      if (enemies.length && Math.random() < 0.55) {
        const t = enemies[Math.floor(Math.random() * enemies.length)];
        goal = eng.randomNodeNear(t.pos.x, t.pos.z, 10, 1);
      } else goal = eng.randomNode();
    }
    if (goal < 0) goal = eng.randomNode();
    this.goalNode = goal;
    const start = eng.nearestNode(e.pos.x, e.pos.y, e.pos.z);
    this.path = eng.findPath(start, goal);
    this.pathIdx = 0;
    // skip start node if we're basically on it
    if (this.path.length > 1) {
      const n0 = nodes[this.path[0]];
      if (Math.hypot(n0.x - e.pos.x, n0.z - e.pos.z) < 1.0) this.pathIdx = 1;
    }
    this.repathT = 0;
  }

  private pathTo(x: number, y: number, z: number) {
    const start = this.eng.nearestNode(this.e.pos.x, this.e.pos.y, this.e.pos.z);
    const goal = this.eng.nearestNode(x, y, z);
    this.goalNode = goal;
    this.path = this.eng.findPath(start, goal);
    this.pathIdx = this.path.length > 1 ? 1 : 0;
    this.repathT = 0;
  }

  update(dt: number, input: { mx: number; mz: number; jump: boolean; fire: boolean; crouch: boolean; walk: boolean; use: boolean }) {
    const eng = this.eng;
    const e = this.e;
    const now = eng.time;
    input.mx = 0; input.mz = 0; input.jump = false; input.fire = false; input.crouch = false; input.walk = false; input.use = false;
    if (!e.alive) return;
    if (eng.phase === 'freeze') {
      // look around
      this.aimYaw += Math.sin(now * 0.7 + e.id) * dt * 0.4;
      e.yaw = this.aimYaw; e.pitch = 0;
      return;
    }

    this.perceiveT -= dt;
    if (this.perceiveT <= 0) { this.perceiveT = 0.1 + Math.random() * 0.05; this.perceive(); }
    this.grenadeCd -= dt;

    const w = e.current;
    const inCombat = !!this.target && this.target.alive;

    // ---------- weapon management ----------
    if (!e.reloading) {
      if (w.def.cls !== 'knife' && w.def.cls !== 'grenade' && w.def.cls !== 'c4' && w.ammo === 0) {
        if (w.reserve > 0) eng.startReload(e);
        else {
          const alt = (w === e.primary ? e.secondary : e.primary);
          if (alt && alt.ammo + alt.reserve > 0) eng.switchTo(e, alt);
          else eng.switchTo(e, e.melee);
        }
      } else if (!inCombat && w.def.cls !== 'knife' && w.def.cls !== 'grenade' && w.def.cls !== 'c4' && w.ammo < w.def.mag * 0.35 && w.reserve > 0) {
        eng.startReload(e);
      }
      // ensure holding best weapon when enemies around (not grenade/c4 unless planting)
      if ((w.def.cls === 'grenade' || w.def.cls === 'c4' || (w.def.cls === 'knife' && (e.primary || e.secondary))) && (inCombat || !this.wantsPlantNow())) {
        const best = e.bestWeapon();
        if (best !== w && (best.ammo > 0 || best.reserve > 0)) eng.switchTo(e, best);
      }
    }

    // ---------- objective handling (bomb) ----------
    let objectiveBusy = false;
    if (eng.mode === 'bomb') {
      if (e.team === 'T' && e.bomb && !eng.bombPlanted && eng.inBombSite(e.pos) && !inCombat) {
        // plant
        if (e.current !== e.bomb) eng.switchTo(e, e.bomb);
        input.use = true;
        objectiveBusy = true;
        this.wantCrouch = true;
      } else if (e.team === 'CT' && eng.bombPlanted && eng.bombPos && !inCombat && e.pos.distanceTo(eng.bombPos) < 1.6) {
        input.use = true;
        objectiveBusy = true;
        this.wantCrouch = true;
      } else this.wantCrouch = false;
    }

    // ---------- movement ----------
    let moveDirX = 0, moveDirZ = 0;
    let lookYaw: number | null = null;
    if (objectiveBusy) {
      // stand still; look toward the door-ish direction (random)
    } else if (inCombat && this.target) {
      const t = this.target;
      const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const nx = dx / (d || 1), nz = dz / (d || 1);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.5 + Math.random() * 0.9; this.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.3) this.strafeDir = 0; }
      const cls = w.def.cls;
      if (cls === 'knife') { moveDirX = nx; moveDirZ = nz; }
      else if (cls === 'sniper') { moveDirX = 0; moveDirZ = 0; this.wantCrouch = d > 20 && Math.random() < 0.02 ? !this.wantCrouch : this.wantCrouch; }
      else {
        // strafe perpendicular
        moveDirX = -nz * this.strafeDir; moveDirZ = nx * this.strafeDir;
        const want = cls === 'shotgun' ? 6 : cls === 'smg' ? 12 : 18;
        if (d > want + 6) { moveDirX += nx * 0.8; moveDirZ += nz * 0.8; }
        else if (d < 4 && cls !== 'shotgun') { moveDirX -= nx * 0.5; moveDirZ -= nz * 0.5; }
        // accuracy: stop while shooting at longer range (counter-strafe)
        if (d > 14 && this.burstCount > 0 && this.p.recoilControl > 0.5) { moveDirX *= 0.1; moveDirZ *= 0.1; }
      }
      // stuck against wall while strafing -> flip
      // follow path to reach target if it's far (target may be visible but far)
      if (d > 30 && cls !== 'sniper') {
        this.repathT -= dt;
        if (this.repathT <= 0) { this.pathTo(t.pos.x, t.pos.y, t.pos.z); this.repathT = 1.5; }
        const nd = this.followPath(dt);
        if (nd) { moveDirX = nd.x; moveDirZ = nd.z; }
      }
    } else {
      // navigate
      if (this.investigate && this.goalNode < 0) {
        this.pathTo(this.investigate.x, this.investigate.y, this.investigate.z);
      }
      if (this.investigate && (this.holdT <= 0)) {
        const d = Math.hypot(this.investigate.x - e.pos.x, this.investigate.z - e.pos.z);
        if (d < 2.5 || now - this.lastSeenT > 12) { this.investigate = null; this.holdT = 1 + Math.random() * 2; this.goalNode = -1; }
        else if (this.repathT <= 0) { this.pathTo(this.investigate.x, this.investigate.y, this.investigate.z); this.repathT = 2; }
      }
      this.repathT -= dt;
      if (this.holdT > 0) {
        this.holdT -= dt;
        // look around at last seen
        if (this.investigate) lookYaw = Math.atan2(-(this.lastSeen.x - e.pos.x), -(this.lastSeen.z - e.pos.z));
      } else {
        if (this.goalNode < 0 || this.pathIdx >= this.path.length || this.path.length === 0) {
          // arrived or no goal
          if (this.goalNode >= 0 && Math.random() < 0.5 && eng.mode === 'bomb') this.holdT = 1.5 + Math.random() * 3;
          this.chooseGoal();
        }
        const nd = this.followPath(dt);
        if (nd) { moveDirX = nd.x; moveDirZ = nd.z; }
      }
      // periodically re-evaluate the goal in bomb mode when bomb state changes
      if (eng.mode === 'bomb' && this.repathT < -8) { this.goalNode = -1; }
    }

    // stuck detection & unstick maneuver
    if (this.unstickT > 0) {
      this.unstickT -= dt;
      moveDirX = this.unstickX; moveDirZ = this.unstickZ;
      if (this.unstickT < 0.25) input.jump = true;
    }
    this.stuckT += dt;
    if (this.stuckT > 1.0) {
      const moved = this.lastPos.distanceTo(e.pos);
      const wantsMove = Math.abs(moveDirX) + Math.abs(moveDirZ) > 0.1;
      if (wantsMove && moved < 0.35 && this.unstickT <= 0) {
        // back off perpendicular/backward for a moment, then repath
        const l = Math.hypot(moveDirX, moveDirZ) || 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        this.unstickX = (-moveDirZ / l) * side - (moveDirX / l) * 0.6;
        this.unstickZ = (moveDirX / l) * side - (moveDirZ / l) * 0.6;
        this.unstickT = 0.5 + Math.random() * 0.4;
        this.strafeDir = -this.strafeDir;
        if (Math.random() < 0.4) { this.goalNode = -1; this.path = []; }
        else this.repathT = 0;
      }
      this.stuckT = 0;
      this.lastPos.copy(e.pos);
    }

    // convert world move dir into entity-local input
    const len = Math.hypot(moveDirX, moveDirZ);
    if (len > 0.01) {
      moveDirX /= len; moveDirZ /= len;
      if (lookYaw === null && !inCombat) lookYaw = Math.atan2(-moveDirX, -moveDirZ);
      const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
      // forward vector = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
      input.mz = moveDirX * -sy + moveDirZ * -cy;
      input.mx = moveDirX * cy + moveDirZ * -sy;
    }
    input.crouch = this.wantCrouch && (objectiveBusy || inCombat);
    if (input.crouch && inCombat && Math.random() < 0.01) this.wantCrouch = false;

    // ---------- aiming ----------
    let desiredYaw = this.aimYaw, desiredPitch = 0;
    if (inCombat && this.target) {
      const t = this.target;
      const aimHead = Math.random() < this.p.headshotBias || w.def.cls === 'sniper' || w.def.id === 'deagle';
      const tp = aimHead ? t.headPos(tmp) : t.chestPos(tmp);
      const eye = e.eyePos(tmp2);
      const dx = tp.x - eye.x, dy = tp.y - eye.y, dz = tp.z - eye.z;
      const dist = Math.hypot(dx, dz);
      // aim error shrinking with tracking time
      const tracked = Math.min(1, (now - this.reactionUntil + this.p.reaction) / 1.5);
      const err = this.p.aimError * (1.6 - tracked) * (e.flashUntil > now ? 4 : 1);
      desiredYaw = Math.atan2(-dx, -dz) + Math.sin(now * 3.1 + e.id) * err;
      desiredPitch = Math.atan2(dy, dist) + Math.cos(now * 2.3 + e.id * 2) * err;
      // leading moving target a little (expert)
      if (this.p.recoilControl > 0.8) {
        desiredYaw += (-(t.vel.x) * Math.cos(e.yaw) + (t.vel.z) * Math.sin(e.yaw)) * 0.0;
      }
    } else if (lookYaw !== null) {
      desiredYaw = lookYaw;
      desiredPitch = 0;
    } else if (this.investigate) {
      desiredYaw = Math.atan2(-(this.lastSeen.x - e.pos.x), -(this.lastSeen.z - e.pos.z));
    }
    // normalize to shortest turn
    let dyaw = desiredYaw - this.aimYaw;
    dyaw = ((dyaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const sp = inCombat ? this.p.aimSpeed : 6;
    const k = Math.min(1, dt * sp);
    this.aimYaw += dyaw * k;
    this.aimPitch += (desiredPitch - this.aimPitch) * k;
    this.aimYaw = ((this.aimYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    e.yaw = this.aimYaw;
    e.pitch = Math.max(-1.4, Math.min(1.4, this.aimPitch));

    // ---------- firing ----------
    if (inCombat && this.target && now > this.reactionUntil && !e.reloading && !objectiveBusy) {
      const t = this.target;
      const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const angErr = Math.abs(dyaw);
      const cls = w.def.cls;
      const tolerance = cls === 'sniper' ? 0.012 : 0.06 + 0.5 / Math.max(1, d);
      if (cls === 'knife') {
        if (d < 2.0) input.fire = true;
      } else if (cls === 'grenade' || cls === 'c4') {
        // handled by weapon switch above
      } else if (angErr < tolerance && d < w.def.range * 1.3) {
        this.burstPause -= dt;
        if (this.burstPause <= 0) {
          input.fire = true;
          if (w.def.auto) {
            this.burstCount += dt * (w.def.rpm / 60);
            const burstLen = d < 10 ? this.p.burst * 3 : this.p.burst;
            if (this.burstCount > burstLen) { this.burstCount = 0; this.burstPause = 0.25 + (1 - this.p.recoilControl) * 0.4; }
          } else {
            // semi auto: tap
            this.burstPause = cls === 'sniper' ? 0.1 : 0.12 + (1 - this.p.recoilControl) * 0.1;
          }
        }
      }
    } else {
      this.burstCount = Math.max(0, this.burstCount - dt * 4);
    }

    // ---------- grenades ----------
    if (!inCombat && this.investigate && this.grenadeCd <= 0 && e.grenades.length && now - this.lastSeenT < 4) {
      const g = e.grenades.find((x) => x.def.grenade === 'he' || x.def.grenade === 'flash');
      const d = Math.hypot(this.investigate.x - e.pos.x, this.investigate.z - e.pos.z);
      if (g && d > 8 && d < 30 && Math.random() < 0.4) {
        eng.botThrow(e, g, this.investigate);
        this.grenadeCd = 15;
      } else this.grenadeCd = 3;
    }
  }

  private wantsPlantNow() {
    const eng = this.eng; const e = this.e;
    return eng.mode === 'bomb' && e.team === 'T' && !!e.bomb && !eng.bombPlanted && eng.inBombSite(e.pos);
  }

  private followPath(dt: number): { x: number; z: number } | null {
    const eng = this.eng;
    const e = this.e;
    if (this.pathIdx >= this.path.length) return null;
    const n = eng.navNodes[this.path[this.pathIdx]];
    const dx = n.x - e.pos.x, dz = n.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const reachR = this.pathIdx === this.path.length - 1 ? 1.0 : 1.3;
    if (d < reachR) {
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) { this.goalNode = -1; return null; }
      return this.followPath(dt);
    }
    // jump if node is above us (crate climbing) and we're close
    if (n.y - e.pos.y > 0.6 && d < 1.6) {
      // can't jump high; let engine step
    }
    return { x: dx / d, z: dz / d };
  }
}

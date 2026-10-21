import * as THREE from 'three';
import type { WeaponDef } from './types';
import { makeSolidPixelMaterial } from './textures';

// Builds a blocky first-person weapon model for each weapon class
export class ViewModel {
  root = new THREE.Group();
  gun = new THREE.Group();
  hands = new THREE.Group();
  muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#ffe082' }));
  muzzleLight = new THREE.PointLight('#ffb74d', 0, 6);
  currentId = '';
  bob = 0;
  kick = 0;
  swayX = 0;
  swayY = 0;
  reloadAnim = 0;
  drawAnim = 0;
  knifeSwing = 0;
  muzzleT = 0;
  scoped = false;

  constructor(camera: THREE.Camera) {
    camera.add(this.root);
    this.root.add(this.gun);
    this.root.add(this.hands);
    this.muzzle.visible = false;
    this.root.add(this.muzzle);
    this.root.add(this.muzzleLight);
    this.muzzleLight.position.set(0.3, -0.2, -1.2);
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length) {
      const c = g.children.pop() as THREE.Mesh;
      c.geometry?.dispose();
    }
  }

  build(def: WeaponDef) {
    if (this.currentId === def.id) return;
    this.currentId = def.id;
    this.clearGroup(this.gun);
    this.clearGroup(this.hands);
    const main = makeSolidPixelMaterial(def.color, 10, 11);
    const dark = makeSolidPixelMaterial('#1f1f1f', 6, 12);
    const wood = makeSolidPixelMaterial('#6d4c41', 12, 13);
    const metal = makeSolidPixelMaterial('#9e9e9e', 10, 14);
    const skin = makeSolidPixelMaterial('#e0ac69', 10, 15);
    const glove = makeSolidPixelMaterial('#2b2b2b', 6, 16);
    const add = (g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    const G = this.gun;
    switch (def.cls) {
      case 'knife':
        add(G, 0.05, 0.12, 0.16, 0, 0, 0, dark); // handle
        add(G, 0.02, 0.08, 0.3, 0, 0.02, -0.22, metal); // blade
        add(G, 0.02, 0.03, 0.1, 0, 0.07, -0.3, metal);
        add(this.hands, 0.1, 0.1, 0.12, 0, -0.08, 0.04, glove);
        add(this.hands, 0.09, 0.14, 0.09, 0, -0.2, 0.08, skin);
        break;
      case 'pistol':
        add(G, 0.07, 0.1, 0.28, 0, 0.02, -0.1, main);
        add(G, 0.04, 0.04, 0.12, 0, 0.03, -0.3, dark); // barrel
        add(G, 0.06, 0.16, 0.08, 0, -0.1, 0.04, dark); // grip
        add(G, 0.02, 0.03, 0.02, 0, 0.09, -0.22, dark); // sight
        if (def.id === 'usp') add(G, 0.05, 0.05, 0.16, 0, 0.03, -0.42, dark);
        add(this.hands, 0.1, 0.12, 0.1, 0.0, -0.1, 0.06, glove);
        add(this.hands, 0.09, 0.14, 0.09, 0.0, -0.22, 0.1, skin);
        break;
      case 'smg':
        add(G, 0.08, 0.12, 0.5, 0, 0, -0.1, main);
        add(G, 0.04, 0.04, 0.2, 0, 0.02, -0.45, dark);
        add(G, 0.06, 0.22, 0.06, 0, -0.14, -0.08, dark); // mag
        add(G, 0.06, 0.14, 0.08, 0, -0.1, 0.1, dark); // grip
        add(G, 0.05, 0.05, 0.25, 0, 0.0, 0.25, metal); // stock
        add(G, 0.02, 0.04, 0.02, 0, 0.08, -0.3, dark);
        add(this.hands, 0.1, 0.1, 0.1, 0, -0.11, 0.1, glove);
        add(this.hands, 0.09, 0.1, 0.1, -0.02, -0.07, -0.3, glove);
        add(this.hands, 0.09, 0.14, 0.09, -0.01, -0.2, -0.3, skin);
        break;
      case 'rifle':
        add(G, 0.08, 0.12, 0.62, 0, 0, -0.1, main);
        add(G, 0.05, 0.05, 0.3, 0, 0.02, -0.55, dark);
        add(G, 0.06, 0.1, 0.3, 0, -0.03, -0.35, def.id === 'ak47' || def.id === 'galil' ? wood : dark); // handguard
        add(G, 0.06, 0.24, 0.07, 0, -0.14, -0.05, dark); // mag
        add(G, 0.06, 0.14, 0.08, 0, -0.11, 0.12, dark); // grip
        add(G, 0.06, 0.1, 0.3, 0, -0.02, 0.35, def.id === 'ak47' ? wood : main); // stock
        add(G, 0.02, 0.05, 0.02, 0, 0.08, -0.35, dark); // front sight
        if (def.scope) add(G, 0.06, 0.06, 0.2, 0, 0.1, -0.05, dark);
        else add(G, 0.05, 0.04, 0.08, 0, 0.08, 0.1, dark); // rear sight/carry
        add(this.hands, 0.1, 0.1, 0.1, 0, -0.12, 0.12, glove);
        add(this.hands, 0.1, 0.1, 0.12, -0.02, -0.1, -0.36, glove);
        add(this.hands, 0.09, 0.14, 0.09, -0.01, -0.22, -0.36, skin);
        break;
      case 'sniper':
        add(G, 0.08, 0.12, 0.8, 0, 0, -0.15, main);
        add(G, 0.05, 0.05, 0.4, 0, 0.03, -0.7, dark);
        add(G, 0.07, 0.07, 0.3, 0, 0.12, -0.1, dark); // scope
        add(G, 0.08, 0.08, 0.04, 0, 0.12, 0.06, metal);
        add(G, 0.06, 0.16, 0.07, 0, -0.1, 0.0, dark); // mag
        add(G, 0.06, 0.14, 0.08, 0, -0.1, 0.15, dark);
        add(G, 0.07, 0.12, 0.3, 0, -0.03, 0.4, main); // stock
        add(G, 0.02, 0.1, 0.02, 0, -0.1, -0.4, dark); // bipod
        add(this.hands, 0.1, 0.1, 0.1, 0, -0.12, 0.15, glove);
        add(this.hands, 0.1, 0.1, 0.12, -0.02, -0.1, -0.4, glove);
        add(this.hands, 0.09, 0.14, 0.09, -0.01, -0.22, -0.4, skin);
        break;
      case 'shotgun':
        add(G, 0.08, 0.12, 0.6, 0, 0, -0.1, main);
        add(G, 0.06, 0.06, 0.35, 0, 0.03, -0.5, dark);
        add(G, 0.06, 0.06, 0.35, 0, -0.04, -0.5, metal); // tube
        add(G, 0.07, 0.08, 0.18, 0, -0.04, -0.3, wood); // pump
        add(G, 0.07, 0.12, 0.3, 0, -0.03, 0.35, wood); // stock
        add(G, 0.06, 0.12, 0.08, 0, -0.1, 0.12, wood);
        add(this.hands, 0.1, 0.1, 0.1, 0, -0.12, 0.12, glove);
        add(this.hands, 0.1, 0.1, 0.12, -0.02, -0.12, -0.3, glove);
        add(this.hands, 0.09, 0.14, 0.09, -0.01, -0.24, -0.3, skin);
        break;
      case 'heavy':
        add(G, 0.1, 0.14, 0.7, 0, 0, -0.1, main);
        add(G, 0.06, 0.06, 0.35, 0, 0.03, -0.6, dark);
        add(G, 0.14, 0.18, 0.2, -0.04, -0.12, -0.05, dark); // box mag
        add(G, 0.06, 0.14, 0.08, 0, -0.11, 0.15, dark);
        add(G, 0.07, 0.12, 0.3, 0, -0.02, 0.4, main);
        add(G, 0.02, 0.1, 0.02, -0.03, -0.12, -0.45, metal);
        add(G, 0.02, 0.1, 0.02, 0.03, -0.12, -0.45, metal);
        add(this.hands, 0.1, 0.1, 0.1, 0, -0.12, 0.15, glove);
        add(this.hands, 0.1, 0.1, 0.12, -0.02, -0.1, -0.4, glove);
        add(this.hands, 0.09, 0.14, 0.09, -0.01, -0.22, -0.4, skin);
        break;
      case 'grenade': {
        const col = def.grenade === 'he' ? '#2e7d32' : def.grenade === 'flash' ? '#90a4ae' : '#607d8b';
        const m = makeSolidPixelMaterial(col, 10, 17);
        add(G, 0.12, 0.16, 0.12, 0, -0.05, 0, m);
        add(G, 0.06, 0.05, 0.06, 0, 0.06, 0, metal);
        add(G, 0.02, 0.06, 0.08, 0.05, 0.04, 0, metal); // spoon
        add(this.hands, 0.1, 0.1, 0.12, 0, -0.15, 0.04, glove);
        add(this.hands, 0.09, 0.14, 0.09, 0, -0.26, 0.08, skin);
        break;
      }
      case 'c4': {
        const m = makeSolidPixelMaterial('#5d4037', 10, 18);
        add(G, 0.22, 0.06, 0.16, 0, -0.05, 0, m);
        add(G, 0.12, 0.04, 0.08, 0, 0.0, 0, dark);
        add(G, 0.02, 0.02, 0.02, -0.04, 0.03, 0, new THREE.MeshBasicMaterial({ color: '#ff1744' }));
        add(G, 0.06, 0.02, 0.04, 0.03, 0.03, 0, new THREE.MeshBasicMaterial({ color: '#69f0ae' }));
        add(this.hands, 0.1, 0.1, 0.12, -0.1, -0.12, 0.04, glove);
        add(this.hands, 0.1, 0.1, 0.12, 0.1, -0.12, 0.04, glove);
        break;
      }
    }
    this.drawAnim = 1;
  }

  flash(cls: string) {
    this.muzzleT = cls === 'sniper' || cls === 'shotgun' ? 0.08 : 0.045;
    this.kick = Math.min(1, this.kick + (cls === 'sniper' ? 1 : cls === 'shotgun' ? 0.8 : cls === 'pistol' ? 0.5 : 0.35));
  }
  swing() { this.knifeSwing = 1; }

  update(dt: number, moving: boolean, speed: number, mouseDx: number, mouseDy: number, reloading: boolean, reloadProgress: number, cls: string, scoped: boolean) {
    this.scoped = scoped;
    if (moving) this.bob += dt * speed * 2.2;
    this.kick = Math.max(0, this.kick - dt * 6);
    this.drawAnim = Math.max(0, this.drawAnim - dt * 3.2);
    this.knifeSwing = Math.max(0, this.knifeSwing - dt * 5);
    this.swayX += (-mouseDx * 0.0006 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (mouseDy * 0.0006 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX));
    this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY));
    const bobX = Math.sin(this.bob) * 0.012 * (moving ? 1 : 0);
    const bobY = Math.abs(Math.cos(this.bob)) * 0.01 * (moving ? 1 : 0);
    let baseX = 0.28, baseY = -0.26, baseZ = -0.55;
    if (cls === 'knife') { baseX = 0.3; baseY = -0.3; baseZ = -0.45; }
    if (cls === 'grenade' || cls === 'c4') { baseX = 0.25; baseY = -0.28; baseZ = -0.5; }
    if (scoped) { baseX = 0; baseY = -0.4; baseZ = -0.3; }
    const dip = reloading ? Math.sin(reloadProgress * Math.PI) * 0.18 : 0;
    const drawDip = this.drawAnim * 0.35;
    this.root.position.set(baseX + bobX + this.swayX, baseY + bobY + this.swayY - dip - drawDip, baseZ + this.kick * 0.12);
    this.root.rotation.set(-this.kick * 0.25 + (reloading ? -Math.sin(reloadProgress * Math.PI) * 0.6 : 0) + this.drawAnim * 0.6, 0.05 + this.swayX * 2, reloading ? Math.sin(reloadProgress * Math.PI) * 0.3 : 0);
    if (cls === 'knife' && this.knifeSwing > 0) {
      const s = Math.sin(this.knifeSwing * Math.PI);
      this.root.rotation.x -= s * 0.9;
      this.root.rotation.y -= s * 0.8;
      this.root.position.z -= s * 0.25;
      this.root.position.x -= s * 0.2;
    }
    this.muzzleT -= dt;
    const show = this.muzzleT > 0;
    this.muzzle.visible = show;
    this.muzzleLight.intensity = show ? 3 : 0;
    if (show) {
      this.muzzle.position.set(0, 0.02, cls === 'pistol' ? -0.45 : cls === 'sniper' ? -1.0 : -0.8);
      this.muzzle.rotation.z += dt * 40;
      this.muzzle.scale.setScalar(0.8 + Math.random() * 0.8);
    }
    this.root.visible = !scoped;
  }
}

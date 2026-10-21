import * as THREE from 'three';

// Simple seeded random for deterministic textures
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb(c: [number, number, number], v = 0) {
  const cl = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `rgb(${cl(c[0] + v)},${cl(c[1] + v)},${cl(c[2] + v)})`;
}

type Painter = (ctx: CanvasRenderingContext2D, size: number, r: () => number) => void;

const SIZE = 16;

function noiseFill(base: string, variance: number, _seed: number): Painter {
  const c = hexToRgb(base);
  return (ctx, size, r) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        ctx.fillStyle = rgb(c, (r() - 0.5) * variance * 2);
        ctx.fillRect(x, y, 1, 1);
      }
  };
}

const painters: Record<string, Painter> = {
  grass: (ctx, s, r) => {
    noiseFill('#5c9e3a', 14, 1)(ctx, s, r);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = r() > 0.5 ? '#4e8a30' : '#6db04a';
      ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 1);
    }
  },
  dirt: noiseFill('#8a6240', 14, 2),
  asphalt: (ctx, s, r) => {
    noiseFill('#4a4a4e', 8, 3)(ctx, s, r);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = r() > 0.5 ? '#3d3d41' : '#5a5a5e';
      ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 1);
    }
  },
  concrete: (ctx, s, r) => {
    noiseFill('#8f8f8a', 7, 4)(ctx, s, r);
    ctx.fillStyle = '#7a7a76';
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 2, 1);
  },
  concreteDark: noiseFill('#6b6b68', 7, 5),
  brick: (ctx, s, r) => {
    const mortar = '#9a9088';
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    const bc = hexToRgb('#9c4a3a');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : 4;
      for (let col = -1; col < 3; col++) {
        const x = col * 8 + off;
        ctx.fillStyle = rgb(bc, (r() - 0.5) * 30);
        ctx.fillRect(x + 1, row * 4 + 1, 7, 3);
        ctx.fillStyle = rgb(bc, -20 + (r() - 0.5) * 10);
        ctx.fillRect(x + 1, row * 4 + 3, 7, 1);
      }
    }
  },
  metal: (ctx, s, r) => {
    noiseFill('#7d8a93', 6, 6)(ctx, s, r);
    ctx.fillStyle = '#5f6b73';
    for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 1);
    ctx.fillStyle = '#98a5ad';
    for (let y = 1; y < s; y += 4) ctx.fillRect(0, y, s, 1);
  },
  metalWall: (ctx, s, r) => {
    // corrugated siding, vertical
    noiseFill('#6f7b84', 5, 7)(ctx, s, r);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = '#56626a';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = '#8a97a0';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  },
  metalRed: (ctx, s, r) => {
    noiseFill('#8d3b32', 8, 8)(ctx, s, r);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = '#6e2b24';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = '#a84c41';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  },
  metalBlue: (ctx, s, r) => {
    noiseFill('#3f5c7a', 8, 9)(ctx, s, r);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = '#2f4760';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = '#527293';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  },
  crate: (ctx, s, r) => {
    const wood = hexToRgb('#b07a3c');
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        ctx.fillStyle = rgb(wood, (r() - 0.5) * 20 + (y % 4 === 0 ? -25 : 0));
        ctx.fillRect(x, y, 1, 1);
      }
    ctx.fillStyle = '#7a4f22';
    ctx.fillRect(0, 0, s, 2);
    ctx.fillRect(0, s - 2, s, 2);
    ctx.fillRect(0, 0, 2, s);
    ctx.fillRect(s - 2, 0, 2, s);
    // diagonal plank
    for (let i = 2; i < s - 2; i++) {
      ctx.fillRect(i, i, 1, 1);
      ctx.fillRect(i, i + 1, 1, 1);
    }
    ctx.fillStyle = '#3c2a14';
    ctx.fillRect(1, 1, 1, 1); ctx.fillRect(s - 2, 1, 1, 1); ctx.fillRect(1, s - 2, 1, 1); ctx.fillRect(s - 2, s - 2, 1, 1);
  },
  planks: (ctx, s, r) => {
    const wood = hexToRgb('#a0703a');
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        ctx.fillStyle = rgb(wood, (r() - 0.5) * 16 + (y % 4 === 3 ? -35 : 0));
        ctx.fillRect(x, y, 1, 1);
      }
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(4, 0, 1, 4); ctx.fillRect(12, 4, 1, 4); ctx.fillRect(2, 8, 1, 4); ctx.fillRect(9, 12, 1, 4);
  },
  container: (ctx, s, r) => {
    noiseFill('#2f6f4e', 6, 10)(ctx, s, r);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = '#235a3d';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = '#3d8a62';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  },
  containerOrange: (ctx, s, r) => {
    noiseFill('#b86b2a', 8, 11)(ctx, s, r);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = '#8f501c';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = '#d6833a';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  },
  roof: (ctx, s, r) => {
    noiseFill('#555a60', 6, 12)(ctx, s, r);
    ctx.fillStyle = '#44484d';
    for (let y = 0; y < s; y += 8) ctx.fillRect(0, y, s, 1);
  },
  sand: noiseFill('#c9b27a', 10, 13),
  stone: (ctx, s, r) => {
    noiseFill('#7e7e7e', 10, 14)(ctx, s, r);
    ctx.fillStyle = '#5e5e5e';
    for (let i = 0; i < 5; i++) ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 3, 1);
  },
  cobble: (ctx, s, r) => {
    noiseFill('#6c6c6c', 8, 15)(ctx, s, r);
    const stones = [[0, 0, 5, 4], [5, 0, 6, 5], [11, 0, 5, 3], [0, 4, 4, 6], [4, 5, 7, 5], [11, 3, 5, 6], [0, 10, 6, 6], [6, 10, 5, 6], [11, 9, 5, 7]];
    for (const [x, y, w, h] of stones) {
      ctx.fillStyle = rgb(hexToRgb('#8a8a8a'), (r() - 0.5) * 30);
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
  },
  door: (ctx, s) => {
    ctx.fillStyle = '#4f5b63';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#3b454c';
    for (let y = 0; y < s; y += 3) ctx.fillRect(0, y, s, 1);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(0, 0, s, 1);
    ctx.fillStyle = '#212121';
    ctx.fillRect(0, 1, s, 1);
  },
  window: (ctx, s) => {
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#90caf9';
    ctx.fillRect(1, 1, 6, 6); ctx.fillRect(9, 1, 6, 6); ctx.fillRect(1, 9, 6, 6); ctx.fillRect(9, 9, 6, 6);
    ctx.fillStyle = '#e3f2fd';
    ctx.fillRect(2, 2, 2, 1); ctx.fillRect(10, 10, 2, 1);
  },
  vent: (ctx, s) => {
    ctx.fillStyle = '#5a6268';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#2b3136';
    for (let y = 2; y < s; y += 3) ctx.fillRect(2, y, s - 4, 1);
  },
  hazard: (ctx, s) => {
    ctx.fillStyle = '#ffc107';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#212121';
    for (let i = -s; i < s * 2; i += 8) {
      for (let y = 0; y < s; y++) ctx.fillRect(i + y, y, 4, 1);
    }
  },
  truck: (ctx, s, r) => {
    noiseFill('#d8d8d0', 6, 16)(ctx, s, r);
    ctx.fillStyle = '#b8b8b0';
    for (let x = 0; x < s; x += 4) ctx.fillRect(x, 0, 1, s);
  },
  tire: (ctx, s) => {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#333';
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = '#666';
    ctx.fillRect(6, 6, 4, 4);
  },
  leaves: (ctx, s, r) => {
    noiseFill('#3f7d2a', 18, 17)(ctx, s, r);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#2d5e1e';
      ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 1);
    }
  },
  log: (ctx, s, r) => {
    noiseFill('#5d4027', 10, 18)(ctx, s, r);
    ctx.fillStyle = '#4a3220';
    for (let x = 0; x < s; x += 3) ctx.fillRect(x, 0, 1, s);
  },
  bombsite: (ctx, s) => {
    ctx.fillStyle = '#8f8f8a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(1, 1, s - 2, 1); ctx.fillRect(1, s - 2, s - 2, 1); ctx.fillRect(1, 1, 1, s - 2); ctx.fillRect(s - 2, 1, 1, s - 2);
    ctx.fillRect(6, 4, 4, 8);
  },
  c4: (ctx, s) => {
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#263238';
    ctx.fillRect(2, 2, 12, 5);
    ctx.fillStyle = '#f44336';
    ctx.fillRect(3, 3, 2, 2);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(6, 3, 6, 1);
    ctx.fillStyle = '#9e9e9e';
    for (let x = 2; x < 14; x += 3) ctx.fillRect(x, 9, 2, 5);
  },
  hostage: (ctx, s) => {
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#212121';
    ctx.fillRect(3, 5, 3, 3); ctx.fillRect(10, 5, 3, 3);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(4, 11, 8, 2);
  },
  water: noiseFill('#2f6fb0', 12, 19),
  sky: noiseFill('#87b7e6', 2, 20),
};

const cache = new Map<string, THREE.Texture>();

export function getTexture(name: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const key = `${name}_${repeatX}_${repeatY}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const painter = painters[name] || painters.concrete;
  painter(ctx, SIZE, rng(name.length * 7919 + 17));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function getMaterial(name: string, repeatX = 1, repeatY = 1): THREE.MeshLambertMaterial {
  const key = `${name}_${repeatX}_${repeatY}`;
  if (matCache.has(key)) return matCache.get(key)!;
  const m = new THREE.MeshLambertMaterial({ map: getTexture(name, repeatX, repeatY) });
  matCache.set(key, m);
  return m;
}

// ---- Character skin textures (Minecraft style, 64x64 layout simplified) ----
export function makeSkinTexture(team: 'CT' | 'T', variant = 0): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const r = rng(100 + variant * 31 + (team === 'CT' ? 7 : 0));
  const skin = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'][variant % 4];
  const uniform = team === 'CT' ? ['#2f4a6b', '#35587f', '#26405e'][variant % 3] : ['#8c7a4a', '#6b5d3a', '#9a8450'][variant % 3];
  const uniformDark = team === 'CT' ? '#1d2f45' : '#4d4128';
  const vest = team === 'CT' ? '#1b2a3d' : '#3a3a3a';
  const fill = (x: number, y: number, w: number, h: number, c: string, v = 10) => {
    const base = hexToRgb(c);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        ctx.fillStyle = rgb(base, (r() - 0.5) * v);
        ctx.fillRect(x + xx, y + yy, 1, 1);
      }
  };
  // Layout: head 0..31 x 0..15 (standard mc), body etc. We'll use our own simple layout:
  // HEAD: front at (8,8) 8x8, other faces around; we'll just fill whole 32x16 region with skin & draw face on front.
  fill(0, 0, 32, 16, skin, 12);
  // hair/helmet top
  fill(8, 0, 8, 8, team === 'CT' ? '#1a2a3a' : '#3b2a1a', 8); // top
  fill(0, 8, 8, 8, team === 'CT' ? '#1a2a3a' : '#3b2a1a', 8); // right side upper
  fill(16, 8, 8, 8, team === 'CT' ? '#1a2a3a' : '#3b2a1a', 8);
  fill(24, 8, 8, 8, team === 'CT' ? '#1a2a3a' : '#3b2a1a', 8); // back
  // helmet band on front
  fill(8, 8, 8, 2, team === 'CT' ? '#1a2a3a' : '#3b2a1a', 8);
  // face: eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 12, 2, 1); ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = team === 'CT' ? '#1565c0' : '#3e2723';
  ctx.fillRect(10, 12, 1, 1); ctx.fillRect(13, 12, 1, 1);
  if (team === 'T') {
    // balaclava mouth area
    fill(8, 13, 8, 3, '#3b2a1a', 6);
  } else {
    // CT mask
    fill(8, 14, 8, 2, '#263238', 6);
  }
  // BODY region 32..63 x 0..15 : uniform
  fill(32, 0, 32, 16, uniform, 10);
  fill(36, 4, 8, 10, vest, 6); // vest front
  fill(52, 4, 8, 10, vest, 6);
  // belt
  fill(32, 13, 32, 1, uniformDark, 4);
  // LIMBS region 0..63 x 16..31 : arms left half, legs right half
  fill(0, 16, 32, 16, uniform, 10); // arms
  fill(0, 28, 32, 4, skin, 8); // hands
  fill(32, 16, 32, 16, team === 'CT' ? '#26405e' : '#4a4a4a', 10); // legs
  fill(32, 28, 32, 4, '#212121', 6); // boots
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSolidPixelMaterial(color: string, variance = 10, seed = 1): THREE.MeshLambertMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  const r = rng(seed);
  const base = hexToRgb(color);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = rgb(base, (r() - 0.5) * variance * 2); ctx.fillRect(x, y, 1, 1); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex });
}

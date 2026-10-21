import { useEffect, useRef } from 'react';
import type { HudState, GameSettings } from '../game/types';
import { MAP_BOXES, BOMB_SITES } from '../game/map';
import { GUNGAME_ORDER, WEAPONS, CLASS_NAME } from '../game/weapons';
import { cn } from '../utils/cn';

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function Hud({ h, settings }: { h: HudState; settings: GameSettings }) {
  const w = h.weapon;
  const lowHp = h.health <= 30 && !h.dead;
  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white font-mono overflow-hidden">
      {/* flash */}
      {h.flash > 0 && <div className="absolute inset-0 bg-white" style={{ opacity: h.flash }} />}
      {/* low hp vignette */}
      {lowHp && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 160px rgba(200,0,0,0.6)' }} />}
      {/* scope */}
      {h.scoped && <Scope />}
      {/* damage indicators */}
      {h.damageDirs.map((d, i) => (
        <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${-d.angle}rad)`, opacity: Math.min(1, d.t) }}>
          <div className="w-32 h-32 relative"><div className="absolute left-1/2 -translate-x-1/2 -top-12 w-0 h-0 border-l-[18px] border-r-[18px] border-b-[26px] border-l-transparent border-r-transparent border-b-red-600/80" /></div>
        </div>
      ))}
      {/* crosshair */}
      {!h.scoped && !h.dead && <Crosshair color={settings.crosshairColor} hit={h.hitMarker > 0} knife={w?.slot === 'melee'} />}

      {/* top center: scores and timer */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-stretch gap-1">
        {h.mode !== 'ffa' && h.mode !== 'gungame' && <div className="bg-sky-900/80 border border-sky-400/50 px-4 flex items-center text-2xl font-black text-sky-200 min-w-[64px] justify-center">{h.scoreCT}</div>}
        <div className={cn('bg-black/70 px-4 py-1 flex flex-col items-center min-w-[90px] border', h.roundPhase === 'planted' ? 'border-red-500 animate-pulse' : 'border-white/20')}>
          <div className={cn('text-xl font-black leading-tight', h.roundPhase === 'planted' ? 'text-red-400' : h.roundTime < 10 && h.mode === 'bomb' ? 'text-amber-400' : '')}>{h.roundPhase === 'planted' ? fmtTime(h.bombTimer) : fmtTime(h.roundTime)}</div>
          <div className="text-[10px] text-white/60 tracking-widest">{h.mode === 'bomb' ? `第 ${h.roundNumber} 回合` : h.mode === 'tdm' ? '团队死斗' : h.mode === 'ffa' ? '死亡竞赛' : '军备竞赛'}</div>
        </div>
        {h.mode !== 'ffa' && h.mode !== 'gungame' && <div className="bg-amber-900/80 border border-amber-400/50 px-4 flex items-center text-2xl font-black text-amber-200 min-w-[64px] justify-center">{h.scoreT}</div>}
      </div>
      {h.phaseLabel && <div className="absolute top-[68px] left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] text-white/70 bg-black/50 px-3 py-0.5">{h.phaseLabel}{h.canBuy && h.mode === 'bomb' ? ' · 按 B 购买' : ''}</div>}

      {/* announcement */}
      {h.announcement && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 text-center">
          <div className="text-2xl md:text-3xl font-black tracking-wider drop-shadow-[3px_3px_0_#000] text-amber-300 px-6 py-2 bg-black/40">{h.announcement}</div>
        </div>
      )}
      {h.killStreakText && <div className="absolute top-[32%] left-1/2 -translate-x-1/2 text-xl font-black text-red-400 drop-shadow-[2px_2px_0_#000] animate-bounce">{h.killStreakText}</div>}

      {/* radar */}
      <Radar h={h} />

      {/* kill feed */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
        {h.kills.map((k) => (
          <div key={k.id} className="bg-black/70 border border-white/10 px-2 py-1 text-xs flex items-center gap-2">
            <span className={k.killerTeam === 'CT' ? 'text-sky-300 font-bold' : 'text-amber-300 font-bold'}>{k.killer}</span>
            <span className="text-white/60">[{k.weapon}{k.headshot ? ' · 爆头' : ''}]</span>
            <span className={k.victimTeam === 'CT' ? 'text-sky-300 font-bold' : 'text-amber-300 font-bold'}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* gun game progress */}
      {h.mode === 'gungame' && (
        <div className="absolute top-[88px] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1 border border-purple-400/40">
          <span className="text-[10px] text-purple-300 tracking-widest">等级 {h.gunLevel + 1}/{h.gunLevelMax}</span>
          <div className="w-40 h-2 bg-white/10"><div className="h-full bg-purple-400" style={{ width: `${((h.gunLevel + 1) / h.gunLevelMax) * 100}%` }} /></div>
          <span className="text-xs font-bold">{WEAPONS[GUNGAME_ORDER[Math.min(h.gunLevel, GUNGAME_ORDER.length - 1)]].name}</span>
          <span className="text-[10px] text-white/50">下一把: {GUNGAME_ORDER[h.gunLevel + 1] ? WEAPONS[GUNGAME_ORDER[h.gunLevel + 1]].name : '胜利'}</span>
        </div>
      )}

      {/* plant/defuse progress */}
      {(h.planting > 0 || h.defusing > 0) && (
        <div className="absolute left-1/2 top-[60%] -translate-x-1/2 w-72">
          <div className="text-center text-sm font-bold mb-1 tracking-widest">{h.planting > 0 ? '正在安放炸弹…' : '正在拆除炸弹…'}</div>
          <div className="h-3 bg-black/70 border border-white/30"><div className={cn('h-full', h.planting > 0 ? 'bg-red-500' : 'bg-sky-400')} style={{ width: `${(h.planting || h.defusing) * 100}%` }} /></div>
        </div>
      )}
      {h.nearBombSite && h.planting === 0 && <div className="absolute left-1/2 top-[60%] -translate-x-1/2 text-sm bg-black/60 px-3 py-1 border border-red-400/60 text-red-300">在炸弹点内 · 长按 <b>E</b> 安放炸弹</div>}
      {h.nearBomb && h.defusing === 0 && <div className="absolute left-1/2 top-[60%] -translate-x-1/2 text-sm bg-black/60 px-3 py-1 border border-sky-400/60 text-sky-300">长按 <b>E</b> 拆除炸弹</div>}
      {h.hasBomb && !h.nearBombSite && h.mode === 'bomb' && <div className="absolute left-1/2 bottom-24 -translate-x-1/2 text-[11px] bg-black/50 px-2 py-0.5 text-red-300 border border-red-400/40">你携带着 C4 · 前往 A / B 点</div>}

      {/* reload */}
      {h.reloading && !h.dead && (
        <div className="absolute left-1/2 top-[57%] -translate-x-1/2 w-28">
          <div className="text-center text-[10px] tracking-widest text-white/80">换弹中</div>
          <div className="h-1 bg-white/20"><div className="h-full bg-white" style={{ width: `${Math.min(100, h.reloadProgress * 100)}%` }} /></div>
        </div>
      )}
      {h.lowAmmo && !h.reloading && !h.dead && w && w.slot !== 'melee' && w.slot !== 'grenade' && w.slot !== 'bomb' && <div className="absolute left-1/2 top-[57%] -translate-x-1/2 text-[11px] text-red-400 tracking-widest">弹药不足 · 按 R 换弹</div>}

      {/* death */}
      {h.dead && (
        <div className="absolute inset-x-0 top-[40%] text-center">
          <div className="text-3xl font-black text-red-500 drop-shadow-[3px_3px_0_#000]">你已阵亡</div>
          {h.respawnIn > 0 && <div className="text-lg mt-2">{Math.ceil(h.respawnIn)} 秒后重生</div>}
          {h.spectating && <div className="text-sm mt-2 bg-black/60 inline-block px-3 py-1">正在观战 <b className="text-amber-300">{h.spectating}</b> · 点击切换</div>}
          {h.mode === 'bomb' && !h.spectating && <div className="text-xs mt-2 text-white/60">等待下一回合…</div>}
        </div>
      )}

      {/* bottom left: health armor */}
      <div className="absolute left-4 bottom-4 flex items-end gap-2">
        <div className="bg-black/70 border border-white/15 px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5"><Icon kind="hp" /><span className={cn('text-3xl font-black tabular-nums w-14', lowHp ? 'text-red-400' : '')}>{h.health}</span></div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex items-center gap-1.5"><Icon kind={h.helmet ? 'helmet' : 'armor'} /><span className="text-3xl font-black tabular-nums w-14 text-sky-200">{h.armor}</span></div>
        </div>
        {h.mode === 'bomb' && <div className="bg-black/70 border border-emerald-400/30 px-3 py-2 text-emerald-300 text-xl font-black">$ {h.money}</div>}
      </div>

      {/* bottom right: weapon */}
      <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
        <div className="flex gap-1">
          {h.inventory.map((it, i) => {
            const slotNum = it.slot === 'primary' ? 1 : it.slot === 'secondary' ? 2 : it.slot === 'melee' ? 3 : it.slot === 'grenade' ? 4 : 5;
            const active = w && it.id === w.id;
            return (
              <div key={it.id + i} className={cn('px-2 py-1 text-[10px] border min-w-[64px] text-center', active ? 'bg-amber-400/90 text-black border-amber-200 font-black' : 'bg-black/60 border-white/15 text-white/70')}>
                <div className="text-[9px] opacity-70">{slotNum}</div>
                <div className="truncate">{it.name}{it.count !== undefined && it.count > 1 ? ` ×${it.count}` : ''}</div>
              </div>
            );
          })}
        </div>
        {w && (
          <div className="bg-black/70 border border-white/15 px-4 py-2 flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold">{w.name}</div>
              <div className="text-[10px] text-white/50">{CLASS_NAME[WEAPONS[w.id]?.cls] ?? ''}</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            {w.slot === 'melee' ? <div className="text-2xl font-black">—</div> : w.slot === 'grenade' ? <div className="text-3xl font-black">{w.count}</div> : w.slot === 'bomb' ? <div className="text-xl font-black text-red-400">C4</div> : (
              <div className="flex items-baseline gap-1">
                <span className={cn('text-4xl font-black tabular-nums', h.lowAmmo ? 'text-red-400' : '')}>{w.ammo}</span>
                <span className="text-lg text-white/50 tabular-nums">/ {w.reserve < 0 ? '∞' : w.reserve}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/30">{h.fps} FPS</div>
    </div>
  );
}

function Icon({ kind }: { kind: 'hp' | 'armor' | 'helmet' }) {
  if (kind === 'hp') return <div className="w-5 h-5 relative"><div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-red-400" /><div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-red-400" /></div>;
  return <div className={cn('w-5 h-5 border-2 border-sky-300', kind === 'helmet' ? 'rounded-t-full bg-sky-300/40' : 'rounded-b-md bg-sky-300/20')} />;
}

function Crosshair({ color, hit, knife }: { color: string; hit: boolean; knife: boolean }) {
  const gap = 5, len = 8, t = 2;
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {!knife && (
        <>
          <div className="absolute" style={{ width: t, height: len, background: color, left: -t / 2, top: -gap - len, boxShadow: '0 0 0 1px rgba(0,0,0,0.6)' }} />
          <div className="absolute" style={{ width: t, height: len, background: color, left: -t / 2, top: gap, boxShadow: '0 0 0 1px rgba(0,0,0,0.6)' }} />
          <div className="absolute" style={{ width: len, height: t, background: color, top: -t / 2, left: -gap - len, boxShadow: '0 0 0 1px rgba(0,0,0,0.6)' }} />
          <div className="absolute" style={{ width: len, height: t, background: color, top: -t / 2, left: gap, boxShadow: '0 0 0 1px rgba(0,0,0,0.6)' }} />
        </>
      )}
      {knife && <div className="absolute w-1.5 h-1.5 rounded-full" style={{ background: color, left: -3, top: -3 }} />}
      {hit && (
        <>
          {[45, 135, 225, 315].map((a) => (
            <div key={a} className="absolute bg-white" style={{ width: 2, height: 9, left: -1, top: -16, transformOrigin: '1px 16px', transform: `rotate(${a}deg)` }} />
          ))}
        </>
      )}
    </div>
  );
}

function Scope() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 34vmin, #000 34.5vmin)' }} />
      <div className="absolute left-0 right-0 top-1/2 h-px bg-black" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black" />
      <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black" />
    </div>
  );
}

// ---- Radar ----
let mapCanvas: HTMLCanvasElement | null = null;
const MAP_SCALE = 3; // px per meter on the static map canvas
const MAP_X0 = -46, MAP_Z0 = -56, MAP_W = 102, MAP_H = 92;
function getMapCanvas() {
  if (mapCanvas) return mapCanvas;
  const c = document.createElement('canvas');
  c.width = MAP_W * MAP_SCALE; c.height = MAP_H * MAP_SCALE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1b2430';
  ctx.fillRect(0, 0, c.width, c.height);
  for (const b of MAP_BOXES) {
    if (b.thin) continue;
    const h = b.y2 - b.y1;
    if (b.y1 > 3) continue;
    ctx.fillStyle = h >= 4 ? '#8a94a3' : h >= 2 ? '#5f6a78' : '#3f4a58';
    ctx.fillRect((b.x1 - MAP_X0) * MAP_SCALE, (b.z1 - MAP_Z0) * MAP_SCALE, (b.x2 - b.x1) * MAP_SCALE, (b.z2 - b.z1) * MAP_SCALE);
  }
  for (const s of BOMB_SITES) {
    ctx.fillStyle = 'rgba(255,80,80,0.25)';
    ctx.fillRect((s.x1 - MAP_X0) * MAP_SCALE, (s.z1 - MAP_Z0) * MAP_SCALE, (s.x2 - s.x1) * MAP_SCALE, (s.z2 - s.z1) * MAP_SCALE);
    ctx.fillStyle = '#ff8a80';
    ctx.font = `bold ${7 * MAP_SCALE}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(s.name, (s.cx - MAP_X0) * MAP_SCALE, (s.cz - MAP_Z0) * MAP_SCALE + 7);
  }
  mapCanvas = c;
  return c;
}

function Radar({ h }: { h: HudState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const S = c.width;
    const range = 34; // meters radius visible
    const k = S / 2 / range; // px per m
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0f141b'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(h.radar.yaw);
    ctx.scale(k / MAP_SCALE, k / MAP_SCALE);
    ctx.translate(-(h.radar.px - MAP_X0) * MAP_SCALE, -(h.radar.pz - MAP_Z0) * MAP_SCALE);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(getMapCanvas(), 0, 0);
    ctx.globalAlpha = 1;
    // entities
    const dot = (x: number, z: number, color: string, r: number) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc((x - MAP_X0) * MAP_SCALE, (z - MAP_Z0) * MAP_SCALE, r * MAP_SCALE / k, 0, Math.PI * 2); ctx.fill();
    };
    for (const e of h.radar.entities) {
      const friendly = h.mode === 'ffa' || h.mode === 'gungame' ? false : e.team === h.team;
      dot(e.x, e.z, friendly ? (e.team === 'CT' ? '#64b5f6' : '#ffcc80') : '#ff1744', 3.2);
    }
    if (h.radar.bomb) { ctx.fillStyle = '#ff5252'; ctx.font = `bold ${8 * MAP_SCALE / k * 3}px monospace`; ctx.textAlign = 'center'; ctx.fillText('C4', (h.radar.bomb.x - MAP_X0) * MAP_SCALE, (h.radar.bomb.z - MAP_Z0) * MAP_SCALE + 4); }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }, [h.radar, h.mode, h.team]);
  return (
    <div className="absolute left-4 top-4">
      <canvas ref={ref} width={176} height={176} className="w-[176px] h-[176px]" />
      <div className="text-[10px] text-white/50 text-center tracking-widest mt-0.5">ASSAULT · 突击仓库</div>
    </div>
  );
}

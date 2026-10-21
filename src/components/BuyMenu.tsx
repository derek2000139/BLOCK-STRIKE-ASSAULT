import { useEffect, useState } from 'react';
import { BUY_CATEGORIES, GEAR_PRICES, WEAPONS, CLASS_NAME } from '../game/weapons';
import type { HudState } from '../game/types';
import { cn } from '../utils/cn';

export default function BuyMenu({ h, onBuy, onClose }: { h: HudState; onBuy: (id: string) => string | null; onClose: () => void }) {
  const [cat, setCat] = useState('rifle');
  const [msg, setMsg] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const free = h.mode !== 'bomb';
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const category = BUY_CATEGORIES.find((c) => c.key === cat)!;
  const buy = (id: string) => {
    const r = onBuy(id);
    setMsg(r ? `✖ ${r}` : `✔ 已购买 ${WEAPONS[id]?.name ?? GEAR_PRICES[id]?.name}`);
    setTimeout(() => setMsg(null), 1500);
  };
  const hw = hover ? WEAPONS[hover] : null;
  return (
    <div className="absolute inset-0 bg-black/70 text-white font-mono flex items-center justify-center p-6" onMouseDown={(e) => e.stopPropagation()}>
      <div className="w-full max-w-5xl bg-[#121820] border-2 border-white/15 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="text-xl font-black tracking-widest">购买装备</div>
            <div className="text-xs text-white/50">{free ? '本模式所有装备免费' : h.phaseLabel === '购买阶段' ? '购买阶段' : '出生点内可购买（回合开始 20 秒内）'}</div>
          </div>
          <div className="flex items-center gap-4">
            {!free && <div className="text-emerald-300 text-xl font-black">$ {h.money}</div>}
            <button onClick={onClose} className="bg-white/10 hover:bg-white/20 px-3 py-1 text-sm">关闭 [B / Esc]</button>
          </div>
        </div>
        <div className="grid grid-cols-[170px_1fr_260px] min-h-[420px]">
          <div className="border-r border-white/10 py-2">
            {BUY_CATEGORIES.map((c, i) => (
              <button key={c.key} onClick={() => setCat(c.key)} className={cn('w-full text-left px-4 py-3 text-sm flex justify-between items-center', cat === c.key ? 'bg-amber-400 text-black font-black' : 'hover:bg-white/5 text-white/80')}>
                <span>{c.label}</span><span className="text-[10px] opacity-60">{i + 1}</span>
              </button>
            ))}
            <div className="px-4 pt-4 text-[10px] text-white/40 leading-relaxed">当前装备：<br />{h.inventory.map((i) => i.name).join(' · ')}</div>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2 content-start">
            {category.items.map((id) => {
              const wdef = WEAPONS[id];
              const gear = GEAR_PRICES[id];
              const name = wdef?.name ?? gear.name;
              let price = wdef?.price ?? gear.price;
              if (id === 'kevlarhelmet' && h.armor >= 100) price = 350;
              const teamLocked = wdef?.teamOnly && wdef.teamOnly !== h.team && !free;
              const owned = h.inventory.some((i) => i.id === id) && wdef && wdef.slot !== 'grenade';
              const cant = !free && h.money < price;
              return (
                <button key={id} disabled={!!teamLocked} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => buy(id)}
                  className={cn('text-left p-3 border transition flex flex-col gap-1', teamLocked ? 'opacity-30 border-white/5 cursor-not-allowed' : owned ? 'border-emerald-400/40 bg-emerald-900/20' : cant ? 'border-white/10 opacity-60' : 'border-white/15 hover:border-amber-400 hover:bg-amber-400/10')}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{name}</span>
                    <span className={cn('text-sm font-black', free ? 'text-emerald-300' : cant ? 'text-red-400' : 'text-emerald-300')}>{free ? '免费' : `$${price}`}</span>
                  </div>
                  <div className="text-[10px] text-white/50">{wdef ? `${CLASS_NAME[wdef.cls]}${wdef.teamOnly ? ` · 仅 ${wdef.teamOnly}` : ''} · ${wdef.tagline}` : gear.desc}</div>
                  {owned && <div className="text-[10px] text-emerald-300">已装备</div>}
                </button>
              );
            })}
          </div>
          <div className="border-l border-white/10 p-4 text-sm">
            {hw ? (
              <div>
                <div className="text-lg font-black">{hw.name}</div>
                <div className="text-xs text-white/50 mb-3">{CLASS_NAME[hw.cls]} · {hw.tagline}</div>
                <Stat label="伤害" v={hw.damage} max={120} />
                <Stat label="射速" v={hw.rpm} max={900} />
                <Stat label="精准" v={hw.spread > 0 ? Math.max(5, 100 - hw.spread * 1200) : 0} max={100} />
                <Stat label="穿甲" v={hw.penetration * 100} max={100} />
                <Stat label="机动" v={hw.moveSpeed * 100 - 80} max={30} />
                <div className="mt-3 text-xs text-white/60 grid grid-cols-2 gap-y-1">
                  <span>弹匣</span><span className="text-right text-white">{hw.mag}{hw.reserve ? ` / ${hw.reserve}` : ''}</span>
                  <span>爆头倍率</span><span className="text-right text-white">×{hw.headMult}</span>
                  <span>击杀奖励</span><span className="text-right text-white">${hw.killReward}</span>
                  <span>换弹</span><span className="text-right text-white">{hw.reloadTime}s</span>
                </div>
              </div>
            ) : hover && GEAR_PRICES[hover] ? (
              <div><div className="text-lg font-black">{GEAR_PRICES[hover].name}</div><div className="text-xs text-white/60 mt-2">{GEAR_PRICES[hover].desc}</div></div>
            ) : (
              <div className="text-white/40 text-xs leading-relaxed">将鼠标移到武器上查看详细数据。<br /><br />提示：步枪是中距离之王；AWP 一击必杀但机动性差；经济不足时考虑手枪 + 护甲。</div>
            )}
            {msg && <div className={cn('mt-4 text-sm font-bold', msg.startsWith('✔') ? 'text-emerald-300' : 'text-red-400')}>{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v, max }: { label: string; v: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px] mb-1.5">
      <span className="w-8 text-white/60">{label}</span>
      <div className="flex-1 h-2 bg-white/10"><div className="h-full bg-amber-400" style={{ width: `${Math.min(100, Math.max(0, (v / max) * 100))}%` }} /></div>
      <span className="w-8 text-right">{Math.round(v)}</span>
    </div>
  );
}

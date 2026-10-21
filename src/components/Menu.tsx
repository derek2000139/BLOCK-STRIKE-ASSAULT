import { useState } from 'react';
import type { GameSettings, GameMode, Team, Difficulty } from '../game/types';
import { cn } from '../utils/cn';

const MODES: { id: GameMode; name: string; desc: string; rgb: string; color: string; detail: string }[] = [
  { id: 'bomb', name: '爆破模式', rgb: '232,163,61', color: '#e8a33d', desc: '经典 CS 回合制 · 经济系统 · 安放/拆除 C4', detail: 'T 方需在 A/B 点安放炸弹，CT 方阻止或拆除。回合制、购买阶段、经济系统、死亡后观战，率先赢得指定回合数的队伍获胜。' },
  { id: 'tdm', name: '团队死斗', rgb: '79,159,212', color: '#4f9fd4', desc: '两队对抗 · 无限复活 · 自由选枪', detail: '无限复活的团队对抗，可随时按 B 更换武器。率先达到击杀目标的队伍获胜。' },
  { id: 'ffa', name: '死亡竞赛', rgb: '217,105,92', color: '#d9695c', desc: '人人为敌 · 全图混战', detail: '所有人互为敌人，无限复活。率先达到击杀目标者获胜。' },
  { id: 'gungame', name: '军备竞赛', rgb: '106,169,128', color: '#6aa980', desc: '击杀升级武器 · 军刀终结', detail: '每 2 次击杀升级到下一把武器，从手枪一路打到 AWP，最后用军刀完成致命一击赢得比赛。军刀击杀会让对手降级！' },
];

const DIFFS: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'easy', name: '简单', desc: '反应慢，准度低' },
  { id: 'normal', name: '普通', desc: '均衡的对手' },
  { id: 'hard', name: '困难', desc: '反应快，准度高' },
  { id: 'expert', name: '专家', desc: '近乎完美的瞄准' },
];

export default function Menu({ onStart, initial }: { onStart: (s: GameSettings) => void; initial: GameSettings }) {
  const [s, setS] = useState<GameSettings>(initial);
  const [tab, setTab] = useState<'play' | 'settings' | 'help'>('play');
  const up = (patch: Partial<GameSettings>) => setS((p) => ({ ...p, ...patch }));
  const mode = MODES.find((m) => m.id === s.mode)!;

  return (
    <div className="fixed inset-0 overflow-auto text-white font-sans bg-black">
      <div className="relative z-10 min-h-full flex flex-col px-6 py-6 md:px-12 max-w-[1400px] mx-auto">
        {/* header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.4em] text-amber-300/80 font-mono">BLOCK STRIKE · 方块突击</div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)]" style={{ fontFamily: 'monospace' }}>
              方块<span className="text-amber-400">突击</span> <span className="text-2xl md:text-3xl text-white/60 font-bold">ASSAULT</span>
            </h1>
          </div>
          <div className="flex gap-1 bg-black/50 p-1 rounded">
            {([['play', '开始对战'], ['settings', '设置'], ['help', '操作说明']] as const).map(([k, n]) => (
              <button key={k} onClick={() => setTab(k)} className={cn('px-5 py-2 text-sm font-bold tracking-wider transition', tab === k ? 'bg-amber-400 text-black' : 'text-white/70 hover:text-white hover:bg-white/10')}>{n}</button>
            ))}
          </div>
        </div>

        {tab === 'play' && (
          <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-8 flex-1">
            <div>
              <div className="text-sm text-white/60 mb-3 tracking-widest font-mono">选择模式</div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {MODES.map((m, i) => (
                  <button key={m.id} onClick={() => up({ mode: m.id })} style={s.mode === m.id ? { backgroundColor: `rgba(${m.rgb},0.22)`, borderColor: m.color } : { backgroundColor: `rgba(${m.rgb},0.10)` }} className={cn('group relative text-left overflow-hidden border-2 transition-all flex flex-col justify-between p-4 aspect-[4/3]', s.mode === m.id ? '' : 'border-white/10 hover:border-white/40')}>
                    <div className="flex items-start justify-between w-full">
                      <span className="font-mono text-[11px] tracking-[0.3em] text-white/25">{String(i + 1).padStart(2, '0')}</span>
                      {s.mode === m.id && <span className="text-[10px] font-black px-1.5 py-0.5 border" style={{ color: m.color, borderColor: `rgba(${m.rgb},0.5)` }}>已选择</span>}
                    </div>
                    <div className="w-full">
                      <div className="font-black text-xl" style={{ color: m.color }}>{m.name}</div>
                      <div className="mt-1 text-[11px] text-white/55 leading-tight">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 bg-black/50 border border-white/10 p-4 text-sm text-white/80 leading-relaxed">
                <span className="text-amber-300 font-bold">{mode.name}：</span>{mode.detail}
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-6">
                {s.mode !== 'ffa' && (
                  <div>
                    <div className="text-sm text-white/60 mb-2 tracking-widest font-mono">选择阵营</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['CT', 'T'] as Team[]).map((t) => (
                        <button key={t} onClick={() => up({ team: t })} className={cn('p-3 border-2 text-left transition', s.team === t ? (t === 'CT' ? 'border-sky-400 bg-sky-900/50' : 'border-amber-500 bg-amber-900/50') : 'border-white/10 bg-black/40 hover:border-white/40')}>
                          <div className={cn('font-black text-lg', t === 'CT' ? 'text-sky-300' : 'text-amber-300')}>{t === 'CT' ? '反恐精英' : '恐怖分子'}</div>
                          <div className="text-[11px] text-white/60">{t === 'CT' ? '停车场出生 · USP / M4A4 / AUG' : '仓库出生 · 格洛克 / AK-47 / SG553'}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-white/60 mb-2 tracking-widest font-mono">机器人难度</div>
                  <div className="grid grid-cols-4 gap-1">
                    {DIFFS.map((d) => (
                      <button key={d.id} onClick={() => up({ difficulty: d.id })} className={cn('p-2 border-2 transition text-center', s.difficulty === d.id ? 'border-amber-400 bg-amber-400/20' : 'border-white/10 bg-black/40 hover:border-white/40')}>
                        <div className="font-bold">{d.name}</div>
                        <div className="text-[10px] text-white/50">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* right panel */}
            <div className="bg-black/60 border border-white/10 p-5 flex flex-col gap-5 h-fit">
              <div>
                <label className="text-xs text-white/60 tracking-widest font-mono">玩家昵称</label>
                <input value={s.playerName} onChange={(e) => up({ playerName: e.target.value.slice(0, 12) })} className="mt-1 w-full bg-white/10 border border-white/20 px-3 py-2 outline-none focus:border-amber-400" />
              </div>
              <Slider label={s.mode === 'ffa' ? '机器人数量' : '每队人数'} value={s.botCount} min={2} max={8} step={1} onChange={(v) => up({ botCount: v })} fmt={(v) => (s.mode === 'ffa' ? `${v * 2} 个机器人` : `${v} v ${v}`)} />
              {s.mode === 'bomb' && <Slider label="获胜回合数" value={s.roundLimit} min={3} max={16} step={1} onChange={(v) => up({ roundLimit: v })} fmt={(v) => `先赢 ${v} 回合`} />}
              {(s.mode === 'tdm' || s.mode === 'ffa') && <Slider label="击杀目标" value={s.scoreLimit} min={10} max={100} step={5} onChange={(v) => up({ scoreLimit: v })} fmt={(v) => `${v} 击杀`} />}
              <div className="text-[11px] text-white/50 leading-relaxed border-t border-white/10 pt-3">
                地图：<span className="text-white/80">Assault 突击仓库</span> — 重新设计的经典仓库地图：停车场 CT 出生点、仓库内部人质房 T 出生点、屋顶天窗、西侧小巷后门、东侧集装箱 B 点。
              </div>
              <button onClick={() => onStart(s)} className="w-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xl py-4 tracking-widest shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-none transition">
                开始游戏
              </button>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="mt-8 max-w-xl bg-black/60 border border-white/10 p-6 flex flex-col gap-6">
            <Slider label="鼠标灵敏度" value={s.sensitivity} min={0.2} max={4} step={0.1} onChange={(v) => up({ sensitivity: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="视野 (FOV)" value={s.fov} min={60} max={110} step={1} onChange={(v) => up({ fov: v })} fmt={(v) => `${v}°`} />
            <Slider label="音量" value={s.volume} min={0} max={1} step={0.05} onChange={(v) => up({ volume: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <div>
              <div className="text-xs text-white/60 tracking-widest font-mono mb-2">准星颜色</div>
              <div className="flex gap-2">
                {['#00ff00', '#00e5ff', '#ffeb3b', '#ff4081', '#ffffff'].map((c) => (
                  <button key={c} onClick={() => up({ crosshairColor: c })} className={cn('w-9 h-9 border-2', s.crosshairColor === c ? 'border-white scale-110' : 'border-white/20')} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'help' && (
          <div className="mt-8 grid md:grid-cols-2 gap-6 max-w-4xl">
            <div className="bg-black/60 border border-white/10 p-6">
              <div className="font-black text-amber-300 mb-3">基础操作</div>
              <KeyRow k="W A S D" v="移动" /><KeyRow k="鼠标" v="视角 / 左键开火 / 右键开镜·重刺" /><KeyRow k="空格" v="跳跃" /><KeyRow k="Ctrl / C" v="蹲下" /><KeyRow k="Shift" v="静步" />
              <KeyRow k="R" v="换弹" /><KeyRow k="E" v="安放 / 拆除炸弹（长按）" /><KeyRow k="G" v="丢弃武器" /><KeyRow k="Q" v="切换上一把武器" />
            </div>
            <div className="bg-black/60 border border-white/10 p-6">
              <div className="font-black text-amber-300 mb-3">武器与界面</div>
              <KeyRow k="1 / 2 / 3" v="主武器 / 副武器 / 军刀" /><KeyRow k="4" v="循环切换投掷物" /><KeyRow k="5" v="C4 炸弹" /><KeyRow k="滚轮" v="切换武器" />
              <KeyRow k="B" v="购买菜单" /><KeyRow k="Tab" v="计分板（按住）" /><KeyRow k="Esc" v="暂停 / 释放鼠标" /><KeyRow k="观战时 点击" v="切换观战对象" />
              <div className="mt-4 text-xs text-white/60 leading-relaxed">提示：移动中射击精度大幅降低，蹲下并静止射击最精准。爆头造成 4 倍伤害。闪光弹会致盲面向它的人，烟雾弹可以遮挡机器人的视线。</div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-6 text-[11px] text-white/40 font-mono flex justify-between">
          <span>方块突击 · 浏览器 3D 射击游戏 · 像素方块美术</span>
          <span>需要鼠标锁定 · 建议使用 Chrome / Edge</span>
        </div>
      </div>
    </div>
  );
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/5 text-sm">
      <span className="min-w-[110px] font-mono text-xs bg-white/10 px-2 py-1 text-center border border-white/20">{k}</span>
      <span className="text-white/80">{v}</span>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between text-xs tracking-widest font-mono"><span className="text-white/60">{label}</span><span className="text-amber-300">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full mt-1 accent-amber-400" />
    </div>
  );
}

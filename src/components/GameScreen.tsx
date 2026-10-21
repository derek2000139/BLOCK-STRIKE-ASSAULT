import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from '../game/Engine';
import type { GameSettings, HudState, MatchResult } from '../game/types';
import Hud from './Hud';
import BuyMenu from './BuyMenu';
import Scoreboard from './Scoreboard';
import { audio } from '../game/audio';

export default function GameScreen({ settings, onEnd, onQuit, onSettings }: { settings: GameSettings; onEnd: (r: MatchResult) => void; onQuit: () => void; onSettings: (s: GameSettings) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const eng = new Engine(canvas, settings);
    engineRef.current = eng;
    (window as any).__eng = eng;
    eng.onHud = setHud;
    eng.onBuyToggle = setBuyOpen;
    eng.onScoreboard = setScoreOpen;
    eng.onPause = setPaused;
    eng.onEnd = onEnd;
    eng.start();
    return () => { eng.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = useCallback(() => {
    setStarted(true);
    engineRef.current?.requestLock();
  }, []);

  const applySettings = (patch: Partial<GameSettings>) => {
    const n = { ...local, ...patch };
    setLocal(n);
    const eng = engineRef.current;
    if (eng) { eng.settings = { ...eng.settings, ...patch }; audio.setVolume(n.volume); }
    onSettings(n);
  };

  const eng = engineRef.current;
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full cursor-none" />
      {hud && <Hud h={hud} settings={local} />}
      {hud && scoreOpen && <Scoreboard stats={hud.stats} mode={hud.mode} scoreCT={hud.scoreCT} scoreT={hud.scoreT} playerTeam={hud.team} />}
      {hud && buyOpen && eng && <BuyMenu h={hud} onBuy={(id) => eng.buy(id)} onClose={() => eng.toggleBuy(false)} />}

      {!started && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-mono">
          <div className="text-center max-w-md p-8 bg-[#121820] border-2 border-white/15">
            <div className="text-xs tracking-[0.4em] text-amber-300">ASSAULT · 突击仓库</div>
            <div className="text-3xl font-black mt-2">{settings.mode === 'bomb' ? '爆破模式' : settings.mode === 'tdm' ? '团队死斗' : settings.mode === 'ffa' ? '死亡竞赛' : '军备竞赛'}</div>
            <div className="text-sm text-white/60 mt-3 leading-relaxed">
              {settings.mode === 'ffa' ? '人人为敌，' : `你是${settings.team === 'CT' ? '反恐精英' : '恐怖分子'}，`}
              {settings.mode === 'bomb' ? (settings.team === 'T' ? '在 A 或 B 点安放炸弹，或消灭所有 CT。' : '阻止 T 安放炸弹，或拆除已安放的炸弹。') : settings.mode === 'gungame' ? '每两次击杀升级武器，用军刀终结比赛。' : '尽可能多地击杀敌人。'}
            </div>
            <button onClick={begin} className="mt-6 w-full bg-amber-400 hover:bg-amber-300 text-black font-black text-lg py-3 tracking-widest shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-none">点击进入战场</button>
            <div className="text-[11px] text-white/40 mt-3">游戏将锁定鼠标 · 按 Esc 可随时暂停</div>
          </div>
        </div>
      )}

      {started && paused && !buyOpen && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-mono">
          <div className="w-[380px] p-6 bg-[#121820] border-2 border-white/15">
            <div className="text-2xl font-black tracking-widest">游戏暂停</div>
            {!showSettings ? (
              <div className="flex flex-col gap-2 mt-5">
                <button onClick={() => eng?.resume()} className="bg-amber-400 hover:bg-amber-300 text-black font-black py-3 tracking-widest">继续游戏</button>
                <button onClick={() => setShowSettings(true)} className="bg-white/10 hover:bg-white/20 py-3 font-bold border border-white/15">设置</button>
                <button onClick={onQuit} className="bg-red-900/50 hover:bg-red-800/60 py-3 font-bold border border-red-500/30">退出到主菜单</button>
                <div className="text-[11px] text-white/40 mt-2 leading-relaxed">提示：机器人在你暂停时也会停止行动。</div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-5">
                <Range label="鼠标灵敏度" v={local.sensitivity} min={0.2} max={4} step={0.1} fmt={(x) => x.toFixed(1)} onChange={(x) => applySettings({ sensitivity: x })} />
                <Range label="视野 FOV" v={local.fov} min={60} max={110} step={1} fmt={(x) => `${x}°`} onChange={(x) => applySettings({ fov: x })} />
                <Range label="音量" v={local.volume} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(x) => applySettings({ volume: x })} />
                <div className="flex gap-2">{['#00ff00', '#00e5ff', '#ffeb3b', '#ff4081', '#ffffff'].map((c) => <button key={c} onClick={() => applySettings({ crosshairColor: c })} className="w-8 h-8 border-2" style={{ background: c, borderColor: local.crosshairColor === c ? '#fff' : '#333' }} />)}</div>
                <button onClick={() => setShowSettings(false)} className="bg-white/10 hover:bg-white/20 py-2 font-bold border border-white/15">返回</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Range({ label, v, min, max, step, fmt, onChange }: { label: string; v: number; min: number; max: number; step: number; fmt: (x: number) => string; onChange: (x: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-white/60">{label}</span><span className="text-amber-300">{fmt(v)}</span></div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-amber-400" />
    </div>
  );
}

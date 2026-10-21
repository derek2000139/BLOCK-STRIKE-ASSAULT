import type { MatchResult, GameSettings } from '../game/types';
import Scoreboard from './Scoreboard';
import { cn } from '../utils/cn';

export default function EndScreen({ r, settings, onRestart, onMenu }: { r: MatchResult; settings: GameSettings; onRestart: () => void; onMenu: () => void }) {
  const playerWon = r.winner === 'player' || (r.winner === settings.team && (r.mode === 'bomb' || r.mode === 'tdm'));
  const draw = r.winner === 'draw';
  const kd = (r.playerKills / Math.max(1, r.playerDeaths)).toFixed(2);
  const hsRate = r.playerKills ? Math.round((r.playerHeadshots / r.playerKills) * 100) : 0;
  return (
    <div className="fixed inset-0 text-white font-mono overflow-auto bg-black">
      <div className="relative z-10 min-h-full flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center">
          <div className="text-xs tracking-[0.4em] text-white/50">比赛结束</div>
          <div className={cn('text-5xl md:text-6xl font-black drop-shadow-[4px_4px_0_#000] mt-2', draw ? 'text-white' : playerWon ? 'text-amber-400' : 'text-red-500')}>
            {draw ? '平局' : playerWon ? '胜利' : '失败'}
          </div>
          <div className="mt-2 text-lg text-white/80">
            {r.mode === 'bomb' || r.mode === 'tdm' ? (<>{r.winnerName}获胜 · <span className="text-sky-300">{r.scoreCT}</span> : <span className="text-amber-300">{r.scoreT}</span></>) : (<>获胜者：<span className="text-amber-300 font-bold">{r.winnerName}</span></>)}
          </div>
          <div className="text-sm text-white/50 mt-1">MVP：{r.mvp} · 用时 {Math.floor(r.duration / 60)} 分 {Math.floor(r.duration % 60)} 秒</div>
        </div>
        <div className="grid grid-cols-5 gap-2 w-full max-w-3xl">
          {[['击杀', r.playerKills], ['死亡', r.playerDeaths], ['K/D', kd], ['爆头率', `${hsRate}%`], ['总伤害', r.playerDamage]].map(([l, v]) => (
            <div key={l as string} className="bg-black/60 border border-white/15 p-3 text-center"><div className="text-[10px] text-white/50 tracking-widest">{l}</div><div className="text-2xl font-black">{v}</div></div>
          ))}
        </div>
        <div className="relative w-full max-w-3xl h-[360px]">
          <Scoreboard stats={r.stats} mode={r.mode} scoreCT={r.scoreCT} scoreT={r.scoreT} playerTeam={settings.team} title="最终战绩" />
        </div>
        <div className="flex gap-3">
          <button onClick={onRestart} className="bg-amber-400 hover:bg-amber-300 text-black font-black px-8 py-3 tracking-widest shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-none">再来一局</button>
          <button onClick={onMenu} className="bg-white/10 hover:bg-white/20 font-bold px-8 py-3 tracking-widest border border-white/20">返回主菜单</button>
        </div>
      </div>
    </div>
  );
}

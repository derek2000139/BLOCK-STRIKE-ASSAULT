import type { GameMode, PlayerStats, Team } from '../game/types';
import { GUNGAME_ORDER, WEAPONS } from '../game/weapons';
import { cn } from '../utils/cn';

export default function Scoreboard({ stats, mode, scoreCT, scoreT, playerTeam, title }: { stats: PlayerStats[]; mode: GameMode; scoreCT: number; scoreT: number; playerTeam: Team; title?: string }) {
  const sortFn = (a: PlayerStats, b: PlayerStats) => (mode === 'gungame' ? b.gunLevel - a.gunLevel || b.kills - a.kills : b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
  const teamBased = mode === 'bomb' || mode === 'tdm';
  const Table = ({ rows, team }: { rows: PlayerStats[]; team?: Team }) => (
    <table className="w-full text-sm">
      <thead>
        <tr className={cn('text-[10px] tracking-widest', team === 'CT' ? 'text-sky-300' : team === 'T' ? 'text-amber-300' : 'text-white/60')}>
          <th className="text-left px-3 py-1 font-normal">{team === 'CT' ? '反恐精英' : team === 'T' ? '恐怖分子' : '玩家'}</th>
          {mode === 'gungame' && <th className="font-normal px-2">武器</th>}
          <th className="font-normal px-2">击杀</th><th className="font-normal px-2">助攻</th><th className="font-normal px-2">死亡</th>
          <th className="font-normal px-2">K/D</th><th className="font-normal px-2">得分</th>
          {mode === 'bomb' && <th className="font-normal px-2">金钱</th>}
          <th className="font-normal px-2">延迟</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={cn('border-t border-white/5', r.isPlayer ? 'bg-amber-400/15' : '', !r.alive && mode === 'bomb' ? 'opacity-45' : '')}>
            <td className="px-3 py-1.5 font-bold flex items-center gap-2">
              {!teamBased && <span className={cn('w-2 h-2 rounded-full', r.team === 'CT' ? 'bg-sky-400' : 'bg-amber-400')} />}
              {r.name}{r.isPlayer && <span className="text-[9px] bg-amber-400 text-black px-1">你</span>}{!r.alive && mode === 'bomb' && <span className="text-[9px] text-red-400">阵亡</span>}
            </td>
            {mode === 'gungame' && <td className="text-center px-2 text-[11px]">{WEAPONS[GUNGAME_ORDER[Math.min(r.gunLevel, GUNGAME_ORDER.length - 1)]].name} <span className="text-white/40">({r.gunLevel + 1})</span></td>}
            <td className="text-center px-2">{r.kills}</td><td className="text-center px-2">{r.assists}</td><td className="text-center px-2">{r.deaths}</td>
            <td className="text-center px-2">{(r.kills / Math.max(1, r.deaths)).toFixed(2)}</td><td className="text-center px-2">{r.score}</td>
            {mode === 'bomb' && <td className="text-center px-2 text-emerald-300">${r.money}</td>}
            <td className="text-center px-2 text-white/50">{r.ping}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-mono">
      <div className="w-full max-w-3xl bg-[#0f141b]/95 border-2 border-white/15 shadow-2xl">
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
          <div className="font-black tracking-widest">{title ?? '计分板'} · ASSAULT</div>
          {teamBased && <div className="flex items-center gap-3 text-xl font-black"><span className="text-sky-300">{scoreCT}</span><span className="text-white/30">:</span><span className="text-amber-300">{scoreT}</span></div>}
          <div className="text-xs text-white/50">{mode === 'bomb' ? '爆破模式' : mode === 'tdm' ? '团队死斗' : mode === 'ffa' ? '死亡竞赛' : '军备竞赛'}</div>
        </div>
        {teamBased ? (
          <>
            <Table rows={stats.filter((s) => s.team === (playerTeam === 'CT' ? 'CT' : 'T')).sort(sortFn)} team={playerTeam} />
            <div className="h-2 bg-black" />
            <Table rows={stats.filter((s) => s.team === (playerTeam === 'CT' ? 'T' : 'CT')).sort(sortFn)} team={playerTeam === 'CT' ? 'T' : 'CT'} />
          </>
        ) : (
          <Table rows={[...stats].sort(sortFn)} />
        )}
      </div>
    </div>
  );
}

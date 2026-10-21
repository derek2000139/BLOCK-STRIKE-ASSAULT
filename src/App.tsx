import { useState } from 'react';
import Menu from './components/Menu';
import GameScreen from './components/GameScreen';
import EndScreen from './components/EndScreen';
import type { GameSettings, MatchResult } from './game/types';

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'bomb',
  team: 'CT',
  difficulty: 'normal',
  botCount: 5,
  sensitivity: 1.2,
  fov: 90,
  playerName: '玩家',
  roundLimit: 8,
  scoreLimit: 40,
  volume: 0.6,
  crosshairColor: '#00ff00',
};

function loadSettings(): GameSettings {
  try {
    const s = localStorage.getItem('blockstrike_settings');
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'end'>('menu');
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const saveSettings = (s: GameSettings) => {
    setSettings(s);
    try { localStorage.setItem('blockstrike_settings', JSON.stringify(s)); } catch { /* ignore */ }
  };

  const start = (s: GameSettings) => {
    saveSettings(s);
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  if (screen === 'game') {
    return (
      <GameScreen
        key={gameKey}
        settings={settings}
        onSettings={saveSettings}
        onEnd={(r) => { setResult(r); setScreen('end'); }}
        onQuit={() => setScreen('menu')}
      />
    );
  }
  if (screen === 'end' && result) {
    return <EndScreen r={result} settings={settings} onRestart={() => start(settings)} onMenu={() => setScreen('menu')} />;
  }
  return <Menu initial={settings} onStart={start} />;
}

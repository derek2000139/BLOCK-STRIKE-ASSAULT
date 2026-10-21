export type Team = 'CT' | 'T';
export type GameMode = 'bomb' | 'tdm' | 'ffa' | 'gungame';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

export type WeaponSlot = 'primary' | 'secondary' | 'melee' | 'grenade' | 'bomb';
export type WeaponClass = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'shotgun' | 'heavy' | 'knife' | 'grenade' | 'c4';
export type GrenadeKind = 'he' | 'flash' | 'smoke';

export interface WeaponDef {
  id: string;
  name: string;
  slot: WeaponSlot;
  cls: WeaponClass;
  price: number;
  damage: number;
  headMult: number;
  rpm: number; // rounds per minute
  mag: number;
  reserve: number;
  reloadTime: number;
  spread: number; // base inaccuracy (radians)
  moveSpread: number;
  recoil: number;
  range: number;
  pellets?: number;
  auto: boolean;
  penetration: number; // armor penetration 0..1
  killReward: number;
  moveSpeed: number;
  scope?: number; // zoom fov
  grenade?: GrenadeKind;
  teamOnly?: Team;
  color: string;
  tagline: string;
}

export interface KillEvent {
  id: number;
  killer: string;
  killerTeam: Team;
  victim: string;
  victimTeam: Team;
  weapon: string;
  headshot: boolean;
  time: number;
}

export interface PlayerStats {
  id: number;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  alive: boolean;
  isPlayer: boolean;
  money: number;
  score: number;
  gunLevel: number;
  ping: number;
}

export interface WeaponHudInfo {
  id: string;
  name: string;
  slot: WeaponSlot;
  ammo: number;
  reserve: number;
  count?: number;
}

export interface HudState {
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  team: Team;
  weapon: WeaponHudInfo | null;
  inventory: WeaponHudInfo[];
  reloading: boolean;
  reloadProgress: number;
  roundTime: number;
  roundPhase: 'freeze' | 'live' | 'planted' | 'end' | 'warmup';
  phaseLabel: string;
  scoreCT: number;
  scoreT: number;
  roundNumber: number;
  kills: KillEvent[];
  stats: PlayerStats[];
  hitMarker: number;
  damageDirs: { angle: number; t: number }[];
  flash: number;
  bombPlanted: boolean;
  bombTimer: number;
  hasBomb: boolean;
  planting: number;
  defusing: number;
  canBuy: boolean;
  announcement: string;
  announcementT: number;
  mode: GameMode;
  scoped: boolean;
  gunLevel: number;
  gunLevelMax: number;
  radar: RadarInfo;
  killStreakText: string;
  fps: number;
  spectating: string;
  respawnIn: number;
  dead: boolean;
  nearBombSite: boolean;
  nearBomb: boolean;
  lowAmmo: boolean;
}

export interface RadarInfo {
  px: number;
  pz: number;
  yaw: number;
  entities: { x: number; z: number; team: Team; alive: boolean; isPlayer: boolean }[];
  bomb?: { x: number; z: number };
}

export interface GameSettings {
  mode: GameMode;
  team: Team;
  difficulty: Difficulty;
  botCount: number; // per team (or total for ffa)
  sensitivity: number;
  fov: number;
  playerName: string;
  roundLimit: number; // bomb mode rounds to win
  scoreLimit: number; // tdm/ffa kills to win
  volume: number;
  crosshairColor: string;
}

export interface MatchResult {
  winner: Team | 'player' | 'bot' | 'draw';
  winnerName: string;
  scoreCT: number;
  scoreT: number;
  stats: PlayerStats[];
  mvp: string;
  playerKills: number;
  playerDeaths: number;
  playerHeadshots: number;
  playerDamage: number;
  mode: GameMode;
  duration: number;
}

import type { WeaponDef } from './types';

const W = (d: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'slot' | 'cls'>): WeaponDef => ({
  price: 0,
  damage: 20,
  headMult: 4,
  rpm: 600,
  mag: 30,
  reserve: 90,
  reloadTime: 2.2,
  spread: 0.01,
  moveSpread: 0.05,
  recoil: 0.02,
  range: 150,
  auto: true,
  penetration: 0.7,
  killReward: 300,
  moveSpeed: 1,
  color: '#999',
  tagline: '',
  ...d,
});

export const WEAPONS: Record<string, WeaponDef> = {
  knife: W({ id: 'knife', name: '军刀', slot: 'melee', cls: 'knife', damage: 40, headMult: 1.5, rpm: 110, mag: 1, reserve: 0, reloadTime: 0, spread: 0, moveSpread: 0, recoil: 0, range: 2.2, auto: true, penetration: 1, killReward: 1500, moveSpeed: 1.08, color: '#cfd8dc', tagline: '近战武器，击杀奖励最高' }),
  glock: W({ id: 'glock', name: '格洛克-18', slot: 'secondary', cls: 'pistol', price: 200, damage: 30, rpm: 400, mag: 20, reserve: 120, reloadTime: 2.2, spread: 0.012, moveSpread: 0.045, recoil: 0.018, auto: false, penetration: 0.47, killReward: 300, moveSpeed: 1.04, teamOnly: 'T', color: '#424242', tagline: 'T 方初始手枪，弹容量大' }),
  usp: W({ id: 'usp', name: 'USP 消音版', slot: 'secondary', cls: 'pistol', price: 200, damage: 35, rpm: 352, mag: 12, reserve: 24, reloadTime: 2.2, spread: 0.009, moveSpread: 0.04, recoil: 0.02, auto: false, penetration: 0.5, killReward: 300, moveSpeed: 1.04, teamOnly: 'CT', color: '#37474f', tagline: 'CT 方初始手枪，精准消音' }),
  p250: W({ id: 'p250', name: 'P250', slot: 'secondary', cls: 'pistol', price: 300, damage: 38, rpm: 400, mag: 13, reserve: 26, reloadTime: 2.2, spread: 0.011, moveSpread: 0.045, recoil: 0.024, auto: false, penetration: 0.64, killReward: 300, moveSpeed: 1.04, color: '#5d4037', tagline: '性价比极高的手枪' }),
  deagle: W({ id: 'deagle', name: '沙漠之鹰', slot: 'secondary', cls: 'pistol', price: 700, damage: 63, headMult: 4, rpm: 267, mag: 7, reserve: 35, reloadTime: 2.2, spread: 0.014, moveSpread: 0.09, recoil: 0.06, auto: false, penetration: 0.93, killReward: 300, moveSpeed: 1.0, color: '#9e9e9e', tagline: '一枪爆头，高伤害大口径手枪' }),
  mp9: W({ id: 'mp9', name: 'MP9', slot: 'primary', cls: 'smg', price: 1250, damage: 26, rpm: 857, mag: 30, reserve: 120, reloadTime: 2.1, spread: 0.014, moveSpread: 0.03, recoil: 0.014, auto: true, penetration: 0.6, killReward: 600, moveSpeed: 1.06, teamOnly: 'CT', color: '#455a64', tagline: '射速极快的轻型冲锋枪' }),
  mac10: W({ id: 'mac10', name: 'MAC-10', slot: 'primary', cls: 'smg', price: 1050, damage: 29, rpm: 800, mag: 30, reserve: 100, reloadTime: 2.6, spread: 0.018, moveSpread: 0.035, recoil: 0.016, auto: true, penetration: 0.57, killReward: 600, moveSpeed: 1.06, teamOnly: 'T', color: '#546e7a', tagline: 'T 方经济局利器' }),
  mp5: W({ id: 'mp5', name: 'MP5-SD', slot: 'primary', cls: 'smg', price: 1500, damage: 27, rpm: 750, mag: 30, reserve: 120, reloadTime: 2.5, spread: 0.012, moveSpread: 0.03, recoil: 0.013, auto: true, penetration: 0.63, killReward: 600, moveSpeed: 1.04, color: '#263238', tagline: '消音冲锋枪，后坐力小' }),
  nova: W({ id: 'nova', name: '新星', slot: 'primary', cls: 'shotgun', price: 1050, damage: 26, headMult: 2.5, rpm: 68, mag: 8, reserve: 32, reloadTime: 3.2, spread: 0.07, moveSpread: 0.08, recoil: 0.07, range: 30, pellets: 9, auto: false, penetration: 0.5, killReward: 900, moveSpeed: 0.98, color: '#4e342e', tagline: '近距离一击致命的霰弹枪' }),
  xm1014: W({ id: 'xm1014', name: 'XM1014', slot: 'primary', cls: 'shotgun', price: 2000, damage: 20, headMult: 2.5, rpm: 171, mag: 7, reserve: 32, reloadTime: 3.5, spread: 0.075, moveSpread: 0.09, recoil: 0.05, range: 28, pellets: 6, auto: true, penetration: 0.8, killReward: 900, moveSpeed: 0.96, color: '#37474f', tagline: '自动霰弹枪' }),
  famas: W({ id: 'famas', name: '法玛斯', slot: 'primary', cls: 'rifle', price: 2050, damage: 30, rpm: 666, mag: 25, reserve: 90, reloadTime: 3.3, spread: 0.009, moveSpread: 0.06, recoil: 0.022, auto: true, penetration: 0.7, killReward: 300, moveSpeed: 0.98, teamOnly: 'CT', color: '#33691e', tagline: 'CT 方廉价步枪' }),
  galil: W({ id: 'galil', name: '加利尔 AR', slot: 'primary', cls: 'rifle', price: 1800, damage: 30, rpm: 666, mag: 35, reserve: 90, reloadTime: 3.0, spread: 0.01, moveSpread: 0.065, recoil: 0.024, auto: true, penetration: 0.78, killReward: 300, moveSpeed: 0.98, teamOnly: 'T', color: '#4e342e', tagline: 'T 方廉价步枪' }),
  m4: W({ id: 'm4', name: 'M4A4', slot: 'primary', cls: 'rifle', price: 2900, damage: 33, rpm: 666, mag: 30, reserve: 90, reloadTime: 3.1, spread: 0.0075, moveSpread: 0.06, recoil: 0.024, auto: true, penetration: 0.7, killReward: 300, moveSpeed: 0.97, teamOnly: 'CT', color: '#263238', tagline: 'CT 方主力步枪，稳定可靠' }),
  ak47: W({ id: 'ak47', name: 'AK-47', slot: 'primary', cls: 'rifle', price: 2700, damage: 36, headMult: 4, rpm: 600, mag: 30, reserve: 90, reloadTime: 2.5, spread: 0.008, moveSpread: 0.07, recoil: 0.03, auto: true, penetration: 0.775, killReward: 300, moveSpeed: 0.96, teamOnly: 'T', color: '#6d4c41', tagline: 'T 方主力步枪，一枪爆头' }),
  aug: W({ id: 'aug', name: 'AUG', slot: 'primary', cls: 'rifle', price: 3300, damage: 28, rpm: 600, mag: 30, reserve: 90, reloadTime: 3.8, spread: 0.007, moveSpread: 0.06, recoil: 0.022, auto: true, penetration: 0.9, killReward: 300, moveSpeed: 0.96, scope: 45, teamOnly: 'CT', color: '#558b2f', tagline: '带瞄准镜的 CT 步枪' }),
  sg553: W({ id: 'sg553', name: 'SG 553', slot: 'primary', cls: 'rifle', price: 3000, damage: 30, rpm: 545, mag: 30, reserve: 90, reloadTime: 2.8, spread: 0.007, moveSpread: 0.06, recoil: 0.026, auto: true, penetration: 1.0, killReward: 300, moveSpeed: 0.96, scope: 45, teamOnly: 'T', color: '#33691e', tagline: '带瞄准镜的 T 步枪' }),
  ssg08: W({ id: 'ssg08', name: 'SSG 08', slot: 'primary', cls: 'sniper', price: 1700, damage: 88, headMult: 4, rpm: 48, mag: 10, reserve: 90, reloadTime: 3.7, spread: 0.002, moveSpread: 0.12, recoil: 0.06, auto: false, penetration: 0.85, killReward: 300, moveSpeed: 1.02, scope: 20, color: '#3e2723', tagline: '轻型狙击步枪，爆头致命' }),
  awp: W({ id: 'awp', name: 'AWP', slot: 'primary', cls: 'sniper', price: 4750, damage: 115, headMult: 4, rpm: 41, mag: 5, reserve: 30, reloadTime: 3.7, spread: 0.001, moveSpread: 0.2, recoil: 0.09, auto: false, penetration: 0.975, killReward: 100, moveSpeed: 0.86, scope: 15, color: '#827717', tagline: '一击必杀的重型狙击步枪' }),
  m249: W({ id: 'm249', name: 'M249', slot: 'primary', cls: 'heavy', price: 5200, damage: 32, rpm: 750, mag: 100, reserve: 200, reloadTime: 5.7, spread: 0.016, moveSpread: 0.1, recoil: 0.028, auto: true, penetration: 0.8, killReward: 300, moveSpeed: 0.84, color: '#37474f', tagline: '百发弹链机枪' }),
  hegrenade: W({ id: 'hegrenade', name: '高爆手雷', slot: 'grenade', cls: 'grenade', price: 300, damage: 98, rpm: 60, mag: 1, reserve: 0, reloadTime: 0, spread: 0, moveSpread: 0, recoil: 0, auto: false, penetration: 0.57, killReward: 300, moveSpeed: 1.04, grenade: 'he', color: '#2e7d32', tagline: '范围爆炸伤害' }),
  flashbang: W({ id: 'flashbang', name: '闪光弹', slot: 'grenade', cls: 'grenade', price: 200, damage: 0, rpm: 60, mag: 1, reserve: 0, reloadTime: 0, spread: 0, moveSpread: 0, recoil: 0, auto: false, penetration: 0, killReward: 300, moveSpeed: 1.04, grenade: 'flash', color: '#90a4ae', tagline: '致盲敌人数秒' }),
  smoke: W({ id: 'smoke', name: '烟雾弹', slot: 'grenade', cls: 'grenade', price: 300, damage: 0, rpm: 60, mag: 1, reserve: 0, reloadTime: 0, spread: 0, moveSpread: 0, recoil: 0, auto: false, penetration: 0, killReward: 300, moveSpeed: 1.04, grenade: 'smoke', color: '#78909c', tagline: '遮挡视线的烟幕' }),
  c4: W({ id: 'c4', name: 'C4 炸弹', slot: 'bomb', cls: 'c4', damage: 500, rpm: 60, mag: 1, reserve: 0, reloadTime: 0, spread: 0, moveSpread: 0, recoil: 0, auto: false, penetration: 1, killReward: 0, moveSpeed: 1.04, color: '#b71c1c', tagline: '在炸弹点安放（长按 E）' }),
};

export const GUNGAME_ORDER = ['glock', 'usp', 'p250', 'deagle', 'nova', 'xm1014', 'mac10', 'mp9', 'mp5', 'galil', 'famas', 'ak47', 'm4', 'sg553', 'aug', 'm249', 'ssg08', 'awp', 'knife'];

export const BUY_CATEGORIES: { label: string; key: string; items: string[] }[] = [
  { label: '手枪', key: 'pistol', items: ['glock', 'usp', 'p250', 'deagle'] },
  { label: '重型', key: 'heavy', items: ['nova', 'xm1014', 'm249'] },
  { label: '冲锋枪', key: 'smg', items: ['mac10', 'mp9', 'mp5'] },
  { label: '步枪', key: 'rifle', items: ['galil', 'famas', 'ak47', 'm4', 'sg553', 'aug', 'ssg08', 'awp'] },
  { label: '装备', key: 'gear', items: ['kevlar', 'kevlarhelmet', 'defuser', 'hegrenade', 'flashbang', 'smoke'] },
];

export const GEAR_PRICES: Record<string, { name: string; price: number; desc: string }> = {
  kevlar: { name: '防弹衣', price: 650, desc: '100 点护甲，减少身体伤害' },
  kevlarhelmet: { name: '防弹衣 + 头盔', price: 1000, desc: '护甲并保护头部' },
  defuser: { name: '拆弹器', price: 400, desc: '拆弹时间减半（仅 CT）' },
};

export const CLASS_NAME: Record<string, string> = {
  pistol: '手枪', smg: '冲锋枪', rifle: '步枪', sniper: '狙击枪', shotgun: '霰弹枪', heavy: '机枪', knife: '近战', grenade: '投掷物', c4: '炸弹',
};

/* fishing.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   釣魚
   ============================================================ */
const PIER = { x0: -1.65, x1: 1.65, z0: 12.7, z1: 24.3, deckY: 1.15 };
function pierHeightAt(x, z) {
  return (x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1) ? PIER.deckY + 0.08 : null;
}
function groundHeightAt(x, z) {
  if (typeof AREA !== 'undefined' && AREA !== 'island' && typeof areaGroundHeightAt === 'function') return areaGroundHeightAt(x, z);
  const p = pierHeightAt(x, z);
  return (p === null) ? heightAt(x, z) : Math.max(heightAt(x, z), p);
}
function walkableAt(x, z) {
  if (typeof AREA !== 'undefined' && AREA !== 'island' && typeof areaWalkableAt === 'function') return areaWalkableAt(x, z);
  /* 小屋是不可穿越的實體 */
  const dx = x - CABIN.x, dz = z - CABIN.z;
  if (dx * dx + dz * dz < CABIN.r * CABIN.r) return false;
  /* 其他方塊（蚯蚓槽等） */
  for (let i = 0; i < BLOCKERS.length; i++) {
    const b = BLOCKERS[i];
    if (Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz) return false;
  }
  /* 石頭碰撞 */
  if (typeof ROCK_COLLIDERS !== 'undefined') {
    for (let i = 0; i < ROCK_COLLIDERS.length; i++) {
      const rc = ROCK_COLLIDERS[i];
      if (Math.hypot(x - rc.x, z - rc.z) < rc.r) return false;
    }
  }
  return pierHeightAt(x, z) !== null || heightAt(x, z) > 0.2;
}

/* 魚種（依 docs/設計規格.md 第 114–141 行） */
const FISH_TABLE = [
  { name: '沙丁魚',   time: 'day',   rarity: '常見', price: 12,  note: '新手魚' },
  { name: '花身雞魚', time: 'day',   rarity: '常見', price: 16,  note: '' },
  { name: '臭肚魚',   time: 'day',   rarity: '常見', price: 18,  note: '' },
  { name: '虱目魚',   time: 'day',   rarity: '常見', price: 22,  note: '' },
  { name: '黑鯛',     time: 'day',   rarity: '少見', price: 40,  note: '' },
  { name: '龍占',     time: 'day',   rarity: '少見', price: 48,  note: '' },
  { name: '鸚哥魚',   time: 'day',   rarity: '少見', price: 52,  note: '' },
  { name: '剝皮魚',   time: 'day',   rarity: '少見', price: 45,  note: '' },
  { name: '石斑',     time: 'day',   rarity: '稀有', price: 95,  note: '' },
  { name: '鬼頭刀',   time: 'day',   rarity: '稀有', price: 110, note: '' },
  { name: '飛魚',     time: 'day',   rarity: '稀有', price: 88,  note: '' },
  { name: '紅甘',     time: 'day',   rarity: '傳說', price: 180, note: '' },
  { name: '竹筴魚',   time: 'night', rarity: '常見', price: 14,  note: '' },
  { name: '白帶魚',   time: 'night', rarity: '常見', price: 20,  note: '' },
  { name: '大眼鯛',   time: 'night', rarity: '常見', price: 24,  note: '' },
  { name: '石狗公',   time: 'night', rarity: '常見', price: 26,  note: '' },
  { name: '海鰻',     time: 'night', rarity: '少見', price: 42,  note: '' },
  { name: '錢鰻',     time: 'night', rarity: '少見', price: 50,  note: '' },
  { name: '皮刀魚',   time: 'night', rarity: '少見', price: 46,  note: '' },
  { name: '黑喉',     time: 'night', rarity: '稀有', price: 92,  note: '' },
  { name: '燈籠魚',   time: 'night', rarity: '稀有', price: 100, note: '發光' },
  { name: '赤宗',     time: 'night', rarity: '稀有', price: 85,  note: '' },
  { name: '月魚',     time: 'night', rarity: '傳說', price: 170, note: '發光' },
  { name: '皇帶魚',   time: 'night', rarity: '傳說', price: 220, note: '極稀有' }
];

const RARITY = {
  '常見': { w: 1.00, size: [12, 28],  color: '#7fb6a8' },
  '少見': { w: 0.42, size: [22, 45],  color: '#6c9fd6' },
  '稀有': { w: 0.16, size: [35, 80],  color: '#c08ad8' },
  '傳說': { w: 0.05, size: [70, 170], color: '#e0a845' }
};


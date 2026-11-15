/* inventory.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   背包與圖鑑
   ============================================================ */
const INV_SIZE = 30;
let STORE_SIZE = 15;
const inventory = {};   // 魚簍：名稱 → { name, count, price, rarity, color, ic, maxSize }
const storage = {};     // 倉庫
const dex = {};         // 名稱 → { maxSize }
let gold = 0;
let diamond = 0;
let bait = 10;          // 蚯蚓

const elsInv = document.getElementById('panel-inv');
const elsDex = document.getElementById('panel-dex');
const elsShop = document.getElementById('panel-shop');
const elsChest = document.getElementById('panel-chest');
const elsMineral = document.getElementById('panel-mineral');
let MINERAL_STORE_SIZE = 15;
const MINERAL_STORE_MAX = 30;
let mineralStoreLv = 1;
const mineralStore = {};     // 礦物倉庫

const RARITY_MULT = { '常見': 1.00, '少見': 1.06, '稀有': 1.12, '傳說': 1.20 };

function iconSVG(ic, color, faded) {
  const op = faded ? ' opacity=".26"' : '';
  const ink = faded ? ' opacity=".3"' : '';
  if (ic === 'shrimp') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M20.5 3.2c-6-2.2-12 .6-13.4 5.4-1.1 3.8 2 6.4 5.2 5.2 3-1.1 3.8-4.4 1.9-6.2" ' +
      'fill="none" stroke="' + color + '" stroke-width="3.4" stroke-linecap="round"' + op + '/>' +
      '<path d="M20.5 3.2l4.2.9-3.1 3.1z" fill="' + color + '"' + op + '/></svg>';
  }
  if (ic === 'crab') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14.2" rx="9" ry="1" fill="#000000" opacity=".18"/>' +
      '<ellipse cx="3.7" cy="12.6" rx="1.9" ry="1.1" fill="' + color + '"' + op + ' transform="rotate(30 3.7 12.6)"/>' +
      '<ellipse cx="22.3" cy="12.6" rx="1.9" ry="1.1" fill="' + color + '"' + op + ' transform="rotate(-30 22.3 12.6)"/>' +
      '<path d="M6.2 9.6L3 10.6M6.2 11L2.9 12.4M19.8 9.6L23 10.6M19.8 11L23.1 12.4" stroke="' + color + '" stroke-width="1.15" stroke-linecap="round"' + op + '/>' +
      '<path d="M5.6 5.6C3.6 4.7 2.1 2.7 2.4 1.2 3.3 .1 5.2 .8 5.8 2.4 6.3 3.9 6.1 4.9 5.6 5.6Z" fill="' + color + '"' + op + '/>' +
      '<path d="M20.4 5.6C22.4 4.7 23.9 2.7 23.6 1.2 22.7 .1 20.8 .8 20.2 2.4 19.7 3.9 19.9 4.9 20.4 5.6Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 2.2C17.2 2.2 20 4.1 20.9 7c.3 1.2-.4 1.7-1.1 2.1l-.6 3.2c-2.4 1.1-10 1.1-12.4 0l-.6-3.2c-.7-.4-1.4-.9-1.1-2.1C6 4.1 8.8 2.2 13 2.2Z" fill="' + color + '"' + op + '/>' +
      '<path d="M5.3 6.2L2.6 5.2M6 8.2L3.2 7.8M20.7 6.2L23.4 5.2M20 8.2L22.8 7.8" stroke="' + color + '" stroke-width="1.05" stroke-linecap="round"' + op + '/>' +
      '<circle cx="9.8" cy="6.2" r=".8" fill="#ffe9a8" opacity=".85"/>' +
      '<circle cx="15.9" cy="5.7" r=".7" fill="#ffe9a8" opacity=".85"/>' +
      '<circle cx="12.8" cy="9.2" r=".8" fill="#ffe9a8" opacity=".8"/>' +
      '<circle cx="17.3" cy="9.6" r=".6" fill="#ffe9a8" opacity=".8"/>' +
      '<circle cx="10.5" cy="4.7" r=".75" fill="#1b2b33"' + ink + '/>' +
      '<circle cx="15.5" cy="4.7" r=".75" fill="#1b2b33"' + ink + '/></svg>';
  }
  if (ic === 'stonecrab') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14" rx="8.6" ry="1" fill="#000000" opacity=".2"/>' +
      '<path d="M6.2 10.2L3.2 12.8M6.2 11.6L3 11.2M6.2 12.8L3.6 10.2M19.8 10.2L22.8 12.8M19.8 11.6L23 11.2M19.8 12.8L22.4 10.2" ' +
      'stroke="' + color + '" stroke-width="1.2" stroke-linecap="round"' + op + '/>' +
      '<path d="M4.9 6.6C2.5 5.5 .9 3.1 1.2 1.3 2.1 .1 4.3 .8 5.1 2.5 5.8 4.2 5.6 5.4 4.9 6.6Z" fill="' + color + '"' + op + '/>' +
      '<path d="M21.1 6.6C23.5 5.5 25.1 3.1 24.8 1.3 23.9 .1 21.7 .8 20.9 2.5 20.2 4.2 20.4 5.4 21.1 6.6Z" fill="' + color + '"' + op + '/>' +
      '<path d="M3.1 2.5L4.3 1.4M22.9 2.5L21.7 1.4" stroke="#00000055" stroke-width=".5"/>' +
      '<path d="M13 2.6C17.5 2.6 20.4 5 20.4 9c0 3-3.6 4-7.4 4s-7.4-1-7.4-4c0-4 2.9-6.4 7.4-6.4Z" fill="' + color + '"' + op + '/>' +
      '<path d="M8.4 8.2C10.3 6.6 15.7 6.6 17.6 8.2M8 10.6C10 11.8 16 11.8 18 10.6" stroke="#00000038" stroke-width=".9" fill="none"/>' +
      '<path d="M10.8 6.7L11.5 5.7M15.2 6.7L14.5 5.7" stroke="#00000038" stroke-width=".6"/>' +
      '<circle cx="10.2" cy="5.2" r=".8" fill="#1b2b33"' + ink + '/>' +
      '<circle cx="15.8" cy="5.2" r=".8" fill="#1b2b33"' + ink + '/>' +
      '<path d="M11.2 11.6C12.3 12.2 13.7 12.2 14.8 11.6" stroke="#1b2b33" stroke-width=".7" fill="none"/></svg>';
  }
  if (ic === 'shell') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="13.9" rx="8.4" ry="1" fill="#000000" opacity=".15"/>' +
      '<path d="M13 2.4C17.8 2.4 21.4 4.8 21.4 8.8c0 3.8-3.8 4.6-8.4 4.6s-8.4-.8-8.4-4.6C4.6 4.8 8.2 2.4 13 2.4Z" fill="' + color + '"' + op + '/>' +
      '<path d="M6.3 6.6C9 4.9 17 4.9 19.7 6.6M5.3 9C8.4 7 17.6 7 20.7 9M5.7 11.3C8.7 9.5 17.3 9.5 20.3 11.3" stroke="#8a7a60" stroke-width=".65" fill="none" opacity=".55"/>' +
      '<path d="M9.2 3.1C9.8 6.5 9.8 10 9.6 12.6M13 2.8C13 7 13 10.4 13 13M16.8 3.1C16.2 6.5 16.2 10 16.4 12.6" stroke="#b39e83" stroke-width=".45" fill="none" opacity=".7"/>' +
      '<ellipse cx="13" cy="2.6" rx="1.5" ry=".8" fill="#8a7a60"/>' +
      '<path d="M13 2.2C12.6 1.1 11.5 .8 10.6 1.2" stroke="#6e5f48" stroke-width=".7" fill="none"/>' +
      '<path d="M8.4 5.2C10.2 4.2 12.2 4.2 14 4.8" stroke="#ffffff" stroke-width=".8" stroke-linecap="round" opacity=".4"/>' +
      '<ellipse cx="8.6" cy="4.6" rx="1.6" ry=".9" fill="#ffffff" opacity=".22"/></svg>';
  }
  if (ic === 'squid') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M13 1.8l4.6 4.8H8.4z" fill="' + color + '"' + op + '/>' +
      '<path d="M10 7l-2 5.4M12 7v5.4M14 7v5.4M16 7l2 5.4" stroke="' + color + '" ' +
      'stroke-width="1.7" stroke-linecap="round"' + op + '/></svg>';
  }
  if (ic === 'stick') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M4 12.4L21 4" stroke="' + color + '" stroke-width="3" stroke-linecap="round"' + op + '/>' +
      '<path d="M13.6 8.4l2.6-4.2" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round"' + op + '/></svg>';
  }
  if (ic === 'log') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="13.9" rx="9" ry="1.1" fill="#000000" opacity=".18"/>' +
      '<path d="M3 5.2L19.6 5.2 19.6 11.2 3 11.2Z" fill="' + color + '"' + op + '/>' +
      '<path d="M3 5.2L19.6 5.2 19.6 7.2 3 7.2Z" fill="#ffffff" opacity=".14"' + op + '/>' +
      '<path d="M3 9.6L19.6 9.6 19.6 11.2 3 11.2Z" fill="#000000" opacity=".12"' + op + '/>' +
      '<path d="M4.5 8.2L18 8.2M5.5 9.4L17 9.4M7 6.8L16 6.8" stroke="#4a2e14" stroke-width=".6" opacity=".55"/>' +
      '<path d="M8.5 5.2L9.8 3.1 11 3.1 10.2 5.2Z" fill="#6b4226"/>' +
      '<ellipse cx="10" cy="3.1" rx="1.2" ry=".5" fill="#d9b98a"/>' +
      '<ellipse cx="19.9" cy="8.2" rx="2.7" ry="3" fill="#d9b98a"/>' +
      '<ellipse cx="19.9" cy="8.2" rx="2.1" ry="2.35" fill="none" stroke="#a9793f" stroke-width=".7"/>' +
      '<ellipse cx="19.9" cy="8.2" rx="1.4" ry="1.55" fill="none" stroke="#8b5a2b" stroke-width=".6"/>' +
      '<ellipse cx="19.9" cy="8.2" rx=".7" ry=".8" fill="#6b4226"/></svg>';
  }
  if (ic === 'berry') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14" rx="7" ry="1" fill="#000000" opacity=".15"/>' +
      '<path d="M13 2C13 4 12.5 5.5 12 7" stroke="#5a7a3a" stroke-width="1.1" fill="none"/>' +
      '<path d="M12.5 4.2C15.5 2.2 19 2.4 19.8 4.4 17.5 5.8 14.2 5.6 12.5 4.2Z" fill="#6a8f4a"/>' +
      '<path d="M13 4.3C15.5 3.4 18 3.6 19.3 4.3" stroke="#4a6a2e" stroke-width=".5" fill="none"/>' +
      '<circle cx="8.2" cy="10.2" r="3.4" fill="' + color + '"' + op + '/>' +
      '<circle cx="15.2" cy="10.6" r="3.1" fill="' + color + '"' + op + '/>' +
      '<circle cx="11.8" cy="6.8" r="3" fill="' + color + '"' + op + '/>' +
      '<path d="M5.5 11.5C6 13 7.5 13.8 9 13.5M13 12C13.5 13.2 15 13.8 16.4 13.4" stroke="#00000033" stroke-width=".8" fill="none"/>' +
      '<circle cx="7" cy="8.8" r="1" fill="#ffffff" opacity=".55"/>' +
      '<circle cx="14.2" cy="9.2" r=".9" fill="#ffffff" opacity=".55"/>' +
      '<circle cx="10.8" cy="5.8" r=".8" fill="#ffffff" opacity=".55"/>' +
      '<circle cx="8.2" cy="12.2" r=".5" fill="#00000044"/>' +
      '<circle cx="15.2" cy="12.6" r=".45" fill="#00000044"/>' +
      '<circle cx="11.8" cy="8.4" r=".45" fill="#00000044"/></svg>';
  }
  if (ic === 'coco') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14.3" rx="6.2" ry="1" fill="#000000" opacity=".18"/>' +
      '<ellipse cx="13" cy="8.8" rx="6.4" ry="5.8" fill="' + color + '"' + op + '/>' +
      '<path d="M9.2 4.2C8.4 6.2 8.2 9 8.6 11.4M10.8 3.6C10 6 9.8 9.4 10.2 12.6M13 3.4C13 6.4 13 9.8 13 13M15.2 3.6C16 6 16.2 9.4 15.8 12.6M16.8 4.2C17.6 6.2 17.8 9 17.4 11.4" ' +
      'stroke="#5a3a1e" stroke-width=".55" fill="none" opacity=".55"/>' +
      '<path d="M7.2 6.8C9.6 6.2 12 6.2 14.4 6.6M7 9.2C9.8 8.6 13 8.6 16 9M7.4 11.4C10 10.8 13.2 10.8 15.8 11.2" ' +
      'stroke="#6b4226" stroke-width=".45" fill="none" opacity=".35"/>' +
      '<path d="M10.4 3.8C11.8 3 14.2 3 15.6 3.8C14.4 4.8 11.6 4.8 10.4 3.8Z" fill="#8a6239" opacity=".9"/>' +
      '<circle cx="11.6" cy="4.2" r=".95" fill="#2f1b0e"/>' +
      '<circle cx="14.4" cy="4.2" r=".95" fill="#2f1b0e"/>' +
      '<circle cx="13" cy="5.5" r=".95" fill="#2f1b0e"/>' +
      '<circle cx="11.4" cy="3.95" r=".28" fill="#ffffff" opacity=".3"/>' +
      '<circle cx="14.2" cy="3.95" r=".28" fill="#ffffff" opacity=".3"/>' +
      '<ellipse cx="9.8" cy="6.4" rx="1.8" ry="1" fill="#ffffff" opacity=".16"/>' +
      '<path d="M12.4 2.8C12 1.8 11.2 1.2 10.2 1.3" stroke="#5a7a3a" stroke-width="1" fill="none" stroke-linecap="round"/></svg>';
  }
  if (ic === 'mush') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M3.6 8.4c0-4.4 4.2-7.2 9.4-7.2s9.4 2.8 9.4 7.2z" fill="' + color + '"' + op + '/>' +
      '<path d="M3.6 8.4c0-4.4 4.2-7.2 9.4-7.2s9.4 2.8 9.4 7.2z" fill="none" stroke="#ffffff" stroke-width=".7" opacity=".4"/>' +
      '<rect x="11" y="8.2" width="4" height="5.8" rx="1.8" fill="#8fc9a8" opacity=".9"/>' +
      '<circle cx="9.2" cy="5.2" r="1.3" fill="#ffffff" opacity=".6"/>' +
      '<circle cx="13" cy="4.4" r="1" fill="#ffffff" opacity=".6"/>' +
      '<circle cx="16.6" cy="5.6" r="1.2" fill="#ffffff" opacity=".6"/>' +
      '<ellipse cx="13" cy="8.4" rx="9.4" ry="1.4" fill="#4fc3a0" opacity=".35"/></svg>';
  }
  if (ic === 'glow') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14.1" rx="8.8" ry="1" fill="#000000" opacity=".15"/>' +
      '<path d="M13 2.2L9.2 1.4 9.8 3.5Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 2.2L16.8 1.4 16.2 3.5Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 2.5C7.4 2.5 4.5 5.9 4.3 10.4c2.1 1.6 4.9 2.2 8.7 2.2s6.6-.6 8.7-2.2C21.5 5.9 18.6 2.5 13 2.5Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 3.4L13 12.3M10.3 3.7L8.6 12.3M15.7 3.7L17.4 12.3M7.7 4.7L5.4 11.6M18.3 4.7L20.6 11.6M5.3 7L3.6 10.2M20.7 7L22.4 10.2" ' +
      'stroke="#ffffff" stroke-width=".7" opacity=".6"/>' +
      '<path d="M4.8 8.2C7.6 9.9 18.4 9.9 21.2 8.2M5.5 10.8C8.5 12.3 17.5 12.3 20.5 10.8" ' +
      'stroke="#5f8a7a" stroke-width=".55" fill="none" opacity=".5"/>' +
      '<circle cx="13" cy="7.4" r="1.15" fill="#ffffff" opacity=".65"/>' +
      '<circle cx="9.5" cy="8.8" r=".7" fill="#ffffff" opacity=".45"/>' +
      '<circle cx="16.5" cy="8.8" r=".7" fill="#ffffff" opacity=".45"/></svg>';
  }
  if (ic === 'jar') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<rect x="7" y="4.4" width="12" height="9" rx="2.6" fill="' + color + '"' + op + '/>' +
      '<rect x="8.6" y="1.8" width="8.8" height="2.8" rx="1.4" fill="#8a6a45"/>' +
      '<rect x="9.4" y="7" width="7.2" height="4.4" rx="1.4" fill="#ffffff" opacity=".28"/></svg>';
  }
  if (ic === 'dish') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M3.4 8.2h19.2c0 4-4.3 6.4-9.6 6.4S3.4 12.2 3.4 8.2z" fill="' + color + '"' + op + '/>' +
      '<path d="M6.6 6.4h12.8" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M9.6 1.6c0 1.2-1.2 1.6-1.2 2.8M13 1.2c0 1.4-1.2 1.8-1.2 3.2M16.4 1.6c0 1.2-1.2 1.6-1.2 2.8" ' +
      'stroke="#a8bfc8" stroke-width="1.1" stroke-linecap="round"/></svg>';
  }
  if (ic === 'mineral') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M13 2L19 5.5 19 10.5 13 14 7 10.5 7 5.5Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 2L19 5.5 13 8.5 7 5.5Z" fill="#ffffff" opacity=".25"/>' +
      '<path d="M7 5.5L13 8.5 13 14" stroke="#00000033" stroke-width=".6" fill="none"/>' +
      '<path d="M19 5.5L13 8.5 13 14" stroke="#00000033" stroke-width=".6" fill="none"/>' +
      '<path d="M13 2L13 8.5" stroke="#ffffff" stroke-width=".5" opacity=".4"/></svg>';
  }
  if (ic === 'diamond') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M13 1.6L20.2 6.2 13 14.6 5.8 6.2Z" fill="' + color + '"' + op + '/>' +
      '<path d="M5.8 6.2L20.2 6.2 13 1.6Z" fill="#ffffff" opacity=".35"/>' +
      '<path d="M5.8 6.2L13 14.6 9.4 6.2Z" fill="#000000" opacity=".18"/>' +
      '<path d="M20.2 6.2L13 14.6 16.6 6.2Z" fill="#000000" opacity=".18"/>' +
      '<path d="M9.4 6.2L13 1.6 16.6 6.2" stroke="#ffffff" stroke-width=".6" opacity=".6"/>' +
      '<path d="M9.4 6.2L13 14.6 16.6 6.2" stroke="#ffffff" stroke-width=".5" opacity=".35"/></svg>';
  }
  if (ic === 'pickaxe') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M4 13.2L11.5 5.5" stroke="#8a6a3a" stroke-width="2.4" stroke-linecap="round"' + op + '/>' +
      '<path d="M9 3.2L20.5 1.8 18.5 7.2 12 6.2Z" fill="#b8b8b8"' + op + '/>' +
      '<path d="M9 3.2L20.5 1.8" stroke="#ffffff" stroke-width=".7" opacity=".5"/>' +
      '<path d="M12 6.2L18.5 7.2" stroke="#6a6a6a" stroke-width=".6" opacity=".6"/>' +
      '<path d="M10.5 4.8L11.5 3.8" stroke="#ffffff" stroke-width=".5" opacity=".4"/></svg>';
  }
  if (ic === 'book') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M4.5 2.2C7.6 2.2 10.7 3.4 13 5.4V13.9C10.7 11.9 7.6 10.7 4.5 10.7Z" fill="' + color + '"' + op + '/>' +
      '<path d="M21.5 2.2C18.4 2.2 15.3 3.4 13 5.4V13.9C15.3 11.9 18.4 10.7 21.5 10.7Z" fill="' + color + '"' + op + ' opacity=".82"/>' +
      '<path d="M4.5 10.7C7.6 10.7 10.7 11.8 13 13.8V5.4C10.7 3.4 7.6 2.2 4.5 2.2Z" fill="#ffffff" opacity=".3"' + op + '/>' +
      '<path d="M21.5 10.7C18.4 10.7 15.3 11.8 13 13.8V5.4C15.3 3.4 18.4 2.2 21.5 2.2Z" fill="#000000" opacity=".18"' + op + '/>' +
      '<path d="M13 5.4V13.8" stroke="#5a3a1e" stroke-width=".8" opacity=".7"' + op + '/>' +
      '<path d="M8 5.1C9 5.1 10 5.4 11 5.8M8 7.1C9 7.1 10 7.4 11 7.8M8 9.1C9 9.1 10 9.4 11 9.8" stroke="#5a3a1e" stroke-width=".7" opacity=".7"' + op + '/></svg>';
  }
  if (ic === 'card') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<rect x="2.5" y="1.5" width="21" height="13" rx="2.2" fill="' + color + '"' + op + '/>' +
      '<rect x="5" y="3.5" width="16" height="9" rx="1.3" fill="#ffffff" opacity=".3"' + op + '/>' +
      '<path d="M13 4.3 L15.1 8.1 L19.3 8.3 L16.1 11.1 L17.2 15 L13 12.8 L8.8 15 L9.9 11.1 L6.7 8.3 L10.9 8.1 Z" fill="#ffffff" opacity=".9"' + op + '/></svg>';
  }
  if (ic === 'rune') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M4 2.5 h18 l-1.6 10.5 -7.4 2.5 -7.4 -2.5 Z" fill="' + color + '"' + op + '/>' +
      '<path d="M4 2.5 h18 l-1 6.5 -8 2.5 -8 -2.5 Z" fill="#ffffff" opacity=".25"' + op + '/>' +
      '<path d="M13 5.4 L16.5 12 L9.5 12 Z" fill="#ffe27a" opacity=".9"' + op + '/>' +
      '<circle cx="13" cy="9" r=".7" fill="#3a2a14"' + op + '/></svg>';
  }
  if (ic === 'potion') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<path d="M11 4.6 L15 4.6 L18.6 10.2 C19.8 12.8 17.7 14.8 13 14.8 C8.3 14.8 6.2 12.8 7.4 10.2 Z" fill="' + color + '"' + op + '/>' +
      '<path d="M11 4.6 L15 4.6 L15.8 6.1 L10.2 6.1 Z" fill="#ffffff" opacity=".3"' + op + '/>' +
      '<path d="M9.4 10.6 C11.4 11.7 14.6 11.7 16.6 10.6" stroke="#ffffff" stroke-width=".9" fill="none" opacity=".6"' + op + '/>' +
      '<rect x="10.4" y="1" width="5.2" height="2.6" rx="1" fill="#5a3f8a"' + op + '/>' +
      '<path d="M12.2 0.6 L13.8 0.6 L13.4 1.3 L12.6 1.3 Z" fill="#6a4f9e"' + op + '/></svg>';
  }
  if (ic === 'ingot') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="13.9" rx="9" ry="1.1" fill="#000000" opacity=".18"/>' +
      '<path d="M6.4 5.6 L19.6 5.6 L17 12.2 L9 12.2 Z" fill="' + color + '"' + op + '/>' +
      '<path d="M6.4 5.6 L19.6 5.6 L18.6 8 L7.4 8 Z" fill="#ffffff" opacity=".32"' + op + '/>' +
      '<path d="M9 12.2 L17 12.2 L16.2 13.6 L9.8 13.6 Z" fill="#000000" opacity=".16"' + op + '/></svg>';
  }
  if (ic === 'block') {
    return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
      '<ellipse cx="13" cy="14.1" rx="9" ry="1" fill="#000000" opacity=".18"/>' +
      '<path d="M13 2.2 L21 6.4 L13 10.6 L5 6.4 Z" fill="#ffffff" opacity=".3"' + op + '/>' +
      '<path d="M5 6.4 L13 10.6 L13 14.6 L5 10.4 Z" fill="#000000" opacity=".18"' + op + '/>' +
      '<path d="M21 6.4 L13 10.6 L13 14.6 L21 10.4 Z" fill="#000000" opacity=".12"' + op + '/>' +
      '<path d="M13 2.2 L21 6.4 L13 10.6 L5 6.4 Z" fill="' + color + '"' + op + '/>' +
      '<path d="M13 2.2 L21 6.4 L13 10.6 L5 6.4 Z" fill="none" stroke="#ffffff" stroke-width=".6" opacity=".45"' + op + '/></svg>';
  }
  return '<svg viewBox="0 0 26 16" aria-hidden="true">' +
    '<path d="M2.6 8c3.5-5.5 11-6.1 14.7 0-3.7 6.1-11.2 5.5-14.7 0z" fill="' + color + '"' + op + '/>' +
    '<path d="M17.2 8l6.4-4.4v8.8z" fill="' + color + '"' + op + '/>' +
    '<circle cx="6.9" cy="6.9" r="1" fill="#1b2b33"' + ink + '/></svg>';
}
function fishSVG(color, faded) { return iconSVG('fish', color, faded); }

/* 賣價：基礎售價 × 尺寸倍率（0.75–1.35）× 稀有度加成 */
function sellPrice(rec) {
  if (!rec.rarity) return rec.price;
  const rr = RARITY[rec.rarity];
  const span = Math.max(1, rr.size[1] - rr.size[0]);
  const s = Math.min(1, Math.max(0, ((rec.maxSize || rr.size[0]) - rr.size[0]) / span));
  return Math.round(rec.price * (0.75 + 0.6 * s) * (RARITY_MULT[rec.rarity] || 1));
}

function bagAdd(bag, item, size) {
  let rec = bag[item.name];
  if (!rec) {
    if (Object.keys(bag).length >= (bag === storage ? STORE_SIZE : INV_SIZE)) return false;
    rec = bag[item.name] = {
      name: item.name, count: 0, price: item.price, rarity: item.rarity || '',
      color: item.color, ic: item.ic || 'fish', maxSize: 0, sat: item.sat || 0,
      eff: item.eff || '', durability: (item.name === '鎬子' || item.name === '使用中鎬子') ? 30 : 0,
      use: item.use || ''
    };
  }
  rec.count++;
  if (item.use) rec.use = item.use;
  if (item.rarity && size) {
    rec.maxSize = Math.max(rec.maxSize || 0, size);
    const d = dex[item.name] || (dex[item.name] = { maxSize: 0 });
    d.maxSize = Math.max(d.maxSize, size);
  }
  refreshPanels();
  return true;
}

function invAdd(pick, size) {
  const ok = bagAdd(inventory, {
    name: pick.name, price: pick.price, rarity: pick.rarity,
    color: RARITY[pick.rarity].color, ic: 'fish'
  }, size);
  if (!ok) setPrompt('魚簍滿了，請找商人賣魚或放進倉庫', 'bad');
  return ok;
}

function refreshPanels() {
  updateHudCounters();
  if (elsInv.classList.contains('on')) renderInv();
  if (elsDex.classList.contains('on')) renderDex();
  if (elsShop.classList.contains('on')) renderShop();
  if (elsCook.classList.contains('on')) renderCook();
  if (elsChest.classList.contains('on')) renderChest();
  if (elsMineral.classList.contains('on')) renderMineral();
  const pSynth = document.getElementById('panel-synth');
  const pExch = document.getElementById('panel-exchange');
  if (pSynth && pSynth.classList.contains('on') && typeof renderSynth === 'function') renderSynth();
  if (pExch && pExch.classList.contains('on') && typeof renderExchange === 'function') renderExchange();
}

function slotHTML(rec, where) {
  if (!rec) return '<div class="slot empty"></div>';
  return '<div class="slot" data-move="' + where + '" data-name="' + rec.name +
    '" title="' + rec.name + ' ×' + rec.count + (rec.name === '使用中鎬子' ? '（耐久 ' + (rec.durability || 0) + '）' : '') + ((rec.use === 'nightfall' || rec.use === 'gatherBook' || rec.use === 'diamond50' || rec.use === 'summonRune' || rec.use === 'mysteryBook' || rec.use === 'superDiaBook') ? '（點擊使用）' : '') + '">' +
    iconSVG(rec.ic, rec.color) + '<span class="cnt">' + rec.count + (rec.name === '使用中鎬子' ? '/' + (rec.durability || 0) : '') + '</span></div>';
}

function renderInv() {
  const invNames = Object.keys(inventory).sort((a, b) => sellPrice(inventory[b]) - sellPrice(inventory[a]));
  document.getElementById('invCount').textContent = invNames.length + '/' + INV_SIZE;
  document.getElementById('invGold').textContent = gold;
  const invD = document.getElementById('invDiamond'); if (invD) invD.textContent = diamond;
  document.getElementById('invBait').textContent = bait;
  let h1 = '';
  for (let i = 0; i < INV_SIZE; i++) h1 += slotHTML(inventory[invNames[i]], 'inv');
  const g1 = document.getElementById('invGrid');
  g1.innerHTML = h1;
  g1.querySelectorAll('.slot[data-move]').forEach(el => {
    el.onclick = () => {
      const rec = inventory[el.dataset.name];
      if (rec && rec.sat) { eatDish(rec.name); return; }
      if (rec && rec.use === 'nightfall') { useNightfall(); return; }
      if (rec && rec.use === 'gatherBook') { useGatherBook(); return; }
      if (rec && rec.use === 'diamond50') { useDiamond50(); return; }
      if (rec && rec.use === 'summonRune') { summonMerchant(); return; }
      if (rec && rec.use === 'superDiaBook') { useSuperDiaBook(); return; }
      if (rec && rec.use === 'mysteryBook') { openMysteryBook(); return; }
    };
  });
}

function moveStack(where, name) {
  if (typeof NET !== 'undefined' && NET.on) {
    const src = where === 'inv' ? inventory : storage;
    const rec = src[name];
    if (!rec) return;
    if (where === 'inv' && !storage[name] && Object.keys(storage).length >= STORE_SIZE) { setPrompt('倉庫滿了', 'bad'); return; }
    if (where === 'store' && !inventory[name] && Object.keys(inventory).length >= INV_SIZE) { setPrompt('魚簍滿了', 'bad'); return; }
    netMsg({ type: 'chest', op: where === 'inv' ? 'put' : 'take', name: rec.name, count: rec.count, price: rec.price, color: rec.color, ic: rec.ic });
    /* 由伺服器廣播 world 覆蓋倉庫內容，chestResult 更新魚簍 */
    return;
  }
  const SRC_LIST = { inv: inventory, store: storage, mstore: mineralStore };
  const src = SRC_LIST[where] || inventory;
  const dst = (where === 'inv') ? storage
    : (where === 'minv') ? mineralStore
    : inventory;
  const rec = src[name];
  if (!rec) return;
  const cap = (dst === storage) ? STORE_SIZE
    : (dst === mineralStore) ? MINERAL_STORE_SIZE
    : INV_SIZE;
  if (!dst[name] && Object.keys(dst).length >= cap) {
    setPrompt(dst === storage ? '倉庫滿了' : (dst === mineralStore ? '礦物倉庫滿了' : '魚簍滿了'), 'bad');
    return;
  }
  const d = dst[name] || (dst[name] = {
    name: rec.name, count: 0, price: rec.price, rarity: rec.rarity,
    color: rec.color, ic: rec.ic, maxSize: 0, sat: rec.sat || 0,
    eff: rec.eff || '', durability: rec.durability || 0, use: rec.use || ''
  });
  d.count += rec.count;
  d.maxSize = Math.max(d.maxSize || 0, rec.maxSize || 0);
  if (rec.durability) d.durability = rec.durability;
  if (rec.use) d.use = rec.use;
  delete src[name];
  refreshPanels();
}

function renderDex() {
  let got = 0;
  const rows = time => FISH_TABLE.filter(f => f.time === time).map(f => {
    const d = dex[f.name];
    const col = RARITY[f.rarity].color;
    if (d) {
      got++;
      return '<div class="dexrow">' + fishSVG(col) +
        '<span class="nm">' + f.name + '</span>' +
        '<span class="rt">' + f.rarity + ' · 最大 ' + d.maxSize + ' cm</span></div>';
    }
    return '<div class="dexrow locked">' + fishSVG('#9fb0b8', true) +
      '<span class="nm">？？？</span><span class="rt">' + f.rarity + '</span></div>';
  }).join('');
  document.getElementById('dexDay').innerHTML = rows('day');
  document.getElementById('dexNight').innerHTML = rows('night');

  /* 釣魚加成卡片（只能釣到一次） */
  let cardGot = 0;
  const cardRows = (typeof CARD_TABLE !== 'undefined')
    ? CARD_TABLE.map(c => {
      const caught = (typeof special !== 'undefined' && !!special[c.fx]);
      if (caught) cardGot++;
      if (caught) {
        return '<div class="dexrow">' + iconSVG('card', c.color) +
          '<span class="nm">' + c.name + '</span>' +
          '<span class="rt">' + c.desc + '</span></div>';
      }
      return '<div class="dexrow locked">' + iconSVG('card', '#9fb0b8', true) +
        '<span class="nm">？？？</span><span class="rt">？？？</span></div>';
    }).join('')
    : '';
  const cardsEl = document.getElementById('dexCards');
  if (cardsEl) cardsEl.innerHTML = cardRows;

  document.getElementById('dexFishCount').textContent = got;
  const cardCountEl = document.getElementById('dexCardCount');
  if (cardCountEl) cardCountEl.textContent = cardGot;
}

function renderShop() {
  document.getElementById('shopGold').textContent = gold;
  const shopD = document.getElementById('shopDiamond'); if (shopD) shopD.textContent = diamond;
  const entries = [];
  Object.keys(inventory).forEach(n => {
    /* 礦物與合成物不可出售，只保留可賣物品 */
    if (MAT[n] && MAT[n].noSell) return;
    entries.push({ where: 'inv', rec: inventory[n] });
  });
  entries.sort((a, b) => sellPrice(b.rec) - sellPrice(a.rec));
  let html = '';
  if (!entries.length) html = '<div class="shopempty">魚簍是空的</div>';
  entries.forEach(e => {
    const unit = sellPrice(e.rec);
    html += '<div class="shoprow">' + iconSVG(e.rec.ic, e.rec.color) +
      '<span class="nm">' + e.rec.name +
      (e.rec.count > 1 ? ' ×' + e.rec.count : '') +
      '<i class="tag">' + (e.where === 'inv' ? '魚簍' : '倉庫') + '</i></span>' +
      '<span class="pr">' + unit + ' 金</span>' +
      '<span class="qtywrap">' +
        '<button class="qminus" data-q="' + e.where + '|' + e.rec.name + '">-</button>' +
        '<input class="qinput" data-q="' + e.where + '|' + e.rec.name + '" type="number" min="1" max="' + e.rec.count + '" value="1">' +
        '<button class="qplus" data-q="' + e.where + '|' + e.rec.name + '">+</button>' +
        '<button class="qall" data-q="' + e.where + '|' + e.rec.name + '">全部</button>' +
      '</span>' +
      '<button data-sell="' + e.where + '|' + e.rec.name + '">賣</button></div>';
  });
  const sellEl = document.getElementById('shopSell');
  sellEl.innerHTML = html;
  sellEl.querySelectorAll('button[data-sell]').forEach(btn => {
    btn.onclick = () => {
      const parts = btn.dataset.sell.split('|');
      const inp = sellEl.querySelector('input[data-q="' + parts[0] + '|' + parts[1] + '"]');
      const q = inp ? parseInt(inp.value, 10) || 1 : 1;
      sellStack(parts[0], parts[1], q);
    };
  });
  /* 全部：直接把數量設為目前現有的最大數量 */
  sellEl.querySelectorAll('button.qall').forEach(btn => {
    btn.onclick = () => {
      const parts = btn.dataset.q.split('|');
      const inp = sellEl.querySelector('input[data-q="' + parts[0] + '|' + parts[1] + '"]');
      if (inp) inp.value = inp.max;
    };
  });
  /* 數量 +/- 與長按快速累加 */
  sellEl.querySelectorAll('button.qminus').forEach(btn => {
    btn.onclick = () => {
      const parts = btn.dataset.q.split('|');
      const inp = sellEl.querySelector('input[data-q="' + parts[0] + '|' + parts[1] + '"]');
      if (inp) inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) - 1);
    };
  });
  sellEl.querySelectorAll('button.qplus').forEach(btn => {
    let timer = null;
    const step = () => {
      const parts = btn.dataset.q.split('|');
      const inp = sellEl.querySelector('input[data-q="' + parts[0] + '|' + parts[1] + '"]');
      if (inp) {
        const max = parseInt(inp.max, 10) || 999;
        inp.value = Math.min(max, (parseInt(inp.value, 10) || 1) + 1);
      }
    };
    btn.onclick = step;
    btn.onmousedown = () => { timer = setInterval(step, 120); };
    btn.onmouseup = btn.onmouseleave = () => { if (timer) { clearInterval(timer); timer = null; } };
  });

  document.getElementById('shopBuy').innerHTML =
    '<div class="shoprow"><span class="nm">鎬子 ×1</span><span class="pr">5 💎</span>' +
    '<button id="buyPickaxe">買</button></div>' +
    '<div class="shoprow"><span class="nm">夜晚降臨藥 ×1</span><span class="pr">5 💎</span>' +
    '<button id="buyNightfall">買</button></div>' +
    '<div class="shoprow"><span class="nm">流浪商人召喚符 ×1</span><span class="pr">1000 金</span>' +
    '<button id="buySummonRune">買</button></div>' +
    '<div class="shoprow"><span class="nm">釣魚釣到鑽石超級加成書 ×1</span><span class="pr">3000 金</span>' +
    '<button id="buySuperDiaBook">買</button></div>' +
    '<div class="shoprow"><span class="nm">貝殼菇菇採集加成書 ×1</span><span class="pr">500 金</span>' +
    '<button id="buyGatherBook">買</button></div>' +
    '<div class="dexsec">料理換鑽石（任選一道 ×1 → 💎 1）</div>' +
    dishTradeRowHTML('船長燉鍋', '#a85b2a') +
    dishTradeRowHTML('島嶼拼盤', '#c08a3a') +
    dishTradeRowHTML('沙茶螃蟹', '#b0503a');
  const bp = document.getElementById('buyPickaxe');
  if (bp) bp.onclick = buyPickaxe;
  if (bp) { bp.disabled = diamond < 5; bp.style.opacity = diamond < 5 ? 0.5 : 1; }
  const nf = document.getElementById('buyNightfall');
  if (nf) nf.onclick = buyNightfall;
  if (nf) { nf.disabled = diamond < 5; nf.style.opacity = diamond < 5 ? 0.5 : 1; }
  const sr = document.getElementById('buySummonRune');
  if (sr) sr.onclick = buySummonRune;
  if (sr) { sr.disabled = gold < 1000; sr.style.opacity = gold < 1000 ? 0.5 : 1; }
  const sd = document.getElementById('buySuperDiaBook');
  if (sd) sd.onclick = buySuperDiaBook;
  if (sd) { sd.disabled = gold < 3000; sd.style.opacity = gold < 3000 ? 0.5 : 1; }
  const bk = document.getElementById('buyGatherBook');
  if (bk) bk.onclick = buyGatherBook;
  if (bk) { bk.disabled = gold < 500; bk.style.opacity = gold < 500 ? 0.5 : 1; }
  const buyEl = document.getElementById('shopBuy');
  buyEl.querySelectorAll('button.dishTrade').forEach(btn => {
    btn.onclick = () => redeemDishForDiamond(btn.dataset.dish);
  });
}

function sellStack(where, name, qty) {
  const bag = where === 'inv' ? inventory : storage;
  const rec = bag[name];
  if (!rec) return;
  const n = Math.max(1, Math.min(rec.count, (qty || rec.count)));
  gold += sellPrice(rec) * n;
  rec.count -= n;
  if (rec.count <= 0) delete bag[name];
  sndCatch();
  fish.flash = 1.8;
  setPrompt('交易成功！賣出 ' + name + ' ×' + n + '，獲得 ' + (sellPrice(rec) * n) + ' 金', 'good');
  refreshPanels();
  if (rec.rarity) questDone('sell');
}


function buyPickaxe() {
  if (diamond < 5) { setPrompt('鑽石不足（需要 5 顆）', 'bad'); return; }
  diamond -= 5;
  const m = MAT['使用中鎬子'];
  const inUse = inventory['使用中鎬子'];
  const hasActive = inUse && (inUse.durability || 0) > 0;
  if (!hasActive) {
    bagAdd(inventory, { name: '使用中鎬子', price: 0, ic: m.ic, color: m.color }, 0);
    if (inventory['使用中鎬子']) inventory['使用中鎬子'].durability = 30;
    setPrompt('買到 使用中鎬子 ×1（耐久 30）', 'good');
  } else {
    bagAdd(inventory, { name: '鎬子', price: 0, ic: m.ic, color: m.color }, 0);
    if (inventory['鎬子']) inventory['鎬子'].durability = 30;
    setPrompt('買到 鎬子 ×1（備用）', 'good');
  }
  updateDiamondHud();
  sndCatch();
  refreshPanels();
}
function buyNightfall() {
  if (diamond < 5) { setPrompt('鑽石不足（需要 5 顆）', 'bad'); return; }
  diamond -= 5;
  const m = MAT['夜晚降臨藥'];
  bagAdd(inventory, { name: '夜晚降臨藥', price: 0, ic: m.ic, color: m.color, use: m.use }, 0);
  updateDiamondHud();
  sndCatch();
  setPrompt('買到 夜晚降臨藥 ×1', 'good');
  refreshPanels();
}

/* 料理換鑽石：三道菜任選一道 ×1 換 1 顆鑽石（可從魚簍或倉庫兌換） */
const DIAMOND_DISHES = ['船長燉鍋', '島嶼拼盤', '沙茶螃蟹'];
function dishTradeRowHTML(name, color) {
  const count = bagCount(name);
  const ok = count > 0;
  return '<div class="shoprow">' + iconSVG('dish', color) +
    '<span class="nm">' + name + '<i class="tag">×' + count + '</i></span>' +
    '<span class="pr">💎 1</span>' +
    '<button class="dishTrade" data-dish="' + name + '"' + (ok ? '' : ' disabled') + '>換</button></div>';
}
function redeemDishForDiamond(name) {
  if (DIAMOND_DISHES.indexOf(name) < 0) return;
  if (bagCount(name) < 1) { setPrompt('沒有 ' + name, 'bad'); return; }
  takeItem(name, 1);
  diamond++;
  updateDiamondHud();
  setPrompt('用 ' + name + ' 換到 💎 鑽石 ×1', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}
function updateHudCounters() {
  const g = document.getElementById('hudGold'); if (g) g.textContent = gold;
  const d = document.getElementById('hudDiamond'); if (d) d.textContent = diamond;
}
function updateDiamondHud() {
  const invD = document.getElementById('invDiamond'); if (invD) invD.textContent = diamond;
  const shopD = document.getElementById('shopDiamond'); if (shopD) shopD.textContent = diamond;
  const chestD = document.getElementById('chestDiamond'); if (chestD) chestD.textContent = diamond;
}

/* 夜晚降臨藥：使用後遊戲時間直接跳到夜晚，之後時間正常流逝 */
function useNightfall() {
  const rec = inventory['夜晚降臨藥'];
  if (!rec) return;
  if (isDark()) { setPrompt('天已經黑了，不用喝夜晚降臨藥', 'bad'); return; }
  rec.count--;
  if (rec.count <= 0) delete inventory['夜晚降臨藥'];
  dayT = PHASES[5].start;
  applyLight(dayT);
  updateDial();
  setPrompt('夜晚降臨了…', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

/* 貝殼菇菇採集加成書：發光貝殼、夜光菇採集 +1（1 天） */
function useGatherBook() {
  const rec = inventory['貝殼菇菇採集加成書'];
  if (!rec) return;
  rec.count--;
  if (rec.count <= 0) delete inventory['貝殼菇菇採集加成書'];
  applyEffect('貝殼菇菇採集加成');
  setPrompt('翻開《貝殼菇菇採集加成書》，貝殼與夜光菇產量加倍！', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

/* 神秘書本：純展示劇情，與夜晚降臨藥一樣可存入倉庫 */
function openMysteryBook() {
  const el = document.getElementById('panel-mysterybook');
  if (!el) return;
  closePanels();
  el.classList.add('on');
}
function closeMysteryBook() {
  const el = document.getElementById('panel-mysterybook');
  if (el) el.classList.remove('on');
}
(function wireMysteryBook() {
  const btn = document.getElementById('mysterybookClose');
  if (btn) btn.addEventListener('click', closeMysteryBook);
})();

/* 鑽石50兌換卡：點擊使用，立即獲得 50 顆鑽石 */
function useDiamond50() {
  const rec = inventory['鑽石50兌換卡'];
  if (!rec) return;
  rec.count--;
  if (rec.count <= 0) delete inventory['鑽石50兌換卡'];
  diamond += 50;
  updateDiamondHud();
  updateHudCounters();
  setPrompt('使用 鑽石50兌換卡，獲得 💎 鑽石 ×50！', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

function buyGatherBook() {
  if (gold < 500) { setPrompt('金幣不足（需要 500 金）', 'bad'); return; }
  gold -= 500;
  const m = MAT['貝殼菇菇採集加成書'];
  bagAdd(inventory, { name: '貝殼菇菇採集加成書', price: m.price, ic: m.ic, color: m.color, use: m.use }, 0);
  setPrompt('買到 貝殼菇菇採集加成書 ×1', 'good');
  updateHudCounters();
  sndCatch();
  refreshPanels();
}
function buySummonRune() {
  if (gold < 1000) { setPrompt('金幣不足（需要 1000 金）', 'bad'); return; }
  gold -= 1000;
  const m = MAT['流浪商人召喚符'];
  bagAdd(inventory, { name: '流浪商人召喚符', price: m.price, ic: m.ic, color: m.color, use: m.use }, 0);
  setPrompt('買到 流浪商人召喚符 ×1', 'good');
  updateHudCounters();
  sndCatch();
  refreshPanels();
}
function buySuperDiaBook() {
  if (gold < 3000) { setPrompt('金幣不足（需要 3000 金）', 'bad'); return; }
  gold -= 3000;
  const m = MAT['釣魚釣到鑽石超級加成書'];
  bagAdd(inventory, { name: '釣魚釣到鑽石超級加成書', price: m.price, ic: m.ic, color: m.color, use: m.use }, 0);
  setPrompt('買到 釣魚釣到鑽石超級加成書 ×1', 'good');
  updateHudCounters();
  sndCatch();
  refreshPanels();
}
function useSuperDiaBook() {
  const rec = inventory['釣魚釣到鑽石超級加成書'];
  if (!rec) return;
  rec.count--;
  if (rec.count <= 0) delete inventory['釣魚釣到鑽石超級加成書'];
  applyEffect('釣魚釣到鑽石超級加成');
  setPrompt('翻開《釣魚釣到鑽石超級加成書》，釣魚鑽石機率變為 25%！', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}
function updateBaitHud() {
  const el = document.getElementById('bait');
  if (el) el.textContent = bait;
}

function closePanels() {
  elsInv.classList.remove('on');
  elsDex.classList.remove('on');
  elsShop.classList.remove('on');
  elsCook.classList.remove('on');
  elsChest.classList.remove('on');
  if (elsMineral) elsMineral.classList.remove('on');
  const pSynth = document.getElementById('panel-synth');
  const pExch = document.getElementById('panel-exchange');
  const pBook = document.getElementById('panel-mysterybook');
  if (pSynth) pSynth.classList.remove('on');
  if (pExch) pExch.classList.remove('on');
  if (pBook) pBook.classList.remove('on');
}
function anyPanel() {
  const synth = document.getElementById('panel-synth');
  const exch = document.getElementById('panel-exchange');
  const book = document.getElementById('panel-mysterybook');
  return elsInv.classList.contains('on') || elsDex.classList.contains('on') ||
    elsShop.classList.contains('on') || elsCook.classList.contains('on') ||
    elsChest.classList.contains('on') ||
    (elsMineral && elsMineral.classList.contains('on')) ||
    (synth && synth.classList.contains('on')) ||
    (exch && exch.classList.contains('on')) ||
    (book && book.classList.contains('on'));
}
function toggleInv() {
  const on = elsInv.classList.contains('on');
  closePanels();
  if (!on) { renderInv(); elsInv.classList.add('on'); }
}
function renderChest() {
  const invNames = Object.keys(inventory).sort((a, b) => sellPrice(inventory[b]) - sellPrice(inventory[a]));
  const storeNames = Object.keys(storage).sort((a, b) => sellPrice(storage[b]) - sellPrice(storage[a]));
  document.getElementById('chestInvCount').textContent = invNames.length + '/' + INV_SIZE;
  document.getElementById('chestStoreCount').textContent = storeNames.length + '/' + STORE_SIZE;
  document.getElementById('chestGold').textContent = gold;
  const chestD = document.getElementById('chestDiamond'); if (chestD) chestD.textContent = diamond;
  let h1 = '', h2 = '';
  for (let i = 0; i < INV_SIZE; i++) h1 += slotHTML(inventory[invNames[i]], 'inv');
  for (let i = 0; i < STORE_SIZE; i++) h2 += slotHTML(storage[storeNames[i]], 'store');
  const g1 = document.getElementById('chestInvGrid');
  const g2 = document.getElementById('chestStoreGrid');
  g1.innerHTML = h1;
  g2.innerHTML = h2;
  g1.querySelectorAll('.slot[data-move]').forEach(el => {
    el.onclick = () => { moveStack('inv', el.dataset.name); };
  });
  g2.querySelectorAll('.slot[data-move]').forEach(el => { el.onclick = () => moveStack('store', el.dataset.name); });
}
function toggleChest() {
  const on = elsChest.classList.contains('on');
  closePanels();
  if (!on) { renderChest(); elsChest.classList.add('on'); }
}
function renderMineral() {
  const invNames = Object.keys(inventory).sort((a, b) => sellPrice(inventory[b]) - sellPrice(inventory[a]));
  const storeNames = Object.keys(mineralStore).sort((a, b) => sellPrice(mineralStore[b]) - sellPrice(mineralStore[a]));
  document.getElementById('mineralInvCount').textContent = invNames.length + '/' + INV_SIZE;
  document.getElementById('mineralStoreCount').textContent = storeNames.length + '/' + MINERAL_STORE_SIZE;
  document.getElementById('mineralGold').textContent = gold;
  const mineralD = document.getElementById('mineralDiamond'); if (mineralD) mineralD.textContent = diamond;
  let h1 = '', h2 = '';
  for (let i = 0; i < INV_SIZE; i++) h1 += slotHTML(inventory[invNames[i]], 'minv');
  for (let i = 0; i < MINERAL_STORE_SIZE; i++) h2 += slotHTML(mineralStore[storeNames[i]], 'mstore');
  const g1 = document.getElementById('mineralInvGrid');
  const g2 = document.getElementById('mineralStoreGrid');
  g1.innerHTML = h1;
  g2.innerHTML = h2;
  g1.querySelectorAll('.slot[data-move]').forEach(el => {
    el.onclick = () => { moveStack('minv', el.dataset.name); };
  });
  g2.querySelectorAll('.slot[data-move]').forEach(el => { el.onclick = () => moveStack('mstore', el.dataset.name); });
}
function toggleMineral() {
  const on = elsMineral.classList.contains('on');
  closePanels();
  if (!on) { renderMineral(); elsMineral.classList.add('on'); }
}
function toggleDex() {
  const on = elsDex.classList.contains('on');
  closePanels();
  if (!on) { renderDex(); elsDex.classList.add('on'); }
}
function toggleShop() {
  const on = elsShop.classList.contains('on');
  closePanels();
  if (!on) { renderShop(); elsShop.classList.add('on'); }
}
function toggleCook() {
  const on = elsCook.classList.contains('on');
  closePanels();
  if (!on) { renderCook(); elsCook.classList.add('on'); }
}


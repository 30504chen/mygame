/* quests.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   核心任務（3 個）
   ============================================================ */
const QUESTS = [
  { id: 'cast', txt: '拋出一竿' },
  { id: 'sell', txt: '賣出一條魚' },
  { id: 'cook', txt: '煮一道菜' }
];
const quests = { cast: false, sell: false, cook: false };

function questDone(id) {
  if (quests[id]) return;
  quests[id] = true;
  renderQuests();
  if (QUESTS.every(q => quests[q.id])) setPrompt('核心任務全部完成！', 'good');
  if (typeof saveGame === 'function') saveGame();
}

function renderQuests() {
  const box = document.getElementById('questList');
  if (!box) return;
  box.innerHTML = QUESTS.map(q =>
    '<div class="qrow' + (quests[q.id] ? ' done' : '') + '"><i>' +
    (quests[q.id] ? '✓' : '○') + '</i><span>' + q.txt + '</span></div>'
  ).join('');
  const all = QUESTS.every(q => quests[q.id]);
  const el = document.getElementById('quests');
  if (el) {
    el.classList.toggle('all', all);
    el.style.display = all ? 'none' : '';
  }
  const tip = document.getElementById('questTip');
  if (tip) tip.textContent = all ? '三個都完成了' : '';
}

renderQuests();

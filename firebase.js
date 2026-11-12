// Death Line — Firebase 全球排行榜
// 使用 Firebase 13 modular SDK（CDN）
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMbP0oEgRHzZRU_T7OSMbPcaPqJHMTDTU",
  authDomain: "mygame-5c409.firebaseapp.com",
  projectId: "mygame-5c409",
  storageBucket: "mygame-5c409.firebasestorage.app",
  messagingSenderId: "320620424281",
  appId: "1:320620424281:web:0fb7f8191cb337f8e5d548"
};

const COLLECTION = "scores";
const TOP_LIMIT = 50;

let db = null;
let initError = "";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  initError = String(e && e.message ? e.message : e);
}

const cmpEntry = (a, b) => (b.score - a.score) || (a.time - b.time) || (a.deaths - b.deaths);

function normalize(id, v) {
  return {
    name: String(v.name || id || "無名騎士").slice(0, 8),
    score: Number(v.score) || 0,
    coins: Number(v.coins) || 0,
    time: Number(v.time) || 0,
    deaths: Number(v.deaths) || 0,
    ts: v.ts && typeof v.ts.toMillis === "function" ? v.ts.toMillis() : (Number(v.ts) || 0)
  };
}

async function loadTop() {
  if (!db) throw new Error(initError || "Firebase 未初始化");
  const q = query(collection(db, COLLECTION), orderBy("score", "desc"), limit(TOP_LIMIT));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => normalize(d.id, d.data()));
  list.sort(cmpEntry);
  return list.slice(0, 10);
}

async function loadBest() {
  if (!db) throw new Error(initError || "Firebase 未初始化");
  const base = collection(db, COLLECTION);
  const [scoreSnap, coinsSnap, timeSnap, deathsSnap] = await Promise.all([
    getDocs(query(base, orderBy("score", "desc"), limit(1))),
    getDocs(query(base, orderBy("coins", "desc"), limit(1))),
    getDocs(query(base, orderBy("time", "asc"), limit(1))),
    getDocs(query(base, orderBy("deaths", "asc"), limit(1)))
  ]);
  if (scoreSnap.empty) return null;
  const first = (s) => s.empty ? null : s.docs[0].data();
  const s = first(scoreSnap);
  const c = first(coinsSnap);
  const t = first(timeSnap);
  const d = first(deathsSnap);
  return {
    score: s ? Number(s.score) || 0 : 0,
    coins: c ? Number(c.coins) || 0 : 0,
    time: t ? Number(t.time) || 0 : 0,
    deaths: d ? Number(d.deaths) || 0 : 0
  };
}

async function submit(entry) {
  if (!db) throw new Error(initError || "Firebase 未初始化");
  const e = {
    name: String(entry.name || "無名騎士").slice(0, 8),
    score: Math.max(0, Math.min(7000, Math.round(Number(entry.score) || 0))),
    coins: Math.max(0, Math.min(60, Math.round(Number(entry.coins) || 0))),
    time: Math.max(0.1, Math.min(7200, Number(entry.time) || 0.1)),
    deaths: Math.max(0, Math.min(100000, Math.round(Number(entry.deaths) || 0)))
  };
  const ref = doc(db, COLLECTION, "n_" + encodeURIComponent(e.name));

  return await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const old = snap.data() || {};
      const oldScore = Number(old.score) || 0;
      const oldTime = Number(old.time) || 0;
      const oldDeaths = Number(old.deaths) || 0;
      const better = e.score > oldScore ||
        (e.score === oldScore && (e.time < oldTime || (e.time === oldTime && e.deaths < oldDeaths)));
      if (!better) return false;
    }
    tx.set(ref, {
      name: e.name,
      score: e.score,
      coins: e.coins,
      time: e.time,
      deaths: e.deaths,
      ts: serverTimestamp()
    });
    return true;
  });
}

window.DLRemote = {
  isReady: () => !!db,
  initError,
  loadTop,
  loadBest,
  submit
};

if (typeof window.__resolveDLRemote === "function") {
  window.__resolveDLRemote(window.DLRemote);
}

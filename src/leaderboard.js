// Real-player weekly leaderboard.
// - Inside claude.ai: stored in the artifact's shared database (each player writes only their own row).
// - On the hosted website: stored in a Supabase table, if src/config.js is filled in.
import { SUPABASE } from './config.js';
import { weekKey } from './util.js';

export function createLeaderboard(G) {
  const lb = { mode: 'none', status: 'Connecting...', rows: [], myId: null, lastSent: 0, lastSig: '', listeners: [] };
  const notify = () => lb.listeners.forEach(f => { try { f(); } catch (e) { } });
  lb.onChange = (f) => lb.listeners.push(f);

  const myRow = () => {
    const s = G.s;
    return { name: String(s.name || 'Goblin Town').slice(0, 24), score: Math.floor(s.weekGold || 0), lifetime: Math.floor(s.lifetimeGold || 0), level: s.level || 1, week: weekKey(G.now()), updated: G.now() };
  };

  // ---------- claude.ai artifact database
  let col = null;
  async function connectClaude() {
    for (let i = 0; i < 30 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 100));
    if (!window.claude || !window.claude.use) return false;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return false;
    const id = await user.id();
    if (!id) return false;
    lb.mode = 'claude'; lb.myId = id;
    col = db.collection('leaderboard');
    lb.status = 'Loading players...'; notify();
    let timer = setTimeout(() => { lb.status = 'The leaderboard is taking a while to load.'; notify(); }, 10000);
    col.onSnapshot((snap) => {
      clearTimeout(timer);
      const wk = weekKey(G.now());
      lb.rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.week === wk && typeof r.score === 'number');
      lb.status = 'ok'; notify();
    }, () => { clearTimeout(timer); lb.status = 'The leaderboard is unavailable right now.'; notify(); });
    return true;
  }
  async function sendClaude(row) {
    try { await col.doc(lb.myId).set(row); } catch (e) { if (e && e.code !== 'unavailable') lb.writeError = true; }
  }

  // ---------- Supabase (hosted website)
  const sbHeaders = () => ({ apikey: SUPABASE.key, Authorization: 'Bearer ' + SUPABASE.key, 'Content-Type': 'application/json' });
  async function connectSupabase() {
    if (!SUPABASE.url || !SUPABASE.key) { lb.mode = 'none'; lb.status = 'unconfigured'; notify(); return false; }
    lb.mode = 'supabase';
    if (!G.s.playerId) { G.s.playerId = (crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36)); G.save(); }
    lb.myId = G.s.playerId;
    await refreshSupabase();
    setInterval(refreshSupabase, 60000);
    return true;
  }
  async function refreshSupabase() {
    try {
      const wk = weekKey(G.now());
      const r = await fetch(`${SUPABASE.url}/rest/v1/leaderboard?week=eq.${wk}&order=score.desc&limit=100`, { headers: sbHeaders() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lb.rows = (await r.json()).map(x => ({ id: x.id, name: x.name, score: x.score, lifetime: x.lifetime, level: x.level, week: x.week }));
      lb.status = 'ok';
    } catch (e) { lb.status = navigator.onLine === false ? 'You’re offline. The leaderboard will update when you reconnect.' : 'The leaderboard is unavailable right now.'; }
    notify();
  }
  async function sendSupabase(row) {
    try {
      await fetch(`${SUPABASE.url}/rest/v1/leaderboard?on_conflict=id`, { method: 'POST', headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: lb.myId, ...row }) });
    } catch (e) { /* retried on the next push */ }
  }

  lb.connect = async () => {
    try { if (await connectClaude()) { lb.push(true); return; } } catch (e) { }
    try { if (await connectSupabase()) lb.push(true); } catch (e) { lb.status = 'The leaderboard is unavailable right now.'; notify(); }
  };
  // send my score at most once a minute, and only when it changed
  lb.push = (force) => {
    if (lb.mode === 'none' || !lb.myId) return;
    const row = myRow();
    const sig = row.name + '|' + row.week + '|' + Math.floor(Math.log10(row.score + 1) * 50) + '|' + row.level;
    const now = Date.now();
    if (!force && (sig === lb.lastSig || now - lb.lastSent < 60000)) return;
    lb.lastSig = sig; lb.lastSent = now;
    if (lb.mode === 'claude') sendClaude(row); else sendSupabase(row).then(refreshSupabase);
  };
  lb.board = () => {
    const me = myRow();
    const rows = lb.rows.filter(r => r.id !== lb.myId).map(r => ({ ...r, me: false }));
    rows.push({ id: lb.myId, ...me, me: true });
    return rows.sort((a, b) => b.score - a.score);
  };
  return lb;
}

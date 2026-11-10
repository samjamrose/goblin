// Cloud save: when the game runs inside claude.ai, keep a private copy of the save
// in the artifact's database (per signed-in player), so progress survives updates,
// app restarts and devices. Falls back silently to browser storage elsewhere.

const DOC = 'save';

export function createCloud(G, onRemoteNewer) {
  const cloud = { ready: false, ref: null, lastSent: 0, sending: false, dirty: false, status: 'off' };

  // a rough "how far along" score, used when two different games compete
  const progress = (s) => (s ? (s.lifetimeGold || 0) + (s.teethEarned || 0) * 1e12 + (s.level || 0) : 0);

  async function connect(keepLocal = false) {
    if (typeof window === 'undefined') return;
    for (let i = 0; i < 30 && !(window.claude && typeof window.claude.use === 'function'); i++) await new Promise(r => setTimeout(r, 100));
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      cloud.ref = db.doc('data/users/' + uid + '/' + DOC);
      cloud.status = 'connecting';
      const snap = await withTimeout(cloud.ref.get(), 10000);
      cloud.ready = true;
      cloud.status = 'on';
      const remote = snap && snap.exists ? parse(snap.data()) : null;
      const local = G.s;
      if (remote && !keepLocal) {
        const sameGame = remote.created === local.created;
        const remoteBetter = sameGame ? (remote.lastSave || 0) > (local.lastSave || 0) + 2000
          : progress(remote) > progress(local) || !local.tut?.intro;
        if (remoteBetter) { onRemoteNewer(remote); return; }
      }
      push(true);
    } catch (e) {
      cloud.status = 'error';
      console.warn('cloud save unavailable', e && (e.code || e.message));
    }
  }

  function parse(body) {
    try { const s = JSON.parse(body.json); return s && s.v === 1 && s.buildings ? s : null; } catch (e) { return null; }
  }

  // write at most every 20 s, one write at a time, only when something changed
  async function push(force) {
    if (!cloud.ready || !cloud.ref) return;
    if (cloud.sending) { cloud.dirty = true; return; }
    const now = Date.now();
    if (!force && now - cloud.lastSent < 20000) { cloud.dirty = true; return; }
    cloud.sending = true; cloud.dirty = false; cloud.lastSent = now;
    try {
      const json = JSON.stringify(G.s);
      if (json.length < 250000) await cloud.ref.set({ json, savedAt: G.s.lastSave || now, name: String(G.s.name || '').slice(0, 40), level: G.s.level || 1 });
      cloud.status = 'on';
    } catch (e) {
      cloud.status = 'error';
      if (e && e.code === 'unavailable') setTimeout(() => push(true), 3000 + Math.random() * 3000);
    } finally {
      cloud.sending = false;
      if (cloud.dirty) setTimeout(() => push(false), 20000);
    }
  }

  cloud.connect = connect;
  cloud.push = push;
  return cloud;
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);
}

// Dark Logic Studios — The Void web v9.13.0: open overworld for Frostreach and Inferno.
// The ring arena is gone for these two realms. Each realm is a walled valley (about 156 x 208 m) with paths,
// a river with two bridges, a ridge with one pass, forests, cliffs and a sealed boss lair. The run order is
// unchanged: Arena I, Arena II, the god essence crate (and the second crate), the God-Merge shrine, the realm
// boss. Each one is a place you walk to; an encounter starts when you step into its clearing.
// Floating origin: the realm group P is shifted so the current location sits at the scene origin, so the
// original centre-based spawns, crate, shrine, boss and cutscene cameras all keep working unchanged.
// The boss lair is the original arena (floor, rim, eight pillars) at the map origin; its radius-19 clamp
// only runs while the boss is up. The Void Draw keeps its classic arena. `?arena=1` restores the old ring.
// Bundle hooks: tools/patch_world.py. No story, dialogue or lore text lives here.
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const OFF = Q.get('arena') === '1';
  const T3 = () => window.TV3, FX = () => window.TVfx, TV = () => window.TV;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ layout (map metres: x east, z south)
  const LOC_LABEL = { arena1: 'Arena I', arena2: 'Arena II', crate1: 'God essence crate', crate2: 'Second crate', shrine: 'God-Merge shrine', lair: 'Realm boss' };
  const BASE = {
    bounds: { x0: -78, x1: 78, z0: -40, z1: 168 },
    locs: {
      gate: { x: 0, z: 146, r: 0, clear: 9 },
      arena1: { x: -38, z: 120, r: 14, clear: 18 },
      arena2: { x: 34, z: 72, r: 14, clear: 18 },
      crate1: { x: -50, z: 58, r: 8, clear: 11 },
      crate2: { x: 54, z: 6, r: 8, clear: 11 },
      shrine: { x: -52, z: 2, r: 10, clear: 14 },
      lair: { x: 0, z: 0, r: 13, clear: 0 },
    },
    approach: { x: 0, z: 36 },
    river: { pts: [[-84, 104], [-40, 98], [0, 103], [40, 97], [84, 101]], hw: 4.5, bridges: [-58, 58] },
    ridge: [[[-82, 42], [-40, 38], [-9, 40]], [[9, 40], [40, 43], [82, 39]]], ridgeR: 3,
    lair: { r0: 23, r1: 28, gate: 0.2 },
    paths: [
      [[0, 146], [-14, 136], [-38, 120]],
      [[-38, 120], [-50, 113], [-58, 110], [-58, 101], [-58, 90], [-30, 84], [0, 80], [34, 72]],
      [[34, 72], [52, 84], [58, 90], [58, 99], [58, 108], [52, 116], [30, 126], [10, 138], [0, 146]],
      [[34, 72], [0, 66], [-28, 62], [-50, 58]],
      [[-50, 58], [-30, 50], [0, 45], [0, 34]],
      [[0, 34], [30, 32], [50, 20], [54, 6]],
      [[0, 34], [-30, 32], [-48, 18], [-52, 2]],
      [[54, 6], [52, -22], [24, -33], [-24, -33], [-52, -22], [-52, 2]],
    ],
    lairPath: [[0, 34], [0, 12]],
  };
  function mirror(L) {
    const mx = (p) => [-p[0], p[1]];
    const o = JSON.parse(JSON.stringify(L));
    for (const k in o.locs) o.locs[k].x = -o.locs[k].x;
    o.approach.x = -o.approach.x;
    o.river.pts = o.river.pts.map(mx).reverse();
    o.river.bridges = o.river.bridges.map((x) => -x);
    o.ridge = o.ridge.map((pl) => pl.map(mx).reverse()).reverse();
    o.paths = o.paths.map((pl) => pl.map(mx));
    o.lairPath = o.lairPath.map(mx);
    return o;
  }
  const LAYOUT = { frost: BASE, inferno: mirror(BASE) };

  // ------------------------------------------------------------------ state
  const S = {
    on: false, realm: null, P: null, F: [], lay: null, token: 0, sealed: true, target: null, done: new Set(),
    circles: [], grid: new Map(), caps: [], far: [], beacon: null, seal: null, sky: null, pulse: [], mapBg: null, ui: null, graph: null,
  };
  const heroMap = () => { const h = FX() && FX().hero(); if (!h || !S.P) return null; return { x: h.root.position.x - S.P.position.x, z: h.root.position.z - S.P.position.z }; };

  // seeded RNG (layout is identical every run)
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rr = (a, b) => a + rnd() * (b - a);

  // ------------------------------------------------------------------ geometry helpers
  function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
    const cx = ax + dx * t, cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), cx, cz };
  }
  function polyDist(px, pz, pl) { let m = 1e9; for (let i = 0; i < pl.length - 1; i++) m = Math.min(m, segDist(px, pz, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1]).d); return m; }
  function riverZ(x) {
    const p = S.lay.river.pts; const asc = p[0][0] < p[p.length - 1][0];
    const q = asc ? p : p.slice().reverse();
    if (x <= q[0][0]) return q[0][1];
    for (let i = 0; i < q.length - 1; i++) if (x <= q[i + 1][0]) { const t = (x - q[i][0]) / (q[i + 1][0] - q[i][0]); return q[i][1] + (q[i + 1][1] - q[i][1]) * t; }
    return q[q.length - 1][1];
  }
  function addCircle(x, z, r) { const c = { x, z, r }; S.circles.push(c); const gx0 = Math.floor((x - r) / 8), gx1 = Math.floor((x + r) / 8), gz0 = Math.floor((z - r) / 8), gz1 = Math.floor((z + r) / 8); for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const k = gx + ',' + gz; let a = S.grid.get(k); if (!a) S.grid.set(k, (a = [])); a.push(c); } }

  // ------------------------------------------------------------------ collision (map space)
  const tmp = { x: 0, z: 0 };
  function core(p, t, proj) {
    const L = S.lay, b = L.bounds; let hit = false;
    const x0 = p.x, z0 = p.z;
    p.x = clamp(p.x, b.x0 + t, b.x1 - t); p.z = clamp(p.z, b.z0 + t, b.z1 - t);
    if (!proj) { // river (bridges let you across; projectiles fly over water)
      const zc = riverZ(p.x), band = L.river.hw + t, dz = p.z - zc;
      if (Math.abs(dz) < band) {
        let br = null; for (const bx of L.river.bridges) if (Math.abs(p.x - bx) < 3.2 + 1.4) br = bx;
        if (br !== null) p.x = clamp(p.x, br - 3.2 + t, br + 3.2 - t);
        else p.z = zc + (dz >= 0 ? band : -band);
      }
    }
    for (const c of S.caps) { // ridge
      const s = segDist(p.x, p.z, c[0], c[1], c[2], c[3]), m = c[4] + t;
      if (s.d < m) { if (s.d < 1e-4) { p.z += m; } else { p.x = s.cx + (p.x - s.cx) / s.d * m; p.z = s.cz + (p.z - s.cz) / s.d * m; } hit = true; }
    }
    { // boss lair wall (gate gap opens after the shrine)
      const lr = L.lair, d = Math.hypot(p.x, p.z);
      if (d > lr.r0 - t && d < lr.r1 + t) {
        const a = Math.atan2(p.z, p.x), inGate = Math.abs(a - Math.PI / 2) < lr.gate;
        if (!inGate || S.sealed) { const tgt = d < (lr.r0 + lr.r1) / 2 ? lr.r0 - t : lr.r1 + t; const k = tgt / Math.max(d, 1e-4); p.x *= k; p.z *= k; hit = true; }
      }
    }
    const gx = Math.floor(p.x / 8), gz = Math.floor(p.z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = S.grid.get((gx + i) + ',' + (gz + j)); if (!a) continue;
      for (const c of a) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + t; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; hit = true; } }
    }
    for (const c of S.F) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + t; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; hit = true; } }
    return hit || p.x !== x0 || p.z !== z0;
  }
  function collide(e, t) {
    const P = S.P; tmp.x = e.x - P.position.x; tmp.z = e.z - P.position.z;
    const hit = core(tmp, t, false);
    e.x = tmp.x + P.position.x; e.z = tmp.z + P.position.z;
    return hit;
  }
  function projOut(n) {
    const p = n.mesh.position;
    if (!n.__o) n.__o = { x: p.x, z: p.z };
    if (Math.hypot(p.x - n.__o.x, p.z - n.__o.z) > 34) return true;
    tmp.x = p.x - S.P.position.x; tmp.z = p.z - S.P.position.z;
    if (core(tmp, 0.05, true)) { try { T3().E.emit(p, n.trail, 8, 4, 0.3); } catch (_) {} return true; }
    return false;
  }

  // ------------------------------------------------------------------ floating origin
  function recenter(mx, mz) {
    const P = S.P; if (!P) return;
    const dx = mx + P.position.x, dz = mz + P.position.z; // new anchor minus old anchor
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
    const t3 = T3(), fx = FX(), L = TV(), scene = fx.scene, E = t3.E, D = t3.D, M = t3.M;
    const sh = (v) => { if (v) { v.x -= dx; v.z -= dz; } };
    for (const c of scene.children) {
      if (c === E.pts || c === D.pts || c === M || c === S.sky || c.isLight || c.isCamera) continue;
      sh(c.position);
    }
    for (const ps of [E, D]) { const a = ps.pos; if (!a) continue; for (let i = 0; i < a.length; i += 3) { a[i] -= dx; a[i + 2] -= dz; } }
    sh(t3.f.position);
    const B = t3.B(); sh(B.pos); sh(B.look); sh(B.lookTarget);
    sh(t3.R().ground);
    for (const it of L.interactables) sh(it.pos);
    for (const p of L.projectiles) if (p.__o) sh(p.__o);
    for (const t of L.telegraphs) if (t.pos) sh(t.pos);
    const C = window.TVx && TVx.cam; if (C) { if (C.pivot) sh(C.pivot); if (C.last) { C.last.x -= dx; C.last.z -= dz; } }
  }
  function placeHero(mx, mz, ry) {
    const h = FX().hero(); if (!h) return;
    h.root.position.set(mx + S.P.position.x, 0, mz + S.P.position.z);
    h.root.rotation.y = ry; h.facing = ry; h.knock && h.knock.set(0, 0, 0);
    snapCam();
  }
  function snapCam() {
    const h = FX().hero(); if (!h) return; const p = h.root.position, B = T3().B();
    B.pos.set(p.x, p.y + 9.5, p.z + 8.5); B.look.set(p.x, 1, p.z); B.lookTarget && B.lookTarget.copy(B.look);
    if (window.TVx && TVx.camReset) TVx.camReset();
  }

  // ------------------------------------------------------------------ materials / mesh helpers
  const texCache = {};
  function tex(file, rx, rz) {
    const t3 = T3(), k = file + rx + 'x' + rz; if (texCache[k]) return texCache[k];
    const t = new t3.Ro().load('./art/' + file); t.colorSpace = t3.Qt; t.wrapS = t.wrapT = 1000; t.repeat.set(rx, rz); t.anisotropy = 4;
    return (texCache[k] = t);
  }
  const mat = (o) => new (T3().lo)(Object.assign({ roughness: 0.85 }, o));
  function occ(o) { // same occlusion-fade data the bundle's TG() writes (realm-local coords)
    const t3 = T3(); o.updateMatrixWorld(true);
    const b = new t3.Box3().setFromObject(o), c = new t3.W(); b.getCenter(c);
    const rad = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, ms = [];
    o.traverse((x) => { if (!x.isMesh) return; x.castShadow = false; x.material = Array.isArray(x.material) ? x.material.map((q) => q.clone()) : x.material.clone(); (Array.isArray(x.material) ? x.material : [x.material]).forEach((q) => ms.push(q)); });
    o.userData.occ = { x: c.x, z: c.z, top: b.max.y, rad, ms, a: 1, tr: false };
  }
  function glbLandmark(P, key, h, x, z, ry, colR) {
    const t3 = T3(), g = t3.re && t3.re[key]; if (!g) return null;
    const m = t3.clone(g.scene); m.updateMatrixWorld(true);
    const bx = new t3.Box3().setFromObject(m), sz = bx.max.y - bx.min.y || 1, sc = h / sz;
    m.scale.setScalar(sc);
    m.traverse((o) => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = false; (Array.isArray(o.material) ? o.material : [o.material]).forEach((q) => { q.transparent = false; q.opacity = 1; q.depthWrite = true; q.alphaTest = 0; q.fog = true; if (q.emissiveIntensity !== undefined) q.emissiveIntensity = Math.min(q.emissiveIntensity, 0.5); }); });
    const cx = (bx.min.x + bx.max.x) / 2 * sc, cz = (bx.min.z + bx.max.z) / 2 * sc;
    const piv = new t3.or(); m.position.set(-cx, -bx.min.y * sc, -cz); piv.add(m);
    piv.position.set(x, 0, z); piv.rotation.y = ry || 0; P.add(piv); occ(piv); S.far.push({ o: piv, x, z, d: 150 });
    if (colR) addCircle(x, z, colR);
    return piv;
  }
  // GLB instancing (single-mesh scenery GLBs), bucketed into 40 m cells so each bucket frustum-culls
  function glbProto(key) {
    const t3 = T3(), g = t3.re && t3.re[key]; if (!g) return null;
    let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const bx = new t3.Box3().setFromObject(mesh);
    let m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; m = m.clone();
    m.transparent = false; m.opacity = 1; m.depthWrite = true; m.alphaTest = 0; m.fog = true; if (m.emissiveIntensity !== undefined) m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.5);
    return { geo: mesh.geometry, mat: m, base: mesh.matrixWorld.clone(), h: bx.max.y - bx.min.y || 1, minY: bx.min.y, cx: (bx.min.x + bx.max.x) / 2, cz: (bx.min.z + bx.max.z) / 2 };
  }
  function instanceGLB(P, key, list) { // list: [{x,z,h,ry}]
    const t3 = T3(), pr = glbProto(key); if (!pr || !list.length) return;
    const buckets = new Map();
    for (const it of list) { const k = Math.floor(it.x / 40) + ',' + Math.floor(it.z / 40); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
    const M4 = pr.base.constructor, dummy = new t3.O3(), pre = new M4(), tmpM = new M4();
    for (const arr of buckets.values()) {
      const im = new t3.IM(pr.geo, pr.mat, arr.length);
      arr.forEach((it, i) => {
        const s = it.h / pr.h;
        dummy.position.set(it.x, 0, it.z); dummy.rotation.set(0, it.ry || 0, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
        pre.makeTranslation(-pr.cx, -pr.minY, -pr.cz);
        tmpM.multiplyMatrices(dummy.matrix, pre).multiply(pr.base);
        im.setMatrixAt(i, tmpM);
      });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = false;
      im.computeBoundingSphere && im.computeBoundingSphere();
      P.add(im); S.far.push({ o: im, x: arr[0].x, z: arr[0].z, d: 95 });
    }
  }
  function instancePrim(P, geo, material, list, colors) { // list: [{x,y,z,sx,sy,sz,ry,rx,rz}]
    if (!list.length) return null;
    const t3 = T3(), im = new t3.IM(geo, material, list.length), dummy = new t3.O3(), col = new t3.J();
    list.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); dummy.scale.set(it.sx, it.sy, it.sz); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (colors) { col.setHex(colors[Math.floor(rnd() * colors.length)]); im.setColorAt(i, col); }
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere && im.computeBoundingSphere();
    P.add(im); return im;
  }

  // ------------------------------------------------------------------ world build
  function free(x, z, pad) { // true when (x,z) is clear of paths, places, water, walls
    const L = S.lay, b = L.bounds;
    if (x < b.x0 + 2 || x > b.x1 - 2 || z < b.z0 + 2 || z > b.z1 - 2) return false;
    for (const pl of L.paths) if (polyDist(x, z, pl) < 4.2 + pad) return false;
    if (polyDist(x, z, L.lairPath) < 4.2 + pad) return false;
    for (const k in L.locs) { const l = L.locs[k]; if (Math.hypot(x - l.x, z - l.z) < l.clear + 2 + pad) return false; }
    if (Math.abs(z - riverZ(x)) < L.river.hw + 2.5 + pad) return false;
    for (const pl of L.ridge) if (polyDist(x, z, pl) < L.ridgeR + 1.5 + pad) return false;
    if (Math.hypot(x, z) < L.lair.r1 + 3 + pad) return false;
    for (const c of S.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.6 + pad) return false;
    return true;
  }
  function buildWorld(e, P) {
    const t3 = T3(), L = S.lay, b = L.bounds, frost = e === 'frost';
    seed = frost ? 4242 : 9157;
    const accent = FX().realm[e].accent;
    // ---- ground + painted overlay (paths, clearings, banks)
    const GX0 = -100, GX1 = 100, GZ0 = -58, GZ1 = 182, GW = GX1 - GX0, GH = GZ1 - GZ0;
    const gTex = tex(frost ? 'floor_ice_outer.jpg' : 'floor_lava.jpg', GW / 9, GH / 9);
    const gMat = frost ? mat({ map: gTex, color: 0x8fa2b6, roughness: 0.9 }) : mat({ map: gTex, color: 0x4a3832, roughness: 0.95, emissive: 0x2a0c02, emissiveMap: gTex, emissiveIntensity: 0.55 });
    const ground = new t3.X(new t3.eo(GW, GH), gMat); ground.rotation.x = -Math.PI / 2; ground.position.set((GX0 + GX1) / 2, -0.03, (GZ0 + GZ1) / 2); ground.receiveShadow = true; P.add(ground);
    if (!frost) S.pulse.push({ m: gMat, base: 0.55, amp: 0.12 });
    const cw = 640, ch = Math.round(cw * GH / GW), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d'), X = (x) => (x - GX0) / GW * cw, Z = (z) => (z - GZ0) / GH * ch, M = cw / GW;
    const stroke = (pl, w, col, blur) => { g.save(); g.strokeStyle = col; g.lineWidth = w * M; g.lineCap = g.lineJoin = 'round'; if (blur) { g.shadowColor = col; g.shadowBlur = blur; } g.beginPath(); pl.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.stroke(); g.restore(); };
    const blob = (x, z, r, col) => { const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * M); gr.addColorStop(0, col); gr.addColorStop(0.7, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X(x), Z(z), r * M, 0, TAU); g.fill(); };
    // darken along walls (ambient occlusion feel)
    g.save(); g.strokeStyle = frost ? 'rgba(10,20,34,.55)' : 'rgba(8,3,2,.6)'; g.lineWidth = 9 * M; g.shadowColor = g.strokeStyle; g.shadowBlur = 18;
    g.strokeRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * M, (b.z1 - b.z0) * M); g.restore();
    for (const pl of L.ridge) stroke(pl, 10, frost ? 'rgba(10,20,34,.45)' : 'rgba(8,3,2,.55)', 10);
    // river banks
    stroke(L.river.pts, L.river.hw * 2 + 5, frost ? 'rgba(200,228,250,.3)' : 'rgba(255,110,30,.35)', 12);
    // clearings + paths
    const pathCol = frost ? 'rgba(168,192,214,.26)' : 'rgba(26,20,19,.78)', edgeCol = frost ? 'rgba(168,192,214,.1)' : 'rgba(26,20,19,.35)';
    for (const pl of L.paths.concat([L.lairPath])) { stroke(pl, 7.5, edgeCol, 6); stroke(pl, 4.6, pathCol, 3); }
    for (const k in L.locs) { if (k === 'lair') continue; const l = L.locs[k]; blob(l.x, l.z, l.clear + 2, frost ? 'rgba(176,200,222,.16)' : 'rgba(22,16,15,.72)'); }
    // speckle noise
    for (let i = 0; i < 2600; i++) { g.fillStyle = frost ? `rgba(255,255,255,${rr(0.02, 0.07)})` : `rgba(0,0,0,${rr(0.05, 0.2)})`; const s = rr(1, 3); g.fillRect(rr(0, cw), rr(0, ch), s, s); }
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(X(0), Z(0), 21 * M, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
    const oTex = new t3.Ha(cv); oTex.colorSpace = t3.Qt; oTex.needsUpdate = true; oTex.anisotropy = 4;
    const ov = new t3.X(new t3.eo(GW, GH), mat({ map: oTex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
    ov.rotation.x = -Math.PI / 2; ov.position.set((GX0 + GX1) / 2, 0.012, (GZ0 + GZ1) / 2); ov.receiveShadow = true; ov.renderOrder = 1; P.add(ov);

    // ---- river + bridges
    const rp = L.river.pts, hw = L.river.hw;
    const wMat = frost ? mat({ color: 0x123a52, roughness: 0.06, metalness: 0.35, emissive: 0x06283c, emissiveIntensity: 0.9 })
      : mat({ map: tex('floor_lava.jpg', 6, 1), emissive: 0xff5a1a, emissiveMap: tex('floor_lava.jpg', 6, 1), emissiveIntensity: 1.4, roughness: 0.6 });
    if (!frost) S.pulse.push({ m: wMat, base: 1.4, amp: 0.35 });
    for (let i = 0; i < rp.length - 1; i++) {
      const [ax, az] = rp[i], [bx, bz] = rp[i + 1], len = Math.hypot(bx - ax, bz - az);
      const seg = new t3.X(new t3.Ka(len + 0.2, 0.1, hw * 2), wMat); seg.position.set((ax + bx) / 2, -0.03, (az + bz) / 2); seg.rotation.y = -Math.atan2(bz - az, bx - ax); P.add(seg);
      if (i) { const j = new t3.X(new t3.Ja(hw, 24), wMat); j.rotation.x = -Math.PI / 2; j.position.set(ax, 0.021, az); P.add(j); }
    }
    { // floes / embers drifting in the river (static)
      const fl = []; for (let i = 0; i < 70; i++) { const x = rr(b.x0, b.x1); if (L.river.bridges.some((bx) => Math.abs(x - bx) < 5)) continue; const z = riverZ(x) + rr(-hw + 0.8, hw - 0.8), s = rr(0.4, 1.4); fl.push({ x, y: 0.02, z, sx: s * 1.4, sy: 0.12, sz: s, ry: rr(0, TAU) }); }
      instancePrim(P, new t3.Qa(1, 0), frost ? mat({ color: 0xdff4ff, roughness: 0.3, emissive: 0x1a3a4a }) : mat({ color: 0x1b1210, roughness: 0.9 }), fl);
    }
    const deckMat = frost ? mat({ color: 0x9fb6c8, roughness: 0.5, metalness: 0.1 }) : mat({ color: 0x1c1514, roughness: 0.8, emissive: 0x3a0c02 });
    for (const bx of L.river.bridges) {
      const zc = riverZ(bx), len = hw * 2 + 6;
      const deck = new t3.X(new t3.Ka(7, 0.3, len), deckMat); deck.position.set(bx, -0.1, zc); deck.receiveShadow = true; deck.castShadow = true; P.add(deck);
      for (const sx of [-1, 1]) {
        const rail = new t3.X(new t3.Ka(0.5, 1.0, len), deckMat); rail.position.set(bx + sx * 3.7, 0.45, zc); rail.castShadow = true; P.add(rail);
        for (const sz of [-1, 1]) { const post = new t3.X(new t3.Ya(0.45, 0.55, 2.2, 6), deckMat); post.position.set(bx + sx * 3.7, 1.1, zc + sz * len / 2); post.castShadow = true; P.add(post); addCircle(bx + sx * 3.9, zc + sz * len / 2, 0.6); }
      }
    }
    // ---- ridge + lair wall colliders
    S.caps = []; for (const pl of L.ridge) for (let i = 0; i < pl.length - 1; i++) S.caps.push([pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1], L.ridgeR]);

    // ---- walls: spires + boulders (instanced)
    const spires = [], rocks = [], lowRocks = [];
    const spire = (x, z, h, r) => spires.push({ x, y: h / 2, z, sx: r, sy: h, sz: r, ry: rr(0, TAU), rx: rr(-0.1, 0.1), rz: rr(-0.1, 0.1) });
    const rock = (x, z, r, arr = rocks) => arr.push({ x, y: r * 0.25, z, sx: r * rr(1.1, 1.5), sy: r * rr(0.7, 1.0), sz: r * rr(0.9, 1.3), ry: rr(0, TAU) });
    const edge = (x, z, nx, nz) => { // one wall column, outward normal (nx,nz)
      const southGate = z > b.z1 - 1 && Math.abs(x) < 34;
      for (let row = 0; row < 3; row++) {
        const o = [1.2, 4.6, 8.5][row] + rr(-0.6, 0.6), px = x + nx * o, pz = z + nz * o;
        if (southGate) { rock(px, pz, rr(1.2, 2.2)); continue; }
        if (row === 0 && rnd() < 0.45) rock(px, pz, rr(1.4, 2.6)); else spire(px, pz, [rr(4, 8), rr(7, 14), rr(11, 20)][row], [rr(1.2, 2), rr(1.8, 2.8), rr(2.4, 3.6)][row]);
      }
    };
    for (let x = b.x0; x <= b.x1; x += 3) { edge(x + rr(-0.8, 0.8), b.z0, 0, -1); edge(x + rr(-0.8, 0.8), b.z1, 0, 1); }
    for (let z = b.z0; z <= b.z1; z += 3) { edge(b.x0, z + rr(-0.8, 0.8), -1, 0); edge(b.x1, z + rr(-0.8, 0.8), 1, 0); }
    for (const pl of L.ridge) for (let i = 0; i < pl.length - 1; i++) {
      const [ax, az] = pl[i], [bx2, bz2] = pl[i + 1], len = Math.hypot(bx2 - ax, bz2 - az), nx = -(bz2 - az) / len, nz = (bx2 - ax) / len;
      for (let s = 0; s <= len; s += 2.4) { const x = ax + (bx2 - ax) * s / len, z = az + (bz2 - az) * s / len; spire(x + nx * rr(-1, 1), z + nz * rr(-1, 1), rr(4.5, 9.5), rr(1.4, 2.2)); if (rnd() < 0.6) rock(x + nx * rr(-2.5, 2.5), z + nz * rr(-2.5, 2.5), rr(1, 2)); }
    }
    { const lr = L.lair; for (let a = 0; a < TAU; a += 0.085) { if (Math.abs(a - Math.PI / 2) < lr.gate + 0.04) continue; const rm = (lr.r0 + lr.r1) / 2; spire(Math.cos(a) * (rm + rr(-1, 1.2)), Math.sin(a) * (rm + rr(-1, 1.2)), rr(5, 11), rr(1.3, 2.1)); if (rnd() < 0.5) rock(Math.cos(a) * rr(lr.r0, lr.r1), Math.sin(a) * rr(lr.r0, lr.r1), rr(0.9, 1.6)); } }
    const spMat = frost ? mat({ color: 0xffffff, roughness: 0.22, metalness: 0.08, emissive: 0x0a2236, emissiveIntensity: 0.6, flatShading: true }) : mat({ color: 0xffffff, roughness: 0.85, emissive: 0x2a0802, emissiveIntensity: 0.6, flatShading: true });
    const rkMat = frost ? mat({ color: 0xffffff, roughness: 0.6, flatShading: true }) : mat({ color: 0xffffff, roughness: 0.9, flatShading: true });
    instancePrim(P, new t3.Xa(1, 1, 6), spMat, spires, frost ? [0x9cc4e0, 0x7fa9c9, 0xb8d8ee, 0x6d93b3] : [0x2a1f1c, 0x1f1715, 0x34241f, 0x3d2a22]);
    instancePrim(P, new t3.Qa(1, 0), rkMat, rocks.concat(lowRocks), frost ? [0x55657a, 0x6a7d92, 0x4a586b] : [0x2b211e, 0x3a2b25, 0x241b19]);

    // ---- landmarks (Misty's scenery GLBs, outside the walls or as obstacles)
    const gx = (x) => (frost ? x : -x);
    if (frost) {
      glbLandmark(P, 'ice_palace', 26, 0, -60, 0);
      glbLandmark(P, 'ice_cliff', 18, gx(-94), 52, Math.PI / 2);
      glbLandmark(P, 'waterfall_cliff', 18, gx(-92), 103, Math.PI / 2);
      glbLandmark(P, 'ice_canyon', 18, gx(94), 24, -Math.PI / 2);
      glbLandmark(P, 'ice_formation', 11, gx(18), 116, 0.6, 4.2);
    } else {
      glbLandmark(P, 'lava_palace', 26, 0, -60, 0);
      glbLandmark(P, 'fire_cliff', 16, gx(-94), 52, -Math.PI / 2);
      glbLandmark(P, 'lava_lake', 9, gx(-90), 103, 0);
      glbLandmark(P, 'emberclock_cathedral', 20, gx(96), 18, Math.PI / 2);
      glbLandmark(P, 'emberclaw_prop', 4, gx(18), 116, 0.6, 2.6);
    }
    // ---- gate (start) + lair gate posts + seal
    const stone = frost ? mat({ color: 0xa8c0d4, roughness: 0.4, emissive: 0x0a1c2a }) : mat({ color: 0x241a17, roughness: 0.85, emissive: 0x2a0802 });
    const glow = new (t3.Ii)({ color: new t3.J(accent).multiplyScalar(2.2) });
    const gate = L.locs.gate;
    for (const sx of [-1, 1]) { const p = new t3.X(new t3.Ya(1.1, 1.4, 9, 8), stone); p.position.set(gate.x + sx * 5.5, 4.5, gate.z + 5); p.castShadow = true; P.add(p); addCircle(gate.x + sx * 5.5, gate.z + 5, 1.5); const c = new t3.X(new t3.Qa(0.6, 0), glow); c.position.set(gate.x + sx * 5.5, 9.6, gate.z + 5); P.add(c); }
    { const l = new t3.X(new t3.Ka(14, 1.2, 1.8), stone); l.position.set(gate.x, 9.1, gate.z + 5); l.castShadow = true; P.add(l); }
    const lr = L.lair, ga = Math.PI / 2, gr = (lr.r0 + lr.r1) / 2;
    for (const s of [-1, 1]) { const a = ga + s * (lr.gate + 0.03), x = Math.cos(a) * gr, z = Math.sin(a) * gr; const p = new t3.X(new t3.Ya(1.2, 1.5, 11, 8), stone); p.position.set(x, 5.5, z); p.castShadow = true; P.add(p); addCircle(x, z, 1.6); const c = new t3.X(new t3.Qa(0.7, 0), glow); c.position.set(x, 11.6, z); P.add(c); }
    { const w = 2 * gr * Math.sin(lr.gate) + 1; const seal = new t3.X(new t3.Ka(w, 7, 0.4), new (t3.Ii)({ color: new t3.J(accent).multiplyScalar(1.4), transparent: true, opacity: 0.38, depthWrite: false, blending: 2 })); seal.position.set(0, 3.5, gr); P.add(seal); S.seal = seal; }
    // ---- location dressing: standing stones round the clearings, shrine pillars
    const stones = [], torches = [];
    for (const k of ['arena1', 'arena2', 'crate1', 'crate2', 'shrine']) {
      const l = L.locs[k], n = k.startsWith('arena') ? 7 : 5, R = l.clear + 1.5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rr(-0.15, 0.15) + 0.3, x = l.x + Math.cos(a) * R, z = l.z + Math.sin(a) * R;
        if (L.paths.some((pl) => polyDist(x, z, pl) < 4.5)) continue;
        stones.push({ x, z, h: rr(2.6, 3.6), ry: rr(0, TAU) }); addCircle(x, z, 1.1);
        if (i % 2 === 0) torches.push({ x: x + Math.cos(a) * 1.8, z: z + Math.sin(a) * 1.8, h: frost ? 1.6 : 2.6, ry: rr(0, TAU) });
      }
    }
    if (frost) instancePrim(P, new t3.Ka(1, 1, 1), mat({ color: 0x8ea6ba, roughness: 0.5, emissive: 0x0c2a3c, flatShading: true }), stones.map((s) => ({ x: s.x, y: s.h / 2 - 0.2, z: s.z, sx: 1.1, sy: s.h, sz: 0.55, ry: s.ry, rx: rr(-0.08, 0.08), rz: rr(-0.08, 0.08) })));
    if (!frost) instancePrim(P, new t3.Xa(1, 1, 5), mat({ color: 0x120c0b, roughness: 0.4, metalness: 0.4, emissive: 0x3a0a02, flatShading: true }), stones.map((s) => ({ x: s.x, y: s.h / 2 + 0.3, z: s.z, sx: 0.8, sy: s.h + 0.6, sz: 0.8, ry: s.ry })));
    if (!frost) instanceGLB(P, 'dancing_flames', torches);
    { const l = L.locs.shrine; for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.55, x = l.x + Math.cos(a) * 12.5, z = l.z + Math.sin(a) * 12.5; const p = new t3.X(new t3.Ya(0.8, 1, 7, 8), stone); p.position.set(x, 3.5, z); p.castShadow = true; P.add(p); addCircle(x, z, 1.1); const c = new t3.X(new t3.Qa(0.45, 0), glow); c.position.set(x, 7.4, z); P.add(c); } }

    // ---- forests + boulder fields (scatter)
    const glbTrees = [], glbTrees2 = [], glbRocks = [], pines = [], deadTrees = [], fieldRocks = [];
    let near = 0;
    for (let i = 0; i < 2600; i++) {
      const x = rr(b.x0 + 2, b.x1 - 2), z = rr(b.z0 + 2, b.z1 - 2);
      // denser towards the walls, sparser in the open middle of each zone
      const edgeD = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
      if (rnd() > (edgeD < 14 ? 0.9 : 0.28)) continue;
      const pd = Math.min(...L.paths.map((pl) => polyDist(x, z, pl)));
      const kind = rnd();
      if (kind < 0.16) { // boulder
        const r = rr(1, 2.2); if (!free(x, z, r)) continue; rock(x, z, r, fieldRocks); addCircle(x, z, r * 1.05); continue;
      }
      if (!free(x, z, 0.8)) continue;
      const h = rr(5.5, 9.5);
      if (pd < 13 && near < (frost ? 24 : 22)) { near++; (frost ? (rnd() < 0.5 ? glbTrees : glbTrees2) : glbTrees).push({ x, z, h, ry: rr(0, TAU) }); }
      else if (frost) pines.push({ x, z, h });
      else deadTrees.push({ x, z, h });
      addCircle(x, z, 0.75);
    }
    if (frost) { instanceGLB(P, 'f_pine_a', glbTrees); instanceGLB(P, 'f_pine_b', glbTrees2); }
    else instanceGLB(P, 'f_charred_tree', glbTrees);
    instancePrim(P, new t3.Qa(1, 0), rkMat, fieldRocks, frost ? [0x5d6e84, 0x75889e] : [0x2e2420, 0x3b2c26]);
    for (let i = 0; i < 26; i++) { const x = rr(b.x0 + 4, b.x1 - 4), z = rr(b.z0 + 4, b.z1 - 4); if (free(x, z, 1.2)) { glbRocks.push({ x, z, h: rr(1.6, 2.8), ry: rr(0, TAU) }); addCircle(x, z, 1.3); } }
    instanceGLB(P, frost ? 'f_ice_rock' : 'f_lava_rock', glbRocks);
    if (frost) {
      const lo = [], hi = [], tr = [];
      for (const p of pines) { const w = p.h * 0.24; tr.push({ x: p.x, y: 0.6, z: p.z, sx: 0.28, sy: 1.2, sz: 0.28 }); lo.push({ x: p.x, y: 1 + p.h * 0.3, z: p.z, sx: w * 1.25, sy: p.h * 0.6, sz: w * 1.25, ry: rr(0, TAU) }); hi.push({ x: p.x, y: 1 + p.h * 0.62, z: p.z, sx: w * 0.85, sy: p.h * 0.5, sz: w * 0.85, ry: rr(0, TAU) }); }
      instancePrim(P, new t3.Ya(1, 1, 1, 5), mat({ color: 0x3a2a22 }), tr);
      const nm = mat({ color: 0xffffff, roughness: 0.8, flatShading: true });
      instancePrim(P, new t3.Xa(1, 1, 7), nm, lo, [0x24443f, 0x2c4d4a, 0x1f3b3a]);
      instancePrim(P, new t3.Xa(1, 1, 7), nm, hi, [0xcfe2ea, 0xb5ccd6, 0x2c4d4a]);
    } else {
      const tr = [], br = [];
      for (const p of deadTrees) { tr.push({ x: p.x, y: p.h / 2, z: p.z, sx: 0.32, sy: p.h, sz: 0.32, ry: rr(0, TAU), rx: rr(-0.08, 0.08) }); for (let k = 0; k < 2; k++) br.push({ x: p.x + rr(-0.6, 0.6), y: p.h * rr(0.45, 0.75), z: p.z + rr(-0.6, 0.6), sx: 0.12, sy: p.h * 0.35, sz: 0.12, rx: rr(-0.9, 0.9), rz: rr(-0.9, 0.9) }); }
      const dm = mat({ color: 0x17100e, roughness: 0.95, emissive: 0x200602, flatShading: true });
      instancePrim(P, new t3.Xa(1, 1, 5), dm, tr); instancePrim(P, new t3.Xa(1, 1, 4), dm, br);
    }
    // ---- objective beacon (a pillar of light over the next place)
    const bm = new (t3.Ii)({ color: new t3.J(accent).multiplyScalar(1.2), transparent: true, opacity: 0.16, depthWrite: false, blending: 2, side: 2 });
    const beacon = new t3.or(); const col = new t3.X(new t3.Ya(1.6, 2.4, 70, 16, 1, true), bm); col.position.y = 35; beacon.add(col);
    const ring = new t3.X(new t3.to(2.6, 3.4, 40), new (t3.Ii)({ color: new t3.J(accent).multiplyScalar(2), transparent: true, opacity: 0.7, depthWrite: false, side: 2 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; beacon.add(ring);
    beacon.visible = false; P.add(beacon); S.beacon = beacon; S.beaconCol = col; S.beaconRing = ring;
    buildGraph();
    renderMapBg(e);
  }

  // ------------------------------------------------------------------ route graph (minimap guide + test autopilot)
  function buildGraph() {
    const L = S.lay, nodes = [], idx = new Map(), adj = [];
    const node = (p) => { const k = p[0] + ',' + p[1]; if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push(p); adj.push([]); } return idx.get(k); };
    const link = (pl, tag) => { for (let i = 0; i < pl.length - 1; i++) { const a = node(pl[i]), c = node(pl[i + 1]), w = Math.hypot(pl[i][0] - pl[i + 1][0], pl[i][1] - pl[i + 1][1]); adj[a].push({ n: c, w, tag }); adj[c].push({ n: a, w, tag }); } };
    L.paths.forEach((pl) => link(pl)); link(L.lairPath, 'lair');
    S.graph = { nodes, adj, node: (p) => idx.get(p[0] + ',' + p[1]) };
  }
  function route(key) { // waypoints (map coords) from the hero to a location along the paths
    const L = S.lay, G = S.graph, h = heroMap(); if (!G || !h) return [];
    const loc = L.locs[key]; if (!loc) return [];
    let s = 0, sd = 1e9; G.nodes.forEach((p, i) => { const d = Math.hypot(p[0] - h.x, p[1] - h.z); if (d < sd) { sd = d; s = i; } });
    let goal = 0, gd = 1e9; G.nodes.forEach((p, i) => { const d = Math.hypot(p[0] - loc.x, p[1] - loc.z); if (d < gd) { gd = d; goal = i; } });
    const dist = G.nodes.map(() => 1e9), prev = G.nodes.map(() => -1), seen = G.nodes.map(() => false); dist[s] = 0;
    for (;;) { let u = -1; for (let i = 0; i < dist.length; i++) if (!seen[i] && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || dist[u] >= 1e9) break; seen[u] = true; if (u === goal) break; for (const ed of G.adj[u]) { if (ed.tag === 'lair' && S.sealed) continue; const nd = dist[u] + ed.w; if (nd < dist[ed.n]) { dist[ed.n] = nd; prev[ed.n] = u; } } }
    const out = []; for (let u = goal; u >= 0; u = prev[u]) out.unshift(G.nodes[u]); if (out.length && G.nodes.indexOf(out[0]) !== s) return [[loc.x, loc.z]];
    // skip the first node if we're already past it toward the second
    if (out.length > 1) { const a = out[0], c = out[1]; if (Math.hypot(c[0] - h.x, c[1] - h.z) < Math.hypot(c[0] - a[0], c[1] - a[1])) out.shift(); }
    out.push([loc.x, loc.z]);
    return out;
  }

  // ------------------------------------------------------------------ minimap + objective HUD
  const MAPW = 132;
  function ensureUi() {
    if (S.ui) return S.ui;
    const css = document.createElement('style');
    css.textContent = `
#tvwMap{position:fixed;z-index:13;top:calc(8px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px));display:none;flex-direction:column;align-items:flex-end;gap:4px;font-family:Georgia,'Times New Roman',serif;pointer-events:none}
#tvwMap canvas{width:var(--tvwW,${MAPW}px);border:1px solid rgba(192,192,200,.45);border-radius:6px;background:rgba(5,5,8,.55);box-shadow:0 0 12px rgba(0,0,0,.6);pointer-events:auto;cursor:pointer}
#tvwMap.big canvas{width:min(62vw,calc(70vh * .75))}
#tvwObj{display:none;align-items:center;gap:6px;padding:3px 9px;border-radius:12px;background:rgba(5,5,8,.62);border:1px solid rgba(192,192,200,.35);color:#eee;font-size:12px;letter-spacing:1px;white-space:nowrap;text-shadow:0 1px 3px #000}
#tvwObj b{display:inline-block;color:var(--tvwC,#9fe6ff);font-size:14px;line-height:1}
body.tvw-on #vmHud{top:calc(var(--tvwH,220px) + 14px + env(safe-area-inset-top,0px))}
body.touch #tvwMap{right:calc(66px + env(safe-area-inset-right,0px));--tvwW:96px}
body.touch #tvwObj{font-size:11px}
body.touch.tvw-on #vmHud{top:calc(64px + env(safe-area-inset-top,0px))}
`;
    document.head.appendChild(css);
    const wrap = document.createElement('div'); wrap.id = 'tvwMap';
    const cv = document.createElement('canvas'); const obj = document.createElement('div'); obj.id = 'tvwObj'; obj.innerHTML = '<b>▲</b><span></span>';
    wrap.append(cv, obj); document.body.appendChild(wrap);
    cv.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); wrap.classList.toggle('big'); });
    S.ui = { wrap, cv, ctx: cv.getContext('2d'), obj, arrow: obj.querySelector('b'), txt: obj.querySelector('span'), t: 0 };
    return S.ui;
  }
  function renderMapBg(e) {
    const L = S.lay, b = L.bounds, pad = 6, W = b.x1 - b.x0 + pad * 2, H = b.z1 - b.z0 + pad * 2, sc = 2.2;
    const cv = document.createElement('canvas'); cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
    const g = cv.getContext('2d'), X = (x) => (x - b.x0 + pad) * sc, Z = (z) => (z - b.z0 + pad) * sc, frost = e === 'frost';
    g.fillStyle = frost ? '#0b1219' : '#120806'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = frost ? '#33475a' : '#3a2620'; g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc);
    g.fillStyle = frost ? 'rgba(10,22,30,.7)' : 'rgba(12,6,4,.7)'; for (const c of S.circles) { g.beginPath(); g.arc(X(c.x), Z(c.z), Math.max(1.2, c.r * sc * 0.9), 0, TAU); g.fill(); }
    const line = (pl, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pl.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.stroke(); };
    line(L.river.pts, L.river.hw * 2 * sc, frost ? '#2f8fc4' : '#ff6a1a');
    for (const bx of L.river.bridges) { g.fillStyle = frost ? '#d8e6f0' : '#b99a86'; const zc = riverZ(bx); g.fillRect(X(bx - 3.5), Z(zc - L.river.hw - 3), 7 * sc, (L.river.hw * 2 + 6) * sc); }
    for (const pl of L.paths) line(pl, 3.2 * sc, frost ? 'rgba(230,242,255,.55)' : 'rgba(210,170,140,.4)');
    line(L.lairPath, 3.2 * sc, frost ? 'rgba(230,242,255,.35)' : 'rgba(210,170,140,.3)');
    for (const pl of L.ridge) line(pl, L.ridgeR * 2 * sc, frost ? '#0e1a24' : '#0c0504');
    g.strokeStyle = frost ? '#0e1a24' : '#0c0504'; g.lineWidth = (L.lair.r1 - L.lair.r0) * sc; g.beginPath(); g.arc(X(0), Z(0), (L.lair.r0 + L.lair.r1) / 2 * sc, Math.PI / 2 + L.lair.gate, Math.PI / 2 - L.lair.gate + TAU); g.stroke();
    g.fillStyle = frost ? 'rgba(160,210,240,.25)' : 'rgba(255,120,60,.2)'; g.beginPath(); g.arc(X(0), Z(0), 19 * sc, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3; g.strokeRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc);
    S.mapBg = { cv, X, Z, sc };
  }
  const GLYPH = { arena1: '⚔', arena2: '⚔', crate1: '◆', crate2: '◆', shrine: '✦', lair: '☠', gate: '⌂' };
  function drawMap() {
    const ui = ensureUi(), m = S.mapBg; if (!m) return;
    const cv = ui.cv, w = m.cv.width, h = m.cv.height;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    const g = ui.ctx; g.drawImage(m.cv, 0, 0);
    const L = S.lay, acc = '#' + new (T3().J)(FX().realm[S.realm].accent).getHexString(), tnow = performance.now() / 1000;
    if (S.target) { const r = route(S.target); if (r.length) { const hp = heroMap(); g.save(); g.setLineDash([6, 6]); g.strokeStyle = acc; g.globalAlpha = 0.85; g.lineWidth = 3; g.beginPath(); g.moveTo(m.X(hp.x), m.Z(hp.z)); r.forEach((p) => g.lineTo(m.X(p[0]), m.Z(p[1]))); g.stroke(); g.restore(); } }
    g.font = `bold ${Math.round(9 * m.sc)}px Georgia`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const k in GLYPH) {
      const l = L.locs[k]; if (!l) continue; if (k === 'crate2' && S.realm !== 'frost' && !S.target2) continue;
      const isT = S.target === k, done = S.done.has(k);
      if (isT) { g.strokeStyle = acc; g.lineWidth = 3; g.beginPath(); g.arc(m.X(l.x), m.Z(l.z), (8 + 3 * Math.sin(tnow * 5)) * m.sc, 0, TAU); g.stroke(); }
      g.fillStyle = done ? 'rgba(200,200,210,.45)' : isT ? '#fff' : 'rgba(235,235,245,.85)'; g.fillText(GLYPH[k], m.X(l.x), m.Z(l.z));
    }
    const Lg = TV();
    g.fillStyle = '#ff3355'; for (const en of Lg.enemies) if (en.alive) { const x = en.root.position.x - S.P.position.x, z = en.root.position.z - S.P.position.z; g.beginPath(); g.arc(m.X(x), m.Z(z), 2.4 * m.sc / 1.4, 0, TAU); g.fill(); }
    const hp = heroMap(), hr = FX().hero();
    if (hp && hr) { const ry = hr.root.rotation.y, s = 5 * m.sc / 1.3; g.save(); g.translate(m.X(hp.x), m.Z(hp.z)); g.rotate(-ry + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(s * 0.8, s); g.lineTo(0, s * 0.45); g.lineTo(-s * 0.8, s); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  }
  function updateObjective() {
    const ui = ensureUi();
    if (!S.target) { ui.obj.style.display = 'none'; return; }
    const hp = heroMap(), l = S.lay.locs[S.target]; if (!hp || !l) return;
    const r = route(S.target), nx = r.length ? r[0] : [l.x, l.z];
    const B = T3().B(); let fx = B.look.x - B.pos.x, fz = B.look.z - B.pos.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const dx = nx[0] - hp.x, dz = nx[1] - hp.z, sx = dx * -fz + dz * fx, sy = dx * fx + dz * fz;
    ui.arrow.style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
    ui.txt.textContent = `${LOC_LABEL[S.target]} · ${Math.round(Math.hypot(l.x - hp.x, l.z - hp.z))} m`;
    ui.obj.style.display = 'flex';
  }

  // ------------------------------------------------------------------ flow API (called by the bundle hooks)
  async function go(key) {
    if (!S.on) return;
    const loc = S.lay.locs[key]; if (!loc) return;
    const tok = S.token; S.target = key; if (key === 'crate2') S.target2 = true;
    const st = document.getElementById('stage'); if (st) st.textContent = `${FX().realm[S.realm].name.toUpperCase()} · ${LOC_LABEL[key].toUpperCase()}`;
    if (S.beacon) { S.beacon.position.set(loc.x, 0, loc.z); S.beacon.visible = true; }
    if (Q.get('autowalk') === '1' || window.__tvwAutowalk) { const h = FX().hero(); if (h) h.root.position.set(loc.x + S.P.position.x, 0, loc.z + loc.r * 0.6 + S.P.position.z); } // test harness only
    await new Promise((res) => {
      const iv = setInterval(() => {
        if (tok !== S.token) { clearInterval(iv); return; } // realm rebuilt / run left: stay pending like the bundle does
        const h = heroMap(), L = TV(); if (!h || L.state !== 'play') return;
        if (Math.hypot(h.x - loc.x, h.z - loc.z) < loc.r) { clearInterval(iv); res(); }
      }, 50);
    });
    if (S.beacon) S.beacon.visible = false;
    S.target = null; S.done.add(key);
    recenter(loc.x, loc.z);
  }
  function walk(t) {
    const fx = FX(), n = fx.realm[TV().realmKey] || fx.realm.frost;
    fx.banner(t, n.name, '#' + new (T3().J)(n.accent).getHexString());
    const key = { 'To the god essence crate': 'crate1', 'The second crate': 'crate2', 'To the God-Merge shrine': 'shrine', 'Toward the realm boss': 'lair' }[t];
    return key ? go(key) : Promise.resolve();
  }
  function toGate() { if (!S.on) return; const g = S.lay.locs.gate; recenter(g.x, g.z); placeHero(g.x, g.z, Math.PI); }
  function toApproach() { if (!S.on) return; S.sealed = false; recenter(0, 0); const a = S.lay.approach; placeHero(a.x, a.z, Math.PI); }

  function build(e, P, F) {
    S.token++; S.realm = e; S.P = P; S.F = F || []; S.target = null; S.target2 = false; S.done = new Set(); S.sealed = true;
    S.circles = []; S.grid = new Map(); S.caps = []; S.beacon = null; S.seal = null; S.pulse = []; S.mapBg = null; S.far = [];
    S.on = !OFF && (e === 'frost' || e === 'inferno');
    document.body.classList.toggle('tvw-world', S.on);
    if (!S.on) return;
    S.lay = LAYOUT[e];
    try { buildWorld(e, P); }
    catch (err) { console.warn('[TVw] overworld build failed, falling back to the ring arena', err); S.on = false; document.body.classList.remove('tvw-world'); }
  }

  // ------------------------------------------------------------------ per-frame (visual only)
  function findSky() { const sc = FX() && FX().scene; if (!sc) return null; for (const c of sc.children) if (c.material && c.material.uniforms && c.material.uniforms.top && c.material.uniforms.bot) return c; return null; }
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const fx = FX(), t3 = T3(), L = TV(); if (!fx || !t3 || !L) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const hero = fx.hero(), playing = S.on && L.state === 'play' && hero;
    // snow volume + sky dome stay on the camera (the scene origin moves with the floating origin)
    if (hero && t3.M) { t3.M.position.x = hero.root.position.x; t3.M.position.z = hero.root.position.z; }
    if (!S.sky) S.sky = findSky(); if (S.sky) { S.sky.position.x = t3.f.position.x; S.sky.position.z = t3.f.position.z; }
    if (S.on && S.P && (S.cullT = (S.cullT || 0) + dt) > 0.25) { S.cullT = 0; const cx = t3.f.position.x - S.P.position.x, cz = t3.f.position.z - S.P.position.z; for (const f of S.far) f.o.visible = Math.hypot(f.x - cx, f.z - cz) < f.d; }
    for (const p of S.pulse) p.m.emissiveIntensity = p.base + Math.sin(now / 1000 * 1.5) * p.amp;
    if (S.beacon && S.beacon.visible) { const k = 0.14 + 0.05 * Math.sin(now / 300); S.beaconCol.material.opacity = k; S.beaconRing.rotation.z += dt * 0.8; }
    if (S.seal) { S.seal.visible = S.sealed || !!L.boss; S.seal.material.opacity = 0.3 + 0.1 * Math.sin(now / 250); }
    const ui = ensureUi(), hudOn = playing && !L.cine && !document.getElementById('hud').classList.contains('hidden');
    ui.wrap.style.display = hudOn ? 'flex' : 'none'; document.body.classList.toggle('tvw-on', !!hudOn);
    if (hudOn && now - ui.t > 90) {
      ui.t = now; drawMap(); updateObjective();
      ui.wrap.style.setProperty('--tvwC', '#' + new t3.J(fx.realm[S.realm].accent).getHexString());
      document.body.style.setProperty('--tvwH', Math.round(ui.wrap.getBoundingClientRect().height) + 'px');
    }
  }
  requestAnimationFrame(frame);

  window.TVw = {
    version: '9.13.0',
    on: (e) => S.on && (e === undefined || e === S.realm),
    active: () => S.on && !(window.TV && window.TV.boss),
    build, collide, projOut, go, walk, toGate, toApproach,
    state: S, layout: LAYOUT,
    dbg: {
      heroMap, route,
      where: () => ({ realm: S.realm, on: S.on, target: S.target, sealed: S.sealed, hero: heroMap(), anchor: S.P ? { x: -S.P.position.x, z: -S.P.position.z } : null, done: [...S.done] }),
      warp: (key) => { const l = S.lay && S.lay.locs[key]; if (!l) return false; const h = FX().hero(); h.root.position.set(l.x + S.P.position.x, 0, l.z + S.P.position.z); return true; },
      tp: (mx, mz) => { const h = FX().hero(); h.root.position.set(mx + S.P.position.x, 0, mz + S.P.position.z); },
      // screen-relative move vector that walks the hero toward a world-map direction (works with either camera)
      steer: (wx, wz) => { const R = T3().R(); if (wx === null) { R.mv = null; return; } const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l; const C = window.TVx && TVx.cam; if (C && C.on) { const c = Math.cos(C.sYaw), s = Math.sin(C.sYaw); R.mv = { x: c * wx - s * wz, z: s * wx + c * wz }; } else R.mv = { x: wx, z: wz }; },
    },
  };
})();

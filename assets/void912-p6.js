// Dark Logic Studios — The Void web v9.12.0, part 6 (EGC-11 port).
// Sources: Godot egc11-port (d3d5c19) druid_ice_hammer_controller.gd, void_run_variability.gd,
// close_action_camera.gd; Misty's Unity DruidIceHammerController.cs / VoidRunVariabilityManager.cs /
// VoidFirstClearDruidUnlock.cs / VoidActionCameraController.cs; her auto-follow arm
// (void_godot_push_notes/close_action_camera_autofollow_misty.gd). Story text: only Misty's Druid line, verbatim.
(() => {
  const FX = () => window.TVfx;
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAngle = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

  // ------------------------------------------------------------------ run variability + first-clear Druid
  const VKEY = 'tvRunVariability';
  const NO_REPEAT_WINDOW = 2;
  const FROST_ROSTER = ['colossus', 'lyra'];
  const INFERNO_ROSTER = ['golem', 'enchantress'];
  const DRUID_PROMPT = 'FIRST CLEAR REWARD: THE DRUID UNLOCKED!';
  const DRUID_LOCKED_HINT = 'Beat Frostreach then Inferno first to unlock The Druid.';
  const FUSIONS = { 'colossus+golem': 'CALDERA TITAN', 'colossus+enchantress': 'HEXED COLOSSUS', 'golem+lyra': 'STEAMSONG GOLEM', 'enchantress+lyra': 'SIREN COVEN', 'colossus+lyra': 'HARPBOUND COLOSSUS' };
  const loadV = () => { try { return Object.assign({ druid: false, recent: [], lineSeen: false }, JSON.parse(LS(VKEY) || '{}')); } catch (_) { return { druid: false, recent: [], lineSeen: false }; } };
  const saveV = (v) => LS(VKEY, JSON.stringify(v));
  const RUN = { frost: '', inferno: '', frostCleared: false, infernoAfterFrost: false, unlockedThisRun: false };
  const lineupKey = (f, i) => `${f}_${i}`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // Unity StartNewRunLineup: plain 50/50 roll; if it repeats one of the last two lineups, roll among fresh ones.
  function rollLineup() {
    const v = loadV();
    const recent = Array.isArray(v.recent) ? v.recent : [];
    const every = [], fresh = [];
    for (const f of FROST_ROSTER) for (const i of INFERNO_ROSTER) { every.push([f, i]); if (!recent.includes(lineupKey(f, i))) fresh.push([f, i]); }
    let p = [pick(FROST_ROSTER), pick(INFERNO_ROSTER)];
    if (recent.includes(lineupKey(p[0], p[1]))) p = fresh.length ? pick(fresh) : pick(every);
    RUN.frost = p[0]; RUN.inferno = p[1];
    recent.push(lineupKey(p[0], p[1]));
    while (recent.length > NO_REPEAT_WINDOW) recent.shift();
    v.recent = recent; saveV(v);
    RUN.frostCleared = false; RUN.infernoAfterFrost = false; RUN.unlockedThisRun = false;
    return { frost: RUN.frost, inferno: RUN.inferno };
  }
  function lineupBoss(realm, pool) {
    if (!RUN.frost) rollLineup();
    const k = realm === 'frost' ? RUN.frost : RUN.inferno;
    return pool.includes(k) ? k : pick(pool);
  }
  function fusionInfo(a, b) {
    const f = FX(); const d = f.fuse(a, b); const A = f.bosses[a], Bb = f.bosses[b];
    const stronger = A && Bb ? (A.hp >= Bb.hp ? A : Bb) : null;
    return { name: d.name, hp: d.hp, scale: d.scale, color: d.color, tint: d.tint, moves: d.moves, strongerHp: stronger ? stronger.hp : null, strongerScale: stronger ? stronger.scale : null };
  }
  async function realmCleared(realm, boss, ft) {
    if (realm === 'frost') RUN.frostCleared = true;
    if (realm !== 'inferno' || !RUN.frostCleared) return;
    RUN.infernoAfterFrost = true;
    const v = loadV();
    if (v.druid) return;
    v.druid = true; saveV(v); RUN.unlockedThisRun = true;
    syncDruidCard();
    try { FX().banner(DRUID_PROMPT, '', '#40e6ff'); } catch (_) {}
    if (!v.lineSeen && ft) {
      await new Promise((r) => setTimeout(r, 900));
      await ft('druid_unlock');
      const w = loadV(); w.lineSeen = true; saveV(w);
    }
  }
  function syncDruidCard() {
    const c = document.querySelector('.hero[data-hero=druid]');
    if (!c) return;
    const on = loadV().druid;
    c.classList.toggle('locked', !on);
    c.setAttribute('aria-disabled', on ? 'false' : 'true');
  }
  // Locked card: swallow the click before the game's own onclick.
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.hero[data-hero=druid]');
    if (c && !loadV().druid) { e.stopPropagation(); e.preventDefault(); c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); }
  }, true);

  // ------------------------------------------------------------------ The Druid's ice hammer
  const DR = {
    moveSpeed: 6.8, dashSpeed: 18, dashDuration: 0.16, dashCooldown: 0.8,
    hammerRadius: 3.8, minHammerDamage: 42, maxHammerDamage: 95, maxChargeTime: 0.9, baseChill: 3.0, hammerCooldown: 0.45,
    magicDamage: 48, magicBoltSpeed: 30, magicRadius: 5.0, magicCooldown: 1.1, boltRange: 22,
    idleRune: [0.18, 0.72, 1.0], poweredRune: [0.55, 0.98, 1.0], idleEmission: 0.6, maxEmission: 4.2,
    dashGlow: 0.45, pulseDecay: 3.5, bodyTintIdle: 0.2, bodyTintPeak: 0.35, tintBuckets: 3,
    tint: [0.25, 0.85, 1.0], hold: [-0.62, 0.95, 0.28], strike: [0, 0.2, 1.4], handle: 1.5, headSize: 0.62,
    busy: 0.45, castBusy: 0.35,
  };
  const STATS = { slams: 0, casts: 0, dashes: 0, lastAoe: null, lastBolt: null, glow: 0, maxSpeedMul: 1 };
  const bolts = [];

  function dressDruid(h) {
    const f = FX(), T = f.T;
    if (!h || h.hero !== 'druid' || h.druid) return;
    const tint = new T.Color().setRGB(DR.tint[0], DR.tint[1], DR.tint[2], 'srgb');
    const bodyMats = [];
    let Std = null;
    h.root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const cl = ms.map((m) => { const c = m.clone(); if (c.color) c.color.lerp(tint, 0.45); if (c.emissive) { bodyMats.push(c); } if (!Std && c.isMeshStandardMaterial) Std = c.constructor; return c; });
      o.material = Array.isArray(o.material) ? cl : cl[0];
    });
    const Mat = Std || T.Basic;
    // placeholder hammer: handle + rune-blue head (Godot builds the same from primitives + rune stone)
    const hammer = new T.Mesh(new T.Cyl(0.045, 0.055, DR.handle, 10), new Mat({ color: 0x525c6b, roughness: 0.6 }));
    hammer.position.set(DR.hold[0], DR.hold[1], DR.hold[2]);
    hammer.rotation.set(-18 * Math.PI / 180, 0, 12 * Math.PI / 180);
    const headMat = new Mat({ color: 0x4f86b0, emissive: tint.clone(), emissiveIntensity: 0.12, roughness: 0.3, metalness: 0.2 });
    const head = new T.Mesh(new T.Cyl(DR.headSize * 0.36, DR.headSize * 0.36, DR.headSize, 8), headMat);
    head.rotation.z = Math.PI / 2; head.position.y = DR.handle * 0.5;
    hammer.add(head);
    hammer.name = 'IceHammer';
    h.root.add(hammer);
    // glowing tattoo rune bands (chest, belly, both arms)
    const bands = [];
    for (const b of [[0, 1.42, 0, 0.40], [0, 1.12, 0, 0.36], [0.6, 1.18, 0, 0.13], [-0.6, 1.18, 0, 0.13]]) {
      const m = new T.Mesh(new T.Cyl(b[3] + 0.02, b[3] + 0.02, 0.05, 32, 1, true), new T.Basic({ color: 0xffffff, side: 2, transparent: true, opacity: 0.95, depthWrite: false, blending: 2 }));
      m.position.set(b[0], b[1], b[2]); m.renderOrder = 3; h.root.add(m); bands.push(m);
    }
    h.druid = { hammer, head, headMat, bands, bodyMats, pulse: 0, glow: 0, bucket: 0, magicCD: 0, swing: 0 };
    h.dashCD = 0; h.druidBusy = 0;
    setBodyTint(h, DR.bodyTintIdle);
    applyGlow(h, 0);
  }
  function setBodyTint(h, k) {
    const f = FX(), T = f.T;
    for (const m of h.druid.bodyMats) { m.emissive.setRGB(DR.tint[0] * k, DR.tint[1] * k, DR.tint[2] * k, 'srgb'); }
  }
  function applyGlow(h, g) {
    const d = h.druid; d.glow = g; STATS.glow = g;
    const r = lerp(DR.idleRune[0], DR.poweredRune[0], g), gg = lerp(DR.idleRune[1], DR.poweredRune[1], g), b = lerp(DR.idleRune[2], DR.poweredRune[2], g);
    const e = lerp(DR.idleEmission, DR.maxEmission, g);
    for (const m of d.bands) m.material.color.setRGB(r * e, gg * e, b * e, 'srgb');
    d.headMat.emissiveIntensity = 0.12 + g * 0.8;
    if (h.weaponGlow) { h.weaponGlow.color.setRGB(r, gg, b, 'srgb'); h.weaponGlow.intensity = 1 + e * 2.2; h.weaponGlow.distance = 3.5 + g * 3; }
  }
  const facingDir = (h) => { const T = FX().T, a = h.root.rotation.y; return new T.V3(Math.sin(a), 0, Math.cos(a)); };
  const strikePoint = (h) => {
    const T = FX().T, a = h.root.rotation.y, p = h.root.position;
    return new T.V3(p.x + Math.sin(a) * DR.strike[2], DR.strike[1], p.z + Math.cos(a) * DR.strike[2]);
  };
  function aoe(center, radius, dmg, chill, heavy) {
    const f = FX(); let hits = 0;
    for (const e of f.live()) {
      const off = e.root.position.clone().sub(center); off.y = 0;
      if (off.length() - (e.radius || 0.5) > radius) continue;
      const dir = off.lengthSq() > 1e-4 ? off.normalize() : facingDir(f.hero());
      f.hit(e, dmg, dir, heavy);
      e.chillT = Math.max(e.chillT || 0, chill); hits++;
    }
    STATS.lastAoe = { x: center.x, z: center.z, radius, dmg, hits, chill, heavy };
    if (hits) f.L.hitStop = Math.max(f.L.hitStop || 0, 0.09);
    return hits;
  }
  function frostRing(center, radius, life, col) {
    const f = FX(), T = f.T;
    const m = new T.Mesh(new T.Ring(radius * 0.82, radius, 48), new T.Basic({ color: new T.Color(col).multiplyScalar(3.5), transparent: true, opacity: 0.85, side: 2, blending: 2, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(center.x, 0.09, center.z); f.scene.add(m);
    f.L.telegraphs.push({ mesh: m, fx: !0, t: 0, dur: life });
  }
  function druidBegin(h) { if (!h.druid) dressDruid(h); h.druid.bucket = 0; try { FX().sfx.play('draw'); } catch (_) {} }
  function druidSlam(h, charge) {
    const f = FX(); if (!h.druid) dressDruid(h);
    const c = clamp(charge, 0, 1), d = h.druid;
    d.pulse = 1; STATS.slams++;
    h.atkCD = DR.hammerCooldown * (f.L.mods.rateMul || 1);
    h.druidBusy = DR.busy; h.lockT = DR.busy; d.swing = 1;
    h.play(h.has && h.has('CrossRendRelease') ? 'CrossRendRelease' : 'Combo3', { once: !0, speed: 1.3 });
    const o = strikePoint(h);
    const dmg = lerp(DR.minHammerDamage, DR.maxHammerDamage, c) * (f.L.mods.dmgMul || 1);
    const radius = DR.hammerRadius * lerp(1, 1.3, c);
    aoe(o, radius, dmg, DR.baseChill + c, c >= 1);
    frostRing(o, radius, 0.45, 0x8cebff);
    f.burst.emit(o.clone().setY(0.3), 0x8cfaff, 60 + Math.round(40 * c), 8 + 4 * c, 0.6, 2);
    f.shake(0.3 + 0.3 * c);
    try { f.sfx.play('slam'); } catch (_) {}
    d.bucket = 0; setBodyTint(h, DR.bodyTintPeak);
  }
  function druidMagic() {
    const f = FX(); const h = f && f.hero();
    if (!h || h.hero !== 'druid' || !h.alive || f.L.state !== 'play' || f.L.paused || f.L.cine) return false;
    if (!h.druid) dressDruid(h);
    const d = h.druid;
    if (d.magicCD > 0 || h.dodgeT > 0) return false;
    d.magicCD = DR.magicCooldown; d.pulse = 1; STATS.casts++;
    h.charging = false; h.charge = 0;
    h.druidBusy = DR.castBusy; h.lockT = DR.castBusy;
    h.play('Combo3', { once: !0, speed: 1.3 });
    const T = f.T, dir = facingDir(h), o = strikePoint(h).setY(1.2);
    const mesh = new T.Mesh(new T.Cyl(0.16, 0.16, 0.9, 10), new T.Basic({ color: new T.Color(0x8cfaff).multiplyScalar(4), transparent: true, opacity: 0.95, blending: 2, depthWrite: false }));
    mesh.position.copy(o); mesh.rotation.x = Math.PI / 2; mesh.rotation.z = -Math.atan2(dir.x, dir.z) * 0; // aligned below
    mesh.lookAt(o.clone().add(dir)); mesh.rotateX(Math.PI / 2);
    f.scene.add(mesh);
    bolts.push({ mesh, dir, left: DR.boltRange / DR.magicBoltSpeed, dmg: DR.magicDamage * (f.L.mods.dmgMul || 1) });
    f.burst.emit(o.clone(), 0x2eb8ff, 40, 6, 0.5, 2);
    try { f.sfx.play('magic'); } catch (_) {}
    setBodyTint(h, DR.bodyTintPeak);
    return true;
  }
  function boltsTick(dt) {
    const f = FX();
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.mesh.position.addScaledVector(b.dir, DR.magicBoltSpeed * dt); b.left -= dt;
      if (Math.random() < 0.7) f.burst.emit(b.mesh.position.clone(), 0x8cfaff, 1, 1, 0.3, 0.5, 0);
      let hit = null;
      for (const e of f.live()) {
        const off = e.root.position.clone().sub(b.mesh.position); off.y = 0;
        if (off.length() < (e.radius || 0.5) + 0.6) { hit = e; break; }
      }
      if (hit || b.left <= 0) {
        if (hit) {
          f.hit(hit, b.dmg, b.dir.clone(), false);
          hit.chillT = Math.max(hit.chillT || 0, DR.baseChill);
          STATS.lastBolt = { hit: true, dmg: b.dmg, chill: DR.baseChill, boss: !!hit.isBoss };
          f.burst.emit(b.mesh.position.clone(), 0x8cfaff, 30, 7, 0.5, 2);
        } else STATS.lastBolt = { hit: false };
        f.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose();
        bolts.splice(i, 1);
      }
    }
  }
  function druidDash(h) {
    h.dodgeT = DR.dashDuration; h.dashV = DR.dashSpeed; h.dashCD = DR.dashCooldown;
    h.lockT = DR.dashDuration; h.iframe = Math.max(h.iframe, DR.dashDuration + 0.08); STATS.dashes++;
  }
  function druidTick(h, dt) {
    if (!h.druid) dressDruid(h);
    const d = h.druid;
    h.dashCD = Math.max(0, (h.dashCD || 0) - dt);
    h.druidBusy = Math.max(0, (h.druidBusy || 0) - dt);
    d.magicCD = Math.max(0, d.magicCD - dt);
    d.pulse = Math.max(0, d.pulse - dt * DR.pulseDecay);
    if (h.dodgeT <= 0) h.dashV = 0;
    if (h.dodgeT > 0 && h.dashV) { applyGlow(h, DR.dashGlow); }
    else {
      const c = h.charging ? h.charge : 0;
      applyGlow(h, clamp(c + d.pulse, 0, 1));
      if (h.charging) {
        const bucket = clamp(Math.floor(c * DR.tintBuckets + 1e-4), 0, DR.tintBuckets);
        if (bucket !== d.bucket && bucket > 0) { d.bucket = bucket; setBodyTint(h, lerp(DR.bodyTintIdle, DR.bodyTintPeak, bucket / DR.tintBuckets)); }
      }
    }
    // hammer swing: raise while charging, snap down on a slam
    const hm = d.hammer;
    d.swing = Math.max(0, d.swing - dt * 3.2);
    const lift = h.charging ? h.charge : 0;
    hm.rotation.x = -18 * Math.PI / 180 - lift * 1.4 + d.swing * 2.2;
  }

  // ------------------------------------------------------------------ close action camera (Misty's auto-follow arm)
  const CAM = {
    shoulder: [0.55, 1.75, 0], distance: 2.85, minDistance: 1.4, maxDistance: 4.5, zoomStep: 0.35, fov: 46, portraitFov: 62, portraitExtra: 0.6,
    mouseSensitivity: 0.0035, autoFollowSpeed: 3.5, autoFollowMinSpeed: 1.2, followSmoothness: 18,
    pitchMin: -0.85, pitchMax: 0.25, pitch0: -0.20, teleportSpeed: 40, bossDistance: 4.5, bossPitch: -0.45,
  };
  const C = {
    on: LS('tvCamClose') !== '0', auto: LS('tvCamAuto') !== '0',
    yaw: 0, pitch: CAM.pitch0, dist: CAM.distance, sYaw: 0, sPitch: CAM.pitch0, sDist: CAM.distance,
    manual: false, touchManual: false, rmb: false, last: null, pivot: null, init: false, boss: false,
  };
  function camReset() { C.yaw = C.sYaw = 0; C.pitch = C.sPitch = CAM.pitch0; C.dist = C.sDist = CAM.distance; C.last = null; C.init = false; }
  function orbit(dx, dy) { C.yaw -= dx * CAM.mouseSensitivity; C.pitch = clamp(C.pitch - dy * CAM.mouseSensitivity, CAM.pitchMin, CAM.pitchMax); }
  function zoom(delta) { C.dist = clamp(C.dist + delta, CAM.minDistance, CAM.maxDistance); }
  function camFollow(dt, B, V, L) {
    if (!C.on) return false;
    const T = FX().T, p = V.root.position;
    const manual = C.rmb || C.touchManual;
    C.manual = manual;
    const k = clamp(CAM.followSmoothness * Math.max(dt, 1e-4), 0, 1);
    if (C.last && dt > 0 && !manual && C.auto) {
      const mx = p.x - C.last.x, mz = p.z - C.last.z;
      const sp = Math.hypot(mx, mz) / Math.max(1e-4, dt);
      if (sp >= CAM.autoFollowMinSpeed && sp <= CAM.teleportSpeed) C.yaw = lerpAngle(C.yaw, Math.atan2(-mx, -mz), clamp(CAM.autoFollowSpeed * dt, 0, 1));
    }
    C.last = { x: p.x, z: p.z };
    C.boss = !!(L.boss && L.boss.alive);
    let wantDist = C.boss && !manual ? Math.max(C.dist, CAM.bossDistance) : C.dist;
    if (innerWidth < innerHeight) wantDist = Math.min(CAM.maxDistance + CAM.portraitExtra, wantDist + CAM.portraitExtra);
    const wantPitch = C.boss && !manual ? Math.min(C.pitch, CAM.bossPitch) : C.pitch;
    // v9.12 portrait fix: tall phones get a narrow horizontal FOV, so centre the shoulder, widen the lens and back off a bit (landscape untouched)
    const portrait = innerWidth < innerHeight, ry = V.root.rotation.y, so = portrait ? [CAM.shoulder[0] * 0.15, CAM.shoulder[1], CAM.shoulder[2]] : CAM.shoulder;
    const wantFov = portrait ? CAM.portraitFov : CAM.fov;
    const piv = new T.V3(p.x + so[0] * Math.cos(ry) + so[2] * Math.sin(ry), p.y + so[1], p.z - so[0] * Math.sin(ry) + so[2] * Math.cos(ry));
    if (!C.init || !C.pivot) { C.pivot = piv.clone(); C.sYaw = C.yaw; C.sPitch = wantPitch; C.sDist = wantDist; C.init = true; }
    else if (dt > 0) {
      C.pivot.lerp(piv, k);
      C.sYaw = lerpAngle(C.sYaw, C.yaw, k); C.sPitch = lerp(C.sPitch, wantPitch, k); C.sDist = lerp(C.sDist, wantDist, k);
    }
    const cp = Math.cos(C.sPitch);
    B.pos.set(C.pivot.x + Math.sin(C.sYaw) * cp * C.sDist, C.pivot.y - Math.sin(C.sPitch) * C.sDist, C.pivot.z + Math.cos(C.sYaw) * cp * C.sDist);
    if (B.pos.y < 0.35) B.pos.y = 0.35;
    B.look.copy(C.pivot); B.lookTarget && B.lookTarget.copy(C.pivot);
    B.fov += (wantFov - B.fov) * (dt > 0 ? clamp(dt * 8, 0, 1) : 0);
    return true;
  }
  // screen-relative (x right, z down) -> world, by the camera yaw
  function toWorld(x, z) { if (!C.on) return { x, z }; const c = Math.cos(C.sYaw), s = Math.sin(C.sYaw); return { x: x * c + z * s, z: -x * s + z * c }; }
  function camRel(v) { if (!C.on || (!v.x && !v.z)) return v; const w = toWorld(v.x, v.z); v.x = w.x; v.z = w.z; return v; }
  const camForward = () => (C.on ? { x: -Math.sin(C.sYaw), z: -Math.cos(C.sYaw) } : { x: 0, z: -1 });

  // desktop: right-drag orbits, wheel zooms while RMB is held (close camera only)
  const canvas = () => document.querySelector('canvas');
  addEventListener('mousedown', (e) => { if (e.button === 2 && C.on && e.target === canvas()) C.rmb = true; }, true);
  addEventListener('mouseup', (e) => { if (e.button === 2) C.rmb = false; }, true);
  addEventListener('blur', () => { C.rmb = false; });
  addEventListener('mousemove', (e) => { if (C.rmb && (e.buttons & 2)) orbit(e.movementX || 0, e.movementY || 0); }, true);
  addEventListener('wheel', (e) => {
    const f = FX(); if (!C.on || !C.rmb || !f || f.L.state !== 'play') return; // Misty: wheel zooms while RMB is held
    zoom(Math.sign(e.deltaY) * CAM.zoomStep); e.preventDefault();
  }, { passive: false, capture: true });

  // Druid magic on Q (Godot / Misty's EGC-11 binding; Orc keeps Blood Rush on Q)
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyQ' || e.repeat) return;
    const f = FX(), h = f && f.hero();
    if (h && h.hero === 'druid') { druidMagic(); }
  }, true);

  // ------------------------------------------------------------------ settings (pause + main menu)
  function settingsButtons() {
    for (const id of ['pause', 'menu']) {
      const box = document.querySelector(`#${id} .menu-btns`);
      if (!box || box.querySelector('.tvCamBtn')) continue;
      const a = document.createElement('button'); a.className = 'tvCamBtn'; a.dataset.set = 'cam';
      const b = document.createElement('button'); b.className = 'tvCamBtn'; b.dataset.set = 'auto';
      a.onclick = () => { setCamera(!C.on); }; b.onclick = () => { setAutoFollow(!C.auto); };
      const anchor = box.querySelector('[data-act=menuquit],[data-act=quit]');
      box.insertBefore(a, anchor); box.insertBefore(b, anchor);
    }
    syncSettings();
  }
  function syncSettings() {
    document.querySelectorAll('.tvCamBtn[data-set=cam]').forEach((x) => { x.textContent = `Camera: ${C.on ? 'Close-up' : 'Classic'}`; });
    document.querySelectorAll('.tvCamBtn[data-set=auto]').forEach((x) => { x.textContent = `Auto-follow: ${C.auto ? 'On' : 'Off'}`; x.disabled = !C.on; });
  }
  function setCamera(on) { C.on = !!on; LS('tvCamClose', C.on ? '1' : '0'); C.init = false; syncSettings(); }
  function setAutoFollow(on) { C.auto = !!on; LS('tvCamAuto', C.auto ? '1' : '0'); syncSettings(); }

  // ------------------------------------------------------------------ hooks
  function tick(real, scaled) {
    const f = FX(); if (!f) return;
    boltsTick(scaled);
    for (const e of f.L.enemies) if (e.chillT > 0) { e.chillT -= scaled; if (e.alive && Math.random() < 0.15) f.burst.emit(e.root.position.clone().setY(1), 0x8cebff, 1, 1, 0.4, 1, 0); }
    if (f.L.boss && f.L.boss.chillT > 0) f.L.boss.chillT -= scaled;
  }
  function boot() {
    const x = window.TVx;
    if (!window.TVfx || !x || !document.body) return setTimeout(boot, 30);
    const baseRun = x.runStart, baseTick = x.tick;
    Object.assign(x, {
      version: 'v9.12.0',
      runStart() { baseRun && baseRun.apply(x, arguments); const h = FX().hero(); if (h && h.hero === 'druid') dressDruid(h); rollLineup(); camReset(); },
      tick(r, s) { baseTick && baseTick.call(x, r, s); tick(r, s); },
      druidBegin, druidSlam, druidTick, druidDash, druidMagic, druidStats: STATS, druidCfg: DR,
      lineupBoss, rollLineup, realmCleared, fusionInfo, run: RUN, fusions: FUSIONS,
      variability: () => loadV(), druidUnlocked: () => !!loadV().druid, noRepeatWindow: NO_REPEAT_WINDOW,
      camFollow, camRel, toWorld, camForward, cam: C, camCfg: CAM, orbit, zoom, setCamera, setAutoFollow, camReset,
      setTouchOrbit(on) { C.touchManual = !!on; },
    });
    syncDruidCard(); settingsButtons();
    const hint = document.querySelector('.hero[data-hero=druid] .heroLock'); if (hint) hint.textContent = DRUID_LOCKED_HINT;
  }
  boot();
})();

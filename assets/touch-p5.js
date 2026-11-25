// Dark Logic Studios — The Void web v9.12.0: phone / tablet touch controls (replaces touch-p2.js).
// Left thumb: virtual joystick. Right side: drag to look + aim (close camera orbit), pinch / two fingers to zoom.
// Buttons: ATK (tap / drag to aim), HOLD (hold to charge: bow, Cross Rend, Druid ice hammer), MAGIC (Druid frost
// bolt, Orc Blood Rush), DASH, E/Y (interact), SWAP (freed god's power), AUTO, pause, SKIP for cutscenes.
// Multitouch through pointer events (one pointer per control). Shown only on touch devices.
(() => {
  const $ = (id) => document.getElementById(id);
  const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  const body = document.body;
  let enabled = false, active = false;
  let move = null, atk = null, hold = null, look = null;
  const lookPts = new Map();
  let pinch = null;
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
  let autoOn = LS('tvAutoFire') == null ? coarse : LS('tvAutoFire') === '1';
  let coachShown = LS('tvCoachSeen5') === '1', coachT = 0, autoT = 0, autoHeld = false;
  const DEAD = 12, AIM_DEAD = 20, LOOK_SENS = 1.6, PINCH_K = 0.012;
  const stats = { shots: 0, looks: 0, pinches: 0, magic: 0, dash: 0, swap: 0, use: 0, holds: 0 };
  window.TVtouch = { get auto() { return autoOn; }, get shots() { return stats.shots; }, set shots(v) { stats.shots = v; }, stats, get active() { return active; } };

  const root = document.createElement('div');
  root.id = 'tc';
  const btn = (id, label, aria, cls = '') => `<div id="${id}" class="tc-btn ${cls}" role="button" aria-label="${aria}"><span>${label}</span></div>`;
  root.innerHTML =
    '<div id="tcMove"></div><div id="tcLook"></div>' +
    '<div id="tcStickHome"></div><div id="tcStick"><i></i></div>' +
    '<div id="tcAtk" class="tc-btn fresh" role="button" aria-label="Attack"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12"/><circle cx="20" cy="20" r="3" class="dot"/><path d="M20 2v10M20 28v10M2 20h10M28 20h10"/></svg><span>ATK</span><b id="tcAim"></b></div>' +
    btn('tcHold', 'HOLD', 'Hold to charge') + btn('tcMagic', 'MAGIC', 'Magic') + btn('tcDash', 'DASH', 'Dash') +
    btn('tcUse', 'E/Y', 'Interact') + btn('tcSwap', 'SWAP', 'God swap power') + btn('tcAuto', 'AUTO', 'Auto-fire') +
    btn('tcPause', 'II', 'Pause') +
    '<div id="tcCoach"><div class="cL"><b>&#9673;</b>Left thumb: move</div><div class="cR"><b>&#8596;</b>Right side: drag to look and aim<small>Pinch to zoom · ATK attacks · HOLD charges</small></div><em>Tap anywhere to start</em></div>';
  const skip = document.createElement('div');
  skip.id = 'tcSkip'; skip.setAttribute('role', 'button'); skip.textContent = 'SKIP ▸▸';
  body.append(root, skip);
  body.append(root.querySelector('#tcCoach'));

  const stick = $('tcStick'), knob = stick.firstChild, aimDot = $('tcAim');
  const hintEl = $('dlgHint'), hintDesk = hintEl ? hintEl.textContent : '';
  const I = () => (window.TVdbg && window.TVdbg.inp ? window.TVdbg.inp() : null);
  const P = () => (window.TVdbg ? window.TVdbg.player() : null);
  const X = () => window.TVx;
  const W = (x, z) => (X() && X().toWorld ? X().toWorld(x, z) : { x, z });
  const key = (code) => {
    dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
    dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
  };
  const stickRad = () => Math.max(40, Math.min(70, Math.min(innerWidth, innerHeight) * 0.13));

  function enable() {
    if (enabled) return;
    enabled = true; body.classList.add('touch');
    if (hintEl) hintEl.textContent = 'Tap to continue · SKIP top-right';
    const i = I(); if (i && !i.R.ta) i.R.ta = { x: 0, z: -1 };
  }
  function disable() {
    if (!enabled) return;
    release(); enabled = false;
    body.classList.remove('touch', 'tc-on', 'tc-cut');
    if (hintEl) hintEl.textContent = hintDesk;
    const i = I(); if (i) { i.R.ta = null; i.R.mv = null; }
  }
  function release() {
    const i = I();
    if (i) { if (i.R.down) { i.R.down = false; i.Ne(); } i.R.mv = null; }
    autoHeld = false; move = null; atk = null; hold = null; look = null; lookPts.clear(); pinch = null;
    X() && X().setTouchOrbit && X().setTouchOrbit(false);
    stick.style.display = 'none';
    for (const id of ['tcAtk', 'tcHold']) $(id).classList.remove('on');
    aimDot.style.display = 'none';
  }

  // swallow touches on the control layer so the game never sees synthetic mouse clicks
  for (const el of [root, skip]) {
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // no page zoom / scroll gestures (iOS Safari ignores user-scalable=no)
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => { const t = Date.now(); if (t - lastTouchEnd < 320 && !(e.target.closest && e.target.closest('input,select,textarea'))) e.preventDefault(); lastTouchEnd = t; }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !(e.target.closest && e.target.closest('.panel,.screen,#vmShop,#vmGrid,.scroll'))) e.preventDefault(); }, { passive: false });

  // ---- left virtual joystick (floating; rests bottom-left) ----
  const mz = $('tcMove');
  mz.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (move) return;
    move = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    try { mz.setPointerCapture(e.pointerId); } catch (_) {}
    stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
    stick.style.display = 'block'; knob.style.transform = 'translate(0,0)';
    body.classList.add('tc-moving');
  });
  mz.addEventListener('pointermove', (e) => {
    if (!move || e.pointerId !== move.id) return;
    const RAD = stickRad();
    let dx = e.clientX - move.ox, dy = e.clientY - move.oy;
    const len = Math.hypot(dx, dy);
    if (len > RAD) {
      move.ox += (dx / len) * (len - RAD); move.oy += (dy / len) * (len - RAD);
      stick.style.left = move.ox + 'px'; stick.style.top = move.oy + 'px';
      dx = e.clientX - move.ox; dy = e.clientY - move.oy;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const i = I(); if (!i) return;
    const l = Math.hypot(dx, dy);
    // screen-relative; the game rotates it by the camera yaw (TVx.camRel)
    i.R.mv = l > DEAD ? { x: (dx / l) * Math.min(1, l / RAD * 1.4), z: (dy / l) * Math.min(1, l / RAD * 1.4) } : null;
  });
  const endMove = (e) => {
    if (!move || e.pointerId !== move.id) return;
    move = null; stick.style.display = 'none'; body.classList.remove('tc-moving');
    const i = I(); if (i) i.R.mv = null;
  };
  mz.addEventListener('pointerup', endMove);
  mz.addEventListener('pointercancel', endMove);

  // ---- right side: drag to look + aim, pinch / two fingers to zoom ----
  const lz = $('tcLook');
  function aimForward() {
    const i = I(), x = X(); if (!i || !x) return;
    const f = x.camForward ? x.camForward() : { x: 0, z: -1 };
    i.R.ta = { x: f.x, z: f.z };
  }
  lz.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { lz.setPointerCapture(e.pointerId); } catch (_) {}
    lookPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lookPts.size >= 2) {
      const [a, b] = [...lookPts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; look = null;
    } else {
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
      X() && X().setTouchOrbit && X().setTouchOrbit(true);
    }
  });
  lz.addEventListener('pointermove', (e) => {
    if (!lookPts.has(e.pointerId)) return;
    lookPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const x = X();
    if (pinch && lookPts.size >= 2) {
      const [a, b] = [...lookPts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (x && x.zoom) x.zoom(-(d - pinch.d) * PINCH_K);
      pinch.d = d; stats.pinches++;
      return;
    }
    if (!look || e.pointerId !== look.id) return;
    const dx = e.clientX - look.x, dy = e.clientY - look.y;
    look.x = e.clientX; look.y = e.clientY;
    if (x && x.cam && x.cam.on) { x.orbit(dx * LOOK_SENS, dy * LOOK_SENS); aimForward(); }
    else {
      const ddx = e.clientX - look.sx, ddy = e.clientY - look.sy, l = Math.hypot(ddx, ddy);
      const i = I(); if (i && l > AIM_DEAD) i.R.ta = W(ddx / l, ddy / l);
    }
    stats.looks++;
  });
  const endLook = (e) => {
    if (!lookPts.has(e.pointerId)) return;
    lookPts.delete(e.pointerId);
    if (lookPts.size < 2) pinch = null;
    if (look && e.pointerId === look.id) look = null;
    if (!look && lookPts.size === 1 && !pinch) { const [id, p] = [...lookPts.entries()][0]; look = { id, x: p.x, y: p.y, sx: p.x, sy: p.y }; }
    if (!lookPts.size) X() && X().setTouchOrbit && X().setTouchOrbit(false);
  };
  lz.addEventListener('pointerup', endLook);
  lz.addEventListener('pointercancel', endLook);

  // ---- ATK: tap / hold / drag to aim ----
  function autoAim() {
    const v = P(), i = I(), tv = window.TV;
    if (!v || !i || !tv) return false;
    const p = v.root.position;
    let best = null, bd = 20 * 20;
    const consider = (e) => { const dx = e.root.position.x - p.x, dz = e.root.position.z - p.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [dx, dz]; } };
    for (const e of tv.enemies) if (e.alive) consider(e);
    if (tv.boss && tv.boss.alive && !tv.boss.intangible) consider(tv.boss);
    if (!best) return false;
    const l = Math.hypot(best[0], best[1]) || 1;
    i.R.ta = { x: best[0] / l, z: best[1] / l };
    return true;
  }
  const ab = $('tcAtk');
  ab.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (atk) return;
    const i = I(); if (!i) return;
    const r = ab.getBoundingClientRect();
    atk = { id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, aimed: false };
    try { ab.setPointerCapture(e.pointerId); } catch (_) {}
    ab.classList.add('on'); ab.classList.remove('fresh'); stopAuto();
    stats.shots++;
    autoAim();
    i.R.down = true; i.Me();
  });
  ab.addEventListener('pointermove', (e) => {
    if (!atk || e.pointerId !== atk.id) return;
    const dx = e.clientX - atk.ox, dy = e.clientY - atk.oy, l = Math.hypot(dx, dy);
    if (l > AIM_DEAD) {
      atk.aimed = true;
      const i = I(); if (i) i.R.ta = W(dx / l, dy / l);
      const k = Math.min(l, 70) / l;
      aimDot.style.display = 'block'; aimDot.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
  });
  const endAtk = (e) => {
    if (!atk || e.pointerId !== atk.id) return;
    atk = null; ab.classList.remove('on'); aimDot.style.display = 'none';
    const i = I(); if (i && i.R.down && !hold) { i.R.down = false; i.Ne(); }
  };
  ab.addEventListener('pointerup', endAtk);
  ab.addEventListener('pointercancel', endAtk);

  // ---- HOLD: hold to charge (bow / Cross Rend / ice hammer), release to strike ----
  const hb = $('tcHold');
  hb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (hold) return;
    const i = I(); if (!i) return;
    hold = { id: e.pointerId };
    try { hb.setPointerCapture(e.pointerId); } catch (_) {}
    hb.classList.add('on'); stats.holds++; stopAuto();
    if (!look) autoAim();
    i.R.down = true; i.Me();
  });
  const endHold = (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    hold = null; hb.classList.remove('on');
    const i = I(); if (i && i.R.down && !atk) { i.R.down = false; i.Ne(); }
  };
  hb.addEventListener('pointerup', endHold);
  hb.addEventListener('pointercancel', endHold);

  // ---- buttons ----
  const tap = (el, fn) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 140); fn(); });
  tap($('tcDash'), () => { const i = I(); if (i) { i.ze(); stats.dash++; } });
  tap($('tcMagic'), () => {
    const v = P(), i = I(), x = X();
    if (!v || !i) return;
    if (v.hero === 'druid') { if (!look && !atk) autoAim(); x && x.druidMagic && x.druidMagic(); }
    else if (i.rush) i.rush();
    stats.magic++;
  });
  tap($('tcUse'), () => { const i = I(); if (i) { i.wt(); stats.use++; } });
  tap($('tcSwap'), () => { const x = X(); if (x && x.cast) { if (!look && !atk) autoAim(); x.cast(); stats.swap++; } });
  tap($('tcPause'), () => { release(); key('KeyP'); });
  tap(skip, () => key('Escape'));
  const autoBtn = $('tcAuto');
  const syncAuto = () => autoBtn.classList.toggle('lit', autoOn);
  syncAuto();
  tap(autoBtn, () => { autoOn = !autoOn; LS('tvAutoFire', autoOn ? '1' : '0'); if (!autoOn) stopAuto(); syncAuto(); });
  function stopAuto() { const i = I(); if (autoHeld && i) { i.R.down = false; i.Ne(); } autoHeld = false; }
  const coach = $('tcCoach');
  const hideCoach = () => { if (!coach.classList.contains('show')) return; coach.classList.remove('show'); LS('tvCoachSeen5', '1'); };
  addEventListener('pointerdown', hideCoach, true);

  // fullscreen on phones when a run starts (no orientation lock: portrait and landscape both play)
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || document.fullscreenElement) return;
    if (!e.target.closest || !e.target.closest('[data-act=play],.hero')) return;
    const d = document.documentElement;
    if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });

  // mode switching: touch turns controls on; a real mouse turns them off (desktop never shows them)
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') enable(); }, true);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && enabled && !coarse && (e.movementX || e.movementY)) disable(); }, true);
  addEventListener('blur', release);
  if (coarse) enable();
  const setVh = () => document.documentElement.style.setProperty('--tcvh', innerHeight * 0.01 + 'px');
  addEventListener('resize', setVh); setVh();

  // ---- per frame ----
  function frame() {
    requestAnimationFrame(frame);
    if (!enabled) return;
    const tv = window.TV, i = I(), v = P(), x = X();
    const hud = $('hud');
    const now = !!(tv && i && v && tv.state === 'play' && !tv.cine && !tv.paused && hud && !hud.classList.contains('hidden') && !(x && x.isOpen && x.isOpen()));
    if (now !== active) {
      active = now;
      body.classList.toggle('tc-on', now);
      if (!now) { release(); stopAuto(); }
      if (now && !coachShown) { coachShown = true; coach.classList.add('show'); coachT = performance.now(); }
    }
    if (coach.classList.contains('show') && performance.now() - coachT > 6000) hideCoach();
    const cut = $('cut');
    body.classList.toggle('tc-cut', !!(cut && !cut.classList.contains('hidden')));
    body.classList.toggle('tc-portrait', innerHeight > innerWidth);
    if (!active) return;
    if (!i.R.ta) i.R.ta = { x: 0, z: -1 };
    if (atk) { if (!atk.aimed) autoAim(); }
    else if (hold) { if (!look) autoAim(); if (!v.charging && v.hero !== 'orc') i.Me(); } // still busy when pressed: start the charge as soon as it can
    else if (!look && i.R.mv) { const w = W(i.R.mv.x, i.R.mv.z), l = Math.hypot(w.x, w.z) || 1; i.R.ta = { x: w.x / l, z: w.z / l }; }
    if (autoOn && !atk && !hold) {
      const t = performance.now();
      if (autoHeld) { i.R.down = false; i.Ne(); autoHeld = false; }
      else if (t - autoT > (v.hero === 'orc' ? 260 : v.hero === 'druid' ? 520 : 380) && autoAim()) {
        autoT = t; i.R.down = true; i.Me(); autoHeld = true; stats.shots++;
      }
    }
    body.classList.toggle('tc-orc', v.hero === 'orc');
    body.classList.toggle('tc-druid', v.hero === 'druid');
    body.classList.toggle('tc-archer', v.hero === 'archer');
    $('tcMagic').firstChild.textContent = v.hero === 'druid' ? 'MAGIC' : 'RUSH';
    $('tcHold').firstChild.textContent = v.hero === 'druid' ? 'HAMMER' : 'HOLD';
    if (v.hero === 'druid' && v.druid) {
      const cd = v.druid.magicCD || 0, m = $('tcMagic');
      m.classList.toggle('cd', cd > 0); m.style.setProperty('--cd', cd / 1.1);
    }
    $('tcHold').style.setProperty('--chg', v.charging ? v.charge : 0);
    const pr = $('prompt');
    $('tcUse').classList.toggle('ready', !!(pr && pr.textContent));
    const sig = x && x.powers ? x.powers : null;
    $('tcSwap').classList.toggle('ready', !!(sig && sig.selected));
  }
  requestAnimationFrame(frame);
})();

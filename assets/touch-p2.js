// Dark Logic Studios — The Void: phone / tablet touch controls.
// Left thumb: floating move stick. ATK: tap = attack nearest enemy, drag = aim,
// hold = charge (Archer) or chain combo (Orc). DODGE, USE, pause, skip-cutscene.
(() => {
  const $ = (id) => document.getElementById(id);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const body = document.body;
  let enabled = false, active = false;
  let move = null, atk = null;
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
  let autoOn = LS('tvAutoFire') == null ? coarse : LS('tvAutoFire') === '1';
  let coachShown = LS('tvCoachSeen') === '1', coachT = 0, autoT = 0, autoHeld = false;
  window.TVtouch = { get auto() { return autoOn; }, shots: 0 };
  const DEAD = 14, RAD = 58, AIM_DEAD = 20;

  const root = document.createElement('div');
  root.id = 'tc';
  root.innerHTML =
    '<div id="tcMove"></div>' +
    '<div id="tcStick"><i></i></div>' +
    '<div id="tcUse" class="tc-btn" role="button" aria-label="Use">USE</div>' +
    '<div id="tcDodge" class="tc-btn" role="button" aria-label="Dodge">DODGE</div>' +
    '<div id="tcAtk" class="tc-btn fresh" role="button" aria-label="Shoot"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12"/><circle cx="20" cy="20" r="3" class="dot"/><path d="M20 2v10M20 28v10M2 20h10M28 20h10"/></svg><span>SHOOT</span><b id="tcAim"></b></div>' +
    '<div id="tcAuto" class="tc-btn" role="button" aria-label="Auto-fire">AUTO</div>' +
    '<div id="tcCoach"><div class="cL"><b>&#8592; &#8595; &#8594;</b>Left thumb: move</div><div class="cR"><b>&#8600;</b>Tap SHOOT to fire - drag to aim<small>AUTO (on) fires for you</small></div><div class="cD">DODGE: roll<b>&#8595;</b></div><em>Tap anywhere to start</em></div>' +
    '<div id="tcPause" class="tc-btn" role="button" aria-label="Pause">II</div>';
  const skip = document.createElement('div');
  skip.id = 'tcSkip';
  skip.setAttribute('role', 'button');
  skip.textContent = 'SKIP ▸▸';
  body.append(root, skip);
  body.append(root.querySelector('#tcCoach'));

  const stick = $('tcStick'), knob = stick.firstChild, aimDot = $('tcAim');
  const hintEl = $('dlgHint'), hintDesk = hintEl ? hintEl.textContent : '';

  const I = () => (window.TVdbg && window.TVdbg.inp ? window.TVdbg.inp() : null);
  const P = () => (window.TVdbg ? window.TVdbg.player() : null);
  const key = (code) => {
    dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
    dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
  };

  function enable() {
    if (enabled) return;
    enabled = true;
    body.classList.add('touch');
    if (hintEl) hintEl.textContent = 'Tap to continue · SKIP top-right';
    const i = I();
    if (i && !i.R.ta) i.R.ta = { x: 0, z: -1 };
  }
  function disable() {
    if (!enabled) return;
    release();
    enabled = false;
    body.classList.remove('touch', 'tc-on', 'tc-cut');
    if (hintEl) hintEl.textContent = hintDesk;
    const i = I();
    if (i) { i.R.ta = null; i.R.mv = null; }
  }
  function release() {
    const i = I();
    if (i) {
      if (i.R.down) { i.R.down = false; i.Ne(); }
      i.R.mv = null;
    }
    autoHeld = false;
    move = null; atk = null;
    stick.style.display = 'none';
    $('tcAtk').classList.remove('on');
    aimDot.style.display = 'none';
  }

  // Swallow every touch on the control layer so the game never sees fake mouse clicks.
  for (const el of [root, skip]) {
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---- Move stick (left half, appears under the thumb) ----
  const mz = $('tcMove');
  mz.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (move) return;
    move = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    try { mz.setPointerCapture(e.pointerId); } catch (_) {}
    stick.style.left = e.clientX + 'px';
    stick.style.top = e.clientY + 'px';
    stick.style.display = 'block';
    knob.style.transform = 'translate(0,0)';
  });
  mz.addEventListener('pointermove', (e) => {
    if (!move || e.pointerId !== move.id) return;
    let dx = e.clientX - move.ox, dy = e.clientY - move.oy;
    const len = Math.hypot(dx, dy);
    if (len > RAD) {
      // drag the base along so the stick never "runs out"
      move.ox += (dx / len) * (len - RAD);
      move.oy += (dy / len) * (len - RAD);
      stick.style.left = move.ox + 'px';
      stick.style.top = move.oy + 'px';
      dx = e.clientX - move.ox; dy = e.clientY - move.oy;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const i = I();
    if (!i) return;
    const l = Math.hypot(dx, dy);
    i.R.mv = l > DEAD ? { x: dx / l, z: dy / l } : null;
  });
  const endMove = (e) => {
    if (!move || e.pointerId !== move.id) return;
    move = null;
    stick.style.display = 'none';
    const i = I();
    if (i) i.R.mv = null;
  };
  mz.addEventListener('pointerup', endMove);
  mz.addEventListener('pointercancel', endMove);

  // ---- Attack: tap / hold / drag to aim ----
  function autoAim() {
    const v = P(), i = I(), tv = window.TV;
    if (!v || !i || !tv) return false;
    const p = v.root.position;
    let best = null, bd = 20 * 20;
    const consider = (e) => {
      const dx = e.root.position.x - p.x, dz = e.root.position.z - p.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [dx, dz]; }
    };
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
    const i = I();
    if (!i) return;
    const r = ab.getBoundingClientRect();
    atk = { id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, aimed: false };
    try { ab.setPointerCapture(e.pointerId); } catch (_) {}
    ab.classList.add('on');
    ab.classList.remove('fresh');
    window.TVtouch.shots++;
    autoAim();
    i.R.down = true;
    i.Me();
  });
  ab.addEventListener('pointermove', (e) => {
    if (!atk || e.pointerId !== atk.id) return;
    const dx = e.clientX - atk.ox, dy = e.clientY - atk.oy, l = Math.hypot(dx, dy);
    if (l > AIM_DEAD) {
      atk.aimed = true;
      const i = I();
      if (i) i.R.ta = { x: dx / l, z: dy / l };
      const k = Math.min(l, 70) / l;
      aimDot.style.display = 'block';
      aimDot.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
  });
  const endAtk = (e) => {
    if (!atk || e.pointerId !== atk.id) return;
    atk = null;
    ab.classList.remove('on');
    aimDot.style.display = 'none';
    const i = I();
    if (i && i.R.down) { i.R.down = false; i.Ne(); }
  };
  ab.addEventListener('pointerup', endAtk);
  ab.addEventListener('pointercancel', endAtk);

  // ---- Buttons ----
  const tap = (el, fn) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  tap($('tcDodge'), () => { const i = I(); if (i) i.ze(); });
  tap($('tcUse'), () => { const i = I(); if (i) i.wt(); });
  tap($('tcPause'), () => { release(); key('KeyP'); });
  tap(skip, () => key('Escape'));
  const autoBtn = $('tcAuto');
  const syncAuto = () => autoBtn.classList.toggle('lit', autoOn);
  syncAuto();
  tap(autoBtn, () => { autoOn = !autoOn; LS('tvAutoFire', autoOn ? '1' : '0'); if (!autoOn) stopAuto(); syncAuto(); });
  function stopAuto() { const i = I(); if (autoHeld && i) { i.R.down = false; i.Ne(); } autoHeld = false; }
  const coach = $('tcCoach');
  const hideCoach = () => { if (!coach.classList.contains('show')) return; coach.classList.remove('show'); LS('tvCoachSeen', '1'); };
  addEventListener('pointerdown', hideCoach, true);

  // ---- Fullscreen + landscape on phones when a run starts (ignored where unsupported) ----
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || document.fullscreenElement) return;
    if (!e.target.closest || !e.target.closest('[data-act=play],.hero')) return;
    const d = document.documentElement;
    if (!d.requestFullscreen) return;
    d.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
      .catch(() => {});
  });

  // ---- Mode switching: touch turns controls on; a real mouse turns them off ----
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') enable(); }, true);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && enabled && !coarse && (e.movementX || e.movementY)) disable();
  }, true);
  addEventListener('blur', release);
  if (coarse) enable();

  // ---- Per-frame upkeep ----
  function frame() {
    requestAnimationFrame(frame);
    if (!enabled) return;
    const tv = window.TV, i = I(), v = P();
    const hud = $('hud');
    const now = !!(tv && i && v && tv.state === 'play' && !tv.cine && !tv.paused && hud && !hud.classList.contains('hidden'));
    if (now !== active) {
      active = now;
      body.classList.toggle('tc-on', now);
      if (!now) { release(); stopAuto(); }
      if (now && !coachShown) { coachShown = true; coach.classList.add('show'); coachT = performance.now(); }
    }
    if (coach.classList.contains('show') && performance.now() - coachT > 6000) hideCoach();
    const cut = $('cut');
    body.classList.toggle('tc-cut', !!(cut && !cut.classList.contains('hidden')));
    if (!active) return;
    if (!i.R.ta) i.R.ta = { x: 0, z: -1 };
    if (atk) {
      if (!atk.aimed) autoAim();
      if (v.hero === 'orc') i.Me(); // holding chains the 3-hit combo
    } else if (i.R.mv) {
      i.R.ta = { x: i.R.mv.x, z: i.R.mv.z }; // face where you run
    }
    // Auto-fire: short tap-attacks at the nearest enemy while one is in range.
    if (autoOn && !atk) {
      const t = performance.now();
      if (autoHeld) { i.R.down = false; i.Ne(); autoHeld = false; }
      else if (t - autoT > (v.hero === 'orc' ? 260 : 380) && autoAim()) {
        autoT = t; i.R.down = true; i.Me(); autoHeld = true; window.TVtouch.shots++;
      }
    }
    const pr = $('prompt');
    $('tcUse').classList.toggle('ready', !!(pr && pr.textContent));
  }
  requestAnimationFrame(frame);
})();

// Dark Logic Studios — The Void web v9.12.0 add-on (ported from the Godot 4 prototype, master aa913ca).
//  1) Void Market as a HUD Shop button (Tab / gamepad D-pad Down / "Shop · Tab" button), Void Shards economy.
//  2) Frost atmosphere: rim surge in combat, snow 120 -> 260 /s, glow + vignette hit flash, idle after 3.5 s.
//  3) God crate pool Ymir / Ullr / Pele / Sekhmet (already the web pool) + a name-only "Coming" teaser list.
//  5) Reliquary emergence (Godot 34ba500): themed prompt "[E / Y] Pry Open <Theme> Reliquary", lid pry flash + shake,
//     the full god model rises 3.2 m over 1.1 s dormant, then awakens into the reveal.
//  4) Canon crate reveal: "{GODNAME} IS FREE" banner + "Signature power: {name} · {Forever|This run}",
//     signature powers castable with F / gamepad LB / touch GOD (simplified: no god-swap model).
// Bundle hooks call window.TVx.* (see /workspace/void_web_v912/PATCHES.md). No story dialogue lives here.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const FX = () => window.TVfx;

  // ------------------------------------------------------------------ data (Godot item_def.gd / shop_def.gd / god_def.gd)
  const CURRENCY = 'Void Shards', ICON = '◆';
  const REWARD = { kill: 2, elite: 8, crate: 15, boss: 60, fusion: 120 };
  const BARK = { greet: 'Welcome.', open: 'Take your time.', buy: 'A fine choice.' }; // Godot ShopDef placeholder barks
  const REALMS = ['none', 'Frostreach', 'Inferno', 'Void Draw', 'Victory'];
  const WEAPON_LEVEL_COSTS = [40, 80, 130, 190, 260], WEAPON_LEVEL_DMG = 0.08;
  const STARTER = { archer: 'energy_bow', orc: 'dual_daggers' };
  const UP = (name, ic, desc, fx, costs, col) => ({ kind: 'upgrade', name, ic, desc, fx, costs, max: costs.length, gated: 4, tierRealm: 'Inferno', unlock: 'none', col });
  const WP = (slot, name, desc, price, unlock, col, dmg, rate, charge, reach, extra = {}) =>
    Object.assign({ kind: 'weapon', slot, name, ic: slot === 'archer' ? '➹' : '⚔', desc, costs: [price], max: WEAPON_LEVEL_COSTS.length, unlock, col, dmg, rate, charge, reach, fx: {}, ignite: false }, extra);
  const GR = (slot, name, ic, desc, fx, price, unlock, col) => ({ kind: 'gear', slot, name, ic, desc, fx, costs: [price], max: 1, unlock, col });
  const ITEMS = {
    vitality: UP('Vitality', '♥', '+10 max HP per tier', { maxHp: 10 }, [25, 50, 90, 140, 200], '#f24059'),
    might: UP('Might', '⚔', '+5% damage per tier', { dmgMul: 1.05 }, [25, 50, 90, 140, 200], '#ff734d'),
    swiftness: UP('Swiftness', '➶', '+4% move speed per tier', { speed: 1.04 }, [20, 40, 70, 110, 160], '#8cffbf'),
    precision: UP('Precision', '◎', '+4% critical hit chance per tier', { crit: 0.04 }, [30, 60, 100, 150, 220], '#ffd36b'),
    ferocity: UP('Ferocity', '✦', '+15% critical hit damage per tier', { critMul: 0.15 }, [30, 60, 100, 150, 220], '#ff9933'),
    endurance: UP('Endurance', '༄', '+10% stamina regen per tier', { stamina: 1.10 }, [20, 40, 70, 110, 160], '#bfbfd1'),
    energy_bow: WP('archer', 'Energy Bow', 'Her starting bow. Tap to shoot, hold to charge a piercing shot.', 0, 'none', '#6affc8', 1, 1, 1, 1),
    frost_longbow: WP('archer', 'Frost Longbow', 'Charge 25% faster, +20% damage, fires 15% slower. Ice-blue arrows.', 150, 'none', '#8fe6ff', 1.2, 1.15, 0.75, 1),
    ember_shortbow: WP('archer', 'Ember Shortbow', 'Fires 30% faster, -15% damage, arrows ignite (8 dmg/s for 3 s).', 180, 'Inferno', '#ff8a3a', 0.85, 0.7, 1, 1, { ignite: true }),
    dual_daggers: WP('orc', 'Dual Daggers', 'His starting daggers. Fast 3-hit combo ending in a spinning cleave.', 0, 'none', '#ff7a3a', 1, 1, 1, 1),
    bone_cleavers: WP('orc', 'Bone Cleavers', '+25% damage, +20% reach, swings 15% slower. Bone-white arcs.', 150, 'none', '#f2ead8', 1.25, 1.15, 1, 1.2),
    void_fangs: WP('orc', 'Void Fangs', 'Swings 20% faster, -10% damage, heal 3% of damage dealt. Violet arcs.', 180, 'Void Draw', '#b04dff', 0.9, 0.8, 1, 1, { fx: { lifesteal: 0.03 } }),
    frostweave_mantle: GR('armor', 'Frostweave Mantle', '⛨', '-10% damage taken', { takenMul: 0.9 }, 120, 'none', '#9ee8ff'),
    emberplate: GR('armor', 'Emberplate', '⛨', '+30 max HP, -5% move speed', { maxHp: 30, speed: 0.95 }, 160, 'Inferno', '#ff7333'),
    void_shroud: GR('armor', 'Void Shroud', '⛨', 'Dodge costs 25% less stamina, -5% damage taken', { dodgeCost: 0.75, takenMul: 0.95 }, 220, 'Void Draw', '#994dff'),
    hunters_eye: GR('trinket', "Hunter's Eye", '◉', '+6% critical hit chance', { crit: 0.06 }, 100, 'none', '#ffd36b'),
    blood_charm: GR('trinket', 'Blood Charm', '❖', 'Heal 3% of the damage you deal', { lifesteal: 0.03 }, 140, 'none', '#e61a40'),
    rune_of_haste: GR('trinket', 'Rune of Haste', 'ᚱ', '+8% move speed, +15% stamina regen', { speed: 1.08, stamina: 1.15 }, 120, 'Inferno', '#8cffbf'),
  };
  for (const k in ITEMS) ITEMS[k].id = k;
  const UPGRADE_IDS = ['vitality', 'might', 'swiftness', 'precision', 'ferocity', 'endurance'];
  const GEAR_IDS = ['frostweave_mantle', 'emberplate', 'void_shroud', 'hunters_eye', 'blood_charm', 'rune_of_haste'];
  const TABS = ['upgrades', 'weapons', 'gear'], TAB_TITLES = ['Upgrades', 'Weapons', 'Gear'];
  const MUL_KEYS = ['dmgMul', 'speed', 'stamina', 'takenMul', 'dodgeCost', 'chargeMul', 'rateMul', 'reachMul'];
  const ADD_KEYS = { maxHp: 'maxHpAdd', lifesteal: 'lifesteal', crit: 'crit', critMul: 'critMul', shopBurn: 'shopBurn' };
  const HERO = { archer: ['Lyriel', 'Elf Archer'], orc: ['Varga', 'Orc Brawler'], druid: ['The Druid', 'Ice Hammer Druid'] };

  // Signature powers (Godot god_def.gd TABLE; names are flagged name_is_proposal there).
  const GODS = {
    ymir: { name: 'Ymir', glow: '#5fd0ff', sig: 'Throne of Rime', forever: true, cd: 22, kind: 'nova',
      desc: 'Frost nova: freezes nearby enemies and wraps you in a frost shield.', m: { radius: 7, damage: 45, freeze: 2.5, shield: 40, shield_time: 6 } },
    ullr: { name: 'Ullr', glow: '#4cbaff', sig: 'Heart-Crystal Volley', forever: false, cd: 16, kind: 'volley',
      desc: 'A fan of piercing heart-crystal shots that land as heavy hits.', m: { shots: 7, spread: 0.9, damage: 40, speed: 40, range: 22 } },
    pele: { name: 'Pele', glow: '#ff5a14', sig: 'Lava Vortex', forever: false, cd: 20, kind: 'eruption',
      desc: 'Erupts a lava vortex ahead of you that keeps burning everything inside.', m: { distance: 5.5, radius: 4.2, damage: 40, dps: 22, zone_time: 5, ignite: 3 } },
    sekhmet: { name: 'Sekhmet', glow: '#ffd36b', sig: 'Sun-Wrath Feast', forever: true, cd: 20, kind: 'beam',
      desc: "The fire-eye's solar gaze: a beam that heals you for part of the damage it deals.", m: { length: 18, width: 2.4, dps: 70, beam_time: 1, heal_share: 0.25 } },
  };
  // Reliquary emergence per god (Godot gift_def.gd emerge_* fields; full models from god_def.gd full_model_path).
  const EMERGE = {
    ymir: { theme: 'Frost', prompt: 'Pry Open Frost Reliquary', model: 'ymir', height: 3.6, tint: [0.74, 0.79, 0.86], light: '#5fd0ff', trim: '#e0f0ff', dormant: [0.28, 0.42, 0.55] },
    ullr: { theme: 'Frost', prompt: 'Pry Open Frost Reliquary', model: 'ullr', height: 3.4, tint: [0.70, 0.82, 0.90], light: '#4cbaff', trim: '#cfefff', dormant: [0.25, 0.40, 0.55] },
    pele: { theme: 'Magma', prompt: 'Pry Open Magma Reliquary', model: 'pele', height: 3.4, tint: [0.90, 0.38, 0.12], light: '#ff5a14', trim: '#ff6a2a', dormant: [0.55, 0.12, 0.0] },
    sekhmet: { theme: 'Sun-Gold', prompt: 'Pry Open Sun-Gold Reliquary', model: 'sekhmet', height: 3.5, tint: [0.95, 0.75, 0.28], light: '#ffb347', trim: '#ffd27a', dormant: [0.45, 0.28, 0.08] },
  };
  const RISE = { height: 3.2, duration: 1.1, flash: 0.25, shake: 0.24 };
  const CLIPS = {
    ymir: { idle: 'idle', walk: 'walk', hit: 'hit_react', signature: 'Throne_of_Rime' },
    ullr: { idle: 'idle', walk: 'walk', hit: 'hit_react', signature: 'Heart_Crystal_Volley' },
    pele: { idle: 'idle', walk: 'walk', hit: 'hit_react', signature: 'Lava_Vortex' },
    sekhmet: { idle: 'idle', walk: 'walk', hit: 'hit_react', signature: 'Sun_Wrath_Feast' },
  };
  // Name-only teasers for gods arriving in the full game (Misty, Nov 25: no images, no realm).
  const COMING = ['Ignis', 'Vaelen', 'Nyxara', 'Kaelor'];

  // ------------------------------------------------------------------ save (localStorage, separate from the bundle's save)
  const SKEY = 'tvVoidMarket', GKEY = 'tvPermSigs';
  const load = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || '{}') || {}); } catch (_) { return d; } };
  const S = load(SKEY, { shards: 0, earned: 0, levels: {}, equipped: {} });
  const saveShop = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (_) {} };
  const permSigs = () => { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch (_) { return []; } };

  // ------------------------------------------------------------------ shop rules (Godot shop.gd)
  const level = (id) => S.levels[id] | 0;
  const owned = (id) => { const d = ITEMS[id]; return d.kind === 'upgrade' ? level(id) > 0 : d.kind === 'weapon' ? (STARTER[d.slot] === id || id in S.levels) : id in S.levels; };
  const slotKey = (d) => d.kind === 'weapon' ? 'weapon_' + d.slot : d.slot;
  function equippedId(slot) {
    if (slot.startsWith('weapon_')) { const w = S.equipped[slot]; return w && owned(w) ? w : STARTER[slot.slice(7)]; }
    const g = S.equipped[slot]; return g && owned(g) ? g : '';
  }
  const isEquipped = (id) => ITEMS[id].kind !== 'upgrade' && equippedId(slotKey(ITEMS[id])) === id;
  const bestRealm = () => (FX() && FX().save.bestRealm) || 'none';
  const reached = (r) => REALMS.indexOf(bestRealm()) >= REALMS.indexOf(r);
  function lockReason(id) {
    const d = ITEMS[id];
    if (!reached(d.unlock)) return d.unlock;
    if (d.kind === 'upgrade' && d.gated > 0 && level(id) + 1 >= d.gated && level(id) < d.max && !reached(d.tierRealm)) return d.tierRealm;
    return '';
  }
  function nextCost(id) {
    const d = ITEMS[id], lv = level(id);
    if (d.kind === 'upgrade') return lv < d.max ? d.costs[lv] : -1;
    if (d.kind === 'weapon') return !owned(id) ? d.costs[0] : (lv < d.max ? WEAPON_LEVEL_COSTS[lv] : -1);
    return owned(id) ? -1 : d.costs[0];
  }
  function actionFor(id) {
    const d = ITEMS[id];
    if (lockReason(id)) return 'locked';
    if (d.kind === 'upgrade') return level(id) >= d.max ? 'maxed' : level(id) > 0 ? 'upgrade' : 'buy';
    if (d.kind === 'gear') return !owned(id) ? 'buy' : isEquipped(id) ? 'equipped' : 'equip';
    if (!owned(id)) return 'buy';
    if (!isEquipped(id)) return 'equip';
    return level(id) >= d.max ? 'maxed' : 'upgrade';
  }
  function buy(id) {
    const d = ITEMS[id];
    if (lockReason(id)) return 'locked';
    const cost = nextCost(id);
    if (cost < 0) return 'maxed';
    if (S.shards < cost) return 'funds';
    const was = owned(id);
    S.shards -= cost;
    if (d.kind === 'upgrade' || (d.kind === 'weapon' && was)) S.levels[id] = level(id) + 1;
    else { S.levels[id] = d.kind === 'weapon' ? 0 : 1; S.equipped[slotKey(d)] = id; }
    saveShop();
    return 'ok';
  }
  // The Druid carries his own ice hammer (no market weapons for him yet): neutral x1.0 stats (Godot shop.gd, EGC-11).
  const ICE_HAMMER = { id: 'ice_hammer', kind: 'weapon', slot: 'druid', name: 'Ice Hammer', dmg: 1, rate: 1, charge: 1, reach: 1, fx: {} };
  const weaponOf = (hero) => ITEMS[equippedId('weapon_' + hero)] || ICE_HAMMER;
  const weaponDamage = (hero) => { const w = weaponOf(hero); return w.dmg * (1 + WEAPON_LEVEL_DMG * level(w.id)); };
  function merge(into, fx, times) {
    for (const k in fx) {
      const v = +fx[k];
      if (MUL_KEYS.includes(k)) into[k] = (into[k] ?? 1) * Math.pow(v, times);
      else into[k] = (into[k] ?? 0) + v * times;
    }
  }
  function totalFx(hero) {
    const fx = {};
    for (const u of UPGRADE_IDS) if (level(u) > 0) merge(fx, ITEMS[u].fx, level(u));
    for (const s of ['armor', 'trinket']) { const g = equippedId(s); if (g) merge(fx, ITEMS[g].fx, 1); }
    const w = weaponOf(hero);
    merge(fx, w.fx, 1);
    merge(fx, { dmgMul: weaponDamage(hero), rateMul: w.rate, chargeMul: w.charge, reachMul: w.reach }, 1);
    if (w.ignite) fx.shopBurn = 1;
    return fx;
  }
  function fxSummary(fx) {
    const names = { maxHp: 'max HP', dmgMul: 'damage', speed: 'speed', stamina: 'stamina regen', takenMul: 'damage taken', dodgeCost: 'dodge cost', lifesteal: 'lifesteal', crit: 'crit chance', critMul: 'crit damage' };
    const parts = [];
    for (const k of ['maxHp', 'dmgMul', 'speed', 'crit', 'critMul', 'stamina', 'takenMul', 'dodgeCost', 'lifesteal']) {
      if (!(k in fx)) continue;
      const v = +fx[k];
      if (k === 'maxHp') parts.push(`+${Math.round(v)} ${names[k]}`);
      else if (MUL_KEYS.includes(k)) { const p = Math.round((v - 1) * 100); if (p) parts.push(`${p > 0 ? '+' : ''}${p}% ${names[k]}`); }
      else parts.push(`+${Math.round(v * 100)}% ${names[k]}`);
    }
    return parts.length ? parts.join(' · ') : 'No market bonuses yet';
  }
  const roman = (n) => ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'][Math.max(0, Math.min(6, n))];

  // Applies the market bundle to the live run (delta against what was applied before; Godot RunState.apply_shop).
  function applyShop() {
    const f = FX(); if (!f || !f.L.mods) return;
    const hero = f.hero() ? f.hero().hero : (f.save.lastHero || 'archer');
    const mods = f.L.mods, old = mods.__shop || {}, fx = totalFx(hero);
    for (const k of MUL_KEYS) {
      const o = old[k] ?? 1, n = fx[k] ?? 1;
      if (mods[k] === undefined) mods[k] = 1;
      if (o !== n && o !== 0) mods[k] = mods[k] / o * n;
    }
    for (const k in ADD_KEYS) {
      const p = ADD_KEYS[k], diff = (fx[k] ?? 0) - (old[k] ?? 0);
      if (diff) mods[p] = (mods[p] || 0) + diff;
    }
    const hpGain = Math.max(0, (fx.maxHp ?? 0) - (old.maxHp ?? 0));
    mods.__shop = fx;
    const h = f.hero();
    if (h && hpGain) h.hp = Math.min(f.maxHp(), h.hp + hpGain);
    hudShards();
  }

  // ------------------------------------------------------------------ shards
  function grant(n) {
    if (n <= 0) return;
    S.shards += n; S.earned += n; saveShop();
    try { FX().sfx.play('pickup'); } catch (_) {}
    hudShards(n);
  }

  // ------------------------------------------------------------------ HUD: shard counter + Shop button + signature line
  let shopBtn, shardEl, popEl, sigEl, godBtn, comingEl;
  function buildHud() {
    const box = document.createElement('div');
    box.id = 'vmHud';
    box.innerHTML = '<button id="vmShopBtn" type="button" aria-label="Open the Void Market">Shop · Tab</button>' +
      `<div id="vmShards">${ICON} ${S.shards}</div><div id="vmPop"></div>`;
    document.body.appendChild(box);
    shopBtn = $('vmShopBtn'); shardEl = $('vmShards'); popEl = $('vmPop');
    shopBtn.addEventListener('click', (e) => { e.preventDefault(); openShop(); });
    shopBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    sigEl = document.createElement('div'); sigEl.id = 'vmSig'; document.body.appendChild(sigEl);
    godBtn = document.createElement('div'); godBtn.id = 'vmGod'; godBtn.className = 'tc-btn'; godBtn.setAttribute('role', 'button'); godBtn.textContent = 'GOD';
    godBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); cast(); }, { passive: false });
    godBtn.addEventListener('click', (e) => { e.preventDefault(); cast(); });
    document.body.appendChild(godBtn);
    comingEl = document.createElement('div'); comingEl.id = 'vmComing';
    comingEl.innerHTML = '<h5>Coming</h5><ul>' + COMING.map((n) => `<li>${n}</li>`).join('') + '</ul>';
    comingEl.setAttribute('aria-label', 'Coming: ' + COMING.join(', '));
  }
  let popT = 0;
  function hudShards(delta) {
    if (!shardEl) return;
    shardEl.textContent = `${ICON} ${S.shards}`;
    if (delta > 0) {
      popEl.textContent = '+' + delta; popEl.classList.remove('on'); void popEl.offsetWidth; popEl.classList.add('on');
      shardEl.classList.remove('bump'); void shardEl.offsetWidth; shardEl.classList.add('bump');
      clearTimeout(popT); popT = setTimeout(() => popEl.classList.remove('on'), 1200);
    }
    if (shop && shop.classList.contains('show')) $('vmBal').textContent = `${ICON} ${S.shards}`;
  }
  function hudVisible() {
    const f = FX(); if (!f) return false;
    return f.L.state === 'play' && !$('hud').classList.contains('hidden') && !f.L.cine;
  }

  // ------------------------------------------------------------------ Void Market screen (Godot shop_panel.gd)
  let shop = null, tab = 0, selected = '', heroKey = 'archer', statusT = 0;
  function buildShop() {
    shop = document.createElement('div');
    shop.id = 'vmShop';
    shop.className = 'screen';
    shop.innerHTML =
      '<div class="vmBg"></div>' +
      '<div class="vmLeft vmDock"><h2>VOID MARKET</h2><div id="vmHero"></div>' +
      '<div class="vmTabs">' + TAB_TITLES.map((t, i) => `<button type="button" data-tab="${i}">${i + 1}  ${t}</button>`).join('') + '</div>' +
      '<div class="vmHint">Q / E · LB / RB  ·  1-3</div><div id="vmBonus"></div><div id="vmGrid"></div></div>' +
      '<div class="vmBottom vmDock"><div class="vmBarkRow"><div id="vmBark"></div><div id="vmBal"></div></div><div id="vmStatus"></div>' +
      '<div class="vmHint">Enter / A: buy · upgrade · equip    Esc / B: leave</div></div>' +
      '<div class="vmInspect vmDock"><div class="vmIHead"><span id="vmIIcon"></span><div><div id="vmIName"></div><div id="vmITag"></div></div></div>' +
      '<div id="vmIDesc"></div><div id="vmIDelta"></div><div id="vmIPips"></div>' +
      '<button type="button" id="vmBuy">Buy</button><button type="button" id="vmLeave">Leave the market</button></div>';
    document.body.appendChild(shop);
    shop.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(+b.dataset.tab)));
    $('vmBuy').addEventListener('click', () => press(selected));
    $('vmLeave').addEventListener('click', closeShop);
  }
  const tabItems = (t) => t === 0 ? UPGRADE_IDS : t === 1 ? Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'weapon' && ITEMS[k].slot === heroKey) : GEAR_IDS;
  const rarity = (d) => d.unlock === 'Void Draw' ? 'LEGENDARY' : d.unlock === 'Inferno' ? 'RARE' : (d.kind !== 'upgrade' && STARTER[d.slot] !== d.id && d.unlock === 'none') ? 'UNCOMMON' : 'COMMON';
  const rarityCol = (d) => ({ LEGENDARY: '#ffc747', RARE: '#ff8033', UNCOMMON: '#b873ff' })[rarity(d)] || '#9ea8bd';
  function tagFor(d) {
    if (d.kind === 'gear') return (isEquipped(d.id) ? '✓ ' : '') + d.slot.toUpperCase();
    if (d.kind === 'weapon') return isEquipped(d.id) ? 'EQUIPPED' : owned(d.id) ? 'OWNED' : 'WEAPON';
    return level(d.id) > 0 ? 'TIER ' + roman(level(d.id)) : 'UPGRADE';
  }
  function cardState(id, a) {
    if (['buy', 'upgrade'].includes(a)) return `${ICON} ${nextCost(id)}`;
    return { locked: 'LOCKED', maxed: 'MAXED', equipped: 'EQUIPPED', equip: 'OWNED' }[a] || '';
  }
  function actionText(d, a) {
    const cost = `${ICON} ${nextCost(d.id)}`;
    switch (a) {
      case 'buy': return 'BUY  ·  ' + cost;
      case 'upgrade': return `UPGRADE ${d.kind === 'upgrade' ? roman(level(d.id) + 1) : 'Lv ' + (level(d.id) + 1)}  ·  ${cost}`;
      case 'equip': return 'EQUIP';
      case 'equipped': return 'TAKE OFF';
      case 'maxed': return 'MAXED';
      case 'locked': return 'LOCKED  ·  REACH ' + lockReason(d.id).toUpperCase();
    }
    return '';
  }
  function weaponDelta(d) {
    const parts = [], lv = owned(d.id) ? level(d.id) : 0, dmg = d.dmg * (1 + WEAPON_LEVEL_DMG * lv);
    parts.push(`Damage x${dmg.toFixed(2)}`);
    const cur = weaponOf(heroKey);
    if (cur.id !== d.id) { const p = Math.round((dmg / weaponDamage(heroKey) - 1) * 100); if (p) parts.push(`${p > 0 ? '+' : ''}${p}% vs ${cur.name}`); }
    const r = Math.round((1 - d.rate) * 100); if (r) parts.push(`${r > 0 ? '+' : ''}${r}% fire rate`);
    const c = Math.round((1 - d.charge) * 100); if (c) parts.push(`${c > 0 ? '+' : ''}${c}% charge speed`);
    const re = Math.round((d.reach - 1) * 100); if (re) parts.push(`${re > 0 ? '+' : ''}${re}% reach`);
    if (d.ignite) parts.push('Hits ignite (8 dmg/s)');
    const ex = fxSummary(d.fx); if (ex !== 'No market bonuses yet') parts.push(ex);
    return parts.join('  ·  ');
  }
  function statDelta(d) {
    if (d.kind === 'upgrade') return level(d.id) >= d.max ? 'All tiers owned.' : `Tier ${roman(level(d.id) + 1)}: ${fxSummary(d.fx)}`;
    if (d.kind === 'gear') { const t = fxSummary(d.fx), cur = equippedId(d.slot); return cur === d.id ? 'Equipped  ·  ' + t : cur ? `${t}  ·  replaces ${ITEMS[cur].name}` : t; }
    return weaponDelta(d);
  }
  const pips = (d) => { const n = d.kind === 'gear' ? (owned(d.id) ? 1 : 0) : level(d.id); return d.kind === 'gear' ? (isEquipped(d.id) ? 'EQUIPPED' : owned(d.id) ? 'OWNED' : '') : '■'.repeat(n) + '□'.repeat(d.max - n) + `  Lv ${n} / ${d.max}`; };
  function bark(t) { $('vmBark').textContent = `“${t}”`; }
  function status(t, col) { const s = $('vmStatus'); s.textContent = t; s.style.color = col || ''; }
  function renderGrid(focusId) {
    const g = $('vmGrid'); g.innerHTML = '';
    for (const id of tabItems(tab)) {
      const d = ITEMS[id], a = actionFor(id);
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'vmCard' + (a === 'locked' ? ' locked' : '') + (isEquipped(id) ? ' eq' : '') + (id === selected ? ' sel' : '');
      c.dataset.id = id; c.style.setProperty('--ac', d.col);
      c.innerHTML = `<span class="ic">${d.ic}</span><span class="nm">${d.name.toUpperCase()}</span><span class="st">${cardState(id, a)}</span>`;
      c.addEventListener('click', () => { inspect(id, true); });
      c.addEventListener('dblclick', () => press(id));
      c.addEventListener('mouseenter', () => { try { FX().sfx.play('hover'); } catch (_) {} });
      g.appendChild(c);
    }
    const w = weaponOf(heroKey);
    $('vmBonus').textContent = `Weapon: ${w.name} (Lv ${level(w.id)}, x${weaponDamage(heroKey).toFixed(2)} damage)   ·   ${fxSummary(totalFx(heroKey))}`;
    $('vmBal').textContent = `${ICON} ${S.shards}`;
    shop.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', +b.dataset.tab === tab));
    if (focusId) inspect(focusId, false);
  }
  function inspect(id, sayOpen) {
    selected = id;
    const d = ITEMS[id], a = actionFor(id);
    $('vmIIcon').textContent = d.ic; $('vmIIcon').style.color = d.col;
    $('vmIName').textContent = d.name.toUpperCase();
    const tg = $('vmITag'); tg.textContent = `${rarity(d)}  ·  ${tagFor(d)}`; tg.style.color = rarityCol(d);
    $('vmIDesc').textContent = d.desc; $('vmIDelta').textContent = statDelta(d); $('vmIPips').textContent = pips(d);
    const b = $('vmBuy'); b.textContent = actionText(d, a); b.className = 'a-' + a;
    if (sayOpen) bark(BARK.open);
    shop.querySelectorAll('.vmCard').forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
  }
  function selectTab(i) { tab = (i + 3) % 3; selected = tabItems(tab)[0]; renderGrid(selected); try { FX().sfx.play('hover'); } catch (_) {} }
  function press(id) {
    if (!id) return;
    const d = ITEMS[id], a = actionFor(id), sfx = (n) => { try { FX().sfx.play(n); } catch (_) {} };
    if (a === 'buy' || a === 'upgrade') {
      const cost = nextCost(id), r = buy(id);
      if (r === 'ok') {
        const lv = d.kind === 'upgrade' ? ' ' + roman(level(id)) : '';
        status(`${a === 'buy' ? 'Bought' : 'Upgraded'} ${d.name}${lv}  ·  -${ICON} ${cost}`, '#d7b8ff');
        bark(BARK.buy); sfx('pickup'); sfx('magic'); flashCard(id);
      } else if (r === 'funds') { status(`Not enough ${CURRENCY}: ${d.name} needs ${ICON} ${cost}, you have ${S.shards}.`, '#ff5966'); sfx('hurt'); }
    } else if (a === 'equip') { S.equipped[slotKey(d)] = id; saveShop(); status('Equipped ' + d.name, '#ffd36b'); sfx('pickup'); }
    else if (a === 'equipped') { if (d.kind === 'gear') { delete S.equipped[d.slot]; saveShop(); status('Took off ' + d.name, '#c0c0c8'); sfx('click'); } }
    else if (a === 'maxed') status(`${d.name} is at its highest level.`, '#c0c0c8');
    else if (a === 'locked') { status(`Reach ${lockReason(id)} to unlock ${d.name}.`, '#c0c0c8'); sfx('click'); }
    applyShop(); renderGrid(id);
  }
  function flashCard(id) { const c = shop.querySelector(`.vmCard[data-id="${id}"]`); if (c) { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 350); } }
  function canOpen() {
    const f = FX(); if (!f) return false;
    const h = f.hero();
    if (f.L.state !== 'play' || !h || !h.alive || f.L.cine || f.L.paused) return false;
    if (shop.classList.contains('show')) return false;
    for (const id of ['pick', 'pause', 'gameover', 'win']) if ($(id) && $(id).classList.contains('show')) return false;
    return true;
  }
  function openShop() {
    if (!canOpen()) return false;
    const f = FX();
    heroKey = f.hero().hero;
    f.L.paused = true; f.L.__market = true;
    const h = HERO[heroKey] || HERO.archer;
    $('vmHero').textContent = `${h[0].toUpperCase()} · ${h[1].toUpperCase()}`;
    status(`Spend ${CURRENCY} earned from kills, crates and bosses. Everything you buy is kept for good.`);
    shop.classList.add('show'); document.body.classList.add('vm-open');
    try { f.sfx.play('click'); } catch (_) {}
    selectTab(0); bark(BARK.greet);
    TVx.marketVisits++;
    return true;
  }
  function closeShop() {
    if (!shop.classList.contains('show')) return;
    shop.classList.remove('show'); document.body.classList.remove('vm-open');
    const f = FX(); if (f && f.L.__market) { f.L.__market = false; f.L.paused = false; }
    try { f.sfx.play('click'); } catch (_) {}
  }
  function moveSel(dx, dy) {
    const ids = tabItems(tab); let i = Math.max(0, ids.indexOf(selected));
    i = Math.max(0, Math.min(ids.length - 1, i + dx + dy * 2));
    inspect(ids[i], false);
  }

  // ------------------------------------------------------------------ input (capture phase so the bundle never sees market keys)
  addEventListener('keydown', (e) => {
    if (shop && shop.classList.contains('show')) {
      const k = e.code;
      if (k === 'Escape' || k === 'Tab' || k === 'KeyB') closeShop();
      else if (k === 'KeyQ') selectTab(tab - 1);
      else if (k === 'KeyE') selectTab(tab + 1);
      else if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') selectTab(+k.slice(5) - 1);
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') press(selected);
      else if (k === 'ArrowLeft' || k === 'KeyA') moveSel(-1, 0);
      else if (k === 'ArrowRight' || k === 'KeyD') moveSel(1, 0);
      else if (k === 'ArrowUp' || k === 'KeyW') moveSel(0, -1);
      else if (k === 'ArrowDown' || k === 'KeyS') moveSel(0, 1);
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
    if (e.code === 'Tab') {
      const f = FX();
      if (f && f.L.state === 'play') { e.preventDefault(); e.stopImmediatePropagation(); openShop(); }
      return;
    }
    if (e.code === 'KeyF' && !e.repeat) { const f = FX(); if (f && f.L.state === 'play' && !f.L.paused && !f.L.cine) cast(); }
    if (e.code === 'KeyG' && !e.repeat) { const f = FX(); if (f && f.L.state === 'play' && !f.L.paused && !f.L.cine) cycle(); }
  }, true);

  // Gamepad: D-pad Down opens the market; in the market D-pad moves, A buys, B leaves, LB / RB switch tabs.
  // In play, LB casts the signature power and D-pad Up switches powers (Godot input_setup.gd).
  const padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const prev = padPrev[p.index] || [];
      const down = (i) => p.buttons[i] && p.buttons[i].pressed && !prev[i];
      const open = shop && shop.classList.contains('show');
      if (open) {
        if (down(1)) closeShop();
        if (down(0)) press(selected);
        if (down(4)) selectTab(tab - 1);
        if (down(5)) selectTab(tab + 1);
        if (down(14)) moveSel(-1, 0);
        if (down(15)) moveSel(1, 0);
        if (down(12)) moveSel(0, -1);
        if (down(13)) moveSel(0, 1);
      } else {
        if (down(13)) openShop();
        const f = FX();
        if (f && f.L.state === 'play' && !f.L.paused && !f.L.cine) { if (down(4)) cast(); if (down(12)) cycle(); if (down(3) && window.TVdbg) TVdbg.inp().wt(); }
      }
      padPrev[p.index] = p.buttons.map((b) => b.pressed);
    }
  }

  // ------------------------------------------------------------------ frost atmosphere (Godot frost_atmosphere.gd)
  const ATMO = {
    // Godot: frost rim (0.22,0.78,1.0) idle, surge (0.55,0.92,1.0) x1.25 in combat. Web keeps its 1.2 rim
    // intensity as the base (the v9.11.4 ice floor is tuned for it) and applies the same x1.25.
    normalRim: [0.22, 0.78, 1.0], surgeRim: [0.55, 0.92, 1.0], combatLightMul: 1.25, frostRimBase: 0.6,
    idleRate: 120, combatRate: 260,
    // Godot glow 0.52 (+0.36 on hit) and vignette 0.28 (+0.14). Same ratios on the web's own bloom (0.6)
    // and vignette (1.0); the bloom threshold stays at 0.88 so the ice floor is never pushed into bloom.
    hitGlowRatio: 0.36 / 0.52, hitVigRatio: 0.14 / 0.28,
    contrast: 1.12, saturation: 1.10, idleSeconds: 3.5,
  };
  const A = { combat: false, idle: 0, flashLeft: 0, flashOn: false, baseBloom: null, baseRimI: null, realm: null, rimBase: null, flashes: 0, maxVis: 0 };
  function setCombat(on) {
    A.combat = on; A.idle = on ? ATMO.idleSeconds : 0;
    applyLight(); applySnow();
  }
  function applyLight() {
    const f = FX(); if (!f) return;
    if (A.baseRimI === null) A.baseRimI = f.rim.intensity;
    if (f.L.realmKey === 'frost') { const c = A.combat ? ATMO.surgeRim : ATMO.normalRim; f.rim.color.setRGB(c[0], c[1], c[2], 'srgb'); }
    else if (A.rimBase !== null) f.rim.color.set(A.rimBase);
    // Frost uses its own lower base (Godot did the same: 0.75 instead of Unity's 2.2) so the x1.25 combat surge
    // lands back on the v9.11.4 rim (1.2) and the ice floor does not wash out. Other realms keep their base.
    const base = f.L.realmKey === 'frost' ? A.baseRimI * ATMO.frostRimBase : A.baseRimI;
    f.rim.intensity = base * (A.combat ? ATMO.combatLightMul : 1);
  }
  function snowCount(rate) { const n = FX().snowN; return Math.max(Math.round(n * 0.27), Math.min(n, Math.round(n * rate / ATMO.combatRate))); }
  function applySnow() { const f = FX(); if (!f) return; f.snowGeo.setDrawRange(0, snowCount(A.combat ? ATMO.combatRate : ATMO.idleRate)); }
  function applyFlash(hit) {
    const f = FX(); if (!f) return;
    if (A.baseBloom === null) A.baseBloom = f.bloom.strength;
    f.bloom.strength = A.baseBloom * (1 + (hit ? ATMO.hitGlowRatio : 0));
    f.post.uniforms.vig.value = Math.min(1.3, 1 + (hit ? ATMO.hitVigRatio : 0));
  }
  function flash(dur = 0.12) { applyFlash(true); A.flashLeft = Math.max(0, dur); A.flashOn = true; A.flashes++; A.lastFlash = dur; if (A.flashLeft <= 0) restoreFlash(); }
  function restoreFlash() { A.flashOn = false; A.flashLeft = 0; applyFlash(false); }
  function atmoRealm() {
    const f = FX(); const r = f.L.realmKey;
    if (r === A.realm) return;
    A.realm = r; A.rimBase = f.realm[r] ? f.realm[r].rim : null;
    const u = f.post.uniforms;
    if (u.con) { u.con.value = r === 'frost' ? ATMO.contrast : 1; u.sat.value = r === 'frost' ? ATMO.saturation : 1; }
    applyLight(); applySnow();
  }
  function atmoTick(real, scaled) {
    const f = FX();
    atmoRealm();
    if (A.flashOn) { A.flashLeft -= real; if (A.flashLeft <= 0) restoreFlash(); }
    if (f.L.paused) return;
    const playing = f.L.state === 'play';
    const hostile = playing && f.live().length > 0;
    if (hostile) { if (!A.combat) setCombat(true); else A.idle = ATMO.idleSeconds; return; }
    if (A.combat) { A.idle -= scaled; if (A.idle <= 0) setCombat(false); }
  }

  // ------------------------------------------------------------------ signature powers (simplified Godot god_powers.gd)
  const P = { owned: [], selected: '', cd: {}, shield: 0, shieldT: 0, zones: [], sig: false, casts: 0 };
  function grantSig(gid) {
    if (!GODS[gid]) return;
    if (!P.owned.includes(gid)) P.owned.push(gid);
    P.selected = gid;
    if (GODS[gid].forever) { const s = permSigs(); if (!s.includes(gid)) { s.push(gid); try { localStorage.setItem(GKEY, JSON.stringify(s)); } catch (_) {} } }
  }
  function cycle() { if (P.owned.length > 1) { P.selected = P.owned[(P.owned.indexOf(P.selected) + 1) % P.owned.length]; } }
  function aimDir() {
    const f = FX(), h = f.hero(), T = f.T;
    return new T.V3(Math.sin(h.facing || h.root.rotation.y), 0, Math.cos(h.facing || h.root.rotation.y)).normalize();
  }
  const dmgScale = () => FX().L.mods.dmgMul || 1;
  function sigHit(e, dmg, dir) { P.sig = true; try { FX().hit(e, dmg, dir, true); } finally { P.sig = false; } }
  function ring(pos, radius, col, life, filled) {
    const f = FX(), T = f.T;
    const geo = filled ? new T.Circle(radius, 48) : new T.Ring(radius * 0.86, radius, 48);
    const m = new T.Mesh(geo, new T.Basic({ color: new T.Color(col).multiplyScalar(3), transparent: true, opacity: 0.8, depthWrite: false, side: 2, blending: 2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.08, pos.z); f.scene.add(m);
    P.zones.push({ fx: m, left: life, total: life });
    return m;
  }
  function cast() {
    const f = FX(); const gid = P.selected; const h = f && f.hero();
    if (!gid || !h || !h.alive || (P.cd[gid] || 0) > 0) return false;
    const g = GODS[gid], m = g.m, pos = h.root.position.clone(), dir = aimDir(), T = f.T;
    P.cd[gid] = g.cd; P.casts++;
    showCastGod(gid);
    f.burst.emit(pos.clone().setY(1), new T.Color(g.glow).getHex(), 60, 8, 0.7, 3);
    try { f.sfx.play('magic'); } catch (_) {}
    if (g.kind === 'nova') {
      for (const e of f.live()) {
        const off = e.root.position.clone().sub(pos); off.y = 0;
        if (off.length() <= m.radius + (e.radius || 0.5)) {
          sigHit(e, m.damage * dmgScale(), off.lengthSq() > 0.01 ? off.normalize() : dir);
          if (e.alive && !e.isBoss) { e.state = 'hurt'; e.t = m.freeze; }
        }
      }
      P.shield = m.shield; P.shieldT = m.shield_time;
      ring(pos, m.radius, g.glow, 0.6, false);
      try { f.sfx.play('shatter'); } catch (_) {}
    } else if (g.kind === 'volley') {
      for (let i = 0; i < m.shots; i++) {
        const a = m.shots === 1 ? 0 : -m.spread / 2 + m.spread * i / (m.shots - 1);
        const d = dir.clone().applyAxisAngle(new T.V3(0, 1, 0), a);
        f.arrow(pos.clone().setY(1.3).addScaledVector(d, 0.6), d, m.damage * dmgScale(), true);
      }
      try { f.sfx.play('release', 2); } catch (_) {}
      P.sigUntil = performance.now() + 900;
    } else if (g.kind === 'eruption') {
      const c = pos.clone().addScaledVector(dir, m.distance); c.y = 0;
      for (const e of f.live()) {
        const off = e.root.position.clone().sub(c); off.y = 0;
        if (off.length() <= m.radius + (e.radius || 0.5)) { sigHit(e, m.damage * dmgScale(), off.lengthSq() > 0.01 ? off.normalize() : dir); e.burn = m.ignite; }
      }
      const z = ring(c, m.radius, g.glow, m.zone_time, true);
      P.zones.push({ kind: 'eruption', pos: c, m, left: m.zone_time, tick: 0, glow: g.glow, mesh: z });
      f.burst.emit(c.clone().setY(1), new T.Color(g.glow).getHex(), 90, 11, 0.8, 4);
      f.shake(0.5);
    } else if (g.kind === 'beam') {
      const T3 = f.T, len = m.length;
      const geo = new T3.Cyl(m.width / 2, m.width / 2, len, 12).rotateX(Math.PI / 2);
      const mesh = new T3.Mesh(geo, new T3.Basic({ color: new T3.Color(g.glow).multiplyScalar(4), transparent: true, opacity: 0.75, depthWrite: false, blending: 2 }));
      mesh.position.copy(pos.clone().setY(2.2).addScaledVector(dir, len / 2)); mesh.rotation.y = Math.atan2(dir.x, dir.z);
      f.scene.add(mesh);
      P.zones.push({ kind: 'beam', pos, dir, m, left: m.beam_time, tick: 0, fx: mesh, total: m.beam_time });
    }
    return true;
  }
  function powersTick(dt) {
    const f = FX();
    for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
    if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) P.shield = 0; }
    const keep = [];
    for (const z of P.zones) {
      z.left -= dt;
      if (z.kind === 'eruption' || z.kind === 'beam') {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.25;
          for (const e of f.live()) {
            if (z.kind === 'eruption') {
              const off = e.root.position.clone().sub(z.pos); off.y = 0;
              if (off.length() <= z.m.radius + (e.radius || 0.5)) { sigHit(e, z.m.dps * 0.25 * dmgScale(), off.lengthSq() > 0.01 ? off.normalize() : z.pos.clone()); e.burn = z.m.ignite; }
            } else {
              const off = e.root.position.clone().sub(z.pos); off.y = 0;
              const along = off.dot(z.dir), side = Math.abs(off.x * z.dir.z - off.z * z.dir.x);
              if (along > 0 && along < z.m.length && side < z.m.width / 2 + (e.radius || 0.5)) {
                const d = z.m.dps * 0.25 * dmgScale(); sigHit(e, d, z.dir);
                const h = f.hero(); if (h) h.hp = Math.min(f.maxHp(), h.hp + d * z.m.heal_share);
              }
            }
          }
        }
      }
      if (z.fx && z.total) z.fx.material.opacity = 0.8 * Math.max(0, z.left / z.total);
      if (z.left > 0) keep.push(z); else if (z.fx) { f.scene.remove(z.fx); z.fx.geometry.dispose(); z.fx.material.dispose(); }
    }
    P.zones = keep;
  }
  function sigHud() {
    if (!sigEl) return;
    const show = hudVisible() && !!P.selected;
    sigEl.style.display = show ? 'block' : 'none';
    document.body.classList.toggle('vm-god', show);
    if (!show) return;
    const g = GODS[P.selected], cd = P.cd[P.selected] || 0;
    sigEl.style.color = g.glow;
    sigEl.textContent = `${g.name.toUpperCase()} · ${g.sig}  ${cd <= 0 ? 'READY  [F / LB / SWAP]' : Math.ceil(cd) + 's'}` + (P.shield > 0 ? `  ·  SHIELD ${Math.ceil(P.shield)}` : '');
  }

  // ------------------------------------------------------------------ reliquary emergence
  const E = { god: null, light: null, last: null, rig: null, castRig: null };
  function playRig(rig, name, once) {
    if (rig && name && rig.has && rig.has(name)) return rig.play(name, { once: !!once });
    return 0;
  }
  // TV3.model clones the GLB with an AnimationMixer (clips stay on the skinned root).
  function spawnGod(key, height) {
    if (!window.TV3 || !TV3.model) return null;
    const rig = TV3.model(key, 1);
    if (!rig || !rig.root) return null;
    if (TV3.Box3 && TV3.W) {
      const inner = rig.root.children[0] || rig.root;
      let box = new TV3.Box3().setFromObject(rig.root);
      const size = new TV3.W();
      box.getSize(size);
      const s = height / Math.max(size.y, 1e-3);
      inner.scale.multiplyScalar(s);
      box = new TV3.Box3().setFromObject(rig.root);
      const c = new TV3.W();
      box.getCenter(c);
      inner.position.x -= c.x;
      inner.position.y -= box.min.y;
      inner.position.z -= c.z;
    }
    return rig;
  }
  function tintModel(root, rgb, emissive, amount) {
    const f = FX();
    root.traverse((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      m.material = mats.length > 1 ? mats.map((q) => q.clone()) : mats[0].clone();
      for (const q of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!q.userData.__base) q.userData.__base = { c: q.color ? q.color.clone() : null, e: q.emissive ? q.emissive.clone() : null, ei: q.emissiveIntensity };
        const b = q.userData.__base;
        if (q.color && b.c) q.color.copy(b.c).multiply(new f.T.Color().setRGB(rgb[0], rgb[1], rgb[2], 'srgb'));
        if (q.emissive) { q.emissive.set(emissive); q.emissiveIntensity = amount; }
      }
    });
  }
  function emerge(crate, realm, gid) {
    const f = FX(), em = EMERGE[gid];
    return new Promise((done) => {
      if (!em || !window.TV3 || !TV3.idol) { if (window.TVart) TVart.reveal(crate, realm, gid); return done(); }
      // lid pried: flash 0.25, shake 0.24, combat atmosphere on (Godot essence_crate.gd _play_emerge_fx)
      flash(RISE.flash); f.shake(RISE.shake); setCombat(true);
      let rig = spawnGod(em.model, em.height), god = rig ? rig.root : null;
      if (!god) {
        const keepH = TV3.idolH; TV3.idolH = em.height;
        try { god = TV3.idol(em.model); } finally { TV3.idolH = keepH; }
      }
      if (!god) { if (window.TVart) TVart.reveal(crate, realm, gid); return done(); }
      const T = f.T, base = crate.root.position.clone();
      const from = base.clone().setY(-RISE.height), to = from.clone().setY(from.y + RISE.height);
      god.position.copy(from);
      const cam = f.hero() ? f.hero().root.position : new T.V3(0, 0, 10);
      god.rotation.y = Math.atan2(cam.x - base.x, cam.z - base.z);
      // dormant look: darkened toward the god's dormant colour, faint emission
      tintModel(god, em.dormant.map((v) => Math.min(1, v * 1.6)), new T.Color().setRGB(em.dormant[0], em.dormant[1], em.dormant[2], 'srgb'), 0.35);
      f.scene.add(god);
      const pl = new f.T.Color(em.light);
      E.god = god; E.rig = rig; E.last = { gid, model: em.model, from: from.y, to: to.y, awakened: false };
      playRig(rig, (CLIPS[gid] || {}).idle);
      const t0 = performance.now();
      (function step() {
        const k = Math.min(1, (performance.now() - t0) / (RISE.duration * 1000)), q = k * k * (3 - 2 * k);
        god.position.y = from.y + (to.y - from.y) * q;
        if (k < 1) return requestAnimationFrame(step);
        god.position.y = to.y;
        // awakened: palette glow + the existing totem reveal
        tintModel(god, em.tint, pl, 0.55);
        E.last.awakened = true; E.last.y = god.position.y;
        f.burst.emit(base.clone().setY(2), pl.getHex(), 120, 10, 0.9, 3);
        f.burst.emit(base.clone().setY(2), 0xffffff, 40, 8, 0.6, 3);
        if (window.TVart) TVart.reveal(crate, realm, gid);
        done();
      })();
    });
  }
  function showCastGod(gid) {
    const em = EMERGE[gid], f = FX();
    if (!em || !f || !f.hero()) return;
    if (E.castRig && E.castRig.root) { try { f.scene.remove(E.castRig.root); } catch (_) {} E.castRig = null; }
    const rig = spawnGod(em.model, em.height);
    if (!rig) return;
    const h = f.hero();
    rig.root.position.copy(h.root.position);
    rig.root.rotation.y = (h.facing != null) ? h.facing : h.root.rotation.y;
    tintModel(rig.root, em.tint, new f.T.Color(em.light), 0.55);
    f.scene.add(rig.root);
    const dur = playRig(rig, (CLIPS[gid] || {}).signature, true) || 1.6;
    E.castRig = rig;
    const t0 = performance.now();
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
      if (rig.mixer) rig.mixer.update(0.016);
      if (k < 1) return requestAnimationFrame(step);
      try { f.scene.remove(rig.root); } catch (_) {}
      if (E.castRig === rig) E.castRig = null;
    })();
  }
  // After the gift card: the full god sinks back down (Godot: recedes into its totem).
  function recede() {
    const g = E.god, rig = E.rig; if (!g) return; E.god = null; E.rig = null;
    const f = FX(), y0 = g.position.y, t0 = performance.now();
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / 700);
      if (rig && rig.mixer) rig.mixer.update(0.016);
      g.position.y = y0 - k * 4; g.scale.multiplyScalar(0.985);
      if (k < 1) requestAnimationFrame(step); else f.scene.remove(g);
    })();
  }

  // ------------------------------------------------------------------ public hooks used by the patched bundle
  const TVx = window.TVx = {
    version: '9.12.0', items: ITEMS, emergeState: E, gods: GODS, coming: COMING, clips: CLIPS, state: S, atmo: A, atmoCfg: ATMO, powers: P, marketVisits: 0,
    open: openShop, close: closeShop, isOpen: () => !!(shop && shop.classList.contains('show')), buy, press, applyShop, grant, cast, flash,
    // Enemy took a player hit (bundle Xe). Returns [damage, heavy]. Crits: base 0%, x1.5, + market bonuses.
    onHit(e, t, heavy) {
      if (e.isBoss && e.invuln > 0) return [t, heavy];
      const mods = FX().L.mods || {};
      const chance = mods.crit || 0;
      let crit = false;
      if (chance > 0 && Math.random() < chance) { t *= 1.5 + (mods.critMul || 0); crit = true; }
      const sig = P.sig || (P.sigUntil && performance.now() < P.sigUntil && heavy);
      flash(sig ? 0.14 : (heavy || crit) ? 0.12 * 1.4 : 0.12);
      return [t, heavy || crit];
    },
    absorb(d) { if (P.shield > 0) { const a = Math.min(P.shield, d); P.shield -= a; return d - a; } return d; },
    onKill(e) {
      const f = FX(); if (!f || f.L.state !== 'play') return;
      if (e.isBoss) grant(e.def && e.def.fused ? REWARD.fusion : REWARD.boss);
      else grant(e.def && e.def.elite ? REWARD.elite : REWARD.kill);
    },
    runStart() {
      const f = FX();
      if (f.L.mods) delete f.L.mods.__shop;
      P.owned = []; P.selected = ''; P.cd = {}; P.shield = 0; P.zones.forEach((z) => z.fx && f.scene.remove(z.fx)); P.zones = [];
      for (const gid of permSigs()) if (GODS[gid]) { P.owned.push(gid); P.selected = gid; }
      applyShop();
      const h = f.hero(); if (h) h.hp = f.maxHp();
      setCombat(false); restoreFlash();
    },
    // Crate reveal: the god is free. Banner text and grant order follow Godot RunDirector._god_release.
    godFree(gid) {
      const g = GODS[gid]; if (!g) return;
      grantSig(gid);
      const bt = `${g.name.toUpperCase()} IS FREE`, bs = `Signature power: ${g.sig} · ${g.forever ? 'Forever' : 'This run'}`;
      FX().banner(bt, bs, g.glow); TVx.lastBanner = { t: bt, s: bs, god: gid };
      flash(0.14);
    },
    sigLine(gid) { const g = GODS[gid]; return g ? `\nSignature power: ${g.sig} · ${(g.forever ? 'Forever' : 'This run').toUpperCase()}` : ''; },
    sigDesc(gid) { const g = GODS[gid]; return g ? ` · ${g.sig} (${g.forever ? 'Forever' : 'This run'}): ${g.desc}` : ''; },
    showComing(on) {
      const pick = $('pick'); if (!pick || !comingEl) return;
      if (on) pick.appendChild(comingEl); else comingEl.remove();
    },
    crateClaimed() { grant(REWARD.crate); recede(); },
    emergeCfg: EMERGE,
    // Same pick the bundle makes when the lid opens (bias, then not-the-last-god), made early with no side effects.
    preRoll(realm, pool, L) {
      let p = pool.filter((x) => x.realm === realm); if (!p.length) p = pool;
      let o = p.filter((x) => x.id === L.godBias);
      if (!o.length) { o = p.filter((x) => x.id !== L.lastGod); if (!o.length) o = p; }
      return o[Math.floor(Math.random() * o.length)];
    },
    pryLabel(g) { return EMERGE[g.id] ? EMERGE[g.id].prompt : 'Open the strongbox'; },
    crateTheme(crate, light, g) {
      const em = g && EMERGE[g.id]; if (!em) return;
      try { light.color.set(em.light); } catch (_) {}
      crate.__emerge = em;
    },
    emerge,
    tick(real, scaled) {
      if (!FX()) return;
      try { atmoTick(real, scaled); } catch (err) { console.warn('[TVx atmo]', err); }
      const f = FX();
      if (E.rig && E.rig.mixer) E.rig.mixer.update(scaled);
      if (E.castRig && E.castRig.mixer) E.castRig.mixer.update(scaled);
      if (!f.L.paused && f.L.state === 'play') powersTick(scaled);
      pollPad();
      const vis = hudVisible();
      document.body.classList.toggle('vm-play', vis);
      sigHud();
    },
  };
  function boot() {
    if (!window.TVfx || !document.body) return setTimeout(boot, 30);
    buildHud(); buildShop();
    applySnow(); applyFlash(false);
  }
  boot();
})();

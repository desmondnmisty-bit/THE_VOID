// Dark Logic Studios — The Void web v9.12.1. Varga's visible dual daggers.
// Matches Godot VargaDaggerController: primitive blade/guard/grip on orc.glb
// hand.L and hand.R, with the baked skin daggers collapsed on Varga only.
// The Druid's kit and orc.glb cache are left untouched.
(() => {
  const FX = () => window.TVfx;
  const CFG = {
    length: 0.26, bladeWidth: 0.032, bladeThick: 0.009, guardWidth: 0.074, gripRadius: 0.013,
    left: { bone: 'handL', names: ['handL', 'hand.L'], offset: [0, 0.07, 0], rot: [0, 0, 0] },
    right: { bone: 'handR', names: ['handR', 'hand.R'], offset: [0, 0.07, 0], rot: [0, 0, 0] },
    handRadius: 0.07, handLength: 0.115, weightMin: 0.25,
  };
  const STATS = { count: 0, bakedHidden: 0 };

  function findBone(root, names) {
    const want = Array.isArray(names) ? names : [names];
    let found = null;
    root.traverse((o) => { if (!found && o.isBone && want.includes(o.name)) found = o; });
    if (found) return found;
    root.traverse((o) => { if (!found && want.includes(o.name)) found = o; });
    return found;
  }

  function standardMat(h, T) {
    let Std = (window.TV3 && window.TV3.lo) || null;
    if (!Std) h.root.traverse((o) => { if (!Std && o.isMesh && o.material && o.material.isMeshStandardMaterial) Std = o.material.constructor; });
    return Std || T.Basic;
  }

  function makeDagger(T, Mat) {
    const root = new T.Mesh(new T.Cyl(0.001, 0.001, 0.001, 3), new T.Basic({ visible: false }));
    root.name = 'Dagger';
    root.castShadow = false;
    const length = Math.max(CFG.length, 0.08);
    const gripLen = length * 0.28;
    const guardH = length * 0.045;
    const bladeLen = length - gripLen - guardH;
    const tipLen = bladeLen * 0.22;
    const bodyLen = bladeLen - tipLen;
    const steel = new Mat({ color: 0x292e35, metalness: 0.88, roughness: 0.28 });
    const gripM = new Mat({ color: 0x121012, metalness: 0.18, roughness: 0.78 });
    const voidM = new Mat({ color: 0x14081f, metalness: 0.55, roughness: 0.35, emissive: 0x6b1ab8, emissiveIntensity: 0.7 });
    const grip = new T.Mesh(new T.Cyl(CFG.gripRadius * 0.92, CFG.gripRadius, gripLen, 12), gripM);
    grip.name = 'Grip'; grip.castShadow = true; root.add(grip);
    const pommel = new T.Mesh(new T.Cyl(CFG.gripRadius * 1.15, CFG.gripRadius * 1.15, CFG.gripRadius * 1.4, 12), steel);
    pommel.name = 'Pommel'; pommel.position.y = -gripLen * 0.5; root.add(pommel);
    const guard = new T.Mesh(new T.Cyl(CFG.bladeThick * 1.2, CFG.bladeThick * 1.2, CFG.guardWidth, 8), steel);
    guard.name = 'Guard'; guard.rotation.z = Math.PI / 2; guard.position.y = gripLen * 0.5 + guardH * 0.5; root.add(guard);
    const blade = new T.Mesh(new T.Cyl(CFG.bladeWidth * 0.5, CFG.bladeWidth * 0.42, bodyLen, 8), steel);
    blade.name = 'Blade'; blade.position.y = gripLen * 0.5 + guardH + bodyLen * 0.5; blade.castShadow = true; root.add(blade);
    const tip = new T.Mesh(new T.Cyl(CFG.bladeWidth * 0.42, 0.0015, tipLen, 8), steel);
    tip.name = 'Tip'; tip.position.y = gripLen * 0.5 + guardH + bodyLen + tipLen * 0.5; tip.castShadow = true; root.add(tip);
    const accent = new T.Mesh(new T.Cyl(CFG.bladeWidth * 0.08, CFG.bladeWidth * 0.07, bodyLen * 0.92, 6), voidM);
    accent.name = 'VoidAccent'; accent.position.y = blade.position.y; accent.castShadow = false; root.add(accent);
    return root;
  }

  function bindOrigin(skel, boneIdx, T) {
    const inv = skel.boneInverses[boneIdx];
    const bind = inv.clone().invert();
    const origin = new T.V3().setFromMatrixPosition(bind);
    const axis = new T.V3().setFromMatrixColumn(bind, 1).normalize();
    return { origin, axis };
  }

  function outsideHand(v, rest) {
    const relx = v.x - rest.origin.x, rely = v.y - rest.origin.y, relz = v.z - rest.origin.z;
    const along = relx * rest.axis.x + rely * rest.axis.y + relz * rest.axis.z;
    if (along < -0.02) return false;
    const px = relx - rest.axis.x * along, py = rely - rest.axis.y * along, pz = relz - rest.axis.z * along;
    const perp = Math.sqrt(px * px + py * py + pz * pz);
    return along > CFG.handLength || perp > CFG.handRadius;
  }

  function palmPoint(v, rest) {
    const along = (v.x - rest.origin.x) * rest.axis.x + (v.y - rest.origin.y) * rest.axis.y + (v.z - rest.origin.z) * rest.axis.z;
    const t = Math.max(0, Math.min(CFG.handLength * 0.45, along));
    return { x: rest.origin.x + rest.axis.x * t, y: rest.origin.y + rest.axis.y * t, z: rest.origin.z + rest.axis.z * t };
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function collapseBaked(h, T) {
    let hidden = 0;
    h.root.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || !mesh.skeleton || !mesh.geometry) return;
      const skel = mesh.skeleton;
      const leftIdx = skel.bones.findIndex((b) => (CFG.left.names || [CFG.left.bone]).includes(b.name));
      const rightIdx = skel.bones.findIndex((b) => (CFG.right.names || [CFG.right.bone]).includes(b.name));
      if (leftIdx < 0 || rightIdx < 0) return;
      if (!mesh.geometry.userData.vargaDaggers) {
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.userData.vargaDaggers = true;
      }
      const geom = mesh.geometry;
      const pos = geom.attributes.position;
      const sIdx = geom.attributes.skinIndex;
      const sW = geom.attributes.skinWeight;
      if (!pos || !sIdx || !sW) return;
      const leftRest = bindOrigin(skel, leftIdx, T);
      const rightRest = bindOrigin(skel, rightIdx, T);
      const n = pos.count;
      const wL = new Float32Array(n), wR = new Float32Array(n);
      const hide = new Uint8Array(n);
      const verts = new Array(n);
      for (let i = 0; i < n; i++) {
        const v = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
        verts[i] = v;
        const bones = [sIdx.getX(i), sIdx.getY(i), sIdx.getZ(i), sIdx.getW(i)];
        const ws = [sW.getX(i), sW.getY(i), sW.getZ(i), sW.getW(i)];
        let wl = 0, wr = 0;
        for (let k = 0; k < 4; k++) { if (bones[k] === leftIdx) wl += ws[k]; else if (bones[k] === rightIdx) wr += ws[k]; }
        wL[i] = wl; wR[i] = wr;
        if (wl >= CFG.weightMin && outsideHand(v, leftRest)) hide[i] = 1;
        else if (wr >= CFG.weightMin && outsideHand(v, rightRest)) hide[i] = 1;
      }
      const index = geom.index ? Array.from(geom.index.array) : null;
      if (index) {
        const adj = Array.from({ length: n }, () => []);
        for (let t = 0; t + 2 < index.length; t += 3) {
          const a = index[t], b = index[t + 1], c = index[t + 2];
          adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
        }
        const q = [];
        for (let i = 0; i < n; i++) if (hide[i]) q.push(i);
        let qi = 0;
        while (qi < q.length) {
          const i = q[qi++];
          for (const nb of adj[i]) {
            if (hide[nb]) continue;
            const v = verts[nb];
            const dL = dist(v, leftRest.origin), dR = dist(v, rightRest.origin);
            if (Math.min(dL, dR) > 0.28) continue;
            const rest = dL <= dR ? leftRest : rightRest;
            if (!outsideHand(v, rest)) continue;
            if (wL[nb] + wR[nb] < 0.05 && Math.min(dL, dR) >= 0.22) continue;
            hide[nb] = 1; q.push(nb);
          }
        }
        let added = true;
        while (added) {
          added = false;
          for (let t = 0; t + 2 < index.length; t += 3) {
            const tri = [index[t], index[t + 1], index[t + 2]];
            for (let a = 0; a < 3; a++) {
              const i = tri[a], j = tri[(a + 1) % 3];
              if (!hide[i] === !hide[j]) continue;
              const kept = hide[i] ? j : i, hid = hide[i] ? i : j;
              if (dist(verts[kept], verts[hid]) < 0.08) continue;
              if (Math.min(dist(verts[kept], leftRest.origin), dist(verts[kept], rightRest.origin)) <= 0.32) {
                hide[kept] = 1; added = true;
              }
            }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        if (!hide[i]) continue;
        const rest = wL[i] >= wR[i] ? leftRest : rightRest;
        const p = palmPoint(verts[i], rest);
        pos.setXYZ(i, p.x, p.y, p.z);
        hidden++;
      }
      pos.needsUpdate = true;
    });
    return hidden;
  }

  function dressVarga(h) {
    const f = FX(); if (!f || !h || h.hero !== 'orc' || h.varga) return;
    const T = f.T;
    const Mat = standardMat(h, T);
    STATS.bakedHidden = collapseBaked(h, T);
    const leftBone = findBone(h.root, CFG.left.names || CFG.left.bone);
    const rightBone = findBone(h.root, CFG.right.names || CFG.right.bone);
    const attach = (bone, cfg, name) => {
      if (!bone) return null;
      const d = makeDagger(T, Mat);
      d.name = name;
      d.position.set(cfg.offset[0], cfg.offset[1], cfg.offset[2]);
      d.rotation.set(cfg.rot[0] * Math.PI / 180, cfg.rot[1] * Math.PI / 180, cfg.rot[2] * Math.PI / 180);
      bone.add(d);
      return d;
    };
    const left = attach(leftBone, CFG.left, 'VargaDagger_L');
    const right = attach(rightBone, CFG.right, 'VargaDagger_R');
    STATS.count = (left ? 1 : 0) + (right ? 1 : 0);
    if (STATS.count) h.varga = { left, right, leftBone, rightBone };
  }

  function boot() {
    const x = window.TVx;
    if (!window.TVfx || !x || !document.body) return setTimeout(boot, 30);
    const baseRun = x.runStart, baseTick = x.tick;
    Object.assign(x, {
      version: 'v9.12.1',
      runStart() { baseRun && baseRun.apply(x, arguments); const h = FX().hero(); if (h && h.hero === 'orc') dressVarga(h); },
      tick(r, s) {
        baseTick && baseTick.call(x, r, s);
        const h = FX().hero();
        if (h && h.hero === 'orc' && !h.varga) dressVarga(h);
      },
      dressVarga, vargaCfg: CFG, vargaStats: STATS,
    });
  }
  boot();
})();

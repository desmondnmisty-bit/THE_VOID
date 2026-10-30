// Dark Logic Studios — Misty's art layer (v3). Visual only: no gameplay, stats or collision changes.
(function(){
const B='./art/', cache={}, T3=()=>window.TV3;
const files=['floor_lava.jpg','floor_ice.jpg','floor_ice_outer.jpg','chest_lava_a.png','chest_lava_b.png','chest_lava_open.png','chest_ice.png',
 'b_lava_hammer.png','b_lava_pagoda.png','b_rune_pillar.png','b_lava_temple.png','b_ice_shrine.png','b_ice_citadel.png','b_ice_fortress.png','b_ice_pyramid_city.png',
 'minion_frost_a.png','minion_frost_b.png','minion_lava_a.png','minion_lava_b.png','scorpion_lava_a.png','scorpion_lava_b.png','boss_colossus.png','boss_magma_golem.png','boss_enchantress.png'];
['ymir','ullr','pele','sekhmet'].forEach(g=>files.push(`totem_${g}.jpg`)); // Phase 1 pantheon (locked Oct 24, 2026)
const imgs={};
const ready=Promise.all(files.map(f=>new Promise(res=>{const i=new Image();i.onload=()=>{imgs[f]=i;res()};i.onerror=()=>{console.warn('art missing',f);res()};i.src=B+f})));
function tex(f,rep){const k=f+(rep||'');if(cache[k])return cache[k];const t3=T3(),i=imgs[f];if(!i)return null;const t=new t3.Ha(i);t.colorSpace=t3.Qt;if(rep){t.wrapS=t.wrapT=1000;t.repeat.set(rep,rep)}t.needsUpdate=true;return cache[k]=t}
function sprite(f,h,y){const t3=T3(),t=tex(f);if(!t)return null;const s=new t3.Ai(new t3.gi({map:t,transparent:true,alphaTest:.04,depthWrite:true}));const i=imgs[f];s.scale.set(h*i.width/i.height,h,1);s.position.y=y==null?h/2:y;return s}
const pick=a=>a[Math.floor(Math.random()*a.length)];
const realmKey=()=>window.TV&&TV.realmKey;
const BLD={inferno:[['b_lava_temple.png',13],['b_lava_pagoda.png',20],['b_rune_pillar.png',14],['b_lava_hammer.png',8],['b_lava_temple.png',11],['b_rune_pillar.png',12]],
 frost:[['b_ice_citadel.png',14],['b_ice_shrine.png',15],['b_ice_fortress.png',12],['b_ice_pyramid_city.png',13],['b_ice_shrine.png',12],['b_ice_citadel.png',11]]};
window.TVart={
 realm(e,P,floorMat,floorMesh){ready.then(()=>{const t3=T3();
  if(e==='inferno'||e==='frost'){const f=tex(e==='inferno'?'floor_lava.jpg':'floor_ice.jpg',5);
   floorMat.map=f;if(e==='inferno'){floorMat.emissiveMap=f;floorMat.emissive.setHex(0x5a2408)}else{floorMat.emissiveMap=null;floorMat.emissive.setHex(0x0a1622)}floorMat.color.setHex(e==='frost'?0x9fb0c4:0xffffff);floorMat.needsUpdate=true;
   // ground outside the arena (visual only)
   const ot=tex(e==='inferno'?'floor_lava.jpg':'floor_ice_outer.jpg',22);const outer=new t3.X(new t3.Ja(80,64),new t3.lo({map:ot,roughness:.9,color:e==='inferno'?0x8a6a5a:0xb8c8d8,emissive:e==='inferno'?0x2a0c02:0,emissiveMap:e==='inferno'?ot:null}));outer.rotation.x=-Math.PI/2;outer.position.y=-.06;outer.receiveShadow=true;P.add(outer);
   // background buildings, well outside the play radius (20), no colliders
   /* v9.10.2 Soft: BLD flat billboards removed; Soft 3D backdrops cover these spots */
   
  }})},
 boss(b,id){const f={colossus:['boss_colossus.png',8,0],golem:['boss_magma_golem.png',7.5,0],magma_golem:['boss_magma_golem.png',7.5,0],enchantress:['boss_enchantress.png',6,1.2]}[id];if(!f)return;ready.then(()=>{const s=sprite(f[0],f[1],f[1]/2+f[2]-.3);if(!s)return;b.root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)o.visible=false});b.root.add(s);b.artSprite=s;
   const fl=b.flash;if(fl)b.flash=function(c,k){try{s.material.color.setRGB(c?1.8:1,c?1.8:1,c?1.8:1)}catch(e){}return fl.apply(this,arguments)}})},
 enemy(a){if(a.type!=='scorpion')return;/* v6: spirit uses water_ice_sprite mesh, no billboard */ready.then(()=>{const sp=a.type==='spirit',f=pick(['scorpion_lava_a.png','scorpion_lava_b.png']);
  const s=sp?sprite(f,3.1,1.75):sprite(f,2.3,1.1);if(!s)return;a.root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)o.visible=false});a.root.add(s);a.artSprite=s})},
 crate(t,e){ready.then(()=>{const f=e==='inferno'?pick(['chest_lava_a.png','chest_lava_b.png']):'chest_ice.png';const s=sprite(f,2.4,1.1);if(!s)return;
  t.root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)o.visible=false});t.root.add(s);t.artChest=s})},
 reveal(t,e,gid){const g=['ymir','ullr','pele','sekhmet'].includes(gid)?gid:(e==='inferno'?'pele':'ymir');
  const run=()=>{if(t.artChest&&e==='inferno'){const o=tex('chest_lava_open.png');if(o){t.artChest.material.map=o;t.artChest.material.needsUpdate=true}}
   if(t.artChest)t.artChest.material.opacity=1;
   /* v9.7 Soft: Ullr 3D idol (static) when loaded; other gods keep JPG totem */
   /* v9.10 Soft: gid->model via TV3.idolMap; JPG fallback */const I=window.TV3&&TV3.idol&&TV3.idolMap&&TV3.idolMap[g]&&TV3.idol(TV3.idolMap[g]);if(I){I.scale.setScalar(.1);I.position.set(0,0,0);t.root.add(I);const t0=performance.now();(function step(){const k=Math.min(1,(performance.now()-t0)/1300),q=1-Math.pow(1-k,3);I.scale.setScalar(.1+.9*q);I.position.y=q*.3;I.position.z=q*1.6;I.rotation.y=q*Math.PI*2;if(t.artChest)t.artChest.material.transparent=true,t.artChest.material.opacity=1-.55*q;if(k<1)requestAnimationFrame(step)})();t.artTotem=I;return}
   const s=sprite(`totem_${g}.jpg`,4.6,0);if(!s)return;s.material.depthTest=false;const W=s.scale.x,H=s.scale.y;s.scale.set(W*.1,H*.1,1);s.position.y=.5;s.renderOrder=2;t.root.add(s);
   const t0=performance.now();(function step(){const k=Math.min(1,(performance.now()-t0)/1300),q=1-Math.pow(1-k,3);s.scale.set(W*(.1+.9*q),H*(.1+.9*q),1);s.position.y=.5+q*(H/2-.2);s.position.z=q*1.6;if(t.artChest)t.artChest.material.transparent=true,t.artChest.material.opacity=1-.55*q;if(k<1)requestAnimationFrame(step)})();t.artTotem=s};
  ready.then(run)}
};
})();

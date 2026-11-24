// Dark Logic Studios — Misty's Nov 24 Tripo batch (all 9 models), wired in additively (mirrors Godot VariantDef).
// Her creatures, crates, totems and waves are unchanged; these only add to them. Lore lock: gods are totems only,
// so the Ice Queen and the Lioness are creature variants, never gods. Static models get procedural motion.
(function(){
const WAVE_EXTRAS={frost:[[0,1,'ice_warrior'],[1,0,'ice_warrior'],[1,1,'ice_queen'],[1,2,'ice_monster']],
 inferno:[[0,1,'lioness'],[1,1,'lioness'],[1,2,'fire_demon']]};
const CRATES={frost:['frostcrate','ice_chest'],inferno:['lavacrate'],void:['void_chest']};
const RARE='gold_chest',RARE_CHANCE=.12;
const CRATE_SCALE={frostcrate:1.6,lavacrate:1.6,ice_chest:1.45,void_chest:1.45,gold_chest:1.6};
// realm -> [model, height, radius, angle, pushOut, blocker radius]
const PROPS={void:[['treehouse',17,36,4.25,true,0],['void_chest',1.5,17.6,4.712,false,.95]]};
const ENEMIES={
 ice_warrior:{model:'ice_warrior',scale:2.3,hp:110,speed:3,dmg:12,range:2.4,windup:.6,color:0x9fd8ff,radius:.75,sfx:'frostHit',proc:1},
 ice_monster:{model:'ice_monster',scale:3.1,hp:340,speed:2.2,dmg:20,range:3,windup:.8,color:0x6fc8ff,radius:1.2,elite:!0,sfx:'frostHit',proc:1},
 ice_queen:{model:'ice_queen',scale:2.1,hp:160,speed:3,dmg:10,range:2,windup:.55,color:0xcfe8ff,radius:.8,elite:!0,ranged:!0,sfx:'frostHit',proc:1},
 lioness:{model:'lioness',scale:2.2,hp:120,speed:3.8,dmg:12,range:2.4,windup:.5,color:0xffc040,radius:.8,lunge:!0,sfx:'fireHit',proc:1},
 fire_demon:{model:'fire_demon',scale:2.5,hp:360,speed:2.6,dmg:21,range:2.8,windup:.75,color:0xff4a1a,radius:1,elite:!0,sfx:'fireHit',proc:1}};
const MODELS=['ice_queen','lioness','fire_demon','ice_monster','ice_warrior','void_chest','ice_chest','treehouse','gold_chest'];
const PROC=['Idle','Walk','Run','Move','Attack','ChillTouch','Hit','HitReact','Death','Spawn','Open'];
let counts={},forced=null;try{forced=new URLSearchParams(location.search).get('crate')}catch(e){}
function waves(realm,arena,w){const o=w.map(x=>x.slice());for(const [a,i,k] of (WAVE_EXTRAS[realm]||[]))if(a===arena&&i<o.length)o[i].push(k);return o}
function crate(realm,L){if(!L.crateN)counts={};const i=counts[realm]||0;counts[realm]=i+1;if(forced&&CRATE_SCALE[forced])return forced;
 if(L.crateN>0&&Math.random()<RARE_CHANCE)return RARE;const l=CRATES[realm]||CRATES.frost;return l[Math.min(i,l.length-1)]}
function enable(o,kind,windup,tint){if(!o||!o.root||!o.root.children[0])return;if(o.anims&&Object.keys(o.anims).length)return;
 if(tint&&tint!==1)for(const q of o.mats||[])q.color&&q.color.multiplyScalar(tint); // keeps white ice / gold from blowing out under the crate light
 const m=o.root.children[0];o.__tp={kind,m,base:m.scale.x,clip:'Idle',t:0,len:0,once:!1,clock:Math.random()*6.28,wind:windup||.6};
 o.has=n=>PROC.includes(n);
 o.play=function(n,{once=!1}={}){const p=this.__tp;if(p.clip===n&&!once&&!p.once)return p.len;p.clip=n;p.t=0;p.once=once;if(once)p.last=n;
  p.len=n==='Attack'||n==='ChillTouch'?p.wind+.45:n==='Hit'||n==='HitReact'?.25:n==='Death'?.8:n==='Spawn'?.6:n==='Open'?.9:0;return p.len}}
const ease=(x,c)=>c<1?1-Math.pow(1-x,1/c):Math.pow(x,c);
function tick(o,dt){const p=o.__tp,m=p.m;p.clock+=dt;p.t+=dt;if(p.once&&p.t>=p.len&&p.clip!=='Death')o.play('Idle');
 let y=0,rx=0,rz=0,s=1,sy=1,snap=!1;const k=Math.min(1,p.t/Math.max(p.len,.001));
 if(p.kind==='prop'){if(p.clip==='Open'){const sh=Math.max(0,1-p.t/.4);rz=Math.sin(p.t*55)*.07*sh;const pop=Math.sin(Math.min(1,Math.max(0,(p.t-.3)/.5))*Math.PI);y=pop*.25;s=1+pop*.08;snap=!0}}
 else switch(p.clip){
  case'Walk':case'Run':case'Move':y=Math.abs(Math.sin(p.clock*6.5))*.07;rz=Math.sin(p.clock*6.5)*.07;rx=.09;break;
  case'Attack':case'ChillTouch':if(p.t<p.wind){const w=p.t/p.wind;rx=-.22*ease(w,.5);y=w*.06}else{const f=Math.min(1,(p.t-p.wind)/.45);rx=f>.25?.32*(1-(f-.25)/.75):-.22+(.54*f/.25)}snap=!0;break;
  case'Hit':case'HitReact':rx=-.25*(1-k);snap=!0;break;
  case'Death':rx=-1.35*ease(k,.4);y=-.1*k;snap=!0;break;
  case'Spawn':y=-.6*(1-ease(k,.3));s=.6+.4*ease(k,.3);snap=!0;break;
  default:sy=1+Math.sin(p.clock*2.2)*.018;rz=Math.sin(p.clock*1.1)*.025}
 // Models face +Z (as in Godot): +rx leans forward, -rx leans back.
 const w=snap?1:1-Math.exp(-dt*12);m.position.y+=(y-m.position.y)*w;m.rotation.x+=(rx-m.rotation.x)*w;m.rotation.z+=(rz-m.rotation.z)*w;
 const b=p.base;m.scale.x+=(b*s-m.scale.x)*w;m.scale.z+=(b*s-m.scale.z)*w;m.scale.y+=(b*s*sy-m.scale.y)*w}
function realm(e,c){for(const [k,h,r0,ang,push,br] of (PROPS[e]||[])){const g=c.re[k];if(!g)continue;const m=c.clone(g.scene),bx=new c.Box3().setFromObject(m),
  sz=bx.max.y-bx.min.y||1,sc=h/sz;let r=r0;if(push)r=Math.max(r0,30+Math.max(bx.max.x-bx.min.x,bx.max.z-bx.min.z)*sc/2);
  m.traverse(x=>{x.isMesh&&(x.castShadow=!push,x.receiveShadow=!0)});m.scale.setScalar(sc);m.position.set(Math.cos(ang)*r,-bx.min.y*sc,Math.sin(ang)*r);
  m.rotation.y=-ang-Math.PI/2;c.P.add(m);if(br>0)c.F.push({x:Math.cos(ang)*r,z:Math.sin(ang)*r,r:br})}}
window.TVtripo={WAVE_EXTRAS,CRATES,RARE,CRATE_SCALE,PROPS,ENEMIES,MODELS,waves,crate,crateScale:k=>CRATE_SCALE[k]||1.6,enable,tick,realm};
})();

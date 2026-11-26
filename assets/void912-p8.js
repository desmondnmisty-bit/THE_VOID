// Dark Logic Studios — The Void web v9.12.2.
// Confirmed full god bodies: Ymir (frost barbarian), Ullr, Pele, Sekhmet, with idle / walk /
// hit_react and signature clips (Throne_of_Rime, Heart_Crystal_Volley, Lava_Vortex, Sun_Wrath_Feast).
// Weapons stay parented to the hand bones in the GLBs. ice_monster.glb remains on disk as the
// Colossus and is no longer used as a god. No new dialogue. No Tripo credits.
(() => {
  'use strict';
  function stamp() { if (window.TVx) TVx.version = 'v9.12.2'; }
  function boot() {
    if (!window.TVx || !window.TVfx) return setTimeout(boot, 30);
    stamp();
    setTimeout(stamp, 50);
    setTimeout(stamp, 200);
  }
  boot();
})();

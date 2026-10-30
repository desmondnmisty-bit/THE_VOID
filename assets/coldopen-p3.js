/* The Void v9.10.7 — cold-open movie before title.
   One tap to start (phone-safe), Skip any time, once per browser session.
   Bypass: ?nocold=1, ?skipTo=..., ?auto=..., or already seen this session. */
(function(){
  var q = new URLSearchParams(location.search);
  if (q.get('nocold') || q.get('skipTo') || q.get('auto')) return;
  try { if (sessionStorage.getItem('voidColdSeen') === '1' && !q.get('cold')) return; } catch(e){}

  function build(){
    var wrap = document.createElement('div');
    wrap.id = 'coldopen';
    wrap.innerHTML =
      '<video id="coldVid" playsinline webkit-playsinline muted preload="auto" poster="./cold/poster.jpg">' +
        '<source src="./cold/void_cold_open.mp4" type="video/mp4"></video>' +
      '<div id="coldTap"><img class="dlsLogo" src="./art/dls_logo.png" alt="Dark Logic Studios">' +
        '<h1>THE VOID</h1><button id="coldStart">TAP TO BEGIN</button></div>' +
      '<button id="coldSkip" class="hidden">Skip ▸</button>';
    document.body.appendChild(wrap);

    var vid = wrap.querySelector('#coldVid');
    var tap = wrap.querySelector('#coldTap');
    var skip = wrap.querySelector('#coldSkip');
    var done = false;

    function finish(){
      if (done) return; done = true;
      try { sessionStorage.setItem('voidColdSeen','1'); } catch(e){}
      try { vid.pause(); } catch(e){}
      wrap.classList.add('out');
      setTimeout(function(){ wrap.remove(); }, 450);
      document.removeEventListener('keydown', onKey, true);
    }
    function start(ev){
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      tap.classList.add('hidden');
      skip.classList.remove('hidden');
      var p = vid.play();
      if (p && p.catch) p.catch(function(){ finish(); });
    }
    function onKey(ev){
      if (ev.key === 'Escape' || ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault(); ev.stopPropagation();
        if (!tap.classList.contains('hidden')) start(); else finish();
      }
    }
    wrap.querySelector('#coldStart').addEventListener('click', start);
    tap.addEventListener('click', start);
    skip.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); finish(); });
    vid.addEventListener('ended', finish);
    vid.addEventListener('error', finish);
    document.addEventListener('keydown', onKey, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

/* サイトの訪問者数を数える。送るのは件数のためのしるしだけで、個人を特定できる情報は送らない */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  if (!CFG.api || location.hostname !== 'cablueie-rentacar.com') return;
  if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent)) return;
  function get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function put(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  /* 中江さんご自身のスマホやパソコンは、?nocount=1 を一度開くと数えなくなる */
  if (/[?&]nocount=1/.test(location.search)) put('no-count', '1');
  if (get('no-count')) return;
  var today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  var isNew = get('visit-day') !== today;
  put('visit-day', today);
  var ref = document.referrer, host = '';
  try { host = ref ? new URL(ref).hostname : ''; } catch(e){}
  var from = !host ? 'direct' : (host === location.hostname ? 'inside'
    : (/google\.|bing\.|yahoo\.|duckduckgo\./.test(host) ? 'search'
    : (/instagram|facebook|threads|tiktok|line\.me|twitter|^x\.com|^t\.co/.test(host) ? 'sns' : 'other')));
  var page = /\/apply\//.test(location.pathname) ? 'apply' : 'site';
  fetch(CFG.api + '?api=hit&page=' + page + '&new=' + (isNew ? 1 : 0) + '&from=' + from, { mode:'no-cors', keepalive:true }).catch(function(){});
})();

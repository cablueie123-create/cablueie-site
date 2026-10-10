/* 約款・表記・お支払いページ：許可番号とお問い合わせ先を、裏方（Google）の設定から表示する */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  if (!CFG.api) return;
  fetch(CFG.api + '?api=public')
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (!res || !res.ok) return;
      var d = res.data || {};
      document.querySelectorAll('[data-license]').forEach(function(el){ el.textContent = d.license || '申請中'; });
      var parts = [];
      if (d.line) parts.push((/^https:\/\//.test(d.line) ? 'LINE：' : 'LINE ID：') + d.line);
      if (d.email) parts.push('メール：' + d.email);
      if (d.phone) parts.push('電話：' + d.phone);
      if (parts.length) document.querySelectorAll('[data-contacts]').forEach(function(el){ el.textContent = parts.join('　／　'); });
    })
    .catch(function(){});
})();

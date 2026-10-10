/* 書類の提出ページ：運転免許証の撮り直し、運転する人の追加。送り先は Google（裏方） */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var ids = { r: q.get('r') || '', k: q.get('k') || '' };
  var info = null, files = { front: null, back: null }, busy = false;

  function error(msg){ $('doc-loading').hidden = true; var e = $('doc-error'); e.textContent = msg; e.hidden = false; }
  function kind(){ return $('kind-driver').checked ? 'driver' : 'self'; }

  function compress(file){
    return new Promise(function(resolve, reject){
      if (!file) return reject(new Error('none'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        try {
          var max = 1800, w = img.naturalWidth, h = img.naturalHeight;
          var sc = Math.min(1, max / Math.max(w, h));
          w = Math.round(w * sc); h = Math.round(h * sc);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          var dataUrl = c.toDataURL('image/jpeg', 0.85);
          resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function(){
        URL.revokeObjectURL(url);
        var type = (file.type || '').toLowerCase();
        if (/^image\/(heic|heif|jpeg|png|webp)$/.test(type) && file.size < 9.5e6){
          var fr = new FileReader();
          fr.onload = function(){ resolve({ mime: type, data: String(fr.result).split(',')[1], preview: null }); };
          fr.onerror = function(){ reject(new Error('read')); };
          fr.readAsDataURL(file);
        } else { reject(new Error('decode')); }
      };
      img.src = url;
    });
  }
  function setupUpload(inputId, key){
    var input = $(inputId), tile = input.closest('.upload'), img = tile.querySelector('img'), hint = tile.querySelector('.u-hint');
    input.addEventListener('change', function(){
      var f = input.files && input.files[0];
      tile.classList.remove('err', 'has'); files[key] = null; img.hidden = true; img.removeAttribute('src');
      if (!f){ hint.textContent = 'タップして撮影・選択'; return; }
      hint.textContent = '読み込んでいます…';
      compress(f).then(function(r){
        files[key] = r; tile.classList.add('has');
        if (r.preview){ img.src = r.preview; img.hidden = false; }
        hint.textContent = '選びました（タップで撮り直し）';
      }, function(){
        tile.classList.add('err');
        hint.textContent = 'この写真は読み込めませんでした。JPEGかPNGの写真を選んでください。';
      });
    });
  }
  function showErrors(list){
    var box = $('doc-form-error');
    box.textContent = '';
    if (!list.length){ box.hidden = true; return; }
    var ul = document.createElement('ul');
    list.forEach(function(t){ var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    box.appendChild(ul); box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function renderKind(){
    var d = kind() === 'driver';
    $('driver-area').hidden = !d;
    $('tile-front').querySelector('.u-label').firstChild.textContent = d ? 'その人の免許証の表' : '免許証の表';
    $('tile-back').querySelector('.u-label').firstChild.textContent = d ? 'その人の免許証の裏' : '免許証の裏';
  }
  function render(d){
    info = d;
    $('doc-loading').hidden = true;
    $('doc-main').hidden = false;
    $('doc-name').textContent = (d.name || '') + ' 様';
    $('doc-id').textContent = d.id;
    $('doc-d2-row').hidden = !d.driver2;
    $('doc-d2').textContent = d.driver2 ? d.driver2 + ' 様（届け出済み）' : '';
    var note = $('kind-note');
    if (!d.canAddDriver){
      $('kind-driver').disabled = true; $('kind-driver-row').classList.add('off');
      if (d.driver2){ note.hidden = false; note.textContent = '追加できる運転者は1人までです。変更したいときは、お問い合わせください。'; }
    }
    if (q.get('kind') === 'driver' && d.canAddDriver) $('kind-driver').checked = true;
    renderKind();
    if (!d.open){
      $('doc-form').hidden = true;
      error('このご予約では、今は受け付けていません。ご不明な点はお問い合わせください。');
      $('doc-main').hidden = false;
    }
  }
  function submit(ev){
    ev.preventDefault();
    if (busy) return;
    var errs = [], k = kind(), name = ($('d-name').value || '').trim();
    $('tile-front').classList.toggle('err', !files.front);
    $('tile-back').classList.toggle('err', !files.back);
    if (k === 'driver'){
      if (!name) errs.push('運転する人のお名前を入力してください。');
      if (!$('d-agree').checked) errs.push('運転する人が21歳以上で、運転免許を取って1年以上であることを確認して、チェックを入れてください。');
    }
    if (!files.front) errs.push('免許証の表の写真を選んでください。');
    if (!files.back) errs.push('免許証の裏の写真を選んでください。');
    if (errs.length) return showErrors(errs);
    showErrors([]);
    busy = true;
    var btn = $('doc-submit'), label = btn.textContent;
    btn.disabled = true; btn.textContent = '送信しています…';
    var data = { r: ids.r, k: ids.k, kind: k, name: name, agree: $('d-agree').checked,
      front: { mime: files.front.mime, data: files.front.data }, back: { mime: files.back.mime, data: files.back.data } };
    fetch(CFG.api, { method: 'POST', body: JSON.stringify({ action: 'docs', data: data }) })
      .then(function(resp){ return resp.json(); })
      .then(function(res){
        if (!res || !res.ok) throw new Error((res && res.error) || '');
        $('doc-main').hidden = true;
        var done = $('doc-done'); done.hidden = false;
        $('doc-done-text').textContent = k === 'driver'
          ? '運転する人の追加（' + name + ' 様）と免許証の写真を受け取りました。確認して、問題があるときだけご連絡します。受け渡しのときに、その方の運転免許証の原本も確認します。'
          : '免許証の写真を受け取りました。確認して、問題があるときだけご連絡します。';
        done.scrollIntoView({ behavior: 'smooth', block: 'start' }); done.focus({ preventScroll: true });
      })
      .catch(function(err){
        showErrors([String(err && err.message || '').replace(/^Error:\s*/, '') || '送信できませんでした。通信状態を確認して、もう一度お試しください。']);
      })
      .then(function(){ busy = false; btn.disabled = false; btn.textContent = label; });
  }

  setupUpload('f-front', 'front'); setupUpload('f-back', 'back');
  $('kind-self').addEventListener('change', renderKind);
  $('kind-driver').addEventListener('change', renderKind);
  $('doc-form').addEventListener('submit', submit);

  if (!CFG.api){ error('設定を読み込めませんでした。お手数ですが、お問い合わせください。'); return; }
  if (!ids.r || !ids.k){ error('ページのリンクが正しくありません。メールに書かれたリンクから開いてください。'); return; }
  fetch(CFG.api + '?' + new URLSearchParams({ api: 'doc', r: ids.r, k: ids.k }).toString())
    .then(function(resp){ return resp.json(); })
    .then(function(res){ if (!res || !res.ok) throw new Error((res && res.error) || '通信できませんでした。少し待って、もう一度お試しください。'); render(res.data); })
    .catch(function(e){ error(e.message); });
})();

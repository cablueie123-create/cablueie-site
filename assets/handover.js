/* 受け取り・返却の手続き：会わずに受け渡すとき、お客様がスマホで車の写真とサインを送るページ。保存とメールは Google（裏方）が行う */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var ids = { r: q.get('r') || '', k: q.get('k') || '' };
  var FAIL = '通信できませんでした。電波のよい場所で、もう一度お試しください。';
  var SHOTS = [
    { label: '前', title: '車の前から撮ってください', img: '../assets/ho-front.png', hint: '車の正面が全部入るように、2〜3歩はなれて撮ります。' },
    { label: '右', title: '車の右側（運転席の側）から撮ってください', img: '../assets/ho-right.png', hint: '前から後ろまで、車の横が全部入るように、はなれて撮ります。' },
    { label: '後ろ', title: '車の後ろから撮ってください', img: '../assets/ho-back.png', hint: 'ナンバープレートが入るように撮ります。' },
    { label: '左', title: '車の左側（助手席の側）から撮ってください', img: '../assets/ho-left.png', hint: '前から後ろまで、車の横が全部入るように、はなれて撮ります。' },
    { label: 'メーター', title: 'メーターと燃料の目もりを撮ってください', img: '', hint: 'エンジンをかけてから、走った距離（km）と燃料の目もりが読めるように撮ります。' }
  ];
  var info = null, steps = [], at = 0, busy = false, sent = false;
  var st = { shots: [], extra: [], damage: null, licNo: '', licKind: '', lic2No: '', lic2Kind: '', agree: false, keyBack: false, sig: null };

  /* ---------- 小さな道具 ---------- */
  function jp(s){ var p = String(s || '').split('-'); return p.length === 3 ? p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日' : ''; }
  function el(tag, attrs, kids){
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function(c){ if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function btn(label, cls, fn){ return el('button', { type: 'button', class: 'btn ' + (cls || 'big'), text: label, onclick: fn }); }
  function fatal(msg){ $('ho-loading').hidden = true; $('ho-step').hidden = true; var e = $('ho-error'); e.textContent = msg; e.hidden = false; }
  function clean(e){ return String(e && e.message || '').replace(/^Error:\s*/, '') || FAIL; }

  /* 写真は長い辺を1600pxまでに小さくして、JPEGで送る */
  function compress(file){
    return new Promise(function(resolve, reject){
      if (!file) return reject(new Error('none'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        try {
          var max = 1600, w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, max / Math.max(w, h));
          w = Math.round(w * sc); h = Math.round(h * sc);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          var d = c.toDataURL('image/jpeg', 0.8);
          resolve({ mime: 'image/jpeg', data: d.split(',')[1], preview: d });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  /* 「カメラで撮る」「写真を選ぶ」：見えないファイル入力を、その都度つくって開く */
  function pick(camera, onPicked){
    var input = el('input', { type: 'file', accept: 'image/*', class: 'ho-hide', 'aria-hidden': 'true', tabindex: '-1' });
    if (camera) input.setAttribute('capture', 'environment');
    input.addEventListener('change', function(){
      var f = input.files && input.files[0];
      input.remove();
      if (f) onPicked(f);
    });
    document.body.appendChild(input);
    input.click();
  }

  /* ---------- サインの欄（指やマウスで書く） ---------- */
  function sigPad(){
    var wrap = el('div', { class: 'ho-pad' }), canvas = el('canvas', { 'aria-label': 'サインを書く欄' }), ph = el('span', { text: 'ここに指でお名前を書いてください' });
    wrap.append(canvas, ph);
    var ctx = null, down = false, last = null, len = 0, width = 0;
    function setup(){
      var dpr = Math.max(1, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || w === width) return;
      width = w; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.fillStyle = '#111';
      len = 0; ph.hidden = false; st.sig = null;
    }
    function pos(ev){ var r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function(ev){
      setup(); ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      down = true; last = pos(ev); ph.hidden = true;
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.6, 0, Math.PI * 2); ctx.fill();
    });
    canvas.addEventListener('pointermove', function(ev){
      if (!down) return;
      ev.preventDefault();
      var p = pos(ev);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      len += Math.abs(p.x - last.x) + Math.abs(p.y - last.y); last = p;
    });
    ['pointerup', 'pointercancel'].forEach(function(t){ canvas.addEventListener(t, function(){ if (down){ down = false; changed(); } }); });
    var listeners = [];
    function changed(){ listeners.forEach(function(fn){ fn(); }); }
    return {
      node: wrap,
      init: function(){ width = 0; setup(); },
      clear: function(){ width = 0; setup(); changed(); },
      ok: function(){ return len > 40; },
      onChange: function(fn){ listeners.push(fn); },
      png: function(){
        var out = document.createElement('canvas'), w = Math.min(600, canvas.width), h = Math.round(canvas.height * w / canvas.width);
        out.width = w; out.height = h;
        var g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(canvas, 0, 0, w, h);
        return { mime: 'image/png', data: out.toDataURL('image/png').split(',')[1] };
      }
    };
  }

  /* ---------- 画面（1画面に1つのこと） ---------- */
  function help(){
    var parts = ['うまくいかないときは、'];
    if (info.line) parts.push(el('a', { href: info.line, target: '_blank', rel: 'noopener', text: 'LINE' }), 'で車の写真を送ってください。');
    else parts.push('ご連絡ください。');
    if (info.phone) parts.push('電話：' + info.phone);
    return el('p', { class: 'ho-help' }, parts);
  }
  function frame(title, body, nav){
    var total = steps.length, n = at + 1;
    var box = $('ho-step');
    box.textContent = '';
    if (total > 1) box.appendChild(el('div', { class: 'ho-prog' }, [el('span', { text: n + ' / ' + total }), el('span', { class: 'ho-bar' }, [el('i', { style: 'width:' + Math.round(n / total * 100) + '%' })])]));
    box.appendChild(el('h2', { text: title, tabindex: '-1' }));
    (body || []).forEach(function(c){ if (c) box.appendChild(c); });
    if (nav) box.appendChild(nav);
    if (at > 0 && !sent) box.appendChild(el('button', { type: 'button', class: 'ho-back', text: '← 前の画面にもどる', onclick: function(){ go(at - 1); } }));
    box.appendChild(help());
    box.hidden = false;
    var h = box.querySelector('h2'); if (h) h.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function go(i){ at = Math.max(0, Math.min(steps.length - 1, i)); steps[at](); }
  function next(){ go(at + 1); }
  function lead(t){ return el('p', { class: 'ho-lead', text: t }); }

  function stepWhere(){
    var pickup = info.mode === 'pickup';
    var body = [lead(pickup ? info.name + ' 様、ご利用ありがとうございます。車の受け取りの手続きをします。5分ほどで終わります。' : info.name + ' 様、ご利用ありがとうございました。車の返却の手続きをします。')];
    if (pickup){
      var box = el('div', { class: 'ho-box' }, [el('div', { text: '車の場所' })]);
      if (info.spot) box.appendChild(el('strong', { text: info.spot }));
      if (!info.spot && !info.map) box.appendChild(el('strong', { text: info.inPlace || '予約の確定のときにお知らせした場所' }));
      body.push(box);
      if (info.map) body.push(el('a', { class: 'btn ghost', href: info.map, target: '_blank', rel: 'noopener', text: '地図で車の場所を見る' }));
    } else {
      body.push(el('div', { class: 'ho-box' }, [el('div', { text: '返す場所' }), el('strong', { text: info.outPlace || '予約のときに決めた場所' })]));
      body.push(lead('車をその場所に止めてから、次へ進んでください。'));
    }
    frame(pickup ? '車の場所' : '返す場所に止めましたか？', body, el('div', { class: 'ho-btns' }, [btn(pickup ? '車に着きました' : '止めました', 'big', next)]));
  }
  function stepKey(){
    var body = [];
    if (info.key) body.push(el('div', { class: 'ho-box' }, [el('div', { text: '鍵の置き場所' }), el('strong', { text: info.key })]));
    else body.push(lead('鍵の置き場所は、予約の確定のときにお知らせした場所です。わからないときは、下の連絡先にご連絡ください。'));
    body.push(lead('鍵を見つけたら、エンジンはまだかけずに、車のまわりの写真を撮ります。'));
    frame('鍵を取り出してください', body, el('div', { class: 'ho-btns' }, [btn('鍵を見つけました', 'big', next)]));
  }
  function stepShot(i){
    return function(){
      var s = SHOTS[i], have = st.shots[i], body = [];
      /* 撮ったあとは、図の代わりに撮った写真を出す（「次へ」が画面からはみ出さないように） */
      if (s.img && !have) body.push(el('div', { class: 'ho-illus' }, [el('img', { src: s.img, alt: s.label + 'から見た車の図' })]));
      body.push(lead(have ? 'この写真でよければ「次へ」を押してください。' : s.hint));
      var area = el('div', { class: 'ho-shot' });
      if (have) area.appendChild(el('img', { src: have.preview, alt: s.label + 'の写真' }));
      body.push(area);
      var msg = el('p', { class: 'form-error', role: 'alert', hidden: '' });
      body.push(msg);
      function got(f){
        msg.hidden = true; area.textContent = ''; area.appendChild(lead('写真を読み込んでいます…'));
        compress(f).then(function(r){ st.shots[i] = r; steps[at](); }, function(){
          area.textContent = ''; msg.textContent = 'この写真は読み込めませんでした。もう一度撮ってください。'; msg.hidden = false;
        });
      }
      var nav = el('div', { class: 'ho-btns' }, have
        ? [btn('次へ', 'big', next), btn('撮り直す', 'ghost', function(){ pick(true, got); })]
        : [btn('カメラで撮る', 'big', function(){ pick(true, got); }), btn('写真を選ぶ', 'ghost', function(){ pick(false, got); })]);
      frame(s.title, body, nav);
    };
  }
  function stepDamage(){
    var pickup = info.mode === 'pickup', body = [];
    body.push(lead(pickup ? '車のまわりを見て、キズやヘコミはありましたか？　小さなものでもかまいません。' : '借りているあいだに、新しいキズやヘコミはできましたか？'));
    if (st.damage === true){
      body.push(lead('キズやヘコミに近づいて、1か所ずつ撮ってください（4枚まで）。'));
      var th = el('div', { class: 'ho-thumbs' });
      st.extra.forEach(function(x, j){ th.appendChild(el('img', { src: x.preview, alt: 'キズの写真' + (j + 1) })); });
      if (st.extra.length) body.push(th);
      var msg = el('p', { class: 'form-error', role: 'alert', hidden: '' });
      body.push(msg);
      var add = function(cam){ return function(){ pick(cam, function(f){ compress(f).then(function(r){ st.extra.push(r); steps[at](); }, function(){ msg.textContent = 'この写真は読み込めませんでした。もう一度撮ってください。'; msg.hidden = false; }); }); }; };
      var row = [];
      if (st.extra.length < 4) row.push(btn(st.extra.length ? 'もう1枚撮る' : 'キズを撮る', st.extra.length ? 'ghost' : 'big', add(true)));
      if (st.extra.length) row.unshift(btn('次へ', 'big', next));
      row.push(btn('やっぱりキズはない', 'ghost', function(){ st.damage = false; st.extra = []; next(); }));
      frame('キズ・ヘコミ', body, el('div', { class: 'ho-btns' }, row));
      return;
    }
    frame('キズ・ヘコミ', body, el('div', { class: 'ho-btns' }, [
      btn('ない', 'big', function(){ st.damage = false; st.extra = []; next(); }),
      btn('ある（写真を撮る）', 'ghost', function(){ st.damage = true; steps[at](); })
    ]));
  }
  function licField(id, label, value, onInput){
    var input = el('input', { id: id, type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '20', placeholder: '例：012345678901', value: value || '' });
    input.addEventListener('input', function(){ onInput(input.value); });
    return el('div', { class: 'ho-field' }, [el('label', { for: id, text: label }), input]);
  }
  function kindField(id, label, value, onChange){
    var sel = el('select', { id: id });
    (info.kinds || []).forEach(function(k){ var o = el('option', { value: k, text: k }); if (k === value) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function(){ onChange(sel.value); });
    if (!value) onChange(sel.value);
    return el('div', { class: 'ho-field' }, [el('label', { for: id, text: label }), sel]);
  }
  function digits(v){ return String(v || '').replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^0-9]/g, ''); }
  function stepLicense(){
    var body = [lead('運転免許証の番号（表に書いてある12けたの数字）を入れてください。貸渡証に書くために使います。')];
    var msg = el('p', { class: 'form-error', role: 'alert', hidden: '' });
    body.push(licField('ho-lic', '免許証の番号（12けた）', st.licNo, function(v){ st.licNo = v; }));
    body.push(kindField('ho-kind', '免許の種類', st.licKind, function(v){ st.licKind = v; }));
    if (info.driver2){
      body.push(lead('追加の運転者（' + info.driver2 + ' 様）の免許証の番号も、わかれば入れてください。'));
      body.push(licField('ho-lic2', info.driver2 + ' 様の免許証の番号', st.lic2No, function(v){ st.lic2No = v; }));
      body.push(kindField('ho-kind2', info.driver2 + ' 様の免許の種類', st.lic2Kind, function(v){ st.lic2Kind = v; }));
    }
    body.push(msg);
    frame('運転免許証の番号', body, el('div', { class: 'ho-btns' }, [btn('次へ', 'big', function(){
      var e = [];
      if (digits(st.licNo).length !== 12) e.push('免許証の番号は、12けたの数字で入れてください。');
      if (info.driver2 && String(st.lic2No || '').trim() && digits(st.lic2No).length !== 12) e.push(info.driver2 + ' 様の免許証の番号も、12けたの数字で入れてください（わからなければ空のままで大丈夫です）。');
      if (e.length){ msg.textContent = e.join(' '); msg.hidden = false; return; }
      next();
    })]));
  }
  function stepSign(){
    var pickup = info.mode === 'pickup', body = [];
    if (pickup){
      body.push(el('div', { class: 'ho-box' }, [
        el('div', { text: '返す日：' + jp(info.end) }), el('div', { text: '返す場所：' + (info.outPlace || '予約のときに決めた場所') })
      ]));
      body.push(el('ul', { class: 'ho-list' }, [
        el('li', { text: '届け出た運転者のほかは、運転できません。' }),
        el('li', { text: '事故・故障のときは、警察（110）と当方に必ず連絡してください。' }),
        el('li', { text: '借りているあいだの日常点検（タイヤ・ライトなど）は、借りる方がします。' }),
        el('li', { text: '貸渡証はメールでお送りします。運転中はスマホに保存して、持っていてください。' })
      ]));
      body.push(el('p', { class: 'small muted' }, ['そのほかの条件は、', el('a', { href: '../terms/', target: '_blank', rel: 'noopener', text: '貸渡約款' }), 'のとおりです。']));
    } else {
      var kc = el('input', { type: 'checkbox' }); kc.checked = st.keyBack;
      kc.addEventListener('change', function(){ st.keyBack = kc.checked; update(); });
      body.push(el('label', { class: 'ho-check' }, [kc, el('span', { text: '鍵を元の場所に戻しました' + (info.key ? '（' + info.key + '）' : '') + '。車内に忘れ物がないか確かめました。' })]));
    }
    var ac = el('input', { type: 'checkbox' }); ac.checked = st.agree;
    ac.addEventListener('change', function(){ st.agree = ac.checked; update(); });
    body.push(el('label', { class: 'ho-check' }, [ac, el('span', { text: pickup ? '上の内容と、撮った写真の車の状態を確かめて、車を受け取りました。' : '撮った写真の状態で、車を返しました。' })]));
    var pad = sigPad();
    body.push(el('div', { class: 'ho-field' }, [el('span', { text: '最後に、お名前を指で書いてください', style: 'font-weight:700' }), pad.node]));
    body.push(el('div', { class: 'ho-row' }, [btn('サインを書き直す', 'ghost', function(){ pad.clear(); })]));
    var msg = el('p', { class: 'form-error', role: 'alert', hidden: '' });
    body.push(msg);
    var send = btn(pickup ? '受け取りました（送信する）' : '返しました（送信する）', 'big', function(){ submit(pad, msg, send); });
    function update(){ send.disabled = busy || !st.agree || !pad.ok() || (!pickup && !st.keyBack); }
    pad.onChange(update);
    frame(pickup ? '内容の確認とサイン' : '鍵とサイン', body, el('div', { class: 'ho-btns' }, [send]));
    pad.init(); update();
  }
  function submit(pad, msg, send){
    if (busy) return;
    if (!pad.ok()){ msg.textContent = '画面にお名前を書いてください。'; msg.hidden = false; return; }
    busy = true; msg.hidden = true;
    var label = send.textContent;
    send.disabled = true; send.textContent = '送信しています…（1分ほどかかることがあります）';
    var data = { r: ids.r, k: ids.k, mode: info.mode, agree: st.agree, keyBack: st.keyBack,
      photos: st.shots.map(function(x){ return { mime: x.mime, data: x.data }; }),
      extra: st.damage ? st.extra.map(function(x){ return { mime: x.mime, data: x.data }; }) : [],
      sig: pad.png() };
    if (info.mode === 'pickup'){ data.licNo = digits(st.licNo); data.licKind = st.licKind; data.lic2No = digits(st.lic2No); data.lic2Kind = st.lic2Kind; }
    fetch(CFG.api, { method: 'POST', body: JSON.stringify({ action: 'ho', data: data }) })
      .then(function(resp){ return resp.json(); })
      .then(function(res){
        if (!res || !res.ok) throw new Error((res && res.error) || FAIL);
        sent = true; busy = false;
        done(res.data && res.data.at);
      })
      .catch(function(e){
        busy = false; send.textContent = label; send.disabled = false;
        msg.textContent = clean(e) + ' 撮った写真は残っているので、もう一度「送信する」を押してください。'; msg.hidden = false;
      });
  }
  function done(when){
    steps = [done]; at = 0;
    var pickup = info.mode === 'pickup', body = [];
    if (pickup){
      body.push(lead('受け取りの手続きが終わりました。ありがとうございます。'));
      body.push(el('div', { class: 'ho-box' }, [el('div', { text: '貸渡証をメールでお送りしました。' }), el('strong', { text: '運転するときは、そのメールをスマホに保存して持っていてください。' })]));
      body.push(lead('返す日（' + jp(info.end) + '）に、このページをもう一度開いて、返却の手続きをしてください。前の日にもメールでご案内します。'));
    } else {
      body.push(lead('返却の手続きが終わりました。ご利用ありがとうございました。'));
      body.push(lead('車の状態を確かめて、燃料の不足など精算が必要なときだけ、内容と金額をメールでお知らせします。'));
    }
    if (when) body.push(el('p', { class: 'small muted', text: '受付：' + when }));
    frame(pickup ? '受け取りました' : '返却を受け付けました', body, null);
  }
  function stepInfo(title, text){
    steps = [function(){ stepInfo(title, text); }]; at = 0;
    var body = [lead(text)];
    if (info.map && info.mode === 'early') body.push(el('a', { class: 'btn ghost', href: info.map, target: '_blank', rel: 'noopener', text: '地図で車の場所を見る' }));
    frame(title, body, null);
  }

  function start(d){
    info = d;
    $('ho-loading').hidden = true;
    if (d.mode === 'early') return stepInfo('受け取りの手続きは、借りる日からです', '受け取りの手続きは、借りる日（' + jp(d.start) + '）からできます。当日、車に着いたら、このページをもう一度開いてください。鍵の置き場所も、その日に表示されます。');
    if (d.mode === 'done') return stepInfo('手続きは終わっています', '返却の手続きまで終わっています（受付：' + (d.returnedAt || '') + '）。ご利用ありがとうございました。');
    if (d.mode !== 'pickup' && d.mode !== 'return') return stepInfo('今は手続きできません', 'このご予約では、今は受け取り・返却の手続きができません。ご不明な点は、お問い合わせください。');
    steps = [stepWhere];
    if (d.mode === 'pickup') steps.push(stepKey);
    SHOTS.forEach(function(s, i){ steps.push(stepShot(i)); });
    steps.push(stepDamage);
    if (d.mode === 'pickup') steps.push(stepLicense);
    steps.push(stepSign);
    go(0);
  }
  window.addEventListener('beforeunload', function(ev){ if (!sent && st.shots.length){ ev.preventDefault(); ev.returnValue = ''; } });

  if (!CFG.api) return fatal('設定を読み込めませんでした。お手数ですが、お問い合わせください。');
  if (!ids.r || !ids.k) return fatal('ページのリンクが正しくありません。メールに書かれたリンクから開いてください。');
  fetch(CFG.api + '?' + new URLSearchParams({ api: 'ho', r: ids.r, k: ids.k }).toString())
    .then(function(resp){ return resp.json(); })
    .then(function(res){ if (!res || !res.ok) throw new Error((res && res.error) || FAIL); start(res.data); })
    .catch(function(e){ fatal(clean(e)); });
})();

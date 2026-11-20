/* 見積書：トップの見積もり（期間・内訳・合計）から、宛名入りの見積書を出して、印刷・PDFで保存できるようにする。
   金額は見積もりの欄に出ている数字をそのまま使う（計算は booking.js と同じ）。会社に出す見積もりのため */
(function(){
  var est = document.querySelector('aside.estimate');
  var hint = document.getElementById('to-apply-hint');
  if (!est || !hint) return;
  var WD = ['日','月','火','水','木','金','土'];
  function $(id){ return document.getElementById(id); }
  function el(tag, attrs, kids){
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){ if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function(c){ if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function jp(d){ return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function txt(id){ var x = $(id); return x ? x.textContent.trim() : ''; }
  /* トップの「車の内容」の表から、車名などを読む */
  function spec(name){
    var out = '';
    document.querySelectorAll('dt').forEach(function(dt){ if (!out && dt.textContent.trim() === name && dt.nextElementSibling) out = dt.nextElementSibling.textContent.trim(); });
    return out;
  }
  function ready(){
    var total = txt('est-total'), chk = $('avail-check');
    return /\d/.test(total) && !(chk && !chk.hidden && /warn/.test(chk.className));
  }

  var css = el('style', { text:
    '.q-open{margin-top:-4px}' +
    '#q-layer{position:fixed;inset:0;z-index:1000;background:rgba(10,30,40,.55);overflow:auto;padding:16px}' +
    '#q-layer .q-tools{max-width:760px;margin:0 auto 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:end;background:#fff;border-radius:12px;padding:12px 14px}' +
    '#q-layer .q-tools label{flex:1 1 260px;display:grid;gap:4px;font-size:.86rem;font-weight:700}' +
    '#q-layer .q-tools input{font:inherit;font-weight:400;padding:8px 10px;border:1px solid #9bb;border-radius:8px}' +
    '#q-layer .q-tools p{flex-basis:100%;margin:0;font-size:.8rem;color:#555}' +
    '.q-sheet{max-width:760px;margin:0 auto;background:#fff;color:#111;padding:36px 40px;border-radius:4px;font-size:14px;line-height:1.6;font-family:"Zen Maru Gothic","Noto Sans JP","Yu Gothic",sans-serif}' +
    '.q-sheet h2{margin:0 0 18px;text-align:center;font-size:26px;letter-spacing:.5em;border-bottom:3px double #111;padding-bottom:6px}' +
    '.q-head{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}' +
    '.q-to{font-size:18px;font-weight:700;border-bottom:1px solid #111;min-width:300px;padding:0 4px 2px;min-height:28px}' +
    '.q-meta{font-size:13px;text-align:right}' +
    '.q-sum{margin:18px 0 6px;display:flex;justify-content:space-between;align-items:baseline;border:2px solid #111;padding:8px 14px;font-size:16px;font-weight:700}' +
    '.q-sum strong{font-size:24px}' +
    '.q-sheet table{width:100%;border-collapse:collapse;margin:12px 0}' +
    '.q-sheet th,.q-sheet td{border:1px solid #333;padding:6px 10px;text-align:left;vertical-align:top}' +
    '.q-sheet th{background:#eef3f5;width:26%;font-weight:700}' +
    '.q-sheet td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.q-sheet ul{margin:10px 0 0;padding-left:18px;font-size:12.5px}' +
    '.q-from{margin-top:18px;margin-left:auto;width:max-content;max-width:100%;font-size:13px}' +
    '.q-from strong{font-size:15px}' +
    '@media (max-width:560px){.q-sheet{padding:22px 16px;font-size:13px}.q-to{min-width:0;width:100%}.q-meta{text-align:left}}' +
    '@media print{@page{size:A4;margin:14mm}body.q-printing>*{display:none!important}body.q-printing>#q-layer{display:block!important;position:static;background:none;padding:0;overflow:visible}' +
    'body.q-printing #q-layer .q-tools{display:none}body.q-printing .q-sheet{max-width:none;padding:0;border-radius:0}}'
  });
  document.head.appendChild(css);

  var open = el('button', { type: 'button', class: 'btn ghost small q-open', hidden: '' }, ['見積書を作る（会社に出すとき・PDF）']);
  hint.after(open);

  function update(){ open.hidden = !ready(); }
  new MutationObserver(update).observe(est, { subtree: true, childList: true, characterData: true, attributes: true });
  update();

  open.addEventListener('click', function(){
    if (!ready()) return;
    var now = new Date(), until = new Date(now.getTime() + 14 * 86400000);
    var no = 'Q' + now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + '-' + ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2);
    var rows = [];
    est.querySelectorAll('.est-rows > div').forEach(function(d){
      if (d.hidden) return;
      var dt = d.querySelector('dt'), dd = d.querySelector('dd');
      if (!dt || !dd) return;
      var a = dt.textContent.trim(), b = dd.textContent.trim();
      if (b === '—' || b === '加入しない') return;
      rows.push([a, b]);
    });
    var car = [spec('車名'), spec('種別'), spec('車内')].filter(Boolean).join('・');
    var to = el('div', { class: 'q-to' });
    var lic = txt('foot-license');
    var tbody = el('tbody', {}, [
      el('tr', {}, [el('th', { text: '件名' }), el('td', { colspan: '2', text: 'レンタカー（マンスリー）のご利用料金' })]),
      el('tr', {}, [el('th', { text: 'ご利用期間' }), el('td', { colspan: '2', text: txt('est-period') })]),
      car ? el('tr', {}, [el('th', { text: '車両' }), el('td', { colspan: '2', text: car })]) : null
    ].concat(rows.map(function(r, i){
      return el('tr', {}, [el('th', { text: i === 0 ? '内訳' : '' }), el('td', { text: r[0] }), el('td', { class: 'n', text: r[1] })]);
    })).concat([
      el('tr', {}, [el('th', { text: '合計' }), el('td', { text: 'ご利用期間の料金の合計' }), el('td', { class: 'n', text: txt('est-total') })])
    ]));
    var sheet = el('div', { class: 'q-sheet' }, [
      el('h2', { text: '御見積書' }),
      el('div', { class: 'q-head' }, [
        el('div', {}, [to, el('p', { text: '下記のとおり、お見積もりいたします。' })]),
        el('div', { class: 'q-meta' }, [
          el('div', { text: '見積番号：' + no }),
          el('div', { text: '発行日：' + jp(now) }),
          el('div', { text: '有効期限：' + jp(until) + '（' + WD[until.getDay()] + '）' })
        ])
      ]),
      el('div', { class: 'q-sum' }, [el('span', { text: 'お見積金額' }), el('strong', { text: txt('est-total') })]),
      el('table', {}, [tbody]),
      el('ul', {}, [
        el('li', { text: '金額は、お支払いの総額です。保険（自賠責・任意保険）と免責補償が含まれています。ガソリン代は含みません。' }),
        el('li', { text: 'お申し込みのあと、ご利用期間の料金を前払いいただいた時点で予約が確定します。空き状況によっては、ご希望の期間でお受けできないことがあります。' }),
        el('li', { text: 'お支払い方法：クレジットカード・電子決済・銀行振込（会社のカードや、会社の口座からのお振り込みもご利用いただけます）。' }),
        el('li', { text: 'キャンセル・途中解約などの条件は、貸渡約款（https://cablueie-rentacar.com/terms/）のとおりです。' })
      ]),
      el('div', { class: 'q-from' }, [
        el('strong', { text: '島ぐらしレンタカー' }), el('br'),
        'Cablueie（カブリエ） 中江智広', el('br'),
        '〒894-0062 鹿児島県奄美市名瀬有屋町36-2', el('br'),
        lic && lic !== '申請中' ? '自家用自動車有償貸渡業 許可番号：' + lic : null, lic && lic !== '申請中' ? el('br') : null,
        'https://cablueie-rentacar.com/'
      ])
    ]);
    var input = el('input', { type: 'text', id: 'q-to-in', maxlength: '60', autocomplete: 'organization', placeholder: '例：〇〇病院 看護部 御中' });
    input.addEventListener('input', function(){ to.textContent = input.value; });
    var print = el('button', { type: 'button', class: 'btn small' }, ['印刷・PDFで保存']);
    var close = el('button', { type: 'button', class: 'btn ghost small' }, ['閉じる']);
    var layer = el('div', { id: 'q-layer', role: 'dialog', 'aria-modal': 'true', 'aria-label': '見積書' }, [
      el('div', { class: 'q-tools' }, [
        el('label', { for: 'q-to-in' }, ['宛名（会社名・部署・お名前。空けておくと手書きできます）', input]),
        print, close,
        el('p', { text: '印刷の画面で「PDFに保存」を選ぶと、PDFにできます。スマホは、共有や印刷のメニューから保存できます。' })
      ]),
      sheet
    ]);
    function shut(){ layer.remove(); document.body.classList.remove('q-printing'); open.focus(); }
    close.addEventListener('click', shut);
    layer.addEventListener('click', function(e){ if (e.target === layer) shut(); });
    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape' && document.body.contains(layer)){ shut(); document.removeEventListener('keydown', esc); } });
    print.addEventListener('click', function(){ document.body.classList.add('q-printing'); window.print(); });
    window.addEventListener('afterprint', function(){ document.body.classList.remove('q-printing'); });
    document.body.appendChild(layer);
    input.focus();
  });
})();

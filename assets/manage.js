/* ご予約の確認・変更：延長・キャンセル・途中解約を、お客様が自分で手続きするページ。計算と実行は Google（裏方）が行う */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var ids = { r: q.get('r') || '', k: q.get('k') || '' };
  var view = null, busy = false, quote = { x: null, c: null, e: null };
  var FAIL = '通信できませんでした。少し待って、もう一度お試しください。';

  function yen(n){ return Number(n).toLocaleString('ja-JP') + '円'; }
  function jp(s){ var p = String(s).split('-'); return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日'; }
  function addDay(s, n){ var p = String(s).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
  function show(id, on){ $(id).hidden = !on; }
  function text(id, t){ $(id).textContent = t; }
  function clean(e){ return String(e && e.message || '').replace(/^Error:\s*/, '') || FAIL; }
  function unwrap(res){ if (!res || !res.ok) throw new Error((res && res.error) || FAIL); return res.data; }
  function api(params){
    params.r = ids.r; params.k = ids.k;
    return fetch(CFG.api + '?' + new URLSearchParams(params).toString()).then(function(resp){ return resp.json(); }).then(unwrap);
  }
  function post(data){
    data.r = ids.r; data.k = ids.k;
    return fetch(CFG.api, { method: 'POST', body: JSON.stringify({ action: 'manage', data: data }) }).then(function(resp){ return resp.json(); }).then(unwrap);
  }
  function fatal(msg){ show('m-loading', false); var e = $('m-error'); e.textContent = msg; e.hidden = false; }
  function sectionError(key, msg){ var b = $(key + '-error'); b.textContent = msg || ''; b.hidden = !msg; }
  function payHref(p){ return '../pay/?' + new URLSearchParams({ r: p.r, n: p.n, k: p.k }).toString(); }
  /* ボタンを押している間は、二重に送らない */
  function working(btn, label, fn){
    if (busy) return;
    busy = true;
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    fn().then(function(){ busy = false; btn.disabled = false; btn.textContent = old; },
              function(){ busy = false; btn.disabled = false; btn.textContent = old; });
  }

  var STATUS = {
    'new': ['pending', '受付済み（承認待ち）'], unpaid: ['unpaid', 'お支払い待ち'], booked: ['paid', 'ご予約確定'], using: ['paid', 'ご利用中'],
    over: ['pending', '返す日を過ぎています'], done: ['none', 'ご利用終了'], cancelled: ['none', 'キャンセル済み'], other: ['none', '—']
  };

  function render(v){
    view = v; quote = { x: null, c: null, e: null };
    show('m-loading', false); show('m-main', true); show('m-links', true);
    var st = STATUS[v.phase] || STATUS.other;
    $('m-status').dataset.s = st[0]; text('m-status', st[1]);
    text('m-name', (v.name || '') + ' 様'); text('m-id', v.id);
    text('m-start', v.start ? jp(v.start) : '—'); text('m-end-date', v.end ? jp(v.end) : '—'); text('m-period', v.period || '—');
    show('m-paid-row', v.paid > 0); text('m-paid', yen(v.paid));
    $('m-docs').href = '../docs/?' + new URLSearchParams({ r: ids.r, k: ids.k }).toString();

    var notes = [], pay = $('m-pay');
    pay.hidden = true;
    if (v.pay){
      notes.push('お支払いがまだ済んでいません（' + yen(v.pay.amount) + (v.pay.due ? '・期限 ' + jp(v.pay.due) : '') + '）。お支払いが済んだ時点で、ご予約が確定します。');
      pay.href = payHref(v.pay); pay.textContent = 'お支払いページへ'; pay.hidden = false;
    }
    if (v.ext){
      notes.push('延長（新しい返す日 ' + jp(v.ext.to) + '・' + yen(v.ext.amount) + '）のお支払いをお待ちしています。' +
        (v.ext.waiting ? '銀行振込の入金を確認でき次第、延長が確定します。' : '期限は ' + jp(v.ext.due) + ' です。期限までにお支払いがないときは、延長を取り消します。'));
      if (v.ext.pay && !v.ext.waiting){ pay.href = payHref(v.ext.pay); pay.textContent = '延長分のお支払いページへ'; pay.hidden = false; }
    }
    if (v.ended){
      notes.push(v.ended.state === 'done'
        ? '途中解約の手続きが済んでいます（解約日 ' + jp(v.ended.date) + '）。' + (v.ended.refund ? '返金額は ' + yen(v.ended.refund) + ' です。' : '')
        : '途中解約を受け付けています。解約日（車を返す日）は ' + jp(v.ended.date) + ' です。' + (v.ended.est ? '返金予定額は ' + yen(v.ended.est) + ' で、車の返却を確認したあとに返金します。' : ''));
    }
    if (v.phase === 'cancelled'){
      notes.push('このご予約はキャンセルになっています。' + (v.cancelled && v.cancelled.paid ? '取消料は ' + yen(v.cancelled.fee) + '、返金額は ' + yen(v.cancelled.refund) + ' です。' : ''));
    }
    if (v.phase === 'new') notes.push('お申し込みの内容を確認しています。承認したら、お支払いページのリンクをメールでお送りします。');
    if (v.phase === 'over') notes.push('返す日を過ぎています。返却がまだの場合は、すぐにご連絡ください。');
    var note = $('m-note');
    note.textContent = notes.join(' '); note.hidden = !notes.length;

    /* 延長 */
    show('m-extend', !!v.extend);
    if (v.extend){
      show('x-form', v.extend.ok); show('x-off', !v.extend.ok); text('x-off', v.extend.why || '');
      show('x-result', false); sectionError('x', '');
      if (v.extend.ok){
        var x = $('x-to');
        x.min = addDay(v.end, 1); x.max = v.extend.max; x.value = '';
        text('x-hint', jp(x.min) + ' から ' + jp(x.max) + ' までの日付を選べます。');
        $('x-agree').checked = false;
      }
    }
    /* キャンセル */
    show('m-cancel', !!v.cancel);
    if (v.cancel){
      show('c-form', v.cancel.ok); show('c-off', !v.cancel.ok); text('c-off', v.cancel.why || '');
      show('c-result', false); sectionError('c', ''); $('c-agree').checked = false;
    }
    /* 途中解約 */
    show('m-endreq', !!v.endReq);
    if (v.endReq){
      show('e-form', v.endReq.ok); show('e-off', !v.endReq.ok); text('e-off', v.endReq.why || '');
      show('e-result', false); sectionError('e', '');
      if (v.endReq.ok){
        var e = $('e-at');
        e.min = v.endReq.min; e.max = addDay(v.end, -1); e.value = v.endReq.min;
        text('e-hint', jp(e.min) + '（お申し出から14日後）から ' + jp(e.max) + ' までの日付を選べます。');
        $('e-agree').checked = false;
      }
    }
  }
  function done(msg){
    var d = $('m-done');
    d.textContent = msg; d.hidden = false;
    d.scrollIntoView({ behavior: 'smooth', block: 'start' }); d.focus({ preventScroll: true });
  }
  function refundNote(qt, planned){
    var t = [];
    if (qt.deduct) t.push('決済手数料は、決済会社から当方に戻らないため、返金額に対応する分を差し引きます。');
    if (qt.refund) t.push('返金は、お支払いに使った方法に戻します。カードの場合、明細に反映されるまで数日から数週間かかることがあります。');
    if (qt.manual) t.push((qt.refund ? 'このうち ' + yen(qt.manual) + ' は' : '返金は') + '、銀行振込でお返しします。振込先をうかがうため、あらためてご連絡します。');
    if (planned) t.push('返金は、車の返却を確認したあとに行います。');
    return t.join('');
  }

  /* ---------- 延長 ---------- */
  function quoteExtend(){
    var to = $('x-to').value;
    sectionError('x', ''); show('x-result', false); quote.x = null;
    if (!to) return sectionError('x', '新しい返す日を選んでください。');
    working($('x-quote'), '計算しています…', function(){
      return api({ api: 'quote', type: 'extend', to: to }).then(function(d){
        quote.x = d;
        text('x-new', jp(d.to) + '（' + d.days + '日の延長・通算 ' + d.label + '）');
        text('x-amount', d.amount ? yen(d.amount) : '0円（1ヶ月分の料金の上限の中のため、追加料金はかかりません）');
        show('x-due-row', d.amount > 0); text('x-due', d.due ? jp(d.due) : '');
        text('x-text', d.amount ? '申し込むと、お支払いページに進みます。期限までにお支払いがないときは、延長を取り消します（返す日は今のままです）。' : '申し込むと、その場で延長が確定します。');
        $('x-submit').textContent = d.amount ? '延長を申し込む（お支払いへ進む）' : '延長を確定する';
        $('x-agree').checked = false; show('x-result', true);
      }, function(err){ sectionError('x', clean(err)); });
    });
  }
  function submitExtend(ev){
    ev.preventDefault();
    if (!quote.x) return quoteExtend();
    if (!$('x-agree').checked) return sectionError('x', '内容を確認して、チェックを入れてください。');
    sectionError('x', '');
    working($('x-submit'), '送信しています…', function(){
      return post({ act: 'extend', to: quote.x.to, shown: quote.x.amount, agree: true }).then(function(res){
        if (res.pay){ location.href = payHref(res.pay); return; }
        render(res.view); done('延長が確定しました。新しい返す日は ' + jp(res.view.end) + ' です。確認のメールをお送りしました。');
      }, function(err){ sectionError('x', clean(err)); });
    });
  }

  /* ---------- キャンセル ---------- */
  function quoteCancel(){
    sectionError('c', ''); show('c-result', false); quote.c = null;
    working($('c-quote'), '計算しています…', function(){
      return api({ api: 'quote', type: 'cancel' }).then(function(d){
        quote.c = d;
        text('c-paid', yen(d.paid));
        text('c-fee', d.fee ? yen(d.fee) + '（最初の1ヶ月分の' + Math.round(d.rate * 100) + '%）' : '0円' + (d.paid ? '（借りる日の15日前までのため）' : ''));
        show('c-deduct-row', d.deduct > 0); text('c-deduct', yen(d.deduct));
        text('c-refund', yen(d.total));
        text('c-text', d.paid ? refundNote(d, false) : 'お支払いはいただいていないため、料金はかかりません。');
        $('c-agree').checked = false; show('c-result', true);
      }, function(err){ sectionError('c', clean(err)); });
    });
  }
  function submitCancel(ev){
    ev.preventDefault();
    if (!quote.c) return quoteCancel();
    if (!$('c-agree').checked) return sectionError('c', '内容を確認して、チェックを入れてください。');
    sectionError('c', '');
    working($('c-submit'), '送信しています…', function(){
      return post({ act: 'cancel', shown: quote.c.total, agree: true }).then(function(res){
        render(res.view); done('ご予約をキャンセルしました。確認のメールをお送りしました。');
      }, function(err){ sectionError('c', clean(err)); });
    });
  }

  /* ---------- 途中解約 ---------- */
  function quoteEnd(){
    var at = $('e-at').value;
    sectionError('e', ''); show('e-result', false); quote.e = null;
    if (!at) return sectionError('e', '解約日を選んでください。');
    working($('e-quote'), '計算しています…', function(){
      return api({ api: 'quote', type: 'end', at: at }).then(function(d){
        quote.e = d;
        text('e-date', jp(d.date)); text('e-full', yen(d.full)); text('e-used', yen(d.used));
        text('e-fee', yen(d.fee) + '（差額の30%。上限は1ヶ月分）');
        show('e-deduct-row', d.deduct > 0); text('e-deduct', yen(d.deduct));
        text('e-refund', yen(d.total));
        text('e-text', refundNote(d, d.total > 0) + '返却の日時と場所は、あらためてご連絡します。');
        $('e-agree').checked = false; show('e-result', true);
      }, function(err){ sectionError('e', clean(err)); });
    });
  }
  function submitEnd(ev){
    ev.preventDefault();
    if (!quote.e) return quoteEnd();
    if (!$('e-agree').checked) return sectionError('e', '内容を確認して、チェックを入れてください。');
    sectionError('e', '');
    working($('e-submit'), '送信しています…', function(){
      return post({ act: 'end', at: quote.e.date, shown: quote.e.total, agree: true }).then(function(res){
        render(res.view); done('途中解約を受け付けました。解約日（車を返す日）は ' + jp(res.view.end) + ' です。確認のメールをお送りしました。');
      }, function(err){ sectionError('e', clean(err)); });
    });
  }

  $('x-quote').addEventListener('click', quoteExtend);
  $('x-form').addEventListener('submit', submitExtend);
  $('x-to').addEventListener('change', function(){ show('x-result', false); quote.x = null; });
  $('c-quote').addEventListener('click', quoteCancel);
  $('c-form').addEventListener('submit', submitCancel);
  $('e-quote').addEventListener('click', quoteEnd);
  $('e-form').addEventListener('submit', submitEnd);
  $('e-at').addEventListener('change', function(){ show('e-result', false); quote.e = null; });

  if (!CFG.api) return fatal('設定を読み込めませんでした。お手数ですが、お問い合わせください。');
  if (!ids.r || !ids.k) return fatal('ページのリンクが正しくありません。メールに書かれたリンクから開いてください。');
  api({ api: 'manage' }).then(render, function(e){ fatal(clean(e)); });
})();

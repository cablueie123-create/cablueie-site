/* お支払いページ：Google（裏方）から請求の内容を読み、Stripe の支払い画面をページの中に表示する */
(function(){
  'use strict';
  var CFG = window.CABLUEIE_CONFIG || {};
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var ids = { r: q.get('r') || '', n: q.get('n') || '', k: q.get('k') || '' };
  var bill = null, checkout = null;

  function api(params){
    return fetch(CFG.api + '?' + new URLSearchParams(params).toString())
      .then(function(resp){ return resp.json(); })
      .then(function(res){
        if (!res || !res.ok) throw new Error((res && res.error) || '通信できませんでした。少し待って、もう一度お試しください。');
        return res.data;
      });
  }
  function yen(n){ return Number(n).toLocaleString('ja-JP'); }
  function jp(s){ var p = String(s).split('-'); return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日'; }
  function show(id, on){ $(id).hidden = !on; }
  function error(msg){
    show('pay-loading', false);
    var e = $('pay-error'); e.textContent = msg; e.hidden = false;
  }
  function clearError(){ $('pay-error').hidden = true; $('pay-notice').hidden = true; }
  function notice(msg){ var n = $('pay-notice'); n.textContent = msg; n.hidden = false; }

  function renderGuard(b){
    show('pay-guard', !!(b && b.cardNeeded));
    $('bill-card-row').hidden = !(b && b.card);
    $('bill-card').textContent = (b && b.card) || '';
  }
  function renderBill(b){
    bill = b;
    show('pay-loading', false); show('pay-result', false); show('pay-bill', true);
    show('pay-wait', false); show('switch-confirm', false);
    renderGuard(b);
    $('bill-amount').textContent = yen(b.amount);
    $('bill-name').textContent = (b.name || '') + ' 様';
    $('bill-id').textContent = b.id + (b.extra ? '（返却後の精算）' : (b.kai > 1 ? '（' + b.kai + '回目）' : ''));
    $('bill-label').textContent = b.label;
    $('bill-due').textContent = b.due ? jp(b.due) : '—';
    var st = $('bill-status'), done = $('bill-done');
    function finish(state, label, text){ st.dataset.s = state; st.textContent = label; done.hidden = false; done.textContent = text; show('pay-actions', false); }
    if (b.cancelled) return finish('none', 'キャンセル', 'このご予約はキャンセルになっています。ご不明な点はお問い合わせください。');
    if (b.status === '入金済み') return finish('paid', 'お支払い済み', 'このお支払いは済んでいます（' + (b.method || '') + (b.paidAt ? '・' + b.paidAt : '') + '）。ありがとうございました。');
    if (b.status === '確認中' && b.pending === 'async') return renderWait(b, st, done);
    if (b.status === '確認中') return finish('pending', '確認中',
      b.pending === 'review' ? 'お支払いを受け付けました。金額の確認が必要なため、確認でき次第ご連絡します。もう一度お支払いいただく必要はありません。' :
        'ご登録のカードでのお支払いを確認しています。しばらくしてから、このページを開き直してください。');
    st.dataset.s = 'unpaid'; st.textContent = '未払い';
    done.hidden = true;
    show('pay-actions', true);
    $('btn-card').hidden = !b.stripe; $('methods-note').hidden = !b.stripe; $('save-note').hidden = !(b.stripe && b.cardNeeded);
    $('btn-bank').hidden = !b.bank;
    if (!b.stripe && !b.bank){ done.hidden = false; done.textContent = 'お支払いの方法を準備しています。お手数ですが、お問い合わせください。'; }
  }

  /* 銀行振込・コンビニ払いの手続き中：振込先（お支払い番号）を見る・まだ払っていなければ別の方法に変える */
  function renderWait(b, st, done){
    var w = b.wait || {}, konbini = w.kind === 'konbini', bank = w.kind === 'bank';
    st.dataset.s = 'pending'; st.textContent = '入金待ち';
    show('pay-actions', false);
    done.hidden = false;
    done.textContent = bank ? '銀行振込の入金をお待ちしています。振込先は、下の「振込先を見る」か、Stripe から届くメールでご確認ください。お客様専用の振込先なので、入金は自動で確認され、メールでお知らせします。' +
        (w.partial && w.remaining != null ? '一部の入金を確認しました。残りの ' + yen(w.remaining) + '円 をお振り込みください。' : '')
      : (konbini ? 'コンビニでのお支払いをお待ちしています。お支払い番号は、下の「お支払い番号を見る」か、Stripe から届くメールでご確認ください。お支払いが確認できたら、メールでお知らせします。'
        : '銀行振込・コンビニ払いの入金をお待ちしています。振込先やお支払い番号は、Stripe から届くメールでご確認ください。入金が確認できたら、メールでお知らせします。');
    var link = $('wait-link');
    link.hidden = !w.url;
    if (w.url){ link.href = w.url; link.textContent = konbini ? 'お支払い番号を見る' : '振込先を見る'; }
    var sw = $('btn-switch');
    sw.hidden = !w.canSwitch;
    sw.textContent = konbini ? 'コンビニ払いをやめて別の方法で払う' : '振込をやめて別の方法で払う';
    $('switch-text').textContent = konbini
      ? 'まだコンビニで支払っていない場合だけ、進んでください。変更したあとは、前のお支払い番号では支払わないでください（もし両方で支払われた場合は、確認して返金します）。'
      : 'まだ振り込んでいない場合だけ、進んでください。変更したあとは、前の振込先には振り込まないでください（もし両方で支払われた場合は、確認して返金します）。すでに振り込んだ場合は、変更せずに入金の確認をお待ちください。';
    show('pay-wait', !!(w.url || w.canSwitch));
  }
  function askSwitch(){ show('switch-confirm', true); $('btn-switch').hidden = true; }
  function noSwitch(){ show('switch-confirm', false); $('btn-switch').hidden = false; }
  function doSwitch(){
    clearError();
    var btn = $('btn-switch-go'), label = btn.textContent;
    btn.disabled = true; btn.textContent = '変更しています…';
    api({ api: 'switch', r: ids.r, n: ids.n, k: ids.k })
      .then(function(d){
        if (d.result === 'paid') return showResult('paid', d.bill);
        renderBill(d.bill);
        if (d.bill.status === '未払い' && d.bill.stripe) openCard();
      })
      .catch(function(err){
        error(err.message);
        api({ api: 'bill', r: ids.r, n: ids.n, k: ids.k }).then(renderBill).catch(function(){});
      })
      .then(function(){ btn.disabled = false; btn.textContent = label; });
  }

  function loadStripe(){
    return new Promise(function(resolve, reject){
      if (window.Stripe) return resolve(window.Stripe);
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/endive/stripe.js'; // Stripe の API バージョン（裏方の STRIPE_API_VERSION）と合わせる
      s.onload = function(){ window.Stripe ? resolve(window.Stripe) : reject(new Error('お支払いの画面を読み込めませんでした。')); };
      s.onerror = function(){ reject(new Error('お支払いの画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。')); };
      document.head.appendChild(s);
    });
  }
  function openCard(){ openEmbedded('checkout', $('btn-card'), 'お支払いの画面を準備しています…'); }
  function openGuard(){ openEmbedded('card', $('btn-guard'), 'カード登録の画面を準備しています…'); }
  function openEmbedded(kind, btn, busy){
    clearError();
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = busy;
    Promise.all([api({ api: kind, r: ids.r, n: ids.n, k: ids.k }), loadStripe()])
      .then(function(arr){
        var data = arr[0];
        if (data.already){
          // Stripe 側ですでに登録済みだった
          return api({ api: 'bill', r: ids.r, n: ids.n, k: ids.k }).then(function(b){ showResult('card', b, data.card); return null; });
        }
        var stripe = arr[1](data.publishableKey);
        var opts = { fetchClientSecret: function(){ return Promise.resolve(data.clientSecret); } };
        return stripe.createEmbeddedCheckoutPage ? stripe.createEmbeddedCheckoutPage(opts) : stripe.initEmbeddedCheckout(opts);
      })
      .then(function(c){
        if (!c) return;
        checkout = c;
        show('pay-bill', false); show('pay-bank', false); show('pay-result', false); show('pay-guard', false); show('pay-checkout', true);
        c.mount('#checkout');
        $('pay-checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function(err){
        error(err.message);
        api({ api: 'bill', r: ids.r, n: ids.n, k: ids.k }).then(renderBill).catch(function(){});
      })
      .then(function(){ btn.disabled = false; btn.textContent = label; });
  }
  function back(){
    if (checkout){ try { checkout.destroy(); } catch (e) {} checkout = null; }
    show('pay-checkout', false); show('pay-bank', false); show('pay-bill', true);
    renderGuard(bill);
  }
  function openBank(){
    clearError();
    show('pay-bill', false); show('pay-bank', true);
    var digits = bill.id.replace(/\D/g, '');
    $('bank-to').textContent = bill.bank;
    $('bank-amount').textContent = yen(bill.amount) + '円';
    $('bank-name').textContent = digits + '　＋　お名前（カタカナ）　例：' + digits + ' ヤマダハナコ';
  }
  function showResult(kind, b, extra){
    bill = b;
    show('pay-loading', false); show('pay-bill', false); show('pay-checkout', false); show('pay-bank', false); show('pay-result', true);
    renderGuard(b);
    var st = $('result-status'), h = $('result-h'), t = $('result-text');
    if (kind === 'card' && b.status === '未払い' && !b.cancelled){
      // カードを先に登録した人：続けて支払えるように、請求の画面にもどす
      renderBill(b);
      notice(String(extra || 'カード').replace(/（.*$/, '') + ' を保証用カードとして登録しました（今は請求されていません）。続けて、お支払いをお願いします。');
      return;
    }
    if (kind === 'review'){
      st.dataset.s = 'pending'; st.textContent = '確認中'; h.textContent = 'お支払いを受け付けました';
      t.textContent = '金額の確認が必要なため、確認でき次第ご連絡します。もう一度お支払いいただく必要はありません。';
      return;
    }
    if (kind === 'card'){
      st.dataset.s = 'paid'; st.textContent = '登録済み'; h.textContent = '保証用カードを登録しました';
      t.textContent = String(extra || 'カード').replace(/（.*$/, '') + ' を保証用カードとして登録しました。今は請求されていません。返却後の精算があるときだけ、内容をお知らせしたうえで請求します。';
      return;
    }
    if (kind === 'paid'){
      st.dataset.s = 'paid'; st.textContent = 'お支払い完了'; h.textContent = 'お支払いが完了しました';
      t.textContent = yen(b.amount) + '円' + (b.method ? '（' + b.method + '）' : '') + 'のお支払いを確認しました。確認のメールをお送りしています。' +
        (b.kai === 1 ? 'これでご予約が確定しました。受け渡しの日時と場所は、あらためてご連絡します。' : '') +
        (b.card && !b.extra ? '保証用カード（' + String(b.card).replace(/（.*$/, '') + '）が登録されています。' : '') +
        (b.cardNeeded ? '最後に、下から保証用のカードを登録してください。' : '');
    } else {
      // 銀行振込・コンビニ払いの手続き中：請求の画面で、振込先と「別の方法で払う」を出す
      renderBill(b);
      notice('お手続きを受け付けました。' + (b && b.cardNeeded ? '下から保証用のカードも登録してください。' : ''));
    }
  }

  $('btn-card').addEventListener('click', openCard);
  $('btn-bank').addEventListener('click', openBank);
  $('btn-back').addEventListener('click', back);
  $('btn-back2').addEventListener('click', back);
  $('btn-guard').addEventListener('click', openGuard);
  $('btn-switch').addEventListener('click', askSwitch);
  $('btn-switch-no').addEventListener('click', noSwitch);
  $('btn-switch-go').addEventListener('click', doSwitch);

  var sid = q.get('session_id');
  if (!CFG.api){ error('設定を読み込めませんでした。お手数ですが、お問い合わせください。'); return; }
  if (sid){
    api({ api: 'return', session_id: sid }).then(function(d){
      ids = { r: d.r, n: String(d.n), k: d.k };
      try { history.replaceState(null, '', location.pathname + '?r=' + encodeURIComponent(d.r) + '&n=' + d.n + '&k=' + d.k); } catch (e) {}
      if (d.result === 'open'){ renderBill(d.bill); error('お支払いは完了していません。もう一度お試しいただくか、別の方法をお選びください。'); }
      else if (d.result === 'card_open'){ renderBill(d.bill); error('カードの登録は完了していません。もう一度お試しください。'); }
      else if (d.result === 'stale') renderBill(d.bill); // 古い画面から戻ってきた：今の請求を見せる
      else showResult(d.result, d.bill, d.card);
    }).catch(function(e){ error(e.message); });
  } else if (ids.r && ids.n && ids.k){
    api({ api: 'bill', r: ids.r, n: ids.n, k: ids.k }).then(renderBill).catch(function(e){ error(e.message); });
  } else {
    error('お支払いページのリンクが正しくありません。メールに書かれたリンクから開いてください。');
  }
})();

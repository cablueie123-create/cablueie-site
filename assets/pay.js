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
  function clearError(){ $('pay-error').hidden = true; }

  function renderBill(b){
    bill = b;
    show('pay-loading', false); show('pay-result', false); show('pay-bill', true);
    $('bill-amount').textContent = yen(b.amount);
    $('bill-name').textContent = (b.name || '') + ' 様';
    $('bill-id').textContent = b.id + '（' + b.kai + '回目）';
    $('bill-label').textContent = b.label;
    $('bill-due').textContent = b.due ? jp(b.due) : '—';
    var st = $('bill-status'), done = $('bill-done');
    function finish(state, label, text){ st.dataset.s = state; st.textContent = label; done.hidden = false; done.textContent = text; show('pay-actions', false); }
    if (b.cancelled) return finish('none', 'キャンセル', 'このご予約はキャンセルになっています。ご不明な点はお問い合わせください。');
    if (b.status === '入金済み') return finish('paid', 'お支払い済み', 'このお支払いは済んでいます（' + (b.method || '') + (b.paidAt ? '・' + b.paidAt : '') + '）。ありがとうございました。');
    if (b.status === '確認中') return finish('pending', '入金の確認中', 'コンビニでのお支払いをお待ちしています。お支払いが確認できたら、メールでお知らせします。');
    st.dataset.s = 'unpaid'; st.textContent = '未払い';
    done.hidden = true;
    show('pay-actions', true);
    $('btn-card').hidden = !b.stripe; $('methods-note').hidden = !b.stripe;
    $('btn-bank').hidden = !b.bank;
    if (!b.stripe && !b.bank){ done.hidden = false; done.textContent = 'お支払いの方法を準備しています。お手数ですが、お問い合わせください。'; }
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
  function openCard(){
    clearError();
    var btn = $('btn-card'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'お支払いの画面を準備しています…';
    Promise.all([api({ api: 'checkout', r: ids.r, n: ids.n, k: ids.k }), loadStripe()])
      .then(function(arr){
        var data = arr[0], stripe = arr[1](data.publishableKey);
        var opts = { fetchClientSecret: function(){ return Promise.resolve(data.clientSecret); } };
        return stripe.createEmbeddedCheckoutPage ? stripe.createEmbeddedCheckoutPage(opts) : stripe.initEmbeddedCheckout(opts);
      })
      .then(function(c){
        checkout = c;
        show('pay-bill', false); show('pay-checkout', true);
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
  }
  function openBank(){
    clearError();
    show('pay-bill', false); show('pay-bank', true);
    var digits = bill.id.replace(/\D/g, '');
    $('bank-to').textContent = bill.bank;
    $('bank-amount').textContent = yen(bill.amount) + '円';
    $('bank-name').textContent = digits + '　＋　お名前（カタカナ）　例：' + digits + ' ヤマダハナコ';
  }
  function showResult(kind, b){
    show('pay-loading', false); show('pay-bill', false); show('pay-checkout', false); show('pay-result', true);
    var st = $('result-status'), h = $('result-h'), t = $('result-text');
    if (kind === 'paid'){
      st.dataset.s = 'paid'; st.textContent = 'お支払い完了'; h.textContent = 'お支払いが完了しました';
      t.textContent = yen(b.amount) + '円' + (b.method ? '（' + b.method + '）' : '') + 'のお支払いを確認しました。確認のメールをお送りしています。' +
        (b.kai === 1 ? 'これでご予約が確定しました。受け渡しの日時と場所は、あらためてご連絡します。' : '');
    } else {
      st.dataset.s = 'pending'; st.textContent = 'お支払い待ち'; h.textContent = 'コンビニでのお支払いをお待ちしています';
      t.textContent = 'お支払いの番号と期限は、先ほどの画面の案内と Stripe からのメールでご確認ください。お支払いが確認できたら、メールでお知らせします。';
    }
  }

  $('btn-card').addEventListener('click', openCard);
  $('btn-bank').addEventListener('click', openBank);
  $('btn-back').addEventListener('click', back);
  $('btn-back2').addEventListener('click', back);

  var sid = q.get('session_id');
  if (!CFG.api){ error('設定を読み込めませんでした。お手数ですが、お問い合わせください。'); return; }
  if (sid){
    api({ api: 'return', session_id: sid }).then(function(d){
      ids = { r: d.r, n: String(d.n), k: d.k };
      try { history.replaceState(null, '', location.pathname + '?r=' + encodeURIComponent(d.r) + '&n=' + d.n + '&k=' + d.k); } catch (e) {}
      if (d.result === 'open'){ renderBill(d.bill); error('お支払いは完了していません。もう一度お試しいただくか、別の方法をお選びください。'); }
      else showResult(d.result, d.bill);
    }).catch(function(e){ error(e.message); });
  } else if (ids.r && ids.n && ids.k){
    api({ api: 'bill', r: ids.r, n: ids.n, k: ids.k }).then(renderBill).catch(function(e){ error(e.message); });
  } else {
    error('お支払いページのリンクが正しくありません。メールに書かれたリンクから開いてください。');
  }
})();

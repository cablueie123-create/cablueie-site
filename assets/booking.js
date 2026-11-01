/* トップの見積もりと、申し込みページで共通の処理 */
(function(){
  'use strict';
  var B = {};
  var CFG = window.CABLUEIE_CONFIG || {};
  var touched = false;
  var state = {
    status: B.status || 'pre',
    prices: { monthly: Number(B.monthly) || 40000, nocMonth: Number(B.nocMonth) || 1500,
              summer: Number(B.summer) || 45000,
              daily: Number(B.daily) || 3500, dailySummer: Number(B.dailySummer) || 4000,
              hoNaze: Number(B.hoNaze) || 500, hoAirport: Number(B.hoAirport) || 3000,
              nocDay: Number(B.nocDay) || 500 },
    short: { min: Number(B.shortMin) || 7, within: Number(B.shortWithin) || 30 },
    contact: { line: B.line || '', phone: B.phone || '', email: B.email || '' },
    license: B.license || '申請中',
    handover: B.handover || '奄美市名瀬有屋町',
    bookings: Array.isArray(B.blocks) ? B.blocks : [],
    today: B.today || null,
    openFrom: '',
    loaded: false
  };
  function applyBoot(D){
    var P = state.prices;
    ['monthly','nocMonth','nocDay','summer','daily','dailySummer','hoNaze','hoAirport'].forEach(function(k){ if (Number(D[k])) P[k] = Number(D[k]); });
    if (Number(D.shortMin)) state.short.min = Number(D.shortMin);
    if (Number(D.shortWithin)) state.short.within = Number(D.shortWithin);
    state.status = D.status || state.status;
    state.contact = { line: D.line || '', phone: D.phone || '', email: D.email || '' };
    state.license = D.license || state.license;
    state.handover = D.handover || state.handover;
    state.bookings = Array.isArray(D.blocks) ? D.blocks : [];
    state.today = D.today || state.today;
    state.openFrom = /^\d{4}-\d{2}-\d{2}$/.test(D.openFrom || '') ? D.openFrom : '';
    state.loaded = true;
    if (!touched){ $('req-start').value = ''; $('req-end').value = ''; defaultRange(); pick.view = firstOf(parse(startVal() || firstDay())); }
    if (startVal() && startVal() < firstDay()) pick.view = firstOf(parse(firstDay()));
    if (!touched) calMsg(guide());
    renderAll();
    renderPause();
    if (state.loaded && periodProblem(period())) showCal(true);
  }

  function setText(id, t){ var el=$(id); if (el) el.textContent=t; }
  function renderPause(){
    if (state.status !== 'pause') return;
    var b = $('req-submit'); if (b){ b.disabled = true; b.textContent = '現在は申し込みを受け付けていません'; }
  }

  /* ---------- dates ---------- */
  var DAY = 86400000;
  var WD = ['日','月','火','水','木','金','土'];
  function pad(n){ return String(n).padStart(2,'0'); }
  function ymd(d){ return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()); }
  function parse(s){ var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1]-1, p[2])); }
  function todayStr(){ if (state.today) return state.today; var n = new Date(); return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate()); }
  /* 選べる最初の日。「貸し出しを始める日」が先なら、その日 */
  function firstDay(){ var t=todayStr(); return state.openFrom > t ? state.openFrom : t; }
  function addDays(d,n){ return new Date(d.getTime()+n*DAY); }
  function periodEnd(start,months){
    /* 民法の期間計算：応当日の前日。応当日がない月は、その月の末日 */
    var y=start.getUTCFullYear(), m=start.getUTCMonth()+months, day=start.getUTCDate();
    var last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    if (day>last) return new Date(Date.UTC(y,m,last));
    return addDays(new Date(Date.UTC(y,m,day)),-1);
  }
  function spanDays(a,b){ return Math.round((b-a)/DAY)+1; }
  function jp(d){ return d.getUTCFullYear()+'年'+(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日'; }
  function jpw(d){ return (d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日（'+WD[d.getUTCDay()]+'）'; }
  function yen(n){ return Number(n).toLocaleString('ja-JP')+'円'; }

  function overlaps(from,to){
    return state.bookings.filter(function(b){ return b.from <= to && from <= b.to; });
  }
  function kindAt(s){
    var k = null;
    for (var i=0;i<state.bookings.length;i++){ var b=state.bookings[i]; if (b.from<=s && s<=b.to){ if (b.kind==='hold'){ k = k || 'hold'; } else { k = 'booked'; } } }
    return k;
  }
  /* 短期（1ヶ月未満）を受け付けるか：借りる日が30日以内、または前後を予約にはさまれた1ヶ月に満たない空き */
  function shortOpen(s){
    var today=parse(todayStr());
    if (s.getTime() <= addDays(today, state.short.within).getTime()) return true;
    var ss=ymd(s), prevEnd='', nextStart='';
    state.bookings.forEach(function(b){
      if (b.to < ss && b.to > prevEnd) prevEnd=b.to;
      if (b.from > ss && (!nextStart || b.from < nextStart)) nextStart=b.from;
    });
    if (!nextStart) return false;
    var fs = prevEnd ? addDays(parse(prevEnd),1) : today;
    if (fs.getTime() < today.getTime()) fs=today;
    return periodEnd(fs,1).getTime() > addDays(parse(nextStart),-1).getTime();
  }
  function shortMinEnd(s){ return addDays(s, state.short.min-1); }
  function shortProblem(s,e){
    if (e.getTime() < shortMinEnd(s).getTime()) return '1ヶ月未満のご利用は'+state.short.min+'日からです。返す日は'+jp(shortMinEnd(s))+'以降を選んでください。';
    if (!shortOpen(s)) return '1ヶ月未満のご利用は、借りる日が'+state.short.within+'日以内の場合か、予約と予約のあいだの1ヶ月に満たない空きの場合だけ受け付けています。返す日は'+jp(periodEnd(s,1))+'以降を選んでください。';
    return '';
  }
  function nextFree(){
    var t = parse(firstDay());
    for (var i=0;i<400;i++){ var d=addDays(t,i); if(!kindAt(ymd(d))) return d; }
    return null;
  }

  /* ---------- rendering ---------- */
  var $ = function(id){ return document.getElementById(id); };
  var STATUS_TEXT = {pre:'開業準備中・仮予約受付中', open:'予約受付中', pause:'新規受付を一時停止中'};
  var STATUS_NOTE = {
    pre:'現在は開業準備中のため、仮予約として受け付けています。営業開始のご連絡と一緒に予約を確定します。',
    open:'',
    pause:'現在、新しい申し込みの受付を止めています。空き状況の確認とお問い合わせはできます。'
  };
  var sel = { start:null, end:null };

  function renderStatus(){
    var pill=$('status-pill'); if (pill){ pill.dataset.status=state.status; pill.textContent=STATUS_TEXT[state.status]||STATUS_TEXT.pre; }
    var note=$('status-note'); var t=STATUS_NOTE[state.status]; note.hidden=!t; note.textContent=t||'';
    note.className = 'notice ' + (state.status==='pause' ? 'warn' : 'info');
  }
  function renderPrices(){
    var now=parse(todayStr()), nowKey=seasonOf(now);
    setText('season-note', 'いまは'+{ normal:'通常シーズン', summer:'夏シーズン' }[nowKey]+'の料金です。');
    document.querySelectorAll('[data-season]').forEach(function(el){ el.classList.toggle('now', el.getAttribute('data-season')===nowKey); });
    document.querySelectorAll('[data-m]').forEach(function(el){ el.classList.toggle('now', Number(el.getAttribute('data-m'))===now.getUTCMonth()+1); });
    document.querySelectorAll('[data-price]').forEach(function(el){
      var k=el.getAttribute('data-price'); el.textContent = Number(state.prices[k]).toLocaleString('ja-JP');
    });
  }
  /* 見積もりに出す、支払い期限の説明。期限は「承認のメールから7日」と「借りる日の前日」の早いほう */
  function payByText(s){
    var t=parse(todayStr()), before=addDays(s,-1), md=(before.getUTCMonth()+1)+'月'+before.getUTCDate()+'日';
    if (before.getTime() <= t.getTime()) return '料金は前払いです。お支払いページのメールが届いたら、お早めにお支払いください。';
    if (before.getTime() <= addDays(t,7).getTime()) return '料金は前払いです。借りる日の前日（'+md+'）までにお支払いください。';
    if (before.getTime() <= addDays(t,14).getTime()) return '料金は前払いです。お支払いページのメールが届いてから、7日以内にお支払いください。遅くとも、借りる日の前日（'+md+'）までです。';
    return '料金は前払いです。お支払いページのメールが届いてから、7日以内にお支払いください。';
  }
  function renderFooter(){
    setText('foot-license', state.license || '申請中');
    setText('foot-handover', state.handover || '奄美市名瀬有屋町');
    document.querySelectorAll('[data-license]').forEach(function(el){ el.textContent = state.license || '申請中'; });
  }
  function lineUrl(id){
    id = String(id || '').trim();
    return /^@/.test(id) ? 'https://line.me/R/ti/p/' + encodeURIComponent(id) : 'https://line.me/ti/p/~' + encodeURIComponent(id);
  }
  /* 設定の「LINE」は、IDでも友だち追加のURLでもよい。URLのときは、その文字は画面に出さずボタンだけにする */
  function lineInfo(){
    var v = String(state.contact.line || '').trim();
    if (!v) return null;
    var isUrl = /^https:\/\/(line\.me|lin\.ee|page\.line\.me)\//i.test(v);
    return { id: isUrl ? '' : v, url: isUrl ? v : lineUrl(v) };
  }
  /* 連絡方法：LINE は、こちらのLINEの設定があるときだけ選べる（お客様から友だち追加してもらう） */
  function renderContactChoice(){
    var sel = $('req-contact'); if (!sel) return;
    var opt = sel.querySelector('option[value="LINE"]'), ln = lineInfo(), has = !!ln;
    opt.hidden = !has; opt.disabled = !has;
    if (!has && sel.value === 'LINE') sel.value = '電話';
    var v = sel.value, h = $('contact-hint');
    h.textContent = v === 'LINE' ? (ln.id ? '申し込みのあと、LINEで「' + ln.id + '」を友だち追加して、受付番号を送ってください。' : '申し込みが済むと、LINEの友だち追加ボタンが出ます。追加したら、受付番号を送ってください。')
      : (v === 'メール' ? '上のメールアドレスにご連絡します。' : (v === 'SMS' ? '上の電話番号にSMSでご連絡します。' : '上の電話番号にご連絡します。'));
  }
  function showDoneLine(id, contact){
    var box = $('done-line'); if (!box) return;
    var ln = lineInfo(), on = contact === 'LINE' && !!ln;
    box.hidden = !on;
    if (!on) return;
    $('done-line-how').textContent = ln.id ? 'LINEで「' + ln.id + '」を友だち追加して、' : '下のボタンからLINEで友だち追加して、';
    $('done-line-rid').textContent = id || '';
    $('done-line-add').href = ln.url;
  }
  function contactItems(){
    var c=state.contact, items=[], ln=lineInfo();
    if (ln) items.push({k:'LINE', v:ln.id, note:'友だち追加して、メッセージをお送りください。', href:ln.url, hrefText:'友だち追加', blank:true});
    if (c.phone) items.push({k:'電話・SMS', v:c.phone, href:'tel:' + c.phone.replace(/[^\d+]/g,''), hrefText:'電話をかける'});
    if (c.email) items.push({k:'メール', v:c.email, href:'mailto:' + c.email, hrefText:'メールを送る'});
    return items;
  }
  function copyText(text, msgEl, fallbackEl){
    var done=function(){ if(msgEl) msgEl.textContent='コピーしました。'; };
    var fail=function(){
      if (fallbackEl && fallbackEl.select){ fallbackEl.focus(); fallbackEl.select(); }
      if (msgEl) msgEl.textContent='自動でコピーできませんでした。選択した文字を長押し（またはCtrl+C）でコピーしてください。';
    };
    try { navigator.clipboard.writeText(text).then(done, fail); } catch(e){ fail(); }
  }
  function renderContactList(ul){
    ul.textContent='';
    contactItems().forEach(function(it){
      var li=document.createElement('li');
      var k=document.createElement('span'); k.className='k'; k.textContent=it.k;
      var v=document.createElement('span'); v.className=it.v ? 'v' : 'v note'; v.textContent=it.v || it.note;
      var acts=document.createElement('div'); acts.className='acts';
      var m=document.createElement('span'); m.className='small muted msg'; m.setAttribute('aria-live','polite');
      var a0=document.createElement('a'); a0.className='btn small'; a0.href=it.href; a0.textContent=it.hrefText;
      if (it.blank){ a0.target='_blank'; a0.rel='noopener'; }
      acts.appendChild(a0);
      if (it.v){
        var b=document.createElement('button'); b.type='button'; b.className='btn ghost small'; b.textContent='コピー';
        b.addEventListener('click', function(){ copyText(it.v, m, null); });
        acts.appendChild(b);
      }
      li.append(k,v,acts,m); ul.appendChild(li);
    });
    var url=state.contact.formUrl;
    if (url && /^https:\/\//.test(url)){
      var li2=document.createElement('li');
      var k2=document.createElement('span'); k2.className='k'; k2.textContent='予約フォーム';
      var a=document.createElement('a'); a.className='btn small'; a.href=url; a.target='_blank'; a.rel='noopener'; a.textContent='フォームを開く';
      var acts2=document.createElement('div'); acts2.className='acts'; acts2.appendChild(a);
      li2.append(k2,acts2); ul.appendChild(li2);
    }
    if (!ul.children.length){
      var li3=document.createElement('li'); li3.textContent='連絡先は準備中です。もうしばらくお待ちください。'; ul.appendChild(li3);
    }
  }
  function renderYear(){
    var wrap=$('year'); if (!wrap) return; wrap.textContent='';
    var today=todayStr(), openDay=firstDay(); var t=parse(today);
    var y=t.getUTCFullYear(), m=t.getUTCMonth();
    var frag=document.createDocumentFragment();
    for (var i=0;i<12;i++){
      var first=new Date(Date.UTC(y,m+i,1));
      var dim=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      var row=document.createElement('div'); row.className='mrow';
      var lab=document.createElement('div'); lab.className='mlabel';
      lab.innerHTML = first.getUTCFullYear()+'.<b>'+pad(first.getUTCMonth()+1)+'</b>';
      var days=document.createElement('div'); days.className='days';
      var bookedN=0;
      for (var d=1; d<=dim; d++){
        var s=first.getUTCFullYear()+'-'+pad(first.getUTCMonth()+1)+'-'+pad(d);
        var c=document.createElement('span'); c.className='d';
        var k=kindAt(s); if(k){ c.classList.add(k); bookedN++; }
        if (s<openDay) c.classList.add('past');
        if (s===today) c.classList.add('today');
        if (sel.start && s>=sel.start && s<=sel.end) c.classList.add('pick');
        days.appendChild(c);
      }
      row.setAttribute('aria-label', first.getUTCFullYear()+'年'+(first.getUTCMonth()+1)+'月：'+(bookedN? bookedN+'日予約あり':'すべて空き'));
      row.append(lab,days); frag.appendChild(row);
    }
    wrap.appendChild(frag);

    var nf=nextFree(), head=$('avail-next');
    if (!state.loaded){ head.textContent = state.loadError ? '空き状況を読み込めませんでした。少し待ってから、ページを読み込み直してください。' : '空き状況を読み込んでいます…'; }
    else if (!nf){ head.textContent='1年以内に空いている日がありません。'; }
    else {
      var maxM=0; for (var mm=6; mm>=1; mm--){ if(!overlaps(ymd(nf), ymd(periodEnd(nf,mm))).length){ maxM=mm; break; } }
      if (maxM>=1){ head.textContent='最短 '+jpw(nf)+' から、'+(maxM===6?'最長6ヶ月まで':maxM+'ヶ月まで')+'借りられます。'; }
      else {
        var run=0; while(run<400 && !kindAt(ymd(addDays(nf,run)))) run++;
        head.textContent='最短 '+jpw(nf)+' から '+run+'日間 空いています'+(run>=state.short.min && shortOpen(nf) ? '（短期で借りられます）' : '')+'。';
      }
    }
    if (state.loaded && nf && openDay > today) head.textContent += '（開業の予定日です。前後することがあります）';
    $('avail-updated').textContent = state.updatedAt ? ('（'+jp(parse(state.updatedAt))+' 時点）') : '';

    var list=$('booked-list'); list.textContent='';
    var future=state.bookings.filter(function(b){ return b.to>=today; }).sort(function(a,b){ return a.from<b.from?-1:1; });
    if (!future.length){ var li=document.createElement('li'); li.className='muted'; li.textContent='現在、予約は入っていません。'; list.appendChild(li); }
    future.forEach(function(b){
      var li=document.createElement('li');
      li.textContent=(b.kind==='hold'?'仮押さえ：':'予約済み：')+jp(parse(b.from))+' 〜 '+jp(parse(b.to));
      list.appendChild(li);
    });
  }


  /* ---------- estimate ---------- */
  function startVal(){ var v=$('req-start').value; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
  function endVal(){ var v=$('req-end').value; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
  function minEnd(s){ return periodEnd(s,1); }
  function maxEnd(s){ return periodEnd(s,6); }
  /* 借りる日〜返す日（どちらも含む）を「◯ヶ月と◯日」に分ける */
  function planOf(s,e){
    var m=0; while (m<6 && periodEnd(s,m+1).getTime() <= e.getTime()) m++;
    var tooLong = e.getTime() > maxEnd(s).getTime();
    var extra = (m && !tooLong) ? Math.round((e - periodEnd(s,m))/DAY) : 0;
    return { months:m, extra:extra, tooLong:tooLong, short: m===0 && !tooLong };
  }
  function planLabel(pl){ return pl.short ? '短期' : pl.months+'ヶ月'+(pl.extra ? 'と'+pl.extra+'日' : ''); }
  /* シーズンは2つ：夏シーズン＝6〜9月、それ以外（10〜5月）は通常シーズン */
  var SEASON = { summer:{ name:'夏シーズン', range:'6〜9月' }, normal:{ name:'通常シーズン', range:'10〜5月' } };
  function seasonOf(d){ var m=d.getUTCMonth()+1; return (m>=6 && m<=9) ? 'summer' : 'normal'; }
  /* 期間の季節：日数が多いほう。同じ日数なら、始まる日の季節（境目で1日ずらしても安くならないように） */
  function seasonOfSpan(a,b){
    var n={ summer:0, normal:0 }, k=seasonOf(a);
    for (var d=a; d.getTime()<=b.getTime(); d=addDays(d,1)) n[seasonOf(d)]++;
    ['summer','normal'].forEach(function(x){ if (n[x] > n[k]) k=x; });
    return k;
  }
  function monthlyOf(k){ var P=state.prices; return k==='summer' ? P.summer : P.monthly; }
  /* 1日料金（1ヶ月未満の短期と、1ヶ月を超えた分）も、その期間の季節で変わる */
  function dayRateOf(k){ var P=state.prices; return k==='summer' ? P.dailySummer : P.daily; }
  /* 1ヶ月ごとに、その1ヶ月のうち日数が多い季節の料金。端数の日は1日料金（その期間の季節の1ヶ月分が上限） */
  function priceOf(s, pl){
    var base=0, groups=[];
    for (var i=0;i<pl.months;i++){
      var st = i===0 ? s : addDays(periodEnd(s,i),1), k=seasonOfSpan(st, periodEnd(s,i+1)), pr=monthlyOf(k), last=groups[groups.length-1];
      base += pr;
      if (last && last.key===k && last.price===pr) last.n++; else groups.push({ key:k, price:pr, n:1 });
    }
    var extraAmt=0, xk='normal', xr=0;
    if (pl.extra){ var xs=addDays(periodEnd(s,pl.months),1); xk=seasonOfSpan(xs, addDays(xs, pl.extra-1)); xr=dayRateOf(xk); extraAmt=Math.min(xr*pl.extra, monthlyOf(xk)); }
    return { base:base, groups:groups, extraAmt:extraAmt, extraKey:xk, extraRate:xr, capped: pl.extra && extraAmt < xr*pl.extra };
  }
  function hoFee(v){ var P=state.prices; return v==='naze' ? P.hoNaze : (v==='airport' ? P.hoAirport : 0); }
  function period(){
    var start=startVal(), end=endVal(), noc=$('req-noc-yes').checked;
    if (!start || !end) return null;
    var s=parse(start), e=parse(end), P=state.prices, pl=planOf(s,e);
    var pr=priceOf(s,pl), base=pr.base, extraAmt=pr.extraAmt, hoAmt=hoFee($('req-handover').value)+hoFee($('req-return').value);
    var days=spanDays(s,e);
    if (pl.short){
      /* 短期：1日料金×日数（その時期の1ヶ月分が上限）。NOCサポートは1日料金×日数。全額を前払い */
      var sk=seasonOfSpan(s,e), sRate=dayRateOf(sk);
      var shortAmt=Math.min(sRate*days, monthlyOf(sk)), sNoc = noc ? P.nocDay*days : 0, sTotal=shortAmt+sNoc+hoAmt;
      return { start:start, end:end, s:s, e:e, months:0, extra:0, tooLong:false, short:true, label:planLabel(pl),
               noc:noc, days:days, base:0, extraAmt:0, shortAmt:shortAmt, shortKey:sk, shortRate:sRate, shortCapped: shortAmt < sRate*days, nocAmt:sNoc,
               groups:[], capped:false, hoAmt:hoAmt, total:sTotal, first:sTotal };
    }
    var nocAmt = noc ? P.nocMonth*pl.months + Math.min(P.nocDay*pl.extra, P.nocMonth) : 0;
    return { start:start, end:end, s:s, e:e, months:pl.months, extra:pl.extra, tooLong:pl.tooLong, short:false, label:planLabel(pl),
             noc:noc, days:days, base:base, extraAmt:extraAmt, extraKey:pr.extraKey, extraRate:pr.extraRate, nocAmt:nocAmt,
             groups:pr.groups, capped:pr.capped, hoAmt:hoAmt,
             total:base+extraAmt+nocAmt+hoAmt, first:base+extraAmt+nocAmt+hoAmt };
  }
  function periodProblem(r){
    if (!r) return startVal() ? '返す日を選んでください。' : '借りる日を選んでください。';
    if (r.start < todayStr()) return '借りる日は今日以降の日付を選んでください。';
    if (r.start < firstDay()) return '貸し出しは'+jp(parse(firstDay()))+'からの予定です。借りる日は、その日以降を選んでください。';
    if (r.end < r.start) return '返す日は、借りる日より後の日付を選んでください。';
    if (r.short){ var sp=shortProblem(r.s, r.e); if (sp) return sp; }
    if (r.tooLong) return 'ご利用期間は最長6ヶ月です。返す日は'+jp(maxEnd(r.s))+'までを選んでください。';
    var hit=overlaps(r.start, r.end);
    if (hit.length) return 'この期間には予約が入っている日があります（'+hit.map(function(b){ return jp(parse(b.from))+'〜'+jp(parse(b.to)); }).join('、')+'）。借りる日か返す日を変えてください。';
    return '';
  }
  /* 選んだ内容を、申し込みページに持っていく（トップに戻ったときも同じ内容にする） */
  function periodQuery(r){
    var ho=$('req-handover').value, rt=$('req-return').value;
    return 's='+r.start+'&e='+r.end+(r.noc ? '&noc=1' : '')+(ho!=='office' ? '&ho='+ho : '')+(rt!=='office' ? '&rt='+rt : '');
  }
  function readQuery(){
    var q=new URLSearchParams(location.search), s=q.get('s'), e=q.get('e');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    $('req-start').value=s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(e || '')) $('req-end').value=e;
    if (q.get('noc')==='1') $('req-noc-yes').checked=true;
    [['ho','req-handover'],['rt','req-return']].forEach(function(x){
      var el=$(x[1]), v=q.get(x[0]);
      if (v && el.querySelector('option[value="'+v.replace(/[^a-z]/g,'')+'"]')) el.value=v;
    });
    touched=true;
    return true;
  }
  function renderApplyLink(r, prob){
    var a=$('to-apply'); if (!a) return;
    var ok = !!r && !prob && state.status!=='pause';
    a.hidden=!ok;
    if (ok) a.href='apply/?'+periodQuery(r);
    var h=$('to-apply-hint');
    h.hidden=ok;
    h.textContent = state.status==='pause' ? '現在は申し込みを受け付けていません。' : '期間を選ぶと、申し込みに進めます。';
  }
  function renderEstimate(){
    var r=period(), P=state.prices, chk=$('avail-check'), sv=startVal();
    $('rs-start-v').textContent = sv ? jpw(parse(sv)) : '—';
    $('rs-end-v').textContent = endVal() ? jpw(parse(endVal())) : '—';
    var prob = periodProblem(r);
    renderApplyLink(r, prob);
    if (!r || r.tooLong || (r.short && (r.end < r.start || shortProblem(r.s, r.e)))){
      sel.start = sv || null; sel.end = sv || null;
      $('est-period').textContent = !sv ? 'カレンダーで借りる日を選んでください' : (!r ? '返す日を選んでください' : '期間を選び直してください');
      $('est-base-label').textContent='基本料金'; $('est-base').textContent='—';
      document.querySelectorAll('.est-month').forEach(function(x){ x.remove(); }); $('est-base-row').hidden=false;
      $('est-extra-row').hidden=true; $('est-ho-row').hidden=true;
      $('est-noc-label').textContent='NOCサポート'; $('est-noc').textContent = $('req-noc-yes').checked ? '加入する' : '加入しない';
      $('est-total').textContent='—'; $('est-first').textContent='';
      setText('return-hint', '返却日は、ご利用期間で選んだ「返す日」です。');
      if (r){ chk.hidden=false; chk.className='notice warn'; chk.textContent=prob; } else { chk.hidden=true; }
      return;
    }
    sel.start=r.start; sel.end=r.end;
    $('est-period').textContent=jp(r.s)+' 〜 '+jp(r.e)+'（'+r.label+'・'+r.days+'日間）';
    setText('return-hint', '返却日は '+jp(r.e)+'（ご利用期間で選んだ返す日）です。延ばしたいときは、7日前までにご連絡ください。');
    document.querySelectorAll('.est-month').forEach(function(x){ x.remove(); });
    $('est-base-row').hidden=true;
    r.groups.forEach(function(g){
      var row=document.createElement('div'); row.className='est-month';
      var dt=document.createElement('dt'); dt.textContent=SEASON[g.key].name+'（'+SEASON[g.key].range+'） '+yen(g.price)+' × '+g.n+'ヶ月';
      var dd=document.createElement('dd'); dd.textContent=yen(g.price*g.n);
      row.append(dt,dd); $('est-extra-row').before(row);
    });
    if (r.short){
      var srow=document.createElement('div'); srow.className='est-month';
      var sdt=document.createElement('dt'); sdt.textContent='短期（'+SEASON[r.shortKey].name+'） '+yen(r.shortRate)+' × '+r.days+'日'+(r.shortCapped ? '（1ヶ月分が上限）' : '');
      var sdd=document.createElement('dd'); sdd.textContent=yen(r.shortAmt);
      srow.append(sdt,sdd); $('est-extra-row').before(srow);
    }
    $('est-extra-row').hidden = !r.extra;
    $('est-extra-label').textContent='1ヶ月を超えた分（'+SEASON[r.extraKey || 'normal'].name+'） '+yen(r.extraRate || P.daily)+' × '+r.extra+'日'+(r.capped ? '（1ヶ月分が上限）' : '');
    $('est-extra').textContent=yen(r.extraAmt);
    $('est-noc-label').textContent = !r.noc ? 'NOCサポート' : (r.short ? 'NOCサポート '+yen(P.nocDay)+' × '+r.days+'日' :
      'NOCサポート '+yen(P.nocMonth)+' × '+r.months+'ヶ月'+(r.extra ? ' ＋ '+yen(P.nocDay)+' × '+r.extra+'日'+(P.nocDay*r.extra > P.nocMonth ? '（月額が上限）' : '') : ''));
    $('est-noc').textContent = r.noc ? yen(r.nocAmt) : '加入しない';
    $('est-ho-row').hidden = !r.hoAmt;
    $('est-ho').textContent = yen(r.hoAmt);
    $('est-total').textContent=yen(r.total);
    $('est-first').textContent = payByText(r.s);
    chk.hidden=false;
    if (prob){ chk.className='notice warn'; chk.textContent=prob; }
    else if (!state.loaded){ chk.className='notice info'; chk.textContent='空き状況を確認しています…'; }
    else { chk.className='notice ok'; chk.textContent='この期間は空いています。'; }
  }

  /* ---------- period picker (calendar) ---------- */
  var pick = { mode:'start', keepEnd:false, view:null };
  function firstOf(d){ return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
  function addMonths(d,n){ return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+n, 1)); }
  function calMsg(t, warn){ var el=$('cal-msg'); el.textContent=t||''; el.classList.toggle('warn', !!warn); }
  function guide(){
    var sv=startVal();
    if (pick.mode==='start' || !sv) return firstDay() > todayStr() ? '借りる日をタップしてください（'+jpw(parse(firstDay()))+'から選べます）。' : '借りる日をタップしてください。';
    var s=parse(sv);
    if (shortOpen(s)) return '返す日をタップしてください（'+jpw(shortMinEnd(s))+' 〜 '+jpw(maxEnd(s))+'。1ヶ月未満は短期の料金です）。';
    return '返す日をタップしてください（'+jpw(minEnd(s))+' 〜 '+jpw(maxEnd(s))+'）。';
  }
  function setMode(m){
    pick.mode=m;
    $('rs-start').setAttribute('aria-pressed', String(m==='start'));
    $('rs-end').setAttribute('aria-pressed', String(m==='end'));
  }
  function validEnd(s,e){ return (e.getTime()>=minEnd(s).getTime() || (e.getTime()>=s.getTime() && !shortProblem(s,e))) && e.getTime()<=maxEnd(s).getTime() && !overlaps(ymd(s), ymd(e)).length; }
  function periodChanged(){
    renderEstimate(); renderYear(); renderCal();
    var f=$('req-form'); if (f) f.dispatchEvent(new Event('change'));
  }
  /* 申し込みページでは、期間を選び済みならカレンダーをたたんでおく */
  function showCal(on){
    var w=$('cal-wrap'); if (!w) return;
    w.hidden=!on;
    $('period-field').classList.toggle('collapsed', !on);
    $('cal-toggle').textContent = on ? 'カレンダーを閉じる' : '期間を変える';
    if (on) calMsg(guide());
  }
  function tapDay(ds){
    touched = true;
    if (ds < firstDay()) return;
    var sv=startVal(), ev=endVal(), k=kindAt(ds);
    if (pick.mode==='start' || !sv || ds < sv){
      if (k){ calMsg(jpw(parse(ds))+'は予約が入っているため、借りる日にできません。', true); return; }
      var s=parse(ds);
      $('req-start').value=ds;
      $('req-end').value = (pick.keepEnd && ev && validEnd(s, parse(ev))) ? ev : '';
      pick.keepEnd=false; setMode('end');
      periodChanged(); calMsg(guide());
      return;
    }
    var s2=parse(sv), e=parse(ds);
    if (e.getTime() < minEnd(s2).getTime()){ var sp=shortProblem(s2,e); if (sp){ calMsg(sp, true); return; } }
    if (e.getTime() > maxEnd(s2).getTime()){ calMsg('最長6ヶ月です。返す日は'+jpw(maxEnd(s2))+'までです。', true); return; }
    var hit=overlaps(sv, ds);
    if (hit.length){ calMsg('この間に予約が入っている日があります（'+hit.map(function(b){ return jpw(parse(b.from))+'〜'+jpw(parse(b.to)); }).join('、')+'）。', true); return; }
    $('req-end').value=ds;
    periodChanged(); calMsg(planOf(s2,e).short ? '短期（'+spanDays(s2,e)+'日間）で選びました。返す日を変えるときは、別の日をタップしてください。' : '期間を選びました。返す日を変えるときは、別の日をタップしてください。');
  }
  function renderCal(){
    if (!pick.view) pick.view = firstOf(parse(startVal() || firstDay()));
    var v=pick.view, today=todayStr(), first=firstDay(), t0=firstOf(parse(first));
    $('cal-title').textContent = v.getUTCFullYear()+'年'+(v.getUTCMonth()+1)+'月';
    $('cal-prev').disabled = v.getTime() <= t0.getTime();
    $('cal-next').disabled = v.getTime() >= addMonths(t0, 13).getTime();
    var sv=startVal(), ev=endVal(), s=sv?parse(sv):null;
    var me = s ? ymd(minEnd(s)) : null, mx = s ? ymd(maxEnd(s)) : null;
    if (s && shortOpen(s)) me = ymd(shortMinEnd(s)); /* 短期を受け付ける時期は、7日目から選べる */
    var grid=$('cal-grid'); grid.textContent='';
    var lead=v.getUTCDay(), dim=new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth()+1, 0)).getUTCDate();
    for (var i=0;i<lead;i++){ var bl=document.createElement('span'); bl.className='cd blank'; bl.setAttribute('aria-hidden','true'); grid.appendChild(bl); }
    for (var d=1; d<=dim; d++){
      var ds=v.getUTCFullYear()+'-'+pad(v.getUTCMonth()+1)+'-'+pad(d);
      var b=document.createElement('button'); b.type='button'; b.className='cd'; b.textContent=d; b.dataset.date=ds;
      var note=[];
      if (ds < first){ b.disabled=true; }
      if (ds === today){ b.classList.add('today'); note.push('今日'); }
      var k=kindAt(ds); if (k){ b.classList.add(k); note.push(k==='booked'?'予約済み':'仮押さえ'); }
      if (sv && ev && ds>sv && ds<ev) b.classList.add('in');
      if (ds===sv){ b.classList.add('start'); if (ev) b.classList.add('has-end'); note.push('借りる日'); }
      if (ds===ev){ b.classList.add('end'); note.push('返す日'); }
      if (pick.mode==='end' && sv && ds>sv && ds<me) b.classList.add('short');
      if (pick.mode==='end' && sv && ds>mx) b.classList.add('far');
      b.setAttribute('aria-label', jpw(parse(ds)) + (note.length ? '（'+note.join('・')+'）' : ''));
      b.addEventListener('click', (function(x){ return function(){ tapDay(x); }; })(ds));
      grid.appendChild(b);
    }
    document.querySelectorAll('#quick button').forEach(function(q){ q.disabled = !sv; });
  }
  function defaultRange(){
    var nf=nextFree();
    if (nf && !startVal()){
      var sv=ymd(nf), ev='';
      [3,2,1].some(function(n){ var e=periodEnd(nf,n); if (!overlaps(sv, ymd(e)).length){ ev=ymd(e); return true; } return false; });
      if (!ev && shortOpen(nf)){
        var run=0; while (run<40 && !kindAt(ymd(addDays(nf,run)))) run++;
        if (run>=state.short.min) ev=ymd(addDays(nf, run-1));
      }
      $('req-start').value=sv; $('req-end').value=ev;
    }
  }
  function initPicker(){
    var fromUrl=readQuery();
    defaultRange();
    pick.view = firstOf(parse(startVal() || firstDay()));
    setMode('start');
    showCal(!fromUrl);
    if ($('cal-toggle')) $('cal-toggle').addEventListener('click', function(){ showCal($('cal-wrap').hidden); });
    $('rs-start').addEventListener('click', function(){
      touched = true;
      showCal(true);
      setMode('start'); pick.keepEnd=true;
      if (startVal()) pick.view=firstOf(parse(startVal() < firstDay() ? firstDay() : startVal()));
      renderCal(); calMsg(guide());
    });
    $('rs-end').addEventListener('click', function(){
      if (!startVal()){ calMsg('先に借りる日を選んでください。', true); return; }
      showCal(true);
      setMode('end');
      pick.view = firstOf(endVal() ? parse(endVal()) : minEnd(parse(startVal())));
      renderCal(); calMsg(guide());
    });
    $('cal-prev').addEventListener('click', function(){ pick.view=addMonths(pick.view,-1); renderCal(); });
    $('cal-next').addEventListener('click', function(){ pick.view=addMonths(pick.view,1); renderCal(); });
    document.querySelectorAll('#quick button').forEach(function(q){
      q.addEventListener('click', function(){
        touched = true;
        var sv=startVal(); if (!sv) return;
        var s=parse(sv), e=periodEnd(s, Number(q.getAttribute('data-m')));
        if (overlaps(sv, ymd(e)).length){ calMsg(q.textContent+'だと予約が入っている日と重なります。もっと短い期間を選んでください。', true); return; }
        $('req-end').value=ymd(e); setMode('end'); pick.view=firstOf(e);
        periodChanged(); calMsg('返す日を'+jpw(e)+'にしました。変えるときは、別の日をタップしてください。');
      });
    });
    calMsg(guide());
  }


  /* ---------- よくある質問：早く返したときの返金の目安 ---------- */
  var RF_RATE = 0.3, RF_CARD = 0.036;
  function rfPrice(m, d, k){ var mo=monthlyOf(k), dr=dayRateOf(k); return m*mo + Math.min(d*dr, mo); }
  function rfLabel(m, d){ return (m ? m+'ヶ月' : '') + (d ? (m ? 'と' : '')+d+'日' : ''); }
  function renderRefund(){
    if (!$('rf-calc')) return;
    var bm=+$('rf-bm').value, bd=+$('rf-bd').value, um=+$('rf-um').value, ud=+$('rf-ud').value;
    var k=(document.querySelector('input[name="rf-season"]:checked')||{}).value || 'normal';
    var bar=$('rf-bar'), rows=$('rf-rows');
    if (bm===6 && bd>0){ bd=0; $('rf-bd').value='0'; }
    var bad = (um===0 && ud===0) ? '実際に使う期間を選んでください。' : ((um*31+ud) >= (bm*31+bd) ? '実際に使う期間は、予約した期間より短くしてください。' : '');
    $('rf-cap').textContent = bad || (rfLabel(bm,bd)+'の予約を、'+rfLabel(um,ud)+'で返す（'+SEASON[k].name+'）');
    if (bad){ bar.innerHTML=''; rows.innerHTML=''; $('rf-back').textContent='−'; $('rf-card').textContent=''; bar.setAttribute('aria-label',''); return; }
    var mo=monthlyOf(k), dr=dayRateOf(k);
    var paid=rfPrice(bm,bd,k), used=rfPrice(um,ud,k), diff=Math.max(paid-used,0);
    var fee=Math.min(Math.round(diff*RF_RATE), mo), back=diff-fee, card=back-Math.round(back*RF_CARD);
    var segs=[['rf-used','使った分',used],['rf-fee','解約手数料',fee],['rf-back','戻る分',back]].filter(function(x){ return x[2]>0; });
    bar.innerHTML = segs.map(function(x){ return '<span class="'+x[0]+'" style="--w:'+x[2]+'" title="'+x[1]+' '+yen(x[2])+'"></span>'; }).join('');
    bar.setAttribute('aria-label', '払った'+yen(paid)+'のうち、'+segs.map(function(x){ return x[1]+yen(x[2]); }).join('、'));
    var capped = ud*dr > mo;
    var usedNote = (um===0 ? ud+'日×'+yen(dr) : (ud ? um+'ヶ月分＋'+ud+'日×'+yen(dr) : um+'ヶ月分')) + (capped ? '（日数分は1ヶ月分が上限）' : '');
    var R=[['お支払い済み（'+rfLabel(bm,bd)+'）', yen(paid)], ['使った期間で計算し直した料金', yen(used), usedNote], ['差額', yen(diff)], ['解約手数料（差額の30%）', yen(fee), (diff*RF_RATE>mo) ? '上限の1ヶ月分' : '']];
    rows.innerHTML = R.map(function(r){ return '<div><dt>'+r[0]+(r[2] ? '<small>'+r[2]+'</small>' : '')+'</dt><dd>'+r[1]+'</dd></div>'; }).join('');
    $('rf-back').textContent = yen(back);
    $('rf-card').textContent = back>0 ? 'カード払いの場合は、決済手数料（3.6%）を引いて約'+yen(card)+'です。' : '差額がないので、戻る金額はありません。';
  }
  function initRefund(){
    if (!$('rf-calc')) return;
    function opts(id, from, to, unit){ var h=''; for (var i=from;i<=to;i++) h+='<option value="'+i+'">'+i+unit+'</option>'; $(id).innerHTML=h; }
    opts('rf-bm',1,6,'ヶ月'); opts('rf-bd',0,30,'日'); opts('rf-um',0,6,'ヶ月'); opts('rf-ud',0,30,'日');
    $('rf-bm').value='1'; $('rf-bd').value='10'; $('rf-um').value='1'; $('rf-ud').value='0';
    ['rf-bm','rf-bd','rf-um','rf-ud'].forEach(function(id){ $(id).addEventListener('change', renderRefund); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="rf-season"]'), function(r){ r.addEventListener('change', renderRefund); });
    Array.prototype.forEach.call(document.querySelectorAll('.rf-preset'), function(b){ b.addEventListener('click', function(){ var p=b.getAttribute('data-p').split(','); $('rf-bm').value=p[0]; $('rf-bd').value=p[1]; $('rf-um').value=p[2]; $('rf-ud').value=p[3]; renderRefund(); }); });
  }

  function renderAll(){ renderStatus(); renderPrices(); renderFooter(); renderContactList($('contacts')); renderContactChoice(); renderEstimate(); renderYear(); renderCal(); renderRefund(); }

  /* ---------- license photos ---------- */
  var files = { front:null, back:null, d2front:null, d2back:null };
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
          resolve({ mime:'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function(){
        URL.revokeObjectURL(url);
        var type = (file.type || '').toLowerCase();
        if (/^image\/(heic|heif|jpeg|png|webp)$/.test(type) && file.size < 9.5e6){
          var fr = new FileReader();
          fr.onload = function(){ resolve({ mime:type, data:String(fr.result).split(',')[1], preview:null }); };
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
        files[key] = r; tile.classList.add('has'); tile.classList.remove('err');
        $('req-form').dispatchEvent(new Event('change'));
        if (r.preview){ img.src = r.preview; img.hidden = false; }
        hint.textContent = '選びました（タップで撮り直し）';
      }, function(){
        tile.classList.add('err');
        hint.textContent = 'この写真は読み込めませんでした。JPEGかPNGの写真を選んでください。';
      });
    });
  }

  /* ---------- form ---------- */
  function val(id){ return ($(id).value || '').trim(); }
  function markField(id, bad){ var f = $(id).closest('.field'); if (f) f.classList.toggle('invalid', !!bad); }
  function showErrors(list, quiet){
    var box = $('form-error');
    box.textContent = '';
    if (!list.length){ box.hidden = true; return; }
    var p = document.createElement('strong'); p.textContent = '送信の前に、次の点を確認してください。';
    var ul = document.createElement('ul');
    list.forEach(function(t){ var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    box.append(p, ul); box.hidden = false;
    if (!quiet) box.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  function validate(){
    var errs = [];
    var need = [['req-name','お名前'],['req-kana','フリガナ'],['req-phone','電話番号'],['req-email','メールアドレス'],['req-address','住所'],['req-work','勤務先・滞在の目的']];
    need.forEach(function(n){ var bad = !val(n[0]); markField(n[0], bad); if (bad) errs.push(n[1]+'を入力してください。'); });
    var em = val('req-email');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ markField('req-email', true); errs.push('メールアドレスの形を確認してください。'); }
    var ph = val('req-phone').replace(/[^0-9]/g, '');
    if (val('req-phone') && ph.length < 10){ markField('req-phone', true); errs.push('電話番号を確認してください。'); }
    var r = period(), prob = periodProblem(r);
    markField('req-start', !!prob); if (prob){ errs.push(prob); showCal(true); }
    ['tile-front','tile-back','tile-d2front','tile-d2back'].forEach(function(id){ var k={'tile-front':'front','tile-back':'back','tile-d2front':'d2front','tile-d2back':'d2back'}[id]; if (files[k]) $(id).classList.remove('err'); });
    if (!files.front){ $('tile-front').classList.add('err'); errs.push('運転免許証の表の写真を選んでください。'); }
    if (!files.back){ $('tile-back').classList.add('err'); errs.push('運転免許証の裏の写真を選んでください。'); }
    if ($('d2-on').checked){
      var bn = !val('d2-name'); markField('d2-name', bn); if (bn) errs.push('ほかに運転する人のお名前を入力してください。');
      if (!files.d2front){ $('tile-d2front').classList.add('err'); errs.push('ほかに運転する人の免許証（表）の写真を選んでください。'); }
      if (!files.d2back){ $('tile-d2back').classList.add('err'); errs.push('ほかに運転する人の免許証（裏）の写真を選んでください。'); }
    }
    var dv = $('agree-driver').checked;
    $('agree-driver-row').classList.toggle('invalid', !dv);
    if (!dv) errs.push('運転する人の条件（21歳以上・免許を取って1年以上）を確認して、チェックを入れてください。');
    var t = $('agree-terms').checked, pv = $('agree-privacy').checked;
    $('agree-terms-row').classList.toggle('invalid', !t); $('agree-privacy-row').classList.toggle('invalid', !pv);
    if (!t) errs.push('貸渡約款への同意にチェックを入れてください。');
    if (!pv) errs.push('個人情報の取り扱いへの同意にチェックを入れてください。');
    return { errs: errs, r: r };
  }
  function cleanMsg(m){ return String(m || '').replace(/^(Error|Exception|ScriptError):\s*/i, ''); }

  function initForm(){
    initPicker();
    ['req-noc-no','req-noc-yes','req-handover','req-return'].forEach(function(id){
      $(id).addEventListener('change', function(){ renderEstimate(); });
    });
    var toApply=$('to-apply');
    if (toApply) toApply.addEventListener('click', function(){
      var r=period(); if (r) history.replaceState(null, '', '?'+periodQuery(r)+'#request');
    });
    if (!$('req-form')) return;
    setupUpload('lic-front','front'); setupUpload('lic-back','back');
    setupUpload('d2-front','d2front'); setupUpload('d2-back','d2back');
    $('d2-on').addEventListener('change', function(){ $('d2-area').hidden = !$('d2-on').checked; });
    $('req-contact').addEventListener('change', renderContactChoice);
    renderPause();
    var tried = false, dirty = false;
    /* 入力の途中でページを離れると、写真も入力も消えてしまうので確かめる */
    $('req-form').addEventListener('input', function(){ dirty = true; });
    window.addEventListener('beforeunload', function(ev){ if (dirty){ ev.preventDefault(); ev.returnValue=''; } });
    function recheck(){ if (!tried) return; var v = validate(); showErrors(v.errs, true); }
    $('req-form').addEventListener('input', recheck);
    $('req-form').addEventListener('change', function(){ setTimeout(recheck, 0); });

    $('req-form').addEventListener('submit', function(ev){
      ev.preventDefault();
      if (state.status === 'pause') return;
      tried = true;
      var v = validate();
      if (v.errs.length){ showErrors(v.errs); return; }
      showErrors([]);
      var r = v.r;
      var payload = {
        website: $('req-website').value,
        start: r.start, end: r.end, noc: r.noc,
        name: val('req-name'), kana: val('req-kana'), phone: val('req-phone'), email: val('req-email'),
        address: val('req-address'), stay: val('req-stay'), work: val('req-work'),
        handover: $('req-handover').value, handoverTime: val('req-handover-time'),
        returnWay: $('req-return').value, returnTime: val('req-return-time'),
        contact: $('req-contact').value, note: val('req-note'),
        agreeTerms: $('agree-terms').checked, agreePrivacy: $('agree-privacy').checked, agreeDriver: $('agree-driver').checked,
        licenseFront: files.front && { mime: files.front.mime, data: files.front.data },
        licenseBack: files.back && { mime: files.back.mime, data: files.back.data },
        driver2: $('d2-on').checked ? { name: val('d2-name'),
          front: files.d2front && { mime: files.d2front.mime, data: files.d2front.data },
          back: files.d2back && { mime: files.d2back.mime, data: files.d2back.data } } : null
      };
      var btn = $('req-submit'), label = btn.textContent;
      btn.disabled = true; btn.textContent = '送信しています…（そのままお待ちください）';
      var reset = function(){ btn.disabled = false; btn.textContent = label; };
      if (!CFG.api){ reset(); showErrors(['送信先が設定されていません。お問い合わせ先にご連絡ください。']); return; }
      fetch(CFG.api, { method: 'POST', body: JSON.stringify({ action: 'submit', data: payload }) })
        .then(function(resp){ return resp.json(); })
        .then(function(res){
          if (!res || !res.ok) throw new Error((res && res.error) || '');
          res = res.data || {};
          dirty = false;
          $('req-area').hidden = true;
          $('apply-intro').hidden = true;
          $('done-id').textContent = res.id || '';
          $('done-period').textContent = jp(r.s)+' 〜 '+jp(r.e)+'（'+r.label+'）';
          $('done-total').textContent = yen(res.total != null ? res.total : r.total);
          showDoneLine(res.id, payload.contact);
          if (res.pay && res.pay.r && res.pay.k){
            var pay = $('done-pay');
            pay.href = '../pay/?r=' + encodeURIComponent(res.pay.r) + '&n=' + encodeURIComponent(res.pay.n) + '&k=' + encodeURIComponent(res.pay.k);
            pay.hidden = false;
            $('done-text').textContent = 'お支払いページのリンクを、メールでもお送りしました。' + (res.pay.due ? jp(parse(res.pay.due)) + 'までに' : '期限までに') +
              'お支払いください。お支払いが済んだ時点で、予約が確定します（期限を過ぎると、予約は自動で取り消されます）。';
          }
          var done = $('done'); done.hidden = false;
          state.bookings.push({ from: r.start, to: r.end, kind: 'hold' });
          sel.start = sel.end = null; renderYear();
          done.scrollIntoView({ behavior:'smooth', block:'start' }); done.focus({ preventScroll:true });
        })
        .catch(function(err){
          reset();
          showErrors([cleanMsg(err && err.message) || '送信できませんでした。通信状態を確認して、もう一度お試しください。']);
        });
    });
  }

  initForm();
  initRefund();
  renderAll();
  if (CFG.api){
    fetch(CFG.api + '?api=public')
      .then(function(resp){ return resp.json(); })
      .then(function(res){ if (res && res.ok) applyBoot(res.data); else throw new Error(res && res.error); })
      .catch(function(){ state.loadError = true; renderYear(); });
  }
})();

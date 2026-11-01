/* 免許証の写真：スマホでは「カメラで撮る」と「写真を選ぶ」を分けて出す（機種によって、ふつうの選択画面にカメラが出ないため） */
(function(){
  'use strict';
  if (!window.matchMedia || !matchMedia('(pointer:coarse)').matches) return;

  function button(label, ghost, input, camera){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'u-btn' + (ghost ? ' ghost' : ''); b.textContent = label;
    b.addEventListener('click', function(ev){
      ev.preventDefault();
      if (camera) input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
      input.click();
    });
    return b;
  }

  Array.prototype.forEach.call(document.querySelectorAll('.upload'), function(tile){
    var input = tile.querySelector('input[type=file]'), hint = tile.querySelector('.u-hint');
    if (!input) return;
    var row = document.createElement('span');
    row.className = 'u-btns';
    row.append(button('カメラで撮る', false, input, true), button('写真を選ぶ', true, input, false));
    tile.classList.add('shoot');
    tile.append(row);
    if (hint) hint.textContent = '撮影するか、写真を選んでください';
  });

  /* LINE などのアプリの中で開いたページでは、カメラが開かないことがある */
  if (/ Line\/|FBAN|FBAV|Instagram|GSA\//.test(navigator.userAgent)){
    Array.prototype.forEach.call(document.querySelectorAll('.uploads'), function(box, i){
      if (i) return;
      var p = document.createElement('p');
      p.className = 'small muted'; p.style.margin = '0';
      p.textContent = 'カメラが開かないときは、このページをSafariやChromeで開き直してください。';
      box.parentNode.insertBefore(p, box.nextSibling);
    });
  }
})();

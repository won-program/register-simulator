(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const Core=window.RegisterCore;
  const number=n=>Math.round(n).toLocaleString('ja-JP');
  const yen=n=>'¥'+number(n);
  const seconds=n=>n===null?'—':n.toFixed(2)+'秒';
  const percentage=n=>(n>99.9 && n<100?'99.9':n.toFixed(1))+'%';
  const signed=n=>(n>0?'+':'')+number(n)+'円';
  const text=(id,value)=>{$(id).textContent=value;};
  const make=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;};
  let toastTimer=null;
  function toast(message) {
    clearTimeout(toastTimer); text('toast',message); $('toast').hidden=false;
    toastTimer=setTimeout(()=>{$('toast').hidden=true;},5000);
  }
  const records=new window.RegisterStorage.Records(toast);
  const sound=new window.RegisterSound(records.data.sound);
  let shift=null, loop=null, currentScreen='home', lastSequence=0, lastPhase='', lastRush=false;
  let latestResult=null, confirmAction=null;
  function showScreen(name) {
    currentScreen=name;
    ['home','game','result','records'].forEach(screen=>{$(screen+'-screen').hidden=screen!==name;});
    window.scrollTo(0,0);
    if(name==='home') renderHome();
    if(name==='records') renderRecords();
    const heading=$(name+'-screen').querySelector('h1');
    if(heading) {heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  }
  function renderHome() {
    text('home-high',number(records.data.highScore));text('home-combo',number(records.data.maxCombo));text('home-served',number(records.data.bestServed));
  }
  function renderSound() {
    text('sound-button',sound.enabled?'♪ 音 ON':'♪ 音 OFF');
    $('sound-button').setAttribute('aria-pressed',String(sound.enabled));
    $('sound-button').setAttribute('aria-label',sound.enabled?'効果音をオフにする':'効果音をオンにする');
  }
  function stopLoop() {if(loop!==null)clearInterval(loop);loop=null;}
  function startGame() {
    stopLoop();
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    sound.unlock();sound.play('start');
    shift=new Core.Shift();shift.start(Date.now());
    lastSequence=0;lastPhase='';lastRush=false;
    showScreen('game');renderGame(Date.now());
    loop=setInterval(tick,80);
  }
  function tick() {
    if(!shift || currentScreen!=='game')return;
    const now=Date.now();shift.update(now);
    if(shift.phase==='finished'){endGame();return;}
    renderGame(now);
  }
  function itemRow(item,added=false) {
    const row=make('div','item'+(added?' added':''));
    const icon=make('span','item-icon',item.icon);icon.setAttribute('aria-hidden','true');
    row.append(icon,make('span','item-name',item.name),make('span','item-price',yen(item.price)));
    return row;
  }
  function renderCustomer(finalized) {
    const c=shift.customer;
    text('customer-number','NO. '+String(shift.sequence).padStart(3,'0'));
    text('customer-kind',c.label);text('customer-name',c.title);
    $('items').replaceChildren(...c.items.map(item=>itemRow(item)));
    if(c.kind==='bag' && finalized)$('items').append(itemRow({icon:'🛍️',name:'レジ袋',price:5},true));
    text('total',yen(finalized?c.total:c.initialTotal));
    $('tender').classList.toggle('coins-prompt',c.kind==='coins');
    text('tender',c.kind==='coins'?'硬貨の合計を計算':yen(finalized?c.tender:c.initialTender));
    $('coins').hidden=c.kind!=='coins';
    $('coins').replaceChildren(...c.coins.map(coin=>make('span','',number(coin.value)+'円 × '+coin.count)));
    let speech=c.kind==='coins'?'この硬貨でお願いします。':number(c.initialTender)+'円でお願いします。';
    let notice='商品をスキャンしています…';
    if(c.kind==='extra') {
      speech=finalized?'あ、'+c.extra+'円ありました！':number(c.initialTender)+'円で…小銭を探しますね。';
      notice=finalized?'小銭 +'+c.extra+'円 → お預かり確定！':'小銭を確認中… 確定までお待ちください';
    } else if(c.kind==='bag') {
      speech=finalized?'袋もお願いします！':'あ、袋を…';
      notice=finalized?'レジ袋 +5円 → 合計が変わりました！':'レジ袋を追加中… 確定までお待ちください';
    } else if(finalized) {
      notice=c.kind==='coins'?'硬貨を合計して、おつりを入力してください。':c.kind==='hurry'?'5秒以内の正解で、お急ぎボーナス +25pt！':'お預かり − お買上げ合計 = おつり';
    }
    text('customer-speech',speech);text('event-notice',notice);
    text('payment-state',finalized?'確定 / READY':'確認中 / WAIT');
  }
  function renderFeedback() {
    const f=shift.feedback;const panel=$('feedback');
    panel.className='feedback';
    if(!f){text('feedback-title','YOU GOT THIS.');text('feedback-detail','速さも、正確さも、大切に。');return;}
    panel.classList.add(f.correct?'correct':'miss','pop');
    if(f.correct) {
      const milestone=f.combo>=5 && f.combo%5===0;
      text('feedback-title',milestone?(f.combo>=20?'AMAZING! ':'')+f.combo+' COMBO!':(f.seconds<=3?'PERFECT!':f.seconds<=6?'FAST!':'GOOD!')+' +'+f.bonus.points+'pt');
      const details=[milestone?'+'+f.bonus.points+'pt':seconds(f.seconds),'SPEED +'+f.bonus.speed];
      if(f.bonus.comboBonus)details.push('COMBO +'+f.bonus.comboBonus);
      if(f.bonus.hurryBonus)details.push('お急ぎ +'+f.bonus.hurryBonus);
      if(f.bonus.rushBonus)details.push('RUSH +'+f.bonus.rushBonus);
      text('feedback-detail',details.join(' / '));sound.play(milestone?'combo':'correct');
    } else {
      text('feedback-title','MISS! −100pt');
      text('feedback-detail','正解 '+number(f.expected)+'円 / 回答 '+number(f.value)+'円');sound.play('miss');
    }
  }
  function renderGame(now) {
    const changedCustomer=lastSequence!==shift.sequence;
    const changedPhase=lastPhase!==shift.phase;
    const rush=Core.rushAt(shift.elapsed(now));
    $('game-screen').classList.toggle('is-rush',rush);
    $('game-screen').classList.toggle('time-low',shift.remaining(now)<=30000);
    if(rush && !lastRush)sound.play('rush');lastRush=rush;
    text('shift-message',rush?'夕方ラッシュ！ 正解ポイント ×1.2':shift.remaining(now)<=30000?'あと少し。最後まで、ていねいに！':shift.elapsed(now)<30000?'まずは落ち着いて、お会計。':'いい調子！次のお客様をどうぞ。');
    text('score',number(shift.score));text('combo',shift.combo);
    const remaining=Math.ceil(shift.remaining(now)/1000);
    text('time',String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'));
    $('time-bar').style.width=shift.remaining(now)/Core.SHIFT_MS*100+'%';
    text('queue-count',shift.queue);text('queue-people','●'.repeat(Math.min(shift.queue,8)));
    text('correct-count',shift.correct);text('served-count',shift.served);
    if(changedCustomer) {
      $('answer').value='';text('input-error','');$('items').scrollTop=0;
      renderCustomer(false);renderFeedback();
    }
    if(changedPhase || changedCustomer) {
      const enabled=shift.phase==='answer';
      $('answer').readOnly=!enabled;$('answer').setAttribute('aria-disabled',String(!enabled));
      $('answer-button').disabled=!enabled;
      if(enabled) {
        renderCustomer(true);sound.play('scan');
        // Retain mobile focus between customers, without forcing a keyboard on initial entry.
        if(window.matchMedia('(pointer:fine)').matches)$('answer').focus({preventScroll:true});
      }
      if(shift.phase==='feedback')renderFeedback();
    }
    const mood=shift.mood(now);
    text('customer-face',['🙂','😐','😕','😠'][mood]);
    text('mood-text',['ゆっくりで大丈夫。','そろそろかな？','ちょっと待ちくたびれたかも。','お待たせしています…'][mood]);
    $('mood-bar').style.width=(100-mood*28)+'%';
    lastSequence=shift.sequence;lastPhase=shift.phase;
  }
  function submitAnswer(event) {
    event.preventDefault();sound.unlock();
    if(!shift || currentScreen!=='game')return;
    const now=Date.now();const response=shift.answer($('answer').value,now);
    if(shift.phase==='finished'){endGame();return;}
    if(response.invalid) {text('input-error','0以上の整数を入力してください（最大6桁）。');return;}
    if(response.accepted){text('input-error','');renderGame(now);}
  }
  function addDetail(container,label,value) {container.append(make('dt','',label),make('dd','',value));}
  function endGame() {
    stopLoop();$('answer').readOnly=true;$('answer-button').disabled=true;$('answer').blur();
    $('confirm-dialog').close();confirmAction=null;
    latestResult=shift.result;
    const saved=records.add(latestResult);sound.play('end');
    renderResult(latestResult,saved);showScreen('result');
  }
  function renderResult(r,saved) {
    text('result-date',new Date(r.date).toLocaleDateString('ja-JP'));
    text('result-score',number(r.score));$('new-best').hidden=!saved.newBest;
    text('result-rank','✦ '+r.rank);text('result-served',r.served+'人');
    text('result-accuracy',percentage(r.accuracy));text('result-combo',r.maxCombo);
    const details=$('result-details');details.replaceChildren();
    [['正解 / 不正解',r.correct+' / '+r.wrong],['平均回答時間（全回答）',r.served?seconds(r.average):'—'],
      ['最速回答（正解）',seconds(r.fastest)],['レジ差額',signed(r.balance)],
      ['獲得ポイント',r.points+' pt / 累計 '+number(records.data.totalPoints)+' pt']].forEach(([k,v])=>addDetail(details,k,v));
    const perfect=r.balance===0 && r.served>0;
    $('balance-banner').classList.toggle('perfect',perfect);
    $('balance-banner').replaceChildren(make('span','',perfect?'✦ レジ差額 0円！ お見事！':r.served===0?'次の勤務で、初めてのお会計を。':'レジ差額 '+signed(r.balance)),
      make('small','',perfect?'ぴったりのレジ締め。気持ちのいい勤務でした。':r.balance<0?'おつりを合計で多くお返ししました。':r.balance>0?'おつりを合計で少なくお返ししました。':'お会計はまだありません。'));
    $('new-achievements').replaceChildren(...saved.unlocked.map(a=>make('span','',a.icon+' 実績解除：'+a.name)));
  }
  function renderRecords() {
    const d=records.data;
    const stats=[['ハイスコア',number(d.highScore)+' pt'],['最高接客人数',d.bestServed+' 人'],['最大 COMBO',d.maxCombo],
      ['最高正答率',percentage(d.bestAccuracy)],['最速回答（正解）',seconds(d.fastest)],['勤務回数',d.plays+' 回'],
      ['差額0円の勤務',d.zeroBalance+' 回'],['累計獲得ポイント',number(d.totalPoints)+' pt']];
    $('record-grid').replaceChildren(...stats.map(([label,value])=>{
      const tile=make('div','record-tile');tile.append(make('span','',label),make('strong','',value));return tile;
    }));
    text('achievement-count',d.achievements.length+' / '+Core.ACHIEVEMENTS.length);
    $('achievements').replaceChildren(...Core.ACHIEVEMENTS.map(a=>{
      const unlocked=d.achievements.includes(a.id);const card=make('div','achievement'+(unlocked?' unlocked':''));
      const info=make('div');info.append(make('b','',a.name+(unlocked?' ✓':'')),make('small','',a.description));
      card.append(make('span','achievement-icon',a.icon),info);return card;
    }));
    $('history-empty').hidden=d.history.length>0;
    $('history').replaceChildren(...d.history.map(r=>{
      const row=make('tr');const date=new Date(r.date);
      [date.toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}),
        number(r.score),r.served+'人',percentage(r.accuracy),signed(r.balance)].forEach(value=>row.append(make('td','',value)));
      return row;
    }));
  }
  function confirm(title,description,label,action) {
    text('confirm-title',title);text('confirm-description',description);text('confirm-ok',label);
    confirmAction=action;$('confirm-dialog').showModal();
    $('confirm-dialog').querySelector('[data-close]').focus();
  }
  async function copyResult() {
    if(!latestResult)return;
    const r=latestResult;
    const message=['レジバイトシミュレーター 🧾','勤務ランク：'+r.rank,'SCORE '+number(r.score)+' pt',
      '接客 '+r.served+'人 / 正答率 '+percentage(r.accuracy),'最大 '+r.maxCombo+' COMBO / レジ差額 '+signed(r.balance),
      ...(location.protocol==='https:'?[location.href.split('#')[0].split('?')[0]]:[])].join('\n');
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message);toast('勤務結果をコピーしました。');
    } catch {
      $('share-text').value=message;$('share-dialog').showModal();$('share-text').focus();$('share-text').select();
    }
  }
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.action;
    if(action==='start')startGame();
    else if(action==='help')$('help-dialog').showModal();
    else showScreen(action);
  }));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
  $('confirm-ok').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;$('confirm-dialog').close();if(action)action();});
  $('confirm-dialog').addEventListener('close',()=>{confirmAction=null;});
  $('answer-form').addEventListener('submit',submitAnswer);
  $('answer').addEventListener('input',()=>text('input-error',''));
  // Suppress held Enter as well as feedback-period submissions; one key press serves one customer.
  document.addEventListener('keydown',event=>{
    if(event.key==='Enter' && event.repeat && currentScreen==='game')event.preventDefault();
  });
  $('sound-button').addEventListener('click',()=>{
    sound.enabled=!sound.enabled;records.setSound(sound.enabled);renderSound();sound.unlock();sound.play('scan');
  });
  $('quit-button').addEventListener('click',()=>confirm('勤務を中断しますか？','この勤務の記録は保存されません。確認中も勤務時間は進みます。','中断して戻る',()=>{
    stopLoop();shift.abort();showScreen('home');
  }));
  $('delete-records').addEventListener('click',()=>confirm('すべての記録を削除しますか？','ハイスコア・勤務履歴・実績を削除します。この操作は元に戻せません。音の設定は残ります。','記録を削除',()=>{
    const saved=records.clear();renderRecords();renderHome();if(saved)toast('記録を削除しました。');
  }));
  $('copy-result').addEventListener('click',copyResult);
  document.querySelector('.brand').addEventListener('click',event=>{
    event.preventDefault();
    if(currentScreen==='game')$('quit-button').click();else showScreen('home');
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.addEventListener('pageshow',()=>{if(currentScreen==='game')tick();});
  renderHome();renderSound();
})();

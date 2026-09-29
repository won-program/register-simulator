/* Pure game rules. No DOM, storage, network, or timers. All prices are integer yen. */
(() => {
  'use strict';
  const SHIFT_MS = 180000;
  const PRODUCTS = [
    ['🍙','鮭おにぎり',138],['🍙','ツナマヨおにぎり',148],['🍵','まちかど緑茶',128],
    ['🥤','りんごジュース',158],['🍞','ふんわり食パン',198],['🥐','バタークロワッサン',178],
    ['🍱','のり弁当',438],['🍱','からあげ弁当',598],['🍜','しょうゆカップ麺',218],
    ['🍫','ミルクチョコ',128],['🍪','バタークッキー',238],['🍦','バニラアイス',168],
    ['🧻','ボックスティッシュ',328],['🪥','やわらか歯ブラシ',248],['🧴','衣類用洗剤',498],
    ['🔋','単3電池 4本',398],['🥛','まろやか牛乳',228],['🥚','たまご 6個',258],
    ['🍌','バナナ 3本',198],['🍎','ふじりんご',158],['🥗','彩りサラダ',298],
    ['☕','カフェラテ',178],['💧','天然水',98],['🍬','フルーツキャンディ',118],
    ['🍮','なめらかプリン',158],['🧀','スライスチーズ',278],['🍝','ナポリタン',458],
    ['🧼','ハンドソープ',358],['🥔','うすしおポテト',148],['🍡','みたらし団子',128],
    ['🧃','野菜ミックス',108],['🥯','もっちりベーグル',168]
  ];
  const KINDS = {
    normal: {label:'いつものお客様', title:'お会計お願いします'},
    extra: {label:'追加の小銭', title:'小銭、あったかな？'},
    bag: {label:'レジ袋を追加', title:'あ、袋もお願いします'},
    large: {label:'高額紙幣', title:'大きいお札ですみません'},
    bulk: {label:'まとめ買い', title:'今日はたっぷり買い出し'},
    coins: {label:'小銭でお支払い', title:'小銭をまとめて使います'},
    hurry: {label:'お急ぎのお客様', title:'もうすぐ電車が来るんです'}
  };
  const ACHIEVEMENTS = [
    {id:'first', icon:'🌱', name:'初出勤', description:'初めての勤務を完了', test:(r,s)=>s.plays>=1},
    {id:'noMiss', icon:'🎯', name:'ノーミス勤務', description:'1人以上接客して正答率100%', test:r=>r.served>0 && r.wrong===0},
    {id:'balanced', icon:'🧾', name:'レジ締め完璧', description:'1人以上接客して差額0円', test:r=>r.served>0 && r.balance===0},
    {id:'combo10', icon:'🔥', name:'10 COMBO', description:'10回連続で正解', test:r=>r.maxCombo>=10},
    {id:'combo20', icon:'⚡', name:'20 COMBO', description:'20回連続で正解', test:r=>r.maxCombo>=20},
    {id:'speed', icon:'🚀', name:'スピードスター', description:'3秒以内の正解を累計10回', test:(r,s)=>s.fastCorrect>=10},
    {id:'veteran', icon:'🏅', name:'ベテラン', description:'勤務を累計10回完了', test:(r,s)=>s.plays>=10}
  ];
  const pick = (items, rng) => items[Math.floor(rng() * items.length)];
  const rushAt = elapsed => (elapsed >= 60000 && elapsed < 85000) || (elapsed >= 125000 && elapsed < 155000);
  const chooseKind = (elapsed, rng) => {
    if (elapsed < 30000) return 'normal';
    const specialChance = elapsed < 90000 ? .58 : .78;
    if (rng() > specialChance) return 'normal';
    const choices = elapsed < 60000 ? ['extra','bag','hurry','bulk'] : ['extra','bag','large','bulk','coins','hurry'];
    if (elapsed >= 120000) choices.push('large','coins');
    return pick(choices,rng);
  };
  function coinBreakdown(amount) {
    const result = [];
    [500,100,50,10,5,1].forEach(value => {
      const count = Math.floor(amount/value);
      if (count) result.push({value, count});
      amount %= value;
    });
    return result;
  }
  function generateCustomer(elapsed, rng = Math.random, kindOverride) {
    const kind = kindOverride || chooseKind(elapsed,rng);
    const count = kind === 'bulk' ? 5 + Math.floor(rng()*2) : elapsed < 30000 ? 1 + Math.floor(rng()*2) : 2 + Math.floor(rng()*(rushAt(elapsed) ? 3 : 2));
    const pool = elapsed < 30000 ? PRODUCTS.filter(p=>p[2]<200) : PRODUCTS;
    const items = Array.from({length:count},()=> {
      const [icon,name,base] = pick(pool,rng);
      const price = elapsed < 30000 ? base : base + pick([-10,0,0,10,20],rng);
      return {icon,name,price};
    });
    const initialTotal = items.reduce((sum,p)=>sum+p.price,0);
    const total = initialTotal + (kind==='bag' ? 5 : 0);
    let tender = Math.ceil(total / (elapsed<30000 ? 500 : 1000)) * (elapsed<30000 ? 500 : 1000);
    if (kind==='large') tender = total<=5000 && rng()<.7 ? 5000 : 10000;
    if (kind==='coins') tender = Math.ceil(total/100)*100 + pick([0,35,64,79],rng);
    const initialTender = tender;
    const extra = kind==='extra' ? pick([3,12,23,45,67,82],rng) : 0;
    tender += extra;
    return {kind,items,initialTotal,total,initialTender,tender,extra,change:tender-total,
      coins:kind==='coins' ? coinBreakdown(tender) : [], ...KINDS[kind]};
  }
  function parseAnswer(raw) {
    const normalized = String(raw).trim().replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
    if (!/^\d{1,6}$/.test(normalized)) return null;
    return Number(normalized);
  }
  function calculateScore(seconds, combo, rush, hurry) {
    const speed = Math.max(0,Math.round(50-seconds*5));
    const comboBonus = Math.min(50,Math.max(0,combo-1)*5);
    const hurryBonus = hurry && seconds<=5 ? 25 : 0;
    const subtotal = 100 + speed + comboBonus + hurryBonus;
    return {speed,comboBonus,hurryBonus,rushBonus:rush?Math.round(subtotal*.2):0,
      points:rush?Math.round(subtotal*1.2):subtotal};
  }
  function rankResult(result) {
    if(result.served>=30 && result.accuracy>=95 && result.average<=5) return 'レジマスター';
    if(result.served>=20 && result.accuracy>=90) return 'レジの達人';
    if(result.served>=10 && result.accuracy>=75) return '頼れるレジスタッフ';
    return '新人アルバイト';
  }
  class Shift {
    constructor(rng = Math.random) { this.rng=rng; this.phase='idle'; }
    start(now) {
      this.startedAt=now; this.deadline=now+SHIFT_MS; this.phase='event';
      this.score=0; this.combo=0; this.maxCombo=0; this.correct=0; this.wrong=0;
      this.served=0; this.balance=0; this.times=[]; this.fastest=null; this.fastCorrect=0;
      this.queue=2; this.nextArrival=now+8500; this.sequence=0; this.feedback=null; this.result=null;
      this.nextCustomer(now);
    }
    elapsed(now) { return Math.max(0,now-this.startedAt); }
    remaining(now) { return Math.max(0,this.deadline-now); }
    nextCustomer(now) {
      this.customer=generateCustomer(this.elapsed(now),this.rng);
      this.sequence++; this.phase='event'; this.feedback=null;
      this.readyAt=now+(['bag','extra'].includes(this.customer.kind)?1100:280);
      this.answerStartedAt=null;
    }
    update(now) {
      if(['idle','finished','aborted'].includes(this.phase)) return;
      // Check the deadline first: no delayed event or answer can outlive the shift.
      if(now>=this.deadline) { this.finish(now); return; }
      while(now>=this.nextArrival) {
        this.queue=Math.min(12,this.queue+1);
        this.nextArrival+=rushAt(this.elapsed(this.nextArrival))?3500:8500;
      }
      if(this.phase==='feedback' && now>=this.nextAt) this.nextCustomer(now);
      if(this.phase==='event' && now>=this.readyAt) {
        this.phase='answer';
        // Start only when the UI can actually render the final problem, not at the scheduled time.
        this.answerStartedAt=now;
      }
    }
    answer(raw,now) {
      const wasAnswer=this.phase==='answer'; const sequence=this.sequence;
      this.update(now);
      if(!wasAnswer || this.phase!=='answer' || this.sequence!==sequence) return {accepted:false};
      const value=parseAnswer(raw);
      if(value===null) return {accepted:false,invalid:true};
      const seconds=Math.max(0,(now-this.answerStartedAt)/1000);
      const correct=value===this.customer.change;
      this.served++; this.times.push(seconds); this.queue=Math.max(0,this.queue-1);
      // Returning too much cash reduces the cash remaining in the drawer.
      this.balance+=this.customer.change-value;
      let bonus=null;
      if(correct) {
        this.correct++; this.combo++; this.maxCombo=Math.max(this.maxCombo,this.combo);
        this.fastest=this.fastest===null?seconds:Math.min(this.fastest,seconds);
        if(seconds<=3) this.fastCorrect++;
        bonus=calculateScore(seconds,this.combo,rushAt(this.elapsed(now)),this.customer.kind==='hurry');
        this.score+=bonus.points;
      } else {
        this.wrong++; this.combo=0; this.score=Math.max(0,this.score-100);
      }
      this.feedback={accepted:true,correct,value,expected:this.customer.change,seconds,bonus,combo:this.combo};
      this.phase='feedback'; this.nextAt=now+(correct?540:1450);
      return this.feedback;
    }
    mood(now) {
      if(this.phase!=='answer') return 0;
      const seconds=(now-this.answerStartedAt)/1000;
      const step=this.customer.kind==='hurry'?5:10;
      return Math.min(3,Math.floor(seconds/step));
    }
    abort() { this.phase='aborted'; }
    finish(now) {
      if(this.phase==='finished') return this.result;
      this.phase='finished';
      const average=this.times.length?this.times.reduce((a,b)=>a+b,0)/this.times.length:0;
      this.result={date:new Date(now).toISOString(),score:this.score,served:this.served,
        correct:this.correct,wrong:this.wrong,accuracy:this.served?this.correct/this.served*100:0,
        average,fastest:this.fastest,maxCombo:this.maxCombo,balance:this.balance,
        points:Math.floor(this.score/100),fastCorrect:this.fastCorrect};
      this.result.rank=rankResult(this.result);
      return this.result;
    }
  }
  window.RegisterCore=Object.freeze({SHIFT_MS,PRODUCTS,KINDS,ACHIEVEMENTS,Shift,generateCustomer,
    coinBreakdown,parseAnswer,calculateScore,rankResult,rushAt});
})();

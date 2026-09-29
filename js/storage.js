(() => {
  'use strict';
  const KEY='machikado-register-v1';
  const defaults=()=>({version:1,highScore:0,bestServed:0,maxCombo:0,bestAccuracy:0,fastest:null,
    plays:0,zeroBalance:0,fastCorrect:0,totalPoints:0,sound:false,achievements:[],history:[]});
  const finite=(value,max=1e12)=>typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max;
  function validResult(r) {
    return r && typeof r==='object' && typeof r.date==='string' && Number.isFinite(Date.parse(r.date)) &&
      ['score','served','correct','wrong','maxCombo','points','fastCorrect','average'].every(k=>finite(r[k])) &&
      finite(r.accuracy,100) && (r.fastest===null || finite(r.fastest)) && Number.isFinite(r.balance) && Math.abs(r.balance)<=1e12 &&
      typeof r.rank==='string' && r.rank.length<50;
  }
  function sanitize(raw) {
    const clean=defaults();
    if(!raw || typeof raw!=='object' || raw.version!==1) return clean;
    ['highScore','bestServed','maxCombo','plays','zeroBalance','fastCorrect','totalPoints'].forEach(k=>{
      if(finite(raw[k])) clean[k]=Math.floor(raw[k]);
    });
    if(finite(raw.bestAccuracy,100)) clean.bestAccuracy=raw.bestAccuracy;
    if(finite(raw.fastest)) clean.fastest=raw.fastest;
    clean.sound=raw.sound===true;
    const ids=window.RegisterCore.ACHIEVEMENTS.map(a=>a.id);
    clean.achievements=Array.isArray(raw.achievements)?[...new Set(raw.achievements.filter(id=>ids.includes(id)))]:[];
    clean.history=Array.isArray(raw.history)?raw.history.filter(validResult).slice(0,20):[];
    return clean;
  }
  class Records {
    constructor(onError=()=>{}) {
      this.onError=onError;
      this.data=defaults();
      try {
        const raw=localStorage.getItem(KEY);
        if(raw) this.data=sanitize(JSON.parse(raw));
      } catch { this.onError('記録を読み込めませんでした。このページでは続けて遊べます。'); }
    }
    save() {
      try { localStorage.setItem(KEY,JSON.stringify(this.data)); return true; }
      catch { this.onError('記録を保存できません。ブラウザの保存設定・空き容量を確認してください。'); return false; }
    }
    add(result) {
      const d=this.data;
      const newBest=result.score>d.highScore;
      d.plays++; d.highScore=Math.max(d.highScore,result.score);
      d.bestServed=Math.max(d.bestServed,result.served); d.maxCombo=Math.max(d.maxCombo,result.maxCombo);
      d.bestAccuracy=Math.max(d.bestAccuracy,result.accuracy); d.fastCorrect+=result.fastCorrect;
      if(result.fastest!==null) d.fastest=d.fastest===null?result.fastest:Math.min(d.fastest,result.fastest);
      if(result.served>0 && result.balance===0) d.zeroBalance++;
      d.totalPoints+=result.points;
      const unlocked=[];
      window.RegisterCore.ACHIEVEMENTS.forEach(a=>{
        if(!d.achievements.includes(a.id) && a.test(result,d)) { d.achievements.push(a.id); unlocked.push(a); }
      });
      d.history.unshift({...result}); d.history=d.history.slice(0,20);
      const saved=this.save(); return {newBest,unlocked,saved};
    }
    setSound(enabled) { this.data.sound=enabled; this.save(); }
    clear() {
      const sound=this.data.sound;
      this.data=defaults(); this.data.sound=sound;
      return this.save();
    }
  }
  window.RegisterStorage=Object.freeze({Records,KEY,sanitize});
})();

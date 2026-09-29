(() => {
  'use strict';
  class Sound {
    constructor(enabled=false) { this.enabled=enabled; this.context=null; }
    unlock() {
      if(!this.enabled) return;
      try {
        const AudioContext=window.AudioContext || window.webkitAudioContext;
        if(!AudioContext) return;
        if(!this.context) this.context=new AudioContext();
        if(this.context.state==='suspended') this.context.resume().catch(()=>{});
      } catch { /* Sound is optional; the game stays playable without audio. */ }
    }
    play(kind) {
      if(!this.enabled || !this.context || this.context.state!=='running') return;
      const notes={scan:[1047],correct:[660,880],miss:[220,165],combo:[660,880,1108],start:[523,659,784],end:[784,659,523,1047],rush:[440,660,880]};
      try {
        (notes[kind]||notes.scan).forEach((hz,i)=>{
          const at=this.context.currentTime+i*.09;
          const oscillator=this.context.createOscillator(); const gain=this.context.createGain();
          oscillator.type=kind==='miss'?'triangle':'sine'; oscillator.frequency.value=hz;
          gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(.075,at+.008);
          gain.gain.exponentialRampToValueAtTime(.001,at+.13);
          oscillator.connect(gain); gain.connect(this.context.destination);
          oscillator.start(at); oscillator.stop(at+.15);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
        });
      } catch { /* Unsupported or closed audio context must not interrupt a shift. */ }
    }
  }
  window.RegisterSound=Sound;
})();

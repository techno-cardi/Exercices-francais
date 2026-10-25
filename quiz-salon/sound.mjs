// Original procedural sound effects. No remote audio, download or music license.
const note=(frequency,at=0,duration=.15,gain=.055,type='sine')=>({frequency,at,duration,gain,type});
export const SOUNDS={
 select:[note(660,0,.07,.035),note(880,.065,.1,.025)],
 join:[note(523,0,.12),note(784,.12,.2)],
 start:[note(392,0,.14),note(523,.14,.14),note(659,.28,.14),note(784,.42,.4,.075)],
 question:[note(330,0,.1,.035),note(494,.09,.18,.04)],
 tick:[note(900,0,.06,.035,'triangle')],
 timeout:[note(196,0,.22,.055,'triangle'),note(147,.18,.38,.045,'triangle')],
 correct:[note(523,0,.13),note(659,.12,.13),note(784,.24,.3,.065),note(1046,.28,.3,.025)],
 wrong:[note(294,0,.18,.045,'triangle'),note(220,.17,.25,.04,'triangle')],
 reveal:[note(440,0,.12,.04),note(554,.11,.12,.04),note(659,.22,.3,.05)],
 finish:[note(392,0,.12),note(523,.12,.12),note(659,.24,.12),note(784,.36,.28),note(659,.65,.12),note(784,.78,.12),note(1046,.9,.7,.07),note(523,.9,.7,.025)]
};
export class GameAudio{
 constructor(enabled=true){this.enabled=enabled;this.context=null;}
 unlock(){if(!this.enabled)return;try{const C=window.AudioContext||window.webkitAudioContext;if(C){this.context||=new C();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}}catch{}}
 play(event){if(!this.enabled)return;this.unlock();const ctx=this.context;if(!ctx||ctx.state!=='running')return;for(const n of SOUNDS[event]||SOUNDS.select){const oscillator=ctx.createOscillator(),volume=ctx.createGain(),start=ctx.currentTime+n.at;oscillator.type=n.type;oscillator.frequency.setValueAtTime(n.frequency,start);volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(n.gain,start+.012);volume.gain.exponentialRampToValueAtTime(.0001,start+n.duration);oscillator.connect(volume);volume.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+n.duration+.02);}}
}

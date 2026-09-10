export class Sound {
 context?:AudioContext; muted=false; lastStep=0;
 start(){this.context??=new AudioContext();void this.context.resume()}
 tone(freq:number,time=.2,type:OscillatorType='sine',vol=.04){if(this.muted||!this.context)return;const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.6,t+time);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+time);o.connect(g).connect(this.context.destination);o.start(t);o.stop(t+time)}
 cast(spell:string){this.tone(spell==='unfold'?523:spell==='mend'?660:330,.7,'triangle');if(spell==='unfold')for(let i=1;i<5;i++)setTimeout(()=>this.tone(523*Math.pow(1.25,i),.5,'sine',.025),i*180)}
 step(){const now=performance.now();if(now-this.lastStep>360){this.lastStep=now;this.tone(95,.065,'triangle',.018)}}
}

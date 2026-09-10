"""Original deterministic offline sound design. No recordings, external samples or model inputs.
22.05 kHz mono PCM, gentle headroom. Rebuild: python scripts/author-audio.py
"""
import math, random, wave, struct
from pathlib import Path
RATE=22050
out=Path('public/audio');out.mkdir(exist_ok=True)
def render(name,duration,fn):
    rng=random.Random(712); state={'prev':0.0}; data=[]
    for i in range(int(RATE*duration)):
        t=i/RATE; n=rng.uniform(-1,1);state['prev']=.84*state['prev']+.16*n
        v=fn(t,n,state['prev']);fade=min(1,t/.009,(duration-t)/.06);data.append(max(-.9,min(.9,v*fade)))
    with wave.open(str(out/(name+'.wav')),'wb') as f:
        f.setparams((1,2,RATE,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',int(v*32767)) for v in data))
def bell(t,f,decay=3):
    return sum(math.sin(t*math.tau*f*r)*math.exp(-t*(decay+j*2))/(j+1)**1.5 for j,r in enumerate([1,2.73,4.12,6.81]))
def onset(t):return math.sin(math.tau*(280*t+210*t*t))*math.exp(-t*5)*.12
render('courtyard',12,lambda t,n,l: .07*l*(.7+.3*math.sin(t*.8))+.006*math.sin(t*math.tau*146.83)+sum(.018*math.sin(math.tau*(1800*(t-k)+380*(t-k)**2))*math.sin((t-k)*math.pi/ .26)**2 if 0<t-k<.26 else 0 for k in [1.3,1.65,5.1,8.4,8.7,9.05]))
render('step-a',.22,lambda t,n,l: .28*l*math.exp(-t*22)+.16*n*math.exp(-t*38)+.1*math.sin(t*math.tau*78)*math.exp(-t*26))
render('step-b',.24,lambda t,n,l: .23*l*math.exp(-t*19)+.14*n*math.exp(-t*34)+.09*math.sin(t*math.tau*91)*math.exp(-t*25))
render('book',.36,lambda t,n,l: .27*(n-l)*math.exp(-((t-.1)/.06)**2)+.11*l*math.exp(-t*18))
render('cast',.9,lambda t,n,l: onset(t)+.11*bell(t,710,6)+.08*(n-l)*math.sin(min(t/.35,1)*math.pi)*math.exp(-t*4))
render('impact',.7,lambda t,n,l: .22*l*math.exp(-t*9)+.18*bell(t,123,10))
render('ward',1.1,lambda t,n,l: .16*bell(t,440,3)+.09*bell(max(t-.08,0),660,4)+.018*l)
render('atlas',1.15,lambda t,n,l: .16*bell(t,83,4)+.09*bell(t,121,5)+.18*l*sum(math.exp(-((t-k)/.025)**2) for k in [.07,.29,.55,.84]))
def signature(t,n,l):
    pages=.22*(n-l)*sum(math.exp(-((t-k)/.09)**2) for k in [.06,.26,.48])
    chord=sum(.065*bell(max(0,t-k),f,1.5) if t>=k else 0 for k,f in zip([.35,.65,.95,1.25],[261.63,392,523.25,659.25]))
    flight=.035*math.sin(math.tau*(170*t+90*t*t))*math.sin(min(t/2.4,1)*math.pi)
    impact=(.24*l+.16*bell(t-2.15,98,5))*math.exp(-(t-2.15)*6) if t>2.15 else 0
    return pages+chord+flight+impact
render('signature',3.4,signature)

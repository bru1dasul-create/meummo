const assert=require('assert');
class Parameter {
 constructor(value=0){this.value=value;this.history=[];}
 setValueAtTime(v,t){assert(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.history.push(v);}
 exponentialRampToValueAtTime(v,t){assert(v>0);this.setValueAtTime(v,t);}
 linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}
 setTargetAtTime(v,t,time){assert(time>0);this.setValueAtTime(v,t);}
 cancelScheduledValues(){}
}
class Node {
 constructor(c){this.context=c;this.gain=new Parameter();this.frequency=new Parameter(440);this.pan=new Parameter();this.connections=[];}
 connect(n){this.connections.push(n);return n;}
 disconnect(){this.connections.length=0;}
 start(){assert(!this.started);this.started=true;this.context.active.add(this);}
 stop(t){this.stopAt=t;}
}
class AudioContextMock {
 static instances=[];
 constructor(){this.currentTime=0;this.sampleRate=24000;this.state='suspended';this.destination={};this.active=new Set();this.nodes=[];AudioContextMock.instances.push(this);}
 node(){const n=new Node(this);this.nodes.push(n);return n;}
 createGain(){return this.node();}createOscillator(){return this.node();}createBufferSource(){return this.node();}createBiquadFilter(){return this.node();}createStereoPanner(){return this.node();}
 createBuffer(_channels,len){return {getChannelData:()=>new Float32Array(len)};}
 resume(){this.state='running';return Promise.resolve();}
 advance(dt){this.currentTime+=dt;for(const n of [...this.active])if(n.stopAt!=null&&n.stopAt<=this.currentTime){this.active.delete(n);n.onended?.();}}
}
module.exports={AudioContextMock};

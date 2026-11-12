// Resposta às inversões e fidelidade às poses da revisão aprovada.
const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs');
const root=path.resolve(__dirname,'..'),P=load(root),M=P.math;
const rows=[],failures=[];
const approvedTimes=JSON.parse(fs.readFileSync(path.join(root,'auditoria/tempo-inversoes-r2.json'),'utf8')).rows;
const lastApprovedTimes=JSON.parse(fs.readFileSync(path.join(root,'auditoria/tempo-inversoes-r3.json'),'utf8')).rows;
let maxResponseDelta=0;
for(const hz of [30,60,120])for(const run of [false,true])for(let d=0;d<8;d++){
 const yaw=-Math.PI/4+d*Math.PI/4,target=yaw+Math.PI,ch=new P.Character(0,0,yaw);
 let moving=null,started=false,minGap=Infinity;
 for(let k=0;k<hz*3;k++){
  const angle=k/hz<1?yaw:target;
  ch.update(1/hz,{move:{x:Math.cos(angle),y:Math.sin(angle)},run},null);
  const rig=P.rig.buildRig(ch.pose());ch.secondary(rig,1/hz);
  minGap=Math.min(minGap,M.dot(M.sub(rig.ankle[1],rig.ankle[0]),rig.body.r));
  if(k/hz>=1){
   started ||= !!ch.turnInPlace;
   const toward=ch.vel.x*Math.cos(target)+ch.vel.y*Math.sin(target);
   if(moving===null&&toward>0.25*(run?440:160))moving=(k+1)/hz-1;
  }
 }
 const row={hz,run,direction:d*45,moving,minGap};rows.push(row);
 const approved=approvedTimes.find(r=>r.hz===hz&&r.run===run&&r.direction===d*45);
 const lastApproved=lastApprovedTimes.find(r=>r.hz===hz&&r.run===run&&r.direction===d*45);
 maxResponseDelta=Math.max(maxResponseDelta,Math.abs((moving??Infinity)-lastApproved.moving));
  if(!started||moving===null||moving>approved.moving+1e-6||minGap<0)failures.push(row);
}
const reference=JSON.parse(fs.readFileSync(path.join(root,'auditoria/poses-aprovadas-r2.json'),'utf8'));
let maxDelta=0;
for(const kind of ['andar','correr','agachado','pulo']){
 const ch=new P.Character(0,0,0);let frame=0;
 for(let k=0;k<480;k++){
  ch.update(1/120,{move:kind==='pulo'?null:{x:1,y:0},run:kind==='correr',crouchSet:kind==='agachado',jump:kind==='pulo'&&k===120},null);
  const rig=P.rig.buildRig(ch.pose());ch.secondary(rig,1/120);
  if(k%30===29){
   const actual=[rig.pelvis.o,rig.chest.o,rig.head.o,...rig.knee,...rig.ankle,...rig.wrist].flatMap(p=>[p.x,p.y,p.z]);
   for(let j=0;j<actual.length;j++)maxDelta=Math.max(maxDelta,Math.abs(actual[j]-reference[kind][frame][j]));
   frame++;
  }
 }
}
if(maxDelta>1e-6)failures.push({approvedPoseDeltaCm:maxDelta});
if(maxResponseDelta>1e-6)failures.push({approvedResponseDeltaSeconds:maxResponseDelta});
const beforeMean=approvedTimes.reduce((s,r)=>s+r.moving,0)/approvedTimes.length;
const afterMean=rows.reduce((s,r)=>s+(r.moving??Infinity),0)/rows.length;
if(afterMean>beforeMean*0.9)failures.push({beforeMean,afterMean,minimumImprovement:0.1});
console.log(JSON.stringify({responseScenarios:rows.length,failures:failures.length,maxResponse:Math.max(...rows.map(r=>r.moving??Infinity)),beforeMean,afterMean,approvedPoseDeltaCm:maxDelta,approvedResponseDeltaSeconds:maxResponseDelta},null,2));
for(const f of failures.slice(0,10))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_RESPONSE_OUTPUT)fs.writeFileSync(process.env.PD_RESPONSE_OUTPUT,JSON.stringify({rows,maxDelta,maxResponseDelta,failures},null,2));
process.exitCode=failures.length?1:0;

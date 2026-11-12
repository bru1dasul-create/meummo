const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs'),root=path.resolve(__dirname,'..'),P=load(root),M=P.math;
const baseline=JSON.parse(fs.readFileSync(path.join(root,'auditoria/resposta-esquiva-r6.json'),'utf8')).rows;
const rows=[],failures=[];let maxDeathFootGap=0;
for(const hz of [30,60,120])for(let d=0;d<8;d++){
 const yaw=d*Math.PI/4,ch=new P.Character(0,0,yaw);let end=null,to60=null;
 for(let k=0;k<hz;k++){
  ch.update(1/hz,{dodge:k===0},null);const rig=P.rig.buildRig(ch.pose());ch.secondary(rig,1/hz);
  const along=ch.pos.x*Math.cos(yaw)+ch.pos.y*Math.sin(yaw);
  if(to60===null&&along>=60)to60=(k+1)/hz;
  if(end===null&&!ch.dodge)end=(k+1)/hz;
 }
 const distance=ch.pos.x*Math.cos(yaw)+ch.pos.y*Math.sin(yaw),before=baseline.find(r=>r.hz===hz&&r.direction===d*45);
 const row={hz,direction:d*45,end,to60,distance,before};rows.push(row);
 if(end===null||to60===null||end>before.end*.8||to60>before.to60*.85||distance<before.distance*1.1)failures.push(row);
 const corpse=new P.Character(0,0,yaw);
 for(let k=0;k<hz*2.2;k++){corpse.update(1/hz,{die:k===0},null);const r=P.rig.buildRig(corpse.pose());corpse.secondary(r,1/hz);}
 const rig=P.rig.buildRig(corpse.pose());
 for(let i=0;i<2;i++){
  const side=i?1:-1;
  const h=Math.min(...P.MODEL.FOOT.map(s=>M.at(rig.foot[i],-side*s.s,s.f,s.u).z-s.r),...P.MODEL.TOES.big.concat(P.MODEL.TOES.small).map(s=>M.at(rig.toe[i],-side*s.s,s.f,s.u).z-s.r));
  maxDeathFootGap=Math.max(maxDeathFootGap,Math.abs(h-corpse.groundZ));
 }
 if(corpse.label!=='Morto')failures.push({hz,direction:d*45,deathNotFinished:true});
}
if(maxDeathFootGap>.3)failures.push({maxDeathFootGap});
const mean=(list,key)=>list.reduce((s,r)=>s+r[key],0)/list.length;
const summary={scenarios:rows.length,failures:failures.length,distanceBefore:mean(baseline,'distance'),distanceAfter:mean(rows,'distance'),durationBefore:mean(baseline,'end'),durationAfter:mean(rows,'end'),timeTo60Before:mean(baseline,'to60'),timeTo60After:mean(rows,'to60'),maxDeathFootGap};
console.log(JSON.stringify(summary,null,2));for(const f of failures)console.error('FALHA',JSON.stringify(f));
if(process.env.PD_POLISH_OUTPUT)fs.writeFileSync(process.env.PD_POLISH_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

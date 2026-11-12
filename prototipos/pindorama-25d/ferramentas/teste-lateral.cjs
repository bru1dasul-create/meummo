// Exercita o caso relatado: esquerda/direita repetidos, sem descartar a partida.
const path = require('path');
const {load}=require('../auditoria/medir.cjs');
const P=load(path.resolve(__dirname,'..')),M=P.math,B=P.BODY;
const failures=[], results=[];
for(const hz of [30,60,120])for(const run of [false,true])for(const period of [.2,.35,.6,1])for(let direction=0;direction<8;direction++){
 const yaw=-Math.PI/4+direction*Math.PI/4,ch=new P.Character(0,0,yaw);
 const row={hz,run,period,direction:direction*45,cross:0,minGap:Infinity,ghost:0,ik:0,hipDrop:0,maxLift:0};
 for(let k=0;k<hz*6;k++){
  const angle=yaw+(Math.floor(k/hz/period)%2?Math.PI:0);
  ch.update(1/hz,{move:{x:Math.cos(angle),y:Math.sin(angle)},run},null);
  const rig=P.rig.buildRig(ch.pose());ch.secondary(rig,1/hz);
  const gap=M.dot(M.sub(rig.ankle[1],rig.ankle[0]),rig.body.r);
  row.minGap=Math.min(row.minGap,gap);if(gap<-.05)row.cross++;
  row.hipDrop=Math.max(row.hipDrop,ch.hipDrop);
  for(let i=0;i<2;i++){
   row.ik=Math.max(row.ik,rig.ik.leg[i].err);row.maxLift=Math.max(row.maxLift,rig.ankle[i].z);
   const st=ch.footLock[i];
   if(st.planted&&!st.step&&ch.jump.state!=='ar'){
    const h=Math.min(M.at(rig.foot[i],0,-B.heelBack,-B.ankleHeight).z,M.at(rig.foot[i],0,B.ballFwd,-B.ankleHeight).z,M.at(rig.toe[i],0,4.3,0).z);
    row.ghost=Math.max(row.ghost,Math.abs(h-ch.groundZ));
   }
  }
 }
 results.push(row);
 if(row.cross||row.ik>.5||row.ghost>.3||!run&&row.hipDrop>11||!run&&row.maxLift>27)failures.push(row);
}
// A marcha não pode voltar a parecer agachada para "melhorar" uma métrica de tranco.
const ch=new P.Character(0,0,0);let z=0,n=0;
for(let k=0;k<600;k++){
 ch.update(1/120,{move:{x:1,y:0}},null);const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/120);
 if(k>=180){z+=r.pelvis.o.z;n++;}
}
const meanHip=z/n;
if(meanHip<B.hipStand-3)failures.push({meanHip,minimum:B.hipStand-3});
console.log(JSON.stringify({scenarios:results.length,failures:failures.length,minGap:Math.min(...results.map(r=>r.minGap)),meanHip,walkingMaxDrop:Math.max(...results.filter(r=>!r.run).map(r=>r.hipDrop)),walkingMaxLift:Math.max(...results.filter(r=>!r.run).map(r=>r.maxLift))},null,2));
for(const failure of failures.slice(0,12))console.error('FALHA',JSON.stringify(failure));
if(process.env.PD_AUDIT_OUTPUT)require('fs').writeFileSync(process.env.PD_AUDIT_OUTPUT,JSON.stringify({results,meanHip,failures},null,2));
process.exitCode=failures.length?1:0;

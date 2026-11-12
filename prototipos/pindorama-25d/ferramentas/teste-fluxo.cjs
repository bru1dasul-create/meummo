// Continuidade de movimento na esquiva e assentamento da morte, em espaço do mundo.
const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs');
const root=path.resolve(__dirname,'..'),P=load(root),M=P.math,B=P.BODY,rows=[],failures=[];
function frame(ch,dt,input,world=null){
 ch.update(dt,input,world);const r=P.rig.buildRig(ch.pose());ch.secondary(r,dt);return r;
}
function inspect(ch,r,row){
 row.ik=Math.max(row.ik,...r.ik.leg.map(x=>x.err),...r.ik.arm.map(x=>x.err));
 row.gap=Math.min(row.gap,M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r));
 if(![r.head.o,r.pelvis.o,...r.knee,...r.ankle,...r.wrist].every(p=>[p.x,p.y,p.z].every(Number.isFinite)))row.finite=false;
 for(let i=0;i<2;i++){
  for(const [a,b,len] of [[r.hip[i],r.knee[i],B.thigh],[r.knee[i],r.ankle[i],B.shin],[r.shoulder[i],r.elbow[i],B.upperArm],[r.elbow[i],r.wrist[i],B.forearm]])row.bone=Math.max(row.bone,Math.abs(M.dist(a,b)-len));
  if(ch.footLock[i].planted&&!ch.footLock[i].step&&!ch.death&&ch.jump.state==='chao'){
   const h=Math.min(M.at(r.foot[i],0,-B.heelBack,-B.ankleHeight).z,M.at(r.foot[i],0,B.ballFwd,-B.ankleHeight).z,M.at(r.toe[i],0,4.3,0).z)-ch.groundZ;
   row.contact=Math.max(row.contact,Math.abs(h));
  }
 }
 if(ch.death||ch.dodge)row.below=Math.max(row.below,...P.rig.supportSpheres(r).map(s=>ch.groundZ-s.p.z+s.r));
}
function makeRow(data){return {...data,finite:true,ik:0,gap:Infinity,bone:0,contact:0,below:0};}
function physical(row){return row.finite&&row.ik<.5&&row.gap>=-.05&&row.bone<1e-6&&row.contact<.3&&row.below<.3;}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const run of [false,true])for(let phaseSlot=0;phaseSlot<8;phaseSlot++){
 const yaw=d*Math.PI/4,move={x:Math.cos(yaw),y:Math.sin(yaw)},ch=new P.Character(0,0,yaw),speed=run?440:160;
 for(let k=0;k<hz+Math.round(phaseSlot*hz*.07);k++)frame(ch,1/hz,{move,run});
 const row=makeRow({kind:'held',hz,direction:d*45,phaseSlot,run,exit:null,minVelocity:Infinity,idle:0,exitLabel:null,phaseAdvanced:false});let phase=null;
 for(let k=0;k<hz;k++){
  const r=frame(ch,1/hz,{move,run,dodge:k===0});inspect(ch,r,row);
  row.minVelocity=Math.min(row.minVelocity,Math.hypot(ch.vel.x,ch.vel.y));
  if(!ch.dodge&&row.exit===null){row.exit=(k+1)/hz;row.exitLabel=ch.label;phase=ch.phase;}
  if(row.exit!==null){if(ch.label==='Parado')row.idle++;if(Math.abs(ch.phase-phase)>.03)row.phaseAdvanced=true;}
 }
 if(!physical(row)||row.exit===null||row.exit>.28||row.exitLabel!==(run?'Correndo':'Andando')||row.idle||!row.phaseAdvanced||row.minVelocity<speed-.01)failures.push(row);
 rows.push(row);
}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const kind of ['release','wall']){
 const yaw=d*Math.PI/4,dir={x:Math.cos(yaw),y:Math.sin(yaw)},ch=new P.Character(0,0,yaw);
 for(let k=0;k<hz;k++)frame(ch,1/hz,{move:dir,run:true});
 const start={...ch.pos},wall=kind==='wall'?{heightAt:()=>0,collide:(x,y)=>{
  const beyond=Math.max(0,(x-start.x)*dir.x+(y-start.y)*dir.y-38);return {x:x-dir.x*beyond,y:y-dir.y*beyond};
 }}:null,row=makeRow({kind,hz,direction:d*45,maxAlong:0});
 for(let k=0;k<hz;k++){
  const r=frame(ch,1/hz,{move:kind==='wall'||k<hz*.1?dir:null,run:true,dodge:k===0},wall);inspect(ch,r,row);
  row.maxAlong=Math.max(row.maxAlong,(ch.pos.x-start.x)*dir.x+(ch.pos.y-start.y)*dir.y);
 }
 row.finalSpeed=Math.hypot(ch.vel.x,ch.vel.y);row.label=ch.label;
 if(!physical(row)||kind==='release'&&(row.label!=='Parado'||row.finalSpeed>.001)||kind==='wall'&&row.maxAlong>38.001)failures.push(row);
 rows.push(row);
}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const context of ['idle','walk','run','crouch','jump','attack','dodge','impact']){
 const yaw=d*Math.PI/4,move={x:Math.cos(yaw),y:Math.sin(yaw)},ch=new P.Character(0,0,yaw);
 for(let k=0;k<hz;k++)frame(ch,1/hz,{move:['walk','run'].includes(context)?move:null,run:context==='run',crouchSet:context==='crouch',
  jump:context==='jump'&&k===Math.round(.7*hz),attack:context==='attack'&&k===Math.round(.95*hz),dodge:context==='dodge'&&k===Math.round(.8*hz),hit:context==='impact'&&k===Math.round(.9*hz)});
 const row=makeRow({kind:'death',hz,direction:d*45,context,chestDrift:0,headDrift:0,finalMotion:0});let chest=null,head=null,final=null;
 for(let k=0;k<hz*2.5;k++){
  const r=frame(ch,1/hz,{die:k===0});inspect(ch,r,row);
  const fallT=ch.death.t-ch.death.fallDelay;
  if(fallT>=.72){
   chest ||= {...r.chest.o};head ||= {...r.head.o};
   row.chestDrift=Math.max(row.chestDrift,Math.hypot(r.chest.o.x-chest.x,r.chest.o.y-chest.y));
   row.headDrift=Math.max(row.headDrift,Math.hypot(r.head.o.x-head.x,r.head.o.y-head.y));
  }
  if(fallT>=1.4){
   const points=[r.pelvis.o,r.chest.o,r.head.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);
   if(final)row.finalMotion=Math.max(row.finalMotion,...points.map((x,i)=>Math.abs(x-final[i])));else final=points;
  }
 }
 row.label=ch.label;
 if(!physical(row)||row.chestDrift>5||row.headDrift>6||row.finalMotion>1e-6||row.label!=='Morto')failures.push(row);
 rows.push(row);
}
// Referência real da r7, registrada antes de modificar esta versão.
const reference=JSON.parse(fs.readFileSync(path.join(root,'auditoria/poses-esquiva-solta-r7.json'),'utf8'));
let poseDelta=0, recoveryDelta=0;
for(const entry of reference){
 const ch=new P.Character(0,0,entry.yaw);for(let k=0;k<60;k++)frame(ch,1/120,{});
 for(let k=0;k<72;k++){
  const r=frame(ch,1/120,{dodge:k===0}),expected=entry.frames.find(f=>f.tick===k);
  if(expected){const actual=[r.pelvis.o,r.chest.o,r.head.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);
   actual.forEach((v,i)=>{
    if(ch.dodge)poseDelta=Math.max(poseDelta,Math.abs(v-expected.points[i]));
    else recoveryDelta=Math.max(recoveryDelta,Math.abs(v-expected.points[i]));
   });}
 }
}
if(poseDelta>1e-6)failures.push({standalonePoseDelta:poseDelta});
const deaths=rows.filter(r=>r.kind==='death'),held=rows.filter(r=>r.kind==='held');
const summary={scenarios:rows.length,heldScenarios:held.length,deathScenarios:deaths.length,failures:failures.length,
 minStraightRunVelocity:Math.min(...held.filter(r=>r.run).map(r=>r.minVelocity)),
 idleFrames:held.reduce((s,r)=>s+r.idle,0),maxHandoffSeconds:Math.max(...held.map(r=>r.exit??Infinity)),
 chestDriftMax:Math.max(...deaths.map(r=>r.chestDrift)),headDriftMax:Math.max(...deaths.map(r=>r.headDrift)),
 finalMotionMax:Math.max(...deaths.map(r=>r.finalMotion)),ikMax:Math.max(...rows.map(r=>r.ik)),
 contactMax:Math.max(...rows.map(r=>r.contact)),belowMax:Math.max(...rows.map(r=>r.below)),standaloneActionPoseDelta:poseDelta,recoveryDeltaFromR7:recoveryDelta};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,12))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_FLOW_OUTPUT)fs.writeFileSync(process.env.PD_FLOW_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

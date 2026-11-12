// Novas ações: oito direções, taxas de atualização, entradas incompatíveis e paredes.
const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs');
const P=load(path.resolve(__dirname,'..')),M=P.math,B=P.BODY,rows=[],failures=[];
function inspect(ch,r,row){
 row.ik=Math.max(row.ik,...r.ik.leg.map(v=>v.err),...r.ik.arm.map(v=>v.err));
 row.gap=Math.min(row.gap,M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r));
 const points=[r.head.o,r.pelvis.o,...r.knee,...r.ankle,...r.elbow,...r.wrist];
 if(!points.every(p=>[p.x,p.y,p.z].every(Number.isFinite)))row.finite=false;
 for(let i=0;i<2;i++){
  for(const [a,b,l] of [[r.hip[i],r.knee[i],B.thigh],[r.knee[i],r.ankle[i],B.shin],[r.shoulder[i],r.elbow[i],B.upperArm],[r.elbow[i],r.wrist[i],B.forearm]])row.bone=Math.max(row.bone,Math.abs(M.dist(a,b)-l));
  if(ch.footLock[i].planted&&!ch.footLock[i].step&&!ch.death&&ch.jump.state!=='ar'){
   const h=Math.min(M.at(r.foot[i],0,-B.heelBack,-B.ankleHeight).z,M.at(r.foot[i],0,B.ballFwd,-B.ankleHeight).z,M.at(r.toe[i],0,4.3,0).z)-ch.groundZ;
   row.contact=Math.max(row.contact,Math.abs(h));
  }
 }
 if(ch.death||ch.dodge)row.below=Math.max(row.below,...P.rig.supportSpheres(r).map(s=>ch.groundZ-(s.p.z-s.r)));
}
function simulate({hz,yaw,kind,context='idle',direction=null,wall=false}){
 const ch=new P.Character(0,0,yaw),move={x:Math.cos(yaw),y:Math.sin(yaw)},dir=direction??yaw;
 const world=wall?{heightAt:()=>0,collide:(x,y)=>{
  const dot=x*Math.cos(dir)+y*Math.sin(dir),excess=Math.max(0,dot-38);
  return {x:x-Math.cos(dir)*excess,y:y-Math.sin(dir)*excess};
 }}:null;
 for(let k=0;k<hz;k++){
  ch.update(1/hz,{move:['walk','run','transition'].includes(context)?move:null,run:context==='run'||context==='transition'&&k>.7*hz,
   jump:context==='jump'&&k===Math.round(.7*hz),attack:context==='attack'&&k===Math.round(.95*hz),
   crouchSet:context==='crouch',dodge:context==='dodge'&&k===Math.round(.8*hz)},null);
  const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/hz);
 }
 const start={...ch.pos},row={hz,yaw,kind,context,dir,wall,ik:0,gap:Infinity,bone:0,contact:0,below:0,finite:true,accepted:false,settledDelta:0};
 let final=null;
 for(let k=0;k<Math.ceil(3.5*hz);k++){
  ch.update(1/hz,{[kind]:k===0,move:kind==='dodge'&&k===0&&direction!==null?{x:Math.cos(dir),y:Math.sin(dir)}:null,
   // Morto ignora estes comandos, inclusive novos pedidos de morte.
   ...(kind==='die'&&k>2*hz?{move,run:true,jump:true,attack:true,dodge:true,die:true}:{})},world);
  const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/hz);inspect(ch,r,row);
  if(ch.death||ch.dodge)row.accepted=true;
  if(kind==='die'&&k>=Math.round(2.3*hz)){
   const p=[r.head.o,r.pelvis.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);
   if(final)row.settledDelta=Math.max(row.settledDelta,...p.map((v,i)=>Math.abs(v-final[i])));else final=p;
  }
 }
 row.distance=Math.hypot(ch.pos.x-start.x,ch.pos.y-start.y);row.label=ch.label;
 const rejected=kind==='dodge'&&['jump','attack'].includes(context);
 const expected=kind==='die'?'Morto':'Parado';
 if(row.accepted===rejected||row.label!==expected||!row.finite||row.ik>.5||row.gap<-.05||row.bone>1e-6||row.contact>.3||row.below>.3||row.settledDelta>1e-6||
    kind==='dodge'&&!rejected&&!wall&&Math.abs(row.distance-P.DODGE.distance)>1e-6||kind==='dodge'&&wall&&row.distance>38.001)failures.push(row);
 rows.push(row);
}
for(const hz of [30,60,120])for(let d=0;d<8;d++){
 const yaw=d*Math.PI/4;
 for(const kind of ['dodge','die'])for(const context of ['idle','walk','run','crouch','jump','attack','transition'])simulate({hz,yaw,kind,context});
 simulate({hz,yaw,kind:'die',context:'dodge'});
 for(let side=0;side<8;side++)simulate({hz,yaw,kind:'dodge',direction:yaw+side*Math.PI/4});
 for(const side of [0,Math.PI/2,Math.PI])simulate({hz,yaw,kind:'dodge',direction:yaw+side,wall:true});
}
// Um pedido repetido não reinicia a morte, nem encurta a espera entre esquivas.
const ch=new P.Character(0,0,0);ch.update(1/120,{dodge:true},null);
for(let k=0;k<68;k++)ch.update(1/120,{},null);
ch.update(1/120,{dodge:true},null);
if(ch.dodge)failures.push({cooldown:'nova esquiva aceita cedo demais'});
ch.die();ch.update(.1,{},null);const age=ch.death.t;ch.die();if(ch.death.t!==age)failures.push({death:'morte reiniciada'});
const summary={scenarios:rows.length,failures:failures.length,ikMax:Math.max(...rows.map(r=>r.ik)),boneErrorMax:Math.max(...rows.map(r=>r.bone)),minGap:Math.min(...rows.map(r=>r.gap)),contactMax:Math.max(...rows.map(r=>r.contact)),belowMax:Math.max(...rows.map(r=>r.below)),settledDeltaMax:Math.max(...rows.map(r=>r.settledDelta))};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,10))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_ACTION_OUTPUT)fs.writeFileSync(process.env.PD_ACTION_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

const fs=require('fs'),path=require('path'),assert=require('assert');
const {load}=require('../auditoria/medir.cjs');
const root=path.resolve(__dirname,'..'),P=load(root),M=P.math,B=P.BODY,rows=[],failures=[];
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const context of ['idle','walk','run','crouch','jump','attack','pivot','transition'])for(let side=0;side<4;side++){
 const yaw=d*Math.PI/4,ch=new P.Character(0,0,yaw),dir=yaw+side*Math.PI/2;
 const row={hz,direction:d*45,context,push:side*90,ik:0,bone:0,contact:0,below:0,gap:Infinity,accepted:false,finite:true,punchAfterHit:false};
 for(let k=0;k<hz*3;k++){
  const t=k/hz,angle=context==='pivot'&&t>=.9?yaw+Math.PI:yaw;
  const move=['walk','run','transition','pivot'].includes(context)?{x:Math.cos(angle),y:Math.sin(angle)}:null;
  ch.events.length=0;
  ch.update(1/hz,{move,run:context==='run'||context==='transition'&&t>.7,crouchSet:context==='crouch',jump:context==='jump'&&k===Math.round(.7*hz),
   attack:context==='attack'&&k===Math.round(.95*hz),hit:k===hz?{direction:dir}:false},null);
  const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/hz);
  if(k<hz)continue;
  row.accepted ||= !!ch.hurt;
  row.ik=Math.max(row.ik,...r.ik.leg.map(x=>x.err),...r.ik.arm.map(x=>x.err));
  row.gap=Math.min(row.gap,M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r));
  if(![r.head.o,r.pelvis.o,...r.knee,...r.ankle,...r.wrist].every(p=>[p.x,p.y,p.z].every(Number.isFinite)))row.finite=false;
  if(ch.hurt&&ch.events.some(e=>e.type==='impacto'))row.punchAfterHit=true;
  for(let i=0;i<2;i++){
   for(const [a,b,l] of [[r.hip[i],r.knee[i],B.thigh],[r.knee[i],r.ankle[i],B.shin],[r.shoulder[i],r.elbow[i],B.upperArm],[r.elbow[i],r.wrist[i],B.forearm]])row.bone=Math.max(row.bone,Math.abs(M.dist(a,b)-l));
   const h=Math.min(M.at(r.foot[i],0,-B.heelBack,-B.ankleHeight).z,M.at(r.foot[i],0,B.ballFwd,-B.ankleHeight).z,M.at(r.toe[i],0,4.3,0).z)-ch.groundZ;
   row.below=Math.max(row.below,-h);
   if(ch.footLock[i].planted&&!ch.footLock[i].step&&ch.jump.state!=='ar')row.contact=Math.max(row.contact,Math.abs(h));
  }
 }
 row.recovered=!ch.hurt;
 if(!row.accepted||!row.recovered||!row.finite||row.punchAfterHit||row.ik>.5||row.bone>1e-6||row.gap<-.05||row.contact>.3||row.below>.3)failures.push(row);
 rows.push(row);
}
// O impulso e o relógio de um salto já iniciado continuam iguais, inclusive durante o preparo.
let maxJumpDelta=0,jumpChecks=0;
for(const hz of [30,60,120])for(const run of [false,true])for(const offset of [.03,.15,.3,.6]){
 const pair=[new P.Character(0,0,0),new P.Character(0,0,0)];
 for(let k=0;k<hz*2.5;k++){
  for(let i=0;i<2;i++){
   pair[i].update(1/hz,{move:{x:1,y:0},run,jump:k===Math.round(.6*hz),hit:i===1&&k===Math.round((.6+offset)*hz)},null);
   const r=P.rig.buildRig(pair[i].pose());pair[i].secondary(r,1/hz);
  }
  maxJumpDelta=Math.max(maxJumpDelta,Math.abs(pair[0].pos.z-pair[1].pos.z));
 }
 jumpChecks++;
}
if(maxJumpDelta>1e-8)failures.push({maxJumpDelta});
const a=new P.Character(0,0,0);a.update(.01,{hit:true},null);const old=a.hurt;
assert(!a.reactToHit());assert.strictEqual(a.hurt,old);a.die();assert(!a.hurt);assert(!a.reactToHit());
const b=new P.Character(0,0,0);b.update(.01,{dodge:true},null);assert(!b.reactToHit());
for(const bad of [null,{direction:NaN},{strength:Infinity},{strength:0}])assert(!new P.Character(0,0,0).reactToHit(bad));
// A esquiva e a morte mudaram por solicitação; a reação ao impacto permanece aprovada.
const reference=JSON.parse(fs.readFileSync(path.join(root,'auditoria/poses-impacto-r6.json'),'utf8'));let poseDelta=0,poseSamples=0;
for(let direction=0;direction<8;direction++){
 const ch=new P.Character(0,0,direction*Math.PI/4);let sample=0;
 const times=[.05,.1,.2,.35,.55,.8];
 for(let k=0;k<120;k++){ch.update(1/120,{},null);const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/120);}
 for(let k=0;k<240;k++){
  ch.update(1/120,{hit:k===0},null);const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/120);
  if(sample<times.length&&(k+1)/120>=times[sample]-1e-9){
   const points=[r.pelvis.o,r.chest.o,r.head.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);
   const expected=reference[direction][sample];
   poseDelta=Math.max(poseDelta,...points.map((v,i)=>Math.abs(v-expected[i])));sample++;poseSamples++;
  }
 }
}
if(poseDelta>1e-6)failures.push({poseDelta});
const summary={scenarios:rows.length,failures:failures.length,ikMax:Math.max(...rows.map(r=>r.ik)),boneErrorMax:Math.max(...rows.map(r=>r.bone)),minGap:Math.min(...rows.map(r=>r.gap)),contactMax:Math.max(...rows.map(r=>r.contact)),belowMax:Math.max(...rows.map(r=>r.below)),jumpChecks,maxJumpDelta,approvedImpactPoseSamples:poseSamples,approvedImpactPoseDeltaCm:poseDelta};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,8))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_HIT_OUTPUT)fs.writeFileSync(process.env.PD_HIT_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

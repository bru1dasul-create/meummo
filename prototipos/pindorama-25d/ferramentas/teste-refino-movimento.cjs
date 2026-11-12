// Exercita as transições relatadas pelo jogador, incluindo os quadros logo após Q.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const P=require(path.join(root,'auditoria/medir.cjs')).load(root),M=P.math,B=P.BODY,rows=[],failures=[];
function check(kind,data,fn){const row={kind,...data,ik:0,bone:0,minGap:Infinity,contact:0};try{fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.message;failures.push(row);}rows.push(row);}
function step(c,dt,input,row){
 c.update(dt,input);const r=P.rig.buildRig(c.pose());
 assert([r.pelvis.o,r.head.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]).every(Number.isFinite));
 row.ik=Math.max(row.ik,...r.ik.leg.map(x=>x.err),...r.ik.arm.map(x=>x.err));
 row.minGap=Math.min(row.minGap,M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r));
 for(let i=0;i<2;i++){
  for(const [a,b,length]of [[r.hip[i],r.knee[i],B.thigh],[r.knee[i],r.ankle[i],B.shin],[r.shoulder[i],r.elbow[i],B.upperArm],[r.elbow[i],r.wrist[i],B.forearm]])row.bone=Math.max(row.bone,Math.abs(M.dist(a,b)-length));
  const st=c.footLock[i];if(st.planted&&!st.step&&!c.dodge){const low=Math.min(M.at(r.foot[i],0,-B.heelBack,-B.ankleHeight).z,M.at(r.foot[i],0,B.ballFwd,-B.ankleHeight).z,M.at(r.toe[i],0,4.3,0).z);row.contact=Math.max(row.contact,Math.abs(low-c.groundZ));}
 }
 assert(row.ik<.5);assert(row.bone<1e-6);assert(row.minGap>=-.05);assert(row.contact<.3);
 return r;
}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const run of [false,true])for(const slot of [0,1,2,3])check('dodge_handoff',{hz,direction:d*45,run,slot},row=>{
 const yaw=d*Math.PI/4,move={x:Math.cos(yaw),y:Math.sin(yaw)},c=new P.Character(0,0,yaw),dt=1/hz;
 for(let k=0;k<hz+Math.round(slot*hz*.11);k++)step(c,dt,{move,run},row);
 let prev=null,exit=null;row.pelvisVelocity=0;row.kneeVelocity=0;row.minimumPelvis=Infinity;row.idleFrames=0;
 for(let k=0;k<hz;k++){
  const was=!!c.dodge,r=step(c,dt,{move,run,dodge:k===0},row);
  const cur={pelvis:M.sub(r.pelvis.o,c.pos),knee:r.knee.map(p=>M.sub(p,c.pos))};
  if(was&&!c.dodge)exit=(k+1)*dt;
  if(prev&&k*dt>=.22&&k*dt<.45){row.pelvisVelocity=Math.max(row.pelvisVelocity,M.dist(cur.pelvis,prev.pelvis)/dt);row.kneeVelocity=Math.max(row.kneeVelocity,...cur.knee.map((p,j)=>M.dist(p,prev.knee[j])/dt));row.minimumPelvis=Math.min(row.minimumPelvis,r.pelvis.o.z);}
  if(exit!==null&&c.label==='Parado')row.idleFrames++;
  prev=cur;
 }
 assert(exit!==null&&exit<.29);assert(row.pelvisVelocity<350,'salto do quadril na saída de Q');assert(row.kneeVelocity<1300);assert(row.minimumPelvis>50,'quadril abaixou duas vezes');assert(!row.idleFrames);assert(c.label===(run?'Correndo':'Andando'));
});
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const run of [false,true])for(const aim of ['movement','fixed'])for(const period of [.2,.45,.8])check('punch_changing_sides',{hz,direction:d*45,run,aim,period},row=>{
 const yaw=d*Math.PI/4,c=new P.Character(0,0,yaw),dt=1/hz;row.headingError=0;row.maxHipDrop=0;let nextAttack=1;
 for(let k=0;k<hz*4;k++){
  const t=k*dt,dir=t<1?yaw:yaw+(Math.floor((t-1)/period)%2?-1:1)*Math.PI/2;
  const attack=t>=nextAttack;if(attack)nextAttack+=.37;
  step(c,dt,{move:{x:Math.cos(dir),y:Math.sin(dir)},run,attack,attackDir:aim==='fixed'?yaw:undefined},row);
  row.maxHipDrop=Math.max(row.maxHipDrop,c.hipDrop);
  if(c.attack&&c.speed>35&&!c.turnInPlace){const error=Math.abs(M.angleDiff(c.yaw,Math.atan2(c.vel.y,c.vel.x)))/M.DEG;row.headingError=Math.max(row.headingError,error);}
 }
 assert(row.headingError<65,'pés seguindo uma direção diferente do deslocamento');assert(row.maxHipDrop<15);
});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8,
 maxHandoffPelvisVelocity:Math.max(...rows.filter(r=>r.kind==='dodge_handoff').map(r=>r.pelvisVelocity||0)),
 minHandoffPelvisHeight:Math.min(...rows.filter(r=>r.kind==='dodge_handoff').map(r=>r.minimumPelvis??Infinity)),
 minFeetGap:Math.min(...rows.map(r=>r.minGap)),maxIK:Math.max(...rows.map(r=>r.ik))};
console.log(JSON.stringify(summary,null,2));for(const row of failures.slice(0,12))console.error('FALHA',JSON.stringify(row));
if(process.env.PD_MOVEMENT_OUTPUT)fs.writeFileSync(process.env.PD_MOVEMENT_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

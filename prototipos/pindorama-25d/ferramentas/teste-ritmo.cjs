// Trocas de Shift em diferentes pontos da passada e combinadas com outros controles.
const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs');
const P=load(path.resolve(__dirname,'..')),M=P.math,B=P.BODY;
const rows=[],failures=[];
for(const hz of [30,60,120])for(let direction=0;direction<8;direction++){
 const yaw=direction*Math.PI/4;
 const plans=[];
 for(const fromRun of [false,true])for(let offset=0;offset<8;offset++){
  const change=1+offset*.043;
  plans.push({name:`troca-${fromRun?'corre-anda':'anda-corre'}-${offset}`,secs:2.8,input:t=>({run:t<change?fromRun:!fromRun})});
 }
 for(const action of ['alternar','virar','pular','agachar'])plans.push({
  name:action,secs:3.5,input:(t,k)=>({
   run:action==='alternar'?t>.7&&Math.floor((t-.7)/.12)%2===0:t<1.1||t>2.2,
   angle:action==='virar'&&t>1.1?yaw+Math.PI:yaw,
   jump:action==='pular'&&k===Math.round(1.1*hz),
   crouchSet:action==='agachar'&&t>1.1&&t<2.2,
  }),
 });
 for(const plan of plans){
  const ch=new P.Character(0,0,yaw),row={hz,direction:direction*45,plan:plan.name,minGap:Infinity,contact:0,below:0,ik:0,finite:true};
  for(let k=0;k<Math.ceil(plan.secs*hz);k++){
   const input=plan.input(k/hz,k),angle=input.angle??yaw;
   ch.update(1/hz,{...input,move:{x:Math.cos(angle),y:Math.sin(angle)}},null);
   const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/hz);
   const gap=M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r);
   row.minGap=Math.min(row.minGap,gap);
   for(let i=0;i<2;i++){
    const st=ch.footLock[i],points=[M.at(r.foot[i],0,-B.heelBack,-B.ankleHeight),M.at(r.foot[i],0,B.ballFwd,-B.ankleHeight),M.at(r.toe[i],0,4.3,0)];
    const h=Math.min(...points.map(p=>p.z-ch.groundZ));
    row.below=Math.max(row.below,-h);row.ik=Math.max(row.ik,r.ik.leg[i].err);
    if(st.planted&&!st.step&&ch.jump.state!=='ar')row.contact=Math.max(row.contact,Math.abs(h));
    row.finite&&=[r.ankle[i],r.knee[i],r.pelvis.o].every(p=>[p.x,p.y,p.z].every(Number.isFinite));
   }
  }
  rows.push(row);
  if(!row.finite||row.minGap<-.05||row.contact>.3||row.below>.3||row.ik>.5)failures.push(row);
 }
}
console.log(JSON.stringify({scenarios:rows.length,failures:failures.length,minGap:Math.min(...rows.map(r=>r.minGap)),contactMax:Math.max(...rows.map(r=>r.contact)),belowMax:Math.max(...rows.map(r=>r.below)),ikMax:Math.max(...rows.map(r=>r.ik))},null,2));
for(const f of failures.slice(0,12))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_RHYTHM_OUTPUT)fs.writeFileSync(process.env.PD_RHYTHM_OUTPUT,JSON.stringify({rows,failures},null,2));
process.exitCode=failures.length?1:0;

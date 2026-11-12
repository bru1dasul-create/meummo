// Confere a coerência entre o plano do joelho e a orientação do pé na morte.
// O modo --reference registra a versão anterior, sem aprová-la.
const fs=require('fs'),path=require('path');
const {load}=require('../auditoria/medir.cjs');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),P=load(root),M=P.math,rows=[],failures=[];
const reference=process.argv.includes('--reference'),deg=180/Math.PI;
function step(ch,dt,input){ch.update(dt,input,null);const r=P.rig.buildRig(ch.pose());ch.secondary(r,dt);return r;}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const context of ['idle','walk','run','crouch']){
 const yaw=d*Math.PI/4,ch=new P.Character(0,0,yaw),move={x:Math.cos(yaw),y:Math.sin(yaw)};
 for(let k=0;k<hz;k++)step(ch,1/hz,{move:['walk','run'].includes(context)?move:null,run:context==='run',crouchSet:context==='crouch'});
 const row={hz,direction:d*45,context,planeError:0,hipSpread:0,footHeadingError:0,boneError:0,below:0,finite:true};
 for(let k=0;k<hz*2;k++){
  const r=step(ch,1/hz,{die:k===0});
  if(ch.death.t-ch.death.fallDelay<1.35)continue;
  for(let i=0;i<2;i++){
   const upper=M.sub(r.knee[i],r.hip[i]),lower=M.sub(r.ankle[i],r.knee[i]);
   const normal=M.norm(M.cross(upper,lower));
   const plane=Math.acos(M.clamp(Math.abs(M.dot(normal,r.foot[i].r)),0,1))*deg;
   const spread=Math.asin(M.clamp(Math.abs(M.dot(M.norm(upper),r.body.r)),0,1))*deg;
   const heading=Math.atan2(r.ankle[i].y-r.hip[i].y,r.ankle[i].x-r.hip[i].x);
   const footHeading=Math.atan2(r.foot[i].f.y,r.foot[i].f.x);
   row.planeError=Math.max(row.planeError,plane);row.hipSpread=Math.max(row.hipSpread,spread);
   row.footHeadingError=Math.max(row.footHeadingError,Math.abs(M.angleDiff(heading,footHeading))*deg);
   row.boneError=Math.max(row.boneError,Math.abs(M.len(upper)-P.BODY.thigh),Math.abs(M.len(lower)-P.BODY.shin));
   if(![plane,spread,heading,footHeading].every(Number.isFinite))row.finite=false;
  }
  row.below=Math.max(row.below,...P.rig.supportSpheres(r).map(s=>ch.groundZ-s.p.z+s.r));
 }
 // Limites amplos de coerência, não uma aprovação estética da pose.
 if(!row.finite||row.planeError>15||row.hipSpread>25||row.footHeadingError>10||row.boneError>1e-6||row.below>.3)failures.push(row);
 rows.push(row);
}
const summary={reference,scenarios:rows.length,failures:failures.length,planeErrorMaxDeg:Math.max(...rows.map(r=>r.planeError)),hipSpreadMaxDeg:Math.max(...rows.map(r=>r.hipSpread)),footHeadingErrorMaxDeg:Math.max(...rows.map(r=>r.footHeadingError)),boneErrorMax:Math.max(...rows.map(r=>r.boneError)),belowMax:Math.max(...rows.map(r=>r.below))};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,4))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_LEG_OUTPUT)fs.writeFileSync(process.env.PD_LEG_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=!reference&&failures.length?1:0;

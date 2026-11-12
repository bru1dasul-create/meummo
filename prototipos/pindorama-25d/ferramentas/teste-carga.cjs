// Carga, soltura, origem da pedra, braço e rival com estilingue.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),P=require('../auditoria/medir.cjs').load(root),M=P.math,B=P.BODY,rows=[],failures=[];
for(const f of ['slingshot','combat'])vm.runInNewContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),{window:{PD:P}});
const flat={heightAt:()=>0,collide:(x,y)=>({x,y})};
function create(yaw=0,options={}){const c=new P.TrainingCombat(new P.Character(0,0,yaw),flat,{spawn:{x:Math.cos(yaw)*300,y:Math.sin(yaw)*300},enemyAI:false,...options});c.selectWeapon('slingshot');c.start();return c;}
function step(c,h,input={}){c.update(h,input);for(const f of[c.hero,c.enemy])f.character.events.length=0;}
function check(kind,data,fn){const row={kind,...data};try{fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.message;failures.push(row);}rows.push(row);}
for(const hz of[30,60,120])for(let d=0;d<8;d++)for(const hold of[.02,.45,1.1,2])check('hold_release',{hz,direction:d*45,hold},row=>{
 const c=create(d*Math.PI/4),h=1/hz;let launched=null;
 for(let k=0;k<Math.ceil(hold*hz);k++){step(c,h,{attack:k===0,attackHeld:true});assert.strictEqual(c.stats.shots,0);assert(c.hero.character.attack.stage==='charging');}
 row.power=c.hero.character.attack.power;
 for(let k=0;k<hz*1.5;k++){
  step(c,h,{attackHeld:false,attackReleased:k===0});
  if(!launched&&c.projectiles.length){const p=c.projectiles[0],r=P.rig.buildRig(c.hero.character.pose()),g=P.slingshot.geometry(r,c.hero.character.look);row.originError=M.dist(p.origin,g.center);assert(row.originError<.4);launched={damage:p.damage,speed:p.speed,range:p.range};}
 }
 assert(launched);assert.strictEqual(c.stats.shots,1);assert.strictEqual(c.enemy.hp,80-launched.damage);assert(!c.hero.character.attack);
 Object.assign(row,launched);assert(row.damage>=20&&row.damage<=40);if(hold>=1.1){assert.strictEqual(row.damage,40);assert(Math.abs(row.speed-1700)<1e-5);assert(Math.abs(row.range-950)<1e-5);}else if(hold<.03)assert(row.damage<=21);
 for(let k=0;k<hz;k++)step(c,h,{attackHeld:true});assert.strictEqual(c.stats.shots,1,'não pode disparar de novo sem novo aperto');
});
for(const hz of[30,60,120])for(let d=0;d<8;d++)for(const mode of['idle','walk','run'])check('arm_continuity',{hz,direction:d*45,mode},row=>{
 const yaw=d*Math.PI/4,c=new P.Character(0,0,yaw);c.equip('maoE','estilingue');const move=mode==='idle'?null:{x:Math.cos(yaw),y:Math.sin(yaw)},run=mode==='run',h=1/hz;
 for(let k=0;k<hz;k++)c.update(h,{move,run});
 let r=P.rig.buildRig(c.pose()),previous=M.sub(r.elbow[1],c.pos);row.ik=0;row.bone=0;row.elbowSpeed=0;row.bandAlignment=0;row.elbowOut=Infinity;
 for(let k=0;k<hz*1.7;k++){
  c.update(h,{move,run,attack:k===0,attackHeld:k<hz*1.1,attackDir:yaw});r=P.rig.buildRig(c.pose());
  const current=M.sub(r.elbow[1],c.pos);row.elbowSpeed=Math.max(row.elbowSpeed,M.dist(current,previous)/h);previous=current;
  row.ik=Math.max(row.ik,...r.ik.arm.map(x=>x.err),...r.ik.leg.map(x=>x.err));
  for(let i=0;i<2;i++)for(const[a,b,len]of[[r.shoulder[i],r.elbow[i],B.upperArm],[r.elbow[i],r.wrist[i],B.forearm]])row.bone=Math.max(row.bone,Math.abs(M.dist(a,b)-len));
  if(c.attack&&c.attack.stage==='charging'&&c.attack.power>.9){
   const g=P.slingshot.geometry(r,c.look),v=M.sub(g.center,g.pouch),dir={x:Math.cos(yaw),y:Math.sin(yaw),z:0};row.bandAlignment=Math.max(row.bandAlignment,M.len(M.sub(v,M.scale(dir,M.dot(v,dir)))));
   row.elbowOut=Math.min(row.elbowOut,M.dot(M.sub(r.elbow[1],r.shoulder[1]),r.chest.r));
  }
 }
 assert(row.ik<.5);assert(row.bone<1e-6);assert(row.elbowSpeed<1000,'cotovelo pulou ao mudar a dobra');assert(row.bandAlignment<.1);assert(row.elbowOut>2);
});
for(const hz of[30,60,120])for(const kind of['cancel','dodge','pause','hurt'])check('cancel_without_late_shot',{hz,kind},()=>{
 const c=create();for(let k=0;k<Math.ceil(hz*.4);k++)step(c,1/hz,{attack:k===0,attackHeld:true});
 if(kind==='pause'){c.setPaused(true);for(let k=0;k<hz;k++)step(c,1/hz,{attackHeld:false});c.setPaused(false);}
 else if(kind==='hurt')c.damage(c.enemy,c.hero,14);
 else step(c,1/hz,{attackHeld:false,attackCancel:kind==='cancel',dodge:kind==='dodge'});
 for(let k=0;k<hz;k++)step(c,1/hz,{attackHeld:false});assert.strictEqual(c.stats.shots,0);assert.strictEqual(c.enemy.hp,80);
});
for(const hz of[30,60,120]){
 check('rival_shoots_and_warns',{hz},()=>{
  const c=create(0,{enemyAI:true,enemyWeapon:'slingshot'});let warning=0,firstShot=null,firstDamage=null;
  for(let k=0;k<hz*12;k++){step(c,1/hz,{attackHeld:false});if(c.telegraph&&c.telegraph.kind==='stone')warning++;if(c.stats.enemyShots&&firstShot===null)firstShot=c.time;if(c.hero.hp<100&&firstDamage===null)firstDamage=c.time;}
  assert(warning>hz*.3);assert(firstShot!==null&&firstDamage>firstShot);assert.strictEqual(c.phase,'lost');assert(c.stats.enemyShots>=3);assert.strictEqual(c.projectiles.length,0);
 });
 check('rival_aim_is_locked_while_charging',{hz},()=>{
  const c=create(0,{enemyAI:true,enemyWeapon:'slingshot'});while(!c.enemy.character.attack)step(c,1/hz,{attackHeld:false});const dir=c.enemy.character.attack.dir;
  for(let k=0;k<Math.ceil(hz*.2);k++){step(c,1/hz,{move:{x:0,y:1},run:true,attackHeld:false});assert(Math.abs(M.angleDiff(dir,c.enemy.character.attack.dir))<1e-8);}
 });
 check('duel_can_be_won_with_charged_stones',{hz},()=>{
  const c=create(0,{enemyAI:true,enemyWeapon:'slingshot'});let holding=false;
  for(let k=0;k<hz*8;k++){
   const a=c.hero.character;let attack=false;
   if(a.hurt)holding=false;
   else if(!a.attack&&c.phase==='active'){holding=true;attack=true;}
   if(a.attack&&a.attack.kind==='slingshot'&&a.attack.power>=1-1e-8)holding=false;
   step(c,1/hz,{attack,attackHeld:holding});
  }
  assert.strictEqual(c.phase,'won');assert(c.hero.hp>0);assert(c.stats.shots>=2);assert(c.stats.enemyShots>0);
 });
}
for(const hz of[30,60,120])for(let d=0;d<8;d++)check('stone_follows_elastic_when_turning',{hz,direction:d*45},row=>{
 const yaw=d*Math.PI/4,c=create(yaw,{spawn:{x:5000,y:5000}}),launch=c.launchStone.bind(c);let seen=false;row.rayError=0;
 c.launchStone=(owner,event)=>{
  const r=P.rig.buildRig(owner.character.pose()),g=P.slingshot.geometry(r,owner.character.look),v=M.sub(g.center,g.pulled);
  row.rayError=Math.abs(M.angleDiff(event.direction,Math.atan2(v.y,v.x)));assert(row.rayError<1e-6);assert(M.dist(g.center,g.pouch)<1e-6);
  launch(owner,event);seen=true;
 };
 for(let k=0;k<hz*1.8;k++){
  const t=k/hz,dir=yaw+(t<1.1?Math.PI/2:Math.PI);
  step(c,1/hz,{attack:k===0,attackHeld:t<1.1,attackDir:yaw,move:{x:Math.cos(dir),y:Math.sin(dir)},run:true});
 }
 assert(seen);assert.strictEqual(c.stats.shots,1);
});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8,
 maxElbowSpeed:Math.max(0,...rows.map(r=>r.elbowSpeed||0)),maxBandAlignment:Math.max(0,...rows.map(r=>r.bandAlignment||0)),maxOriginError:Math.max(0,...rows.map(r=>r.originError||0))};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,12))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_CHARGE_OUTPUT)fs.writeFileSync(process.env.PD_CHARGE_OUTPUT,JSON.stringify({summary,rows,failures},null,2));process.exitCode=failures.length?1:0;

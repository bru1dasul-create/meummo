// Regressões dos problemas relatados: saída do cadáver, tiros após vitória e queda orientada pelo golpe.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),P=require(root+'/auditoria/medir.cjs').load(root),M=P.math,B=P.BODY;
for(const f of ['slingshot','combat'])vm.runInNewContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),{window:{PD:P}});
const flat={heightAt:()=>0,collide:(x,y)=>({x,y})},rows=[],failures=[];
function check(name,data,fn){const r={name,...data};try{fn(r);r.passed=true;}catch(e){r.passed=false;r.error=e.message;failures.push(r);}rows.push(r);}
function step(c,dt,input={}){c.update(dt,input);for(const f of [c.hero,c.enemy])f.character.events.length=0;}
function create(yaw=0,range=300,w=flat){const c=new P.TrainingCombat(new P.Character(0,0,yaw),w,{spawn:{x:Math.cos(yaw)*range,y:Math.sin(yaw)*range},enemyAI:false});c.start();return c;}
function points(c){const r=P.rig.buildRig(c.pose());return [r.head.o,r.chest.o,r.pelvis.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);}
function inspect(ch,r,row){
 assert(points(ch).every(Number.isFinite));
 row.ik=Math.max(row.ik||0,...r.ik.leg.map(a=>a.err),...r.ik.arm.map(a=>a.err));
 row.bone=Math.max(row.bone||0,...[0,1].flatMap(i=>[
 Math.abs(M.dist(r.hip[i],r.knee[i])-B.thigh),Math.abs(M.dist(r.knee[i],r.ankle[i])-B.shin),
 Math.abs(M.dist(r.shoulder[i],r.elbow[i])-B.upperArm),Math.abs(M.dist(r.elbow[i],r.wrist[i])-B.forearm)]));
 row.below=Math.max(row.below||0,...P.rig.supportSpheres(r).map(s=>ch.groundZ-s.p.z+s.r));
 assert(row.ik<.5);assert(row.bone<1e-6);assert(row.below<.3);
}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const context of ['idle','walk','run','crouch','jump','dodge','charge'])for(const front of [true,false])check('death_follows_hit_and_keeps_anatomy',{hz,direction:d*45,context,front},row=>{
 const yaw=d*Math.PI/4,ch=new P.Character(0,0,yaw),u={x:Math.cos(yaw),y:Math.sin(yaw)};
 if(context==='charge')ch.equip('maoE','estilingue');
 for(let k=0;k<hz;k++)ch.update(1/hz,{move:['walk','run'].includes(context)?u:null,run:context==='run',crouchSet:context==='crouch'});
 if(['jump','dodge','charge'].includes(context))for(let k=0;k<Math.ceil(hz*.15);k++)ch.update(1/hz,{jump:context==='jump'&&k===0,dodge:context==='dodge'&&k===0,attack:context==='charge'&&k===0,attackHeld:true,attackDir:yaw});
 ch.die({direction:yaw+(front?0:Math.PI)});assert.strictEqual(ch.death.forward,front);
 let old=P.rig.buildRig(ch.pose()),rest=null;row.maxJointSpeed=0;
 for(let k=0;k<Math.ceil(hz*3.2);k++){
  ch.update(1/hz,{});const r=P.rig.buildRig(ch.pose());inspect(ch,r,row);
  for(const [a,b] of [[r.head.o,old.head.o],[r.chest.o,old.chest.o],...[0,1].map(i=>[r.knee[i],old.knee[i]])])row.maxJointSpeed=Math.max(row.maxJointSpeed,M.dist(a,b)*hz);
  old=r;
  if(ch.death.t-ch.death.fallDelay<1.5)continue;
  const forwardDistance=(r.chest.o.x-ch.pos.x)*u.x+(r.chest.o.y-ch.pos.y)*u.y;
  assert(front?forwardDistance>45:forwardDistance< -45);assert(front?r.chest.f.z<-.85:r.chest.f.z>.85);
  for(let i=0;i<2;i++){
   const n=M.norm(M.cross(M.sub(r.knee[i],r.hip[i]),M.sub(r.ankle[i],r.knee[i])));
   const plane=Math.acos(M.clamp(Math.abs(M.dot(n,r.foot[i].r)),0,1))/M.DEG;
   assert(plane<15,`plano do joelho/pé ${plane}`);
  }
  const ps=points(ch);if(!rest)rest=ps;else assert(Math.max(...ps.map((p,j)=>Math.abs(p-rest[j])))<1e-6,'corpo continua se mexendo depois de repousar');
 }
 assert(rest);assert(row.maxJointSpeed<2400,`salto de articulação ${row.maxJointSpeed} cm/s`);
});
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const xy of [[0,20],[0,0],[-50,0]])check('overlapping_corpse_allows_exit_then_becomes_solid',{hz,direction:d*45,xy},row=>{
 const c=new P.TrainingCombat(new P.Character(xy[0],xy[1],d*Math.PI/4),flat,{spawn:{x:0,y:0},enemyAI:false});c.start();c.enemy.character.yaw=0;c.enemy.character.faceYaw=0;c.enemy.character._pose=null;c.enemy.character.die();
 for(let k=0;k<hz*2;k++)step(c,1/hz);
 const a=c.hero.character,body=points(c.enemy.character),rootBefore={...c.enemy.character.pos},start={...a.pos};row.maxStep=0;
 for(let k=0;k<hz*1.5;k++){const before={...a.pos};step(c,1/hz,{move:{x:Math.cos(d*Math.PI/4),y:Math.sin(d*Math.PI/4)},run:true});row.maxStep=Math.max(row.maxStep,M.dist(before,a.pos));}
 row.distance=M.dist(start,a.pos);assert(row.distance>350,'jogador preso no cadáver');assert(row.maxStep<=440/hz+.001,'saída teletransportou o jogador');
 assert(M.dist(rootBefore,c.enemy.character.pos)<1e-6);assert(Math.max(...points(c.enemy.character).map((p,i)=>Math.abs(p-body[i])))<1e-6);
 const dead=c.enemy.character,dir=Math.atan2(dead.pos.y-a.pos.y,dead.pos.x-a.pos.x);
 for(let k=0;k<hz*2;k++)step(c,1/hz,{move:{x:Math.cos(dir),y:Math.sin(dir)},run:true});
 const direct={x:dead.pos.x+(dead.pos.x-a.pos.x)*2,y:dead.pos.y+(dead.pos.y-a.pos.y)*2};const allowed=c.heroWorld.collide(direct.x,direct.y,a.radius);
 assert(Math.hypot(direct.x-allowed.x,direct.y-allowed.y)>20,'depois de sair atravessou o corpo numa previsão longa');
});
for(const hz of [30,60,120])for(let d=0;d<8;d++)check('stones_and_impacts_continue_after_victory',{hz,direction:d*45},row=>{
 const yaw=d*Math.PI/4,c=create(yaw);c.selectWeapon('slingshot');c.damage(c.hero,c.enemy,80);for(let k=0;k<hz*2;k++)step(c,1/hz);
 let seen=false,impact=false;
 for(let k=0;k<hz*2;k++){step(c,1/hz,{attack:k===0,attackHeld:k<hz*.8,attackReleased:k===Math.round(hz*.8),attackDir:yaw});seen ||= c.projectiles.length>0;impact ||= c.effects.some(e=>e.kind==='stoneImpact'&&e.material==='ground');}
 assert(seen);assert(impact);assert.strictEqual(c.enemy.hp,0);assert.strictEqual(c.hero.hp,100);assert.strictEqual(c.stats.shots,1);assert.strictEqual(c.phase,'won');assert.strictEqual(c.stats.enemyShots,0);
 const p={...c.hero.character.pos};for(let k=0;k<hz;k++)step(c,1/hz,{move:{x:-Math.sin(yaw),y:Math.cos(yaw)},run:true});assert(M.dist(p,c.hero.character.pos)>200);
});
for(const material of ['ground','wall','body','corpse'])check('stone_contacts_create_feedback',{material},row=>{
 const w=material==='wall'?{heightAt:()=>0,collide:(x,y,r)=>({x:Math.min(x,140-r),y})}:flat;
 const c=create(0,300,w);if(material==='wall')c.enemy.character.pos.y=400;if(material==='corpse'){c.damage(c.hero,c.enemy,80);for(let k=0;k<120;k++)step(c,1/60);}
 const r=P.rig.buildRig(c.enemy.character.pose()),point=material==='corpse'?r.chest.o:{x:300,y:0,z:130};
 c.projectiles.push({owner:c.hero,pos:material==='ground'?{x:100,y:100,z:9}:material==='wall'?{x:120,y:0,z:100}:{x:point.x-60,y:point.y,z:point.z},
 velocity:material==='ground'?{x:100,y:0,z:-400}:{x:1000,y:0,z:0},damage:20,power:.5,age:0,distance:0});
 let impact=null;for(let k=0;k<30;k++){step(c,1/120);impact ||= c.effects.find(e=>e.kind==='stoneImpact');}
 assert(impact);assert.strictEqual(impact.material,material==='corpse'?'body':material);assert.strictEqual(c.enemy.hp,material==='body'?60:material==='corpse'?0:80);
});
for(const hz of [30,60,120])check('won_phase_can_pause_cancel_and_resume',{hz},()=>{
 const c=create();c.selectWeapon('slingshot');c.damage(c.hero,c.enemy,80);step(c,1/hz,{attack:true,attackHeld:true});assert(c.hero.character.attack);
 c.setPaused(true);assert(!c.hero.character.attack);const t=c.time;for(let k=0;k<hz;k++)step(c,1/hz,{move:{x:1,y:0}});assert.strictEqual(c.time,t);
 c.setPaused(false);for(let k=0;k<hz;k++)step(c,1/hz,{move:{x:0,y:1},run:true});assert(c.hero.character.speed>430);assert.strictEqual(c.stats.shots,0);
});
for(const hz of [30,60,120])check('visual_flight_does_not_extend_damage_range',{hz},()=>{
 const c=create(0,1050);c.selectWeapon('slingshot');c.launchStone(c.hero,{direction:0,power:1});
 for(let k=0;k<hz*2;k++)step(c,1/hz);
 assert.strictEqual(c.enemy.hp,80);assert.strictEqual(c.stats.hits,0);assert.strictEqual(c.projectiles.length,0);
});
for(let d=0;d<8;d++)check('fatal_stone_uses_velocity_direction',{direction:d*45},()=>{
 const yaw=d*Math.PI/4,c=create(yaw,300);c.hero.hp=20;
 const r=P.rig.buildRig(c.hero.character.pose()),u={x:Math.cos(yaw),y:Math.sin(yaw)};
 c.projectiles.push({owner:c.enemy,pos:{x:r.chest.o.x-u.x*60,y:r.chest.o.y-u.y*60,z:r.chest.o.z},velocity:{x:u.x*1000,y:u.y*1000,z:0},damage:40,power:1,age:0,distance:0});
 for(let k=0;k<20&&!c.hero.character.death;k++)step(c,1/120);
 assert(c.hero.character.death?.forward,'tiro pelas costas não inicia queda de frente');assert.strictEqual(c.phase,'lost');
});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8,maxBoneError:Math.max(...rows.map(r=>r.bone||0)),maxBelow:Math.max(...rows.map(r=>r.below||0)),maxJointSpeed:Math.max(...rows.map(r=>r.maxJointSpeed||0)),minEscapeDistance:Math.min(...rows.filter(r=>r.distance).map(r=>r.distance))};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,6))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_EFFECTS_OUTPUT)fs.writeFileSync(process.env.PD_EFFECTS_OUTPUT,JSON.stringify({summary,rows,failures},null,2));process.exitCode=failures.length?1:0;

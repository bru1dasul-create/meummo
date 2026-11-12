// Física e anatomia em simulação; não substitui uma sessão em navegador.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),P=require('../auditoria/medir.cjs').load(root),M=P.math,B=P.BODY;
for(const f of ['slingshot','guard','combat'])vm.runInNewContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),{window:{PD:P}});
const rows=[],failures=[],flat={heightAt:()=>0,collide:(x,y)=>({x,y})};
function check(name,data,fn){const row={name,...data};try{fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.message;failures.push(row);}rows.push(row);}
function create(yaw=0,world=flat){const c=new P.TrainingCombat(new P.Character(0,0,yaw),world,{spawn:{x:Math.cos(yaw)*400,y:Math.sin(yaw)*400},enemyAI:false});c.start();return c;}
function step(c,dt,input={}){c.update(dt,input);for(const f of [c.hero,c.enemy])f.character.events.length=0;}
function run(c,hz,seconds,input={}){for(let k=0;k<Math.round(seconds*hz);k++)step(c,1/hz,typeof input==='function'?input(k):input);}
function inspect(ch,row){const r=P.rig.buildRig(ch.pose());
 row.ik=Math.max(row.ik||0,...r.ik.leg.map(a=>a.err),...r.ik.arm.map(a=>a.err));
 row.bone=Math.max(row.bone||0,...[0,1].flatMap(i=>[Math.abs(M.dist(r.hip[i],r.knee[i])-B.thigh),Math.abs(M.dist(r.knee[i],r.ankle[i])-B.shin),Math.abs(M.dist(r.shoulder[i],r.elbow[i])-B.upperArm),Math.abs(M.dist(r.elbow[i],r.wrist[i])-B.forearm)]));
 assert(row.ik<.5,`IK ${row.ik}`);assert(row.bone<1e-6);assert([r.head.o,...r.wrist,...r.knee,...r.ankle].every(p=>Object.values(p).every(Number.isFinite)));return r;
}
for(const hz of [30,60,120])for(let d=0;d<8;d++){
 const yaw=d*Math.PI/4;
 for(const offset of [0,60,70,80,120,180])check('frontal_cone_and_exact_energy_cost',{hz,direction:d*45,offset},()=>{
  const c=create(yaw),ch=c.hero.character;run(c,hz,.4,{guardHeld:true,guardDir:yaw});const before=ch.guard.energy;
  const result=c.damage(c.enemy,c.hero,40,undefined,yaw+Math.PI+offset*M.DEG,{kind:'stone',power:1});
  const block=offset<=70;assert.strictEqual(result,block?'block':'hit');assert.strictEqual(c.hero.hp,block?90:60);
  assert(Math.abs(ch.guard.energy-(before-(block?40:0)))<1e-6);assert.strictEqual(c.stats.blocks,block?1:0);
  if(block)assert(!ch.hurt&&ch.guard.active);else assert(ch.hurt&&!ch.guard.active);
 });
 for(const power of [0,.5,1])check('stone_force_sets_reaction_and_exact_recoil',{hz,direction:d*45,power},row=>{
  const c=create(yaw),ch=c.hero.character;c.damage(c.enemy,c.hero,20+power*20,undefined,yaw,{kind:'stone',power});
  assert(Math.abs(ch.hurt.strength-(.45+.55*power))<1e-6);
  for(let k=0;k<hz;k++){step(c,1/hz);inspect(ch,row);}
  row.distance=Math.hypot(ch.pos.x,ch.pos.y);assert(Math.abs(row.distance-(12+22*power))<1e-6);assert(!ch._knockback&&!ch._lastPushVelocity);assert(!ch.hurt);assert(Math.hypot(ch.vel.x,ch.vel.y)<1e-6);
 });
 check('guard_break_has_partial_reduction_and_requires_release',{hz,direction:d*45},()=>{
  const c=create(yaw),ch=c.hero.character;run(c,hz,.4,{guardHeld:true,guardDir:yaw});ch.guard.energy=5;
  assert.strictEqual(c.damage(c.enemy,c.hero,40,undefined,yaw+Math.PI,{kind:'stone',power:1}),'guardBreak');assert.strictEqual(c.hero.hp,63);assert.strictEqual(ch.guard.energy,0);
  run(c,hz,3,{guardHeld:true,guardDir:yaw});assert(ch.guard.exhausted&&!ch.guard.active);assert.strictEqual(c.stats.guardBreaks,1);
  run(c,hz,.5);assert(!ch.guard.exhausted);run(c,hz,.3,{guardHeld:true,guardDir:yaw});assert(P.guard.ready(ch));
 });
 check('holding_exhausts_once_and_lowered_guard_regenerates',{hz,direction:d*45},()=>{
  const c=create(yaw),ch=c.hero.character;run(c,hz,.3,{guardHeld:true,guardDir:yaw});ch.guard.energy=1;
  run(c,hz,1,{guardHeld:true,guardDir:yaw});assert.strictEqual(c.stats.guardBreaks,1);assert(ch.guard.exhausted&&!ch.guard.active);
  run(c,hz,1,{guardHeld:true,guardDir:yaw});assert.strictEqual(c.stats.guardBreaks,1);
  run(c,hz,5);assert.strictEqual(ch.guard.energy,100);assert(!ch.guard.exhausted);assert.strictEqual(ch.guard.blend,0);
 });
 check('guard_cannot_block_before_raised_or_while_lowering',{hz,direction:d*45},()=>{
  const c=create(yaw),ch=c.hero.character;step(c,1/hz,{guardHeld:true,guardDir:yaw});assert(!P.guard.ready(ch));
  run(c,hz,.4,{guardHeld:true,guardDir:yaw});assert(P.guard.ready(ch));step(c,1/hz);assert(!P.guard.ready(ch));
 });
 for(const context of ['idle','walk','run','crouch','jump','dodge','charge'])check('guard_transition_preserves_limbs_and_resumes_action',{hz,direction:d*45,context},row=>{
  const c=create(yaw),ch=c.hero.character,move={x:Math.cos(yaw),y:Math.sin(yaw)};
  c.enemy.character.pos.x=-Math.cos(yaw)*400;c.enemy.character.pos.y=-Math.sin(yaw)*400;
  if(context==='charge')ch.equip('maoE','estilingue');
  run(c,hz,.6,{move:['walk','run'].includes(context)?move:null,run:context==='run',crouchSet:context==='crouch'});
  if(context==='charge')run(c,hz,.4,k=>({attack:k===0,attackHeld:true,attackDir:yaw}));
  let previous=inspect(ch,row);row.maxJointSpeed=0;
  for(let k=0;k<hz*2;k++){
   step(c,1/hz,{guardHeld:k<hz*.7,guardDir:yaw,move:['walk','run'].includes(context)?move:null,run:context==='run',jump:context==='jump'&&k===Math.round(hz*.4),dodge:context==='dodge'&&k===Math.round(hz*.4)});
   const r=inspect(ch,row);for(const [a,b] of [[r.chest.o,previous.chest.o],...[0,1].flatMap(i=>[[r.knee[i],previous.knee[i]],[r.wrist[i],previous.wrist[i]]])])row.maxJointSpeed=Math.max(row.maxJointSpeed,M.dist(a,b)*hz);previous=r;
  }
  assert(row.maxJointSpeed<2100,`salto de articulação ${row.maxJointSpeed}`);assert(!ch.guard.active&&!ch.guard.blend&&!ch.dodge&&!ch.hurt&&!ch.attack);assert.strictEqual(c.stats.shots,0);
  if(context==='run')assert(ch.speed>430);if(context==='walk')assert(Math.abs(ch.speed-160)<.01);
 });
 for(const power of [0,.5,1])check('fatal_stone_keeps_fall_direction_and_stable_body',{hz,direction:d*45,power},row=>{
  const c=create(yaw),ch=c.hero.character;c.hero.hp=10;c.damage(c.enemy,c.hero,20,undefined,yaw,{kind:'stone',power});assert(ch.death.forward);
  run(c,hz,2);const r=inspect(ch,row),p={...ch.pos};assert(Math.abs(Math.hypot(p.x,p.y)-(8+10*power))<.01);assert(r.chest.f.z<-.85);
  run(c,hz,1);assert(M.dist(ch.pos,p)<1e-6);assert.strictEqual(ch.label,'Morto');
 });
}
for(const hz of [30,60,120])for(const context of ['idle','walk','run','jump','dodge'])check('strong_hit_during_motion_recovers_without_stuck_input',{hz,context},row=>{
 const c=create(),ch=c.hero.character;run(c,hz,.5,{move:['walk','run'].includes(context)?{x:0,y:1}:null,run:context==='run'});
 if(context==='jump'||context==='dodge')run(c,hz,.04,k=>({jump:context==='jump'&&k===0,dodge:context==='dodge'&&k===0}));
 c.damage(c.enemy,c.hero,40,undefined,Math.PI,{kind:'stone',power:1});
 for(let k=0;k<hz*2;k++){step(c,1/hz,{move:{x:0,y:1},run:true});inspect(ch,row);}
 assert(!ch.hurt&&!ch.dodge&&!ch._knockback);assert(ch.speed>430);assert(ch.pos.y>500);
});
for(const hz of [30,60,120])for(const guarded of [true,false])check('knockback_respects_wall_and_other_actor',{hz,guarded},()=>{
 const wall={heightAt:()=>0,collide:(x,y)=>({x:Math.min(x,20),y})},c=create(0,wall),ch=c.hero.character;
 if(guarded)run(c,hz,.4,{guardHeld:true,guardDir:Math.PI});
 c.damage(c.enemy,c.hero,40,undefined,0,{kind:'stone',power:1});run(c,hz,1,{guardHeld:guarded,guardDir:Math.PI});assert(ch.pos.x<=20+1e-6);
 const a=create(),hero=a.hero.character;hero.pos.x=340;hero.yaw=0;hero.faceYaw=0;hero._pose=null;
 a.damage(a.enemy,a.hero,40,undefined,0,{kind:'stone',power:1});run(a,hz,1);assert(Math.hypot(hero.pos.x-400,hero.pos.y)>=43.99);assert.strictEqual(a.enemy.character.pos.x,400);
});
check('break_feedback_on_last_projectile_substep_is_not_lost',{},()=>{
 const c=create(),ch=c.hero.character;run(c,120,.4,{guardHeld:true,guardDir:0});ch.guard.energy=2;const r=P.rig.buildRig(ch.pose());
 c.projectiles.push({owner:c.enemy,pos:{x:r.chest.o.x+5,y:r.chest.o.y,z:r.chest.o.z},velocity:{x:-1000,y:0,z:0},damage:40,power:1,age:0,distance:0});
 step(c,1/120,{guardHeld:true,guardDir:0});assert.strictEqual(c.stats.guardBreaks,1);assert(c.effects.some(e=>e.kind==='guardBreak'));
 run(c,120,1);assert.strictEqual(c.stats.guardBreaks,1);
});
check('pause_freezes_energy_and_reset_restores_it',{},()=>{
 const c=create(),ch=c.hero.character;run(c,60,1,{guardHeld:true});const energy=ch.guard.energy;c.setPaused(true);run(c,60,3,{guardHeld:true});assert.strictEqual(ch.guard.energy,energy);assert(!ch.guard.active);
 c.setPaused(false);run(c,60,1);assert.strictEqual(ch.guard.blend,0);c.reset(new P.Character(0,0,0));assert.strictEqual(c.hero.character.guard.energy,100);assert.strictEqual(c.stats.blocks,0);
});
check('rapid_guard_reentry_has_no_duplicated_pose_blend',{},row=>{
 const c=create(),ch=c.hero.character;run(c,120,.4,{guardHeld:true});run(c,120,.05);const before=P.rig.buildRig(ch.pose());step(c,1/120,{guardHeld:true});const after=inspect(ch,row);
 assert(Math.max(...[0,1].map(i=>M.dist(before.wrist[i],after.wrist[i])))<5);
});
check('approved_visual_model_and_test_rival_AI_remain_identical',{},()=>{
 const crypto=require('crypto'),hash=value=>crypto.createHash('sha256').update(value).digest('hex'),reference=JSON.parse(fs.readFileSync(root+'/auditoria/referencia-visual-ia-r15.json','utf8'));
 for(const [file,sha] of Object.entries(reference.files))assert.strictEqual(hash(fs.readFileSync(root+'/'+file)),sha,file);
 const source=fs.readFileSync(root+'/js/combat.js','utf8'),methods=source.slice(source.indexOf('    enemyInput(dt) {'),source.indexOf('    protectedByDodge(character) {'));
 assert.strictEqual(hash(methods),reference.enemyMethodsSHA256);

});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8,maxIK:Math.max(...rows.map(r=>r.ik||0)),maxBoneError:Math.max(...rows.map(r=>r.bone||0)),maxJointSpeed:Math.max(...rows.map(r=>r.maxJointSpeed||0))};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,12))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_GUARD_OUTPUT)fs.writeFileSync(process.env.PD_GUARD_OUTPUT,JSON.stringify({summary,rows,failures},null,2));process.exitCode=failures.length?1:0;

const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),P=require('../auditoria/medir.cjs').load(root),M=P.math,rows=[],failures=[];
for(const f of ['slingshot','combat'])vm.runInNewContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),{window:{PD:P}});
const flat={heightAt:()=>0,collide:(x,y)=>({x,y})};
function create(yaw=0,range=300,world=flat){const c=new P.TrainingCombat(new P.Character(0,0,yaw),world,{spawn:{x:Math.cos(yaw)*range,y:Math.sin(yaw)*range},enemyAI:false});assert(c.selectWeapon('slingshot'));return c;}
function step(c,h,input={}){c.update(h,input);for(const f of [c.hero,c.enemy])f.character.events.length=0;}
function check(name,data,fn){const row={name,...data};try{fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.message;failures.push(row);}rows.push(row);}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const kind of ['hit','side','wall','far'])check('stone_flight',{hz,direction:d*45,kind},row=>{
 const yaw=d*Math.PI/4,u={x:Math.cos(yaw),y:Math.sin(yaw)};
 const wall={heightAt:()=>0,collide:(x,y,r)=>{const at=x*u.x+y*u.y,delta=at-150;if(Math.abs(delta)>=r+3)return{x,y};const push=(delta<0?-(r+3):r+3)-delta;return{x:x+u.x*push,y:y+u.y*push};}};
 const c=create(yaw,kind==='far'?1000:300,kind==='wall'?wall:flat);c.start();let seen=false;row.ik=0;
 for(let k=0;k<hz*1.5;k++){
  step(c,1/hz,{attack:k===0,attackDir:yaw+(kind==='side'?Math.PI/2:0)});seen ||= !!c.projectiles.length;
  const r=P.rig.buildRig(c.hero.character.pose());row.ik=Math.max(row.ik,...r.ik.arm.map(x=>x.err),...r.ik.leg.map(x=>x.err));
  for(const p of c.projectiles)assert([p.pos.x,p.pos.y,p.pos.z].every(Number.isFinite));
 }
 row.hp=c.enemy.hp;row.shots=c.stats.shots;assert(seen);assert.strictEqual(c.enemy.hp,kind==='hit'?60:80);assert.strictEqual(c.stats.shots,1);assert.strictEqual(c.projectiles.length,0);assert(row.ik<.5);
});
for(const hz of [30,60,120]){
 check('slingshot_against_active_rival',{hz},()=>{
  const c=create();c.options.enemyAI=true;c.start();
  for(let k=0;k<hz*8;k++)step(c,1/hz,{attack:k%Math.round(hz*.85)===0});
  assert.strictEqual(c.phase,'won');assert.strictEqual(c.enemy.hp,0);assert(c.hero.hp>0);assert(c.stats.shots>=4);
 });
 check('four_stones_win_free_shot_remains_and_reset_clears_flight',{hz},()=>{
  const c=create();for(let k=0;k<hz*5;k++)step(c,1/hz,{attack:k%hz===0});assert.strictEqual(c.phase,'won');assert.strictEqual(c.enemy.hp,0);assert.strictEqual(c.stats.hits,4);assert.strictEqual(c.stats.shots,5);assert.strictEqual(c.projectiles.length,0);assert(c.canReset);
  c.reset(new P.Character(0,0,0));assert.strictEqual(c.stats.shots,0);assert.strictEqual(c.enemy.hp,80);assert.strictEqual(c.projectiles.length,0);
 });
 check('pause_preserves_stone_then_resumes_hit',{hz},()=>{
  const c=create();c.start();for(let k=0;k<hz;k++){step(c,1/hz,{attack:k===0});if(c.projectiles.length)break;}
  assert(c.projectiles.length);const p=JSON.stringify(c.projectiles[0].pos),age=c.projectiles[0].age;c.setPaused(true);
  for(let k=0;k<hz;k++)step(c,1/hz);assert.strictEqual(JSON.stringify(c.projectiles[0].pos),p);assert.strictEqual(c.projectiles[0].age,age);
  c.setPaused(false);for(let k=0;k<hz;k++)step(c,1/hz);assert.strictEqual(c.enemy.hp,60);
 });
 check('dodge_cancels_draw_and_keeps_running',{hz},()=>{
  const c=create(0,1000);c.start();for(let k=0;k<Math.ceil(.1*hz);k++)step(c,1/hz,{attack:k===0});
  step(c,1/hz,{dodge:true,move:{x:1,y:0},run:true});assert(c.hero.character.dodge);assert(!c.hero.character.attack);
  for(let k=0;k<hz;k++)step(c,1/hz,{move:{x:1,y:0},run:true});assert.strictEqual(c.stats.shots,0);assert(c.hero.character.label==='Correndo');
 });
 check('switching_weapon_waits_for_action',{hz},()=>{
  const c=create();c.start();step(c,1/hz,{attack:true});assert(!c.selectWeapon('fists'));for(let k=0;k<hz;k++)step(c,1/hz);assert(c.selectWeapon('fists'));assert.strictEqual(c.weapon,'fists');assert(!Object.values(c.hero.character.equipped).includes('estilingue'));
 });
 check('being_hit_cancels_unreleased_stone',{hz},()=>{
  const c=create();c.start();step(c,1/hz,{attack:true});c.damage(c.enemy,c.hero,14);for(let k=0;k<hz;k++)step(c,1/hz);assert.strictEqual(c.stats.shots,0);assert.strictEqual(c.enemy.hp,80);
 });
 check('stone_respects_dodge_protection',{hz},()=>{
  const c=create();c.start();c.enemy.character.update(.1,{dodge:true});assert(c.protectedByDodge(c.enemy.character));
  const r=P.rig.buildRig(c.enemy.character.pose()),p=M.lerp3(r.pelvis.o,r.neckBase,.5);
  c.projectiles.push({owner:c.hero,pos:{x:p.x-4,y:p.y,z:p.z},velocity:{x:1000,y:0,z:0},age:0,distance:0,groundZ:0});
  c.updateProjectiles(1/120);assert.strictEqual(c.enemy.hp,80);assert.strictEqual(c.projectiles.length,0);
 });
}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const run of [false,true])check('shooting_while_changing_sides',{hz,direction:d*45,run},row=>{
 const yaw=d*Math.PI/4,c=create(yaw,1000);c.start();row.ik=0;row.minGap=Infinity;row.maxHipDrop=0;
 for(let k=0;k<hz*3;k++){
  const dir=yaw+(Math.floor(k/hz/.7)%2?1:-1)*Math.PI/2;
  step(c,1/hz,{move:{x:Math.cos(dir),y:Math.sin(dir)},run,attack:k%Math.round(hz*.8)===0,attackDir:yaw});
  const a=c.hero.character,r=P.rig.buildRig(a.pose());row.ik=Math.max(row.ik,...r.ik.arm.map(x=>x.err),...r.ik.leg.map(x=>x.err));
  row.minGap=Math.min(row.minGap,M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r));row.maxHipDrop=Math.max(row.maxHipDrop,a.hipDrop);
 }
 assert(row.ik<.5);assert(row.minGap>=-.05);assert(row.maxHipDrop<15);
});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8};console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,10))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_SLING_OUTPUT)fs.writeFileSync(process.env.PD_SLING_OUTPUT,JSON.stringify({summary,rows,failures},null,2));process.exitCode=failures.length?1:0;

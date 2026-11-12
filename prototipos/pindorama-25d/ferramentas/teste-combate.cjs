// Combate real em 30/60/120 Hz: acerto, erro, parede, IA, esquiva e fim de rodada.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {load}=require('../auditoria/medir.cjs');
const root=path.resolve(__dirname,'..'),P=load(root),rows=[],failures=[];
vm.runInNewContext(fs.readFileSync(path.join(root,'js/combat.js'),'utf8'),{window:{PD:P}});
const flat={heightAt:()=>0,collide:(x,y)=>({x,y})};
function create(yaw=0,range=78,enemyAI=false,world=flat){
 const hero=new P.Character(0,0,yaw);
 const c=new P.TrainingCombat(hero,world,{spawn:{x:Math.cos(yaw)*range,y:Math.sin(yaw)*range},enemyAI});c.start();return c;
}
function step(c,h,input={}){
 c.update(h,input);
 for(const f of [c.hero,c.enemy]){
  assert(f.hp>=0&&f.hp<=f.maxHp);
  assert([f.character.pos.x,f.character.pos.y,f.character.pos.z].every(Number.isFinite));
  f.character.events.length=0;
 }
}
function check(name,data,fn){try{fn();rows.push({name,...data,passed:true});}catch(e){const f={name,...data,error:e.message};rows.push({...f,passed:false});failures.push(f);}}
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const kind of ['hit','far','side','wall']){
 const yaw=d*Math.PI/4,co=Math.cos(yaw),si=Math.sin(yaw);
 const wall={heightAt:()=>0,collide:(x,y,r)=>{
  const along=x*co+y*si,offset=along-38,min=r+3;
  if(Math.abs(offset)>=min)return {x,y};
  const push=(offset<0?-min:min)-offset;return {x:x+co*push,y:y+si*push};
 }};
 const c=create(yaw,kind==='far'?240:78,false,kind==='wall'?wall:flat);
 if(kind==='side'){c.enemy.character.pos.x=-si*78;c.enemy.character.pos.y=co*78;}
 for(let k=0;k<hz;k++)step(c,1/hz,{attack:k===0,attackDir:yaw});
 check('punch',{hz,direction:d*45,kind,hp:c.enemy.hp,hits:c.stats.hits},()=>{
  assert.strictEqual(c.enemy.hp,kind==='hit'?60:80);assert.strictEqual(c.stats.hits,kind==='hit'?1:0);
 });
}
for(const hz of [30,60,120]){
 check('victory',{hz},()=>{
  const c=create(0,78,true);
  for(let k=0;k<hz*7;k++)step(c,1/hz,{attack:k%(hz/2)===0,attackDir:0});
  assert.strictEqual(c.phase,'won');assert.strictEqual(c.enemy.hp,0);assert.strictEqual(c.stats.hits,4);
  assert(c.enemy.character.death);assert.strictEqual(c.enemy.character.label,'Morto');assert(c.canReset);
  const health=c.hero.hp;for(let k=0;k<hz*3;k++)step(c,1/hz,{});assert.strictEqual(c.hero.hp,health);
 });
 check('defeat_and_telegraph',{hz},()=>{
  const c=create(0,300,true);let warning=null,firstDamage=null;
  for(let k=0;k<hz*20;k++){
   step(c,1/hz,{});if(c.telegraph&&warning===null)warning=c.time;if(c.hero.hp<100&&firstDamage===null)firstDamage=c.time;
  }
  assert(firstDamage-warning>.5);assert.strictEqual(c.phase,'lost');assert.strictEqual(c.hero.hp,0);
  assert.strictEqual(c.stats.received,8);assert.strictEqual(c.hero.character.label,'Morto');assert(c.canReset);
 });
 for(const timing of ['timed','late'])check('live_dodge',{hz,timing},()=>{
  const c=create(0,78,true);let pressed=false,accepted=false;
  for(let k=0;k<Math.ceil(hz*1.7);k++){
   const attack=c.enemy.character.attack;
   const dodge=!pressed&&attack&&attack.t>=(timing==='timed'?.08:.23);
   if(dodge)pressed=true;
   step(c,1/hz,{dodge:!!dodge,move:dodge?{x:1,y:0}:null});
   // Um golpe fora da proteção pode interromper Q no mesmo quadro em que ele começou.
   accepted ||= !!c.hero.character.dodge || !!(c.hero.character.hurt && c.hero.character.dodgeCooldown > 0);
   assert(Math.hypot(c.hero.character.pos.x-c.enemy.character.pos.x,c.hero.character.pos.y-c.enemy.character.pos.y)>=43.99);
  }
  assert(pressed&&accepted);assert.strictEqual(c.hero.hp,timing==='timed'?100:86);
  assert.strictEqual(c.stats.dodges,timing==='timed'?1:0);
 });
}
for(const age of [.008,.02,.1,.22,.26,.35])check('dodge_window',{age},()=>{
 const c=create(0,400,false);
 const ticks=Math.round(age*120);
 for(let k=0;k<Math.max(1,ticks);k++)step(c,1/120,{dodge:k===0});
 const protectedNow=c.hero.character.dodge.t>=P.COMBAT.dodgeStart&&c.hero.character.dodge.t<=P.COMBAT.dodgeEnd;
 const result=c.damage(c.enemy,c.hero,14);
 assert.strictEqual(result,protectedNow?'dodge':'hit');assert.strictEqual(c.hero.hp,protectedNow?100:86);
});
check('pause_resume_reset',{},()=>{
 const c=create(0,300,true);for(let k=0;k<40;k++)step(c,1/60,{});
 c.setPaused(true);const age=c.time,pos={...c.enemy.character.pos},hp=c.hero.hp;
 for(let k=0;k<120;k++)step(c,1/60,{});
 assert.strictEqual(c.time,age);assert.strictEqual(c.enemy.character.pos.x,pos.x);assert.strictEqual(c.hero.hp,hp);
 c.setPaused(false);assert(!c.paused);assert(c.cooldown>=.4);
 c.damage(c.enemy,c.hero,14);assert.strictEqual(c.hero.hp,86);
 c.reset(new P.Character(0,0,0));assert.strictEqual(c.hero.hp,100);assert.strictEqual(c.enemy.hp,80);
 assert.strictEqual(c.phase,'ready');assert.strictEqual(c.effects.length,0);assert(!c.hasStarted);
});
check('hit_uses_torso_height',{},()=>{
 const c=create(0,78,false);c.enemy.character.pos.z=160;
 for(let k=0;k<30;k++)step(c,1/120,{attack:k===0,attackDir:0});
 assert.strictEqual(c.enemy.hp,80);
});
// Exercita os colisores e o chão do cenário entregue, além das arenas sintéticas.
check('real_map_enemy_can_approach_and_attack',{},()=>{
 for(const f of ['map','ground','props','world'])vm.runInNewContext(fs.readFileSync(path.join(root,'js/world',f+'.js'),'utf8'),{window:{PD:P},performance:{now:()=>0}});
 const cam=new P.IsoCamera(),world=new P.World(cam),sp=P.MAP.spawn,hero=new P.Character(sp.x,sp.y,Math.PI/4);
 hero.groundZ=world.heightAt(sp.x,sp.y);const c=new P.TrainingCombat(hero,world);c.start();
 for(let k=0;k<60*20;k++){
  step(c,1/60,{});
  for(const f of [c.hero,c.enemy]){
   const a=f.character,p=world.collide(a.pos.x,a.pos.y,a.radius);
   assert(Math.hypot(p.x-a.pos.x,p.y-a.pos.y)<.01);
  }
 }
 assert.strictEqual(c.phase,'lost');assert.strictEqual(c.hero.hp,0);assert.strictEqual(hero.label,'Morto');
});
check('two_actor_depth_and_particle_ownership',{},()=>{
 const world=Object.create(P.World.prototype),order=[],A={},B={};
 Object.assign(world,{cam:new P.IsoCamera(),time:0,map:{wires:[]},poles:[],props:[],particles:[{id:'pa',kind:'pow',behind:true,owner:A},{id:'pb',kind:'pow',behind:true,owner:B}],petals:[],sparks:[],ground:{draw(){}},_drawAwakening(){},_drawSparks(){},_drawWires(){},_drawParticle(_ctx,p){order.push(p.id);},_staticOrder(){return [];}});
 const make=(id,n,entity)=>({entity,primary:id==='a',fp:{x0:n,y0:n,x1:n+20,y1:n+20},bounds:{x0:0,y0:0,x1:100,y1:100},drawShadow(){},draw(){order.push(id);}});
 for(const actors of [[make('a',100,A),make('b',200,B)],[make('b',200,B),make('a',100,A)]]){
  order.length=0;world.draw({},actors);assert.strictEqual(order.filter(x=>x==='pa').length,1);assert.strictEqual(order.filter(x=>x==='pb').length,1);
  assert(order.indexOf('a')<order.indexOf('b'));
 }
});
check('single_strike_and_immunity',{},()=>{
 const c=create();const ev={type:'impacto',hand:0};
 c.damage(c.hero,c.enemy,20);c.damage(c.hero,c.enemy,20);assert.strictEqual(c.enemy.hp,60);
 c.hero.character.events.push(ev);step(c,1/60,{});assert(ev.combatResolved);const hp=c.enemy.hp;
 c.hero.character.events.push(ev);step(c,1/60,{});assert.strictEqual(c.enemy.hp,hp);
});
const summary={scenarios:rows.length,failures:failures.length,punchCases:96,rates:[30,60,120],directions:8};
console.log(JSON.stringify(summary,null,2));for(const f of failures)console.error('FALHA',JSON.stringify(f));
if(process.env.PD_COMBAT_OUTPUT)fs.writeFileSync(process.env.PD_COMBAT_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

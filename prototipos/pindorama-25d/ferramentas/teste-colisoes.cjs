// Reproduz arrasto de cadáver, travessia de atores e retomada de movimento após Q.
// Usa a física entregue, em 8 direções e 30/60/120 Hz. Não substitui avaliação visual.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const {load}=require(path.join(root,'auditoria/medir.cjs')),P=load(root),M=P.math,B=P.BODY;
vm.runInNewContext(fs.readFileSync(path.join(root,'js/combat.js'),'utf8'),{window:{PD:P}});
const flat={heightAt:()=>0,collide:(x,y)=>({x,y})},rows=[],failures=[];
function create(yaw,range=140,world=flat){
 const c=new P.TrainingCombat(new P.Character(0,0,yaw),world,{spawn:{x:Math.cos(yaw)*range,y:Math.sin(yaw)*range},enemyAI:false});c.start();return c;
}
function step(c,dt,input={}){c.update(dt,input);for(const f of [c.hero,c.enemy])f.character.events.length=0;}
function check(name,data,fn){const row={name,...data};try{fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.message;failures.push(row);}rows.push(row);}
function rigPoints(c){const r=P.rig.buildRig(c.pose());return [r.pelvis.o,r.chest.o,r.head.o,...r.knee,...r.ankle,...r.wrist].flatMap(p=>[p.x,p.y,p.z]);}
function inspect(ch,row){
 const r=P.rig.buildRig(ch.pose());
 assert(rigPoints(ch).every(Number.isFinite));
 row.ik=Math.max(row.ik||0,...r.ik.leg.map(x=>x.err),...r.ik.arm.map(x=>x.err));
 row.bone=Math.max(row.bone||0,...[0,1].flatMap(i=>[
  Math.abs(M.dist(r.hip[i],r.knee[i])-B.thigh),Math.abs(M.dist(r.knee[i],r.ankle[i])-B.shin),
  Math.abs(M.dist(r.shoulder[i],r.elbow[i])-B.upperArm),Math.abs(M.dist(r.elbow[i],r.wrist[i])-B.forearm)]));
 if(ch.dodge)row.below=Math.max(row.below||0,...P.rig.supportSpheres(r).map(s=>ch.groundZ-s.p.z+s.r));
 assert(row.ik<.5);assert(row.bone<1e-6);assert((row.below||0)<.3);
}
function nearest(p,a,b){const x=b.x-a.x,y=b.y-a.y,n=x*x+y*y,t=n?M.clamp(((p.x-a.x)*x+(p.y-a.y)*y)/n,0,1):0;return {x:a.x+x*t,y:a.y+y*t};}
function corpseShapes(ch){const r=P.rig.buildRig(ch.pose());return [
 [r.pelvis.o,r.neckBase,18],[r.neckBase,r.head.o,13],
 ...[0,1].flatMap(i=>[[r.hip[i],r.knee[i],9],[r.knee[i],r.ankle[i],7]])];}
for(const hz of [30,60,120])for(let d=0;d<8;d++){
 const yaw=d*Math.PI/4,u={x:Math.cos(yaw),y:Math.sin(yaw)},tangent={x:-u.y,y:u.x},dt=1/hz;
 check('dead_body_stays_put_and_blocks_crossing',{hz,direction:d*45},row=>{
  const c=create(yaw),dead=c.enemy.character;c.damage(c.hero,c.enemy,80);
  for(let k=0;k<hz*2;k++)step(c,dt);
  const start={...dead.pos},points=rigPoints(dead),shapes=corpseShapes(dead);row.drift=0;row.rigDrift=0;row.penetration=0;
  for(let k=0;k<hz*3;k++){
   step(c,dt,{move:u,run:true,dodge:k===Math.round(.1*hz)});
   row.drift=Math.max(row.drift,M.dist(start,dead.pos));
   row.rigDrift=Math.max(row.rigDrift,...rigPoints(dead).map((x,i)=>Math.abs(x-points[i])));
   for(const [a,b,r]of shapes){const q=nearest(c.hero.character.pos,a,b);row.penetration=Math.max(row.penetration,26+r-Math.hypot(c.hero.character.pos.x-q.x,c.hero.character.pos.y-q.y));}
   inspect(c.hero.character,row);
  }
  assert(row.drift<1e-6,`corpo arrastado ${row.drift} cm`);assert(row.rigDrift<1e-6);assert(row.penetration<.05,`atravessou corpo ${row.penetration} cm`);
 });
 check('blocked_dodge_then_run_around_rival',{hz,direction:d*45},row=>{
  const c=create(yaw,150),a=c.hero.character;row.minDistance=Infinity;row.exited=false;
  for(let k=0;k<hz*2;k++){
   step(c,dt,{move:k<hz*.65?u:tangent,run:true,dodge:k===Math.round(.2*hz)});
   row.minDistance=Math.min(row.minDistance,M.dist(a.pos,c.enemy.character.pos));inspect(a,row);
   if(k>hz*.65&&!a.dodge)row.exited=true;
  }
  row.finalSpeed=a.speed;row.finalHipDrop=a.hipDrop;
  assert(row.minDistance>=51.99);assert(row.exited);assert(!a.dodge&&!a.hurt&&!a.attack);
  assert(a.label==='Correndo'&&a.speed>430);assert(a.hipDrop<8);
 });
 check('moving_actors_do_not_cross',{hz,direction:d*45},row=>{
  const c=create(yaw,280);c.enemyInput=()=>({move:{x:-u.x,y:-u.y},run:true});row.minDistance=Infinity;
  for(let k=0;k<hz*1.2;k++){
   step(c,dt,{move:u,run:true,dodge:k===Math.round(.15*hz)});
   row.minDistance=Math.min(row.minDistance,M.dist(c.hero.character.pos,c.enemy.character.pos));
   inspect(c.hero.character,row);inspect(c.enemy.character,row);
  }
  assert(row.minDistance>=51.99);const delta=M.sub(c.enemy.character.pos,c.hero.character.pos);assert(delta.x*u.x+delta.y*u.y>0);
 });
 check('swept_prediction_cannot_jump_over_rival',{hz,direction:d*45},row=>{
  const c=create(yaw,90),p=c.heroWorld.collide(u.x*200,u.y*200,22);
  row.along=p.x*u.x+p.y*u.y;assert(row.along<39);assert(Math.hypot(p.x-u.x*90,p.y-u.y*90)>=51.99);
 });
 check('tangent_movement_remains_free',{hz,direction:d*45},row=>{
  const c=create(yaw,52.01);c.hero.character.yaw=yaw+Math.PI/2;
  for(let k=0;k<hz;k++)step(c,dt,{move:tangent,run:true});
  row.speed=c.hero.character.speed;assert(row.speed>439);assert(c.hero.character.label==='Correndo');
 });
}
for(const hz of [30,60,120])for(const age of [.008,.02,.1,.22,.26,.35])check('damage_during_Q_is_immediate_or_protected',{hz,age},row=>{
 const c=create(0,1000),a=c.hero.character;
 for(let k=0;k<Math.max(1,Math.round(age*hz));k++)step(c,1/hz,{dodge:k===0});
 const protectedNow=c.protectedByDodge(a),result=c.damage(c.enemy,c.hero,14);
 assert.strictEqual(result,protectedNow?'dodge':'hit');
 if(!protectedNow){assert(!a.dodge&&a.hurt,'impacto foi adiado para depois da esquiva');}
 for(let k=0;k<hz;k++){step(c,1/hz,{move:{x:1,y:0},run:true});inspect(a,row);}
 assert(!a.hurt&&!a.dodge);assert(a.label==='Correndo'&&a.speed>435);
});
for(const hz of [30,60,120])for(let d=0;d<8;d++)for(const delay of [0,.075,.15,.3])for(const offset of [0,90,180,-90])check('Q_while_accelerating_keeps_support_reachable',{hz,direction:d*45,delay,offset},row=>{
 const yaw=d*Math.PI/4,c=create(yaw,10000),a=c.hero.character,u={x:Math.cos(yaw),y:Math.sin(yaw)};
 const dir=yaw+offset*Math.PI/180,move={x:Math.cos(dir),y:Math.sin(dir)};
 for(let k=0;k<Math.round(delay*hz);k++)step(c,1/hz,{move:u,run:true});
 for(let k=0;k<Math.ceil(hz*1.3);k++){
  step(c,1/hz,{move,run:true,dodge:k===0});inspect(a,row);
  if(a.dodge){const r=P.rig.buildRig(a.pose());assert(M.dot(M.sub(r.ankle[1],r.ankle[0]),r.body.r)>=-.05);}
 }
 assert(!a.dodge&&!a.hurt);assert(a.label==='Correndo'&&a.speed>430);assert(a.hipDrop<8);
});
for(const hz of [30,60,120])check('repeated_damage_does_not_queue_another_stun',{hz},row=>{
 const c=create(0,1000),a=c.hero.character;c.damage(c.enemy,c.hero,14);
 for(let k=0;k<Math.ceil(.35*hz);k++)step(c,1/hz,{move:{x:1,y:0},run:true});
 const age=a.hurt.t;assert.strictEqual(c.damage(c.enemy,c.hero,14),'hit');assert.strictEqual(a.hurt.t,age);
 for(let k=0;k<Math.ceil(.4*hz);k++)step(c,1/hz,{move:{x:1,y:0},run:true});
 assert.strictEqual(c.hero.hp,72);assert(!a.hurt);assert(a.label==='Correndo');row.speed=a.speed;
});
for(const hz of [30,60,120])check('blocked_punch_does_not_invent_backwards_steps',{hz},row=>{
 const c=create(0,52.00001);row.maxSpeed=0;row.maxVelocity=0;
 for(let k=0;k<hz*.65;k++){
  step(c,1/hz,{attack:k===0,attackDir:0});const a=c.hero.character;
  row.maxSpeed=Math.max(row.maxSpeed,a.speed);row.maxVelocity=Math.max(row.maxVelocity,Math.hypot(a.vel.x,a.vel.y));
 }
 assert(row.maxVelocity<.001);assert(row.maxSpeed<.001);
});
for(const hz of [30,60,120])check('actor_against_wall_cannot_be_crossed',{hz},row=>{
 const world={heightAt:()=>0,collide:(x,y,r)=>({x:Math.min(x,100-r),y:Math.max(-35+r,Math.min(35-r,y))})};
 const c=create(0,70,world);row.minDistance=Infinity;
 for(let k=0;k<hz;k++){
  step(c,1/hz,{move:{x:1,y:.15},run:true,dodge:k===Math.round(.1*hz)});
  const a=c.hero.character;row.minDistance=Math.min(row.minDistance,M.dist(a.pos,c.enemy.character.pos));
  assert(Math.abs(a.pos.y)<=13.001);assert(a.pos.x<=78.001);
 }
 assert(row.minDistance>=51.99);assert(c.hero.character.pos.x<c.enemy.character.pos.x);
});
// Colisão e desenho no cenário usado pela entrega.
for(const f of ['map','ground','props','world'])vm.runInNewContext(fs.readFileSync(path.join(root,'js/world',f+'.js'),'utf8'),{window:{PD:P},performance:{now:()=>0}});
for(const hz of [30,60,120])check('corpse_in_real_map_is_static',{hz},row=>{
 const world=new P.World(new P.IsoCamera()),sp=P.MAP.spawn,hero=new P.Character(sp.x,sp.y,Math.PI/4);
 hero.groundZ=world.heightAt(sp.x,sp.y);const c=new P.TrainingCombat(hero,world,{enemyAI:false});c.start();c.damage(c.hero,c.enemy,80);
 for(let k=0;k<hz*2;k++)step(c,1/hz);
 const dead=c.enemy.character,start={...dead.pos},dir=M.norm(M.sub(dead.pos,hero.pos));
 row.drift=0;
 for(let k=0;k<hz*3;k++){
  step(c,1/hz,{move:dir,run:true,dodge:k===Math.round(.3*hz)});row.drift=Math.max(row.drift,M.dist(start,dead.pos));
  const p=world.collide(hero.pos.x,hero.pos.y,hero.radius);assert(Math.hypot(p.x-hero.pos.x,p.y-hero.pos.y)<.01);inspect(hero,row);
 }
 assert(row.drift<1e-6);
});
check('ground_corpse_draws_below_live_actor_even_near_props',{},()=>{
 const world=Object.create(P.World.prototype),drawn=[];
 const prop={fp:{x0:100,y0:100,x1:130,y1:130},bounds:{x0:0,y0:0,x1:200,y1:200},draw(){drawn.push('prop');}};
 Object.assign(world,{cam:new P.IsoCamera(),time:0,map:{wires:[]},poles:[],props:[prop],particles:[],petals:[],sparks:[],ground:{draw(){}},_drawAwakening(){},_drawSparks(){},_drawWires(){},_staticOrder(){return [prop];}});
 const actor=(id,ground,n)=>({groundedCorpse:ground,fp:{x0:n,y0:n,x1:n+20,y1:n+20},bounds:{x0:0,y0:0,x1:100,y1:100},drawShadow(){},draw(){drawn.push(id);}});
 for(const actors of [[actor('live',false,0),actor('corpse',true,200)],[actor('corpse',true,200),actor('live',false,0)]]){
  drawn.length=0;world.draw({},actors);assert(drawn.indexOf('corpse')<drawn.indexOf('live'));
 }
});
const summary={scenarios:rows.length,failures:failures.length,rates:[30,60,120],directions:8,
 maxCorpseDrift:Math.max(0,...rows.map(r=>r.drift||0)),maxCorpseRigDrift:Math.max(0,...rows.map(r=>r.rigDrift||0)),
 maxPenetration:Math.max(0,...rows.map(r=>r.penetration||0)),ikMax:Math.max(0,...rows.map(r=>r.ik||0))};
console.log(JSON.stringify(summary,null,2));for(const row of failures.slice(0,12))console.error('FALHA',JSON.stringify(row));
if(process.env.PD_COLLISION_OUTPUT)fs.writeFileSync(process.env.PD_COLLISION_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

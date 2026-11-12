// Regressão do combate com rival de soco. O duelo de estilingue é coberto por teste-carga-controles.cjs.
// Integração do HTML, entrada, jogo, combate e HUD por eventos simulados.
const fs=require('fs'),assert=require('assert');
const {loadGame}=require('./mock-jogo.cjs');let passed=0;const rows=[];
function check(name,fn){fn();passed++;rows.push({name,passed:true});console.log('ok',name);}
(async()=>{
 const a=await loadGame({enemyWeapon:'fists'}),{game,get,key,tick,win}=a;
 check('inicia pronto, com as duas barras e o rival parado',()=>{
  assert.strictEqual(game.combat.phase,'ready');assert.strictEqual(get('hero-health-value').textContent,'100 / 100');
  assert.strictEqual(get('enemy-health-value').textContent,'80 / 80');assert.strictEqual(get('btn-training').textContent,'Começar treino');
  const p={...game.enemy.pos};tick(120);assert.strictEqual(game.enemy.pos.x,p.x);assert.strictEqual(game.combat.hero.hp,100);
 });
 check('Enter inicia e o rival se aproxima',()=>{
  const before=Math.hypot(game.hero.pos.x-game.enemy.pos.x,game.hero.pos.y-game.enemy.pos.y);
  key('Enter');tick();key('Enter',false);tick(60);assert.strictEqual(game.combat.phase,'active');
  assert(Math.hypot(game.hero.pos.x-game.enemy.pos.x,game.hero.pos.y-game.enemy.pos.y)<before-50);
  assert.strictEqual(get('btn-training').textContent,'Reiniciar treino');
 });
 check('perder foco pausa o combate e o botão retoma',()=>{
  win.dispatch('blur');assert(game.combat.paused);const hp=game.combat.hero.hp,t=game.combat.time;
  tick(120);assert.strictEqual(game.combat.time,t);assert.strictEqual(game.combat.hero.hp,hp);
  assert.strictEqual(get('btn-training').textContent,'Retomar treino');get('btn-training').dispatch('click');tick();assert(!game.combat.paused);
 });
 check('a ajuda pausa e Entendi devolve o treino',()=>{
  key('KeyH');tick();key('KeyH',false);assert(game.combat.paused);assert(!get('help').hidden);
  get('help-close').dispatch('click');tick();assert(!game.combat.paused);assert(get('help').hidden);
 });
 check('R reinicia a rodada com vida cheia e novos personagens',()=>{
  key('KeyH');tick();key('KeyH',false);assert(game.combat.paused);
  const old=game.hero;key('KeyR');tick();key('KeyR',false);assert.notStrictEqual(game.hero,old);assert(get('help').hidden);assert(!game.combat.paused);
  assert.strictEqual(game.combat.hero.hp,100);assert.strictEqual(game.combat.enemy.hp,80);assert.strictEqual(game.combat.phase,'active');
 });
 check('clique no corpo do rival aponta para o rival',()=>{
  const enemy=game.enemy,cam=game.cam;
  const skeleton=a.ctx.PD.rig.buildRig(enemy.pose()),q=cam.toScreen(skeleton.chest.o);
  a.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,clientX:q.x,clientY:q.y});tick();
  assert(game.hero.attack);const target=Math.atan2(enemy.pos.y-game.hero.pos.y,enemy.pos.x-game.hero.pos.x);
  assert(Math.abs(a.ctx.PD.math.angleDiff(game.hero.attack.dir,target))<.02);
 });
 check('a IA reduz a vida exibida no HUD',()=>{
  tick(240);assert(game.combat.hero.hp<100);assert.strictEqual(get('hero-health-value').textContent,`${game.combat.hero.hp} / 100`);
  assert.strictEqual(get('hero-health').attrs['aria-valuenow'],String(game.combat.hero.hp));
 });
 const b=await loadGame({enemyWeapon:'fists'});
 check('botão de toque inicia, joystick move e Q de toque esquiva',()=>{
  b.get('btn-training').dispatch('click');b.tick();assert.strictEqual(b.game.combat.phase,'active');
  b.canvas.dispatch('pointerdown',{pointerType:'touch',pointerId:1,clientX:100,clientY:500});
  b.canvas.dispatch('pointermove',{pointerType:'touch',pointerId:1,clientX:145,clientY:500});b.tick(8);
  b.get('t-dodge').dispatch('pointerdown');b.tick();assert(b.game.hero.dodge);assert(b.game.hero.dodge.direction.x>0);
  b.canvas.dispatch('pointerup',{pointerId:1});
 });
 check('soco de toque usa a mesma entrada do combate',()=>{
  b.tick(45);b.get('t-attack').dispatch('pointerdown');b.tick();assert(b.game.hero.attack);
 });
 const c=await loadGame({enemyWeapon:'fists'});c.get('btn-training').dispatch('click');c.tick(60*19);
 check('vida zero termina em morte e libera tentar de novo',()=>{
  assert.strictEqual(c.game.combat.phase,'lost');assert.strictEqual(c.game.hero.label,'Morto');assert.strictEqual(c.get('hero-health-value').textContent,'0 / 100');
  assert.strictEqual(c.get('btn-training').textContent,'Tentar de novo');assert(!c.get('btn-training').disabled);
  c.get('btn-training').dispatch('click');c.tick();assert.strictEqual(c.game.combat.phase,'active');assert.strictEqual(c.game.combat.hero.hp,100);
 });
 const d=await loadGame({enemyWeapon:'fists'});d.get('btn-training').dispatch('click');let dyingWasBlocked=false;
 for(let k=0;k<60*10;k++){
  if(k%33===0&&d.game.combat.phase==='active'){
   const r=d.ctx.PD.rig.buildRig(d.game.enemy.pose()),p=d.game.cam.toScreen(r.chest.o);
   d.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});
  }
  d.tick();
  if(d.game.combat.phase==='won'&&d.game.enemy.label!=='Morto'){
   assert(d.get('btn-training').disabled);const enemy=d.game.enemy;d.get('btn-training').dispatch('click');assert.strictEqual(d.game.enemy,enemy);dyingWasBlocked=true;
  }
 }
 check('vitória pelo mouse termina a queda e permite repetir',()=>{
  assert.strictEqual(d.game.combat.phase,'won');assert.strictEqual(d.game.combat.enemy.hp,0);
  assert(dyingWasBlocked);
  assert.strictEqual(d.get('combat-status').textContent,'Você venceu!');assert.strictEqual(d.get('btn-training').textContent,'Treinar de novo');
  assert(!d.get('btn-training').disabled);d.get('btn-training').dispatch('click');d.tick();
  assert.strictEqual(d.game.combat.enemy.hp,80);assert.strictEqual(d.game.combat.hero.hp,100);
 });
 const e=await loadGame({enemyWeapon:'fists'});e.get('btn-training').dispatch('click');
 e.canvas.dispatch('pointerdown',{pointerType:'touch',pointerId:2,clientX:100,clientY:500});
 e.canvas.dispatch('pointermove',{pointerType:'touch',pointerId:2,clientX:150,clientY:500});e.tick(65);e.canvas.dispatch('pointerup',{pointerId:2});
 for(let k=0;k<60*8;k++){if(k%33===0&&e.game.combat.phase==='active')e.get('t-attack').dispatch('pointerdown');e.tick();}
 check('joystick e soco de toque também vencem uma rodada',()=>{
  assert.strictEqual(e.game.combat.phase,'won');assert.strictEqual(e.game.combat.enemy.hp,0);assert.strictEqual(e.get('enemy-health-value').textContent,'0 / 80');
 });
 console.log(`${passed} integrações passaram; 0 falhas.`);
 if(process.env.PD_COMBAT_UI_OUTPUT)fs.writeFileSync(process.env.PD_COMBAT_UI_OUTPUT,JSON.stringify({scenarios:passed,failures:0,rows},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

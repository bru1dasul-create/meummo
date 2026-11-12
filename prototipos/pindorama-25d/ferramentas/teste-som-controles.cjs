// Áudio usa um AudioContext simulado: verifica gesto inicial, envelopes e limpeza, sem alegar audição real.
const assert=require('assert'),{loadGame}=require('./mock-jogo.cjs');
const {AudioContextMock}=require('./mock-som.cjs');
const rows=[];
async function check(name,fn){try{await fn();rows.push({name,passed:true});console.log('ok '+name);}catch(e){rows.push({name,passed:false,error:e.message});console.error('FALHA '+name+': '+e.stack);}}
function advance(a,count=1){for(let k=0;k<count;k++){for(const c of AudioContextMock.instances)c.advance(1/60);a.tick();}}
(async()=>{
 await check('áudio inicia no gesto e acompanha carga, soltura e impacto',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock}),c=a.game.combat;c.options.enemyAI=false;
  assert.strictEqual(AudioContextMock.instances.length,0,'contexto abriu sem gesto');a.key('Digit2');advance(a);assert.strictEqual(AudioContextMock.instances.length,1);
  const audio=AudioContextMock.instances[0];a.key('Digit2',false);a.key('KeyJ');advance(a,72);assert(a.game.hero.attack.power>.99);
  const held=[...audio.active].filter(n=>n.type==='triangle'&&n.stopAt==null);assert.strictEqual(held.length,1);assert(held[0].frequency.value>=350);
  a.key('KeyJ',false);advance(a,60);assert.strictEqual(c.stats.shots,1);assert.strictEqual(c.enemy.hp,40);assert.strictEqual(audio.active.size,0,'vozes ficaram tocando depois do disparo');
 });
 await check('silenciar durante carga encerra o som e permite religar',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock});a.game.combat.options.enemyAI=false;a.key('Digit2');advance(a);a.key('KeyJ');advance(a,40);const audio=AudioContextMock.instances[0];
  assert(audio.active.size);a.get('btn-sound').dispatch('click');advance(a,12);assert.strictEqual(audio.active.size,0);assert.strictEqual(a.get('btn-sound').attrs['aria-pressed'],'false');
  a.get('btn-sound').dispatch('click');advance(a,10);assert(audio.active.size);assert.strictEqual(a.get('btn-sound').attrs['aria-pressed'],'true');a.key('KeyJ',false);advance(a,90);assert.strictEqual(audio.active.size,0);
 });
 await check('perder foco cancela carga e não deixa voz contínua ao retomar',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock});a.game.combat.options.enemyAI=false;a.key('Digit2');advance(a);a.key('KeyJ');advance(a,25);const audio=AudioContextMock.instances[0];
  a.win.dispatch('blur');advance(a,15);assert.strictEqual(audio.active.size,0);assert(a.game.combat.paused);a.key('KeyJ',false);a.get('btn-training').dispatch('click');advance(a,60);assert.strictEqual(a.game.combat.stats.shots,0);assert.strictEqual(audio.active.size,0);
 });
 await check('reiniciar repetidamente não acumula osciladores nem contextos',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock});for(let i=0;i<6;i++){
   a.game.combat.options.enemyAI=false;a.key('Digit2');advance(a);a.key('KeyJ');advance(a,20);a.key('KeyR');advance(a);a.key('KeyR',false);a.key('KeyJ',false);advance(a,10);
  }
  assert.strictEqual(AudioContextMock.instances.length,1);assert.strictEqual(AudioContextMock.instances[0].active.size,0);
 });
 await check('sem Web Audio o jogo mantém disparo e controles',async()=>{
  const a=await loadGame();a.game.combat.options.enemyAI=false;assert(a.get('btn-sound').disabled);a.key('Digit2');a.tick();a.key('KeyJ');a.tick(30);a.key('KeyJ',false);a.tick(50);assert.strictEqual(a.game.combat.stats.shots,1);
 });
 await check('vitória durante a carga mantém soltura, caminhada e feedback',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock}),c=a.game.combat;c.options.enemyAI=false;
  a.key('Digit2');advance(a);a.key('KeyJ');advance(a,40);const attack=a.game.hero.attack;c.damage(c.hero,c.enemy,80);assert.strictEqual(a.game.hero.attack,attack,'vitória descartou o disparo do vencedor');
  a.key('KeyJ',false);let impact=false;for(let k=0;k<100;k++){advance(a);impact ||= c.effects.some(e=>e.kind==='stoneImpact');}
  assert.strictEqual(c.stats.shots,1);assert(impact);a.key('KeyA');a.key('ShiftLeft');const start={...a.game.hero.pos};advance(a,90);assert(Math.hypot(a.game.hero.pos.x-start.x,a.game.hero.pos.y-start.y)>350);assert(a.get('combat-hint').textContent.includes('andando'));
  a.win.dispatch('blur');advance(a,10);assert(c.paused);assert.strictEqual(AudioContextMock.instances[0].active.size,0);a.get('btn-training').dispatch('click');advance(a);assert(!c.paused);assert.strictEqual(a.game.combat,c,'retomar vitória reiniciou o jogo');
 });
 await check('mira por mouse no corpo caído continua produzindo impacto',async()=>{
  const a=await loadGame(),c=a.game.combat;c.options.enemyAI=false;a.key('Digit2');a.tick();c.start();c.damage(c.hero,c.enemy,80);a.tick(120);
  const r=a.ctx.PD.rig.buildRig(a.game.enemy.pose()),b=a.game.cam.p(r.chest.o),x=b.x-a.game.cam.viewX,y=b.y-a.game.cam.viewY;
  a.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,pointerId:17,clientX:x,clientY:y});a.tick(45);assert.strictEqual(a.game.hero.attack.targetLock,'enemy');
  a.win.dispatch('pointerup',{pointerType:'mouse',button:0,pointerId:17,clientX:x,clientY:y});let impact=false;
  for(let k=0;k<70;k++){a.tick();impact ||= c.effects.some(e=>e.kind==='stoneImpact'&&e.material==='body');}
  assert.strictEqual(c.stats.shots,1);assert(impact,'tiro no corpo caiu sem feedback');assert.strictEqual(c.enemy.hp,0);
 });
 await check('morte e esquiva encerram o som da carga',async()=>{
  for(const action of ['death','dodge']){
   AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock});a.game.combat.options.enemyAI=false;a.key('Digit2');advance(a);a.key('KeyJ');advance(a,35);
   a.key(action==='death'?'KeyK':'KeyQ');advance(a);a.key('KeyJ',false);advance(a,150);assert.strictEqual(AudioContextMock.instances[0].active.size,0);assert.strictEqual(a.game.combat.stats.shots,0);
  }
 });
 await check('rival abandona a carga e o som quando o jogador morre',async()=>{
  AudioContextMock.instances=[];const a=await loadGame({AudioContext:AudioContextMock});a.key('Enter');advance(a);a.key('Enter',false);
  for(let k=0;k<120&&!a.game.enemy.attack;k++)advance(a);assert.strictEqual(a.game.enemy.attack?.stage,'charging');
  a.key('KeyK');advance(a);assert(!a.game.enemy.attack,'rival continua puxando depois de encerrar a rodada');advance(a,160);assert.strictEqual(AudioContextMock.instances[0].active.size,0);
 });
 const result={browser:false,audibleVerification:false,scenarios:rows.length,failures:rows.filter(r=>!r.passed).length,rows};
 console.log(JSON.stringify({scenarios:result.scenarios,failures:result.failures}));if(process.env.PD_AUDIO_OUTPUT)require('fs').writeFileSync(process.env.PD_AUDIO_OUTPUT,JSON.stringify(result,null,2));process.exitCode=result.failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

const assert=require('assert'),{loadGame}=require('./mock-jogo.cjs');
(async()=>{
 const a=await loadGame(),{game,key,tick,get}=a;game.combat.options.enemyAI=false;
 key('Digit2');tick();key('Digit2',false);assert.strictEqual(game.combat.weapon,'slingshot');assert.strictEqual(get('weapon-slingshot').attrs['aria-pressed'],'true');assert.strictEqual(get('t-attack-label').textContent,'Pedra');
 for(let i=0;i<4;i++){key('KeyJ');tick();key('KeyJ',false);tick(100);}
 assert.strictEqual(game.combat.phase,'won');assert.strictEqual(game.combat.stats.shots,4);assert.strictEqual(game.combat.enemy.hp,0);
 tick(120);key('KeyR');tick();key('KeyR',false);game.combat.options.enemyAI=false;assert.strictEqual(game.combat.weapon,'slingshot');assert.strictEqual(game.combat.projectiles.length,0);
 get('weapon-fists').dispatch('click');tick();assert.strictEqual(game.combat.weapon,'fists');assert.strictEqual(get('t-attack-label').textContent,'Soco');
 get('weapon-slingshot').dispatch('click');tick();get('t-attack').dispatch('pointerdown');tick();assert.strictEqual(game.hero.attack.kind,'slingshot');get('t-attack').dispatch('pointerup');tick(90);assert.strictEqual(game.combat.enemy.hp,60);
 tick(30);const r=a.ctx.PD.rig.buildRig(game.enemy.pose()),p=game.cam.toScreen(r.chest.o);a.canvas.dispatch('pointerdown',{pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});a.win.dispatch('pointerup',{pointerType:'mouse',button:0});tick(90);assert.strictEqual(game.combat.enemy.hp,40);
 console.log('6 integrações passaram: tecla 2/J, HUD, vitória, reinício, seletor/toque e mira por mouse.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

// Integração de teclado, toque, botões de demonstração e reinício, sem navegador.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');let now=0,passed=0;
class Element {
 constructor(tagName='DIV'){this.tagName=tagName;this.events={};this.style={};this.dataset={};this.hidden=false;this.disabled=false;this.attrs={};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
 dispatch(name,values={}){const e={target:this,preventDefault(){},stopPropagation(){},...values};for(const fn of this.events[name]||[])fn(e);}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelector(){return null;}
 getContext(){return {setTransform(){},fillRect(){}};}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element(id==='game'?'CANVAS':'BUTTON'));return elements.get(id);};
get('btn-restart').hidden=true;
const queue=[],win=new Element('WINDOW'),ctx={console,Math,JSON,Map,Set,TextEncoder,Uint8Array,Uint32Array,setTimeout,clearTimeout,
 performance:{now:()=>now},location:{search:''},navigator:{},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>queue.push(fn),
 localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:get,body:new Element('BODY'),documentElement:new Element('HTML')}};
ctx.window=ctx;ctx.innerWidth=1280;ctx.innerHeight=720;ctx.devicePixelRatio=1;ctx.addEventListener=win.addEventListener.bind(win);vm.createContext(ctx);
for(const file of ['core/math','core/iso','core/shapes','character/body','character/rig','character/animator','character/renderer','character/equipment','character/classes','combat','input','ui'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file});
ctx.PD.MAP={spawn:{x:200,y:200}};
ctx.PD.World=class{constructor(){this.shake=0;}heightAt(){return 14;}collide(x,y){return {x,y};}invalidate(){}update(_dt,hero){hero.events.length=0;}draw(){}};
vm.runInContext(fs.readFileSync(path.join(root,'js/game.js'),'utf8'),ctx,{filename:'game'});
function check(name,fn){try{fn();passed++;console.log('ok',name);}catch(e){e.message=name+': '+e.message;throw e;}}
function tick(count=1){for(let i=0;i<count;i++){now+=1000/60;const next=queue.shift();assert(next);next(now);}}
function key(code,down=true,repeat=false){win.dispatch(down?'keydown':'keyup',{code,repeat});}
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));assert(ctx.__pdReady);tick(2);
 check('E inicia a reação ao impacto',()=>{key('KeyE');tick();assert(ctx.__pd.hero.hurt);assert(get('btn-hit').disabled);key('KeyE',false);});
 check('reação termina e libera os controles',()=>{tick(42);assert(!ctx.__pd.hero.hurt);assert(!get('btn-hit').disabled);assert(!get('t-dodge').disabled);});
 check('botão de impacto funciona com toque/clique',()=>{get('btn-hit').dispatch('click');tick();assert(ctx.__pd.hero.hurt);tick(42);assert(!ctx.__pd.hero.hurt);});
 check('Q começa a esquiva para a frente',()=>{key('KeyQ');tick();assert(ctx.__pd.hero.dodge);assert(ctx.__pd.hero.dodge.direction.x>0);});
 check('segurar Q não reinicia a esquiva',()=>{const a=ctx.__pd.hero.dodge;key('KeyQ',true,true);tick(5);assert.strictEqual(ctx.__pd.hero.dodge,a);});
 key('KeyQ',false);tick(50);
 check('Q usa a direção das teclas de movimento',()=>{key('KeyD');key('KeyQ');tick();assert(ctx.__pd.hero.dodge.direction.x>.5);assert(ctx.__pd.hero.dodge.direction.y<-.5);key('KeyD',false);key('KeyQ',false);});
 tick(50);
 check('botão de toque aciona a esquiva',()=>{get('t-dodge').dispatch('pointerdown');tick();assert(ctx.__pd.hero.dodge);});
 tick(50);
 check('direção e Shift mantidos emendam Q na corrida sem quadro parado',()=>{
  key('KeyD');key('ShiftLeft');tick(60);assert.strictEqual(ctx.__pd.hero.label,'Correndo');
  key('KeyQ');tick();key('KeyQ',false);assert(ctx.__pd.hero.dodge);let resumed=false;
  for(let k=0;k<36;k++){tick();if(!ctx.__pd.hero.dodge){resumed=true;assert.strictEqual(ctx.__pd.hero.label,'Correndo');assert(ctx.__pd.hero.speed>430);}}
  assert(resumed);
 });
 check('soltar direção e Shift durante Q permite terminar parado',()=>{
  tick(25);key('KeyQ');tick(3);key('KeyQ',false);key('KeyD',false);key('ShiftLeft',false);tick(45);
  assert.strictEqual(ctx.__pd.hero.label,'Parado');assert(ctx.__pd.hero.speed<.01);
 });
 check('K começa a morte e bloqueia o teste de impacto',()=>{key('KeyK');tick();assert(ctx.__pd.hero.death);assert(get('btn-death').disabled);assert(get('btn-hit').disabled);assert(!get('btn-restart').hidden);assert(get('btn-restart').disabled);key('KeyK',false);key('KeyE');tick();assert(!ctx.__pd.hero.hurt);key('KeyE',false);});
 check('morte bloqueia salto, ataque e esquiva',()=>{key('KeyQ');key('Space');key('KeyJ');tick(100);assert.strictEqual(ctx.__pd.hero.label,'Morto');assert(!ctx.__pd.hero.dodge);assert(!ctx.__pd.hero.attack);assert.strictEqual(ctx.__pd.hero.pos.z,0);assert(!get('btn-restart').disabled);key('KeyQ',false);key('Space',false);key('KeyJ',false);});
 check('R recomeça no início com controles habilitados',()=>{const old=ctx.__pd.hero;key('KeyR');tick();key('KeyR',false);assert.notStrictEqual(ctx.__pd.hero,old);assert(!ctx.__pd.hero.death);assert.strictEqual(ctx.__pd.hero.pos.x,200);assert.strictEqual(ctx.__pd.hero.groundZ,14);assert(get('btn-restart').hidden);assert(!get('t-dodge').disabled);});
 check('botões também permitem morrer e recomeçar',()=>{get('btn-death').dispatch('click');tick(100);assert.strictEqual(ctx.__pd.hero.label,'Morto');get('btn-restart').dispatch('click');tick();assert(!ctx.__pd.hero.death);});
 check('perder foco descarta comandos pendentes',()=>{key('KeyQ');win.dispatch('blur');tick();assert(!ctx.__pd.hero.dodge);});
 console.log(`${passed} verificações passaram; 0 falhas.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

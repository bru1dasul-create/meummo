// Ambiente de simulação para o jogo real. Não executa um navegador.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
async function loadGame(options={}) {
 const root=path.resolve(__dirname,'..'),width=options.width||1280,height=options.height||720;
 const C=options.render?require('@napi-rs/canvas'):null;
 let now=0,seed=12345,gameAudio;const queue=[],elements=new Map();
 const noop=()=>{};
 const emptyContext=new Proxy({setTransform:noop,fillRect:noop},{get:(o,k)=>o[k]||noop});
 class Element {
  constructor(tagName='DIV'){
   this.tagName=tagName;this.events={};this.style={};this.dataset={};this.hidden=false;this.disabled=false;this.attrs={};this.classes=new Set();
   this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};
  }
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  dispatch(name,values={}){
   if(this.disabled&&['click','pointerdown'].includes(name))return;
   const e={target:this,currentTarget:this,preventDefault(){},stopPropagation(){},...values};for(const fn of this.events[name]||[])fn(e);
  }
  setAttribute(k,v){this.attrs[k]=v;}
  querySelector(){return null;}
  getContext(){return emptyContext;}
 }
 function canvas(){
  if(!C)return new Element('CANVAS');
  const c=C.createCanvas(1,1);c.tagName='CANVAS';c.events={};c.style={};c.attrs={};
  for(const name of ['addEventListener','dispatch','setAttribute'])c[name]=Element.prototype[name];
  return c;
 }
 const get=id=>{if(!elements.has(id))elements.set(id,id==='game'?canvas():new Element('BUTTON'));return elements.get(id);};
 get('btn-restart').hidden=true;
 const win=new Element('WINDOW'),math=Object.create(Math);math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const ctx={console,Math:math,JSON,Map,Set,TextEncoder,Uint8Array,Uint32Array,setTimeout,clearTimeout,
  performance:{now:()=>now},location:{search:''},navigator:{},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>queue.push(fn),
  localStorage:{getItem:key=>key==='pindorama:ajuda'?(options.showHelp?null:'0'):key==='pindorama:som'&&options.muted?'0':null,setItem(){}},document:{getElementById:get,createElement:tag=>tag==='canvas'?canvas():new Element(tag.toUpperCase()),body:new Element('BODY'),documentElement:new Element('HTML')}};
 if(C){ctx.Path2D=C.Path2D;ctx.DOMMatrix=C.DOMMatrix;}
 if(options.AudioContext)ctx.AudioContext=options.AudioContext;
 ctx.window=ctx;ctx.innerWidth=width;ctx.innerHeight=height;ctx.devicePixelRatio=1;ctx.addEventListener=win.addEventListener.bind(win);vm.createContext(ctx);
 const scripts=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(js\/[^?\"]+)(?:\?[^\"]*)?"><\/script>/g)].map(m=>m[1]);
 for(const file of scripts){
  if(!options.realWorld&&file.startsWith('js/world/'))continue;
  if(file==='js/game.js'&&ctx.PD.GameAudio){
   const BaseAudio=ctx.PD.GameAudio;
   ctx.PD.GameAudio=class extends BaseAudio{constructor(){super();gameAudio=this;}};
  }
  if(file==='js/game.js'&&options.enemyWeapon){
   const BaseCombat=ctx.PD.TrainingCombat;
   ctx.PD.TrainingCombat=class extends BaseCombat{constructor(hero,world,settings){super(hero,world,{...settings,enemyWeapon:options.enemyWeapon});}};
  }
  if(file==='js/game.js'&&!options.realWorld){
   ctx.PD.MAP={spawn:{x:200,y:200}};
   ctx.PD.World=class{constructor(){this.shake=0;this.time=0;}heightAt(){return 14;}collide(x,y){return {x,y};}invalidate(){}update(dt,hero,others=[]){this.time+=dt;for(const c of [hero,...others])c.events.length=0;}draw(){}};
  }
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 }
 await new Promise(resolve=>setImmediate(resolve));assert(ctx.__pdReady,'O jogo não terminou de iniciar');
 function tick(count=1,hz=60){for(let i=0;i<count;i++){now+=1000/hz;const fn=queue.shift();assert(fn);fn(now);}}
 function key(code,down=true,extra={}){win.dispatch(down?'keydown':'keyup',{code,repeat:false,...extra});}
 tick(2);
 return {ctx,game:ctx.__pd,audio:gameAudio,canvas:get('game'),get,win,tick,key,queue};
}
module.exports={loadGame};

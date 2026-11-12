const fs=require('fs'),path=require('path'),vm=require('vm');
function load(root){
 const ctx={console,setTimeout,clearTimeout,TextEncoder,Uint8Array,Uint32Array,Map,Set,Math,JSON};ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['core/math','core/iso','core/shapes','character/body','character/rig','character/animator','character/renderer','character/equipment','character/classes','tools/export','tools/audit']) vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f});
 return ctx.PD;
}
function detail(PD,input,secs=3,hz=60){
 const ch=new PD.Character(0,0,0),dt=1/hz;const frames=[],max={};let prevState;
 for(let k=0;k<secs*hz;k++){
  const t=k*dt;ch.update(dt,input(t,k),null);const p=ch.pose(),r=PD.rig.buildRig(p);ch.secondary(r,dt);
  const points={head:r.head.o,pelvis:r.pelvis.o,knee0:r.knee[0],knee1:r.knee[1],ankle0:r.ankle[0],ankle1:r.ankle[1]};
  const f={t:+t.toFixed(5),state:ch.jump.state,phase:ch.phase,run:ch.runBlend,speed:ch.speed,z:ch.pos.z,crouch:ch.jump.crouch,hipDrop:ch.hipDrop,pitch:p.feet.map(x=>x.pitch*180/Math.PI),planted:ch.footLock.map(x=>x.planted),points};
  if(frames.length>=2){
   const a=frames.at(-2),b=frames.at(-1);
   for(const key of Object.keys(points)){
    const j=Math.hypot(...['x','y','z'].map(d=>f.points[key][d]-2*b.points[key][d]+a.points[key][d]));
    if(!max[key]||j>max[key].j)max[key]={j,t:f.t,states:[a.state,b.state,f.state],z:f.z,pitches:[a.pitch,b.pitch,f.pitch],hipDrops:[a.hipDrop,b.hipDrop,f.hipDrop]};
   }
  }
  frames.push(f);
 }
 return {max,frames};
}
if(require.main===module){
 const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),out=process.argv[3]||'medidas.json';
 const PD=load(root);const data={};
 for(const hz of [30,60,120]){
  for(const [name,input,secs] of [
   ['andar',()=>({move:{x:1,y:0}}),3],
   ['correr',()=>({move:{x:1,y:0},run:true}),3],
   ['pulo',(_t,k)=>({jump:k===hz}),3],
   ['pulo-andando',(_t,k)=>({move:{x:1,y:0},jump:k===hz}),3],
   ['pulo-correndo',(_t,k)=>({move:{x:1,y:0},run:true,jump:k===hz}),3],
   ['transicao',t=>({move:t<3?{x:1,y:0}:null,run:t>1&&t<2}),4],
  ]) data[name+'-'+hz]=detail(PD,input,secs,hz);
 }
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(data));
 for(const [k,v]of Object.entries(data))console.log(k,JSON.stringify(v.max));
}
module.exports={load,detail};

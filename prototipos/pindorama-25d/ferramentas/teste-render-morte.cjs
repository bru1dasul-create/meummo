// Cobertura da roupa na pose da imagem e fidelidade das outras ações.
// Requer @napi-rs/canvas; usa Canvas local, sem servidor ou navegador.
const fs=require('fs'),path=require('path'),vm=require('vm'),C=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),rows=[],failures=[];
function load(before=false){
 const ctx={console,Math,JSON,Map,Set,TextEncoder,Uint8Array,Uint32Array,Path2D:C.Path2D,DOMMatrix:C.DOMMatrix,devicePixelRatio:1};ctx.window=ctx;ctx.document={createElement:()=>C.createCanvas(1,1)};vm.createContext(ctx);
 for(const f of ['core/math','core/iso','core/shapes','character/body','character/rig','character/animator','character/renderer','character/equipment','character/classes']){
  const file=before&&f==='character/renderer'?path.join(root,'auditoria/renderer-r8-referencia.js'):path.join(root,'js',f+'.js');vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
 }
 return ctx.PD;
}
const after=load(),before=load(true);
function simulate(P,yaw,kind){
 const ch=new P.Character(0,0,yaw),move={x:Math.cos(yaw),y:Math.sin(yaw)};
 for(let k=0;k<240;k++){
  const act=k===180;
  ch.update(1/120,{move:['walk','run'].includes(kind)?move:null,run:kind==='run',crouchSet:kind==='crouch',jump:kind==='jump'&&act,attack:kind==='attack'&&act,dodge:kind==='dodge'&&k===216,hit:kind==='impact'&&k===228,die:kind==='death'&&k===0},null);
  const rig=P.rig.buildRig(ch.pose());ch.secondary(rig,1/120);
 }
 return {ch,rig:P.rig.buildRig(ch.pose())};
}
function draw(P,snap,zoom){
 const cam=new P.IsoCamera();cam.zoom=zoom;const renderer=new P.CharacterRenderer(cam),canvas=C.createCanvas(800,640),g=canvas.getContext('2d');g.translate(400,430);
 renderer.draw(g,snap.rig,snap.ch.look);return {canvas,cam,g,renderer,items:renderer.prepare(g,snap.rig,snap.ch.look)};
}
let changedFrames=0;
for(let d=0;d<8;d++)for(const kind of ['idle','walk','run','crouch','jump','attack','dodge','impact']){
 const yaw=d*Math.PI/4,A=draw(after,simulate(after,yaw,kind),1.25),B=draw(before,simulate(before,yaw,kind),1.25),a=A.g.getImageData(0,0,800,640).data,b=B.g.getImageData(0,0,800,640).data;
 const changed=a.some((v,i)=>v!==b[i]);if(changed){changedFrames++;failures.push({kind,direction:d*45,changed:true});}
}
function frontSurface(P,x,z){
 let y=-Infinity;
 for(const s of P.MODEL.PELVIS){const left=s.r*s.r-(x-s.p[0])**2-(z-s.p[2])**2;if(left>=0)y=Math.max(y,s.p[1]+Math.sqrt(left));}
 return y;
}
function garmentAt(P,snap,drawing,x,z){
 const p=P.math.at(snap.rig.pelvis,x,frontSurface(P,x,z),z),q=drawing.cam.p(p),data=drawing.g.getImageData(Math.round(q.x+400),Math.round(q.y+430),1,1).data;
 // A pele tem R >= 143; pano e seu contorno têm R abaixo de 125.
 // As amostras ficam no centro do volume, longe da silhueta transparente.
 const pelvis=drawing.items.find(it=>it.name==='pelve'),depth=drawing.renderer._surfaceDepth(pelvis,q);
 const contains=poly=>{
  let inside=false;
  for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){
   if((poly[i+1]>q.y)!==(poly[j+1]>q.y)&&q.x<(poly[j]-poly[i])*(q.y-poly[i+1])/(poly[j+1]-poly[i+1])+poly[i])inside=!inside;
  }
  return inside;
 };
 const covers=it=>it.segs.some(s=>!s.noDepth&&s.poly&&contains(s.poly));
 const covering=drawing.items.filter(it=>it.solid&&it!==pelvis&&covers(it)&&drawing.renderer._surfaceDepth(it,q)>depth+0.75).map(it=>it.name);
 // O quadril é arredondado: a câmera pode enxergar pele acima do cinto na
 // mesma projeção de um ponto de roupa escondido. Classifica a superfície
 // visível pela interseção do raio com as esferas, em vez desse ponto oculto.
 let surfaceZ=null,best=-Infinity;
 const u=snap.rig.pelvis.u,cam=drawing.cam,K=Math.SQRT1_2;
 for(let i=0;i<pelvis.segs[0].circles.length;i++){
  const c=pelvis.segs[0].circles[i],dx=(q.x-c.x)/cam.zoom,dy=(q.y-c.y)/cam.zoom,left=c.rc*c.rc-dx*dx-dy*dy;
  if(left<0)continue;
  const h=Math.sqrt(left),d=c.d+h;
  if(d>best){best=d;surfaceZ=P.MODEL.PELVIS[i].p[2]+(u.x-u.y)*K*dx+((u.x+u.y)*K*cam.sinP-u.z*cam.cosP)*dy+P.math.dot(u,cam.toCamera)*h;}
 }
 // Mantém margem de 1 cm para a borda do cinto e para a aproximação do
 // casco convexo entre esferas; ali a amostra pode ser pele ou contorno.
 return {rgba:[...data],occluded:covering.length>0||surfaceZ===null||surfaceZ>-1,surfaceZ,covering,covered:data[3]>245&&data[0]<125&&data[1]<90&&data[2]<85};
}
let beforeGaps=0;
for(let d=0;d<8;d++)for(const zoom of [1.25,2]){
 const yaw=d*Math.PI/4,snap=simulate(after,yaw,'death'),A=draw(after,snap,zoom),B=draw(before,snap,zoom);
 for(const x of [-7,7]){
  const a=garmentAt(after,snap,A,x,-6),b=garmentAt(before,snap,B,x,-6),row={direction:d*45,zoom,side:x,after:a,before:b};rows.push(row);
  if(!a.occluded&&!b.covered)beforeGaps++;
  if(!a.occluded&&!a.covered)failures.push(row);
 }
}
if(!beforeGaps)failures.push({reference:'O teste não reproduziu a falha da roupa na r8.'});
if(rows.filter(r=>r.direction===45&&!r.after.occluded).length!==4)failures.push({reference:'A vista frontal da imagem não foi verificada nas duas escalas.'});
const summary={unchangedActionFrames:64,changedActionFrames:changedFrames,garmentSamples:rows.length,visibleGarmentSamples:rows.filter(r=>!r.after.occluded).length,referenceUncoveredSamples:beforeGaps,failures:failures.length};
console.log(JSON.stringify(summary,null,2));for(const f of failures.slice(0,10))console.error('FALHA',JSON.stringify(f));
if(process.env.PD_RENDER_OUTPUT)fs.writeFileSync(process.env.PD_RENDER_OUTPUT,JSON.stringify({summary,rows,failures},null,2));
process.exitCode=failures.length?1:0;

const fs=require('fs'),path=require('path');
const {load}=require('./medir.cjs');
function measure(root,full=false){
 const P=load(root),rows=[];
 for(const hz of [60,120])for(const fromRun of [false,true])for(let offset=0;offset<8;offset++){
  const change=1+offset*.043,ch=new P.Character(0,0,0),frames=[];
  let premature=0,maxSnap=0,maxJerk=0,maxKnee=0,maxDrop=0;
  for(let k=0;k<hz*3;k++){
   const t=k/hz,run=t<change?fromRun:!fromRun;
   const prev=ch.footLock.map(s=>({planted:s.planted,z:s.lastDrawnRef?.z??6.5}));
   ch.update(1/hz,{move:{x:1,y:0},run},null);
   const r=P.rig.buildRig(ch.pose());ch.secondary(r,1/hz);
   const f={t,phase:ch.phase,run:ch.runBlend,p:r.ankle,knee:r.knee,z:ch.footLock.map(s=>s.lastDrawnRef?.z),planted:ch.footLock.map(s=>s.planted),drop:ch.hipDrop};
   if(t>=change&&t<change+.85){
    maxDrop=Math.max(maxDrop,ch.hipDrop);
    for(let i=0;i<2;i++)if(!prev[i].planted&&ch.footLock[i].planted&&!ch.footLock[i].step){
     maxSnap=Math.max(maxSnap,prev[i].z-P.BODY.ankleHeight);
     if(prev[i].z-P.BODY.ankleHeight>2)premature++;
    }
    if(frames.length>1){
     const a=frames.at(-2),b=frames.at(-1);
     for(let i=0;i<2;i++){
      const d=key=>Math.hypot(...['x','y','z'].map(v=>f[key][i][v]-2*b[key][i][v]+a[key][i][v]));
      maxJerk=Math.max(maxJerk,d('p'));maxKnee=Math.max(maxKnee,d('knee'));
     }
    }
   }
   frames.push(f);
  }
  rows.push({hz,fromRun,offset,change,premature,maxSnap,maxJerk,maxKnee,maxDrop,...(full?{frames}:{})});
 }
 return rows;
}
if(require.main===module){
 const rows=measure(path.resolve(process.argv[2]),process.argv.includes('--full'));
 if(process.argv[3]&&!process.argv[3].startsWith('--'))fs.writeFileSync(process.argv[3],JSON.stringify(rows));
 for(const hz of [60,120])for(const fromRun of [false,true]){
  const r=rows.filter(x=>x.hz===hz&&x.fromRun===fromRun);
  console.log(JSON.stringify({hz,fromRun,premature:r.reduce((a,x)=>a+x.premature,0),snapMax:Math.max(...r.map(x=>x.maxSnap)),jerkMax:Math.max(...r.map(x=>x.maxJerk)),jerkMean:r.reduce((a,x)=>a+x.maxJerk,0)/r.length,kneeMax:Math.max(...r.map(x=>x.maxKnee)),dropMax:Math.max(...r.map(x=>x.maxDrop))}));
 }
}
module.exports={measure};

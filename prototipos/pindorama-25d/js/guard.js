// Guarda frontal, energia e pose dos braços. Não altera o comportamento do alvo de treino.
(function (PD) {
  'use strict';
  const M = PD.math;
  const RULES = Object.freeze({ maxEnergy: 100, drain: 6, regeneration: 22, regenerationDelay: 0.7,
    raise: 0.13, lower: 0.14, ready: 0.11, halfArc: 70 * M.DEG, damageFactor: 0.25,
    hitBaseCost: 10, hitDamageCost: 0.75, breakRecovery: 0.85, rearmEnergy: 20, walkFactor: 0.7 });
  const smooth = x => { x = M.clamp01(x); return x*x*x*(x*(x*6-15)+10); };
  function ensure(c) {
    return c.guard || (c.guard = { energy: RULES.maxEnergy, active: false, requested: false, blend: 0, age: 0,
      aimYaw: c.yaw, poseAim: 0, regenWait: 0, broken: 0, exhausted: false, recoil: 0, from: null });
  }
  function release(c, immediate = false) {
    if (!c.guard) return;
    c.guard.active = false; c.guard.requested = false; c.guard.age = 0;
    if (immediate) { c.guard.blend = 0; c.guard.from = null; }
    c._pose = null;
  }
  function breakGuard(c) {
    const g = ensure(c);
    g.active = false; g.exhausted = true; g.broken = RULES.breakRecovery; g.regenWait = RULES.regenerationDelay;
    c.events.push({ type: 'guardaQuebrou' });
  }
  function update(c, dt, input) {
    const g = ensure(c), wanted = !!input.guardHeld;
    g.requested = wanted; g.broken = Math.max(0, g.broken-dt); g.regenWait = Math.max(0, g.regenWait-dt); g.recoil = Math.max(0, g.recoil-dt);
    if (!wanted && g.energy >= RULES.rearmEnergy && !g.broken) g.exhausted = false;
    const blocked = c.death || c.dodge || c.hurt || c.jump.state !== 'chao' || input.jump || input.dodge;
    const punchBusy = c.attack && c.attack.kind !== 'slingshot';
    const active = wanted && !blocked && !punchBusy && !g.exhausted && g.energy > 0;
    if (active && !g.active) {
      g.from = JSON.parse(JSON.stringify(c._recoverPose?.from || c._pose || null));
      if (c.attack?.kind === 'slingshot') PD.slingshot?.cancel(c);
      c._recoverPose = null; g.age = 0; g.blend = 0; c._pose = null;
    }
    g.active = !!active;
    if (active) {
      g.age += dt; g.energy = Math.max(0, g.energy-RULES.drain*dt); g.regenWait = RULES.regenerationDelay;
      if (g.energy <= 1e-8) { g.energy = 0; breakGuard(c); }
    } else {
      g.age = 0;
      if (!c.death && g.regenWait === 0) g.energy = Math.min(RULES.maxEnergy, g.energy+RULES.regeneration*dt);
    }
    g.blend = M.clamp01(g.blend + (g.active ? dt/RULES.raise : -dt/RULES.lower));
    if (!g.blend) g.from = null;
    if (Number.isFinite(input.guardDir) && wanted) g.aimYaw = M.dampAngle(g.aimYaw,input.guardDir,18,dt);
    else if (wanted || !g.blend) g.aimYaw = c.yaw;
    g.poseAim = M.clamp(M.angleDiff(c.yaw,g.aimYaw),-55*M.DEG,55*M.DEG);
    if (g.active && Number.isFinite(input.guardDir) && Math.hypot(input.move?.x||0,input.move?.y||0)<0.02) c.faceYaw = input.guardDir;
    if (wanted || g.active) input = { ...input, attack:false, attackReleased:false, run:g.blend > 0 ? false : input.run };
    return input;
  }
  function direction(c) { const g=ensure(c); return c.yaw+g.poseAim*smooth(g.blend); }
  function ready(c) {
    const g=ensure(c);return g.active && g.age>=RULES.ready-1e-8 && g.blend>=0.8 && g.energy>0 && !c.death && !c.hurt && !c.dodge;
  }
  function tryBlock(c, damage, travelDirection) {
    const g=ensure(c);
    if (!ready(c) || Math.abs(M.angleDiff(direction(c),travelDirection+Math.PI))>RULES.halfArc+1e-8) return null;
    const cost=RULES.hitBaseCost+damage*RULES.hitDamageCost, spent=Math.min(g.energy,cost), fraction=spent/cost;
    g.energy=Math.max(0,g.energy-spent);g.regenWait=RULES.regenerationDelay;g.recoil=0.2;
    const broke=fraction<1-1e-8 || g.energy<=1e-8;
    if (broke) { g.energy=0;breakGuard(c); }
    return { damage:Math.max(1,Math.ceil(damage*(1-(1-RULES.damageFactor)*fraction))),cost,spent,broke,reduced:damage*(1-RULES.damageFactor)*fraction };
  }
  function applyPose(c, parts) {
    const g=c.guard;
    if (!g || g.blend<=0 || c.death || c.dodge || c.hurt || c.attack) return 0;
    const k=smooth(g.blend), kick=Math.sin(Math.PI*M.clamp01(g.recoil/0.2));
    const from=g.active && g.from ? g.from : parts;
    parts.spine.yaw=M.lerp(from.spine.yaw,g.poseAim,k);
    parts.spine.pitch=M.lerp(from.spine.pitch,(3-4*kick)*M.DEG,k);
    for(let i=0;i<2;i++) {
      const target={x:i?-9:-11,y:(i?24:27)-3*kick,z:(i?10:6)+kick};
      const h=parts.hands[i],old=from.hands[i];
      h.local=M.lerp3(old.local,target,k);h.poleLocal=old.poleLocal.map((v,j)=>M.lerp(v,[-0.5,0.65,-0.85][j],k));
      h.fist=M.lerp(old.fist||0,0.97,k);h.flex=M.lerp(old.flex||0,0.04,k);h.twist=M.lerp(old.twist||0,i?-0.35:0.15,k);
      parts.shoulderFwd[i]+=2*k;
    }
    return k;
  }
  function drawImpact(ctx,e,cam,reducedMotion) {
    const u=M.clamp01(e.t/e.life),q=cam.p(e),radius=(8+(reducedMotion?0:u*16))*cam.zoom;
    ctx.save();ctx.globalAlpha=1-u;ctx.strokeStyle=e.kind==='guardBreak'?'#f3a25b':'#b8ebf0';ctx.lineWidth=(2.6-u)*cam.zoom;
    ctx.beginPath();ctx.arc(q.x,q.y,radius,-Math.PI*.8,Math.PI*.55);ctx.stroke();
    for(let i=0;i<5;i++){const a=i*2.399,r=radius*(0.7+i*.12);ctx.beginPath();ctx.moveTo(q.x+Math.cos(a)*r,q.y+Math.sin(a)*r*.7);ctx.lineTo(q.x+Math.cos(a)*(r+4*cam.zoom),q.y+Math.sin(a)*(r+4*cam.zoom)*.7);ctx.stroke();}
    ctx.restore();
  }
  PD.guard={RULES,ensure,release,breakGuard,update,direction,ready,tryBlock,applyPose,drawImpact};
})(window.PD=window.PD||{});

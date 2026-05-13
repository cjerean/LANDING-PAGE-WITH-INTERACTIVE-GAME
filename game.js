// Deep Dive Frenzy – Feeding Frenzy style game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 900, H = 550;
canvas.width = W; canvas.height = H;

// State
let score=0, lives=3, level=1, phase='start', eatCount=0;
let spawnTimer=0, spawnInterval=120, bgOffset=0;
let flashTimer=0, scorePopups=[];
let player, entities=[], bubbles=[], seaweed=[];
const keys={};

// Player
function initPlayer(){
  player={ x:W/2, y:H/2, w:70, h:32, vx:0, vy:0, facing:1, invTimer:0, eatAnim:0 };
}

// Seaweed
function initSeaweed(){
  seaweed=[];
  for(let i=0;i<12;i++) seaweed.push({ x:i*(W/11)+20, h:40+Math.random()*60, phase:Math.random()*Math.PI*2, col:i%2===0?'#0D3A36':'#14524B' });
}

// Bubbles
function initBubbles(){
  bubbles=[];
  for(let i=0;i<40;i++) bubbles.push(mkBubble(true));
}
function mkBubble(rand){ return { x:Math.random()*W, y:rand?Math.random()*H:H+10, r:Math.random()*3+1, sp:Math.random()*0.6+0.2, op:Math.random()*0.3+0.05 }; }

// Entities: food=small fish, danger=big fish/jellyfish
const FOOD_TYPES=[
  {emoji:'🐟',col:'#00D0E6',w:28,h:14,pts:10,cat:'food'},
  {emoji:'🦐',col:'#1FE6FF',w:20,h:12,pts:15,cat:'food'},
  {emoji:'🦀',col:'#ff6b35',w:24,h:16,pts:20,cat:'food'},
  {emoji:'🐠',col:'#ffb347',w:26,h:14,pts:12,cat:'food'},
];
const DANGER_TYPES=[
  {emoji:'🪼',col:'#cc44ff',w:38,h:42,pts:-1,cat:'jellyfish'},
  {emoji:'🦈',col:'#607080',w:80,h:38,pts:-1,cat:'danger'},
  {emoji:'🐡',col:'#e06030',w:50,h:44,pts:-1,cat:'danger'},
];

function spawnEntity(){
  const isFood = Math.random()<0.72;
  const pool = isFood ? FOOD_TYPES : DANGER_TYPES;
  const t = pool[Math.floor(Math.random()*pool.length)];
  const fromLeft = Math.random()<0.5;
  const spd = (0.8 + Math.random()*1.4 + level*0.18) * (fromLeft?1:-1);
  entities.push({
    x: fromLeft ? -60 : W+60,
    y: 60 + Math.random()*(H-150),
    vx: spd, vy: (Math.random()-0.5)*0.6,
    w: t.w, h: t.h, col: t.col, cat: t.cat,
    emoji: t.emoji, pts: t.pts, alive: true,
    wobble: Math.random()*Math.PI*2
  });
  // Jellyfish spawns from bottom
  if(!isFood && Math.random()<0.25){
    const jt = DANGER_TYPES[0];
    entities.push({ x:Math.random()*(W-60)+30, y:H+40, vx:(Math.random()-0.5)*0.4, vy:-(0.6+Math.random()*0.8), w:jt.w, h:jt.h, col:jt.col, cat:'jellyfish', emoji:jt.emoji, pts:-1, alive:true, wobble:Math.random()*Math.PI*2 });
  }
}

// Input
document.addEventListener('keydown', e=>{ keys[e.key]=true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); if(e.key===' ') handleSpace(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&phase==='playing') togglePause(); });
document.addEventListener('keyup', e=>{ keys[e.key]=false; });

function handleSpace(){
  if(phase==='start') startGame();
  else if(phase==='gameover') resetGame();
  else if(phase==='playing'||phase==='paused') togglePause();
}
function togglePause(){ phase = phase==='paused'?'playing':'paused'; }

// Buttons (on-screen)
window.startGame = function(){
  phase='playing'; score=0; lives=3; level=1; eatCount=0;
  spawnInterval=120; entities=[]; scorePopups=[];
  initPlayer(); initBubbles(); initSeaweed();
};
window.resetGame = function(){ phase='start'; };
window.pauseGame = function(){ if(phase==='playing'||phase==='paused') togglePause(); };

// Update
function update(){
  if(phase!=='playing') return;
  bgOffset=(bgOffset+0.3)%W;
  // Bubbles
  bubbles.forEach((b,i)=>{ b.y-=b.sp; if(b.y<-5) bubbles[i]=mkBubble(false); });
  // Seaweed
  seaweed.forEach(s=>{ s.phase+=0.02; });
  // Player movement
  const accel=0.55, drag=0.88, maxSpd=5+level*0.3;
  if(keys['ArrowLeft']||keys['a']||keys['A']){ player.vx-=accel; player.facing=-1; }
  if(keys['ArrowRight']||keys['d']||keys['D']){ player.vx+=accel; player.facing=1; }
  if(keys['ArrowUp']||keys['w']||keys['W']) player.vy-=accel;
  if(keys['ArrowDown']||keys['s']||keys['S']) player.vy+=accel;
  player.vx*=drag; player.vy*=drag;
  player.vx=Math.max(-maxSpd,Math.min(maxSpd,player.vx));
  player.vy=Math.max(-maxSpd,Math.min(maxSpd,player.vy));
  player.x+=player.vx; player.y+=player.vy;
  player.x=Math.max(player.w/2,Math.min(W-player.w/2,player.x));
  player.y=Math.max(player.h/2,Math.min(H-player.h/2-20,player.y));
  if(player.invTimer>0) player.invTimer--;
  if(player.eatAnim>0) player.eatAnim--;

  // Spawn
  spawnTimer++;
  if(spawnTimer>=spawnInterval){ spawnTimer=0; spawnEntity(); }

  // Entities
  entities.forEach(e=>{ e.x+=e.vx; e.y+=e.vy; e.wobble+=0.06; if(e.cat==='jellyfish') e.vx+=Math.sin(e.wobble)*0.03; });
  entities = entities.filter(e=> e.alive && e.x>-120 && e.x<W+120 && e.y>-120 && e.y<H+120);

  // Collision
  if(player.invTimer===0){
    entities.forEach(e=>{
      if(!e.alive) return;
      const dx=Math.abs(player.x-e.x), dy=Math.abs(player.y-e.y);
      if(dx<(player.w/2+e.w/2)*0.72 && dy<(player.h/2+e.h/2)*0.72){
        if(e.cat==='food'){
          e.alive=false;
          score+=e.pts;
          eatCount++;
          player.eatAnim=12;
          scorePopups.push({x:e.x,y:e.y,txt:'+'+e.pts,life:60,vy:-1.2});
          if(eatCount%8===0){ level++; spawnInterval=Math.max(40,spawnInterval-10); scorePopups.push({x:W/2,y:H/2,txt:'LEVEL '+level+'!',life:90,vy:-0.5,big:true}); }
        } else {
          e.alive=false;
          lives--;
          flashTimer=30;
          player.invTimer=80;
          if(lives<=0){ phase='gameover'; }
        }
      }
    });
  }
  // Score popups
  scorePopups.forEach(p=>{ p.y+=p.vy; p.life--; });
  scorePopups=scorePopups.filter(p=>p.life>0);
}

// Draw
function drawBg(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050e0e'); g.addColorStop(0.6,'#071a19'); g.addColorStop(1,'#0D3A36');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // rays
  ctx.save();
  for(let i=0;i<5;i++){
    const rx=(bgOffset+i*200)%W;
    const rg=ctx.createRadialGradient(rx,-40,0,rx,100,320);
    rg.addColorStop(0,'rgba(0,208,230,0.04)'); rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
  }
  ctx.restore();
}

function drawSeaweed(){
  seaweed.forEach(s=>{
    const segments=6, segH=s.h/segments;
    ctx.beginPath(); ctx.moveTo(s.x,H-10);
    for(let i=1;i<=segments;i++){
      const sw=Math.sin(s.phase+i*0.7)*10*(i/segments);
      ctx.lineTo(s.x+sw,H-10-i*segH);
    }
    ctx.strokeStyle=s.col; ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
  });
}

function drawBubbles(){
  bubbles.forEach(b=>{
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.strokeStyle=`rgba(31,230,255,${b.op})`; ctx.lineWidth=1; ctx.stroke();
  });
}

function drawEntity(e){
  ctx.save();
  ctx.translate(e.x,e.y+Math.sin(e.wobble)*3);
  if(e.cat==='food'){
    if(e.vx>0) ctx.scale(-1,1);
    // body
    ctx.shadowColor=e.col; ctx.shadowBlur=8;
    ctx.fillStyle=e.col+'aa';
    ctx.beginPath(); ctx.ellipse(0,0,e.w/2,e.h/2,0,0,Math.PI*2); ctx.fill();
    // tail
    const td = e.vx>0?1:-1;
    ctx.beginPath(); ctx.moveTo(-e.w/2*td,0); ctx.lineTo(-e.w/2*td-e.w*0.35*td,-e.h*0.4); ctx.lineTo(-e.w/2*td-e.w*0.35*td,e.h*0.4); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(e.w*0.25,- e.h*0.15,e.h*0.18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(e.w*0.27,-e.h*0.15,e.h*0.09,0,Math.PI*2); ctx.fill();
  } else if(e.cat==='jellyfish'){
    ctx.shadowColor=e.col; ctx.shadowBlur=14;
    ctx.fillStyle=e.col+'70';
    ctx.beginPath(); ctx.arc(0,-e.h*0.15,e.w/2,Math.PI,0); ctx.closePath(); ctx.fill();
    for(let t=0;t<5;t++){
      ctx.strokeStyle=e.col+'80'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-e.w*0.35+t*(e.w*0.17),e.h*0.1);
      ctx.bezierCurveTo(-e.w*0.35+t*(e.w*0.17)+Math.sin(e.wobble+t)*8,e.h*0.4, -e.w*0.35+t*(e.w*0.17)+Math.sin(e.wobble+t+1)*8,e.h*0.7, -e.w*0.35+t*(e.w*0.17)+Math.sin(e.wobble+t)*5,e.h*0.9);
      ctx.stroke();
    }
  } else {
    // big danger fish
    if(e.vx>0) ctx.scale(-1,1);
    ctx.shadowColor='#ff4444'; ctx.shadowBlur=12;
    ctx.fillStyle='#60708088';
    ctx.beginPath(); ctx.ellipse(0,0,e.w/2,e.h/2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff444488';
    ctx.beginPath(); ctx.moveTo(-e.w/2,0); ctx.lineTo(-e.w/2-e.w*0.3,-e.h*0.45); ctx.lineTo(-e.w/2-e.w*0.3,e.h*0.45); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#ff666666'; ctx.lineWidth=1.5;
    for(let t=0;t<4;t++){
      ctx.beginPath(); ctx.moveTo(-e.w*0.1+t*e.w*0.15,e.h*0.35); ctx.lineTo(-e.w*0.1+t*e.w*0.15+3,e.h*0.55); ctx.stroke();
    }
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(e.w*0.28,-e.h*0.15,e.h*0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#f00'; ctx.beginPath(); ctx.arc(e.w*0.3,-e.h*0.15,e.h*0.1,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(){
  ctx.save();
  ctx.translate(player.x,player.y);
  if(player.facing===-1) ctx.scale(-1,1);
  // blink if invincible
  if(player.invTimer>0 && Math.floor(player.invTimer/6)%2===0){ ctx.restore(); return; }
  const pw=player.w+(player.eatAnim>0?6:0), ph=player.h+(player.eatAnim>0?4:0);
  ctx.shadowColor='#1FE6FF'; ctx.shadowBlur=18;
  // body
  ctx.fillStyle='#1FE6FFcc';
  ctx.beginPath(); ctx.ellipse(0,0,pw/2,ph/2,0,0,Math.PI*2); ctx.fill();
  // tail
  ctx.fillStyle='#00D0E6aa';
  ctx.beginPath(); ctx.moveTo(-pw/2,0); ctx.lineTo(-pw/2-22,-ph*0.55); ctx.lineTo(-pw/2-22,ph*0.55); ctx.closePath(); ctx.fill();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(0,-ph/2); ctx.lineTo(pw*0.1,-ph/2-14); ctx.lineTo(pw*0.3,-ph/2); ctx.closePath(); ctx.fillStyle='#00D0E6bb'; ctx.fill();
  // teeth
  ctx.fillStyle='#fff';
  for(let t=0;t<4;t++) { ctx.beginPath(); ctx.moveTo(pw/2-4-t*5,ph*0.1); ctx.lineTo(pw/2-1-t*5,ph*0.35); ctx.lineTo(pw/2-8-t*5,ph*0.1); ctx.closePath(); ctx.fill(); }
  // eye
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(pw*0.28,-ph*0.18,ph*0.22,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#0a1518'; ctx.beginPath(); ctx.arc(pw*0.31,-ph*0.18,ph*0.12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(pw*0.34,-ph*0.24,ph*0.05,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawHUD(){
  // Score
  ctx.fillStyle='rgba(5,7,7,0.55)'; ctx.fillRect(10,10,180,60); ctx.strokeStyle='#2B2F31'; ctx.strokeRect(10,10,180,60);
  ctx.fillStyle='rgba(0,208,230,0.7)'; ctx.font='bold 11px Exo 2,sans-serif'; ctx.fillText('SCORE',20,28);
  ctx.fillStyle='#1FE6FF'; ctx.font='bold 26px Cinzel,serif'; ctx.fillText(score,20,55);
  // Level
  ctx.fillStyle='rgba(5,7,7,0.55)'; ctx.fillRect(W/2-60,10,120,40); ctx.strokeStyle='#2B2F31'; ctx.strokeRect(W/2-60,10,120,40);
  ctx.fillStyle='#00D0E6'; ctx.font='bold 13px Cinzel,serif'; ctx.textAlign='center'; ctx.fillText('LEVEL  '+level,W/2,33); ctx.textAlign='left';
  // Lives
  ctx.fillStyle='rgba(5,7,7,0.55)'; ctx.fillRect(W-130,10,120,46); ctx.strokeStyle='#2B2F31'; ctx.strokeRect(W-130,10,120,46);
  ctx.fillStyle='rgba(0,208,230,0.7)'; ctx.font='bold 11px Exo 2,sans-serif'; ctx.fillText('LIVES',W-120,28);
  for(let i=0;i<3;i++){ ctx.font='22px serif'; ctx.fillStyle=i<lives?'#1FE6FF':'#333'; ctx.fillText('🦈',W-120+i*36,50); }
  // Flash
  if(flashTimer>0){ ctx.fillStyle=`rgba(255,40,40,${(flashTimer/30)*0.3})`; ctx.fillRect(0,0,W,H); flashTimer--; }
  // Score popups
  scorePopups.forEach(p=>{
    ctx.save();
    ctx.globalAlpha=Math.min(1,p.life/30);
    ctx.fillStyle=p.big?'#FFD700':'#1FE6FF';
    ctx.font=p.big?'bold 28px Cinzel,serif':'bold 16px Exo 2,sans-serif';
    ctx.textAlign='center'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=8;
    ctx.fillText(p.txt,p.x,p.y); ctx.restore();
  });
  ctx.textAlign='left';
}

function drawOverlay(title,sub,btn){
  ctx.fillStyle='rgba(5,7,7,0.88)'; ctx.fillRect(0,0,W,H);
  // border
  ctx.strokeStyle='#0C8E83'; ctx.lineWidth=2;
  const bx=W/2-220,by=H/2-160,bw=440,bh=320;
  ctx.strokeRect(bx,by,bw,bh);
  ctx.strokeStyle='rgba(0,208,230,0.15)'; ctx.strokeRect(bx+4,by+4,bw-8,bh-8);
  // title
  ctx.fillStyle='#1FE6FF'; ctx.font='bold 38px Cinzel,serif'; ctx.textAlign='center';
  ctx.shadowColor='#1FE6FF'; ctx.shadowBlur=20; ctx.fillText(title,W/2,H/2-80); ctx.shadowBlur=0;
  ctx.fillStyle='rgba(242,242,242,0.6)'; ctx.font='14px Exo 2,sans-serif'; ctx.fillText(sub,W/2,H/2-42);
  if(phase==='gameover'){ ctx.fillStyle='#1FE6FF'; ctx.font='bold 24px Cinzel,serif'; ctx.fillText('SCORE: '+score,W/2,H/2+5); }
  // button hint
  ctx.fillStyle='rgba(0,208,230,0.8)'; ctx.font='bold 13px Exo 2,sans-serif'; ctx.fillText(btn,W/2,H/2+60);
  ctx.fillStyle='rgba(242,242,242,0.35)'; ctx.font='12px Exo 2,sans-serif'; ctx.fillText('or press SPACE',W/2,H/2+82);
  ctx.textAlign='left'; ctx.shadowBlur=0;
}

function drawPause(){
  ctx.fillStyle='rgba(5,7,7,0.75)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1FE6FF'; ctx.font='bold 44px Cinzel,serif'; ctx.textAlign='center';
  ctx.shadowColor='#1FE6FF'; ctx.shadowBlur=24; ctx.fillText('PAUSED',W/2,H/2-20); ctx.shadowBlur=0;
  ctx.fillStyle='rgba(242,242,242,0.5)'; ctx.font='14px Exo 2,sans-serif'; ctx.fillText('Press SPACE or P to resume',W/2,H/2+24); ctx.textAlign='left';
}

// Loop
function loop(){
  update();
  drawBg();
  if(phase==='playing'||phase==='paused'){
    drawSeaweed(); drawBubbles();
    entities.forEach(drawEntity);
    drawPlayer(); drawHUD();
  }
  if(phase==='start') drawOverlay('DIVE FRENZY','Use WASD / Arrow Keys to swim. Eat smaller fish. Avoid the predators!','Click START or press SPACE');
  if(phase==='gameover') drawOverlay('GAME OVER','The deep claimed you...','Click PLAY AGAIN or press SPACE');
  if(phase==='paused') drawPause();
  requestAnimationFrame(loop);
}

// Mobile touch
let touchStart={x:0,y:0};
canvas.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; },{passive:false});
canvas.addEventListener('touchmove',e=>{ e.preventDefault(); const t=e.touches[0]; const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y; Object.keys(keys).forEach(k=>keys[k]=false); if(Math.abs(dx)>Math.abs(dy)){ if(dx>10){keys['ArrowRight']=true;player.facing=1;} else if(dx<-10){keys['ArrowLeft']=true;player.facing=-1;} } else { if(dy>10) keys['ArrowDown']=true; else if(dy<-10) keys['ArrowUp']=true; } },{passive:false});
canvas.addEventListener('touchend',()=>{ Object.keys(keys).forEach(k=>keys[k]=false); });

initBubbles(); initSeaweed();
loop();

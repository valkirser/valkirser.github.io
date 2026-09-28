if(document.getElementById('c')){
(function(){
var ZONES_URL = "https://raw.githubusercontent.com/freebuisness/assets/main/zones.json";
var COVER_BASE = "https://raw.githubusercontent.com/freebuisness/covers/main";

var canvas=document.getElementById('c'), ctx=canvas.getContext('2d');
var statusEl=document.getElementById('status');
var browserNameEl=document.getElementById('browserName');
var ua=navigator.userAgent;
browserNameEl.textContent=/Edg\//.test(ua)?'Microsoft Edge':(/OPR\//.test(ua)?'Opera':(/Firefox\//.test(ua)?'Firefox':(/Chrome\//.test(ua)?'Chrome':(/Safari\//.test(ua)?'Safari':'your browser'))));
var errbox=document.getElementById('errbox');
var bootCount=document.getElementById('bootCount');
var bootStage=document.getElementById('bootStage');
var bootImageList=document.getElementById('bootImageList');
var bootStartedAt=performance.now();
var playBtn=document.getElementById('playBtn');
var filterBtn=document.getElementById('filterBtn');
var filterPanel=document.getElementById('filterPanel');
var debugPanel=document.getElementById('debugPanel');
var debugOpen=false;
var W,H,DPR,dprCap=1.25;
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,dprCap);
  W=window.innerWidth; H=window.innerHeight;
  canvas.width=W*DPR; canvas.height=H*DPR;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();
canvas.style.pointerEvents='none';

function rnd(seed){ var x=Math.sin(seed*127.1+311.7)*43758.5453; return x-Math.floor(x); }

var ARMS=7;
var HUES=[]; for (var hi=0; hi<ARMS; hi++){ HUES.push(190+(hi/ARMS)*170); }

var glowSprites=HUES.map(function(hue){
  var size=200;
  var c=document.createElement('canvas'); c.width=c.height=size;
  var g=c.getContext('2d');
  var grad=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  grad.addColorStop(0,'hsla('+hue+',90%,72%,0.85)');
  grad.addColorStop(0.28,'hsla('+hue+',85%,66%,0.4)');
  grad.addColorStop(0.6,'hsla('+hue+',80%,60%,0.14)');
  grad.addColorStop(1,'hsla('+hue+',80%,55%,0)');
  g.fillStyle=grad; g.fillRect(0,0,size,size);
  return c;
});

var planets=[], galaxyBounds=null, activeBounds=null, fullView=null;

function separateXY(list, xKey, yKey, iterations){
  var cell=130;
  for (var iter=0; iter<iterations; iter++){
    var grid={};
    for (var gi=0; gi<list.length; gi++){
      var gp=list[gi];
      var key=(Math.floor(gp[xKey]/cell))+','+(Math.floor(gp[yKey]/cell));
      (grid[key]=grid[key]||[]).push(gi);
    }
    for (var i=0;i<list.length;i++){
      var a=list[i];
      var gx=Math.floor(a[xKey]/cell), gy=Math.floor(a[yKey]/cell);
      for (var dxc=-1; dxc<=1; dxc++){
        for (var dyc=-1; dyc<=1; dyc++){
          var bucket=grid[(gx+dxc)+','+(gy+dyc)];
          if (!bucket) continue;
          for (var bi=0; bi<bucket.length; bi++){
            var j=bucket[bi];
            if (j<=i) continue;
            var b=list[j];
            var dx=b[xKey]-a[xKey], dy=b[yKey]-a[yKey];
            var dist=Math.sqrt(dx*dx+dy*dy);
            var min=(a.half+b.half)*1.85+24;
            if (dist<min){
              if (dist<0.001){ dx=(rnd(i*97+j)-0.5); dy=(rnd(i*53+j*7)-0.5); dist=0.01; }
              var push=(min-dist)/dist*0.5;
              a[xKey]-=dx*push; a[yKey]-=dy*push;
              b[xKey]+=dx*push; b[yKey]+=dy*push;
            }
          }
        }
      }
    }
  }
}

function armPos(arm, t, RMAX, TWIST, jr, ja){
  var r0=90+RMAX*Math.sqrt(t);
  var a0=arm*(Math.PI*2/ARMS)+t*TWIST*Math.PI*2;
  var r=Math.max(40,r0+(jr||0)), a=a0+(ja||0);
  return [Math.cos(a)*r, Math.sin(a)*r*0.55];
}

function boundsOf(list, keyx, keyy){
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  list.forEach(function(p){
    minX=Math.min(minX,p[keyx]-p.half); maxX=Math.max(maxX,p[keyx]+p.half);
    minY=Math.min(minY,p[keyy]-p.half); maxY=Math.max(maxY,p[keyy]+p.half);
  });
  return {minX:minX,maxX:maxX,minY:minY,maxY:maxY};
}

function fitToBounds(b, pad){
  pad = pad||160;
  var w=(b.maxX-b.minX)+pad*2, h=(b.maxY-b.minY)+pad*2;
  var scale=Math.max(0.02, Math.min(6, Math.min(W/w, H/h)));
  return { x:(b.minX+b.maxX)/2, y:(b.minY+b.maxY)/2, scale:scale };
}

function buildPlanets(games){
  var N=games.length;
  var TWIST=2.4;
  var RMAX = 75*Math.sqrt(N)*1.15;

  var tagSet={};
  planets = games.map(function(g,i){
    var t=i/N, arm=i%ARMS;
    var jr=(rnd(i*3+1)-0.5)*RMAX*0.01, ja=(rnd(i*7+2)-0.5)*0.45;
    var pos=armPos(arm, t, RMAX, TWIST, jr, ja);
    var edge=42+rnd(i*17+9)*14;
    var tags=g.special||[];
    tags.forEach(function(tg){ tagSet[tg]=true; });
    var direct=g.cover.replace('{COVER_URL}', COVER_BASE);
    var proxied="https://wsrv.nl/?url="+encodeURIComponent(direct)+"&w=180&h=180&fit=cover&output=webp&q=78";
    return {
      id:g.id, name:g.name, directUrl:direct, proxyUrl:proxied,
      x:pos[0], y:pos[1], half:edge/2, arm:arm, tags:tags, phase:rnd(i*29+3)*Math.PI*2,
      alpha:1, targetAlpha:1, glow:0, targetGlow:0, sel:0
    };
  });
  separateXY(planets, 'x', 'y', 24);
  planets.forEach(function(p){ p.homeX=p.x; p.homeY=p.y; p.tx=p.x; p.ty=p.y; });

  galaxyBounds=boundsOf(planets,'homeX','homeY');
  activeBounds=galaxyBounds;
  fullView=fitToBounds(galaxyBounds, 220);
  camTarget.x=fullView.x; camTarget.y=fullView.y; camTarget.scale=fullView.scale;
  camDisplay.x=fullView.x; camDisplay.y=fullView.y; camDisplay.scale=fullView.scale;

  buildFilterPanel(Object.keys(tagSet).sort());
}

function layoutScatter(matches){
  var n=matches.length;
  var RMAX = 60*Math.sqrt(n)*1.1;
  var cx=0,cy=0; matches.forEach(function(p){ cx+=p.homeX; cy+=p.homeY; }); cx/=n; cy/=n;
  matches.forEach(function(p,i){
    var t=i/n, arm=i%ARMS;
    var jr=(rnd(i*3+1)-0.5)*RMAX*0.2, ja=(rnd(i*7+2)-0.5)*0.6;
    var pos=armPos(arm, t, RMAX, 2.1, jr, ja);
    p.tx=cx+pos[0]; p.ty=cy+pos[1];
  });
  separateXY(matches, 'tx', 'ty', 18);
  return boundsOf(matches,'tx','ty');
}

function buildFilterPanel(tags){
  filterPanel.innerHTML='';
  var all=document.createElement('div');
  all.className='chip active'; all.textContent='All'; all.dataset.tag='';
  all.onclick=function(){ setTagFilter(null); };
  filterPanel.appendChild(all);
  tags.forEach(function(tag){
    var c=document.createElement('div');
    c.className='chip'; c.textContent=tag; c.dataset.tag=tag;
    c.onclick=function(){ setTagFilter(tag); };
    filterPanel.appendChild(c);
  });
}

var activeTag=null;
function setTagFilter(tag){
  activeTag=tag;
  Array.prototype.forEach.call(filterPanel.children, function(c){
    c.classList.toggle('active', (c.dataset.tag||null)===tag);
  });
  filterBtn.classList.toggle('on', !!tag);
  if (!tag){
    planets.forEach(function(p){ p.tx=p.homeX; p.ty=p.homeY; });
    activeBounds=galaxyBounds;
    camTarget.x=fullView.x; camTarget.y=fullView.y; camTarget.scale=fullView.scale;
    if (selected && !tagOk(selected)) selected=null;
    return;
  }
  var matches=planets.filter(function(p){ return p.tags.indexOf(tag)!==-1; });
  if (!matches.length) return;
  var bounds=layoutScatter(matches);
  activeBounds=bounds;
  var f=fitToBounds(bounds, 120);
  camTarget.x=f.x; camTarget.y=f.y; camTarget.scale=f.scale;
  if (selected && !tagOk(selected)) selected=null;
}
function tagOk(p){ return !activeTag || p.tags.indexOf(activeTag)!==-1; }

filterBtn.addEventListener('click', function(){ filterPanel.classList.toggle('open'); });
document.addEventListener('click', function(e){
  if (!e.target.closest('.filter-wrap')) filterPanel.classList.remove('open');
  if (!e.target.closest('.search-wrap')) results.style.display='none';
});

function loadAllImages(list,onProgress,onDone){
  var active=0, CONC=3, queue=list.slice(), total=list.length, completed=0, doneCalled=false, failures=0, successes=0;
  function makeThumb(p,img){
    try { var s=144,c=document.createElement('canvas');c.width=c.height=s;var x=c.getContext('2d');
      x.beginPath();if(x.roundRect)x.roundRect(0,0,s,s,14);else x.rect(0,0,s,s);x.clip();x.drawImage(img,0,0,s,s);p.thumb=c;
    } catch(err){}
  }
  function finish(p){
    if(p._loadDone)return;
    p._loadDone=true;p.loading=false;p.imageAttempted=true;active--;completed++;
    if(p.thumb)successes++;else failures++;
    if(onProgress)onProgress(completed,total,successes,failures,p);
    pump();
  }
  function load(p,url,fallback){
    var img=new Image();
    img.onload=function(){
      img.onload=null;img.onerror=null;
      if(img.naturalWidth>0)makeThumb(p,img);
      if(!p.thumb&&fallback){var next=fallback;fallback=null;img.src='';load(p,next,null);return;}
      img.src='';finish(p);
    };
    img.onerror=function(){
      img.onload=null;img.onerror=null;img.src='';
      if(fallback){var next=fallback;fallback=null;load(p,next,null);return;}
      finish(p);
    };
    img.src=url;
  }
  function pump(){
    while(queue.length&&active<CONC){var p=queue.shift();if(p.thumb||p.loading){completed++;continue;}p.loading=true;active++;load(p,p.proxyUrl,p.directUrl);}
    if(completed>=total&&active===0&&queue.length===0&&!doneCalled){doneCalled=true;if(onDone)onDone();}
  }
  window.getGalaxyImageStats=function(){return {active:active,queued:queue.length};};
  if(onProgress)onProgress(0,total,0,0);
  pump();
}

function reveal(){
  statusEl.classList.add('hidden');
  canvas.classList.add('ready');
  canvas.style.pointerEvents='auto';
  frame();
}
window.addEventListener('pageshow',function(event){
  if(event.persisted){
    document.body.classList.remove('page-leaving');
    statusEl.classList.add('hidden');
    canvas.classList.add('ready');
    canvas.style.pointerEvents='auto';
  }
});

async function loadGames(){
  try {
    var res = await fetch(ZONES_URL);
    if (!res.ok) throw new Error('http '+res.status);
    var json = await res.json();
    var games = json.filter(function(z){ return z.id !== -1 && z.cover; });
    if (!games.length) throw new Error('empty');
    buildPlanets(games);
    bootStage.textContent='Found '+planets.length+' systems. Reading image files...';
    loadAllImages(planets,function(done,total,loaded,failed,planet){
      done=Math.min(done,total);
      if(planet){
        if(done===1)bootImageList.innerHTML="";
        var row=document.createElement('li');
        row.className='boot-entry'+(planet.thumb?'':' failed');
        row.textContent=String(done)+' / '+total+'  '+planet.name;
        bootImageList.appendChild(row);
        if(row.offsetHeight>bootImageList.clientHeight){row.remove();}
        while(bootImageList.scrollHeight>bootImageList.clientHeight&&bootImageList.children.length>1)bootImageList.removeChild(bootImageList.firstChild);
      }
      bootCount.textContent=loaded+' loaded · '+failed+' unavailable';
      var pct=total?Math.floor(done/total*100):100;
      bootStage.textContent=done<total?'Decoding image '+done+' of '+total+'... ('+pct+'%)':(failed?'Finished: '+loaded+' covers decoded, '+failed+' unavailable. ('+pct+'%)':'Successfully decoded all covers. ('+pct+'%)');
    },function(){var wait=Math.max(0,2000-(performance.now()-bootStartedAt));setTimeout(reveal,wait);});
  } catch (e) {
    bootStage.textContent='System startup failed.';
    errbox.style.display='block';
    errbox.textContent='This page fetches the game list and covers fresh on every visit — it needs to run on a real host (not a sandboxed preview) with normal network access to do that.';
  }
}

var camTarget={x:0,y:0,scale:0.26};
var camDisplay={x:0,y:0,scale:0.26};
var SMOOTH_POS=0.16, SMOOTH_SCALE=0.09, POS_SMOOTH=0.08;
var tween=null;
loadGames();

var _wts=[0,0];
function worldToScreen(x,y){ _wts[0]=(x-camDisplay.x)*camDisplay.scale+W/2; _wts[1]=(y-camDisplay.y)*camDisplay.scale+H/2; return _wts; }
var _stw=[0,0];
function screenToWorld(sx,sy){ _stw[0]=(sx-W/2)/camDisplay.scale+camDisplay.x; _stw[1]=(sy-H/2)/camDisplay.scale+camDisplay.y; return _stw; }

function clampCamera(){
  var b=activeBounds||galaxyBounds;
  if (!b) return;
  var bw=b.maxX-b.minX, bh=b.maxY-b.minY;
  var margin=Math.max(300, Math.max(bw,bh)*0.22);
  camTarget.x=Math.max(b.minX-margin, Math.min(b.maxX+margin, camTarget.x));
  camTarget.y=Math.max(b.minY-margin, Math.min(b.maxY+margin, camTarget.y));
  var minScale=Math.min(W/(bw+320), H/(bh+320))*0.5;
  camTarget.scale=Math.max(minScale, Math.min(6, camTarget.scale));
}

var hovered=null, selected=null, matchSet=null;
function findAt(sx,sy){
  var w=screenToWorld(sx,sy), wx=w[0], wy=w[1];
  var best=null, bestD=1e18, pad=6/camDisplay.scale;
  for (var i=0;i<planets.length;i++){
    var p=planets[i];
    if (!tagOk(p)) continue;
    var dx=wx-p.x, dy=wy-p.y, d=dx*dx+dy*dy, rr=p.half+pad;
    if (d<rr*rr && d<bestD){ bestD=d; best=p; }
  }
  return best;
}

var dragging=false, lastX=0, lastY=0, moveAmt=0;
canvas.addEventListener('mousedown', function(e){
  if (e.button!==0) return;
  dragging=true; lastX=e.clientX; lastY=e.clientY; moveAmt=0;
  canvas.classList.add('dragging');
  tween=null;
  camTarget.x=camDisplay.x; camTarget.y=camDisplay.y; camTarget.scale=camDisplay.scale;
});
var mouseX=null, mouseY=null, mouseMoved=false;
window.addEventListener('mousemove', function(e){
  mouseX=e.clientX; mouseY=e.clientY; mouseMoved=true;
  if (dragging){
    var dx=e.clientX-lastX, dy=e.clientY-lastY;
    camTarget.x-=dx/camDisplay.scale; camTarget.y-=dy/camDisplay.scale;
    lastX=e.clientX; lastY=e.clientY; moveAmt+=Math.abs(dx)+Math.abs(dy);
  }
});
window.addEventListener('mouseup', function(e){
  if (dragging){
    dragging=false; canvas.classList.remove('dragging');
    if (moveAmt<6){
      var p=findAt(e.clientX,e.clientY);
      if (p) focusPlanet(p); else selected=null;
    }
  }
});
canvas.addEventListener('wheel', function(e){
  e.preventDefault();
  var zoomingOut = e.deltaY>0;
  if (zoomingOut && selected) selected=null;
  tween=null;
  var w=[(e.clientX-W/2)/camTarget.scale+camTarget.x, (e.clientY-H/2)/camTarget.scale+camTarget.y];
  var factor=Math.exp(-e.deltaY*0.0009);
  camTarget.scale=camTarget.scale*factor;
  camTarget.x=w[0]-(e.clientX-W/2)/camTarget.scale;
  camTarget.y=w[1]-(e.clientY-H/2)/camTarget.scale;
}, {passive:false});

var playerOverlay=document.getElementById('playerOverlay');
var playerPageFrame=document.getElementById('playerPageFrame');
var playerHistoryEntry=false;
function showPlayer(id,pushHistory){
  var url='player.html?id='+encodeURIComponent(id)+'&from=index&embedded=1';
  if(pushHistory!==false){
    var state={gnMathPlayer:true,gameId:String(id)};
    var historyUrl=location.protocol==='file:'?location.href:url;
    try{history.pushState(state,'',historyUrl);playerHistoryEntry=true;}
    catch(e){try{location.hash='gnmath-player-'+encodeURIComponent(id);playerHistoryEntry=true;}catch(e2){playerHistoryEntry=false;}}
  }else playerHistoryEntry=true;
  playerOverlayOpen=true;
  playerOverlay.classList.add('open');
  playerOverlay.setAttribute('aria-hidden','false');
  playerPageFrame.src=url;
}
function hidePlayer(){
  if(!playerOverlayOpen)return;
  playerOverlayOpen=false;
  playerHistoryEntry=false;
  playerOverlay.classList.remove('open');
  playerOverlay.setAttribute('aria-hidden','true');
  requestAnimationFrame(frame);
  setTimeout(function(){if(!playerOverlayOpen)playerPageFrame.src='about:blank';},320);
}
function returnToLibrary(){
  var closeHistoryEntry=playerHistoryEntry;
  if(closeHistoryEntry){
    try{history.replaceState(null,'',new URL('index.html',location.href).href);}catch(e){}
  }
  hidePlayer();
  if(closeHistoryEntry)history.back();
}
window.addEventListener('popstate',function(event){
  if(event.state&&event.state.gnMathPlayer)showPlayer(event.state.gameId,false);
  else{playerHistoryEntry=false;hidePlayer();}
});
window.addEventListener('hashchange',function(){
  if(location.protocol!=='file:')return;
  var match=location.hash.match(/^#gnmath-player-(.+)$/);
  if(match){if(!playerOverlayOpen)showPlayer(decodeURIComponent(match[1]),false);}
  else if(playerOverlayOpen){playerHistoryEntry=false;hidePlayer();}
});
window.addEventListener('message',function(event){
  if(event.source!==playerPageFrame.contentWindow||!event.data||event.data.type!=='GN_MATH_CLOSE_PLAYER')return;
  returnToLibrary();
});
function playGame(p){showPlayer(p.id,true);}
playBtn.addEventListener('click', function(){ if (selected) playGame(selected); });

function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
function focusPlanet(p){
  var s0=worldToScreen(p.x,p.y);
  tween={ startSX:s0[0], startSY:s0[1], fromScale:camDisplay.scale, toScale:2.4,
          px:p.x, py:p.y, t0:performance.now(), dur:1500 };
  selected=p;
}

var search=document.getElementById('search'), results=document.getElementById('results'),
    countEl=document.getElementById('count'), clearBtn=document.getElementById('clearBtn'), randomBtn=document.getElementById('randomBtn');
function handleSearchInput(){
  var q=search.value.trim().toLowerCase();
  clearBtn.classList.toggle('show', search.value.length>0);
  if (!q){ matchSet=null; results.style.display='none'; countEl.textContent=''; return; }
  var matches=planets.filter(function(p){ return p.name.toLowerCase().indexOf(q)!==-1; });
  matchSet=new Set(matches.map(function(p){ return p.id; }));
  countEl.textContent=matches.length+(matches.length===1?' system':' systems');
  results.innerHTML='';
  matches.slice(0,30).forEach(function(p){
    var d=document.createElement('div');
    d.textContent=p.name;
    d.onclick=function(){ focusPlanet(p); results.style.display='none'; };
    results.appendChild(d);
  });
  results.style.display=matches.length?'block':'none';
}
search.addEventListener('input', handleSearchInput);
search.addEventListener('keydown', function(e){
  if (e.key==='Enter'){
    var first=null;
    for (var i=0;i<planets.length;i++){ if (matchSet && matchSet.has(planets[i].id)){ first=planets[i]; break; } }
    if (first){ focusPlanet(first); results.style.display='none'; }
  }
});
clearBtn.addEventListener('click', function(){
  search.value=''; handleSearchInput(); search.focus();
});
randomBtn.addEventListener('click',function(){
  var candidates=planets.filter(function(p){return tagOk(p)&&(!matchSet||matchSet.has(p.id));});
  if(!candidates.length&&planets.length){
    search.value='';
    handleSearchInput();
    setTagFilter(null);
    candidates=planets.slice();
  }
  if(!candidates.length)return;
  results.style.display='none';
  filterPanel.classList.remove('open');
  hovered=null;
  selected=null;
  focusPlanet(candidates[Math.floor(Math.random()*candidates.length)]);
});

function roundedSquare(cx,cy,half){
  var r=half*(16/90);
  if (ctx.roundRect){ ctx.beginPath(); ctx.roundRect(cx-half,cy-half,half*2,half*2,r); }
  else { ctx.beginPath(); ctx.rect(cx-half,cy-half,half*2,half*2); }
}
function pillRect(cx,cy,w,h){
  var r=h/2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx-w/2,cy-h/2,w,h,r);
  else ctx.rect(cx-w/2,cy-h/2,w,h);
}

var playerOverlayOpen=false;
var t=0, lastFrameAt=0, frameTimes=[], renderTimes=[], lowQuality=false, qualityCooldown=0;
var visiblePlanets=0, debugLastUpdate=0;
var labelQueue=[];
var playBtnState={left:null, top:null, shown:false};
document.addEventListener('keydown',function(e){if(e.key==='F8'){e.preventDefault();debugOpen=!debugOpen;debugPanel.classList.toggle('open',debugOpen);debugLastUpdate=0;}else if(e.key==='Escape'&&debugOpen){debugOpen=false;debugPanel.classList.remove('open');}});

function frame(now){
  now = now || performance.now();
  var renderStart=performance.now();
  visiblePlanets=0;
  var dt = lastFrameAt ? Math.min((now-lastFrameAt)/1000, 0.1) : 0.016;
  lastFrameAt = now;
  t += dt;

  frameTimes.push(dt*1000);
  if (frameTimes.length>60) frameTimes.shift();

  if (!dragging && mouseMoved){
    hovered=findAt(mouseX,mouseY);
    canvas.style.cursor=hovered?'pointer':'grab';
    mouseMoved=false;
  }

  var step=dt*60;
  var posK=1-Math.pow(1-SMOOTH_POS, step);
  var scaleK=1-Math.pow(1-SMOOTH_SCALE, step);
  var tileK=1-Math.pow(1-POS_SMOOTH, step);
  var alphaK=1-Math.pow(1-0.12, step);
  var glowK=1-Math.pow(1-0.15, step);
  var selK=1-Math.pow(1-0.16, step);

  if (tween){
    var el=now-tween.t0, f=Math.min(1, el/tween.dur), e=easeOutCubic(f);
    var curScale=tween.fromScale+(tween.toScale-tween.fromScale)*e;
    var curSX=tween.startSX+(W/2-tween.startSX)*e;
    var curSY=tween.startSY+(H/2-tween.startSY)*e;
    camDisplay.scale=curScale;
    camDisplay.x=tween.px-(curSX-W/2)/curScale;
    camDisplay.y=tween.py-(curSY-H/2)/curScale;
    camTarget.x=camDisplay.x; camTarget.y=camDisplay.y; camTarget.scale=camDisplay.scale;
    if (f>=1) tween=null;
  } else {
    clampCamera();
    camDisplay.x += (camTarget.x-camDisplay.x)*posK;
    camDisplay.y += (camTarget.y-camDisplay.y)*posK;
    camDisplay.scale += (camTarget.scale-camDisplay.scale)*scaleK;
  }

  ctx.clearRect(0,0,W,H);
  labelQueue.length=0;

  for (var pi=0;pi<planets.length;pi++){
    var p=planets[pi];

    var sp=worldToScreen(p.x,p.y), sx=sp[0], sy=sp[1];
    var cullR=p.half*Math.max(camDisplay.scale,0.3)*1.4+70;
    var onScreen = sx>-cullR && sx<W+cullR && sy>-cullR && sy<H+cullR;

    if (Math.abs(p.tx-p.x)>0.05 || Math.abs(p.ty-p.y)>0.05){
      p.x += (p.tx-p.x)*tileK; p.y += (p.ty-p.y)*tileK;
    }
    if (!onScreen) continue;
    visiblePlanets++;


    var isMatch=matchSet && matchSet.has(p.id);
    var isHover=hovered===p, isSel=selected===p;
    var visibleByTag=tagOk(p);
    p.targetAlpha = !visibleByTag ? 0 : ((matchSet && !isMatch) ? 0.1 : 1);
    p.targetGlow = (isHover||isMatch) ? 1 : 0;
    var selTarget = isSel?1:0;
    p.alpha = Math.abs(p.targetAlpha-p.alpha)<0.003 ? p.targetAlpha : p.alpha+(p.targetAlpha-p.alpha)*alphaK;
    p.glow  = Math.abs(p.targetGlow-p.glow)<0.003  ? p.targetGlow  : p.glow +(p.targetGlow-p.glow)*glowK;
    p.sel   = Math.abs(selTarget-p.sel)<0.003       ? selTarget     : p.sel  +(selTarget-p.sel)*selK;
    if (p.alpha<0.01 && !visibleByTag) continue;

    var baseR=p.half*Math.max(camDisplay.scale,0.3);
    var sr=baseR*(1+p.sel*0.28);

    var pulse=1+0.05*Math.sin(t*1.1+p.phase);
    var gsr=Math.min(sr,38);
    var highlighted = isHover||isSel||isMatch;
    if (highlighted){
      var boost=1+p.glow*0.4+p.sel*0.6;
      var outer=gsr*4.4*pulse*boost, inner=gsr*2.0*pulse*boost;
      ctx.globalAlpha=p.alpha*0.5;
      ctx.drawImage(glowSprites[p.arm], sx-outer/2, sy-outer/2, outer, outer);
      ctx.globalAlpha=p.alpha*(0.85+p.glow*0.15+p.sel*0.15);
      ctx.drawImage(glowSprites[p.arm], sx-inner/2, sy-inner/2, inner, inner);
    } else if (!lowQuality){
      var g1=gsr*3.6*pulse;
      ctx.globalAlpha=p.alpha*0.38;
      ctx.drawImage(glowSprites[p.arm], sx-g1/2, sy-g1/2, g1, g1);
    }

    ctx.globalAlpha=p.alpha;
    if (p.thumb){
      ctx.drawImage(p.thumb, sx-sr, sy-sr, sr*2, sr*2);
    } else {
      ctx.fillStyle='#1c1b2c'; ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);
    }

    if (p.glow>0.02 || p.sel>0.02){
      var ringA=Math.max(p.glow, p.sel);
      ctx.globalAlpha=p.alpha*ringA;
      ctx.strokeStyle = p.sel>0.3 ? '#ffb37c' : (isMatch ? '#ffb37c' : '#7cf7ff');
      ctx.lineWidth=2.2;
      roundedSquare(sx,sy,sr+3); ctx.stroke();
    }

    if (isHover || isSel){
      labelQueue.push({sx:sx, sy:sy, sr:sr, alpha:p.alpha, name:p.name});
    }
  }
  ctx.globalAlpha=1;

  if (labelQueue.length){
    ctx.font='600 11px "IBM Plex Mono",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for (var li=0; li<labelQueue.length; li++){
      var L=labelQueue[li];
      var tw=ctx.measureText(L.name).width, pw=tw+18, ph=20;
      var cy=L.sy-L.sr-14;
      ctx.globalAlpha=L.alpha*0.9;
      ctx.fillStyle='rgba(6,5,14,0.85)';
      pillRect(L.sx,cy,pw,ph); ctx.fill();
      ctx.globalAlpha=L.alpha;
      ctx.fillStyle='#f5f4fb';
      ctx.fillText(L.name, L.sx, cy+0.5);
    }
    ctx.globalAlpha=1;
  }

  if (selected){
    var sp2=worldToScreen(selected.x,selected.y);
    var baseR2=selected.half*Math.max(camDisplay.scale,0.3)*(1+selected.sel*0.28);
    var nl=Math.round(sp2[0])+'px', nt=Math.round(sp2[1]+baseR2+12)+'px';
    if (!playBtnState.shown){ playBtn.style.display='block'; playBtnState.shown=true; }
    if (playBtnState.left!==nl){ playBtn.style.left=nl; playBtnState.left=nl; }
    if (playBtnState.top!==nt){ playBtn.style.top=nt; playBtnState.top=nt; }
  } else if (playBtnState.shown){
    playBtn.style.display='none'; playBtnState.shown=false;
  }

  var renderMs=performance.now()-renderStart;
  renderTimes.push(renderMs); if(renderTimes.length>30)renderTimes.shift();
  if(renderTimes.length>=12){
    var renderSum=0; for(var ri=0;ri<renderTimes.length;ri++)renderSum+=renderTimes[ri];
    var avgRender=renderSum/renderTimes.length;
    if(!lowQuality && avgRender>14){lowQuality=true;qualityCooldown=0;dprCap=1;resize();}
    else if(lowQuality && avgRender<5){qualityCooldown++;if(qualityCooldown>120){lowQuality=false;qualityCooldown=0;dprCap=1.5;resize();}}
    else if(lowQuality)qualityCooldown=0;
  }
  if(debugOpen && now-debugLastUpdate>250){
    debugLastUpdate=now;
    var totalFrame=0; for(var fti=0;fti<frameTimes.length;fti++)totalFrame+=frameTimes[fti];
    var fps=frameTimes.length?1000/(totalFrame/frameTimes.length):0;
    var loaded=0; for(var dpi=0;dpi<planets.length;dpi++)if(planets[dpi].thumb)loaded++;
    var qs=window.getGalaxyImageStats?window.getGalaxyImageStats():{active:0,queued:0};
    debugPanel.textContent='GN-MATH DIAGNOSTICS · F8\nFPS             '+fps.toFixed(1)+'\nFrame interval  '+(frameTimes.length?(totalFrame/frameTimes.length).toFixed(1):'0.0')+' ms\nRender work     '+renderMs.toFixed(2)+' ms\nVisible         '+visiblePlanets+' / '+planets.length+'\nCovers cached   '+loaded+' / '+planets.length+'\nImage requests  '+qs.active+' active, '+qs.queued+' queued\nCanvas          '+canvas.width+' × '+canvas.height+' @ '+DPR.toFixed(2)+'×\nQuality         '+(lowQuality?'reduced':'full')+' · '+(matchSet?'search':'all')+(activeTag?' · filter':'');
  }
  if(!playerOverlayOpen)requestAnimationFrame(frame);
}
})();

}
if(document.getElementById('gameFrame')){
(function(){
  'use strict';
  var ZONES_URL='https://raw.githubusercontent.com/freebuisness/assets/main/zones.json';
  var HTML_BASE='https://raw.githack.com/freebuisness/html/main';
  var params=new URLSearchParams(location.search), id=params.get('id');
  var frame=document.getElementById('gameFrame'), wrap=document.getElementById('frameWrap');
  var loading=document.getElementById('frameLoading'), detail=document.getElementById('loadingDetail');
  var errorCard=document.getElementById('errorCard'), gameName=document.getElementById('gameName');
  var gameAuthor=document.getElementById('gameAuthor'), connection=document.getElementById('connectionStatus');
  var gameIdLabel=document.getElementById('gameIdLabel'), launchedUrl='';
  function libraryUrl(){return 'index.html';}
  function goBack(){document.body.classList.add('player-leaving');setTimeout(function(){if(params.get('embedded')==='1'&&window.parent!==window){window.parent.postMessage({type:'GN_MATH_CLOSE_PLAYER'},location.origin==='null'?'*':location.origin);return;}location.replace(libraryUrl());},170);}
  function fail(title,message){loading.classList.add('hidden');wrap.classList.remove('ready');errorCard.hidden=false;document.getElementById('errorTitle').textContent=title;document.getElementById('errorMessage').textContent=message;connection.textContent='STARTUP FAILED';}
  function resolveUrl(value){return String(value||'').replace(/\{HTML_URL\}/g,HTML_BASE).replace(/\{COVER_URL\}/g,'https://raw.githubusercontent.com/freebuisness/covers/main');}
  document.getElementById('backButton').addEventListener('click',goBack);
  document.getElementById('errorBackButton').addEventListener('click',goBack);
  document.getElementById('reloadButton').addEventListener('click',function(){if(launchedUrl){loading.classList.remove('hidden');wrap.classList.remove('ready');detail.textContent='Reloading game…';frame.src=launchedUrl;}});
  function focusGameInput(){try{frame.focus({preventScroll:true});}catch(e){frame.focus();}try{frame.contentWindow.focus();}catch(e){}}
  function fullscreen(){var target=wrap;if(document.fullscreenElement){document.exitFullscreen&&document.exitFullscreen();return;}if(target.requestFullscreen)target.requestFullscreen().catch(function(){});}
  document.getElementById('fullscreenButton').addEventListener('click',fullscreen);
  document.getElementById('newTabButton').addEventListener('click',function(){if(launchedUrl)window.open(launchedUrl,'_blank','noopener');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.fullscreenElement)document.exitFullscreen&&document.exitFullscreen();if(e.key.toLowerCase()==='f'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))fullscreen();});
  frame.addEventListener('load',function(){if(!launchedUrl)return;loading.classList.add('hidden');wrap.classList.add('ready');connection.textContent='GAME CONNECTED';focusGameInput();});
  frame.addEventListener('error',function(){fail('Game failed to load','The game host could not be reached. Check your connection, then try reloading.');});
  gameIdLabel.textContent='GN-MATH / '+(id||'—');
  if(id===null||id.trim()===''){location.replace('index.html');return;}
  fetch(ZONES_URL).then(function(response){if(!response.ok)throw new Error('The game list could not be downloaded.');return response.json();}).then(function(games){
    var game=games.find(function(item){return String(item.id)===String(id);});
    if(!game||!game.url)throw new Error('This game could not be found in the library.');
    gameName.textContent=game.name||'Untitled game';
    gameAuthor.textContent=game.author?'BY '+game.author:'GN-MATH · HTML5 PLAYER';
    document.title=(game.name||'Game')+' · GN-MATH Player';
    launchedUrl=resolveUrl(game.url);
    if(!/^https?:\/\//i.test(launchedUrl))throw new Error('This game has an invalid launch address.');
    detail.textContent='Opening '+(new URL(launchedUrl)).hostname+'…';
    frame.src=launchedUrl;
    connection.textContent='CONNECTING';
  }).catch(function(error){fail('Unable to launch game',error.message||'The game list could not be loaded.');});
})();

}
















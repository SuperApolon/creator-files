// RoomEngine: 2.5D isometric room, 2D billboard resident. View-only: the resident walks on its own; walks as its round hub icon (mirrored only). No player input.
const AMBIENT='#3a4250';
const shade=(hex,f)=>{const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const m=v=>Math.max(0,Math.min(255,Math.round(v*f)));return`rgb(${m(r)},${m(g)},${m(b)})`;};
export class RoomEngine{
  constructor(canvas,data,opt={}){
    this.cv=canvas;this.ctx=canvas.getContext('2d');this.d=data;this.opt=opt;
    this.W=data.size?.w||12;this.H=data.size?.h||10;
    this.p={x:data.spawn?.x??this.W/2,y:data.spawn?.y??this.H/2,dir:1,step:0};
    this.r=0.3;this.speed=1.1;
    this.goal=null;this.wait=1+Math.random()*2;this.stuck=0;
    this.furn=(data.furniture||[]).map(f=>({z:1,color:'#888',...f}));
    this.img=null;
    const ld=(n,cb)=>{const im=new Image();im.onload=()=>cb(im);im.onerror=()=>{};im.src=opt.assetBase+n;};
    if(opt.assetBase)ld('avatar.png',im=>this.img=im);
    if(opt.assetBase)for(const f of this.furn)if(f.img)ld(f.img,im=>{if(im.naturalWidth&&im.naturalHeight)f._im=im;});
    // optional textures: wallImg / floorImg / windows[].img (assets/ file names). Missing/failed -> colour only.
    this.tex={};const ok=im=>im.naturalWidth&&im.naturalHeight;
    if(opt.assetBase){for(const k of ['wallImg','floorImg'])if(data[k])ld(data[k],im=>{if(ok(im))this.tex[k]=im;});
      for(const w of data.windows||[])if(w.img)ld(w.img,im=>{if(ok(im))w._im=im;});
      if(data.sceneImg)ld(data.sceneImg,im=>{if(ok(im))this.tex.scene=im;});}
  }
  start(){this._ui();addEventListener('resize',()=>this._resize());this._resize();
    let t0=performance.now();const loop=t=>{const dt=Math.min(.05,(t-t0)/1000);t0=t;this._update(dt);this._draw();requestAnimationFrame(loop)};requestAnimationFrame(loop);return this;}
  _resize(){const dpr=devicePixelRatio||1;this.cv.width=innerWidth*dpr;this.cv.height=innerHeight*dpr;this.cv.style.width=innerWidth+'px';this.cv.style.height=innerHeight+'px';this.dpr=dpr;
    let t=Math.min(innerWidth*1.9/(this.W+this.H),innerHeight*1.5/((this.W+this.H)/2+3));
    // autoFit: big rooms (isLobby / large size) must fit whole floor + wall top inside viewport with margin
    const S=this.W+this.H,wh=this.d.wallHeight||3,big=this.d.isLobby||S>26,m=big?0.06:0;
    const ft=Math.min(innerWidth*(1-2*m)*2/S,(innerHeight*(1-2*m)-72)/(S/4+wh*0.7));
    if(big)t=ft*(this.d.cameraScale||1);this.tw=t;this.th=t/2;
    this.ox=innerWidth/2+(this.H-this.W)*t/4;
    if(big){const top=-wh*this.th*1.4,bot=S*this.th/2;this.oy=72+(innerHeight-72-(bot-top))/2-top;}
    else this.oy=(innerHeight-(this.W+this.H)*this.th/2)/2+this.th*2;}
  iso(x,y,z=0){return[this.ox+(x-y)*this.tw/2,this.oy+(x+y)*this.th/2-z*this.th*1.4];}
  _ui(){const h=document.createElement('div');h.className='re-hud';
    h.innerHTML=`<div class="re-title"><a href="${this.opt.backHref||'../../'}">←</a> <b></b><span></span></div><div class="re-note"></div><div class="re-help">観覧のみ・住人は自分で動きます</div>`;
    document.body.appendChild(h);h.querySelector('b').textContent=this.d.title||'';h.querySelector('.re-title span').textContent=this.d.authorName?' — '+this.d.authorName:'';
    h.querySelector('.re-note').textContent=this.d.note||'';document.title=(this.d.title||'部屋')+'｜'+(this.d.authorName||'');
    // lobby link (every private room) / room links (lobby: data.links=[{id,title,authorName}])
    const nav=document.createElement('div');nav.className='re-nav';
    const lob=this.d.isLobby||this.d.id==='lobby',hasL=(this.d.links||[]).some(l=>/lobby/.test(l.href||''));
    if(!lob&&!hasL){const a=document.createElement('a');a.href=this.opt.lobbyHref||'../lobby/';a.textContent='🏛 ロビーへ';nav.appendChild(a);}
    for(const r of this.d.links||[]){const a=document.createElement('a');a.href=r.href||((this.opt.roomsBase||'../')+r.id+'/');a.textContent=r.label||('🚪 '+(r.authorName||r.title||r.id));if(r.title)a.title=r.title;nav.appendChild(a);}
    h.appendChild(nav);this.hud=h;if(lob)this._foot();}
  _foot(){const f=document.createElement('div');f.className='re-foot';f.innerHTML='<div class="re-foot-t">👣 みんなの訪問</div><ul></ul>';
    fetch(this.opt.visitsUrl||'./visits.json').then(r=>r.ok?r.json():[]).catch(()=>[]).then(v=>{const ul=f.querySelector('ul');
      v=(Array.isArray(v)?v:[]).filter(x=>x&&(x.kind||'enter')==='enter'&&String(x.note||'').trim()).sort((a,b)=>(b.id||0)-(a.id||0));
      if(!v.length){f.remove();return;}
      for(const x of v){const li=document.createElement('li');const J=v=>v==='lobby'?'ロビー':v;li.textContent=`${J(x.from)||'?'} → ${x.room==='lobby'?'ロビー':(x.host&&x.host!==x.room?J(x.host)+'の部屋':x.room)}`;
        if(x.note){const n=document.createElement('span');n.textContent='「'+x.note+'」';li.appendChild(n);}ul.appendChild(li);}});
    this.hud.appendChild(f);}
  _hit(x,y){const r=this.r;if(x-r<0||y-r<0||x+r>this.W||y+r>this.H)return true;
    return this.furn.some(f=>f.solid&&x+r>f.x&&x-r<f.x+f.w&&y+r>f.y&&y-r<f.y+f.h);}
  _pick(){for(let i=0;i<30;i++){const x=this.r+Math.random()*(this.W-2*this.r),y=this.r+Math.random()*(this.H-2*this.r);if(!this._hit(x,y))return{x,y};}return null;}
  _update(dt){const p=this.p;
    if(this.wait>0){this.wait-=dt;p.step=0;if(Math.random()<dt*.4){p.dir=-p.dir;}if(this.wait<=0)this.goal=this._pick();}
    else if(this.goal){const dx=this.goal.x-p.x,dy=this.goal.y-p.y,L=Math.hypot(dx,dy);
      if(L<.15){this.goal=null;this.wait=1.5+Math.random()*5;}
      else{const vx=dx/L*this.speed*dt,vy=dy/L*this.speed*dt;let mv=false;
        if(!this._hit(p.x+vx,p.y)){p.x+=vx;mv=true;}if(!this._hit(p.x,p.y+vy)){p.y+=vy;mv=true;}
        this.stuck=mv?0:this.stuck+dt;if(this.stuck>.6){this.stuck=0;this.goal=this._pick();}
        p.step+=dt*5;const sx=vx-vy,sd=vx+vy;if(Math.abs(sx)>1e-4)p.dir=sx>0?1:-1;
        if(Math.random()<dt*.05){this.goal=null;this.wait=1+Math.random()*3;}}}
    else this.wait=.5;
  }
  _poly(pts,fill,stroke){const c=this.ctx;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
  _box(f){const{x,y,w,h,z}=f,col=f.color,I=(a,b,c)=>this.iso(a,b,c);
    this._poly([I(x,y+h,0),I(x+w,y+h,0),I(x+w,y+h,z),I(x,y+h,z)],shade(col,.75),'rgba(0,0,0,.15)');
    this._poly([I(x+w,y,0),I(x+w,y+h,0),I(x+w,y+h,z),I(x+w,y,z)],shade(col,.6),'rgba(0,0,0,.15)');
    this._poly([I(x,y,z),I(x+w,y,z),I(x+w,y+h,z),I(x,y+h,z)],shade(col,1.1),'rgba(0,0,0,.15)');
    if(f.label){const[lx,ly]=I(x+w/2,y+h/2,z);const c=this.ctx;c.font=`${Math.max(10,this.tw*.28)}px sans-serif`;c.textAlign='center';c.fillStyle='rgba(20,20,30,.75)';c.fillText(f.label,lx,ly-4);}}
  // 2D billboard furniture: transparent PNG standing on the floor rect. Foot = front-centre of footprint; width = iso footprint width (×scale); height by aspect.
  _sprite(f){const im=f._im,c=this.ctx,{x,y,w,h}=f;
    const[cx,cy]=this.iso(x+w/2,y+h/2,0),[,fy]=this.iso(x+w,y+h,0),footY=(cy+fy)/2;
    let wd=(w+h)*this.tw/2*(f.scale||1),hg=wd*im.naturalHeight/im.naturalWidth;
    if(f.imgH){hg=f.imgH*this.th*1.4;wd=hg*im.naturalWidth/im.naturalHeight;}
    c.save();if(f.flip){c.translate(cx,0);c.scale(-1,1);c.translate(-cx,0);}c.drawImage(im,cx-wd/2,footY-hg,wd,hg);c.restore();}
  // affine-map an image onto the parallelogram o, o+u, o+v (o = image top-left, u = image x-axis, v = image y-axis)
  _tex(im,o,u,v,alpha=1){const c=this.ctx;c.save();c.globalAlpha=alpha;c.beginPath();c.moveTo(o[0],o[1]);c.lineTo(o[0]+u[0],o[1]+u[1]);c.lineTo(o[0]+u[0]+v[0],o[1]+u[1]+v[1]);c.lineTo(o[0]+v[0],o[1]+v[1]);c.closePath();c.clip();
    c.transform(u[0]/im.naturalWidth,u[1]/im.naturalWidth,v[0]/im.naturalHeight,v[1]/im.naturalHeight,o[0],o[1]);c.drawImage(im,0,0);c.restore();}
  _quadTex(im,tl,tr,bl,alpha){this._tex(im,tl,[tr[0]-tl[0],tr[1]-tl[1]],[bl[0]-tl[0],bl[1]-tl[1]],alpha);}
  // sceneImg: full-room iso painting. Fit with a similarity (uniform scale+rotate+translate) from floor corners so the painting never shears.
  // Anchors: sceneAnchors {L,R,F[,B]} natural px, else sceneFit left/right/front/back (1024-basis).
  // Clip = painting wall tops + floor outline only (no engine wallHeight forcing). 3D walls and floor are never drawn when sceneImg is set (collision kept).
  _scene(im){const c=this.ctx,W=this.W,H=this.H,k=im.naturalWidth/1024,sa=this.d.sceneAnchors||{},sf=this.d.sceneFit||{};
    const D={L:[84,580],R:[962,598],F:[548,880],B:[512,300],backTop:[512,92],leftTop:[78,322],rightTop:[968,320]};
    const fit=key=>{const al={left:'L',right:'R',front:'F',back:'B'};const v=sf[key]||D[key]||D[al[key]];return v.map(x=>x*k);};
    const imgL=sa.L||fit('left'),imgR=sa.R||fit('right'),imgF=sa.F||fit('front'),imgB=sa.B||(sf.back?fit('back'):null);
    const sL=this.iso(0,H),sR=this.iso(W,0),sF=this.iso(W,H),sB=this.iso(0,0);
    const imgs=imgB?[imgB,imgR,imgF,imgL]:[imgL,imgR,imgF],scrs=imgB?[sB,sR,sF,sL]:[sL,sR,sF],n=imgs.length;
    let ix=0,iy=0,sx=0,sy=0;for(let i=0;i<n;i++){ix+=imgs[i][0];iy+=imgs[i][1];sx+=scrs[i][0];sy+=scrs[i][1];}
    ix/=n;iy/=n;sx/=n;sy/=n;
    let norm=0,re=0,imA=0;for(let i=0;i<n;i++){const zx=imgs[i][0]-ix,zy=imgs[i][1]-iy,wx=scrs[i][0]-sx,wy=scrs[i][1]-sy;norm+=zx*zx+zy*zy;re+=zx*wx+zy*wy;imA+=zx*wy-zy*wx;}
    if(!norm)return;const a=re/norm,b=imA/norm,e=sx-a*ix+b*iy,f=sy-b*ix-a*iy,T=q=>[a*q[0]-b*q[1]+e,b*q[0]+a*q[1]+f];
    const clip=[T(fit('leftTop')),T(fit('backTop')),T(fit('rightTop')),T(imgR),T(imgF),T(imgL)];
    c.save();c.globalAlpha=this.d.sceneAlpha??1;c.beginPath();clip.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
    c.transform(a,b,-b,a,e,f);c.drawImage(im,0,0);c.restore();}
  _furn(f){if(f._im&&f.flat){const I=(a,b)=>this.iso(a,b,0);this._quadTex(f._im,I(f.x,f.y),I(f.x+f.w,f.y),I(f.x,f.y+f.h),f.alpha??1);return;}f._im?this._sprite(f):this._box(f);}
  _avatar(){const c=this.ctx,p=this.p,[x,y]=this.iso(p.x,p.y,0),s=this.tw*.9,bob=Math.abs(Math.sin(p.step))*s*.06;
    c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(x,y,s*.3,s*.13,0,0,7);c.fill();
    const im=this.img;
    c.save();c.translate(x,y-bob);
    if(im){const hgt=this.tw*1.2,wd=hgt*im.naturalWidth/im.naturalHeight;c.scale(p.dir,1);c.drawImage(im,-wd/2,-hgt,wd,hgt);}
    else{c.scale(p.dir,1);c.fillStyle=shade(this.d.accent||'#5b7cfa',1);c.beginPath();c.roundRect(-s*.28,-s*.95,s*.56,s*.9,s*.15);c.fill();
      c.fillStyle='#ffe8d6';c.beginPath();c.arc(0,-s*1.15,s*.26,0,7);c.fill();
      c.fillStyle='#222';const ey=-s*1.17;c.fillRect(s*.03,ey,s*.05,s*.07);c.fillRect(s*.14,ey,s*.05,s*.07);}
    c.restore();}
  _draw(){const c=this.ctx,W=this.W,H=this.H,I=(a,b,z)=>this.iso(a,b,z);c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const col=AMBIENT;const g=c.createRadialGradient(innerWidth/2,innerHeight/2,0,innerWidth/2,innerHeight/2,Math.max(innerWidth,innerHeight));g.addColorStop(0,shade(col,.55));g.addColorStop(1,'#11131c');c.fillStyle=g;c.fillRect(0,0,innerWidth,innerHeight);
    const wh=this.d.wallHeight||3,wc=this.d.wallColor||'#8a9bb5',fc=this.d.floorColor||'#d4c4a8';
    const sc=this.tex.scene,sk=!!this.d.sceneImg;
    // sceneImg: NEVER draw walls or floor (no polys / wallColor / floorColor / wallImg / floorImg / windows / grid). Painting only. _hit bounds unchanged.
    if(sk){
      if(sc)this._scene(sc);
    }else{
      const wt=this.tex.wallImg,ft=this.tex.floorImg,wa=this.d.wallImgAlpha??1,fa=this.d.floorImgAlpha??1;
      this._poly([I(0,0,0),I(W,0,0),I(W,0,wh),I(0,0,wh)],shade(wc,.95),'rgba(0,0,0,.2)');
      if(wt)this._quadTex(wt,I(0,0,wh),I(W,0,wh),I(0,0,0),wa);
      this._poly([I(0,0,0),I(0,H,0),I(0,H,wh),I(0,0,wh)],shade(wc,.8),'rgba(0,0,0,.2)');
      if(wt){this._quadTex(wt,I(0,H,wh),I(0,0,wh),I(0,H,0),wa);this._poly([I(0,0,0),I(0,H,0),I(0,H,wh),I(0,0,wh)],'rgba(0,0,0,.12)');}
      for(const w of this.d.windows||[]){const wall=w.wall||'back',a=w.at,l=w.w||2,z0=w.z??1,z1=z0+(w.hgt||1.2);
        const q=wall==='left'?[I(0,a,z0),I(0,a+l,z0),I(0,a+l,z1),I(0,a,z1)]:[I(a,0,z0),I(a+l,0,z0),I(a+l,0,z1),I(a,0,z1)];
        if(w._im){wall==='left'?this._quadTex(w._im,q[2],q[3],q[1]):this._quadTex(w._im,q[3],q[2],q[0]);}
        else this._poly(q,w.color||'#cfe8ff','rgba(255,255,255,.8)');}
      for(let i=0;i<W;i++)for(let j=0;j<H;j++)this._poly([I(i,j),I(i+1,j),I(i+1,j+1),I(i,j+1)],(i+j)%2?fc:shade(fc,.94),(this.d.grid&&!ft)?'rgba(0,0,0,.12)':null);
      if(ft){const n=this.d.floorImgTile||0;
        if(n>0){for(let i=0;i<W;i+=n)for(let j=0;j<H;j+=n){const a=Math.min(n,W-i),b=Math.min(n,H-j);this._quadTex(ft,I(i,j),I(i+a,j),I(i,j+b),fa);}}
        else this._quadTex(ft,I(0,0),I(W,0),I(0,H),fa);
        if(this.d.grid)for(let i=0;i<W;i++)for(let j=0;j<H;j++)this._poly([I(i,j),I(i+1,j),I(i+1,j+1),I(i,j+1)],'rgba(0,0,0,0)','rgba(0,0,0,.08)');}
    }
    const items=(sk?[]:this.furn).map(f=>({d:f.z<=.1?-1:f.x+f.w+f.y+f.h-.01,f}));if(!(this.d.isLobby||this.d.id==='lobby'))items.push({d:this.p.x+this.p.y+this.r*2,a:1});items.sort((a,b)=>a.d-b.d);
    for(const it of items)it.a?this._avatar():this._furn(it.f);
    }
}

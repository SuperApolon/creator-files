import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {VRMLoaderPlugin} from '@pixiv/three-vrm';import {VRMAnimationLoaderPlugin,createVRMAnimationClip} from '@pixiv/three-vrm-animation';import {MeshoptDecoder} from 'meshoptimizer/decoder';
// Walk in place; the road (near layer) scrolls at the stance-foot speed measured in the motion (0.5 m/s), far layer at 0.3x.
const FOOT_Y=945, GROUND_SPEED=0.5, FAR_RATIO=0.3, PERIOD=10, FADE=1.0, YAW=THREE.MathUtils.degToRad(50); // 50deg: walking toward screen-right, body turned 40deg toward the viewer (face and the held board read better)
const bg=document.getElementById('bg'),ctx=bg.getContext('2d');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.domElement.id='gl';renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.01,100);
scene.add(new THREE.HemisphereLight(0xffffff,0xffffff,1.1));const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(1,2,3);scene.add(key);
const tintA=new THREE.DirectionalLight(0xffffff,0),tintB=new THREE.DirectionalLight(0xffffff,0);tintA.position.set(-2,1.5,1.5);tintB.position.set(2.5,.8,-1);scene.add(tintA,tintB);
const root=new THREE.Group();root.rotation.y=YAW;scene.add(root);
// Soft contact shadow: radial-gradient ellipse on the ground plane (y=0), stretched along the walking axis by the feet spread, darker when the hips are low.
const sc=document.createElement('canvas');sc.width=sc.height=128;{const g=sc.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(.45,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);}
const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false,opacity:.5});
const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;shadow.renderOrder=-1;root.add(shadow);
// Wet-road reflection (neon only): the model rendered mirrored about y=0 into a target, composited under the main pass with a downward fade.
const reflRT=new THREE.WebGLRenderTarget(2,2);const reflScene=new THREE.Scene(),reflCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const reflMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{map:{value:reflRT.texture},opacity:{value:0},gy:{value:.8},len:{value:.2}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:'uniform sampler2D map;uniform float opacity,gy,len;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);float y=1.-vUv.y;float f=1.-smoothstep(gy,gy+len,y);f*=step(gy-.002,y);gl_FragColor=vec4(c.rgb,c.a*opacity*f);}'});
reflScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),reflMat));window.walkFx={reflection:true};
let W=0,H=0,S=1,OY=0,nearPx=0,cfg=null;const imgs={};let vrm=null,action=null,clipDur=1;let t=0;window.walkTime=null;
function layout(){W=innerWidth;H=innerHeight;bg.width=W;bg.height=H;renderer.setSize(W,H);camera.aspect=W/H;
 const dist=W<600?5.4:4.6;camera.updateProjectionMatrix();
 // Feet stand on the middle of the road: image y=945 (between the road's far edge 810 and the bottom 1080), mapped through the cover crop (height-fit, top-aligned).
 S=H/1080;OY=0;const want=FOOT_Y*S;const gyAt=d=>{camera.position.set(0,.95+d,dist);camera.lookAt(0,.78+d,0);camera.updateMatrixWorld();const q=new THREE.Vector3(0,0,0).project(camera);return (1-q.y)/2*H;};
 let lo=-1,hi=1;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(gyAt(m)<want)lo=m;else hi=m;}gyAt((lo+hi)/2);
 const p=v=>{const q=v.clone().project(camera);return [(q.x+1)/2*W,(1-q.y)/2*H]};const g=p(new THREE.Vector3(0,0,0));
 const fwd=new THREE.Vector3(Math.sin(YAW),0,Math.cos(YAW));const g2=p(fwd.clone().multiplyScalar(GROUND_SPEED*.01));
 nearPx=Math.abs(g2[0]-g[0])*100; // screen px per second of a ground point moving at GROUND_SPEED along the walking axis
 const gy=g[1];reflRT.setSize(W,H);reflMat.uniforms.gy.value=gy/H;reflMat.uniforms.len.value=Math.min(.25,(H-gy)/H);window.walkLayout={roadFarEdgeY:810*S+OY,footLineY:want,groundY:gy,scale:S,offsetY:OY,nearPxPerSec:nearPx,farPxPerSec:nearPx*FAR_RATIO};}
addEventListener("resize",layout);window.walkProject=(x,y,z)=>{const q=new THREE.Vector3(x,y,z).project(camera);return [(q.x+1)/2*W,(1-q.y)/2*H]};
function drawLayer(img,offPx,alpha){if(!img||alpha<=0)return;const tw=Math.round(img.width*S),th=Math.round(img.height*S);let x=-Math.round(((offPx%tw)+tw)%tw);ctx.globalAlpha=alpha;for(;x<W;x+=tw)ctx.drawImage(img,x,OY,tw,th);ctx.globalAlpha=1;}
function sceneAt(t){const k=Math.floor(t/PERIOD),r=t-k*PERIOD,names=['neon','forest'];let cur=names[k%2],nxt=names[(k+1)%2],w=0;
 if(r>PERIOD-FADE/2)w=(r-(PERIOD-FADE/2))/FADE;if(r<FADE/2&&k>0){cur=names[(k-1)%2];nxt=names[k%2];w=(r+FADE/2)/FADE;}
 w=w*w*(3-2*w);return {cur,nxt,w};}
function drawBg(t){const {cur,nxt,w}=sceneAt(t);ctx.clearRect(0,0,W,H);const near=nearPx*t,far=near*FAR_RATIO;
 drawLayer(imgs[cur+'-far'],far,1);drawLayer(imgs[nxt+'-far'],far,w);drawLayer(imgs[cur+'-near'],near,1-w);drawLayer(imgs[nxt+'-near'],near,w);
 window.walkScene=w<.5?cur:nxt;window.walkFade=w;const neon=(cur==='neon'?1-w:0)+(nxt==='neon'?w:0);
 if(cfg&&cfg.tint){tintA.color.set(cfg.tint[0]);tintB.color.set(cfg.tint[1]);}tintA.intensity=.55*neon;tintB.intensity=.45*neon;window.walkNeon=neon;reflMat.uniforms.opacity.value=.2*neon;}
async function loadImages(){cfg=await (await fetch('./bg/scenes.json')).json();const jobs=[];for(const [sc,ls] of Object.entries(cfg.scenes))for(const [ly,o] of Object.entries(ls))jobs.push(new Promise((res,rej)=>{const im=new Image();im.onload=()=>{imgs[sc+'-'+ly]=im;res()};im.onerror=rej;im.src='./'+o.src;}));await Promise.all(jobs);}
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);loader.register(p=>new VRMLoaderPlugin(p));
async function main(){layout();await loadImages();const g=await loader.loadAsync('../viewer/towa-director.vrm');vrm=g.userData.vrm;root.add(vrm.scene);window.vrm=vrm;
 if(vrm.expressionManager.getExpression('towaCalm'))vrm.expressionManager.setValue('towaCalm',1);
 const look=new THREE.Object3D();look.position.set(0,1.45,3);root.add(look);vrm.lookAt.target=look;
 const al=new GLTFLoader();al.register(p=>new VRMAnimationLoaderPlugin(p));const ga=await al.loadAsync('./towa-walk.vrma');const clip=createVRMAnimationClip(ga.userData.vrmAnimations[0],vrm);
 clip.tracks=clip.tracks.filter(t=>t.name.endsWith('.quaternion')||t.name.endsWith('.position')&&!t.name.includes('lookAt'));clipDur=clip.duration;
 const mixer=new THREE.AnimationMixer(vrm.scene);action=mixer.clipAction(clip);action.play();window.walkMixer=mixer;window.walkAction=action;
 document.getElementById('status').textContent='';window.ready=true;}
main().catch(e=>{console.error(e);window.loadError=String(e);document.getElementById('status').textContent='読み込みに失敗しました。ページを再読み込みしてください。';});
const clock=new THREE.Clock();let last=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(window.walkTime==null)t+=dt;else t=window.walkTime;
 if(vrm&&action){action.time=t%clipDur;window.walkMixer.update(0);const ph=t%4.8;vrm.expressionManager.setValue('blink',ph<.18?Math.sin(ph/.18*Math.PI):0);vrm.update(window.walkTime==null?dt:Math.max(0,t-last)||0);}
 last=t;drawBg(t);
 if(vrm){const lf=new THREE.Vector3(),rf=new THREE.Vector3(),hp=new THREE.Vector3();vrm.humanoid.getRawBoneNode('leftFoot').getWorldPosition(lf);vrm.humanoid.getRawBoneNode('rightFoot').getWorldPosition(rf);vrm.humanoid.getRawBoneNode('hips').getWorldPosition(hp);
  root.worldToLocal(lf);root.worldToLocal(rf);root.worldToLocal(hp);const spread=Math.abs(lf.z-rf.z);shadow.position.x=(lf.x+rf.x)/2;shadow.position.z=(lf.z+rf.z)/2+.02;
  shadow.scale.set(.34,.30+spread*.9,1);const low=THREE.MathUtils.clamp((window.hip0??(window.hip0=hp.y))-hp.y+.01,0,.03);shadowMat.opacity=.42+low*4;window.walkShadow={sx:shadow.scale.x,sz:shadow.scale.y,opacity:shadowMat.opacity};}
 renderer.autoClear=false;renderer.setRenderTarget(null);renderer.clear();
 if(vrm&&reflMat.uniforms.opacity.value>.001){shadow.visible=false;root.scale.y=-1;renderer.setRenderTarget(reflRT);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);root.scale.y=1;shadow.visible=true;renderer.setRenderTarget(null);renderer.render(reflScene,reflCam);}
 renderer.render(scene,camera);window.walkT=t;}
frame();

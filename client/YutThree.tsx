import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Result } from "../server/game";

type Roll = { result: Result; sticks: boolean[]; rollId: number };
const easeOut = (n: number) => 1 - Math.pow(1 - n, 3);

const woodTexture = () => { const canvas=document.createElement("canvas");canvas.width=256;canvas.height=128;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#d89042";ctx.fillRect(0,0,256,128);for(let y=8;y<128;y+=13){ctx.strokeStyle=y%26?"#b95f29":"#f1b560";ctx.globalAlpha=.34;ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<=256;x+=12){ctx.lineTo(x,y+Math.sin(x*.08+y)*2)}ctx.stroke()}ctx.globalAlpha=1;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.2,2);return texture };

export function YutThree({ data }: { data?: Roll }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = mount.current; if (!host) return;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1.9, .1, 100);
    camera.position.set(0, 5.2, 7.4); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff2cf, 0x42200c, 2.4)); const key = new THREE.DirectionalLight(0xffe8b0, 3.8); key.position.set(-3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key); const rimLight=new THREE.DirectionalLight(0xffb768,1.2);rimLight.position.set(4,2,-3);scene.add(rimLight);
    // 얇은 호두나무 테두리와 황토빛 안쪽을 분리해 고급 접시처럼 보이게 한다.
    const table = new THREE.Mesh(new THREE.CylinderGeometry(3.34, 3.34, .18, 64), new THREE.MeshStandardMaterial({ color: 0x563017, roughness: .46, metalness:.08 })); table.receiveShadow = true; table.position.y = -.24; scene.add(table);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.08,.115,12,64),new THREE.MeshStandardMaterial({color:0x9b5428,roughness:.32,metalness:.1}));rim.rotation.x=Math.PI/2;rim.position.y=-.105;rim.castShadow=true;scene.add(rim);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(3.03, 3.03, .045, 64), new THREE.MeshStandardMaterial({ color: 0xf2c979, roughness: .78 })); inner.receiveShadow = true; inner.position.y = -.13; scene.add(inner);
    // 큰 윷 네 개가 멈춘 뒤에도 서로 겹치지 않도록 접시 안 착지 간격을 넉넉히 둔다.
    const sticks: THREE.Group[] = [], models:{model:THREE.Group;front:THREE.Group;back:THREE.Group}[] = [], end = [[-1.42,.78],[.42,.92],[-1.18,-.82],[1.32,-.76]];
    for (let i = 0; i < 4; i++) { const g = new THREE.Group();
      const model=new THREE.Group();g.add(model);
      // 앞면은 둥글고 뒷면은 평평한 전통 윷 단면이다. 멈출 때는 접시에 수평으로 눕는다.
      const grain=woodTexture(); const wood = new THREE.MeshStandardMaterial({ color: 0xd8893b, map:grain, roughness: .3, metalness: .04 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,1.34,18,1,false,0,Math.PI), wood); body.rotation.z = Math.PI / 2; body.castShadow = true; model.add(body);
      const flatBase = new THREE.Mesh(new THREE.BoxGeometry(1.34,.032,.48),new THREE.MeshStandardMaterial({color:0xb7672e,roughness:.44}));flatBase.position.y=-.016;flatBase.castShadow=true;model.add(flatBase);
      const frontDecor = new THREE.Group(), backDecor = new THREE.Group(); const ink = new THREE.MeshStandardMaterial({ color: 0x59301b, roughness: .38, metalness:.08 });
      // 앞면은 붉은 점 대신 전통 목가구처럼 보이는 세 개의 짧은 음각 인레이를 넣는다.
      for (const x of [-.34, 0, .34]) { const groove = new THREE.Mesh(new THREE.BoxGeometry(.17, .018, .10), ink); groove.position.set(x, .248, .035); groove.rotation.y = x === 0 ? 0 : (x < 0 ? -.22 : .22); groove.castShadow = true; frontDecor.add(groove); }
      // X 표시는 빽도 전용 첫 번째 윷의 평평한 뒷면에만 남긴다.
      const backFace=new THREE.Mesh(new THREE.BoxGeometry(1.30,.022,.44),new THREE.MeshStandardMaterial({color:0x9c5427,roughness:.42}));backFace.position.y=-.04;backFace.castShadow=true;backDecor.add(backFace);
      if (i === 0) for (const angle of [-.62, .62]) { const mark = new THREE.Mesh(new THREE.BoxGeometry(.48, .026, .052), new THREE.MeshStandardMaterial({ color: 0x6e1d18, roughness: .4 })); mark.position.set(0, -.07, 0); mark.rotation.y = angle; backDecor.add(mark); }
      model.add(frontDecor,backDecor);
      g.scale.setScalar(1.52); scene.add(g); sticks.push(g);models.push({model,front:frontDecor,back:backDecor}); }
    const start = [[-2.8,1.4],[-1.5,1.8],[1.4,1.6],[2.7,1.3]]; let frame = 0; const began = performance.now(), duration = data?.result === "NAK" ? 3000 : 2550;
    const draw = (now: number) => { const t = Math.min(1, (now - began) / duration); sticks.forEach((g, i) => { const isNakStick = data?.result === "NAK" && i === 3, p = easeOut(Math.min(1,t/.74)), bounce = t < .62 ? Math.sin((t / .62) * Math.PI) * 2.7 : Math.max(0, .34 * Math.sin((t - .62) * 42) * (1 - t) * 4), settle = easeOut(Math.max(0, (t - .58) / .27)), fall = isNakStick ? easeOut(Math.max(0, (t - .76) / .24)) : 0, locked=t>=.8&&!isNakStick; g.position.set(locked?end[i][0]:THREE.MathUtils.lerp(start[i][0], end[i][0], p) + fall*.7, locked ? .34 : .34 + bounce - fall * 5.6, locked?end[i][1]:THREE.MathUtils.lerp(start[i][1], end[i][1], p) + fall*3.4); g.scale.setScalar(1.52 * (1 - fall * .4)); const faceUp = data?.sticks[i] ?? true,model=models[i]; if(locked)g.rotation.set(0,i*.82,0);else g.rotation.set(THREE.MathUtils.lerp(7.5 + i, fall * 3, settle), THREE.MathUtils.lerp(t * (14 + i * 2), i * .82 + fall * 4, settle), THREE.MathUtils.lerp(i * .8, fall * 2, settle)); model.model.rotation.x=faceUp?0:Math.PI;model.front.visible=faceUp;model.back.visible=!faceUp;g.traverse(child=>{if(child instanceof THREE.Mesh){const material=child.material as THREE.MeshStandardMaterial;material.transparent=fall>0;material.opacity=1-fall;}}); }); renderer.render(scene, camera); if (t < 1) frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw); const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scene.traverse(item=>{if(item instanceof THREE.Mesh){const material=item.material as THREE.MeshStandardMaterial;material.map?.dispose()}}); renderer.dispose(); host.replaceChildren(); };
  }, [data?.rollId]);
  return <div className="yut-three" ref={mount} aria-label="3D 윷 던지기 애니메이션" />;
}

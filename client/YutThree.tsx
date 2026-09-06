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
    const sticks: THREE.Group[] = [], end = [[-1.42,.78],[.42,.92],[-1.18,-.82],[1.32,-.76]];
    for (let i = 0; i < 4; i++) { const g = new THREE.Group();
      // 둥근 윗면, 평평한 아랫면, 나무결과 끝마감을 가진 전통 윷 단면이다.
      const grain=woodTexture(); const wood = new THREE.MeshStandardMaterial({ color: 0xd8893b, map:grain, roughness: .3, metalness: .04 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, 1.34, 14, 1, false, 0, Math.PI), wood); body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
      const flat = new THREE.Mesh(new THREE.BoxGeometry(1.34, .028, .48), new THREE.MeshStandardMaterial({ color: 0xb9672d, roughness: .46 })); flat.position.y = -.012; flat.castShadow = true; g.add(flat);
      for(const x of [-.67,.67]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.245,14,10),new THREE.MeshStandardMaterial({color:0x9d4d24,roughness:.28,metalness:.08}));cap.scale.set(.42,1,1);cap.position.set(x,0,0);cap.castShadow=true;g.add(cap)}
      const frontDecor = new THREE.Group(), backDecor = new THREE.Group(); const ink = new THREE.MeshStandardMaterial({ color: 0x59301b, roughness: .38, metalness:.08 });
      // 앞면은 붉은 점 대신 전통 목가구처럼 보이는 세 개의 짧은 음각 인레이를 넣는다.
      for (const x of [-.34, 0, .34]) { const groove = new THREE.Mesh(new THREE.BoxGeometry(.17, .022, .105), ink); groove.position.set(x, .242, .045); groove.rotation.y = x === 0 ? 0 : (x < 0 ? -.22 : .22); groove.castShadow = true; frontDecor.add(groove); }
      // X 표시는 빽도 전용 첫 번째 윷의 평평한 뒷면에만 남긴다.
      if (i === 0) for (const angle of [-.62, .62]) { const mark = new THREE.Mesh(new THREE.BoxGeometry(.48, .026, .052), new THREE.MeshStandardMaterial({ color: 0x7c211a, roughness: .4 })); mark.position.set(0, -.035, 0); mark.rotation.y = angle; backDecor.add(mark); }
      g.add(frontDecor,backDecor);
      g.scale.setScalar(1.52); scene.add(g); sticks.push(g); }
    const start = [[-2.8,1.4],[-1.5,1.8],[1.4,1.6],[2.7,1.3]]; let frame = 0; const began = performance.now(), duration = data?.result === "NAK" ? 3000 : 2550;
    const draw = (now: number) => { const t = Math.min(1, (now - began) / duration); sticks.forEach((g, i) => { const isNakStick = data?.result === "NAK" && i === 3, p = easeOut(Math.min(1,t/.74)), bounce = t < .62 ? Math.sin((t / .62) * Math.PI) * 2.7 : Math.max(0, .34 * Math.sin((t - .62) * 42) * (1 - t) * 4), settle = easeOut(Math.max(0, (t - .58) / .27)), fall = isNakStick ? easeOut(Math.max(0, (t - .76) / .24)) : 0; g.position.set(THREE.MathUtils.lerp(start[i][0], end[i][0], p) + fall*.7, .46 + bounce - fall * 5.6, THREE.MathUtils.lerp(start[i][1], end[i][1], p) + fall*3.4); g.scale.setScalar(1.52 * (1 - fall * .4)); const faceUp = data?.sticks[i] ?? true, finalX = faceUp ? .02 : Math.PI; g.rotation.set(THREE.MathUtils.lerp(7.5 + i, finalX + fall * 3, settle), THREE.MathUtils.lerp(t * (14 + i * 2), i * .82 + fall * 4, settle), THREE.MathUtils.lerp(i * .8, fall * 2, settle)); const frontDecor=g.children[g.children.length-2],backDecor=g.children[g.children.length-1];frontDecor.visible=faceUp;backDecor.visible=!faceUp;g.traverse(child=>{if(child instanceof THREE.Mesh){const material=child.material as THREE.MeshStandardMaterial;material.transparent=fall>0;material.opacity=1-fall;}}); }); renderer.render(scene, camera); if (t < 1) frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw); const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scene.traverse(item=>{if(item instanceof THREE.Mesh){const material=item.material as THREE.MeshStandardMaterial;material.map?.dispose()}}); renderer.dispose(); host.replaceChildren(); };
  }, [data?.rollId]);
  return <div className="yut-three" ref={mount} aria-label="3D 윷 던지기 애니메이션" />;
}

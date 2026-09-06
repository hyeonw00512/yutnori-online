import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Result } from "../server/game";

type Roll = { result: Result; sticks: boolean[]; rollId: number };
const easeOut = (n: number) => 1 - Math.pow(1 - n, 3);

export function YutThree({ data }: { data?: Roll }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = mount.current; if (!host) return;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1.9, .1, 100);
    camera.position.set(0, 5.2, 7.4); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff2cf, 0x42200c, 2.2)); const key = new THREE.DirectionalLight(0xffe8b0, 3.4); key.position.set(-3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.35, .28, 64), new THREE.MeshStandardMaterial({ color: 0xb86f31, roughness: .62 })); table.receiveShadow = true; table.position.y = -.25; scene.add(table);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, .035, 64), new THREE.MeshStandardMaterial({ color: 0xe9b867, roughness: .78 })); inner.position.y = -.08; inner.receiveShadow = true; scene.add(inner);
    // 큰 윷 네 개가 멈춘 뒤에도 서로 겹치지 않도록 접시 안 착지 간격을 넉넉히 둔다.
    const sticks: THREE.Group[] = [], end = [[-1.42,.78],[.42,.92],[-1.18,-.82],[1.32,-.76]];
    for (let i = 0; i < 4; i++) { const g = new THREE.Group();
      // 둥근 윗면과 평평한 아랫면을 가진 전통 윷 단면을 만든다.
      const wood = new THREE.MeshStandardMaterial({ color: 0xd8893b, roughness: .34, metalness: .03 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, 1.34, 14, 1, false, 0, Math.PI), wood); body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
      const flat = new THREE.Mesh(new THREE.BoxGeometry(1.34, .028, .48), new THREE.MeshStandardMaterial({ color: 0xb9672d, roughness: .46 })); flat.position.y = -.012; flat.castShadow = true; g.add(flat);
      // 빨간 점 대신 앞면에 나뭇결처럼 보이는 짙은 갈색 인레이 무늬를 새긴다.
      const pattern = new THREE.Group(); const ink = new THREE.MeshStandardMaterial({ color: 0x5d2814, roughness: .5 });
      for (const x of [-.34, 0, .34]) { const groove = new THREE.Mesh(new THREE.BoxGeometry(.17, .022, .105), ink); groove.position.set(x, .242, .045); groove.rotation.y = x === 0 ? 0 : (x < 0 ? -.22 : .22); groove.castShadow = true; pattern.add(groove); }
      g.add(pattern);
      // X 표시는 빽도 전용 윷(첫 번째 막대)의 뒷면에만 있다.
      if (i === 0) for (const angle of [-.62, .62]) { const mark = new THREE.Mesh(new THREE.BoxGeometry(.48, .026, .052), new THREE.MeshStandardMaterial({ color: 0x7c211a, roughness: .4 })); mark.position.set(0, -.035, 0); mark.rotation.y = angle; g.add(mark); }
      g.scale.setScalar(1.52); scene.add(g); sticks.push(g); }
    const start = [[-2.8,1.4],[-1.5,1.8],[1.4,1.6],[2.7,1.3]]; let frame = 0; const began = performance.now(), duration = data?.result === "NAK" ? 2700 : 2550;
    const draw = (now: number) => { const t = Math.min(1, (now - began) / duration); sticks.forEach((g, i) => { const targetX = data?.result === "NAK" && i === 3 ? 4.5 : end[i][0], targetZ = data?.result === "NAK" && i === 3 ? -1.7 : end[i][1], p = easeOut(t), bounce = t < .66 ? Math.sin((t / .66) * Math.PI) * 2.7 : Math.max(0, .34 * Math.sin((t - .66) * 42) * (1 - t) * 4), settle = easeOut(Math.max(0, (t - .64) / .36)); g.position.set(THREE.MathUtils.lerp(start[i][0], targetX, p), .46 + bounce, THREE.MathUtils.lerp(start[i][1], targetZ, p)); const faceUp = data?.sticks[i] ?? true, finalX = faceUp ? .02 : Math.PI; g.rotation.set(THREE.MathUtils.lerp(7.5 + i, finalX, settle), THREE.MathUtils.lerp(t * (14 + i * 2), i * .82, settle), THREE.MathUtils.lerp(i * .8, 0, settle)); g.children[2].visible = faceUp; for (let n = 3; n < g.children.length; n++) g.children[n].visible = !faceUp; }); renderer.render(scene, camera); if (t < 1) frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw); const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); host.replaceChildren(); };
  }, [data?.rollId]);
  return <div className="yut-three" ref={mount} aria-label="3D 윷 던지기 애니메이션" />;
}

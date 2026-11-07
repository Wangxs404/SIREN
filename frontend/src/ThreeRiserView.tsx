import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type Point = [number, number, number];

export default function ThreeRiserView({ positions, length, diameter }: { positions: Point[]; length: number; diameter: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pipeRef = useRef<THREE.Mesh | null>(null);
  const topRef = useRef<THREE.Mesh | null>(null);
  const bottomRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8eef3");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(8, 4.4, 8);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "可交互三维立管视图，拖拽旋转，滚轮缩放");
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc7d2dc, 2.05));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8fb6d5, 1.1);
    fillLight.position.set(-5, 1, -4);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(8, 20, 0xb4c0ca, 0xd7e0e7);
    grid.position.y = -3.08;
    scene.add(grid);
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x7e8b96, transparent: true, opacity: 0.75 });
    for (const y of [-3, 3]) {
      const boundary = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.7, y, 0), new THREE.Vector3(2.7, y, 0)]), boundaryMaterial);
      scene.add(boundary);
    }
    scene.add(new THREE.AxesHelper(0.7));

    const pipe = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x3979a8, metalness: 0.34, roughness: 0.3 }));
    scene.add(pipe);
    pipeRef.current = pipe;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshStandardMaterial({ color: 0xd27a28, metalness: 0.15, roughness: 0.38 }));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 14), new THREE.MeshStandardMaterial({ color: 0x586675, metalness: 0.18, roughness: 0.42 }));
    scene.add(top, bottom);
    topRef.current = top;
    bottomRef.current = bottom;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 5;
    controls.maxDistance = 16;
    controls.update();

    const resize = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resize.observe(host);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.GridHelper || object instanceof THREE.AxesHelper) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      pipeRef.current = null;
      topRef.current = null;
      bottomRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pipe = pipeRef.current;
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!pipe || !top || !bottom) return;
    const valid = positions.length > 1 ? positions : [[0, 0, 0], [0.12, 0.12, length * 0.2], [0.2, 0.08, length * 0.42], [0.14, 0.04, length * 0.7], [0, 0, length]] as Point[];
    const maxDisplacement = Math.max(0.001, ...valid.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
    const displacementScale = Math.min(55, 1.05 / maxDisplacement);
    const points = valid.map(([x, y, z]) => new THREE.Vector3(x * displacementScale, (z / Math.max(length, 0.001) - 0.5) * 6, -y * displacementScale));
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const radius = Math.max(0.025, Math.min(0.055, (diameter / Math.max(length, 0.001)) * 3));
    const geometry = new THREE.TubeGeometry(curve, Math.max(72, points.length * 5), radius, 12, false);
    pipe.geometry.dispose();
    pipe.geometry = geometry;
    bottom.position.copy(points[0]);
    top.position.copy(points[points.length - 1]);
  }, [positions, length, diameter]);

  return <div className="three-view" ref={hostRef}><div className="three-caption"><span>3D MODEL</span><b>位移放大显示</b></div><div className="three-hint">拖拽旋转　·　滚轮缩放　·　右键平移</div><div className="three-axis"><i>X</i><i>Y</i><i>Z</i></div></div>;
}

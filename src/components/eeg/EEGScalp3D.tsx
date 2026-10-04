import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useNeuro } from '../../context/NeuroContext';
import { RotateCcw } from 'lucide-react';

// Standard 10-20 / 10-10 calibrated scalp locations for top-view anatomical arrangement
// x: Left (-) to Right (+), z: Front (-) to Back (+), y: Superior / Crown height (+)
const STANDARD_1020_COORDS: Record<string, { x: number; y: number; z: number }> = {
  // Row 1: Front / Prefrontal
  FPZ:  { x:  0.0,  y: 0.95, z: -4.30 },
  FP1:  { x: -1.45, y: 1.05, z: -4.10 },
  FP2:  { x:  1.45, y: 1.05, z: -4.10 },

  // Row 2: Anterior-Frontal
  AF7:  { x: -3.05, y: 1.45, z: -3.20 },
  AF3:  { x: -1.65, y: 1.95, z: -3.35 },
  AFZ:  { x:  0.0,  y: 2.25, z: -3.40 },
  AF4:  { x:  1.65, y: 1.95, z: -3.35 },
  AF8:  { x:  3.05, y: 1.45, z: -3.20 },

  // Row 3: Frontal
  F7:   { x: -3.85, y: 1.65, z: -2.15 },
  F5:   { x: -2.85, y: 2.25, z: -2.25 },
  F3:   { x: -1.85, y: 2.75, z: -2.30 },
  F1:   { x: -0.90, y: 2.95, z: -2.30 },
  FZ:   { x:  0.0,  y: 3.05, z: -2.30 },
  F2:   { x:  0.90, y: 2.95, z: -2.30 },
  F4:   { x:  1.85, y: 2.75, z: -2.30 },
  F6:   { x:  2.85, y: 2.25, z: -2.25 },
  F8:   { x:  3.85, y: 1.65, z: -2.15 },

  // Row 4: Fronto-Central
  FT7:  { x: -4.25, y: 1.80, z: -1.10 },
  FC5:  { x: -3.35, y: 2.45, z: -1.15 },
  FC3:  { x: -2.25, y: 2.95, z: -1.15 },
  FC1:  { x: -1.10, y: 3.25, z: -1.15 },
  FCZ:  { x:  0.0,  y: 3.35, z: -1.15 },
  FC2:  { x:  1.10, y: 3.25, z: -1.15 },
  FC4:  { x:  2.25, y: 2.95, z: -1.15 },
  FC6:  { x:  3.35, y: 2.45, z: -1.15 },
  FT8:  { x:  4.25, y: 1.80, z: -1.10 },

  // Row 5: Central (Coronal Midline)
  T7:   { x: -4.40, y: 1.85, z:  0.00 },
  C5:   { x: -3.45, y: 2.55, z:  0.00 },
  C3:   { x: -2.35, y: 3.15, z:  0.00 },
  C1:   { x: -1.15, y: 3.45, z:  0.00 },
  CZ:   { x:  0.0,  y: 3.55, z:  0.00 }, // Vertex / center
  C2:   { x:  1.15, y: 3.45, z:  0.00 },
  C4:   { x:  2.35, y: 3.15, z:  0.00 },
  C6:   { x:  3.45, y: 2.55, z:  0.00 },
  T8:   { x:  4.40, y: 1.85, z:  0.00 },

  // Row 6: Centro-Parietal
  TP7:  { x: -4.25, y: 1.80, z:  1.10 },
  CP5:  { x: -3.35, y: 2.45, z:  1.15 },
  CP3:  { x: -2.25, y: 2.95, z:  1.15 },
  CP1:  { x: -1.10, y: 3.25, z:  1.15 },
  CPZ:  { x:  0.0,  y: 3.35, z:  1.15 },
  CP2:  { x:  1.10, y: 3.25, z:  1.15 },
  CP4:  { x:  2.25, y: 2.95, z:  1.15 },
  CP6:  { x:  3.35, y: 2.45, z:  1.15 },
  TP8:  { x:  4.25, y: 1.80, z:  1.10 },

  // Row 7: Parietal
  P7:   { x: -3.85, y: 1.65, z:  2.15 },
  P5:   { x: -2.85, y: 2.25, z:  2.25 },
  P3:   { x: -1.85, y: 2.75, z:  2.30 },
  P1:   { x: -0.90, y: 2.95, z:  2.30 },
  PZ:   { x:  0.0,  y: 3.05, z:  2.30 },
  P2:   { x:  0.90, y: 2.95, z:  2.30 },
  P4:   { x:  1.85, y: 2.75, z:  2.30 },
  P6:   { x:  2.85, y: 2.25, z:  2.25 },
  P8:   { x:  3.85, y: 1.65, z:  2.15 },

  // Row 8: Parieto-Occipital
  PO7:  { x: -3.05, y: 1.45, z:  3.20 },
  PO3:  { x: -1.65, y: 1.95, z:  3.35 },
  POZ:  { x:  0.0,  y: 2.25, z:  3.40 },
  PO4:  { x:  1.65, y: 1.95, z:  3.35 },
  PO8:  { x:  3.05, y: 1.45, z:  3.20 },

  // Row 9: Occipital / Back
  O1:   { x: -1.45, y: 1.05, z:  4.10 },
  OZ:   { x:  0.0,  y: 0.95, z:  4.25 },
  O2:   { x:  1.45, y: 1.05, z:  4.10 },

  // Inion
  IZ:   { x:  0.0,  y: 0.45, z:  4.50 },
};

// Canvas texture generator for clean channel text labels
function createLabelSprite(text: string, isSelected: boolean, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 24px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isSelected) {
    ctx.shadowColor = '#00f5a0';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#bfe5ff';
  }

  ctx.fillText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.1, 0.55, 1.0);
  return sprite;
}

// Halo circular texture for glowing node bloom
function createGlowTexture(colorStr: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, colorStr);
  grad.addColorStop(0.35, colorStr);
  grad.addColorStop(0.7, 'rgba(0, 212, 255, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export const EEGScalp3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    channels,
    selectedChannel,
    setSelectedChannel,
    is3D,
    setIs3D,
    cameraView,
    setCameraView,
    uploadedFileName,
    uploadedFile,
    subject,
    recording,
  } = useNeuro();

  const currentInputFile =
    uploadedFileName ||
    uploadedFile?.name ||
    `${subject}${recording}.edf`;

  const [hoveredChannel, setHoveredChannel] = useState<{
    name: string;
    index: number;
    status: string;
    x: number;
    y: number;
  } | null>(null);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const electrodeGroupRef = useRef<THREE.Group | null>(null);
  const headMeshGroupRef = useRef<THREE.Group | null>(null);
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 14.5, 0.01));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  // Map channels to 3D anatomical scalp positions
  const electrodePositions = useMemo(() => {
    return channels.map(ch => {
      const upper = ch.name.toUpperCase();
      let pos = STANDARD_1020_COORDS[upper];

      if (!pos) {
        // Fallback to coordinates normalized to cranium surface
        const rawV = new THREE.Vector3(ch.x, ch.z, -ch.y);
        if (rawV.length() === 0) rawV.set(0, 1, 0);
        rawV.normalize().multiplyScalar(4.5);
        pos = {
          x: rawV.x * 0.95,
          y: Math.max(0.5, rawV.y * 0.7 + 1.8),
          z: rawV.z * 1.12,
        };
      }

      return {
        ...ch,
        pos3D: new THREE.Vector3(pos.x, pos.y, pos.z),
      };
    });
  }, [channels]);

  // Handle Camera view presets
  useEffect(() => {
    if (!cameraRef.current) return;
    if (cameraView === 'top') {
      targetCameraPos.current.set(0, 14.5, 0.01);
      targetLookAt.current.set(0, 0, 0);
    } else if (cameraView === 'front') {
      targetCameraPos.current.set(0, 2.0, -14.5);
      targetLookAt.current.set(0, 1.2, 0);
    } else if (cameraView === 'left') {
      targetCameraPos.current.set(-14.5, 2.0, 0);
      targetLookAt.current.set(0, 1.2, 0);
    } else if (cameraView === 'right') {
      targetCameraPos.current.set(14.5, 2.0, 0);
      targetLookAt.current.set(0, 1.2, 0);
    } else if (cameraView === 'reset') {
      targetCameraPos.current.set(0, 14.5, 0.01);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [cameraView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // CAMERA (Top-view perspective default)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 14.5, 0.01);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // LIGHTING (Clean, high-end scientific lighting)
    const ambientLight = new THREE.AmbientLight(0x0a1e38, 3.0);
    scene.add(ambientLight);

    // Top Key Light
    const topKey = new THREE.DirectionalLight(0xa5f3fc, 2.8);
    topKey.position.set(0, 25, 0);
    scene.add(topKey);

    // Anterior Rim Light (Nasion)
    const nasionRim = new THREE.PointLight(0x00d4ff, 3.2, 35);
    nasionRim.position.set(0, 5, -14);
    scene.add(nasionRim);

    // Lateral Left / Right Rim Lights
    const leftRim = new THREE.PointLight(0x38bdf8, 2.0, 30);
    leftRim.position.set(-12, 4, 0);
    scene.add(leftRim);

    const rightRim = new THREE.PointLight(0x38bdf8, 2.0, 30);
    rightRim.position.set(12, 4, 0);
    scene.add(rightRim);

    // Posterior Inion Fill
    const inionFill = new THREE.PointLight(0x1e3a8a, 1.8, 30);
    inionFill.position.set(0, 2, 14);
    scene.add(inionFill);

    // ── ANATOMICALLY BELIEVABLE TRANSLUCENT HEAD / SCALP ───────
    const headGroup = new THREE.Group();
    headMeshGroupRef.current = headGroup;
    scene.add(headGroup);

    // 1. High-subdivision Anatomical Cranial Surface
    const headGeo = new THREE.SphereGeometry(4.55, 72, 72);
    const posAttr = headGeo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      // Cranial oval elongation (dolichocephalic index ~0.78)
      z *= 1.15;
      x *= 0.95;

      // Forehead tapering anteriorly (z < 0)
      if (z < 0) {
        const frontalTaper = 1.0 - Math.abs(z / 5.2) * 0.09;
        x *= frontalTaper;
      } else {
        // Biparietal expansion (widest at parietal lobes)
        const parietalFactor = 1.0 + Math.sin(Math.min(Math.PI, (z / 4.8) * Math.PI)) * 0.045;
        x *= parietalFactor;
      }

      // Anatomical Nasion / Nose Protrusion (pointing front / -z)
      if (z < -3.8 && Math.abs(x) < 0.9 && y > -1.2 && y < 1.2) {
        const dist = Math.sqrt(x * x * 2.8 + Math.pow(y + 0.1, 2));
        const factor = Math.max(0, 1.0 - dist / 0.95);
        z -= factor * 1.05; // Prominent smooth nasion apex
      }

      // Auricles (Left and Right Ears on lateral equator)
      if (Math.abs(x) > 3.7 && Math.abs(z - 0.1) < 1.1 && Math.abs(y) < 1.1) {
        const earDist = Math.sqrt(Math.pow(z - 0.1, 2) + y * y);
        const earFactor = Math.max(0, 1.0 - earDist / 1.1);
        x += (x > 0 ? 1 : -1) * earFactor * 0.42;
      }

      // Natural Cranial Crown flattening
      if (y > 0) {
        y = Math.pow(y / 4.55, 0.92) * 3.65;
      } else {
        // Inferior cranial taper
        const neckTaper = 1.0 + (y / 4.55) * 0.32;
        x *= Math.max(0.68, neckTaper);
        z *= Math.max(0.68, neckTaper);
      }

      posAttr.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();

    // Silky Translucent Scientific Scalp Material (NO WIREFRAME MESH)
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x051a33,
      roughness: 0.18,
      metalness: 0.08,
      transmission: 0.65,
      opacity: 0.72,
      transparent: true,
      ior: 1.35,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headGroup.add(headMesh);

    // 2. Soft Inner Bio-Depth Core (gives authentic translucent head volume)
    const innerGeo = new THREE.SphereGeometry(3.6, 36, 36);
    innerGeo.scale(0.92, 0.68, 1.08);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x011b38,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    innerCore.position.set(0, 0.8, 0);
    headGroup.add(innerCore);

    // 3. Subtle 10-20 Concentric Reference Latitude Isobars
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.20,
    });

    const ringRadii = [
      { rx: 1.4, rz: 1.6, y: 3.45 }, // Central ring around Cz
      { rx: 2.6, rz: 3.0, y: 2.85 }, // Fronto-Central / Centro-Parietal ring
      { rx: 3.7, rz: 4.2, y: 2.05 }, // Frontal / Parietal ring
      { rx: 4.4, rz: 5.0, y: 1.15 }, // Outer 10-20 Perimeter contour
    ];

    ringRadii.forEach(({ rx, rz, y }) => {
      const pts: THREE.Vector3[] = [];
      const segments = 64;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        // Apply slight forehead taper to reference rings
        const taper = Math.sin(theta) < 0 ? 0.95 : 1.02;
        pts.push(new THREE.Vector3(
          Math.cos(theta) * rx * taper,
          y + Math.cos(theta * 2) * 0.1,
          Math.sin(theta) * rz
        ));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const ringLine = new THREE.Line(ringGeo, lineMat);
      headGroup.add(ringLine);
    });

    // 4. Subtle Longitudinal Midline (Nasion -> Fpz -> Fz -> Cz -> Pz -> Oz -> Inion)
    const midPts: THREE.Vector3[] = [];
    for (let z = -5.1; z <= 4.8; z += 0.25) {
      const normZ = z / 4.8;
      const y = Math.max(0.6, 3.55 - normZ * normZ * 2.8);
      midPts.push(new THREE.Vector3(0, y, z));
    }
    const midGeo = new THREE.BufferGeometry().setFromPoints(midPts);
    const midLine = new THREE.Line(midGeo, new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.25,
    }));
    headGroup.add(midLine);

    // 5. Subtle Coronal Meridian (T7 -> C3 -> Cz -> C4 -> T8)
    const corPts: THREE.Vector3[] = [];
    for (let x = -4.5; x <= 4.5; x += 0.25) {
      const normX = x / 4.4;
      const y = Math.max(1.0, 3.55 - normX * normX * 1.8);
      corPts.push(new THREE.Vector3(x, y, 0));
    }
    const corGeo = new THREE.BufferGeometry().setFromPoints(corPts);
    const corLine = new THREE.Line(corGeo, new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.22,
    }));
    headGroup.add(corLine);

    // 6. Subtle Anatomical Nose Indicator Triangle (Front/Nasion)
    const nosePts = [
      new THREE.Vector3(-0.45, 1.0, -4.6),
      new THREE.Vector3( 0.0,  0.8, -5.3), // apex pointing forward
      new THREE.Vector3( 0.45, 1.0, -4.6),
    ];
    const noseLineGeo = new THREE.BufferGeometry().setFromPoints(nosePts);
    const noseOutline = new THREE.Line(noseLineGeo, new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.65,
    }));
    headGroup.add(noseOutline);

    // 7. Subtle Anatomical Ear Curves (Left & Right Auricles)
    [-1, 1].forEach(side => {
      const earPts: THREE.Vector3[] = [];
      for (let t = -Math.PI / 2; t <= Math.PI / 2; t += 0.2) {
        earPts.push(new THREE.Vector3(
          side * (4.45 + Math.cos(t) * 0.45),
          0.8 + Math.sin(t) * 0.5,
          Math.sin(t) * 0.3
        ));
      }
      const earLineGeo = new THREE.BufferGeometry().setFromPoints(earPts);
      const earLine = new THREE.Line(earLineGeo, new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.45,
      }));
      headGroup.add(earLine);
    });

    // ── ELECTRODE GROUP ─────────────────────────────────────────
    const electrodeGroup = new THREE.Group();
    electrodeGroupRef.current = electrodeGroup;
    scene.add(electrodeGroup);

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Orbit rotation in 3D mode
      if (isDragging.current && is3D) {
        const deltaX = e.clientX - prevMouse.current.x;
        const deltaY = e.clientY - prevMouse.current.y;
        headGroup.rotation.y += deltaX * 0.007;
        headGroup.rotation.x += deltaY * 0.007;
        electrodeGroup.rotation.y = headGroup.rotation.y;
        electrodeGroup.rotation.x = headGroup.rotation.x;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }

      // Check hover over electrode nodes
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(electrodeGroup.children, true);

      if (intersects.length > 0) {
        let obj: any = intersects[0].object;
        while (obj && !obj.userData?.channelName && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.channelName) {
          const ch = obj.userData;
          setHoveredChannel({
            name: ch.channelName,
            index: ch.channelIndex,
            status: ch.channelStatus,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredChannel(null);
      container.style.cursor = isDragging.current ? 'grabbing' : 'default';
    };

    const handlePointerUp = (e: MouseEvent) => {
      isDragging.current = false;
      container.style.cursor = 'default';

      // Check click selection
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(electrodeGroup.children, true);

      if (intersects.length > 0) {
        let obj: any = intersects[0].object;
        while (obj && !obj.userData?.channelName && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.channelName) {
          setSelectedChannel(obj.userData.channelName);
        }
      }
    };

    container.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // ── ANIMATION LOOP ────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera interpolation
      camera.position.lerp(targetCameraPos.current, 0.08);
      camera.lookAt(targetLookAt.current);

      // Pulsing glow animation for selected electrode ring
      if (electrodeGroupRef.current) {
        electrodeGroupRef.current.children.forEach((child: any) => {
          if (child.userData?.isSelected && child.userData.ring) {
            const scale = 1.0 + Math.sin(time * 4.5) * 0.18;
            child.userData.ring.scale.set(scale, scale, scale);
            if (child.userData.beacon) {
              const alpha = 0.5 + Math.sin(time * 4.5) * 0.35;
              child.userData.beacon.material.opacity = alpha;
            }
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Update electrode meshes, glow nodes, and channel text labels
  useEffect(() => {
    const group = electrodeGroupRef.current;
    if (!group) return;

    // Clear previous electrodes
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const sphereGeo = new THREE.SphereGeometry(0.16, 20, 20);
    const haloGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const ringGeo = new THREE.RingGeometry(0.28, 0.42, 32);

    electrodePositions.forEach(ch => {
      const isSelected = ch.name.toUpperCase() === selectedChannel.toUpperCase();
      const nodeGroup = new THREE.Group();
      nodeGroup.userData = {
        channelName: ch.name,
        channelIndex: ch.index,
        channelStatus: ch.status,
        isSelected,
      };

      // Scientific Color coding: clean = cyan (#00d4ff), artifact = coral (#ff3b5c), review = amber (#f59e0b)
      let colorHex = 0x00d4ff;
      let haloColor = 'rgba(0, 212, 255, 0.7)';
      if (ch.status === 'artifact') {
        colorHex = 0xff3b5c;
        haloColor = 'rgba(255, 59, 92, 0.75)';
      } else if (ch.status === 'review') {
        colorHex = 0xf59e0b;
        haloColor = 'rgba(245, 158, 11, 0.75)';
      }

      if (isSelected) {
        colorHex = 0x00f5a0; // Bright neon emerald for active selection
        haloColor = 'rgba(0, 245, 160, 0.9)';
      }

      // 1. Glowing spherical core
      const nodeMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const sphere = new THREE.Mesh(sphereGeo, nodeMat);
      nodeGroup.add(sphere);

      // 2. Soft radial luminous bloom disc (facing upwards / camera)
      const glowTex = createGlowTexture(haloColor);
      const haloMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      haloMesh.position.y = 0.02;
      nodeGroup.add(haloMesh);

      // 3. Selected channel beacon and pulsing ripple ring
      if (isSelected) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f5a0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        nodeGroup.add(ring);
        nodeGroup.userData.ring = ring;

        // Expanded active core
        const activeBeacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0x00f5a0, transparent: true, opacity: 0.95 })
        );
        nodeGroup.add(activeBeacon);
        nodeGroup.userData.beacon = activeBeacon;
      }

      // 4. Channel Label Text Sprite (Displayed right above electrode)
      const labelSprite = createLabelSprite(ch.name, isSelected, haloColor);
      labelSprite.position.set(0, 0.38, 0);
      nodeGroup.add(labelSprite);

      // Position node on scalp
      nodeGroup.position.copy(ch.pos3D);
      group.add(nodeGroup);
    });
  }, [electrodePositions, selectedChannel]);

  // Handle 2D vs 3D mode switch
  useEffect(() => {
    if (!is3D) {
      // 2D Mode: Locked to direct top-down view
      targetCameraPos.current.set(0, 14.5, 0.001);
      targetLookAt.current.set(0, 0, 0);
      if (headMeshGroupRef.current && electrodeGroupRef.current) {
        headMeshGroupRef.current.rotation.set(0, 0, 0);
        electrodeGroupRef.current.rotation.set(0, 0, 0);
      }
    }
  }, [is3D]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* Anatomical Compass Labels */}
      <div className="absolute top-2 text-[10px] font-mono tracking-widest text-cyan-400/80 font-bold uppercase pointer-events-none z-10">
        ▲ Front (Nasion)
      </div>
      <div className="absolute bottom-2 text-[10px] font-mono tracking-widest text-cyan-400/80 font-bold uppercase pointer-events-none z-10">
        ▼ Back (Inion)
      </div>
      <div className="absolute left-2 text-[10px] font-mono tracking-widest text-cyan-400/80 font-bold uppercase pointer-events-none z-10">
        ◀ Left
      </div>
      <div className="absolute right-2 text-[10px] font-mono tracking-widest text-cyan-400/80 font-bold uppercase pointer-events-none z-10">
        Right ▶
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Selected Channel Badge Pill on Scalp */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
        <div className="px-3 py-1 rounded-lg bg-black/60 border border-cyan-500/30 text-xs font-mono backdrop-blur-md flex items-center gap-2">
          <span className="text-gray-400">Selected:</span>
          <span className="text-cyan-300 font-bold">{selectedChannel}</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>

        {/* Active Input Placement Pill */}
        <div className="px-2.5 py-0.5 rounded-md bg-black/50 border border-white/10 text-[9px] font-mono backdrop-blur-md flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-gray-400">Placed for:</span>
          <span className="text-cyan-300 font-semibold">{currentInputFile}</span>
        </div>
      </div>

      {/* Controls Overlay: 2D/3D & Views */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {/* 2D / 3D Toggle */}
        <div className="flex rounded-lg bg-black/60 p-0.5 border border-cyan-500/30 backdrop-blur-md">
          <button
            onClick={() => setIs3D(false)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all cursor-pointer ${
              !is3D ? 'bg-cyan-500 text-black shadow-glow-cyan-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setIs3D(true)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all cursor-pointer ${
              is3D ? 'bg-cyan-500 text-black shadow-glow-cyan-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            3D
          </button>
        </div>

        {/* Camera Views */}
        <div className="flex items-center gap-1 rounded-lg bg-black/60 p-0.5 border border-cyan-500/30 backdrop-blur-md">
          <button
            onClick={() => setCameraView('top')}
            className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${
              cameraView === 'top' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Top View"
          >
            Top
          </button>
          <button
            onClick={() => setCameraView('front')}
            className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${
              cameraView === 'front' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Front View"
          >
            Front
          </button>
          <button
            onClick={() => setCameraView('left')}
            className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${
              cameraView === 'left' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Left View"
          >
            Left
          </button>
          <button
            onClick={() => setCameraView('right')}
            className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${
              cameraView === 'right' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Right View"
          >
            Right
          </button>
          <button
            onClick={() => setCameraView('reset')}
            className="p-1 rounded text-gray-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Reset Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredChannel && (
        <div
          className="absolute pointer-events-none z-30 px-2.5 py-1.5 rounded-lg bg-[#0b1628]/95 border border-cyan-400/60 shadow-2xl backdrop-blur-md text-xs font-mono transition-transform duration-75"
          style={{ left: `${hoveredChannel.x + 12}px`, top: `${hoveredChannel.y - 30}px` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">{hoveredChannel.name}</span>
            <span className="text-[10px] text-gray-400">(#{hoveredChannel.index})</span>
          </div>
          <div className="text-[10px] flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hoveredChannel.status === 'artifact'
                  ? 'bg-red-400'
                  : hoveredChannel.status === 'review'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span
              className={`capitalize ${
                hoveredChannel.status === 'artifact'
                  ? 'text-red-400 font-semibold'
                  : hoveredChannel.status === 'review'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {hoveredChannel.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

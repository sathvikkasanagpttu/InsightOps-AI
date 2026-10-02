import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function makeMetal(materialColor, roughness = 0.32, metalness = 0.78) {
  return new THREE.MeshStandardMaterial({ color: materialColor, roughness, metalness });
}

function placeCylinderBetween(mesh, start, end) {
  const startPoint = new THREE.Vector3(...start);
  const endPoint = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

export default function LampScene() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.sceneUnavailable = "true";
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080806, 0.045);
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.1, 80);
    camera.position.set(0, 1.45, 9.2);
    camera.lookAt(0, 1.15, 0);

    scene.add(new THREE.HemisphereLight(0xffdf98, 0x11120e, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffefc3, 2.2);
    keyLight.position.set(-3, 6, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xffbb18, 38, 12, 2);
    rimLight.position.set(-2.1, 2.5, 1.7);
    scene.add(rimLight);

    const lampRoot = new THREE.Group();
    lampRoot.position.set(-1.25, -1.0, 0);
    scene.add(lampRoot);

    const graphite = makeMetal(0x292923, 0.26, 0.82);
    const brass = makeMetal(0xb7891e, 0.27, 0.78);
    const innerGold = new THREE.MeshStandardMaterial({ color: 0xf6ca50, roughness: 0.3, metalness: 0.35, side: THREE.BackSide });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.06, 0.16, 64), graphite);
    base.position.y = 0.08;
    lampRoot.add(base);

    const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.025, 10, 64), brass);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.y = 0.15;
    lampRoot.add(baseRim);

    const weightedFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.15, 40), brass);
    weightedFoot.position.y = 0.23;
    lampRoot.add(weightedFoot);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.72, 24), brass);
    stem.position.set(0, 1.12, 0);
    lampRoot.add(stem);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 10, 32), graphite);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.91, 0);
    lampRoot.add(collar);

    const armPivot = new THREE.Group();
    armPivot.position.set(0, 1.9, 0);
    lampRoot.add(armPivot);

    const armStart = [0, 0, 0];
    const armEnd = [0.84, 0.92, 0];
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.052, 1, 20), brass);
    placeCylinderBetween(arm, armStart, armEnd);
    armPivot.add(arm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), graphite);
    elbow.position.set(...armEnd);
    armPivot.add(elbow);

    const shadeGroup = new THREE.Group();
    shadeGroup.position.set(...armEnd);
    armPivot.add(shadeGroup);

    const shadeOuterMaterial = makeMetal(0x29261a, 0.23, 0.88);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.77, 0.62, 64, 1, true), shadeOuterMaterial);
    shade.position.y = -0.12;
    shadeGroup.add(shade);

    const shadeInner = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.765, 0.61, 64, 1, true), innerGold);
    shadeInner.position.y = -0.12;
    shadeGroup.add(shadeInner);

    const shadeLowerRim = new THREE.Mesh(new THREE.TorusGeometry(0.765, 0.035, 12, 64), brass);
    shadeLowerRim.rotation.x = Math.PI / 2;
    shadeLowerRim.position.y = -0.43;
    shadeGroup.add(shadeLowerRim);

    const shadeUpperRim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 10, 64), brass);
    shadeUpperRim.rotation.x = Math.PI / 2;
    shadeUpperRim.position.y = 0.19;
    shadeGroup.add(shadeUpperRim);

    const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xffd75a, emissive: 0xffb900, emissiveIntensity: 5, roughness: 0.2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 24), bulbMaterial);
    bulb.position.y = -0.53;
    shadeGroup.add(bulb);

    const bulbStem = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.12, 24), graphite);
    bulbStem.position.y = -0.69;
    shadeGroup.add(bulbStem);

    const lampLight = new THREE.SpotLight(0xffd45b, 78, 13, Math.PI / 5.4, 0.62, 1.3);
    lampLight.position.set(0.05, -0.48, 0.04);
    lampLight.target.position.set(-0.05, -2.0, -0.15);
    shadeGroup.add(lampLight, lampLight.target);

    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf36, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 1.25, 2.5, 40, 1, true), beamMaterial);
    beam.position.set(0.02, -1.78, 0.02);
    shadeGroup.add(beam);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x13130f, roughness: 0.8, metalness: 0.15 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.02;
    scene.add(floor);

    const floorDisk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.58, 0.08, 64), makeMetal(0x292922, 0.3, 0.7));
    floorDisk.position.set(-1.25, -0.91, 0);
    scene.add(floorDisk);

    const fineLineMaterial = new THREE.MeshBasicMaterial({ color: 0x393628, transparent: true, opacity: 0.32 });
    for (let index = -5; index <= 5; index += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 15), fineLineMaterial);
      line.position.set(index * 0.9, -0.99, -3.5);
      scene.add(line);
    }

    const pointer = { x: 0, y: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    let startTime = 0;

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(host);

    const onPointerMove = event => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    host.addEventListener("pointermove", onPointerMove, { passive: true });

    const animate = timestamp => {
      frameId = requestAnimationFrame(animate);
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const motion = reducedMotion ? 0 : 1;
      armPivot.rotation.z = Math.sin(elapsed * 0.44) * 0.018 * motion + pointer.x * 0.025;
      shadeGroup.rotation.z = Math.sin(elapsed * 0.36 + 0.8) * 0.018 * motion - pointer.x * 0.035;
      lampRoot.rotation.y = -0.12 + pointer.x * 0.045;
      lampLight.intensity = 76 + Math.sin(elapsed * 1.5) * 2.2 * motion;
      beamMaterial.opacity = 0.04 + Math.sin(elapsed * 1.5) * 0.004 * motion;
      renderer.render(scene, camera);
    };
    animate(0);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="lamp-scene" ref={hostRef} aria-hidden="true"><div className="scene-fallback" /></div>;
}

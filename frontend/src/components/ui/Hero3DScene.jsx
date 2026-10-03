import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero3DScene - Lightweight, high-performance WebGL 3D Visualization
 * 
 * Features:
 * - Dynamic data constellation with floating nodes & pulsing connecting edges
 * - Rotating abstract multifaceted crystal core (icosahedron + glowing inner data cube)
 * - Undulating 3D analytical terrain / particle plane
 * - Interactive mouse parallax with smooth lerp damping
 * - Performance optimized: pauses on tab blur, caps DPR at 1.5, clean disposal
 * - Graceful fallback if WebGL is unsupported
 */
export default function Hero3DScene({ mode = "hero", className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect user reduced-motion preference and low-power mobile devices
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (prefersReducedMotion || isMobile) {
      if (container) container.dataset.webglFallback = "true";
      return;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (e) {
      if (container) container.dataset.webglUnavailable = "true";
      return;
    }

    const width = container.clientWidth || window.innerWidth || 800;
    const height = container.clientHeight || window.innerHeight || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100
    );

    if (mode === "hero") {
      camera.position.set(0, 1.2, 7.5);
    } else {
      // Ambient dashboard mode: slightly farther and higher
      camera.position.set(0, 2.5, 9.5);
    }
    camera.lookAt(0, 0, 0);

    // Subtle Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.5);
    scene.add(ambientLight);

    const primaryLight = new THREE.DirectionalLight(0x6366f1, 3.2); // Indigo glow
    primaryLight.position.set(5, 8, 5);
    scene.add(primaryLight);

    const accentLight = new THREE.DirectionalLight(0xe6c348, 2.0); // Warm gold accent
    accentLight.position.set(-6, -4, 4);
    scene.add(accentLight);

    const cyanRim = new THREE.PointLight(0x06b6d4, 4.0, 15);
    cyanRim.position.set(0, -2, 3);
    scene.add(cyanRim);

    // Group for all rotating data objects
    const dataGroup = new THREE.Group();
    scene.add(dataGroup);

    // 1. Central Abstract Geometric Analytics Crystal (Icosahedron Wireframe)
    const isHero = mode === "hero";
    const icoRadius = isHero ? 1.6 : 2.0;
    const icoGeo = new THREE.IcosahedronGeometry(icoRadius, 1);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      wireframe: true,
      transparent: true,
      opacity: isHero ? 0.35 : 0.18,
      roughness: 0.2,
      metalness: 0.9,
    });
    const icosahedron = new THREE.Mesh(icoGeo, icoMat);
    dataGroup.add(icosahedron);

    // Inner Glowing Core (Octahedron)
    const innerGeo = new THREE.OctahedronGeometry(icoRadius * 0.55, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xe6c348,
      emissive: 0xe6c348,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.8,
      wireframe: false,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    dataGroup.add(innerCore);

    // Outer Thin Orbit Ring
    const ringGeo = new THREE.TorusGeometry(icoRadius * 1.4, 0.015, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: isHero ? 0.45 : 0.2,
    });
    const orbitRing1 = new THREE.Mesh(ringGeo, ringMat);
    orbitRing1.rotation.x = Math.PI / 3;
    dataGroup.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(ringGeo, ringMat.clone());
    orbitRing2.material.color.setHex(0xe6c348);
    orbitRing2.rotation.x = -Math.PI / 4;
    orbitRing2.rotation.y = Math.PI / 5;
    dataGroup.add(orbitRing2);

    // 2. Dynamic Connected Graph Nodes & Edges
    const nodeCount = isHero ? 42 : 30;
    const nodePositions = [];
    const nodeGeometry = new THREE.SphereGeometry(0.045, 12, 12);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const nodes = [];

    const spreadRadius = isHero ? 3.4 : 4.5;
    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * spreadRadius + 0.8;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = {
        basePos: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
      };
      dataGroup.add(nodeMesh);
      nodes.push(nodeMesh);
      nodePositions.push(nodeMesh.position);
    }

    // Dynamic Line Connections between close nodes
    const maxConnections = 65;
    const lineIndices = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const d = nodePositions[i].distanceTo(nodePositions[j]);
        if (d < 1.7 && lineIndices.length < maxConnections * 2) {
          lineIndices.push(i, j);
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(lineIndices.length * 3);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: isHero ? 0.25 : 0.12,
    });
    const networkLines = new THREE.LineSegments(lineGeo, lineMat);
    dataGroup.add(networkLines);

    // 3. Particle Starfield / Data Dust
    const particleCount = isHero ? 160 : 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 16;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;

      // Color variation: cyan, indigo, amber
      const randColor = Math.random();
      if (randColor > 0.6) {
        particleColors[i * 3] = 0.90; // Gold
        particleColors[i * 3 + 1] = 0.76;
        particleColors[i * 3 + 2] = 0.28;
      } else if (randColor > 0.3) {
        particleColors[i * 3] = 0.39; // Indigo
        particleColors[i * 3 + 1] = 0.40;
        particleColors[i * 3 + 2] = 0.95;
      } else {
        particleColors[i * 3] = 0.02; // Cyan
        particleColors[i * 3 + 1] = 0.71;
        particleColors[i * 3 + 2] = 0.83;
      }
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: isHero ? 0.6 : 0.3,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Mouse Tracking with smooth interpolation
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.45;
      targetY = y * 0.35;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      // Smooth mouse follow (lerp)
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      // Rotate central crystal
      icosahedron.rotation.x = elapsed * 0.12 + mouseY * 0.5;
      icosahedron.rotation.y = elapsed * 0.16 + mouseX * 0.5;

      innerCore.rotation.x = -elapsed * 0.22;
      innerCore.rotation.y = elapsed * 0.28;

      orbitRing1.rotation.z = elapsed * 0.15;
      orbitRing2.rotation.z = -elapsed * 0.12;

      // Float data nodes subtly
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const { basePos, phase, speed } = node.userData;
        node.position.x = basePos.x + Math.sin(elapsed * speed + phase) * 0.08;
        node.position.y = basePos.y + Math.cos(elapsed * speed * 0.8 + phase) * 0.08;
        node.position.z = basePos.z + Math.sin(elapsed * speed * 1.2 + phase) * 0.08;
      }

      // Update lines between moving nodes
      const posAttr = networkLines.geometry.attributes.position;
      let lineIdx = 0;
      for (let k = 0; k < lineIndices.length; k += 2) {
        const n1 = nodes[lineIndices[k]];
        const n2 = nodes[lineIndices[k + 1]];
        if (n1 && n2) {
          posAttr.array[lineIdx * 3] = n1.position.x;
          posAttr.array[lineIdx * 3 + 1] = n1.position.y;
          posAttr.array[lineIdx * 3 + 2] = n1.position.z;

          posAttr.array[(lineIdx + 1) * 3] = n2.position.x;
          posAttr.array[(lineIdx + 1) * 3 + 1] = n2.position.y;
          posAttr.array[(lineIdx + 1) * 3 + 2] = n2.position.z;
          lineIdx += 2;
        }
      }
      posAttr.needsUpdate = true;

      // Slowly rotate particle field
      particlePoints.rotation.y = elapsed * 0.02;
      particlePoints.rotation.x = Math.sin(elapsed * 0.015) * 0.05;

      // Group drift & camera look
      dataGroup.position.x = mouseX * 0.8;
      dataGroup.position.y = mouseY * 0.6;

      try {
        renderer.render(scene, camera);
      } catch (e) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    animate();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);

      if (renderer) {
        try {
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        } catch (e) {
          // ignore clean up errors
        }
      }
    };
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={`hero-3d-scene ${className}`}
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div className="hero-3d-fallback" />
    </div>
  );
}

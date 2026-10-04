import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw } from "lucide-react";

export default function BusScene() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const el = host.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(9.5, 4.6, 9.8);
    camera.lookAt(0, 0.25, 0);

    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    el.appendChild(renderer.domElement);

    const coach = new THREE.Group();
    scene.add(coach);

    // ==========================================
    // 1. MATERIALS DEFINITION
    // ==========================================
    // Metallic Coach Paint (CityLink Midnight Navy)
    const bodyPaint = new THREE.MeshStandardMaterial({
      color: 0x091b2c,
      metalness: 0.85,
      roughness: 0.2,
    });

    // High-Tech Cyan Metallic Accent
    const accentCyan = new THREE.MeshStandardMaterial({
      color: 0x00d2ee,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x003e4d,
      emissiveIntensity: 0.5,
    });

    // Crisp Pearl White Ribbon
    const pearlWhite = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.5,
      roughness: 0.3,
    });

    // Matte Technical Trim (Bumpers, Skirts, Diffusers)
    const darkTrim = new THREE.MeshStandardMaterial({
      color: 0x070b10,
      metalness: 0.25,
      roughness: 0.65,
    });

    // Polished Chrome (Emblems, Mirrors, Grille Bars, Rims)
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xdde7ee,
      metalness: 0.95,
      roughness: 0.08,
    });

    // Deep Tinted Panoramic Privacy Glass
    const tintedGlass = new THREE.MeshStandardMaterial({
      color: 0x071522,
      metalness: 0.9,
      roughness: 0.05,
      transparent: true,
      opacity: 0.72,
    });

    // Windshield Curved Glass
    const windshieldGlass = new THREE.MeshStandardMaterial({
      color: 0x0b1a28,
      metalness: 0.85,
      roughness: 0.06,
      transparent: true,
      opacity: 0.62,
    });

    // Projector LED Headlights (Intense Crystal Glow)
    const ledHeadlight = new THREE.MeshStandardMaterial({
      color: 0xf0faff,
      emissive: 0x00e5ff,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    // DRL Daytime Running Light Strips
    const ledDrl = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00d2ee,
      emissiveIntensity: 4.0,
    });

    // Taillight Red LEDs
    const taillightRed = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xd50000,
      emissiveIntensity: 3.2,
    });

    // Amber Turn Indicators
    const amberLight = new THREE.MeshStandardMaterial({
      color: 0xff9100,
      emissive: 0xff6d00,
      emissiveIntensity: 2.8,
    });

    // Rubber Tire Material
    const rubberTire = new THREE.MeshStandardMaterial({
      color: 0x13171c,
      roughness: 0.88,
      metalness: 0.05,
    });

    // Machined Alloy Wheels
    const alloyRim = new THREE.MeshStandardMaterial({
      color: 0xa0aec0,
      metalness: 0.88,
      roughness: 0.2,
    });

    // Brake Discs & Calipers
    const brakeDisc = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.35,
    });
    const brakeCaliper = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.6,
      roughness: 0.3,
    });

    // Interior Warm Glow & Seats
    const interiorSeat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
    });
    const interiorHeadrest = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.5,
    });

    // Helper builders
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      parent = coach
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const cyl = (
      rt: number,
      rb: number,
      h: number,
      seg: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      parent = coach
    ) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // ==========================================
    // 2. COACH LOWER CHASSIS & LUGGAGE BAYS
    // ==========================================
    // Main lower fuselage
    box(8.8, 0.82, 2.34, 0, 0.08, 0, bodyPaint);

    // Dark aerodynamic lower side skirts
    box(8.84, 0.28, 2.36, 0, -0.34, 0, darkTrim);

    // Front Bumper Lower Chin Splitter
    box(0.75, 0.22, 2.36, 4.25, -0.36, 0, darkTrim);
    box(0.12, 0.08, 2.38, 4.62, -0.42, 0, accentCyan);

    // Rear Aerodynamic Bumper & Diffuser
    box(0.72, 0.32, 2.36, -4.3, -0.32, 0, darkTrim);
    box(0.15, 0.06, 1.8, -4.66, -0.4, 0, chrome);

    // Recessed Luggage Compartment Doors (curbside & roadside)
    for (const z of [-1.178, 1.178]) {
      // 4 luggage bay doors between front and rear axles
      for (let i = 0; i < 4; i++) {
        const lx = -0.7 + i * 0.95;
        // Door panel
        box(0.88, 0.58, 0.015, lx, -0.06, z, bodyPaint);
        // Recessed panel seam
        box(0.92, 0.62, 0.005, lx, -0.06, z * 0.995, darkTrim);
        // Chrome door latch handle
        box(0.12, 0.03, 0.02, lx, -0.28, z * 1.01, chrome);
      }
    }

    // ==========================================
    // 3. AERODYNAMIC FRONT NOSE & FASCIA
    // ==========================================
    // Front beveled nose wedge (aerodynamic transition)
    box(0.65, 0.88, 2.34, 4.35, 0.32, 0, bodyPaint);

    // Front Grille with Chrome Bars
    box(0.1, 0.34, 1.5, 4.7, 0.16, 0, darkTrim);
    for (let g = -0.08; g <= 0.08; g += 0.08) {
      box(0.12, 0.025, 1.42, 4.71, 0.16 + g, 0, chrome);
    }
    // Illuminated CityLink Winged Emblem
    box(0.14, 0.06, 0.28, 4.73, 0.16, 0, chrome);
    box(0.16, 0.03, 0.12, 4.74, 0.16, 0, accentCyan);

    // Dual Projector LED Headlight Assemblies
    for (const z of [-0.86, 0.86]) {
      // Dark headlight housing
      box(0.16, 0.22, 0.44, 4.68, 0.24, z, darkTrim);
      // Dual high-intensity projector lenses
      cyl(0.06, 0.06, 0.06, 16, 4.76, 0.25, z - 0.11, ledHeadlight).rotation.z = Math.PI / 2;
      cyl(0.06, 0.06, 0.06, 16, 4.76, 0.25, z + 0.11, ledHeadlight).rotation.z = Math.PI / 2;
      // Signature L-shaped glowing LED DRL light guide
      box(0.08, 0.03, 0.42, 4.76, 0.36, z, ledDrl);
      box(0.08, 0.18, 0.03, 4.76, 0.25, z + (z > 0 ? 0.2 : -0.2), ledDrl);
      // Corner amber indicator
      box(0.14, 0.12, 0.06, 4.66, 0.22, z + (z > 0 ? 0.25 : -0.25), amberLight);
    }

    // Lower Bumper Fog Lamps
    for (const z of [-0.82, 0.82]) {
      box(0.1, 0.09, 0.18, 4.65, -0.16, z, darkTrim);
      box(0.12, 0.05, 0.12, 4.67, -0.16, z, ledHeadlight);
    }

    // ==========================================
    // 4. PANORAMIC WINDSHIELD & DESTINATION SIGN
    // ==========================================
    // Curved/slanted front panoramic windshield
    const windshieldMesh = box(0.06, 1.48, 2.34, 4.12, 1.18, 0, windshieldGlass);
    windshieldMesh.rotation.z = -0.32; // Raked aerodynamic angle

    // Dual Black Windshield Wipers
    for (const z of [-0.45, 0.38]) {
      const wiper = box(0.03, 0.62, 0.025, 4.4, 0.72, z, darkTrim);
      wiper.rotation.z = -0.75;
    }

    // Overhead Digital Destination Display (Colombo - Kandy)
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 512;
    signCanvas.height = 96;
    const signCtx = signCanvas.getContext("2d")!;
    signCtx.fillStyle = "#050b12";
    signCtx.fillRect(0, 0, 512, 96);
    signCtx.fillStyle = "#00d2ee";
    signCtx.font = "bold 34px sans-serif";
    signCtx.textAlign = "center";
    signCtx.textBaseline = "middle";
    signCtx.fillText("◆ 01 EXP • COLOMBO - KANDY ◆", 256, 48);
    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
    const destSign = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.32), signMat);
    destSign.position.set(3.82, 1.84, 0);
    destSign.rotation.y = Math.PI / 2;
    coach.add(destSign);

    // ==========================================
    // 5. CABIN INTERIOR (VISIBLE THROUGH GLASS)
    // ==========================================
    // Cabin floor
    box(8.2, 0.08, 2.22, -0.15, 0.48, 0, darkTrim);

    // Driver cockpit
    box(0.35, 0.48, 0.35, 3.4, 0.74, -0.65, interiorSeat);
    box(0.25, 0.22, 0.1, 3.4, 1.04, -0.65, interiorHeadrest);
    // Steering column & wheel
    cyl(0.03, 0.03, 0.45, 12, 3.75, 0.76, -0.65, darkTrim).rotation.z = -0.65;
    const wheelTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.025, 8, 24),
      chrome
    );
    wheelTorus.position.set(3.62, 0.94, -0.65);
    wheelTorus.rotation.y = Math.PI / 2;
    wheelTorus.rotation.x = -0.55;
    coach.add(wheelTorus);
    // Dashboard console
    box(0.5, 0.32, 0.85, 3.75, 0.65, -0.65, darkTrim);

    // Passenger luxury high-back seating (6 double rows)
    for (let row = 0; row < 6; row++) {
      const rx = -3.4 + row * 1.05;
      for (const rz of [-0.68, 0.68]) {
        // Seat base & back
        box(0.42, 0.48, 0.62, rx, 0.76, rz, interiorSeat);
        // Twin headrest pillows
        box(0.18, 0.16, 0.26, rx, 1.06, rz - 0.14, interiorHeadrest);
        box(0.18, 0.16, 0.26, rx, 1.06, rz + 0.14, interiorHeadrest);
      }
    }

    // Overhead luggage racks & warm interior ceiling glow
    for (const rz of [-0.75, 0.75]) {
      box(7.6, 0.04, 0.45, -0.3, 1.62, rz, chrome);
    }
    // Warm interior ambient strip
    const interiorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 0.04, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffeedd })
    );
    interiorGlow.position.set(-0.3, 1.82, 0);
    coach.add(interiorGlow);

    // ==========================================
    // 6. PANORAMIC SIDE WINDOWS & SLANTED PILLARS
    // ==========================================
    // Continuous side glass panels
    for (const z of [-1.174, 1.174]) {
      // 6 panoramic side windows
      for (let w = 0; w < 6; w++) {
        const wx = -3.45 + w * 1.15;
        box(1.08, 0.98, 0.035, wx, 1.25, z, tintedGlass);
        // Vertical mullion divider
        box(0.07, 1.02, 0.045, wx + 0.56, 1.25, z, darkTrim);
      }

      // Modern forward-raked B-pillar slant (coach signature)
      const bPillar = box(0.18, 1.04, 0.05, 2.92, 1.25, z, bodyPaint);
      bPillar.rotation.y = 0;

      // Chrome upper roofline belt
      box(8.2, 0.04, 0.06, -0.4, 1.76, z, chrome);
      // Chrome lower waistline accent
      box(8.4, 0.04, 0.05, -0.3, 0.74, z, chrome);
    }

    // Curbside Passenger Entry Door (curbside z = 1.178)
    box(0.72, 1.65, 0.02, 3.42, 0.58, 1.18, darkTrim);
    box(0.58, 0.88, 0.03, 3.42, 1.12, 1.185, tintedGlass);
    // Door handle & step
    box(0.04, 0.16, 0.035, 3.12, 0.65, 1.19, chrome);

    // ==========================================
    // 7. AERODYNAMIC ROOF & CLIMATE CONTROL POD
    // ==========================================
    // Curved roof main deck
    box(8.8, 0.22, 2.34, -0.05, 1.88, 0, bodyPaint);
    box(8.4, 0.12, 2.24, -0.2, 1.98, 0, pearlWhite);

    // Front roof aerodynamic deflector dome
    box(0.9, 0.28, 2.2, 3.75, 1.84, 0, bodyPaint);

    // Rooftop Dual HVAC Climate Pod
    box(2.2, 0.26, 1.45, -0.35, 2.12, 0, bodyPaint);
    box(2.1, 0.06, 1.35, -0.35, 2.26, 0, darkTrim);
    // Twin circular cooling vents
    cyl(0.28, 0.28, 0.06, 24, -0.85, 2.28, 0, chrome);
    cyl(0.28, 0.28, 0.06, 24, 0.15, 2.28, 0, chrome);

    // Emergency Roof Escape Hatches
    box(0.65, 0.05, 0.65, 1.6, 2.05, 0, chrome);
    box(0.65, 0.05, 0.65, -2.1, 2.05, 0, chrome);

    // Rear Roof Aerodynamic Spoiler & Third Brake Light
    box(0.65, 0.16, 2.32, -4.4, 2.02, 0, bodyPaint);
    box(0.12, 0.04, 1.4, -4.68, 2.04, 0, taillightRed); // High-mount LED brake bar

    // Shark-fin GPS Telemetry Antenna
    const ant = box(0.22, 0.14, 0.06, 2.4, 2.08, 0, accentCyan);
    ant.rotation.z = -0.35;

    // ==========================================
    // 8. REAR FASCIA & LED TAILLIGHT CLUSTERS
    // ==========================================
    // Rear curved wall
    box(0.35, 1.75, 2.34, -4.45, 0.95, 0, bodyPaint);
    // Rear window
    box(0.04, 0.85, 2.1, -4.61, 1.32, 0, tintedGlass);

    // Vertical Multi-element LED Taillights
    for (const z of [-0.98, 0.98]) {
      // Taillight bezel
      box(0.08, 0.85, 0.26, -4.62, 0.45, z, darkTrim);
      // Red LED C-shaped running & brake cluster
      box(0.09, 0.42, 0.18, -4.64, 0.62, z, taillightRed);
      // Amber sequential turn indicator bar
      box(0.09, 0.14, 0.18, -4.64, 0.32, z, amberLight);
      // White LED reversing light
      box(0.09, 0.1, 0.18, -4.64, 0.18, z, ledHeadlight);
    }

    // Rear Engine Cooling Louvers
    for (let l = -0.06; l <= 0.22; l += 0.07) {
      box(0.08, 0.025, 1.35, -4.62, l, 0, darkTrim);
    }

    // Dual Chrome Exhaust Pipes
    for (const z of [-0.75, 0.75]) {
      cyl(0.07, 0.07, 0.15, 16, -4.62, -0.35, z, chrome).rotation.z = Math.PI / 2;
    }

    // Rear Registration Plate
    box(0.04, 0.14, 0.42, -4.64, -0.15, 0, pearlWhite);
    box(0.06, 0.03, 0.38, -4.64, -0.06, 0, ledHeadlight); // License illumination

    // ==========================================
    // 9. AERODYNAMIC SIDE COACH MIRRORS
    // ==========================================
    for (const z of [-1.38, 1.38]) {
      const armDir = z > 0 ? 1 : -1;
      // Tall curved aerodynamic mirror arm extending forward & out
      const arm = box(0.55, 0.05, 0.05, 3.85, 1.48, z * 0.9, bodyPaint);
      arm.rotation.y = armDir * 0.45;
      arm.rotation.z = -0.35;

      // Vertical mirror head housing
      box(0.14, 0.65, 0.22, 4.05, 1.32, z, darkTrim);
      // Reflective chrome mirror face
      box(0.03, 0.58, 0.18, 3.98, 1.32, z, chrome);
      // Integrated LED amber turn repeater on outer shell
      box(0.12, 0.03, 0.18, 4.12, 1.42, z, amberLight);
    }

    // ==========================================
    // 10. TRI-AXLE WHEEL & TIRE ASSEMBLIES (6 WHEELS)
    // ==========================================
    // 1 Front steering axle (x = 2.65), 2 Rear heavy axles (x = -1.95, x = -3.15)
    const wheelPositions = [
      { x: 2.65, z: 1.14 },
      { x: 2.65, z: -1.14 },
      { x: -1.95, z: 1.14 },
      { x: -1.95, z: -1.14 },
      { x: -3.15, z: 1.14 },
      { x: -3.15, z: -1.14 },
    ];

    const wheelMeshes: THREE.Group[] = [];

    wheelPositions.forEach(({ x, z }) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, -0.42, z);

      // Deep tread rubber tire
      const tireGeom = new THREE.CylinderGeometry(0.52, 0.52, 0.28, 36);
      const tireMesh = new THREE.Mesh(tireGeom, rubberTire);
      tireMesh.rotation.x = Math.PI / 2;
      tireMesh.castShadow = true;
      wheelGroup.add(tireMesh);

      // Machined Alloy Outer Rim
      const rimGeom = new THREE.CylinderGeometry(0.36, 0.36, 0.295, 24);
      const rimMesh = new THREE.Mesh(rimGeom, alloyRim);
      rimMesh.rotation.x = Math.PI / 2;
      wheelGroup.add(rimMesh);

      // 10-Spoke Alloy Wheel Pattern
      for (let s = 0; s < 10; s++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.035, 0.04),
          chrome
        );
        spoke.position.z = z > 0 ? 0.13 : -0.13;
        spoke.rotation.z = (s * Math.PI) / 5;
        wheelGroup.add(spoke);
      }

      // Center Chrome Hub Cap with Lug Nuts
      const hubGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.31, 16);
      const hubMesh = new THREE.Mesh(hubGeom, chrome);
      hubMesh.rotation.x = Math.PI / 2;
      wheelGroup.add(hubMesh);

      // Blue Performance Brake Caliper & Steel Disc inside
      const discGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20);
      const discMesh = new THREE.Mesh(discGeom, brakeDisc);
      discMesh.rotation.x = Math.PI / 2;
      discMesh.position.z = z > 0 ? -0.03 : 0.03;
      wheelGroup.add(discMesh);

      const caliperMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.16, 0.08),
        brakeCaliper
      );
      caliperMesh.position.set(0.18, 0.12, z > 0 ? -0.03 : 0.03);
      wheelGroup.add(caliperMesh);

      coach.add(wheelGroup);
      wheelMeshes.push(wheelGroup);

      // Recessed Wheel Arch Molding on Body
      const archMolding = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.64, 0.06, 24, 1, true, 0, Math.PI),
        darkTrim
      );
      archMolding.position.set(x, -0.42, z > 0 ? 1.18 : -1.18);
      archMolding.rotation.x = z > 0 ? Math.PI / 2 : -Math.PI / 2;
      coach.add(archMolding);
    });

    // ==========================================
    // 11. HIGH-RESOLUTION DYNAMIC SIDE LIVERY
    // ==========================================
    const liveryCanvas = document.createElement("canvas");
    liveryCanvas.width = 2048;
    liveryCanvas.height = 512;
    const lctx = liveryCanvas.getContext("2d")!;

    // Transparent background
    lctx.clearRect(0, 0, 2048, 512);

    // Dynamic aerodynamic cyan & silver speed swoops
    const grad = lctx.createLinearGradient(0, 256, 2048, 256);
    grad.addColorStop(0, "rgba(0, 210, 238, 0)");
    grad.addColorStop(0.25, "rgba(0, 210, 238, 0.85)");
    grad.addColorStop(0.65, "rgba(2, 132, 199, 0.95)");
    grad.addColorStop(1, "rgba(241, 245, 249, 0.9)");

    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.moveTo(150, 420);
    lctx.bezierCurveTo(700, 390, 1400, 220, 1980, 160);
    lctx.lineTo(2020, 220);
    lctx.bezierCurveTo(1450, 280, 750, 460, 200, 480);
    lctx.closePath();
    lctx.fill();

    // Bold "CITYLINK EXPRESS" typography
    lctx.fillStyle = "#ffffff";
    lctx.font = "900 110px 'SF Pro Display', Arial, sans-serif";
    lctx.letterSpacing = "6px";
    lctx.shadowColor = "rgba(0, 210, 238, 0.6)";
    lctx.shadowBlur = 18;
    lctx.fillText("CITYLINK  EXPRESS", 560, 310);

    // Subtitle badge
    lctx.shadowBlur = 0;
    lctx.fillStyle = "#00d2ee";
    lctx.font = "700 38px 'SF Pro Display', Arial, sans-serif";
    lctx.letterSpacing = "8px";
    lctx.fillText("PREMIUM LUXURY COACH  •  AIR SUSPENSION", 570, 375);

    // Fleet badge #46
    lctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    lctx.font = "800 52px monospace";
    lctx.fillText("#46", 1820, 310);

    const liveryTexture = new THREE.CanvasTexture(liveryCanvas);
    liveryTexture.anisotropy = 8;

    const liveryMat = new THREE.MeshBasicMaterial({
      map: liveryTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Curbside livery
    const liveryRight = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 1.15),
      liveryMat
    );
    liveryRight.position.set(-0.25, 0.08, 1.182);
    coach.add(liveryRight);

    // Roadside livery
    const liveryLeft = liveryRight.clone();
    liveryLeft.position.z = -1.182;
    liveryLeft.rotation.y = Math.PI;
    coach.add(liveryLeft);

    // ==========================================
    // 12. GROUND CONTACT SHADOW & LIGHTING
    // ==========================================
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.ShadowMaterial({ opacity: 0.48 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.94;
    ground.receiveShadow = true;
    scene.add(ground);

    // Soft contact ambient shadow directly beneath coach
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 512;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext("2d")!;
    const sgrad = sctx.createRadialGradient(256, 128, 20, 256, 128, 240);
    sgrad.addColorStop(0, "rgba(0, 0, 0, 0.72)");
    sgrad.addColorStop(0.5, "rgba(0, 0, 0, 0.42)");
    sgrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 512, 256);
    const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(9.8, 3.2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture,
        transparent: true,
        opacity: 0.85,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, -0.935, 0);
    scene.add(contactShadow);

    // Lighting setup
    scene.add(new THREE.HemisphereLight(0xa5e5ff, 0x071524, 3.4));

    const key = new THREE.DirectionalLight(0xd8f6ff, 5.2);
    key.position.set(6, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.bias = -0.0008;
    scene.add(key);

    const rim = new THREE.PointLight(0x00d2ee, 45, 22);
    rim.position.set(-5, 4, -5);
    scene.add(rim);

    const frontAccent = new THREE.PointLight(0xdcf8ff, 28, 14);
    frontAccent.position.set(6, 1.2, 1);
    scene.add(frontAccent);

    // ==========================================
    // 13. MOUSE/POINTER DRAG & AUTO-ROTATION
    // ==========================================
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let targetRotationY = 0.55;
    let targetRotationX = 0.08;
    let velocityY = 0;
    let velocityX = 0;
    let lastInteractionTime = Date.now();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      setIsInteracting(true);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      velocityY = 0;
      velocityX = 0;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Fallback for browsers that don't support capture
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      const deltaY = dx * 0.0075;
      const deltaX = dy * 0.0045;

      targetRotationY += deltaY;
      targetRotationX = THREE.MathUtils.clamp(
        targetRotationX + deltaX,
        -0.32,
        0.45
      );

      velocityY = deltaY;
      velocityX = deltaX;
      lastInteractionTime = Date.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      setIsInteracting(false);
      lastInteractionTime = Date.now();
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(el);

    const updateCameraFit = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.aspect = aspect;

      // Responsive isometric distance based on container aspect ratio
      const baseDist = 14.0;
      let fitFactor = 1.0;
      if (aspect < 0.85) {
        fitFactor = 1.6 / aspect;
      } else if (aspect < 1.35) {
        fitFactor = 1.38 / Math.sqrt(aspect);
      } else if (aspect < 1.7) {
        fitFactor = 1.05;
      } else {
        fitFactor = 0.98;
      }

      const targetDist = baseDist * fitFactor;
      const dir = new THREE.Vector3(9.2, 4.3, 9.6).normalize();
      camera.position.copy(dir.multiplyScalar(targetDist));
      camera.lookAt(0, 0.15, 0);
      camera.updateProjectionMatrix();
    };

    const resize = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      updateCameraFit(w, h);
    });
    resize.observe(el);

    const onWinResize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        updateCameraFit(el.clientWidth, el.clientHeight);
      }
    };
    window.addEventListener("resize", onWinResize);

    // Initial size
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      updateCameraFit(el.clientWidth, el.clientHeight);
    }

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!visible) return;

      const now = Date.now();
      const idleTime = now - lastInteractionTime;

      if (!isDragging) {
        // Apply momentum with friction
        velocityY *= 0.92;
        velocityX *= 0.92;
        targetRotationY += velocityY;
        targetRotationX = THREE.MathUtils.clamp(
          targetRotationX + velocityX,
          -0.32,
          0.45
        );

        // Resume slow auto-rotation after 1.2s of inactivity
        if (idleTime > 1200) {
          targetRotationY += 0.0035;
        }
      }

      // Smooth interpolation for coach rotation
      coach.rotation.y = THREE.MathUtils.lerp(
        coach.rotation.y,
        targetRotationY,
        0.08
      );
      coach.rotation.x = THREE.MathUtils.lerp(
        coach.rotation.x,
        targetRotationX,
        0.08
      );

      // Subtle suspension breathing / hover float
      coach.position.y = Math.sin(now * 0.0018) * 0.035;

      renderer.render(scene, camera);
    };
    animate();

    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onWinResize);
      renderer.domElement.removeEventListener("webglcontextlost", lost);

      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      signTexture.dispose();
      liveryTexture.dispose();
      contactShadowTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className={`bus-scene ${isInteracting ? "is-dragging" : ""}`}
      ref={host}
      role="img"
      aria-label="Three-dimensional realistic CityLink luxury coach with interactive 360 degree rotation"
    >
      <div className="scene-drag-hint" aria-hidden="true">
        <RotateCcw size={13} className="spin-icon" />
        <span>Drag to rotate 360°</span>
      </div>
      {failed && (
        <div className="bus-fallback">
          <div className="bus-windows" />
          <strong>CITYLINK EXPRESS</strong>
          <i />
          <i />
        </div>
      )}
    </div>
  );
}

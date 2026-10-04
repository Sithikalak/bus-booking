import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  RotateCcw,
  Compass,
  Armchair,
  Layers,
  ArrowUp,
  Maximize2,
} from "lucide-react";
import type { Seat } from "../types";

interface BusInteriorSceneProps {
  seats: Seat[];
  selectedSeatIds: number[];
  onToggleSeat: (seat: Seat) => void;
  busy?: boolean;
}

export default function BusInteriorScene({
  seats,
  selectedSeatIds,
  onToggleSeat,
  busy = false,
}: BusInteriorSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activePreset, setActivePreset] = useState<"top" | "iso" | "aisle">(
    "top"
  );

  // Keep props in refs for Three.js render loop & event listeners
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  const selectedSeatIdsRef = useRef(selectedSeatIds);
  selectedSeatIdsRef.current = selectedSeatIds;

  const onToggleSeatRef = useRef(onToggleSeat);
  onToggleSeatRef.current = onToggleSeat;

  const busyRef = useRef(busy);
  busyRef.current = busy;

  // External camera animation function trigger
  const transitionCameraRef = useRef<
    ((pos: THREE.Vector3, lookAt: THREE.Vector3, preset: "top" | "iso" | "aisle") => void) | null
  >(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      100
    );

    // Initial position: start with a comfortable elevated 3D/Top angle
    camera.position.set(2.0, 8.5, 4.5);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // ==========================================
    // 1. ORBIT CONTROLS CONFIGURATION
    // ==========================================
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.55; // Controlled, smooth, won't spin wild
    controls.zoomSpeed = 0.75;
    controls.panSpeed = 0.6;

    // Allow full vertical tilt: from directly above looking down (0.04 rad)
    // to just above floor level (Math.PI/2 - 0.05 rad)
    controls.minPolarAngle = 0.04;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 3.2;
    controls.maxDistance = 15.0;
    controls.target.set(0, 0.35, 0);
    controls.update();

    // Smooth camera transition animation state
    let isTransitioning = false;
    const animStartPos = new THREE.Vector3();
    const animTargetPos = new THREE.Vector3();
    const animStartTarget = new THREE.Vector3();
    const animTargetLookAt = new THREE.Vector3();
    let animProgress = 0;

    transitionCameraRef.current = (
      targetPos: THREE.Vector3,
      targetLookAt: THREE.Vector3,
      preset: "top" | "iso" | "aisle"
    ) => {
      setActivePreset(preset);
      animStartPos.copy(camera.position);
      animTargetPos.copy(targetPos);
      animStartTarget.copy(controls.target);
      animTargetLookAt.copy(targetLookAt);
      animProgress = 0;
      isTransitioning = true;
    };

    // ==========================================
    // 2. LIGHTING SETUP
    // ==========================================
    const ambientLight = new THREE.AmbientLight(0xe0f2fe, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(5, 12, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    fillLight.position.set(-5, 9, -5);
    scene.add(fillLight);

    // Warm ambient point lights inside the cabin
    const interiorLightFront = new THREE.PointLight(0x00f5a0, 1.6, 8);
    interiorLightFront.position.set(3.6, 1.5, 0);
    scene.add(interiorLightFront);

    const interiorLightRear = new THREE.PointLight(0x38bdf8, 1.6, 8);
    interiorLightRear.position.set(-3.2, 1.5, 0);
    scene.add(interiorLightRear);

    // Coach group containing all bus geometry
    const coach = new THREE.Group();
    scene.add(coach);

    // ==========================================
    // 3. MATERIALS DEFINITION
    // ==========================================
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a121c,
      roughness: 0.45,
      metalness: 0.35,
    });

    const aisleRunnerMat = new THREE.MeshStandardMaterial({
      color: 0x111e2c,
      roughness: 0.65,
      metalness: 0.15,
    });

    const aisleStripMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x0099dd,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0c1824,
      roughness: 0.35,
      metalness: 0.75,
    });

    const dashboardMat = new THREE.MeshStandardMaterial({
      color: 0x080e14,
      roughness: 0.8,
      metalness: 0.2,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.9,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    // Seat dynamic materials
    const matAvailable = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.55,
      metalness: 0.25,
    });

    const matAvailableHeadrest = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.3,
    });

    const matSelected = new THREE.MeshStandardMaterial({
      color: 0x00f5a0,
      emissive: 0x00a86b,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.5,
    });

    const matSelectedHeadrest = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.6,
    });

    const matHeld = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.8,
      roughness: 0.5,
      metalness: 0.3,
    });

    const matBooked = new THREE.MeshStandardMaterial({
      color: 0x090d12,
      roughness: 0.85,
      metalness: 0.1,
    });

    const matPedestal = new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.8,
      metalness: 0.4,
    });

    // ==========================================
    // 4. BUS CHASSIS & CUTAWAY CABIN
    // ==========================================
    const coachLength = 9.2;
    const coachWidth = 2.7;

    // Floor Base
    const floorGeo = new THREE.BoxGeometry(coachLength, 0.18, coachWidth);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.09, 0);
    floorMesh.receiveShadow = true;
    coach.add(floorMesh);

    // Center aisle runner
    const aisleGeo = new THREE.BoxGeometry(coachLength - 1.2, 0.02, 0.46);
    const aisleMesh = new THREE.Mesh(aisleGeo, aisleRunnerMat);
    aisleMesh.position.set(-0.35, 0.01, 0);
    aisleMesh.receiveShadow = true;
    coach.add(aisleMesh);

    // Glowing LED Guide Strips along aisle edges
    for (const z of [-0.24, 0.24]) {
      const stripGeo = new THREE.BoxGeometry(coachLength - 1.2, 0.015, 0.025);
      const stripMesh = new THREE.Mesh(stripGeo, aisleStripMat);
      stripMesh.position.set(-0.35, 0.02, z);
      coach.add(stripMesh);
    }

    // Low Cutaway Side Walls with Window Sills
    for (const z of [-coachWidth / 2, coachWidth / 2]) {
      const wallGeo = new THREE.BoxGeometry(coachLength, 0.65, 0.08);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(0, 0.32, z);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      coach.add(wallMesh);

      // Low glass rail to simulate panoramic window
      const glassRailGeo = new THREE.BoxGeometry(coachLength - 1.4, 0.38, 0.02);
      const glassRail = new THREE.Mesh(glassRailGeo, glassMat);
      glassRail.position.set(-0.4, 0.8, z);
      coach.add(glassRail);
    }

    // Rear Wall & Emergency Exit
    const rearWallGeo = new THREE.BoxGeometry(0.08, 0.8, coachWidth);
    const rearWall = new THREE.Mesh(rearWallGeo, wallMat);
    rearWall.position.set(-coachLength / 2, 0.4, 0);
    coach.add(rearWall);

    // Front Cockpit Deck
    const frontDeckGeo = new THREE.BoxGeometry(1.2, 0.22, coachWidth);
    const frontDeck = new THREE.Mesh(frontDeckGeo, wallMat);
    frontDeck.position.set(coachLength / 2 - 0.6, 0.11, 0);
    coach.add(frontDeck);

    // Aerodynamic Curved Windshield Frame at Front
    const windshieldGeo = new THREE.BoxGeometry(0.05, 1.2, coachWidth);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(coachLength / 2, 0.65, 0);
    windshield.rotation.z = -0.22;
    coach.add(windshield);

    // Driver Dashboard Console
    const dashGeo = new THREE.BoxGeometry(0.65, 0.45, 1.1);
    const dash = new THREE.Mesh(dashGeo, dashboardMat);
    dash.position.set(coachLength / 2 - 0.45, 0.4, 0.65);
    coach.add(dash);

    // Driver Steering Column & Wheel
    const columnGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12);
    const column = new THREE.Mesh(columnGeo, chromeMat);
    column.position.set(coachLength / 2 - 0.72, 0.58, 0.65);
    column.rotation.z = -0.55;
    coach.add(column);

    const wheelGeo = new THREE.TorusGeometry(0.18, 0.024, 12, 28);
    const wheel = new THREE.Mesh(wheelGeo, dashboardMat);
    wheel.position.set(coachLength / 2 - 0.82, 0.74, 0.65);
    wheel.rotation.y = Math.PI / 2;
    wheel.rotation.x = 0.55;
    coach.add(wheel);

    // Driver Seat
    const driverSeatGeo = new THREE.BoxGeometry(0.42, 0.12, 0.42);
    const driverSeat = new THREE.Mesh(driverSeatGeo, matAvailable);
    driverSeat.position.set(coachLength / 2 - 1.1, 0.35, 0.65);
    coach.add(driverSeat);

    const driverBackGeo = new THREE.BoxGeometry(0.1, 0.52, 0.4);
    const driverBack = new THREE.Mesh(driverBackGeo, matAvailableHeadrest);
    driverBack.position.set(coachLength / 2 - 1.28, 0.65, 0.65);
    coach.add(driverBack);

    // Front Passenger Entry Step-Well
    const stepGeo = new THREE.BoxGeometry(0.55, 0.1, 0.85);
    const step = new THREE.Mesh(stepGeo, aisleRunnerMat);
    step.position.set(coachLength / 2 - 0.6, -0.05, -0.75);
    coach.add(step);

    // Chrome Grab Rail near door
    const grabPoleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.35, 12);
    const grabPole = new THREE.Mesh(grabPoleGeo, chromeMat);
    grabPole.position.set(coachLength / 2 - 0.9, 0.67, -0.4);
    coach.add(grabPole);

    // ==========================================
    // 5. INTERACTIVE PASSENGER SEATS
    // ==========================================
    const seatMeshMap = new Map<
      number,
      {
        seat: Seat;
        group: THREE.Group;
        cushion: THREE.Mesh;
        back: THREE.Mesh;
        headrest: THREE.Mesh;
        originalY: number;
      }
    >();

    const interactiveMeshes: THREE.Mesh[] = [];

    // Helper to generate seat number canvas texture
    const makeNumberTexture = (num: string, isSelected: boolean) => {
      const cvs = document.createElement("canvas");
      cvs.width = 128;
      cvs.height = 64;
      const ctx = cvs.getContext("2d")!;
      ctx.fillStyle = isSelected ? "#00f5a0" : "#1e293b";
      ctx.roundRect(4, 4, 120, 56, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isSelected ? "#ffffff" : "#38bdf8";
      ctx.stroke();

      ctx.font = "bold 26px sans-serif";
      ctx.fillStyle = isSelected ? "#05161e" : "#f8fafc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, 64, 34);

      const tex = new THREE.CanvasTexture(cvs);
      tex.needsUpdate = true;
      return tex;
    };

    const sortedSeats = [...seats].sort(
      (a, b) => a.row - b.row || a.column - b.column
    );

    sortedSeats.forEach((seat) => {
      const seatGroup = new THREE.Group();

      // Row mapping: Row 1 near front (+X = 2.6), Row 10 near back (-X = -3.88)
      const xPos = 2.6 - (seat.row - 1) * 0.72;

      // Column mapping:
      // Column 1 (Left Window): Z = -0.92
      // Column 2 (Left Aisle):  Z = -0.52
      // [Aisle: Z = 0]
      // Column 3 (Right Aisle): Z = 0.52
      // Column 4 (Right Window):Z = 0.92
      let zPos = 0;
      if (seat.column === 1) zPos = -0.92;
      else if (seat.column === 2) zPos = -0.52;
      else if (seat.column === 3) zPos = 0.52;
      else if (seat.column === 4) zPos = 0.92;
      else zPos = (seat.column - 2.5) * 0.55;

      const yBase = 0.0;
      seatGroup.position.set(xPos, yBase, zPos);

      // 1. Pedestal / Leg
      const legGeo = new THREE.BoxGeometry(0.08, 0.22, 0.08);
      const leg = new THREE.Mesh(legGeo, matPedestal);
      leg.position.set(0, 0.11, 0);
      seatGroup.add(leg);

      // 2. Seat Cushion Base
      const cushionGeo = new THREE.BoxGeometry(0.38, 0.1, 0.36);
      const isSelected = selectedSeatIdsRef.current.includes(seat.id);
      const curCushionMat = isSelected
        ? matSelected
        : seat.status === "BOOKED"
        ? matBooked
        : seat.status === "HELD"
        ? matHeld
        : matAvailable;

      const cushion = new THREE.Mesh(cushionGeo, curCushionMat);
      cushion.position.set(0, 0.26, 0);
      cushion.castShadow = true;
      cushion.receiveShadow = true;
      seatGroup.add(cushion);

      // 3. Ergonomic Curved Backrest (facing +X forward)
      const backGeo = new THREE.BoxGeometry(0.09, 0.44, 0.36);
      const curBackMat = isSelected
        ? matSelectedHeadrest
        : seat.status === "BOOKED"
        ? matBooked
        : seat.status === "HELD"
        ? matHeld
        : matAvailable;

      const back = new THREE.Mesh(backGeo, curBackMat);
      back.position.set(-0.16, 0.48, 0);
      back.rotation.z = 0.12;
      back.castShadow = true;
      seatGroup.add(back);

      // 4. Headrest
      const headGeo = new THREE.BoxGeometry(0.08, 0.14, 0.28);
      const curHeadMat = isSelected
        ? matSelected
        : seat.status === "BOOKED"
        ? matBooked
        : seat.status === "HELD"
        ? matHeld
        : matAvailableHeadrest;

      const headrest = new THREE.Mesh(headGeo, curHeadMat);
      headrest.position.set(-0.19, 0.74, 0);
      headrest.rotation.z = 0.12;
      headrest.castShadow = true;
      seatGroup.add(headrest);

      // 5. Armrest
      const armGeo = new THREE.BoxGeometry(0.24, 0.04, 0.04);
      const armMat = matPedestal;
      const armZ = seat.column % 2 === 0 ? 0.2 : -0.2;
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(0.02, 0.4, armZ);
      seatGroup.add(arm);

      // 6. Floating 3D Seat Label Badge
      const numTex = makeNumberTexture(seat.number, isSelected);
      const labelGeo = new THREE.PlaneGeometry(0.22, 0.11);
      const labelMat = new THREE.MeshBasicMaterial({
        map: numTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const numberLabel = new THREE.Mesh(labelGeo, labelMat);
      numberLabel.position.set(-0.24, 0.74, 0);
      numberLabel.rotation.y = -Math.PI / 2;
      seatGroup.add(numberLabel);

      // Associate clickable meshes with seat ID
      cushion.userData = { seatId: seat.id };
      back.userData = { seatId: seat.id };
      headrest.userData = { seatId: seat.id };

      interactiveMeshes.push(cushion, back, headrest);

      coach.add(seatGroup);

      seatMeshMap.set(seat.id, {
        seat,
        group: seatGroup,
        cushion,
        back,
        headrest,
        originalY: yBase,
      });
    });

    // ==========================================
    // 6. POINTER, RAYCASTING & SEAT CLICKING
    // ==========================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let pointerDownX = 0;
    let pointerDownY = 0;
    let isMouseDown = false;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      isMouseDown = true;
      isTransitioning = false; // Cancel preset animation on user drag
    };

    const updatePointerPos = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      updatePointerPos(e);

      if (!isMouseDown) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes);

        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const hitSeatId = hitMesh.userData.seatId as number;
          const found = seatsRef.current.find((s) => s.id === hitSeatId);

          if (found) {
            setHoveredSeat(found);
            const rect = container.getBoundingClientRect();
            setTooltipPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
            container.style.cursor =
              found.status === "AVAILABLE" ||
              selectedSeatIdsRef.current.includes(found.id)
                ? "pointer"
                : "not-allowed";
            return;
          }
        }

        setHoveredSeat(null);
        setTooltipPos(null);
        container.style.cursor = "default";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      isMouseDown = false;
      const moveDist = Math.hypot(
        e.clientX - pointerDownX,
        e.clientY - pointerDownY
      );

      // If dragged less than 6px, treat as intentional seat click!
      if (moveDist < 6 && !busyRef.current) {
        updatePointerPos(e);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes);

        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const hitSeatId = hitMesh.userData.seatId as number;
          const targetSeat = seatsRef.current.find((s) => s.id === hitSeatId);

          if (
            targetSeat &&
            (targetSeat.status === "AVAILABLE" ||
              selectedSeatIdsRef.current.includes(targetSeat.id))
          ) {
            onToggleSeatRef.current(targetSeat);
          }
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    // ==========================================
    // 7. ANIMATION & RENDER LOOP
    // ==========================================
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera preset interpolation
      if (isTransitioning) {
        animProgress += delta * 2.8; // ~0.35s snappy transition
        if (animProgress >= 1) {
          animProgress = 1;
          isTransitioning = false;
        }
        // Smooth sine ease in-out
        const ease = 0.5 - Math.cos(animProgress * Math.PI) / 2;
        camera.position.lerpVectors(animStartPos, animTargetPos, ease);
        controls.target.lerpVectors(animStartTarget, animTargetLookAt, ease);
      }

      controls.update();

      // Update seat selection hover/pulse animation
      seatMeshMap.forEach((item, seatId) => {
        const isSelected = selectedSeatIdsRef.current.includes(seatId);
        const isHovered = hoveredSeat?.id === seatId;

        if (isSelected) {
          // Floating pulse for selected seats
          const floatOffset = Math.sin(elapsed * 4 + seatId) * 0.02 + 0.04;
          item.group.position.y = THREE.MathUtils.lerp(
            item.group.position.y,
            item.originalY + floatOffset,
            0.15
          );

          (item.cushion.material as THREE.MeshStandardMaterial).emissiveIntensity =
            1.2 + Math.sin(elapsed * 5) * 0.4;
          (item.back.material as THREE.MeshStandardMaterial).emissiveIntensity =
            1.4 + Math.sin(elapsed * 5) * 0.4;

          item.cushion.material = matSelected;
          item.back.material = matSelectedHeadrest;
          item.headrest.material = matSelected;
        } else if (isHovered && item.seat.status === "AVAILABLE") {
          item.group.position.y = THREE.MathUtils.lerp(
            item.group.position.y,
            item.originalY + 0.035,
            0.2
          );
          item.cushion.material = matAvailableHeadrest;
        } else {
          item.group.position.y = THREE.MathUtils.lerp(
            item.group.position.y,
            item.originalY,
            0.15
          );
          if (item.seat.status === "BOOKED") {
            item.cushion.material = matBooked;
            item.back.material = matBooked;
            item.headrest.material = matBooked;
          } else if (item.seat.status === "HELD") {
            item.cushion.material = matHeld;
            item.back.material = matHeld;
            item.headrest.material = matHeld;
          } else {
            item.cushion.material = matAvailable;
            item.back.material = matAvailable;
            item.headrest.material = matAvailableHeadrest;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Quick preset angle switcher
  const handlePreset = (preset: "top" | "iso" | "aisle") => {
    if (!transitionCameraRef.current) return;

    if (preset === "top") {
      // Directly looking down from top side at the bus
      transitionCameraRef.current(
        new THREE.Vector3(0, 9.8, 0.001),
        new THREE.Vector3(0, 0.35, 0),
        "top"
      );
    } else if (preset === "iso") {
      // Classic 3D isometric perspective
      transitionCameraRef.current(
        new THREE.Vector3(5.8, 6.2, 5.2),
        new THREE.Vector3(0, 0.35, 0),
        "iso"
      );
    } else if (preset === "aisle") {
      // Looking down the aisle from front entrance
      transitionCameraRef.current(
        new THREE.Vector3(3.6, 1.45, 0),
        new THREE.Vector3(-3.2, 0.45, 0),
        "aisle"
      );
    }
  };

  return (
    <div className="bus-interior-container">
      {/* 3D WebGL Canvas Host */}
      <div
        className="bus-interior-canvas-host"
        ref={containerRef}
        aria-label="3D Interactive Bus Interior Cabin"
      />

      {/* Floating Hover Tooltip */}
      {hoveredSeat && tooltipPos && (
        <div
          className="seat-3d-tooltip"
          style={{
            left: `${tooltipPos.x + 16}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <div className="tooltip-header">
            <strong>Seat {hoveredSeat.number}</strong>
            <span
              className={`tooltip-status ${
                selectedSeatIds.includes(hoveredSeat.id)
                  ? "selected"
                  : hoveredSeat.status.toLowerCase()
              }`}
            >
              {selectedSeatIds.includes(hoveredSeat.id)
                ? "SELECTED"
                : hoveredSeat.status}
            </span>
          </div>
          <div className="tooltip-details">
            <span>
              {hoveredSeat.position.charAt(0) +
                hoveredSeat.position.slice(1).toLowerCase()}{" "}
              · {hoveredSeat.type}
            </span>
            <small>
              {selectedSeatIds.includes(hoveredSeat.id)
                ? "Click to deselect"
                : hoveredSeat.status === "AVAILABLE"
                ? "Click to select"
                : "Unavailable"}
            </small>
          </div>
        </div>
      )}

      {/* Orientation Indicator Badges */}
      <div className="scene-orientation-tag front">
        <ArrowUp size={12} />
        <span>FRONT (CABIN ENTRY)</span>
      </div>
      <div className="scene-orientation-tag rear">
        <span>REAR (EXIT)</span>
      </div>

      {/* 3D Scene Preset Controls & Instructions */}
      <div className="scene-toolbar">
        <div className="preset-buttons">
          <button
            type="button"
            className={`btn-tiny ${activePreset === "top" ? "active" : ""}`}
            onClick={() => handlePreset("top")}
            title="Direct top-down overhead view of all seats"
          >
            <Layers size={13} />
            Top View (Direct)
          </button>
          <button
            type="button"
            className={`btn-tiny ${activePreset === "iso" ? "active" : ""}`}
            onClick={() => handlePreset("iso")}
            title="3D Isometric perspective view"
          >
            <Compass size={13} />
            3D Angle
          </button>
          <button
            type="button"
            className={`btn-tiny ${activePreset === "aisle" ? "active" : ""}`}
            onClick={() => handlePreset("aisle")}
            title="Aisle passenger walkthrough POV"
          >
            <Armchair size={13} />
            Aisle POV
          </button>
          <button
            type="button"
            className="btn-tiny"
            onClick={() => handlePreset("top")}
            title="Reset to top orientation"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>

        <div className="scene-instruction">
          <RotateCcw size={12} className="spin-icon" />
          <span>Drag to orbit smoothly · Scroll to zoom · Click to select</span>
        </div>
      </div>
    </div>
  );
}

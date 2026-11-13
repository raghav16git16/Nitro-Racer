import * as THREE from 'three';
import type { CarSpec } from './types';

function hexToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function createVehicleLogoTexture(spec: CarSpec, maxAnisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);

    const neonCss = hexToCss(spec.neonColor);

    // Hexagonal crest badge
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const x = 128 + Math.cos(angle) * 96;
      const y = 128 + Math.sin(angle) * 96;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(7, 11, 25, 0.88)';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = neonCss;
    ctx.stroke();

    // Inner accent ring
    ctx.beginPath();
    ctx.arc(128, 128, 72, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();

    // Emblem tag text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((spec.logoText || 'NTR').toUpperCase(), 128, 132);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFloatingNameTag(nameText: string, colorHex = '#22d3ee'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(7, 11, 25, 0.88)';
    ctx.beginPath();
    ctx.roundRect(12, 8, 232, 48, 16);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText.toUpperCase().slice(0, 12), 128, 33);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

export function createRoadTexture(accentColor: number, maxAnisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    // Deep asphalt gradient
    ctx.fillStyle = '#0f1626';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle longitudinal asphalt grain
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(x, y, 2, 12);
    }

    const accentCss = hexToCss(accentColor);

    // Left & right neon highway shoulder lines
    ctx.fillStyle = accentCss;
    ctx.fillRect(14, 0, 10, 512);
    ctx.fillRect(488, 0, 10, 512);

    // 4-lane dashed dividers (3 divider columns at 25%, 50%, 75%)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    const cols = [128, 256, 384];
    cols.forEach((cx, idx) => {
      const isCenter = idx === 1;
      ctx.fillStyle = isCenter ? 'rgba(250, 204, 21, 0.85)' : 'rgba(226, 232, 240, 0.65)';
      for (let y = 16; y < 512; y += 96) {
        ctx.fillRect(cx - 4, y, 8, 52);
      }
    });
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFinishLineMesh(maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();

  // Checkered canvas banner
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const sq = 32;
    for (let y = 0; y < 128; y += sq) {
      for (let x = 0; x < 512; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#090d16';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
    ctx.fillRect(126, 36, 260, 56);
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 4;
    ctx.strokeRect(126, 36, 260, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', 256, 65);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  const pillarGeo = new THREE.BoxGeometry(0.65, 7.5, 0.65);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.7,
    roughness: 0.3,
  });
  const neonStripMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-8.6, 3.75, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(8.6, 3.75, 0);

  const stripGeo = new THREE.BoxGeometry(0.18, 7.2, 0.7);
  const stripL = new THREE.Mesh(stripGeo, neonStripMat);
  stripL.position.set(-8.6, 3.75, 0);
  const stripR = new THREE.Mesh(stripGeo, neonStripMat);
  stripR.position.set(8.6, 3.75, 0);

  const bannerGeo = new THREE.BoxGeometry(17.8, 2.2, 0.45);
  const bannerMat = new THREE.MeshBasicMaterial({ map: tex });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 6.6, 0);

  // Road checkered strip
  const groundStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(16.5, 2.4),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  groundStrip.rotation.x = -Math.PI / 2;
  groundStrip.position.set(0, 0.04, 0);

  group.add(leftPillar, rightPillar, stripL, stripR, banner, groundStrip);
  return group;
}

export function createHypercarMesh(
  carSpec: CarSpec,
  isTraffic = false,
  maxAnisotropy = 4
): THREE.Group {
  const group = new THREE.Group();
  // Pivot at rear axle for clean wheelie pitch
  const pivotGroup = new THREE.Group();
  pivotGroup.name = 'wheeliePivot';
  pivotGroup.position.set(0, 0, 1.8);
  group.add(pivotGroup);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: carSpec.primaryColor,
    metalness: 0.78,
    roughness: 0.22,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.65,
    roughness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x091324,
    metalness: 0.92,
    roughness: 0.08,
  });
  const neonMat = new THREE.MeshBasicMaterial({ color: carSpec.neonColor });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1e38 });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.15,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  });

  // 1. Lower sculpted chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.48, 4.45), bodyMat);
  chassis.position.set(0, 0.14, -1.8);
  chassis.castShadow = !isTraffic;
  pivotGroup.add(chassis);

  // 2. Front aero splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.1, 0.6), accentMat);
  splitter.position.set(0, -0.08, -3.85);
  pivotGroup.add(splitter);

  // 3. Rear diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 0.35), accentMat);
  diffuser.position.set(0, -0.02, 0.36);
  pivotGroup.add(diffuser);

  // 4. Aerodynamic cockpit cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.46, 2.05), glassMat);
  cabin.position.set(0, 0.56, -1.65);
  pivotGroup.add(cabin);

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 1.35), bodyMat);
  roof.position.set(0, 0.81, -1.55);
  pivotGroup.add(roof);

  // 5. Side skirts with neon trim
  const skirtGeo = new THREE.BoxGeometry(0.1, 0.12, 2.8);
  const skirtL = new THREE.Mesh(skirtGeo, neonMat);
  skirtL.position.set(-1.03, -0.04, -1.8);
  const skirtR = skirtL.clone();
  skirtR.position.x = 1.03;
  pivotGroup.add(skirtL, skirtR);

  // 6. Headlights & Taillights
  const lightGeo = new THREE.BoxGeometry(0.42, 0.1, 0.08);
  const hlL = new THREE.Mesh(lightGeo, headlightMat);
  hlL.position.set(-0.68, 0.22, -4.02);
  const hlR = hlL.clone();
  hlR.position.x = 0.68;

  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.11, 0.08), taillightMat);
  tlL.position.set(-0.66, 0.24, 0.43);
  const tlR = tlL.clone();
  tlR.position.x = 0.66;
  pivotGroup.add(hlL, hlR, tlL, tlR);

  // 7. 4 Wheels with metallic rims
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelOffsets: Array<[number, number, number]> = [
    [-1.02, -0.04, -3.12],
    [1.02, -0.04, -3.12],
    [-1.02, -0.04, -0.46],
    [1.02, -0.04, -0.46],
  ];
  wheelOffsets.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, wy, wz);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, wy, wz);
    pivotGroup.add(tire, rim);
  });

  // 8. Racing Hood Emblem & Customizable Livery Stripes
  if (!isTraffic) {
    const logoTex = createVehicleLogoTexture(carSpec, maxAnisotropy);
    const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true });
    const hoodLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), logoMat);
    hoodLogo.rotation.x = -Math.PI / 2 + 0.03;
    hoodLogo.position.set(0, 0.4, -3.05);
    pivotGroup.add(hoodLogo);

    const livery = carSpec.livery || 'twin';
    if (livery === 'twin') {
      const stripeGeo = new THREE.PlaneGeometry(0.14, 1.35);
      const stripeL = new THREE.Mesh(stripeGeo, neonMat);
      stripeL.rotation.x = -Math.PI / 2;
      stripeL.position.set(-0.56, 0.395, -3.05);
      const stripeR = stripeL.clone();
      stripeR.position.x = 0.56;
      pivotGroup.add(stripeL, stripeR);
    } else if (livery === 'center') {
      const centerStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.4), neonMat);
      centerStripe.rotation.x = -Math.PI / 2;
      centerStripe.position.set(0, 0.394, -3.05);
      pivotGroup.add(centerStripe);
    }
  }

  // 9. Rear Spoiler Wing (Customizable Aero Kit)
  const spoilerStyle = carSpec.spoiler || 'gt';
  if (!isTraffic && spoilerStyle !== 'none') {
    const wingWidth = spoilerStyle === 'hyper' ? 2.15 : 1.85;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wingWidth, 0.08, 0.34), bodyMat);
    wing.position.set(0, spoilerStyle === 'hyper' ? 0.88 : 0.78, 0.16);
    pivotGroup.add(wing);

    if (spoilerStyle === 'hyper') {
      const upperWing = new THREE.Mesh(new THREE.BoxGeometry(wingWidth * 0.9, 0.06, 0.24), neonMat);
      upperWing.position.set(0, 1.04, 0.22);
      pivotGroup.add(upperWing);
    }

    const strutGeo = new THREE.BoxGeometry(0.08, 0.38, 0.2);
    const strutL = new THREE.Mesh(strutGeo, accentMat);
    strutL.position.set(-0.68, 0.62, 0.14);
    const strutR = strutL.clone();
    strutR.position.x = 0.68;
    pivotGroup.add(strutL, strutR);
  } else if (isTraffic) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.07, 0.28), bodyMat);
    wing.position.set(0, 0.74, 0.16);
    pivotGroup.add(wing);
  }

  // 10. Neon Underglow Strip
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 4.35),
    new THREE.MeshBasicMaterial({
      color: carSpec.neonColor,
      transparent: true,
      opacity: isTraffic ? 0.2 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.set(0, -0.34, -1.8);
  pivotGroup.add(underglow);

  return group;
}

export function createMotorbikeMesh(
  bikeSpec: CarSpec,
  isTraffic = false,
  maxAnisotropy = 4
): THREE.Group {
  const group = new THREE.Group();
  const pivotGroup = new THREE.Group();
  pivotGroup.name = 'wheeliePivot';
  pivotGroup.position.set(0, 0, 1.1);
  group.add(pivotGroup);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bikeSpec.primaryColor,
    metalness: 0.78,
    roughness: 0.22,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.7,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b162a,
    metalness: 0.9,
    roughness: 0.1,
  });
  const neonMat = new THREE.MeshBasicMaterial({ color: bikeSpec.neonColor });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.15,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.88,
    roughness: 0.2,
  });

  // 1. Twin Wheels with Neon Rim Rings
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.24, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.26, 14);
  rimGeo.rotateZ(Math.PI / 2);

  [-2.2, 0].forEach((wz) => {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(0, 0, wz);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(0, 0, wz);
    pivotGroup.add(tire, rim);
  });

  // 2. Twin-Spar Chassis & Engine Core
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 1.75), frameMat);
  frame.position.set(0, 0.26, -1.1);
  pivotGroup.add(frame);

  // 3. Aerodynamic Fairing & Fuel Tank
  const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 1.65), bodyMat);
  fairing.position.set(0, 0.48, -1.18);
  fairing.rotation.x = 0.12;
  pivotGroup.add(fairing);

  // 4. Tail Seat & Rear Cowl
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.95), bodyMat);
  tail.position.set(0, 0.62, -0.25);
  tail.rotation.x = -0.18;
  pivotGroup.add(tail);

  // 5. Front Forks & Handlebars
  const forkGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8);
  [-0.16, 0.16].forEach((fx) => {
    const fork = new THREE.Mesh(forkGeo, rimMat);
    fork.position.set(fx, 0.36, -1.95);
    fork.rotation.x = -0.35;
    pivotGroup.add(fork);
  });
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.08), frameMat);
  bars.position.set(0, 0.82, -1.78);
  pivotGroup.add(bars);

  // 6. Nose Cowl, Windscreen & LED Headlight/Taillight
  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.42), glassMat);
  windscreen.position.set(0, 0.8, -1.9);
  windscreen.rotation.x = -0.45;
  pivotGroup.add(windscreen);

  const headlight = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.14, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
  );
  headlight.position.set(0, 0.56, -2.14);
  const taillight = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.1, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff1e38 })
  );
  taillight.position.set(0, 0.68, 0.24);
  pivotGroup.add(headlight, taillight);

  // 7. Twin Exhausts
  const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.85, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  [-0.24, 0.24].forEach((ex) => {
    const pipe = new THREE.Mesh(exhaustGeo, rimMat);
    pipe.position.set(ex, 0.12, -0.18);
    pivotGroup.add(pipe);
  });

  // 8. Optional Bike Tail Aero Wing
  if (!isTraffic && bikeSpec.spoiler !== 'none') {
    const wingW = bikeSpec.spoiler === 'hyper' ? 0.92 : 0.68;
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.06, 0.24), neonMat);
    tailWing.position.set(0, 0.84, 0.14);
    pivotGroup.add(tailWing);
  }

  // 9. Tank Crest Emblem & Livery
  if (!isTraffic) {
    const logoTex = createVehicleLogoTexture(bikeSpec, maxAnisotropy);
    const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true });
    const tankLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), logoMat);
    tankLogo.rotation.x = -Math.PI / 2 + 0.12;
    tankLogo.position.set(0, 0.76, -1.2);
    pivotGroup.add(tankLogo);

    if (bikeSpec.livery !== 'clean') {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(bikeSpec.livery === 'center' ? 0.18 : 0.08, 0.9),
        neonMat
      );
      stripe.rotation.x = -Math.PI / 2 + 0.12;
      stripe.position.set(0, 0.75, -1.5);
      pivotGroup.add(stripe);
    }
  }

  // 10. Neon Underglow
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 2.8),
    new THREE.MeshBasicMaterial({
      color: bikeSpec.neonColor,
      transparent: true,
      opacity: isTraffic ? 0.2 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.set(0, -0.36, -1.1);
  pivotGroup.add(underglow);

  return group;
}

export function createTrafficVehicleMesh(colorHex: number, isTruck: boolean): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.45,
    roughness: 0.45,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.5,
    roughness: 0.5,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
  });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const w = isTruck ? 2.25 : 1.9;
  const h = isTruck ? 1.45 : 0.65;
  const l = isTruck ? 6.2 : 4.1;

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), bodyMat);
  body.position.set(0, h / 2 + 0.18, 0);
  group.add(body);

  if (!isTruck) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 2.0), darkMat);
    cabin.position.set(0, 1.0, 0.15);
    group.add(cabin);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.25, 1.6), darkMat);
    cab.position.set(0, 0.8, -2.5);
    group.add(cab);
  }

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wz = isTruck ? [-2.2, 2.2] : [-1.35, 1.35];
  const wx = w * 0.5;
  wz.forEach((z) => {
    [-wx, wx].forEach((x) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, 0.36, z);
      group.add(wheel);
    });
  });

  // Tail lights (rear = +Z facing player)
  const tlGeo = new THREE.BoxGeometry(0.42, 0.14, 0.08);
  const tlL = new THREE.Mesh(tlGeo, tlMat);
  tlL.position.set(-w * 0.33, 0.55, l / 2 + 0.02);
  const tlR = tlL.clone();
  tlR.position.x = w * 0.33;
  group.add(tlL, tlR);

  // Head lights (front = -Z)
  const hlL = new THREE.Mesh(tlGeo, hlMat);
  hlL.position.set(-w * 0.33, 0.5, -l / 2 - 0.02);
  const hlR = hlL.clone();
  hlR.position.x = w * 0.33;
  group.add(hlL, hlR);

  return group;
}

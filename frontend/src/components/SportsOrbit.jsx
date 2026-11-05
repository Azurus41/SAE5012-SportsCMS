import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Accueil 3D (WebGL / three.js) : des objets de sport orbitent autour du bouton central.
// Chaque objet a son animation au survol (ballon dans le but, panier, rebond, médaille qui tourne)
// et mène aux articles de son sport. Rendu suspendu hors écran ; pas d'orbite si l'utilisateur
// préfère réduire les animations.
export const ORBIT_SPORTS = [
  { key: 'football', label: 'Football', hint: 'Ballon au fond des filets' },
  { key: 'basketball', label: 'Basket-ball', hint: 'Panier !' },
  { key: 'tennis', label: 'Tennis', hint: 'Rebond' },
  { key: 'athletisme', label: 'Athlétisme', hint: 'Médaille d’or' },
];

const ANIM_MS = 1300;
const ease = (t) => 1 - (1 - t) ** 3;

function footballGeometry() {
  const base = new THREE.IcosahedronGeometry(0.3, 2);
  const geo = base.index ? base.toNonIndexed() : base;
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.getAttribute('position');
  const centers = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    if (!centers.some((c) => c.distanceTo(v) < 1e-3)) centers.push(v);
  }
  const p = geo.getAttribute('position');
  const colors = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const centroid = a.clone().add(b).add(c).normalize();
    const dark = centers.some((v) => v.dot(centroid) > 0.94);
    const col = dark ? [0.09, 0.1, 0.12] : [0.97, 0.97, 0.97];
    colors.push(...col, ...col, ...col);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function seam(radius, color, rotation) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 6, 48), new THREE.MeshStandardMaterial({ color }));
  m.rotation.set(...rotation);
  return m;
}

function buildObjects(accent) {
  const objects = {};

  // Football + petit but (visible pendant l'animation).
  {
    const group = new THREE.Group();
    const ball = new THREE.Mesh(footballGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }));
    group.add(ball);
    const goal = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const post = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), postMat);
      m.position.set(x, y, z);
      goal.add(m);
    };
    post(0.04, 0.55, 0.04, 0, 0.27, -0.45);
    post(0.04, 0.55, 0.04, 0, 0.27, 0.45);
    post(0.04, 0.04, 0.94, 0, 0.55, 0);
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.55, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xb4bac4, wireframe: true, transparent: true, opacity: 0 }),
    );
    net.rotation.y = Math.PI / 2;
    net.position.set(0.18, 0.27, 0);
    goal.add(net);
    goal.position.set(1.0, -0.3, 0);
    group.add(goal);
    objects.football = {
      group,
      body: ball,
      // dir : on tire vers le centre du panneau pour que le but reste visible.
      animate(t, dir = 1) {
        const show = t > 0 ? Math.min(1, t * 4, (1 - t) * 4) : 0;
        postMat.opacity = show;
        net.material.opacity = show * 0.8;
        goal.position.x = 1.0 * dir;
        net.position.x = 0.18 * dir;
        const k = t < 0.55 ? ease(t / 0.55) : 1 - ease((t - 0.55) / 0.45);
        ball.position.set(k * 1.08 * dir, Math.sin(k * Math.PI) * 0.35 - k * 0.05, 0);
        ball.rotation.z = -k * 8 * dir;
      },
    };
  }

  // Basket-ball + panier.
  {
    const group = new THREE.Group();
    const ballGroup = new THREE.Group();
    ballGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.29, 32, 24), new THREE.MeshStandardMaterial({ color: 0xe2723b, roughness: 0.75 })));
    ballGroup.add(seam(0.292, 0x1b1b1b, [0, 0, 0]));
    ballGroup.add(seam(0.292, 0x1b1b1b, [Math.PI / 2, 0, 0]));
    ballGroup.add(seam(0.292, 0x1b1b1b, [0, Math.PI / 2, 0]));
    group.add(ballGroup);
    const hoopMat = new THREE.MeshStandardMaterial({ color: 0xd64545, transparent: true, opacity: 0 });
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 40), hoopMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.95;
    group.add(hoop);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.03), boardMat);
    board.position.set(0, 1.18, -0.42);
    group.add(board);
    objects.basketball = {
      group,
      body: ballGroup,
      animate(t) {
        const show = t > 0 ? Math.min(1, t * 4, (1 - t) * 4) : 0;
        hoopMat.opacity = show;
        boardMat.opacity = show * 0.85;
        // Monte au-dessus du cercle puis retombe dedans.
        const y = t < 0.45 ? ease(t / 0.45) * 1.45 : 1.45 - ease((t - 0.45) / 0.55) * 1.45;
        ballGroup.position.y = y;
        ballGroup.rotation.x = t * 6;
      },
    };
  }

  // Balle de tennis.
  {
    const group = new THREE.Group();
    const ballGroup = new THREE.Group();
    ballGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), new THREE.MeshStandardMaterial({ color: 0xcfe23a, roughness: 0.9 })));
    const s1 = seam(0.16, 0xffffff, [0.4, 0, 0]);
    s1.position.set(0.11, 0, 0);
    const s2 = seam(0.16, 0xffffff, [0.4, 0, 0]);
    s2.position.set(-0.11, 0, 0);
    ballGroup.add(s1, s2);
    group.add(ballGroup);
    objects.tennis = {
      group,
      body: ballGroup,
      animate(t) {
        const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * 0.7 * (1 - t);
        ballGroup.position.y = bounce;
        const squash = bounce < 0.05 && t > 0 && t < 0.95 ? 0.8 : 1;
        ballGroup.scale.set(1 / squash, squash, 1 / squash);
        ballGroup.rotation.z = -t * 10;
      },
    };
  }

  // Médaille (athlétisme).
  {
    const group = new THREE.Group();
    const medal = new THREE.Group();
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.05, 40),
      new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.75, roughness: 0.3 }),
    );
    disk.rotation.x = Math.PI / 2;
    medal.add(disk);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0xe8c45a, metalness: 0.6, roughness: 0.35 }),
    );
    inner.rotation.x = Math.PI / 2;
    medal.add(inner);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent) });
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), ribbonMat);
    r1.position.set(-0.1, 0.45, 0);
    r1.rotation.z = -0.35;
    const r2 = r1.clone();
    r2.position.x = 0.1;
    r2.rotation.z = 0.35;
    medal.add(r1, r2);
    group.add(medal);
    objects.athletisme = {
      group,
      body: medal,
      animate(t) {
        medal.rotation.y = ease(t) * Math.PI * 4;
        const s = 1 + Math.sin(t * Math.PI) * 0.25;
        medal.scale.set(s, s, s);
        medal.position.y = Math.sin(t * Math.PI) * 0.25;
      },
    };
  }
  return objects;
}

export default function SportsOrbit({ onPick, onFail, focusKey }) {
  const mount = useRef(null);
  const api = useRef({});
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const el = mount.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onFail?.();
      return undefined;
    }
    const accent = getComputedStyle(el).getPropertyValue('--accent').trim() || '#2458e8';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced6, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 5, 4);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // Caméra légèrement plongeante, visée sous le centre : l'orbite remonte au-dessus de la légende du panneau.
    camera.position.set(0, 2.3, 7.6);
    camera.lookAt(0, -0.55, 0);

    // Anneau d'orbite (rappel du cercle central d'un terrain).
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.006, 4, 120),
      new THREE.MeshBasicMaterial({ color: 0xb4bac4 }),
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const objects = buildObjects(accent);
    const keys = ORBIT_SPORTS.map((s) => s.key);
    const anims = Object.fromEntries(keys.map((k) => [k, null]));
    const pickables = [];
    keys.forEach((k) => {
      scene.add(objects[k].group);
      objects[k].group.traverse((o) => {
        if (o.isMesh) {
          o.userData.sport = k;
          pickables.push(o);
        }
      });
    });

    let angle = 0;
    let hover = null;
    const place = () => {
      keys.forEach((k, i) => {
        const a = angle + (i / keys.length) * Math.PI * 2;
        objects[k].group.position.set(Math.cos(a) * 2.05, 0, Math.sin(a) * 2.05);
        objects[k].group.lookAt(camera.position.x, objects[k].group.position.y, camera.position.z);
      });
    };

    const start = (k) => {
      if (!anims[k]) anims[k] = performance.now();
      wake();
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const sportAt = (e) => {
      const box = el.getBoundingClientRect();
      ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return hit?.object.userData.sport || null;
    };
    const onMove = (e) => {
      const k = sportAt(e);
      if (k !== hover) {
        hover = k;
        setHovered(k);
        el.style.cursor = k ? 'pointer' : '';
        if (k) start(k);
      }
    };
    const onLeave = () => {
      hover = null;
      setHovered(null);
      el.style.cursor = '';
    };
    const onClick = (e) => {
      const k = sportAt(e);
      if (k) onPick?.(k);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick);

    // Animation pilotée depuis le HTML (focus clavier sur la liste des sports).
    api.current.play = (k) => {
      hover = k;
      start(k);
    };
    api.current.stop = () => {
      hover = null;
    };

    let frame = null;
    let visible = true;
    let last = performance.now();
    const tick = (now) => {
      frame = null;
      const dt = Math.min(64, now - last);
      last = now;
      if (!reduceMotion && !hover) angle += dt * 0.00018;
      place();
      let busy = false;
      keys.forEach((k) => {
        if (anims[k] === null) return;
        const t = Math.min(1, (now - anims[k]) / ANIM_MS);
        objects[k].animate(t, objects[k].group.position.x > 0 ? -1 : 1);
        if (t >= 1) {
          objects[k].animate(0);
          anims[k] = null;
        } else busy = true;
      });
      renderer.render(scene, camera);
      if (visible && (!reduceMotion || busy)) frame = requestAnimationFrame(tick);
    };
    function wake() {
      if (frame === null && visible) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Sur mobile, on recule la caméra pour garder l'orbite entière à l'écran.
      camera.position.z = w / h < 1 ? 7.6 / (w / h) ** 0.8 : 7.6;
      camera.lookAt(0, -0.55, 0);
      camera.updateProjectionMatrix();
      wake();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    io.observe(el);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    wake();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [onPick, onFail]);

  useEffect(() => {
    if (focusKey) api.current.play?.(focusKey);
    else api.current.stop?.();
  }, [focusKey]);

  const label = ORBIT_SPORTS.find((s) => s.key === (hovered || focusKey));
  return (
    <div className="three-mount" ref={mount}>
      {label && (
        <span className="orbit-label" aria-hidden="true">
          {label.label} · {label.hint}
        </span>
      )}
    </div>
  );
}

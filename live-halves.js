// Live apps in the half-folded posture. The phone is posed like a laptop (hinge horizontal, the fixed
// half flat as the base, the cover half rising as the lid). The app renders three screens: the lid and
// base halves of the inner display, and the outer display on the back of the lid, which faces the person
// across the table. Lid and outer ride on a hinge group that follows the fold every frame, so the app
// stays live at any angle (no snapshots).
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const PIVOT_Z = .275454;
const POSTURE = 100;
const HALF = { w: 445, h: 626 };
const OUTER = { w: 431, h: 626 };
const INNER_W = 15.7987 / 2, INNER_H = 11.1035, INNER_Y = .34562 - 5.8974 + 11.1035 / 2, INNER_Z = .24948 + .002;
const OUTER_W = 7.73936, OUTER_H = 11.2513, OUTER_Y = .27173 - 5.8974 + 11.2513 / 2, OUTER_Z = -.27464 - .002;
// Local axes → world: phone x (toward the fixed half) → toward the viewer, hinge axis → left/right, screen normal → up.
const POSE = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
const VIEWS = {
  a: { target: [0, 2.4, 3.2], position: [0, 17, 24.5] },
  b: { target: [0, 3.4, 0], position: [0, 8.5, -22] },
  top: { target: [0, 0, 3.4], position: [0, 25, 6] },
};

export async function startHalves(module, { renderer, camera, controls, viewport, screens, phone, foldTo, getAngle }) {
  const css = new CSS3DRenderer();
  css.domElement.className = 'live-layer';
  viewport.prepend(css.domElement);
  viewport.classList.add('is-live');
  const { width, height } = viewport.getBoundingClientRect();
  css.setSize(width, height);
  const cssScene = new THREE.Scene();
  const root = new THREE.Group();
  root.quaternion.copy(POSE);
  cssScene.add(root);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0, PIVOT_Z);
  root.add(hinge);
  phone.quaternion.copy(POSE);

  function screen(size, parent, x, y, z, worldW, worldH, flip = false) {
    const holder = document.createElement('div');
    holder.className = 'live-screen is-active';
    Object.assign(holder.style, { width: `${size.w}px`, height: `${size.h}px` });
    const el = document.createElement('div');
    Object.assign(el.style, { width: `${size.w}px`, height: `${size.h}px` });
    holder.append(el);
    for (const type of ['pointerdown', 'wheel', 'touchstart']) holder.addEventListener(type, e => e.stopPropagation(), { passive: true });
    const object = new CSS3DObject(holder);
    object.position.set(x, y, z);
    object.scale.set(worldW / size.w, worldH / size.h, 1);
    if (flip) object.rotation.y = Math.PI;
    parent.add(object);
    return { holder, el };
  }
  const lid = screen(HALF, hinge, -INNER_W / 2, INNER_Y, INNER_Z - PIVOT_Z, INNER_W, INNER_H);
  const base = screen(HALF, root, INNER_W / 2, INNER_Y, INNER_Z, INNER_W, INNER_H);
  const outer = screen(OUTER, hinge, -(.23396 + OUTER_W / 2), OUTER_Y, OUTER_Z - PIVOT_Z, OUTER_W, OUTER_H, true);

  for (const kind of ['inner', 'outer']) {
    screens[kind].punch.value = 1;
    screens[kind].material.blending = THREE.NoBlending;
    screens[kind].material.needsUpdate = true;
  }
  const clear = { color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  renderer.setClearColor(getComputedStyle(document.documentElement).backgroundColor, 1);

  // Camera views, eased.
  let tween = null;
  function view(name, instant = false) {
    const v = VIEWS[name];
    if (!v) return;
    const to = { target: new THREE.Vector3(...v.target), position: new THREE.Vector3(...v.position) };
    if (instant) { controls.target.copy(to.target); camera.position.copy(to.position); tween = null; return; }
    tween = { from: { target: controls.target.clone(), position: camera.position.clone() }, to, start: performance.now() };
  }

  const listeners = new Set();
  let posture = null;
  const postureOf = a => a >= 170 ? 'open' : a <= 10 ? 'closed' : 'posture';
  const host = {
    fold: open => foldTo(open ? POSTURE : 0),
    foldTo,
    angle: getAngle,
    view,
    onPosture: callback => { listeners.add(callback); return () => listeners.delete(callback); },
  };
  const app = await module.mount({ lid: lid.el, base: base.el, outer: outer.el, host });
  view('a', true);
  foldTo(POSTURE);

  return {
    app,
    panel: module.panel,
    onAngle() {},
    prepareFold() {},
    fold: open => host.fold(open),
    render() {
      const angle = getAngle();
      hinge.rotation.y = (180 - angle) / 180 * Math.PI;
      const p = postureOf(angle);
      if (p !== posture) { posture = p; for (const cb of listeners) cb(p); }
      if (tween) {
        const k = Math.min(1, (performance.now() - tween.start) / 1100);
        const e = k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        controls.target.lerpVectors(tween.from.target, tween.to.target, e);
        camera.position.lerpVectors(tween.from.position, tween.to.position, e);
        if (k === 1) tween = null;
      }
      css.render(cssScene, camera);
    },
    setSize: (w, h) => css.setSize(w, h),
    stop() {
      app.destroy?.();
      css.domElement.remove();
      viewport.classList.remove('is-live');
      phone.quaternion.identity();
      for (const kind of ['inner', 'outer']) {
        screens[kind].punch.value = 0;
        screens[kind].material.blending = THREE.NormalBlending;
        screens[kind].material.needsUpdate = true;
      }
      renderer.setClearColor(clear.color, clear.alpha);
    },
  };
}

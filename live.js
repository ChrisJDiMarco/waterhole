// Live, clickable app screens on the 3D phone.
// The app's DOM sits behind the WebGL canvas, placed in 3D by CSS3DRenderer with the same camera.
// At rest, the visible screen mesh punches a transparent hole, so the bezel and body hide the DOM
// exactly as they would hide a real display. While folding, both screens switch to snapshot
// textures so the existing blur/darken fold shader keeps working.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { domToCanvas } from 'modern-screenshot';

const SIZE = { inner: [890, 626], outer: [431, 626] };
// Screen rectangles in world units at rest: inner when open, outer when closed (measured from the model).
const PLACE = {
  inner: { x: 0, y: .34562 - 5.8974 + 11.1035 / 2, z: .24948 + .002, w: 15.7987, h: 11.1035 },
  outer: { x: .23396 + 7.73936 / 2, y: .27173 - 5.8974 + 11.2513 / 2, z: .825538 + .002, w: 7.73936, h: 11.2513 },
};
const SNAPSHOT_SCALE = 2;

export async function startLive(slug, options) {
  const module = await import(`./apps/${slug}/app.js`);
  // Apps that use the half-folded posture get their own placement (lid, base and outer screens).
  if (module.layout === 'halves') return (await import('./live-halves.js')).startHalves(module, options);
  const { renderer, camera, viewport, screens, frames, foldTo, getAngle } = options;
  const css = new CSS3DRenderer();
  css.domElement.className = 'live-layer';
  viewport.prepend(css.domElement);
  viewport.classList.add('is-live');
  const { width: viewWidth, height: viewHeight } = viewport.getBoundingClientRect();
  css.setSize(viewWidth, viewHeight);
  const cssScene = new THREE.Scene();
  const roots = {};
  const holders = {};
  for (const kind of ['inner', 'outer']) {
    const [width, height] = SIZE[kind];
    const holder = document.createElement('div');
    holder.className = 'live-screen';
    Object.assign(holder.style, { width: `${width}px`, height: `${height}px` });
    const root = document.createElement('div');
    Object.assign(root.style, { width: `${width}px`, height: `${height}px` });
    holder.append(root);
    // Touches on the screen drive the app, not the camera.
    for (const type of ['pointerdown', 'wheel', 'touchstart']) {
      holder.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }
    const object = new CSS3DObject(holder);
    const place = PLACE[kind];
    object.position.set(place.x, place.y, place.z);
    object.scale.set(place.w / width, place.h / height, 1);
    cssScene.add(object);
    roots[kind] = root;
    holders[kind] = holder;
  }

  const listeners = new Set();
  let active;
  const host = {
    fold: open => fold(open),
    isOpen: () => getAngle() >= 90,
    onScreen: callback => { listeners.add(callback); return () => listeners.delete(callback); },
  };
  const app = await module.mount({ inner: roots.inner, outer: roots.outer, host });

  // Snapshot textures used while the phone is mid-fold.
  const snaps = {};
  let pending = null;
  function refresh() {
    pending ??= Promise.all(['inner', 'outer'].map(async kind => {
      // Pass the true size: the element's on-screen box is shrunk by its 3D transform.
      const [width, height] = SIZE[kind];
      const shot = await domToCanvas(roots[kind], { width, height, scale: SNAPSHOT_SCALE, backgroundColor: '#000' });
      // Copy into a canvas we own: the library may reuse its output canvas, and a fixed size
      // keeps the GPU texture allocation stable between snapshots.
      if (!snaps[kind]) {
        const canvas = Object.assign(document.createElement('canvas'), { width: width * SNAPSHOT_SCALE, height: height * SNAPSHOT_SCALE });
        snaps[kind] = new THREE.CanvasTexture(canvas);
        snaps[kind].colorSpace = THREE.SRGBColorSpace;
        snaps[kind].anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      const canvas = snaps[kind].image;
      canvas.getContext('2d').drawImage(shot, 0, 0, canvas.width, canvas.height);
      snaps[kind].needsUpdate = true;
    })).then(applyTextures).catch(error => console.error('Snapshot failed', error)).finally(() => { pending = null; });
    return pending;
  }
  function applyTextures() {
    for (const kind of ['inner', 'outer']) {
      const texture = snaps[kind];
      if (!texture) continue;
      const screen = screens[kind];
      screen.material.map = texture;
      screen.pixel.value.set(1 / texture.image.width, 1 / texture.image.height);
      screen.frame.value.copy(frames[kind]);
      screen.gradient.value.set(kind === 'inner' ? .5 : 0, kind === 'inner' ? 0 : 1);
      screen.material.needsUpdate = true;
    }
  }
  function setPunch(kind, on) {
    const screen = screens[kind];
    if (screen.punch.value === (on ? 1 : 0)) return;
    screen.punch.value = on ? 1 : 0;
    screen.material.blending = on ? THREE.NoBlending : THREE.NormalBlending;
    screen.material.needsUpdate = true;
  }
  function setActive(kind) {
    if (kind === active) return;
    active = kind;
    for (const k of ['inner', 'outer']) {
      const on = k === kind;
      holders[k].classList.toggle('is-active', on);
      setPunch(k, on);
    }
    for (const callback of listeners) callback(kind);
  }
  async function fold(open) {
    const target = open ? 180 : 0;
    if (getAngle() === target) return;
    await refresh();
    foldTo(target);
  }

  const restKind = value => value >= 179.99 ? 'inner' : value <= .01 ? 'outer' : null;
  // Paint the page colour opaquely around the phone, so the app's rectangular layers only
  // ever show through the punched screen holes, never past the phone's rounded corners.
  const clear = { color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  renderer.setClearColor(getComputedStyle(document.documentElement).backgroundColor, 1);
  setActive(restKind(getAngle()));
  await document.fonts.ready;
  refresh();

  return {
    app,
    panel: module.panel,
    onAngle(value) {
      const kind = restKind(value);
      if (kind === null && active !== null && !snaps.inner) refresh();
      setActive(kind);
    },
    prepareFold: () => refresh(),
    fold,
    render: () => css.render(cssScene, camera),
    setSize: (width, height) => css.setSize(width, height),
    stop() {
      setPunch('inner', false);
      setPunch('outer', false);
      app.destroy?.();
      css.domElement.remove();
      renderer.setClearColor(clear.color, clear.alpha);
      viewport.classList.remove('is-live');
    },
  };
}

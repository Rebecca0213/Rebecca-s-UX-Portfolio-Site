// Mounts Cloud Cream Island into the homepage hero. The town itself lives in ./src, ported from
// the macaron-town Vite project by scripts/sync-macaron-town.py; this file is hand-written and is
// the only part the sync script leaves alone.
//
// Re-sync from the source town when the island should match macaron-town again:
//   python3 scripts/sync-macaron-town.py [path-to-macaron-town]

const island = document.querySelector(".island");
const stage = island?.querySelector(".island__stage");

const VENUE_IDS = new Set(["grand-salon", "la-douceur", "blue-bookshop"]);

function syncBlendTransition(world, shared) {
  const root = document.documentElement;
  const clear = shared.skyGround.value.clone();
  world.renderer.getClearColor(clear);
  const skyMid = clear.clone().lerp(shared.skyGround.value, 0.62).lerp(shared.skyHorizon.value, 0.24);
  root.style.setProperty("--sky-mid", `#${skyMid.getHexString()}`);
  const sectionBg =
    getComputedStyle(root).getPropertyValue("--intro-sky").trim() ||
    getComputedStyle(root).getPropertyValue("--section-bg").trim() ||
    "#f1e9f2";
  root.style.setProperty("--section-bg", sectionBg);
}

const isPhone = () => matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;

// iOS Safari kills the tab once the page's GPU memory passes its budget, and the full post chain at
// 2x on a phone (4x MSAA half-float targets, AO, bloom, SMAA, a 4096 shadow map) goes past it.
function fitPhoneBudget(world) {
  const sceneMsaa = world.pipeline.scenePass;
  sceneMsaa.samples = 2;
  sceneMsaa.release();
  const shadow = world.lighting.sun.shadow;
  shadow.mapSize.set(2048, 2048);
  if (shadow.map) {
    shadow.map.depthTexture?.dispose();
    shadow.map.dispose();
    shadow.map = null;
  }
  world.renderer.shadowMap.needsUpdate = true;
}

// Off-screen the canvas is invisible, so its frames only spend memory and battery that the rest of
// the page (the folder cover videos) needs.
function pauseWhenHidden(world) {
  if (typeof IntersectionObserver === "undefined") return;
  const loop = (t) => world.tick(t);
  let running = true;
  new IntersectionObserver(
    ([entry]) => {
      const visible = entry.isIntersecting;
      if (visible === running) return;
      running = visible;
      world.renderer.setAnimationLoop(visible ? loop : null);
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
}

function showPosterOnContextLoss(world) {
  world.renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    world.renderer.setAnimationLoop(null);
    island.classList.remove("is-live", "is-building");
    island.classList.add("is-poster");
  });
}

function wireHomepage(world) {
  const canvas = world.renderer.domElement;
  // The town's resolution governor steps the canvas down when frames are slow. On the homepage that
  // reads as a pixelated island. Draw at a fixed pixel ratio instead.
  world.governor = null;
  const phone = isPhone();
  if (phone) fitPhoneBudget(world);
  const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 3);
  world.setPixelRatio(dpr);
  pauseWhenHidden(world);
  showPosterOnContextLoss(world);
  world.controls.enableZoom = false;
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
    },
    { capture: true, passive: false },
  );
  world.taps.onTap = (target) => {
    if (VENUE_IDS.has(target.name)) {
      window.dispatchEvent(new CustomEvent("island-venue", { detail: { id: target.name } }));
    }
  };
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => world.resize()).observe(stage);
  }
}

const hasWebGL = () => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (stage && hasWebGL() && !reduceMotion.matches) {
  island.classList.add("is-building");
  try {
    const { World } = await import("./src/app/World.js?v=spokes1");
    const { SHARED } = await import("./src/render/shared.js?v=blend1");
    const world = new World(stage);
    wireHomepage(world);
    syncBlendTransition(world, SHARED);
    window.__island = world;

    const bar = island.querySelector(".island__loader-bar");
    const paint = () => {
      const { placed, total } = world.progress;
      const ratio = total ? Math.min(1, placed / total) : 0;
      if (bar) bar.style.transform = `scaleX(${ratio})`;
    };
    paint();
    const progressTimer = window.setInterval(paint, 80);

    await world.building;
    window.clearInterval(progressTimer);
    if (world.error) throw world.error;
    world.progress.revealMs = Math.round(performance.now());
    if (bar) bar.style.transform = "scaleX(1)";
    island.classList.remove("is-building");
    world.resize();
    const waitForPaint = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await waitForPaint();
    syncBlendTransition(world, SHARED);
    // The build can outlast the poster; if the intro finished underneath it, fly in again.
    if (!world.rig.flying) world.rig.replayIntro();
    island.classList.add("is-live");
    requestAnimationFrame(() => world.resize());
  } catch (error) {
    console.error("Cloud Cream Island failed to start", error);
    island.classList.remove("is-building");
    island.classList.add("is-poster");
  }
} else {
  island?.classList.add("is-poster");
}
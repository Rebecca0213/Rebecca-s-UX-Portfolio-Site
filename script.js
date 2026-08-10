// Keep CSS --nav-height in sync so fixed nav doesn't cover page content
(() => {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const syncNavHeight = () => {
    document.documentElement.style.setProperty("--nav-height", `${nav.offsetHeight}px`);
  };

  syncNavHeight();
  window.addEventListener("resize", syncNavHeight, { passive: true });

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncNavHeight).observe(nav);
  }
})();

const playBtn = document.querySelector(".audio-player__play");
const player = document.querySelector(".audio-player");
const playerWrap = document.querySelector(".audio-player-wrap");
const tt = document.querySelector(".tt");
const platter = document.querySelector(".tt__platter");
const audio = document.querySelector(".audio-player__audio");
const timeEl = document.querySelector(".audio-player__time");
const progressFill = document.querySelector(".audio-player__progress-fill");
const volumeRoot = document.querySelector(".audio-player__volume");
const volumeBtn = document.querySelector(".audio-player__volume-btn");
const volumeSlider = document.querySelector(".audio-player__volume-slider");

const playIcon =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2 L12 7 L3 12 Z"/></svg>';
const pauseIcon =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="0.5"/><rect x="8.5" y="1" width="3.5" height="12" rx="0.5"/></svg>';

let vuFrame = null;
let savedVolume = 0.75;
let hasStartedAudio = false;
let wantsToPlay = true;
let playbackSession = 0;

function updatePlaybackUi() {
  tt?.classList.toggle("is-playing", wantsToPlay);
  player?.classList.toggle("is-playing", wantsToPlay);
  updatePlayButton(wantsToPlay);

  if (wantsToPlay) startVu();
  else stopVu();
}

async function startPlayback({ keepVisualOnFail = false } = {}) {
  if (!audio) return false;

  const session = ++playbackSession;
  wantsToPlay = true;
  updatePlaybackUi();

  try {
    await audio.play();

    if (session !== playbackSession || !wantsToPlay) {
      audio.pause();
      return false;
    }

    hasStartedAudio = true;
    return true;
  } catch {
    if (session === playbackSession && !keepVisualOnFail) {
      wantsToPlay = false;
      updatePlaybackUi();
    }
    return false;
  }
}

function stopPlayback() {
  if (!audio) return;

  playbackSession += 1;
  wantsToPlay = false;
  audio.pause();
  updatePlaybackUi();
}

async function togglePlaying(event) {
  event?.stopPropagation();

  if (!audio) {
    wantsToPlay = !wantsToPlay;
    updatePlaybackUi();
    return;
  }

  if (wantsToPlay) {
    stopPlayback();
    return;
  }

  await startPlayback();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateTimeDisplay() {
  if (!audio || !timeEl) return;

  timeEl.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}

function updateProgress() {
  if (!audio || !progressFill || !audio.duration) return;

  progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
}

function updateVolumeUi({ syncSlider = true } = {}) {
  if (!audio || !playerWrap || !volumeBtn || !volumeSlider) return;

  const isMuted = audio.muted || audio.volume === 0;
  playerWrap.classList.toggle("is-muted", isMuted);
  volumeBtn.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
  volumeBtn.setAttribute("aria-pressed", String(isMuted));

  if (syncSlider) {
    volumeSlider.value = String(isMuted ? 0 : audio.volume);
  }
}

function setVolumeLevel(level) {
  if (!audio || !volumeSlider) return;

  const clamped = Math.min(1, Math.max(0, level));

  if (clamped === 0) {
    if (audio.volume > 0) savedVolume = audio.volume;
    audio.volume = 0;
    audio.muted = true;
    volumeSlider.value = "0";
  } else {
    audio.muted = false;
    audio.volume = clamped;
    savedVolume = clamped;
    volumeSlider.value = String(clamped);
  }

  updateVolumeUi({ syncSlider: false });
}

function updatePlayButton(isPlaying) {
  if (!playBtn) return;
  playBtn.innerHTML = isPlaying ? pauseIcon : playIcon;
  playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  platter?.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

function startVu() {
  const vu = document.querySelector(".tt__vu");
  if (!vu) return;

  const tick = () => {
    if (!tt?.classList.contains("is-playing")) return;

    [...vu.children].forEach((bar, i) => {
      const base = 25 + 55 * Math.abs(Math.sin(Date.now() / 260 + i * 0.7));
      bar.style.height = `${base}%`;
    });

    vuFrame = requestAnimationFrame(tick);
  };

  tick();
}

function stopVu() {
  if (vuFrame) cancelAnimationFrame(vuFrame);
  vuFrame = null;

  const vu = document.querySelector(".tt__vu");
  if (vu) [...vu.children].forEach((bar) => (bar.style.height = "18%"));
}

function toggleMute() {
  if (!audio || !volumeSlider) return;

  if (audio.muted || audio.volume === 0) {
    setVolumeLevel(savedVolume || 0.75);
  } else {
    setVolumeLevel(0);
  }
}

if (playBtn) {
  playBtn.addEventListener("click", togglePlaying);
}

if (platter) {
  platter.addEventListener("click", togglePlaying);
}

if (volumeBtn) {
  volumeBtn.addEventListener("click", toggleMute);
}

function openVolumePopover() {
  volumeRoot?.classList.add("is-open");
}

function closeVolumePopover() {
  volumeRoot?.classList.remove("is-open");
  volumeSlider?.blur();
}

if (volumeRoot) {
  volumeRoot.addEventListener("mouseenter", openVolumePopover);
  volumeRoot.addEventListener("mouseleave", closeVolumePopover);
}

if (volumeSlider && audio) {
  setVolumeLevel(Number(volumeSlider.value));

  volumeSlider.addEventListener("input", () => {
    setVolumeLevel(Number(volumeSlider.value));
  });

  volumeSlider.addEventListener("pointerdown", () => {
    openVolumePopover();
  });

  volumeSlider.addEventListener("pointerup", () => {
    requestAnimationFrame(() => {
      if (!volumeRoot?.matches(":hover")) closeVolumePopover();
    });
  });
}

if (audio) {
  audio.addEventListener("loadedmetadata", () => {
    updateTimeDisplay();
    updateProgress();
  });

  audio.addEventListener("timeupdate", () => {
    updateTimeDisplay();
    updateProgress();
  });

  audio.addEventListener("play", () => {
    hasStartedAudio = true;
  });

  updatePlaybackUi();
  updateVolumeUi();

  const heroLeft = document.querySelector(".hero__left");
  if (!heroLeft?.hidden) {
    startPlayback({ keepVisualOnFail: true });
  }
}

const cursor = document.querySelector(".hero__cursor");
const interactiveZs = document.querySelectorAll(".accent-z--interactive");
const heroAccentZ = document.querySelector(".hero__title .accent-z--interactive");

function bounceZ(element) {
  element.classList.remove("is-bouncing");
  void element.offsetWidth;
  element.classList.add("is-bouncing");
}

interactiveZs.forEach((accentZ) => {
  accentZ.addEventListener("click", (event) => {
    event.preventDefault();
    bounceZ(accentZ);
  });

  accentZ.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      bounceZ(accentZ);
    }
  });

  accentZ.addEventListener("animationend", (event) => {
    if (event.animationName === "z-bounce") {
      accentZ.classList.remove("is-bouncing");
    }
  });
});

function initHeroTitleWave() {
  const title = document.querySelector(".hero__title");
  if (!title) return;

  const textNodes = [];
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest(".name-z-wrap")) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.textContent.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  let letterIndex = 0;

  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();

    [...node.textContent].forEach((char) => {
      if (char === " ") {
        fragment.appendChild(document.createTextNode(" "));
        return;
      }

      if (/\s/.test(char)) return;

      const span = document.createElement("span");
      span.className = "hero__title-letter";
      span.dataset.index = String(letterIndex);
      span.textContent = char;
      fragment.appendChild(span);
      letterIndex += 1;
    });

    node.parentNode.replaceChild(fragment, node);
  });

  const letters = [...title.querySelectorAll(".hero__title-letter")];

  letters.forEach((letter) => {
    letter.addEventListener("mouseenter", () => {
      const hoveredIndex = Number(letter.dataset.index);

      letters.forEach((target) => {
        const distance = Math.abs(Number(target.dataset.index) - hoveredIndex);
        target.style.animationDelay = `${distance * 0.055}s`;
        target.classList.remove("is-waving");
        void target.offsetWidth;
        target.classList.add("is-waving");
      });
    });

    letter.addEventListener("animationend", (event) => {
      if (event.animationName === "hero-letter-wave") {
        letter.classList.remove("is-waving");
      }
    });
  });
}

initHeroTitleWave();

if (cursor) {
  let hasPointer = false;
  let rafId = 0;
  let nextX = 0;
  let nextY = 0;

  function placeAt(x, y) {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function schedulePlace(x, y) {
    nextX = x;
    nextY = y;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      placeAt(nextX, nextY);
    });
  }

  function followPointer(x, y) {
    if (x == null || y == null) return;
    hasPointer = true;
    schedulePlace(x, y);
    cursor.classList.add("is-visible");
  }

  function positionOnZ() {
    if (hasPointer || !heroAccentZ) return;

    const zRect = heroAccentZ.getBoundingClientRect();
    placeAt(zRect.right - 4, zRect.top + 10);
    cursor.classList.add("is-visible");
  }

  function onPointerEvent(event) {
    followPointer(event.clientX, event.clientY);
  }

  function onTouchEvent(event) {
    const point = event.touches?.[0] ?? event.changedTouches?.[0];
    if (!point) return;
    followPointer(point.clientX, point.clientY);
  }

  function onMouseLeave() {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      cursor.classList.remove("is-visible");
    }
  }

  window.addEventListener("pointerdown", onPointerEvent, { passive: true });
  window.addEventListener("pointermove", onPointerEvent, { passive: true });
  // Fallback for browsers without Pointer Events
  window.addEventListener("touchstart", onTouchEvent, { passive: true });
  window.addEventListener("touchmove", onTouchEvent, { passive: true });
  document.documentElement.addEventListener("mouseleave", onMouseLeave);

  window.addEventListener("resize", positionOnZ);
  window.addEventListener("load", positionOnZ);
  positionOnZ();
}

const dotsRoot = document.querySelector(".tt__dots");
const faderSlotsRoot = document.querySelector(".tt__fader-slots");
const fadersRoot = document.querySelector(".tt__faders");
const chipsRoot = document.querySelector(".tt__dock-chips");
const groovesRoot = document.querySelector(".tt__grooves");
const vuRoot = document.querySelector(".tt__vu");

if (dotsRoot) {
  for (let c = 0; c < 13; c++) {
    for (let r = 0; r < 15; r++) {
      const dot = document.createElement("span");
      dot.className = "tt__dot";
      dot.style.left = `${(3.363 + c * 3.606).toFixed(3)}px`;
      dot.style.top = `${(7.5 + r * 3.606).toFixed(3)}px`;
      dotsRoot.appendChild(dot);
    }
  }
}

if (faderSlotsRoot) {
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement("span");
    slot.className = "tt__fader-slot";
    faderSlotsRoot.appendChild(slot);
  }
}

if (fadersRoot) {
  const FADER_SLOT_TOP = 5;
  const FADER_SLOT_HEIGHT = 28;
  const FADER_MIN_TOP = FADER_SLOT_TOP + (34 / 300) * FADER_SLOT_HEIGHT;
  const FADER_MAX_CAP_TOP = FADER_SLOT_TOP + (180 / 300) * FADER_SLOT_HEIGHT;

  const faders = [
    {
      trackLeft: "4.088px",
      capLeft: "3.173px",
      capTop: FADER_SLOT_TOP + (40 / 300) * FADER_SLOT_HEIGHT,
      grad:
        "linear-gradient(180deg, rgb(26,25,30) 17.5%, rgb(73,113,255) 27.37%, rgb(99,73,255) 94.79%)",
    },
    {
      trackLeft: "11.755px",
      capLeft: "10.84px",
      capTop: FADER_SLOT_TOP + (96 / 300) * FADER_SLOT_HEIGHT,
      grad:
        "linear-gradient(180deg, rgb(26,25,30) 37.53%, rgb(255,73,73) 47.23%, rgb(224,33,21) 100%)",
    },
    {
      trackLeft: "19.422px",
      capLeft: "18.507px",
      capTop: FADER_SLOT_TOP + (128 / 300) * FADER_SLOT_HEIGHT,
      grad:
        "linear-gradient(180deg, rgb(26,25,30) 58.23%, rgb(42,216,112) 66.27%, rgb(0,200,104) 100%)",
    },
  ];

  function bindFaderCapDrag(cap) {
    cap.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      cap.classList.add("is-dragging");

      const startY = event.clientY;
      const startTop = parseFloat(cap.style.top);

      function onMove(moveEvent) {
        let nextTop = startTop + (moveEvent.clientY - startY);
        nextTop = Math.max(FADER_MIN_TOP, Math.min(FADER_MAX_CAP_TOP, nextTop));
        cap.style.top = `${nextTop}px`;
      }

      function onUp() {
        cap.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  faders.forEach((fader) => {
    const track = document.createElement("span");
    track.className = "tt__fader-track";
    track.style.left = fader.trackLeft;
    track.style.top = `${FADER_MIN_TOP}px`;
    track.style.background = fader.grad;
    fadersRoot.appendChild(track);

    const cap = document.createElement("span");
    cap.className = "tt__fader-cap";
    cap.style.left = fader.capLeft;
    cap.style.top = `${fader.capTop}px`;
    bindFaderCapDrag(cap);
    fadersRoot.appendChild(cap);
  });
}

if (chipsRoot) {
  const ledStates = [false, true, true, true, true, true];

  ledStates.forEach((isOn) => {
    const el = document.createElement("span");
    el.className = `tt__chip tt__chip--${isOn ? "on" : "off"}`;
    el.dataset.on = String(isOn);
    el.addEventListener("click", () => {
      const nextOn = el.dataset.on !== "true";
      el.dataset.on = String(nextOn);
      el.classList.toggle("tt__chip--on", nextOn);
      el.classList.toggle("tt__chip--off", !nextOn);
    });
    chipsRoot.appendChild(el);
  });
}

const transportPlayBtn = document.querySelector(".tt__transport-btn--play");
const transportStopBtn = document.querySelector(".tt__transport-btn--stop");

if (transportPlayBtn) {
  transportPlayBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!wantsToPlay) startPlayback();
  });
}

if (transportStopBtn) {
  transportStopBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    stopPlayback();
  });
}

if (groovesRoot) {
  const platterScale = 100 / 585.6;

  for (let d = 200; d <= 576; d += 15) {
    const groove = document.createElement("span");
    const size = d * platterScale;
    groove.className = "tt__groove";
    groove.style.width = `${size}px`;
    groove.style.height = `${size}px`;
    groovesRoot.appendChild(groove);
  }
}

if (vuRoot) {
  for (let i = 0; i < 14; i++) {
    const bar = document.createElement("span");
    bar.className = "tt__vu-bar";
    vuRoot.appendChild(bar);
  }
}

const deckTicksRoot = document.querySelector(".tt__deck-ticks");

if (deckTicksRoot) {
  const tickCount = 29;
  const startAngle = -152;
  const endAngle = -28;

  for (let i = 0; i < tickCount; i++) {
    const tick = document.createElement("span");
    const angle = startAngle + (i / (tickCount - 1)) * (endAngle - startAngle);
    tick.className = "tt__deck-tick";
    if (i % 4 === 0) tick.classList.add("tt__deck-tick--major");
    tick.style.transform = `rotate(${angle}deg)`;
    deckTicksRoot.appendChild(tick);
  }
}

const cordPath = document.querySelector(".tt__cord-path");

if (cordPath) {
  const leftX = 25.84;
  const rightX = 56.971 + 161.058 / 3;
  const plugY = 33.2;
  const steps = 52;
  const parts = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = leftX + (rightX - leftX) * t;
    const arc = -13.5 * Math.sin(Math.PI * t);
    const jitter =
      Math.sin(i * 3.17) * 1.35 +
      Math.cos(i * 5.23) * 0.95 +
      Math.sin(i * 8.11) * 0.55 +
      Math.cos(i * 11.7) * 0.35;
    const y = plugY + arc + jitter;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  cordPath.setAttribute("d", parts.join(" "));
}

// Page skeleton loader
(() => {
  const loader = document.getElementById("page-loader");
  if (!loader) {
    document.body.classList.remove("is-loading");
    return;
  }

  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    loader.classList.add("is-done");
    loader.setAttribute("aria-busy", "false");

    const cleanup = () => {
      loader.remove();
    };

    loader.addEventListener("transitionend", cleanup, { once: true });
    window.setTimeout(cleanup, 500);
  };

  const minDelay = new Promise((resolve) => window.setTimeout(resolve, 450));
  const fontsReady = document.fonts?.ready ?? Promise.resolve();

  const reveal = () => {
    Promise.all([minDelay, fontsReady]).then(dismiss);
  };

  if (document.readyState === "complete") {
    reveal();
  } else {
    window.addEventListener("load", reveal, { once: true });
  }

  window.setTimeout(dismiss, 3500);
})();

// Case study section nav — active on click; clears when that section is scrolled past
const caseStudyNav = document.querySelector(".case-study__nav");
const caseStudyToc = document.querySelector(".case-study__toc");

if (caseStudyNav && caseStudyToc) {
  const tocLinks = [...caseStudyToc.querySelectorAll('a[href^="#"]')];
  const navTargets = [
    caseStudyNav.querySelector(".case-study__back"),
    ...tocLinks,
  ].filter(Boolean);

  let activeId = null;
  let ticking = false;
  let hoverTarget = null;
  let indicatorReady = false;

  const indicator = document.createElement("div");
  indicator.className = "case-study__nav-indicator";
  indicator.setAttribute("aria-hidden", "true");
  caseStudyNav.insertBefore(indicator, caseStudyNav.firstChild);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const moveIndicatorTo = (el) => {
    if (!el) {
      indicator.classList.remove("is-visible");
      return;
    }

    const navRect = caseStudyNav.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const x = rect.left - navRect.left + caseStudyNav.scrollLeft;
    const y = rect.top - navRect.top + caseStudyNav.scrollTop;

    if (!indicatorReady || reduceMotion) {
      const prev = indicator.style.transition;
      indicator.style.transition = "none";
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.transform = `translate(${x}px, ${y}px)`;
      // Force layout so enabling transition doesn't animate from 0
      void indicator.offsetWidth;
      indicator.style.transition = prev;
      indicatorReady = true;
    } else {
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.transform = `translate(${x}px, ${y}px)`;
    }

    indicator.classList.add("is-visible");
  };

  const syncIndicator = () => {
    if (hoverTarget) {
      moveIndicatorTo(hoverTarget);
      return;
    }
    const activeLink = tocLinks.find((link) => link.classList.contains("is-active"));
    moveIndicatorTo(activeLink || null);
  };

  const clearActive = () => {
    activeId = null;
    tocLinks.forEach((link) => link.classList.remove("is-active"));
    if (!hoverTarget) syncIndicator();
  };

  const setActive = (id) => {
    activeId = id;
    tocLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    });
    if (!hoverTarget) syncIndicator();
  };

  const navOffset = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--nav-height");
    const navHeight = Number.parseFloat(raw) || 83;
    return navHeight + 32;
  };

  const checkActiveStillInView = () => {
    ticking = false;
    if (!activeId) return;

    const section = document.getElementById(activeId);
    if (!section) {
      clearActive();
      return;
    }

    const rect = section.getBoundingClientRect();
    const topLimit = navOffset();
    // Deselect once the section has scrolled fully above the sticky offset
    if (rect.bottom <= topLimit) {
      clearActive();
    }
  };

  const onScroll = () => {
    if (!activeId || ticking) return;
    ticking = true;
    window.requestAnimationFrame(checkActiveStillInView);
  };

  tocLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.getAttribute("href")?.slice(1);
      if (id) setActive(id);
    });
  });

  navTargets.forEach((el) => {
    el.addEventListener("pointerenter", () => {
      hoverTarget = el;
      moveIndicatorTo(el);
    });
  });

  caseStudyNav.addEventListener("pointerleave", () => {
    hoverTarget = null;
    syncIndicator();
  });

  caseStudyNav.addEventListener(
    "scroll",
    () => {
      syncIndicator();
    },
    { passive: true }
  );

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener(
    "resize",
    () => {
      onScroll();
      syncIndicator();
    },
    { passive: true }
  );
}

// Case study iteration pill switcher
document.querySelectorAll("[data-case-study-pills]").forEach((root) => {
  const tabs = [...root.querySelectorAll("[data-pill]")];
  const panels = [...root.querySelectorAll("[data-pill-panel]")];

  const activate = (id) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.pill === id;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.pillPanel !== id;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activate(tab.dataset.pill);
      tab.blur();
    });

    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = tabs.length - 1;
      }
      if (next < 0) return;
      event.preventDefault();
      tabs[next].focus();
      activate(tabs[next].dataset.pill);
    });
  });

  const initial =
    tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.pill ||
    tabs[0]?.dataset.pill;
  if (initial) activate(initial);
});

// Case study analysis-item accordions — multiple can be open;
// unified card when all closed, split cards when any are open.
document.querySelectorAll("[data-case-study-accordions]").forEach((group) => {
  const items = [...group.querySelectorAll("details.case-study__accordion")];

  const syncSplit = () => {
    group.classList.toggle(
      "is-split",
      items.some((item) => item.open)
    );
  };

  items.forEach((item) => {
    const summary = item.querySelector("summary");
    if (!summary) return;

    // Prevent focus ring on pointer click; keyboard focus still works via Tab/Enter.
    summary.addEventListener("mousedown", (event) => {
      if (event.detail > 0) event.preventDefault();
    });

    item.addEventListener("toggle", () => {
      syncSplit();
      if (document.activeElement === summary) summary.blur();
    });
  });

  syncSplit();
});

// Custom button accordions (avoids native <summary> focus outline).
// Multiple can be open at once.
document.querySelectorAll("[data-case-study-disclosures]").forEach((group) => {
  const items = [...group.querySelectorAll(".case-study__accordion")];

  const syncSplit = () => {
    group.classList.toggle(
      "is-split",
      items.some((item) => item.classList.contains("is-open"))
    );
  };

  const setOpen = (item, open) => {
    const summary = item.querySelector(".case-study__accordion-summary");
    const body = item.querySelector(".case-study__accordion-body");
    item.classList.toggle("is-open", open);
    if (summary) summary.setAttribute("aria-expanded", open ? "true" : "false");
    if (body) body.hidden = !open;
  };

  items.forEach((item) => {
    const summary = item.querySelector(".case-study__accordion-summary");
    if (!summary) return;

    summary.addEventListener("mousedown", (event) => {
      if (event.detail > 0) event.preventDefault();
    });

    summary.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      setOpen(item, willOpen);
      syncSplit();
      summary.blur();

      if (willOpen) {
        // Wait a frame so the opened panel lays out before scrolling.
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() => {
          item.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });
        });
      }
    });
  });

  syncSplit();
});

// Case study arch — scroll-linked title/panel motion (after load enter)
(() => {
  const arch = document.querySelector(".case-arch");
  if (!arch) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = arch.getBoundingClientRect();
    const height = Math.max(arch.offsetHeight, 1);
    // 0 at top of page / arch fully visible; 1 once mostly scrolled past
    const progress = Math.min(1, Math.max(0, -rect.top / (height * 0.7)));
    arch.style.setProperty("--arch-scroll", progress.toFixed(4));
    arch.classList.toggle("is-scrolling", progress > 0.01);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  if (document.body.classList.contains("is-ready")) {
    update();
  } else {
    const readyObserver = new MutationObserver(() => {
      if (!document.body.classList.contains("is-ready")) return;
      readyObserver.disconnect();
      window.setTimeout(update, 1400);
    });
    readyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
})();

// Beem home widget embed — match frame height to scaled prototype content
(() => {
  const embeds = Array.from(document.querySelectorAll("[data-beem-proto-embed]"));
  if (!embeds.length) return;

  const applyHeight = (embed, height) => {
    // Grow with prototype content (e.g. expand-all accordion) — no viewport cap.
    const next = `${Math.ceil(height)}px`;
    embed.style.height = next;
    embed.style.minHeight = next;
    embed.style.maxHeight = "none";
    embed.style.aspectRatio = "unset";
  };

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "beem-proto-size" || typeof data.height !== "number") return;
    if (!Number.isFinite(data.height) || data.height <= 0) return;

    embeds.forEach((embed) => {
      const frame = embed.querySelector("iframe");
      if (!frame || frame.contentWindow !== event.source) return;
      applyHeight(embed, data.height);
    });
  });

  // Ask already-loaded frames to re-report size (e.g. after bfcache / late listeners)
  embeds.forEach((embed) => {
    const frame = embed.querySelector("iframe");
    if (!frame) return;
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow?.postMessage({ type: "beem-proto-request-size" }, "*");
      } catch {
        /* ignore */
      }
    });
  });
})();

// Case study image carousels (e.g. fund-flow default → hover → click)
document.querySelectorAll("[data-case-study-carousel]").forEach((root) => {
  const slides = [...root.querySelectorAll(".case-study__carousel-slide")];
  if (slides.length < 2) return;

  const labelEl = root.querySelector("[data-carousel-label]");
  const prevBtn = root.querySelector("[data-carousel-prev]");
  const nextBtn = root.querySelector("[data-carousel-next]");
  const dotsWrap = root.querySelector("[data-carousel-dots]");
  let index = Math.max(
    0,
    slides.findIndex((slide) => slide.classList.contains("is-active"))
  );

  const dots = slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "case-study__carousel-dot";
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dotsWrap?.appendChild(dot);
    return dot;
  });

  const goTo = (nextIndex) => {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle("is-active", active);
      slide.hidden = !active;
    });
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
    if (labelEl) {
      labelEl.textContent = slides[index].dataset.label || `Slide ${index + 1}`;
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;
  };

  prevBtn?.addEventListener("click", () => goTo(index - 1));
  nextBtn?.addEventListener("click", () => goTo(index + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));

  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    }
  });

  goTo(index);
});


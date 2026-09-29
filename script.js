(() => {
  const section = document.querySelector(".cinema-scroll");
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sightsTrack = document.querySelector(".sights-track");
  const sightsControls = document.querySelector(".sights-controls");
  const sightPrev = document.querySelector(".sight-prev");
  const sightNext = document.querySelector(".sight-next");
  const originalCards = Array.from(document.querySelectorAll(".sight-card"));

  let targetMouseX = 0, targetMouseY = 0;
  let mouseX = 0, mouseY = 0;
  let targetScroll = 0, smoothScroll = 0;
  let initialized = false, rafPending = false;
  let sightCards = [];
  const originalSightCount = originalCards.length;
  let activeSight = originalSightCount;

  /* ---------- Helpers ---------- */
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const smoothstep = (e0, e1, v) => { const x = clamp((v - e0) / (e1 - e0)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const segmentInOut = (s, a, b, c, d) => {
    const enter = smoothstep(a, b, s), exit = smoothstep(c, d, s);
    return { enter, exit, active: enter * (1 - exit) };
  };
  const getScrollDistance = () =>
    clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);
  const set = (name, value) => root.style.setProperty(name, String(value));

  /* ---------- Animation engine ---------- */
  function update() {
    rafPending = false;

    targetScroll = getScrollDistance();
    if (!initialized || reduceMotion.matches) { smoothScroll = targetScroll; initialized = true; }
    else { smoothScroll = lerp(smoothScroll, targetScroll, 0.14); }
    if (Math.abs(smoothScroll - targetScroll) < 0.08) smoothScroll = targetScroll;

    if (reduceMotion.matches) { mouseX = 0; mouseY = 0; }
    else {
      mouseX = lerp(mouseX, targetMouseX, 0.12);
      mouseY = lerp(mouseY, targetMouseY, 0.12);
    }

    const s = smoothScroll;
    const frame2 = segmentInOut(s, 560, 900, 1300, 1620);
    const frame3 = segmentInOut(s, 1760, 2140, 2540, 2700);
    const progress = clamp(s / 2700);
    const introExit = smoothstep(90, 650, s);
    const sightsEnterRaw = smoothstep(2760, 3560, s);
    const sightsEnter = Math.pow(sightsEnterRaw, 1.55);
    const sightsControlsEnter = smoothstep(3360, 3660, s);
    const blurActive = clamp(frame2.active + frame3.active);
    const frame2Opacity = frame2.active * (1 - frame3.enter);
    const splitDrift = Math.pow(frame2.enter, 1.5);
    const panel2Opacity = frame2.active * (1 - frame2.exit);
    const panel3Opacity = frame3.active * (1 - frame3.exit);
    const backScale = 0.76 + progress * 0.2 + frame2.enter * 0.18 + frame3.enter * 0.16;
    const sharedHeroY = progress * -74;
    const sharedHeroScale = progress * 0.23;
    const sightsScreenTop = Math.min(220, Math.max(112, window.innerHeight * 0.19)) - 50;
    const sightsParentTop = window.innerHeight - (window.innerHeight - sightsScreenTop) / backScale;

    const n4 = v => v.toFixed(4);
    const px = v => `${v.toFixed(2)}px`;

    // pointer
    set("--mx", reduceMotion.matches ? 0 : n4(mouseX));
    set("--my", reduceMotion.matches ? 0 : n4(mouseY));

    // back stack
    set("--back-opacity", n4(1 - frame2.active * 0.06));
    set("--back-x", px(mouseX * -12));
    set("--back-y", px(mouseY * -4));
    set("--back-scale", n4(backScale));
    set("--four-y", `${(10 + progress * 10).toFixed(3)}vh`);
    set("--four-scale", n4(0.78 + progress * 0.16));
    set("--bazaar-y", `${(20 - progress * 8).toFixed(3)}vh`);
    set("--blur-px", `${(blurActive * 14).toFixed(3)}px`);
    set("--back-brightness", n4(1 - blurActive * 0.255));
    set("--bazaar-blur-px", `${(frame2.active * 14).toFixed(3)}px`);
    set("--bazaar-brightness", n4(1 - frame2.active * 0.255 - frame3.active * 0.06));
    set("--bazaar-saturation", n4(1 + frame3.active * 0.18));
    set("--shade-opacity", "1");
    set("--shade-z", frame2.active > 0.02 ? "2" : "0");
    set("--shade-top-alpha", n4(blurActive * 0.465));
    set("--shade-mid-alpha", n4(blurActive * 0.42));
    set("--shade-bottom-alpha", n4(blurActive * 0.51));

    // title
    set("--title-y", px(introExit * -210));
    set("--title-scale", n4(1 - introExit * 0.08));
    set("--title-opacity", n4(1 - introExit));

    // bridge
    set("--bridge-x", `calc(-50% + ${px(mouseX * 18)})`);
    set("--bridge-y", px(mouseY * 8 + sharedHeroY - frame2.exit * 760));
    set("--bridge-bottom", `${(5 - frame2.enter * 13).toFixed(3)}vh`);
    set("--bridge-width", `${(67.2 + frame2.enter * 37.8).toFixed(3)}vw`);
    set("--bridge-scale", n4(1.02 + sharedHeroScale + frame2.exit * 0.46));

    // split frames
    set("--split-left-x", `calc(-50% + ${(-splitDrift * 46).toFixed(3)}vw + ${px(mouseX * 22)})`);
    set("--split-left-y", px(mouseY * 10 + sharedHeroY - splitDrift * 180));
    set("--split-left-scale", n4(1 + sharedHeroScale + frame2.enter * 0.74));
    set("--split-right-x", `calc(-50% + ${(splitDrift * 46).toFixed(3)}vw + ${px(mouseX * 22)})`);
    set("--split-right-y", px(mouseY * 10 + sharedHeroY - splitDrift * 180));
    set("--split-right-scale", n4(1 + sharedHeroScale + frame2.enter * 0.74));

    // frame two
    set("--frame2-opacity", n4(frame2Opacity));
    set("--frame2-x", `calc(-50% + ${px(mouseX * 10)})`);
    set("--frame2-y", `calc(-50% + ${px(mouseY * 8 - frame2.exit * 150)})`);
    set("--frame2-scale", n4(1.06 + frame2.enter * 0.08 + frame2.exit * 0.08));

    // copy + panels
    set("--intro-copy-y", px(introExit * 90));
    set("--intro-copy-opacity", n4(1 - introExit));
    set("--panel2-opacity", n4(panel2Opacity));
    set("--panel2-y", `calc(-50% + ${px(-frame2.exit * 86 + (1 - frame2.enter) * 58)})`);
    set("--panel3-opacity", n4(panel3Opacity));
    set("--panel3-y", `calc(-50% + ${px(-frame3.exit * 86 + (1 - frame3.enter) * 58)})`);

    // sights
    set("--sights-opacity", n4(sightsEnter));
    set("--sights-controls-opacity", n4(sightsControlsEnter));
    sightsControls.classList.toggle("is-ready", sightsControlsEnter > 0.98);
    set("--sights-visibility", sightsEnter > 0.01 ? "visible" : "hidden");
    set("--sights-y", "0px");
    set("--sights-enter-x", `${((1 - sightsEnter) * 420).toFixed(3)}vw`);
    set("--sights-scale", (1 / backScale).toFixed(5));
    set("--sights-top", px(sightsParentTop));
    set("--sights-screen-top", px(sightsScreenTop));

    if (
      Math.abs(smoothScroll - targetScroll) > 0.08 ||
      Math.abs(mouseX - targetMouseX) > 0.001 ||
      Math.abs(mouseY - targetMouseY) > 0.001
    ) requestTick();
  }

  function requestTick() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(update);
  }

  /* ---------- Infinite slider ---------- */
  function setupSightSlider() {
    sightsTrack.replaceChildren();
    for (let setIndex = 0; setIndex < 3; setIndex++) {
      originalCards.forEach((card, cardIndex) => {
        const clone = card.cloneNode(true);
        clone.dataset.sightIndex = setIndex * originalSightCount + cardIndex;
        sightsTrack.append(clone);
      });
    }
    sightCards = Array.from(sightsTrack.children);
    activeSight = originalSightCount;
    sightCards.forEach(card => {
      card.addEventListener("click", () => selectSightCard(card));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSightCard(card); }
      });
    });
    sightsTrack.addEventListener("transitionend", e => {
      if (e.target === sightsTrack && e.propertyName === "transform") normalizeSightSlider();
    });
    updateSightSlider();
  }

  function updateSightSlider() {
    if (!sightCards.length) return;
    const cardWidth = sightCards[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(sightsTrack).columnGap || "0") || 0;
    set("--sights-shift", `${-(cardWidth + gap) * activeSight}px`);
    sightCards.forEach((card, i) => card.classList.toggle("is-active", i === activeSight));
  }

  function moveSightSlider(dir) { activeSight += dir; updateSightSlider(); }

  function selectSightCard(card) {
    const i = Number(card.dataset.sightIndex);
    if (Number.isFinite(i)) { activeSight = i; updateSightSlider(); }
  }

  function jumpSightSlider(i) {
    sightsTrack.classList.add("is-jumping");
    activeSight = i;
    updateSightSlider();
    requestAnimationFrame(() => requestAnimationFrame(() => sightsTrack.classList.remove("is-jumping")));
  }

  function normalizeSightSlider() {
    if (activeSight >= originalSightCount * 2) jumpSightSlider(activeSight - originalSightCount);
    else if (activeSight < originalSightCount) jumpSightSlider(activeSight + originalSightCount);
  }

  /* ---------- Menu → scroll positions (the target ids live in the scrub, not the DOM) ---------- */
  const stops = { "#cinema": 0, "#bridge": 1100, "#bazaar": 2340, "#routes": 3700 };
  document.querySelectorAll(".site-logo, .site-nav a").forEach(a => {
    a.addEventListener("click", e => {
      const y = stops[a.getAttribute("href")];
      if (y === undefined) return;
      e.preventDefault();
      const top = window.scrollY + section.getBoundingClientRect().top + y;
      window.scrollTo({ top, behavior: reduceMotion.matches ? "auto" : "smooth" });
    });
  });

  /* ---------- Listeners ---------- */
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", () => { updateSightSlider(); requestTick(); });
  window.addEventListener("pointermove", e => {
    targetMouseX = e.clientX / window.innerWidth - 0.5;
    targetMouseY = e.clientY / window.innerHeight - 0.5;
    requestTick();
  }, { passive: true });
  sightPrev.addEventListener("click", () => moveSightSlider(-1));
  sightNext.addEventListener("click", () => moveSightSlider(1));

  setupSightSlider();
  requestTick();
})();

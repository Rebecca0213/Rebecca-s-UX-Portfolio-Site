(() => {
  const BASE = /\/case-studies(\/|$)/.test(window.location.pathname) ? "../" : "";
  const asset = (path) => {
    if (!path) return "";
    const [pathname, search = ""] = path.split("?");
    const encoded = pathname
      .split("/")
      .map((part) => (part ? encodeURIComponent(part) : ""))
      .join("/");
    return `${BASE}${search ? `${encoded}?${search}` : encoded}`;
  };
  const bodyClass = () => document.body.className;
  const isHome = () => /\bpage-home\b/.test(bodyClass());
  const hideConceptFolders = () => isHome() || /\bpage-works\b/.test(bodyClass());
  const isCompactLoader = () => /\bpage-404\b/.test(bodyClass());

  const activeNav = () => {
    const cls = bodyClass();
    if (/\bpage-works\b/.test(cls) || /\bpage-case-study\b/.test(cls)) return "works";
    if (/\bpage-blog\b/.test(cls)) return "blog";
    if (/\bpage-about\b/.test(cls)) return "about";
    if (/\bpage-contact\b/.test(cls)) return "contact";
    return "";
  };

  const navLink = (file, key, label) => {
    const current = activeNav() === key ? ' aria-current="page"' : "";
    return `<a href="${asset(file)}"${current}>${label}</a>`;
  };

  const stickyNote = () => `
                <aside class="sticky-note sticky-note--works" aria-label="Project update">
                  <div class="sticky-note__bar" aria-hidden="true">
                    <span class="sticky-note__grip"></span>
                    <span class="sticky-note__menu"></span>
                  </div>
                  <div class="sticky-note__body">
                    <p class="sticky-note__text">This project launched in Q2. I am actively compiling the full post launch data metrics and UX documentation. Full case study coming <strong>late next week! (artifacts can be shared in interviews in the meantime)</strong></p>
                  </div>
                  <span class="sticky-note__resize" aria-hidden="true"></span>
                </aside>`;

  const worksFolder = (id, title, label = "", coverVideo = "") => {
    const labelMarkup = label
      ? `<div class="folder__label"><span class="folder__label-text">${label}</span></div>`
      : "";
    const coverMarkup = coverVideo
      ? `<video class="folder__cover-video" src="${asset(coverVideo)}" autoplay muted defaultMuted loop playsinline webkit-playsinline preload="auto" aria-hidden="true"></video>`
      : "";
    return `
                  <div class="folder folder--works${coverVideo ? " folder--works-has-cover" : ""}">
                    <svg class="folder__back" viewBox="0 0 300 275.362" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="works-back-grad-${id}" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="rgb(74, 164, 222)" />
                          <stop offset="50%" stop-color="rgb(56, 146, 208)" />
                          <stop offset="100%" stop-color="rgb(42, 130, 192)" />
                        </linearGradient>
                        <linearGradient id="works-back-hi-${id}" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="rgba(255, 255, 255, 0.28)" />
                          <stop offset="18%" stop-color="rgba(255, 255, 255, 0)" />
                        </linearGradient>
                      </defs>
                      <path d="M 22.979,24 L 95,24 C 113,24 117,44 137,44 L 277.021,44 Q 300,44 300,66.979 L 300,233.021 Q 300,256 277.021,256 L 22.979,256 Q 0,256 0,233.021 L 0,46.979 Q 0,24 22.979,24 Z" fill="url(#works-back-grad-${id})" />
                      <path d="M 22.979,24 L 95,24 C 113,24 117,44 137,44 L 277.021,44 Q 300,44 300,66.979 L 300,233.021 Q 300,256 277.021,256 L 22.979,256 Q 0,256 0,233.021 L 0,46.979 Q 0,24 22.979,24 Z" fill="url(#works-back-hi-${id})" />
                    </svg>
                    <div class="folder__front">
                      <div class="folder__front-face">${coverMarkup}</div>
                      <div class="folder__front-shine">${labelMarkup}</div>
                    </div>
                    <div class="folder__ridge folder__ridge--upper" aria-hidden="true"></div>
                    <div class="folder__ridge folder__ridge--lower" aria-hidden="true"></div>
                  </div>`;
  };

  const worksName = (project, client = "", shipped = "", concept = false, shipLabel = "Shipped") => {
    const primary = client ? `${project} x ${client}` : project;
    const metaMarkup = shipped
      ? `<span class="works__name-meta"> / ${shipLabel} ${shipped}</span>`
      : concept
        ? `<span class="works__name-meta"> / Innovative Concept</span>`
        : "";
    return `<h3 class="works__name"><span class="works__name-primary">${primary}</span>${metaMarkup}</h3>`;
  };

  const shot = (src, extraClass) => `
                    <div class="works__shot${extraClass ? ` ${extraClass}` : ""}">
                      <img src="${asset(src)}" alt="" loading="lazy" />
                    </div>`;

  const videoShot = (src, poster) => `
                    <div class="works__shot works__shot--preview works__shot--video">
                      <video
                        src="${asset(src)}"
                        ${poster ? `poster="${asset(poster)}"` : ""}
                        autoplay
                        muted
                        loop
                        playsinline
                        preload="auto"
                      ></video>
                    </div>`;

  const plFlow = () => `
                      <div class="pl-flow" aria-hidden="true">
                        <img class="pl-flow__shot pl-flow__shot--home" src="${asset("assets/case-studies/parallel-life/homepage.png?v=2")}" alt="" />
                        <img class="pl-flow__shot pl-flow__shot--baseline" src="${asset("assets/case-studies/parallel-life/baseline-screen.png")}" alt="" />
                        <img class="pl-flow__shot pl-flow__shot--chat" src="${asset("assets/case-studies/parallel-life/assistant-chat.png")}" alt="" />
                        <img class="pl-flow__shot pl-flow__shot--voice" src="${asset("assets/case-studies/parallel-life/assistant-voice.png")}" alt="" />
                        <img class="pl-flow__shot pl-flow__shot--think" src="${asset("assets/case-studies/parallel-life/assistant-thinking.png")}" alt="" />
                        <span class="pl-flow__orb-spin"></span>
                        <span class="pl-flow__pointer">
                          <svg viewBox="0 0 24 25" fill="none">
                            <path d="M8.75 20L5.62 4.04L20 11.92l-7.08 2.05L8.75 20Z" fill="#111" stroke="#fff" />
                          </svg>
                        </span>
                      </div>`;

  const capFlow = () => {
    const nav = [
      "Overview",
      "Portfolio holdings",
      "Risk profile",
      "Drawdown analysis",
      "Asset allocation",
    ]
      .map((label, i) => `<li class="cap-flow__item cap-flow__item--${i + 1}">${label}</li>`)
      .join("");

    const screen = (name, src) =>
      `<img class="cap-flow__screen cap-flow__screen--${name}" src="${asset(src)}" alt="" loading="lazy" />`;

    return `
                      <div class="cap-flow" aria-hidden="true">
                        <div class="cap-flow__bar">
                          <span class="cap-flow__dot"></span>
                          <span class="cap-flow__dot"></span>
                          <span class="cap-flow__dot"></span>
                          <span class="cap-flow__tab">Investment proposal — prepared for Roy</span>
                        </div>
                        <div class="cap-flow__body">
                          <nav class="cap-flow__nav">
                            <span class="cap-flow__logo">capintel</span>
                            <span class="cap-flow__pill"></span>
                            <ul class="cap-flow__items">${nav}</ul>
                            <span class="cap-flow__by">Prepared by Sam A.</span>
                          </nav>
                          <div class="cap-flow__screens">
                            ${screen("overview", "assets/case-studies/capintel/works-pop/overview.png?v=3")}
                            ${screen("holdings", "assets/case-studies/capintel/phs-flow-default.png")}
                            ${screen("hover", "assets/case-studies/capintel/phs-flow-hover.png")}
                            ${screen("chart", "assets/case-studies/capintel/phs-flow-click.png")}
                            ${screen("risk", "assets/case-studies/capintel/works-pop/risk-profile.png?v=3")}
                            ${screen("drawdown", "assets/case-studies/capintel/works-pop/drawdown.png?v=3")}
                            ${screen("allocation", "assets/case-studies/capintel/works-pop/asset-allocation.png?v=3")}
                          </div>
                          <span class="cap-flow__pointer">
                            <svg viewBox="0 0 24 25" fill="none">
                              <path d="M8.75 20L5.62 4.04L20 11.92l-7.08 2.05L8.75 20Z" fill="#111" stroke="#fff" />
                            </svg>
                          </span>
                        </div>
                      </div>`;
  };

  const peekFolder = ({
    id,
    project,
    client = "",
    shipped = "",
    href,
    preview,
    previewVideo,
    previewKind,
    extras = [],
    inProgress = false,
    locked = false,
    concept = false,
    shipLabel = "Shipped",
    coverVideo = "",
  }) => {
    const isLocked = inProgress || locked;
    const extraShots = extras
      .map((src, i) => shot(src, `works__shot--${i + 1}`))
      .join("");
    const previewShot =
      previewKind === "pl-flow"
        ? `<div class="works__shot works__shot--preview works__shot--flow">${plFlow()}</div>`
        : previewVideo?.pocket
          ? videoShot(previewVideo.src, previewVideo.poster)
          : preview
            ? shot(preview, "works__shot--preview")
            : "";
    const cardInner = `
                  <div class="works__card">
                    <div class="works__shots" aria-hidden="true">
                      ${extraShots}
                      ${previewShot}
                    </div>
                    ${worksFolder(
                      id,
                      project,
                      inProgress ? "case study in progress" : "",
                      coverVideo,
                    )}
                  </div>
                  ${worksName(project, client, shipped, concept, shipLabel)}`;
  const link = isLocked
      ? `<div class="works__card-link works__card-link--inert" aria-disabled="true">${cardInner}</div>`
      : `<a class="works__card-link" href="${asset(href)}">${cardInner}</a>`;
    return `
              <article class="works__item works__item--peek${isLocked ? " works__item--locked" : ""}">
                ${link}
              </article>`;
  };

  const loaderPanels = () => {
    if (isCompactLoader()) {
      return `
          <div class="page-loader__panel page-loader__panel--blog">
            <div class="page-loader__blog">
              <span class="skel skel--circle"></span>
              <span class="skel skel--eyebrow"></span>
              <span class="skel skel--title"></span>
              <span class="skel skel--line-mid"></span>
              <span class="skel skel--line-short"></span>
              <span class="skel skel--cta"></span>
            </div>
          </div>`;
    }

    return `
          <div class="page-loader__panel page-loader__panel--home">
            <div class="page-loader__hero">
              <span class="skel skel--title"></span>
              <span class="skel skel--subtitle"></span>
              <span class="skel skel--circle"></span>
            </div>
            <div class="page-loader__works">
              <span class="skel skel--heading"></span>
              <div class="page-loader__cards">
                <span class="skel skel--folder"></span>
                <span class="skel skel--folder"></span>
                <span class="skel skel--folder"></span>
              </div>
            </div>
          </div>

          <div class="page-loader__panel page-loader__panel--works">
            <div class="page-loader__works">
              <span class="skel skel--heading"></span>
              <div class="page-loader__cards">
                <span class="skel skel--folder"></span>
                <span class="skel skel--folder"></span>
                <span class="skel skel--folder"></span>
                <span class="skel skel--folder"></span>
              </div>
            </div>
          </div>

          <div class="page-loader__panel page-loader__panel--blog">
            <div class="page-loader__blog">
              <span class="skel skel--circle"></span>
              <span class="skel skel--eyebrow"></span>
              <span class="skel skel--title"></span>
              <span class="skel skel--line-mid"></span>
              <span class="skel skel--line-short"></span>
              <span class="skel skel--cta"></span>
            </div>
          </div>

          <div class="page-loader__panel page-loader__panel--about">
            <div class="page-loader__about">
              <span class="skel skel--photo"></span>
              <div class="page-loader__copy">
                <span class="skel skel--eyebrow"></span>
                <span class="skel skel--heading"></span>
                <span class="skel skel--subtitle"></span>
                <span class="skel skel--line"></span>
                <span class="skel skel--line"></span>
                <span class="skel skel--line-mid"></span>
                <span class="skel skel--line-short"></span>
                <span class="skel skel--cta"></span>
              </div>
            </div>
          </div>

          <div class="page-loader__panel page-loader__panel--contact">
            <div class="page-loader__contact">
              <span class="skel skel--eyebrow"></span>
              <span class="skel skel--title"></span>
              <span class="skel skel--line-mid"></span>
              <span class="skel skel--line-short"></span>
              <span class="skel skel--calendar"></span>
            </div>
          </div>

          <div class="page-loader__panel page-loader__panel--case">
            <div class="page-loader__case">
              <div class="page-loader__toc">
                <span class="skel skel--toc"></span>
                <span class="skel skel--toc"></span>
                <span class="skel skel--toc"></span>
                <span class="skel skel--toc"></span>
                <span class="skel skel--toc"></span>
              </div>
              <div class="page-loader__copy">
                <span class="skel skel--heading"></span>
                <span class="skel skel--line"></span>
                <span class="skel skel--line"></span>
                <span class="skel skel--line-mid"></span>
                <span class="skel skel--line"></span>
                <span class="skel skel--line-short"></span>
              </div>
            </div>
          </div>`;
  };

  const html = {
    loader() {
      if (isHome()) {
        // The island is the homepage now, so the entrance video no longer plays over it.
        document.body.classList.remove("is-loading");
        document.body.classList.add("is-ready");
        return "";
      }

      return `
    <div
      class="page-loader"
      id="page-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div class="page-loader__progress" aria-hidden="true"></div>
      <div class="page-loader__runner-scene" aria-hidden="true">
        <div class="page-loader__orbit">
          <div class="page-loader__orbit-arm">
            <div class="page-loader__runner">
              <img
                class="page-loader__runner-img"
                src="${asset("assets/hero/rebecca-portrait-run.png?v=dress")}"
                alt=""
                width="694"
                height="967"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="page-loader__shell" aria-hidden="true">
        <div class="page-loader__nav">
          <span class="skel skel--logo"></span>
          <div class="page-loader__nav-links">
            <span class="skel skel--nav"></span>
            <span class="skel skel--nav"></span>
            <span class="skel skel--nav"></span>
            <span class="skel skel--nav"></span>
          </div>
        </div>
        <div class="page-loader__content">${loaderPanels()}
        </div>
      </div>
    </div>`;
    },

    nav() {
      return `
    <header class="nav">
      <a href="${asset("index.html")}" class="nav__logo">
        Rebecca S<span class="accent-z accent-z--interactive" tabindex="0">z</span>eto
      </a>
      <nav class="nav__links" aria-label="Primary">
        ${navLink("works.html", "works", "Works")}
        ${navLink("blog.html", "blog", "Blog")}
        ${navLink("about.html", "about", "About Me")}
        ${navLink("contact.html", "contact", "Contact")}
      </nav>
    </header>`;
    },

    footer() {
      return `
      <footer class="site-footer" id="contact">
        <div class="site-footer__stage" aria-hidden="false">
          <div class="site-footer__blob">
            <div class="site-footer__pill site-footer__pill--research">Research</div>
            <div class="site-footer__pill site-footer__pill--frontend">Frontend Development</div>
            <div class="site-footer__pill site-footer__pill--systems">Build Systems</div>
            <div class="site-footer__pill site-footer__pill--branding">Branding</div>

            <img
              class="site-footer__figure site-footer__figure--left"
              src="${asset("assets/footer/figure-left.svg")}"
              alt=""
              width="166"
              height="292"
            />
            <img
              class="site-footer__figure site-footer__figure--right"
              src="${asset("assets/footer/figure-right.svg")}"
              alt=""
              width="215"
              height="292"
            />

            <img
              class="site-footer__sparkle"
              src="${asset("assets/footer/sparkle.svg")}"
              alt=""
              width="76"
              height="52"
            />

            <h2 class="site-footer__heading">
              <div class="site-footer__pill site-footer__pill--ux">UX Design</div>
              Let's design some digital
              <span class="site-footer__script">wonder.</span>
            </h2>

            <div class="site-footer__cta">
              <p>
                Nothing great is built alone, so why not make<br />
                the next big thing together?
              </p>
              <p>
                Feel free to reach out to me personally via<br />
                <a href="mailto:rebeccaszetodesign@gmail.com">sending a message</a> or <a href="${asset("contact.html")}#book">schedule a time</a> to say<br />
                hello.
              </p>
            </div>
          </div>
        </div>
      </footer>`;
    },

    cursor() {
      return `
    <div class="hero__cursor" aria-hidden="true">
      <span class="hero__cursor-label">You</span>
      <svg class="hero__cursor-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none" aria-hidden="true">
        <g filter="url(#filter0_d_site_cursor)">
          <path d="M8.75418 20L5.62291 4.04092L20 11.9182L12.9181 13.9727L8.75418 20Z" fill="black"/>
          <path d="M8.75418 20L5.62291 4.04092L20 11.9182L12.9181 13.9727L8.75418 20Z" stroke="white"/>
        </g>
        <defs>
          <filter id="filter0_d_site_cursor" x="2.9248" y="2.09064" width="20.3721" height="22.1734" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="1"/>
            <feGaussianBlur stdDeviation="1"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_site_cursor"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_site_cursor" result="shape"/>
          </filter>
        </defs>
      </svg>
    </div>`;
    },

    featuredWorks() {
      return `
      <section class="works" id="works">
        <div class="works__layout">
          <div class="works__main">
            <div class="works__header">
              <h2 class="works__title">Featured Works</h2>
              <div class="works__hint" aria-hidden="true">
                <div class="works__arrow">
                  <div class="works__arrow-inner">
                    <svg
                      class="works__arrow-squiggle"
                      width="60"
                      height="56"
                      viewBox="0 0 60 56"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        d="M 3.107 55.057 C 1.006 51.662 0 47.945 0 43.291 C 0 39.106 0.473 37.058 2.249 33.487 C 3.255 31.438 3.965 30.502 6.391 28.102 C 9.172 25.351 9.349 25.116 9.645 23.565 C 10.74 17.536 17.19 11.039 26.155 6.883 C 34.261 3.137 47.427 0.093 55.978 0.005 C 58.907 -0.024 59.647 0.064 59.883 0.415 C 60.298 1.088 59.795 1.205 55.297 1.586 C 44.765 2.405 34.261 4.981 26.569 8.61 C 20.651 11.361 15.77 15.253 13.196 19.234 C 12.19 20.843 10.947 23.799 11.184 24.063 C 11.272 24.151 12.308 23.917 13.491 23.565 C 16.036 22.834 17.515 22.804 19.527 23.39 C 21.628 24.004 22.93 25.409 23.137 27.312 C 23.314 29.243 23.078 30.033 21.983 31.263 C 20.74 32.667 18.965 33.282 16.628 33.136 C 13.521 32.931 11.332 31.467 10.267 28.921 C 9.971 28.219 9.556 27.633 9.32 27.633 C 8.728 27.633 5.592 30.97 4.438 32.872 C 1.036 38.375 0.68 46.16 3.491 52.979 C 4.083 54.384 4.468 55.642 4.379 55.759 C 4.083 56.228 3.728 56.023 3.107 55.057 Z M 18.817 31.438 C 20.208 31.028 21.717 29.36 21.717 28.19 C 21.717 25.907 19.882 24.56 16.687 24.59 C 14.024 24.59 11.361 25.76 11.361 26.931 C 11.361 28.394 12.752 30.238 14.409 31.028 C 16.095 31.789 17.131 31.877 18.817 31.438 Z"
                      />
                    </svg>
                    <svg
                      class="works__arrow-plane"
                      width="34"
                      height="28"
                      viewBox="0 0 34 28"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        d="M 12.825 27.638 C 12.484 27.191 11.917 25.315 11.066 21.86 L 10.441 19.418 L 5.873 17.572 C 0.624 15.457 0 15.1 0 14.296 C 0 13.343 1.192 12.806 5.079 12.062 C 7.122 11.675 8.909 11.288 9.079 11.168 C 9.448 10.93 9.448 8.458 9.051 4.259 C 8.682 0.328 8.796 0 10.583 0 C 11.207 0 15.577 1.132 20.258 2.532 C 24.968 3.902 29.678 5.242 30.785 5.51 C 33.14 6.076 34.105 6.671 33.991 7.446 C 33.934 7.773 32.714 9.113 31.239 10.483 C 29.763 11.853 26.642 15.1 24.316 17.721 C 17.194 25.702 16.598 26.328 15.634 27.191 C 14.669 28.055 13.335 28.264 12.825 27.638 Z M 18.074 22.128 C 19.918 20.044 22.642 17.006 24.117 15.398 C 25.593 13.789 26.841 12.33 26.898 12.181 C 27.011 11.913 25.593 12.568 17.081 16.738 C 13.335 18.584 12.2 19.269 12.286 19.627 C 13.392 23.766 14.101 25.911 14.385 25.911 C 14.555 25.911 16.201 24.213 18.074 22.128 Z M 20.684 13.194 C 27.976 9.352 29.111 8.637 27.465 8.845 C 21.961 9.56 13.052 11.496 10.214 12.598 C 9.193 12.985 7.491 13.491 6.384 13.7 C 5.306 13.938 4.284 14.206 4.142 14.325 C 4.001 14.445 4.965 15.07 6.27 15.666 C 7.547 16.291 9.136 17.095 9.76 17.453 L 10.895 18.078 L 12.314 17.482 C 13.108 17.125 16.882 15.219 20.684 13.194 Z M 13.874 9.828 C 15.889 9.292 26.529 7.148 27.323 7.148 C 28.061 7.118 26.671 6.582 23.55 5.659 C 21.762 5.152 18.216 3.991 15.662 3.097 C 13.137 2.204 10.924 1.489 10.753 1.489 C 10.441 1.489 10.47 2.532 10.952 8.428 C 11.037 9.53 11.236 10.424 11.406 10.424 C 11.548 10.424 12.683 10.156 13.874 9.828 Z"
                      />
                    </svg>
                  </div>
                </div>
                <span class="works__hint-text">hover and click</span>
              </div>
            </div>

            <div class="works__list">
              ${peekFolder({
                id: 1,
                project: "Digital Financial Proposal",
                client: "Capintel",
                shipped: "Feb 2022",
                href: "case-studies/digital-financial-proposal.html",
              })}
              ${peekFolder({
                id: 2,
                project: "Member Rewards Program",
                client: "Beem",
                shipped: "April–August 2026",
                href: "case-studies/member-rewards-program.html",
                coverVideo: "assets/case-studies/beem/member-rewards-cover.mp4?v=1",
              })}
              ${peekFolder({
                id: 3,
                project: "Digital Banking App",
                client: "Beem",
                href: "case-studies/digital-banking-app.html",
                inProgress: true,
              })}
              ${peekFolder({
                id: 4,
                project: "Parallel Life",
                client: "Beem",
                href: "case-studies/parallel-life.html",
                locked: true,
                shipped: "Summer 2027",
                shipLabel: "Shipping",
              })}
              ${
                hideConceptFolders()
                  ? ""
                  : `${peekFolder({
                      id: 5,
                      project: "Ramp (Concept)",
                      href: "case-studies/ramp.html",
                    })}
              ${peekFolder({
                id: 6,
                project: "OpenAI (Concept)",
                href: "case-studies/openai.html",
              })}
              ${peekFolder({
                id: 7,
                project: "OpenAI Hardware (Concept)",
                href: "case-studies/openai-hardware.html",
              })}
              ${peekFolder({
                id: 8,
                project: "Figma (Concept)",
                href: "case-studies/figma.html",
              })}`
              }
            </div>
          </div>
        </div>
      </section>`;
    },

    otherWorks() {
      return `
      <section class="other-works" id="other-works">
        <div class="other-works__inner">
          <h2 class="other-works__title">Other works</h2>
          <div class="other-works__list">
            <article class="other-works__card">
              <div class="other-works__meta">
                <h3 class="other-works__card-title">Managed Investing Marketing Page</h3>
                <p class="other-works__client">Questrade</p>
              </div>
              <div class="other-works__image">
                <div class="other-works__image-slot other-works__image-slot--cover">
                  <img
                    src="${asset("assets/case-studies/questrade/marketing-pages-cover.png?v=hero-invest")}"
                    alt="Questrade — Managed Investing Marketing Page case study"
                    width="422"
                    height="336"
                  />
                </div>
              </div>
              <p class="other-works__blurb">Increased conversion by 40% and decreased bounce rate by ~50%.</p>
              <div class="other-works__footer">
                <a class="other-works__open" href="${asset("case-studies/marketing-pages.html")}">Open</a>
              </div>
            </article>

            <article class="other-works__card other-works__card--awarded">
              <div class="other-works__meta">
                <h3 class="other-works__card-title">LinkedIn Mentorship: A Redesign</h3>
                <p class="other-works__client">A personal project</p>
              </div>
              <div class="other-works__image">
                <div class="other-works__image-slot other-works__image-slot--cover other-works__image-slot--cover-center">
                  <img
                    src="${asset("assets/case-studies/linkedin/linkedin-mentorship-cover.png?v=2")}"
                    alt="LinkedIn Mentorship — personal redesign project cover"
                    width="518"
                    height="652"
                  />
                </div>
                <img
                  class="other-works__award"
                  src="${asset("assets/about/ux-design-awards-nominated-2022.png?v=original")}"
                  alt="UX Design Awards nominated 2022"
                  width="204"
                  height="308"
                />
              </div>
              <p class="other-works__blurb">LinkedIn Mentorship lets job seekers book 1-on-1 sessions with accredited professionals for career advice, portfolio reviews, and Q&amp;A.</p>
              <div class="other-works__footer">
                <a class="other-works__open" href="${asset("case-studies/linkedin-redesign.html")}">Open</a>
              </div>
            </article>

            <article class="other-works__card">
              <div class="other-works__meta">
                <h3 class="other-works__card-title">Social Startup Portal: Volunteers at Scale</h3>
                <p class="other-works__client">Meaningful Work</p>
              </div>
              <div class="other-works__image">
                <div class="other-works__image-slot other-works__image-slot--cover other-works__image-slot--cover-center">
                  <img
                    src="${asset("assets/case-studies/social-startup-portal/social-startup-portal-cover.png?v=1")}"
                    alt="MeaningfulWork — Social Startup Portal opportunity detail cover"
                    width="1024"
                    height="647"
                  />
                </div>
              </div>
              <p class="other-works__blurb">Management solution app that helps nonprofits/companies manage opportunities and volunteers.</p>
              <div class="other-works__footer">
                <a class="other-works__open" href="${asset("case-studies/social-startup-portal.html")}">Open</a>
              </div>
            </article>
          </div>
        </div>
      </section>`;
    },

    beemArch(title, options = {}) {
      const { heroVideo = "" } = options;
      const src = (name) => asset(`assets/case-studies/beem/shapes/${name}`);
      const heroMarkup = heroVideo
        ? `
        <figure class="case-study__hero-video" aria-label="${title} product demo">
          <video
            src="${asset(heroVideo)}"
            autoplay
            muted
            loop
            playsinline
            preload="auto"
          ></video>
        </figure>`
        : "";
      return `
      <section class="case-arch${heroVideo ? " case-arch--has-hero-video" : ""}" aria-label="Case study title">
        ${heroMarkup}
        <div class="case-arch__panel">
          <div class="case-arch__collage case-arch__collage--beem" aria-hidden="true">
            <img class="case-arch__shape case-arch__shape--1" src="${src("bubble.svg")}" alt="" width="120" height="138" />
            <img class="case-arch__shape case-arch__shape--2" src="${src("stack.svg")}" alt="" width="126" height="113" />
            <img class="case-arch__shape case-arch__shape--3" src="${src("pill.svg")}" alt="" width="175" height="125" />
            <img class="case-arch__shape case-arch__shape--4" src="${src("star.svg")}" alt="" width="117" height="129" />
            <img class="case-arch__shape case-arch__shape--5" src="${src("chevron.svg")}" alt="" width="87" height="126" />
            <img class="case-arch__shape case-arch__shape--6" src="${src("bubble.svg")}" alt="" width="110" height="127" />
            <img class="case-arch__shape case-arch__shape--7" src="${src("stack.svg")}" alt="" width="115" height="104" />
            <img class="case-arch__shape case-arch__shape--8" src="${src("pill.svg")}" alt="" width="150" height="108" />
            <img class="case-arch__shape case-arch__shape--9" src="${src("star-dark.svg")}" alt="" width="100" height="110" />
            <img class="case-arch__shape case-arch__shape--10" src="${src("chevron.svg")}" alt="" width="70" height="100" />
            <img class="case-arch__shape case-arch__shape--11" src="${src("star-lilac.svg")}" alt="" width="90" height="99" />
            <img class="case-arch__shape case-arch__shape--12" src="${src("bubble.svg")}" alt="" width="95" height="110" />
            <img class="case-arch__shape case-arch__shape--13" src="${src("stack.svg")}" alt="" width="100" height="90" />
            <img class="case-arch__shape case-arch__shape--14" src="${src("pill.svg")}" alt="" width="130" height="93" />
            <img class="case-arch__shape case-arch__shape--15" src="${src("star-dark.svg")}" alt="" width="85" height="94" />
            <img class="case-arch__shape case-arch__shape--16" src="${src("chevron.svg")}" alt="" width="64" height="92" />
          </div>
          <div class="case-arch__intro">
            <img
              class="case-arch__logo"
              src="${asset("assets/case-studies/beem/beem-logo-white.png")}"
              alt="Beem Credit Union"
              width="215"
              height="58"
            />
            <h1 class="case-arch__title">${title}</h1>
          </div>
          <div class="case-arch__curve" aria-hidden="true">
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
              <path fill="currentColor" d="M0 120 Q720 0 1440 120 L1440 120 L0 120 Z"></path>
            </svg>
          </div>
        </div>
      </section>`;
    },

    plainArch(title, subtitle) {
      const sub = subtitle ? `<p class="case-arch__subtitle">${subtitle}</p>` : "";
      return `
      <section class="case-arch" aria-label="Case study title">
        <div class="case-arch__panel">
          <div class="case-arch__intro">
            <h1 class="case-arch__title">${title}</h1>
            ${sub}
          </div>
          <div class="case-arch__curve" aria-hidden="true">
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
              <path fill="currentColor" d="M0 120 Q720 0 1440 120 L1440 120 L0 120 Z"></path>
            </svg>
          </div>
        </div>
      </section>`;
    },
  };

  const write = (chunk) => document.write(chunk);

  window.Layout = {
    loader: () => write(html.loader()),
    nav: () => write(html.nav()),
    footer: () => write(html.footer()),
    cursor: () => write(html.cursor()),
    featuredWorks: () => {
      try {
        write(html.featuredWorks());
      } catch (error) {
        console.error("Layout.featuredWorks failed", error);
        write(`
      <section class="works works--fallback" id="works">
        <div class="works__layout">
          <div class="works__main">
            <div class="works__header">
              <h2 class="works__title">Featured Works</h2>
            </div>
            <p class="works__fallback">Featured work folders could not load. Please refresh the page.</p>
          </div>
        </div>
      </section>`);
      }
    },
    otherWorks: () => write(html.otherWorks()),
    beemArch: (title, options) => write(html.beemArch(title, options)),
    plainArch: (title, subtitle) => write(html.plainArch(title, subtitle)),
    plFlow: () => write(plFlow()),
    capFlow: () => write(capFlow()),
  };
})();

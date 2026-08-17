(() => {
  const PASSWORD = "becca";
  // Session-only storage: unlocks clear when the browser session ends (tab/window closed).
  const STORAGE_KEY = "caseStudyUnlockedSlugs";
  const LEGACY_STORAGE_KEY = "caseStudyUnlocked";
  const BACK_CONTEXT_KEY = "caseStudyLockBack";
  const PROTECTED_SLUGS = new Set([
    "marketing-pages.html",
    "social-startup-portal.html",
  ]);

  const getSlugFromPath = (path) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || "";
  };

  const getSlugFromHref = (href) => {
    try {
      const url = new URL(href, window.location.href);
      const match = url.pathname.match(/case-studies\/([^/?#]+)/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  };

  const isProtectedSlug = (slug) => PROTECTED_SLUGS.has(slug);

  const isProtectedHref = (href) => isProtectedSlug(getSlugFromHref(href));

  const isCurrentPageProtected = () => {
    if (!window.location.pathname.includes("/case-studies/")) return false;
    return isProtectedSlug(getSlugFromPath(window.location.pathname));
  };

  const getUnlockedSlugs = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();

      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  };

  const isUnlocked = (slug) => Boolean(slug) && getUnlockedSlugs().has(slug);

  const setUnlocked = (slug) => {
    if (!slug) return;

    const slugs = getUnlockedSlugs();
    slugs.add(slug);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...slugs]));
  };

  const getActiveSlug = () => {
    if (pendingHref) return getSlugFromHref(pendingHref);
    if (isCurrentPageProtected()) return getSlugFromPath(window.location.pathname);
    return "";
  };

  let pendingHref = null;
  let lockRoot = null;

  const isHomePath = (path) => /(?:^|\/)index\.html$/.test(path) || /\/$/.test(path);

  const isWorksPath = (path) => path.includes("works.html");

  const initBackContext = () => {
    const path = window.location.pathname;

    if (isHomePath(path)) {
      sessionStorage.setItem(BACK_CONTEXT_KEY, "home");
      return;
    }

    if (isWorksPath(path)) {
      sessionStorage.setItem(BACK_CONTEXT_KEY, "works");
    }
  };

  const getBackTarget = () => {
    const onCaseStudy = window.location.pathname.includes("/case-studies/");
    const stored = sessionStorage.getItem(BACK_CONTEXT_KEY);

    if (stored === "home") {
      return {
        href: onCaseStudy ? "../index.html" : "index.html",
        label: "Back to homepage",
      };
    }

    if (stored === "works") {
      return {
        href: onCaseStudy ? "../works.html" : "works.html",
        label: "Back to works",
      };
    }

    const referrer = document.referrer;

    if (referrer) {
      try {
        const refPath = new URL(referrer).pathname;

        if (isHomePath(refPath)) {
          return {
            href: onCaseStudy ? "../index.html" : "index.html",
            label: "Back to homepage",
          };
        }

        if (isWorksPath(refPath)) {
          return {
            href: onCaseStudy ? "../works.html" : "works.html",
            label: "Back to works",
          };
        }
      } catch {
        // Ignore malformed referrer URLs.
      }
    }

    return {
      href: onCaseStudy ? "../works.html" : "works.html",
      label: "Back to works",
    };
  };

  const updateBackLink = () => {
    if (!lockRoot) return;

    const back = getBackTarget();
    const link = lockRoot.querySelector(".case-study-lock__back");

    if (!link) return;

    link.href = back.href;
    link.textContent = `← ${back.label}`;
  };

  const createLockUi = () => {
    if (lockRoot) return lockRoot;

    const back = getBackTarget();

    lockRoot = document.createElement("div");
    lockRoot.className = "case-study-lock";
    lockRoot.innerHTML = `
      <div class="case-study-lock__panel" role="dialog" aria-modal="true" aria-labelledby="case-study-lock-title">
        <p class="case-study-lock__eyebrow">Portfolio access</p>
        <h2 class="case-study-lock__title" id="case-study-lock-title">This case study is password protected</h2>
        <p class="case-study-lock__lede">Enter the password to view this project.</p>
        <form class="case-study-lock__form">
          <label class="case-study-lock__label" for="case-study-lock-password">Password</label>
          <input
            class="case-study-lock__input"
            id="case-study-lock-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
          <p class="case-study-lock__error" hidden>Incorrect password. Please try again.</p>
          <button class="case-study-lock__submit" type="submit">Unlock</button>
        </form>
        <a class="case-study-lock__back" href="${back.href}">← ${back.label}</a>
      </div>
    `;

    document.body.appendChild(lockRoot);

    const form = lockRoot.querySelector(".case-study-lock__form");
    const input = lockRoot.querySelector(".case-study-lock__input");
    const error = lockRoot.querySelector(".case-study-lock__error");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();

      if (value !== PASSWORD) {
        error.hidden = false;
        input.focus();
        input.select();
        return;
      }

      error.hidden = true;
      const nextHref = pendingHref;
      setUnlocked(getActiveSlug());
      hideLock();

      if (nextHref) {
        window.location.href = nextHref;
        return;
      }

      document.documentElement.classList.remove("case-study-locked");
      input.value = "";
    });

    return lockRoot;
  };

  const showLock = ({ href = null } = {}) => {
    pendingHref = href;
    createLockUi();
    updateBackLink();
    lockRoot.classList.add("case-study-lock--open");
    document.documentElement.classList.add("case-study-locked");

    const input = lockRoot.querySelector(".case-study-lock__input");
    const error = lockRoot.querySelector(".case-study-lock__error");
    error.hidden = true;
    window.requestAnimationFrame(() => input.focus());
  };

  const hideLock = () => {
    if (!lockRoot) return;
    lockRoot.classList.remove("case-study-lock--open");
    pendingHref = null;

    if (!isCurrentPageProtected() || isUnlocked(getSlugFromPath(window.location.pathname))) {
      document.documentElement.classList.remove("case-study-locked");
    }
  };

  const initPageGate = () => {
    const slug = getSlugFromPath(window.location.pathname);
    if (!isProtectedSlug(slug) || isUnlocked(slug)) return;
    document.documentElement.classList.add("case-study-locked");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => showLock(), { once: true });
      return;
    }

    showLock();
  };

  const initLinkGate = () => {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || !isProtectedHref(href)) return;

      const slug = getSlugFromHref(href);
      if (isUnlocked(slug)) return;

      event.preventDefault();
      showLock({ href: link.href });
    });
  };

  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  initBackContext();
  initPageGate();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLinkGate, { once: true });
  } else {
    initLinkGate();
  }
})();

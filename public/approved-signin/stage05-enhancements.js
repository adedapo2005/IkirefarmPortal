(() => {
  "use strict";

  let deferredInstallPrompt = null;
  let installPromptSeen = false;
  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isChromium = /Chrome|Chromium|CriOS|Edg\//.test(ua);

  const installCopy = (button, subtitle, state, enabled) => {
    if (!button) return;
    const stateNode = button.querySelector(".gw-install-app-state");
    const textNodes = [...button.querySelectorAll("span")];
    const subtitleNode = button.querySelector(".text-gw-muted") || textNodes.find((node) =>
      node.children.length === 0 &&
      /Installation Unavailable|Add DAENEM Farms|Installed On This Device|Checking Browser|Browser Menu|Share Menu/i.test(node.textContent || "")
    );
    const disabled = !enabled;
    const ariaDisabled = enabled ? "false" : "true";
    if (button.disabled !== disabled) button.disabled = disabled;
    if (button.getAttribute("aria-disabled") !== ariaDisabled) button.setAttribute("aria-disabled", ariaDisabled);
    if (subtitleNode && subtitleNode.textContent !== subtitle) subtitleNode.textContent = subtitle;
    if (stateNode) {
      if (stateNode.textContent !== state) stateNode.textContent = state;
      const ready = enabled || state === "Installed";
      const unavailable = !enabled && state !== "Installed";
      if (stateNode.classList.contains("is-ready") !== ready) stateNode.classList.toggle("is-ready", ready);
      if (stateNode.classList.contains("is-unavailable") !== unavailable) stateNode.classList.toggle("is-unavailable", unavailable);
    }
  };

  const showInstallGuide = (message) => {
    document.querySelector(".gw-install-guide")?.remove();
    const dialog = document.createElement("div");
    dialog.className = "gw-install-guide";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Install DAENEM Farms");
    dialog.innerHTML = `
      <div class="gw-install-guide-card">
        <button type="button" class="gw-install-guide-close" aria-label="Close install guidance">×</button>
        <span class="gw-install-guide-mark">DF</span>
        <p class="gw-install-guide-kicker">DAENEM FARMS APP</p>
        <h2>Install On This Device</h2>
        <p class="gw-install-guide-copy"></p>
        <button type="button" class="gw-install-guide-done">Got It</button>
      </div>`;
    dialog.querySelector(".gw-install-guide-copy").textContent = message;
    const close = () => dialog.remove();
    dialog.querySelector(".gw-install-guide-close").addEventListener("click", close);
    dialog.querySelector(".gw-install-guide-done").addEventListener("click", close);
    dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
    document.body.appendChild(dialog);
    dialog.querySelector(".gw-install-guide-close").focus({ preventScroll: true });
  };

  const syncInstallButton = () => {
    const button = document.querySelector(".gw-install-app-btn");
    if (!button) return;
    if (!button.dataset.daenemInstallEnhanced) {
      button.dataset.daenemInstallEnhanced = "true";
      button.addEventListener("click", async (event) => {
        if (deferredInstallPrompt) {
          event.preventDefault();
          event.stopImmediatePropagation();
          await deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice.catch(() => null);
          deferredInstallPrompt = null;
          if (choice?.outcome === "accepted") {
            installCopy(button, "Installation Started", "Installing", false);
          } else {
            installCopy(button, "Install When You Are Ready", "Available", true);
          }
          return;
        }
        if (isIOS) {
          event.preventDefault();
          showInstallGuide("In Safari, tap the Share button, then choose Add to Home Screen.");
          return;
        }
        if (isChromium) {
          event.preventDefault();
          showInstallGuide("Open the browser menu and choose Install DAENEM Farms or Apps → Install this site as an app.");
        }
      }, true);
    }

    if (isStandalone()) {
      installCopy(button, "Installed On This Device", "Installed", false);
    } else if (deferredInstallPrompt) {
      installCopy(button, "Add DAENEM Farms To This Device", "Available", true);
    } else if (isIOS) {
      installCopy(button, "Use Share → Add To Home Screen", "How To Install", true);
    } else if (isChromium && !installPromptSeen) {
      if (button.dataset.daenemFallbackScheduled !== "true") {
        button.dataset.daenemFallbackScheduled = "true";
        installCopy(button, "Checking Browser Install Readiness", "Checking", false);
        window.setTimeout(() => {
          if (!deferredInstallPrompt && !isStandalone() && button.isConnected) {
            installCopy(button, "Install From The Browser Menu", "Install Guide", true);
          }
        }, 2200);
      }
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installPromptSeen = true;
    document.documentElement.dataset.daenemPwa = "ready";
    syncInstallButton();
  }, { capture: true });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.documentElement.dataset.daenemPwa = "installed";
    syncInstallButton();
  });

  const mountAssurance = () => {
    const install = document.querySelector("#employee-sign-in .gw-auth-install");
    if (!install || document.querySelector(".gw-auth-assurance-grid")) return;
    const panel = document.createElement("section");
    panel.className = "gw-auth-assurance-grid";
    panel.setAttribute("aria-label", "Gateway capabilities");
    panel.innerHTML = `
      <div class="gw-auth-assurance-head">
        <div>
          <span class="gw-auth-assurance-kicker">DAENEM CONNECTED ACCESS</span>
          <strong>One Secure Farm Workspace</strong>
        </div>
        <span class="gw-auth-assurance-status"><i aria-hidden="true"></i>Ready on every screen</span>
      </div>
      <div class="gw-auth-assurance-items">
        <div class="gw-auth-assurance-item">
          <span class="gw-auth-assurance-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span class="gw-auth-assurance-copy"><strong>Secure Access</strong><span>Protected employee gateway</span></span>
        </div>
        <div class="gw-auth-assurance-item">
          <span class="gw-auth-assurance-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 18V9"/><path d="M10 18V5"/><path d="M16 18v-7"/><path d="M22 18H2"/></svg></span>
          <span class="gw-auth-assurance-copy"><strong>Live Operations</strong><span>Weather, news and global time</span></span>
        </div>
        <div class="gw-auth-assurance-item">
          <span class="gw-auth-assurance-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="14" height="11" rx="2"/><path d="M8 20h4M10 15v5"/><rect x="18" y="8" width="4" height="9" rx="1"/></svg></span>
          <span class="gw-auth-assurance-copy"><strong>Device Ready</strong><span>Desktop, tablet and mobile</span></span>
        </div>
      </div>`;
    install.insertAdjacentElement("afterend", panel);
  };

  const mountDesktopBack = () => {
    const registerRoute = /\/approved-signin\/register\/?$/.test(window.location.pathname);
    const existing = document.querySelector(".gw-register-home-back");
    if (!registerRoute) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const back = document.createElement("a");
    back.className = "gw-register-home-back";
    back.href = "/approved-signin/";
    back.setAttribute("aria-label", "Back to Employee Gateway home");
    back.innerHTML = "<span aria-hidden=\"true\">←</span><span>Back To Gateway</span>";
    document.body.appendChild(back);
  };

  const syncBrandPresence = () => {
    document.querySelector(".gw-logo-crisp")?.classList.add("gw-stage08-brand-logo");

    document.querySelectorAll('img[alt="DAENEM Farms"]').forEach((logo) => {
      if (logo.closest(".gw-auth-takeover-brand")) {
        logo.classList.remove("h-8", "max-w-[9.5rem]");
        logo.classList.add("gw-auth-takeover-logo");
        const label = logo.parentElement?.querySelector("span");
        if (label) {
          label.classList.add("gw-auth-takeover-tagline");
          label.textContent = "The Farm's Work · Clearly Connected.";
        }
        return;
      }

      if (!logo.closest(".gw-standalone-auth")) return;
      logo.classList.remove("mb-4", "h-10", "max-w-[12rem]");
      logo.classList.add("gw-standalone-brand-logo");

      let wrapper = logo.closest(".gw-standalone-brand");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "gw-standalone-brand mx-auto mb-4";
        logo.parentNode?.insertBefore(wrapper, logo);
        wrapper.appendChild(logo);
      }

      if (!wrapper.querySelector(".gw-standalone-brand-tagline")) {
        const tagline = document.createElement("p");
        tagline.className = "gw-standalone-brand-tagline";
        tagline.textContent = "The Farm's Work, Clearly Connected.";
        wrapper.appendChild(tagline);
      }
    });

    const takeoverBack = document.querySelector(".gw-auth-takeover-close");
    if (takeoverBack) {
      takeoverBack.setAttribute("aria-label", "Back to Employee Gateway");
      takeoverBack.setAttribute("title", "Back to Employee Gateway");
      takeoverBack.classList.add("gw-auth-takeover-back");
    }
  };

  const syncEnhancements = () => {
    syncInstallButton();
    mountAssurance();
    mountDesktopBack();
    syncBrandPresence();
    document.documentElement.classList.toggle("daenem-auth-takeover-open", Boolean(document.querySelector(".gw-auth-takeover")));
  };

  const boot = () => {
    syncEnhancements();
    let syncQueued = false;
    const observer = new MutationObserver(() => {
      if (syncQueued) return;
      syncQueued = true;
      window.requestAnimationFrame(() => {
        syncQueued = false;
        syncEnhancements();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", syncEnhancements);
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
        .then(() => { document.documentElement.dataset.daenemServiceWorker = "registered"; })
        .catch(() => { document.documentElement.dataset.daenemServiceWorker = "unavailable"; });
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

window.setupArticleAudioPlayer = function setupArticleAudioPlayer() {
  const audioElement = document.querySelector(".js-article-audio");

  if (!audioElement) {
    return;
  }

  const audioOnlyElements = document.querySelectorAll("[data-audio-only]");
  const noAudioLabelElements = document.querySelectorAll("[data-no-audio-label]");
  const startButtons = document.querySelectorAll(".js-audio-start");
  const stickyBar = document.querySelector("[data-mobile-article-bar]");
  const defaultActions = document.querySelector("[data-mobile-default-actions]");
  const playerElement = document.querySelector("[data-mobile-audio-player]");
  const collapseButton = document.querySelector(".js-audio-collapse");
  const dragHandle = document.querySelector("[data-audio-drag-handle]");
  const seekElement = document.querySelector(".js-audio-seek");
  const scrollTopButton = document.querySelector(".js-scroll-top");
  const floatingActionsElement = scrollTopButton?.closest(".js-floating-actions");
  const playerRowElement = document.querySelector(".article-mobile-sticky__player-row");
  const audioControlsElement = document.querySelector(".article-mobile-sticky__audio-controls");
  const sourceElements = audioElement.querySelectorAll("source[data-src]");
  const speedToggleButton = document.querySelector(".js-audio-speed-toggle");
  const speedLabelElement = document.querySelector(".js-audio-speed-label");
  const speedMenuElement = document.querySelector("[data-audio-speed-menu]");
  const speedOptionButtons = document.querySelectorAll(".js-audio-speed-option");
  const playToggleButton = document.querySelector(".js-audio-play-toggle");
  const playIcon = document.querySelector(".js-audio-play-icon");
  const currentTimeElement = document.querySelector(".js-audio-time-current");
  const durationTimeElement = document.querySelector(".js-audio-time-duration");
  const skipButtons = document.querySelectorAll("[data-skip-seconds]");
  let isSeeking = false;
  let touchStartY = null;
  let touchDeltaY = 0;
  let currentPlaybackRate = 1;
  let audioDisabled = false;
  let isBuffering = false;
  let audioSourcesLoaded = false;
  const articleId = audioElement.dataset.articleId?.trim() || "unknown";

  function isDesktopViewport() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function trackAudioPlay() {
    if (typeof window._paq?.push !== "function") {
      return;
    }

    const deviceType = isDesktopViewport() ? "desktop" : "mobile";
    window._paq.push(["trackEvent", "audio", `play_${deviceType}`, articleId]);
  }

  function syncStickyVisibility() {
    if (!stickyBar) {
      return;
    }

    const playerIsVisible = playerElement && !playerElement.classList.contains("hidden");

    if (isDesktopViewport()) {
      stickyBar.classList.toggle("hidden", !playerIsVisible);
      return;
    }

    stickyBar.classList.remove("hidden");
  }

  function disableAudioUi() {
    if (audioDisabled) {
      return;
    }

    audioDisabled = true;
    audioElement.pause();
    audioOnlyElements.forEach((element) => {
      element.classList.add("hidden");
    });
    noAudioLabelElements.forEach((element) => {
      element.classList.remove("hidden");
    });

    if (isDesktopViewport()) {
      stickyBar?.classList.add("hidden");
    }
  }

  function formatTime(seconds) {
    const normalizedSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(normalizedSeconds / 60);
    const remainingSeconds = normalizedSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function ensureAudioSourcesLoaded() {
    if (audioSourcesLoaded) {
      return;
    }

    sourceElements.forEach((sourceElement) => {
      const sourceUrl = sourceElement.dataset.src?.trim();

      if (!sourceUrl) {
        return;
      }

      sourceElement.src = sourceUrl;
    });

    audioElement.load();
    audioSourcesLoaded = true;
  }

  function syncPlayerControlsPosition() {
    if (!playerRowElement || !audioControlsElement) {
      return;
    }

    const rowRect = playerRowElement.getBoundingClientRect();
    const centeredLeft = window.innerWidth / 2 - rowRect.left;
    audioControlsElement.style.left = `${centeredLeft}px`;
  }

  function syncFloatingScrollButtonPosition() {
    if (!floatingActionsElement || !stickyBar) {
      return;
    }

    const stickyHeight = stickyBar.getBoundingClientRect().height;
    floatingActionsElement.style.setProperty("bottom", `${Math.ceil(stickyHeight + 24)}px`);
  }

  function showPlayer() {
    stickyBar?.classList.remove("hidden");
    defaultActions?.classList.add("hidden");
    playerElement?.classList.remove("hidden");

    if (stickyBar) {
      stickyBar.dataset.audioMode = "player";
    }

    scrollTopButton?.setAttribute("data-audio-player-open", "true");
    syncStickyVisibility();
    syncPlayerControlsPosition();
    syncFloatingScrollButtonPosition();
    requestAnimationFrame(() => {
      syncPlayerControlsPosition();
      syncFloatingScrollButtonPosition();
    });
    setTimeout(() => {
      syncPlayerControlsPosition();
      syncFloatingScrollButtonPosition();
    }, 120);
  }

  function closeSpeedMenu() {
    speedMenuElement?.classList.add("hidden");
    speedToggleButton?.setAttribute("aria-expanded", "false");
  }

  function updatePlaybackRate(nextRate) {
    currentPlaybackRate = nextRate;
    audioElement.playbackRate = nextRate;

    if (speedLabelElement) {
      speedLabelElement.textContent = `${nextRate}x`;
    }

    speedOptionButtons.forEach((buttonElement) => {
      const isActive = Number(buttonElement.dataset.speed) === nextRate;
      buttonElement.classList.toggle("bg-gray-50", isActive);
      buttonElement.classList.toggle("text-black", isActive);
    });
  }

  function showDefaultActions() {
    audioElement.pause();
    playerElement?.classList.add("hidden");
    defaultActions?.classList.remove("hidden");

    if (stickyBar) {
      stickyBar.dataset.audioMode = "default";
    }

    scrollTopButton?.setAttribute("data-audio-player-open", "false");
    if (floatingActionsElement) {
      floatingActionsElement.style.bottom = "";
    }

    syncStickyVisibility();
  }

  function updateProgress() {
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const currentTime = Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
    const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

    if (seekElement && !isSeeking) {
      seekElement.value = String(progress);
    }

    currentTimeElement.textContent = formatTime(currentTime);
    durationTimeElement.textContent = formatTime(duration);
  }

  function setBufferingState(nextIsBuffering) {
    isBuffering = nextIsBuffering;

    if (!playToggleButton || !playIcon) {
      return;
    }

    if (nextIsBuffering) {
      playToggleButton.setAttribute("aria-label", "Cargando audio");
      playToggleButton.dataset.audioState = "loading";
      playIcon.className = "fa-solid fa-spinner js-audio-play-icon animate-spin";
      return;
    }

    updatePlaybackState();
  }

  function updatePlaybackState() {
    if (isBuffering) {
      return;
    }

    const isPlaying = !audioElement.paused && !audioElement.ended;

    if (playToggleButton) {
      playToggleButton.setAttribute("aria-label", isPlaying ? "Pausar artículo" : "Reproducir artículo");
      playToggleButton.dataset.audioState = isPlaying ? "playing" : "paused";
    }

    if (playIcon) {
      playIcon.className = isPlaying
        ? "fa-solid fa-pause js-audio-play-icon"
        : "fa-solid fa-play js-audio-play-icon";
    }

    if (stickyBar) {
      stickyBar.dataset.audioActive = isPlaying ? "true" : "false";
    }
  }

  async function togglePlayback() {
    if (audioDisabled) {
      return;
    }

    if (audioElement.paused || audioElement.ended) {
      setBufferingState(true);
      ensureAudioSourcesLoaded();

      try {
        await audioElement.play();
        trackAudioPlay();
      } catch {
        setBufferingState(false);
        disableAudioUi();
        updatePlaybackState();
      }
      return;
    }

    audioElement.pause();
  }

  startButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", async () => {
      showPlayer();

      if (audioElement.ended) {
        audioElement.currentTime = 0;
      }

      if (audioElement.paused) {
        await togglePlayback();
        return;
      }

      updatePlaybackState();
    });
  });

  playToggleButton?.addEventListener("click", () => {
    togglePlayback();
  });

  collapseButton?.addEventListener("click", () => {
    showDefaultActions();
  });

  speedToggleButton?.addEventListener("click", () => {
    const isOpen = speedToggleButton.getAttribute("aria-expanded") === "true";
    speedMenuElement?.classList.toggle("hidden", isOpen);
    speedToggleButton.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });

  speedOptionButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", () => {
      const speed = Number(buttonElement.dataset.speed ?? 1);

      if (!Number.isFinite(speed)) {
        return;
      }

      updatePlaybackRate(speed);
      closeSpeedMenu();
    });
  });

  document.addEventListener("click", (event) => {
    if (
      !speedMenuElement
      || !speedToggleButton
      || speedMenuElement.classList.contains("hidden")
      || speedMenuElement.contains(event.target)
      || speedToggleButton.contains(event.target)
    ) {
      return;
    }

    closeSpeedMenu();
  });

  window.addEventListener("resize", () => {
    syncStickyVisibility();
    syncPlayerControlsPosition();
    syncFloatingScrollButtonPosition();
  });

  dragHandle?.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0]?.clientY ?? null;
    touchDeltaY = 0;
  }, { passive: true });

  dragHandle?.addEventListener("touchmove", (event) => {
    if (touchStartY === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartY;
    touchDeltaY = currentY - touchStartY;
  }, { passive: true });

  dragHandle?.addEventListener("touchend", () => {
    if (touchStartY !== null && touchDeltaY > 24) {
      showDefaultActions();
    }

    touchStartY = null;
    touchDeltaY = 0;
  });

  skipButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", () => {
      const skipAmount = Number(buttonElement.dataset.skipSeconds ?? 0);

      if (!Number.isFinite(skipAmount)) {
        return;
      }

      const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : audioElement.currentTime + skipAmount;
      const nextTime = Math.min(Math.max(audioElement.currentTime + skipAmount, 0), duration || 0);
      audioElement.currentTime = nextTime;
      updateProgress();
    });
  });

  seekElement?.addEventListener("input", () => {
    isSeeking = true;
    const progress = Number(seekElement.value ?? 0);
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const nextTime = duration > 0 ? (progress / 100) * duration : 0;
    currentTimeElement.textContent = formatTime(nextTime);
    durationTimeElement.textContent = formatTime(duration);
  });

  seekElement?.addEventListener("change", () => {
    const progress = Number(seekElement.value ?? 0);
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

    if (duration > 0) {
      audioElement.currentTime = (progress / 100) * duration;
    }

    isSeeking = false;
    updateProgress();
  });

  audioElement.addEventListener("play", updatePlaybackState);
  audioElement.addEventListener("pause", updatePlaybackState);
  audioElement.addEventListener("ended", updatePlaybackState);
  audioElement.addEventListener("playing", () => {
    setBufferingState(false);
  });
  audioElement.addEventListener("canplay", () => {
    if (!audioElement.paused) {
      setBufferingState(false);
    }
  });
  audioElement.addEventListener("waiting", () => {
    if (!audioElement.paused) {
      setBufferingState(true);
    }
  });
  audioElement.addEventListener("stalled", () => {
    if (!audioElement.paused) {
      setBufferingState(true);
    }
  });
  audioElement.addEventListener("loadstart", () => {
    if (!audioElement.paused) {
      setBufferingState(true);
    }
  });
  audioElement.addEventListener("loadedmetadata", updateProgress);
  audioElement.addEventListener("timeupdate", updateProgress);
  audioElement.addEventListener("error", () => {
    setBufferingState(false);
    disableAudioUi();
  });

  updateProgress();
  updatePlaybackState();
  updatePlaybackRate(1);
  showDefaultActions();
  syncStickyVisibility();
};

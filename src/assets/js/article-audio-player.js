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
  const downloadLinks = document.querySelectorAll(".js-audio-download");
  const playToggleButton = document.querySelector(".js-audio-play-toggle");
  const playIcon = document.querySelector(".js-audio-play-icon");
  const currentTimeElement = document.querySelector(".js-audio-time-current");
  const durationTimeElement = document.querySelector(".js-audio-time-duration");
  const skipButtons = document.querySelectorAll("[data-skip-seconds]");
  const storageKey = "audioProgress";
  const playbackRateStorageKey = "audioPlaybackRate";
  let isSeeking = false;
  let touchStartY = null;
  let touchDeltaY = 0;
  let currentPlaybackRate = 1;
  let audioDisabled = false;
  let isBuffering = false;
  let audioSourcesLoaded = false;
  const articleId = audioElement.dataset.articleId?.trim() || "unknown";
  let hasTrackedPlay = false;
  let hasTrackedComplete = false;
  let shouldRestoreSavedTime = false;
  const articleTitle = audioElement.dataset.articleTitle?.trim() || "";
  const articleAuthor = audioElement.dataset.articleAuthor?.trim() || "";
  const articleUrl = audioElement.dataset.articleUrl?.trim() || "";

  function readSavedPlaybackRate() {
    try {
      const savedRate = Number(window.localStorage.getItem(playbackRateStorageKey) || "1");
      return Number.isFinite(savedRate) && savedRate > 0 ? savedRate : 1;
    } catch {
      return 1;
    }
  }

  function savePlaybackRate(nextRate) {
    try {
      window.localStorage.setItem(playbackRateStorageKey, String(nextRate));
    } catch {
      // Ignore storage quota or privacy errors.
    }
  }

  function readAudioProgressStore() {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function writeAudioProgressStore(nextStore) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextStore));
    } catch {
      // Ignore storage quota or privacy errors.
    }
  }

  function getSavedAudioState() {
    const store = readAudioProgressStore();
    return store[articleId] ?? null;
  }

  function saveAudioState(overrides = {}) {
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const currentTime = Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const store = readAudioProgressStore();

    store[articleId] = {
      id: articleId,
      title: articleTitle,
      author: articleAuthor,
      url: articleUrl,
      currentTime,
      duration,
      progressPercent,
      completed: false,
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    writeAudioProgressStore(store);
  }

  function markAudioCompleted() {
    saveAudioState({
      currentTime: 0,
      progressPercent: 100,
      completed: true
    });
  }

  function resetSavedCompletionState() {
    const savedState = getSavedAudioState();

    if (!savedState?.completed) {
      return;
    }

    const store = readAudioProgressStore();
    store[articleId] = {
      ...savedState,
      currentTime: 0,
      progressPercent: 0,
      completed: false,
      updatedAt: new Date().toISOString()
    };
    writeAudioProgressStore(store);
  }

  function isDesktopViewport() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function trackAudioPlay() {
    if (hasTrackedPlay || typeof window._paq?.push !== "function") {
      return;
    }

    hasTrackedPlay = true;
    const deviceType = isDesktopViewport() ? "desktop" : "mobile";
    window._paq.push(["trackEvent", "audio", `play_${deviceType}`, articleId]);
  }

  function trackAudioMetric(action, value) {
    if (typeof window._paq?.push !== "function") {
      return;
    }

    const deviceType = isDesktopViewport() ? "desktop" : "mobile";
    window._paq.push(["trackEvent", "audio", `${action}_${deviceType}`, articleId, value]);
  }

  function resetPlaybackMetrics() {
    hasTrackedPlay = false;
    hasTrackedComplete = false;
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

  function restoreSavedProgress() {
    if (!shouldRestoreSavedTime) {
      return;
    }

    const savedState = getSavedAudioState();
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

    if (!savedState || savedState.completed || savedState.currentTime <= 0) {
      shouldRestoreSavedTime = false;
      return;
    }

    if (duration <= 0) {
      return;
    }

    const resumeTime = Math.min(savedState.currentTime, Math.max(duration - 1, 0));

    if (resumeTime > 0) {
      audioElement.currentTime = resumeTime;
      updateProgress();
    }

    shouldRestoreSavedTime = false;
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
    savePlaybackRate(nextRate);

    if (speedLabelElement) {
      speedLabelElement.textContent = `${nextRate}x`;
    }

    speedOptionButtons.forEach((buttonElement) => {
      const isActive = Number(buttonElement.dataset.speed) === nextRate;
      buttonElement.classList.toggle("bg-gray-50", isActive);
      buttonElement.classList.toggle("dark:bg-[#151c21]", isActive);
      buttonElement.classList.toggle("text-black", isActive);
      buttonElement.classList.toggle("dark:text-white", isActive);
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

  function trackAudioComplete() {
    if (hasTrackedComplete) {
      return;
    }

    hasTrackedComplete = true;
    trackAudioMetric("complete", 100);
    markAudioCompleted();
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

      if (audioElement.ended || getSavedAudioState()?.completed) {
        resetPlaybackMetrics();
      }

      resetSavedCompletionState();
      shouldRestoreSavedTime = !audioSourcesLoaded;
      ensureAudioSourcesLoaded();

      if (audioSourcesLoaded) {
        restoreSavedProgress();
      }

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

  downloadLinks.forEach((linkElement) => {
    linkElement.addEventListener("click", () => {
      trackAudioMetric("download", 1);
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
      saveAudioState();
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
    saveAudioState();
  });

  audioElement.addEventListener("play", updatePlaybackState);
  audioElement.addEventListener("pause", () => {
    updatePlaybackState();
    saveAudioState();
  });
  audioElement.addEventListener("ended", () => {
    trackAudioComplete();
    updatePlaybackState();
  });
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
  audioElement.addEventListener("loadedmetadata", restoreSavedProgress);
  audioElement.addEventListener("timeupdate", updateProgress);
  audioElement.addEventListener("timeupdate", () => {
    saveAudioState();
  });
  audioElement.addEventListener("error", () => {
    setBufferingState(false);
    disableAudioUi();
  });

  updateProgress();
  updatePlaybackState();
  updatePlaybackRate(readSavedPlaybackRate());
  showDefaultActions();
  syncStickyVisibility();
};

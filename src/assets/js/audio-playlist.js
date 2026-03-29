export function setupAudioPlaylistPage() {
  const pageElement = document.querySelector("[data-audio-hub-page]");

  if (!pageElement) {
    return;
  }

  const itemElements = [...pageElement.querySelectorAll("[data-audio-hub-item]")];
  const audioElement = pageElement.querySelector(".js-audio-hub-element");
  const playerShellElement = pageElement.querySelector("[data-audio-hub-player-shell]");
  const continueButton = pageElement.querySelector("[data-audio-hub-continue]");
  const pendingCopyElement = pageElement.querySelector("[data-audio-hub-pending-copy]");
  const hideCompletedToggle = pageElement.querySelector("[data-audio-hub-hide-completed]");
  const hideCompletedToggleLabel = hideCompletedToggle?.querySelector(".audio-hub-page__filter-toggle-label");
  const hideCompletedToggleIcon = hideCompletedToggle?.querySelector(".audio-hub-page__filter-toggle-icon");
  const playToggleButton = pageElement.querySelector(".js-audio-hub-play-toggle");
  const playIconElement = pageElement.querySelector(".js-audio-hub-play-icon");
  const seekElement = pageElement.querySelector(".js-audio-hub-seek");
  const currentTimeElement = pageElement.querySelector(".js-audio-hub-time-current");
  const durationTimeElement = pageElement.querySelector(".js-audio-hub-time-duration");
  const titleElement = pageElement.querySelector(".js-audio-hub-player-title");
  const titleCloneElement = pageElement.querySelector(".js-audio-hub-player-title-clone");
  const titleLinkElement = pageElement.querySelector(".js-audio-hub-player-link");
  const authorElement = pageElement.querySelector(".js-audio-hub-player-author");
  const previousItemButton = pageElement.querySelector(".js-audio-hub-prev-item");
  const nextItemButton = pageElement.querySelector(".js-audio-hub-next-item");
  const controlsRowElement = pageElement.querySelector(".audio-hub-player__controls-row");
  const transportElement = pageElement.querySelector(".audio-hub-player__transport");
  const skipButtons = [...pageElement.querySelectorAll(".js-audio-hub-skip")];
  const speedToggleButton = pageElement.querySelector(".js-audio-hub-speed-toggle");
  const speedLabelElement = pageElement.querySelector(".js-audio-hub-speed-label");
  const speedMenuElement = pageElement.querySelector("[data-audio-hub-speed-menu]");
  const speedOptionButtons = [...pageElement.querySelectorAll(".js-audio-hub-speed-option")];
  const downloadLink = pageElement.querySelector(".js-audio-hub-download");
  const storageKey = "audioProgress";
  const playbackRateStorageKey = "audioPlaybackRate";
  const hideCompletedStorageKey = "audioHubHideCompleted";
  const items = itemElements.map((itemElement, index) => ({
    index,
    element: itemElement,
    id: itemElement.dataset.id?.trim() || String(index),
    src: itemElement.dataset.src?.trim() || "",
    downloadUrl: itemElement.dataset.downloadUrl?.trim() || "",
    title: itemElement.dataset.title?.trim() || "Artículo",
    author: itemElement.dataset.author?.trim() || "La Otra Pucela",
    url: itemElement.dataset.url?.trim() || "/",
    playButtons: [...itemElement.querySelectorAll("[data-audio-hub-start]")],
    statusElement: itemElement.querySelector("[data-audio-hub-status]"),
    statusIconElement: itemElement.querySelector("[data-audio-hub-status-icon]"),
    progressFillElement: itemElement.querySelector("[data-audio-hub-progress-fill]")
  })).filter((item) => item.src);

  if (!audioElement || !items.length) {
    return;
  }

  let currentIndex = -1;
  let audioLoaded = false;
  let isSeeking = false;
  let isBuffering = false;
  let currentPlaybackRate = 1;
  let hasTrackedPlay = false;
  let hasTrackedComplete = false;
  let shouldRestoreSavedTime = false;
  let pendingResumeState = null;

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
      // Ignore storage errors.
    }
  }

  function readHideCompletedPreference() {
    try {
      return window.localStorage.getItem(hideCompletedStorageKey) === "true";
    } catch {
      return false;
    }
  }

  function saveHideCompletedPreference(shouldHideCompleted) {
    try {
      window.localStorage.setItem(hideCompletedStorageKey, shouldHideCompleted ? "true" : "false");
    } catch {
      // Ignore storage errors.
    }
  }

  function readAudioProgressStore() {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function normalizeSavedState(savedState) {
    if (!savedState) {
      return null;
    }

    const duration = Number(savedState.duration) || 0;
    const currentTime = Number(savedState.currentTime) || 0;
    const progressPercent = Number(savedState.progressPercent) || 0;
    const reachedEnd = duration > 0 && currentTime >= Math.max(duration - 0.5, 0);
    const isCompleted = savedState.completed === true || progressPercent >= 100 || reachedEnd;

    return {
      ...savedState,
      completed: isCompleted,
      progressPercent: isCompleted ? 100 : Math.max(0, Math.min(progressPercent, 99))
    };
  }

  function writeAudioProgressStore(nextStore) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextStore));
    } catch {
      // Ignore storage errors.
    }
  }

  function getCurrentItem() {
    return currentIndex >= 0 ? items[currentIndex] : null;
  }

  function getSavedAudioState(articleId) {
    const store = readAudioProgressStore();
    return normalizeSavedState(store[articleId] ?? null);
  }

  function saveAudioState(overrides = {}) {
    const currentItem = getCurrentItem();

    if (!currentItem) {
      return;
    }

    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const currentTime = Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
    const didCompletePlayback = overrides.completed === true
      || audioElement.ended
      || (duration > 0 && currentTime >= Math.max(duration - 0.5, 0));
    const progressPercent = didCompletePlayback
      ? 100
      : (duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0);
    const store = readAudioProgressStore();

    store[currentItem.id] = {
      id: currentItem.id,
      title: currentItem.title,
      author: currentItem.author,
      url: currentItem.url,
      currentTime,
      duration,
      progressPercent,
      completed: didCompletePlayback,
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    writeAudioProgressStore(store);
    renderStoredState();
    syncContinueButton();
  }

  function markAudioCompleted() {
    saveAudioState({
      currentTime: 0,
      progressPercent: 100,
      completed: true
    });
  }

  function resetSavedCompletionState() {
    const currentItem = getCurrentItem();

    if (!currentItem) {
      return;
    }

    const savedState = getSavedAudioState(currentItem.id);

    if (!savedState?.completed) {
      return;
    }

    const store = readAudioProgressStore();
    store[currentItem.id] = {
      ...savedState,
      currentTime: 0,
      progressPercent: 0,
      completed: false,
      updatedAt: new Date().toISOString()
    };
    writeAudioProgressStore(store);
  }

  function resetCompletionStateForItem(item) {
    if (!item) {
      return;
    }

    const savedState = getSavedAudioState(item.id);

    if (!savedState?.completed) {
      return;
    }

    const store = readAudioProgressStore();
    store[item.id] = {
      ...savedState,
      currentTime: 0,
      progressPercent: 0,
      completed: false,
      updatedAt: new Date().toISOString()
    };
    writeAudioProgressStore(store);
    renderStoredState();
    syncContinueButton();
  }

  function formatTime(seconds) {
    const normalizedSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(normalizedSeconds / 60);
    const remainingSeconds = normalizedSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function isDesktopViewport() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function trackAudioMetric(action, value) {
    const currentItem = getCurrentItem();

    if (!currentItem || typeof window._paq?.push !== "function") {
      return;
    }

    const deviceType = isDesktopViewport() ? "desktop" : "mobile";
    window._paq.push(["trackEvent", "audio", `${action}_audiohub_${deviceType}`, currentItem.id, value]);
  }

  function trackAudioPlay() {
    if (hasTrackedPlay) {
      return;
    }

    hasTrackedPlay = true;
    trackAudioMetric("play");
  }

  function resetPlaybackMetrics() {
    hasTrackedPlay = false;
    hasTrackedComplete = false;
  }

  function updateNavButtons() {
    previousItemButton?.toggleAttribute("disabled", findAdjacentPendingIndex(currentIndex, -1) === -1);
    nextItemButton?.toggleAttribute("disabled", findAdjacentPendingIndex(currentIndex, 1) === -1);
  }

  function isItemCompleted(item) {
    const savedState = getSavedAudioState(item.id);
    return savedState?.completed === true;
  }

  function findAdjacentPendingIndex(fromIndex, direction = 1) {
    let index = fromIndex + direction;

    while (index >= 0 && index < items.length) {
      if (!isItemCompleted(items[index])) {
        return index;
      }

      index += direction;
    }

    return -1;
  }

  function syncTransportPosition() {
    if (!controlsRowElement || !transportElement) {
      return;
    }

    const rowRect = controlsRowElement.getBoundingClientRect();
    const centeredLeft = window.innerWidth / 2 - rowRect.left;
    transportElement.style.left = `${centeredLeft}px`;
  }

  function setPlayerVisible(isVisible) {
    playerShellElement?.classList.toggle("hidden", !isVisible);
    syncTransportPosition();
  }

  function updateDownloadLink() {
    const currentItem = getCurrentItem();

    if (!downloadLink) {
      return;
    }

    if (!currentItem) {
      downloadLink.href = "#";
      return;
    }

    downloadLink.href = currentItem.downloadUrl || currentItem.src || "#";
  }

  function syncPlayerMeta() {
    const currentItem = getCurrentItem();

    if (!currentItem) {
      return;
    }

    if (titleElement) {
      titleElement.textContent = currentItem.title;
    }

    if (titleCloneElement) {
      titleCloneElement.textContent = currentItem.title;
    }

    if (authorElement) {
      authorElement.textContent = `${currentItem.author} · La Otra Pucela`;
    }

    if (titleLinkElement) {
      titleLinkElement.href = currentItem.url;
      titleLinkElement.setAttribute("aria-label", `Abrir artículo ${currentItem.title}`);
    }
  }

  function updatePlaybackState() {
    if (isBuffering) {
      return;
    }

    const isPlaying = !audioElement.paused && !audioElement.ended;

    if (playToggleButton) {
      playToggleButton.dataset.audioState = isPlaying ? "playing" : "paused";
      playToggleButton.setAttribute("aria-label", isPlaying ? "Pausar audio" : "Reproducir audio");
    }

    if (playIconElement) {
      playIconElement.className = isPlaying
        ? "fa-solid fa-pause js-audio-hub-play-icon"
        : "fa-solid fa-play js-audio-hub-play-icon";
    }
  }

  function setBufferingState(nextIsBuffering) {
    isBuffering = nextIsBuffering;

    if (!playToggleButton || !playIconElement) {
      return;
    }

    if (nextIsBuffering) {
      playToggleButton.dataset.audioState = "loading";
      playToggleButton.setAttribute("aria-label", "Cargando audio");
      playIconElement.className = "fa-solid fa-spinner js-audio-hub-play-icon animate-spin";
      return;
    }

    updatePlaybackState();
  }

  function updateProgress() {
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const currentTime = Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
    const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

    if (seekElement && !isSeeking) {
      seekElement.value = String(progress);
    }

    if (currentTimeElement) {
      currentTimeElement.textContent = formatTime(currentTime);
    }

    if (durationTimeElement) {
      durationTimeElement.textContent = formatTime(duration);
    }

  }

  function trackAudioComplete() {
    if (hasTrackedComplete) {
      return;
    }

    hasTrackedComplete = true;
    trackAudioMetric("complete", 100);
    markAudioCompleted();
  }

  function ensureCurrentAudioLoaded() {
    const currentItem = getCurrentItem();

    if (!currentItem || audioLoaded) {
      return;
    }

    audioElement.src = currentItem.src;
    audioElement.load();
    audioLoaded = true;
  }

  function restoreSavedProgress() {
    const currentItem = getCurrentItem();

    if (!currentItem || !shouldRestoreSavedTime) {
      return;
    }

    const savedState = pendingResumeState || getSavedAudioState(currentItem.id);
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

    if (!savedState || savedState.completed || savedState.currentTime <= 0) {
      shouldRestoreSavedTime = false;
       pendingResumeState = null;
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
    pendingResumeState = null;
  }

  function primeProgressFromStore() {
    const currentItem = getCurrentItem();

    if (!currentItem) {
      return;
    }

    const savedState = getSavedAudioState(currentItem.id);
    const duration = savedState?.duration ?? 0;
    const currentTime = savedState?.completed ? 0 : (savedState?.currentTime ?? 0);
    const progressPercent = savedState?.completed ? 0 : (savedState?.progressPercent ?? 0);

    if (seekElement) {
      seekElement.value = String(progressPercent);
    }

    if (currentTimeElement) {
      currentTimeElement.textContent = formatTime(currentTime);
    }

    if (durationTimeElement) {
      durationTimeElement.textContent = formatTime(duration);
    }
  }

  function updateActiveItemUi() {
    const currentItem = getCurrentItem();
    const isPlaying = !audioElement.paused && !audioElement.ended;

    items.forEach((item) => {
      const isActive = currentItem?.id === item.id;
      item.element.classList.toggle("is-active", isActive);

      item.playButtons.forEach((buttonElement) => {
        const iconElement = buttonElement.querySelector("i");

        if (iconElement) {
          iconElement.className = isActive && isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
        }

        buttonElement.setAttribute("aria-label", `${isActive && isPlaying ? "Pausar" : "Reproducir"} ${item.title}`);
      });
    });
  }

  function renderStoredState() {
    let pendingCount = 0;

    items.forEach((item) => {
      const savedState = getSavedAudioState(item.id);
      const progressPercent = Math.max(0, Math.min(savedState?.progressPercent ?? 0, 100));
      const isCompleted = savedState?.completed === true;

      if (!isCompleted) {
        pendingCount += 1;
      }

      if (item.progressFillElement) {
        item.progressFillElement.style.transform = `scaleX(${isCompleted ? 1 : progressPercent / 100})`;
      }

      item.element.classList.toggle("is-complete", isCompleted);
      item.element.classList.toggle("is-in-progress", !isCompleted && progressPercent > 0);
      if (item.statusIconElement) {
        item.statusIconElement.style.display = isCompleted ? "inline-flex" : "none";
      }

      if (!item.statusElement) {
        return;
      }

      if (isCompleted) {
        item.statusElement.textContent = "Escuchado";
        return;
      }

      if (progressPercent > 0) {
        item.statusElement.textContent = `${progressPercent}% escuchado`;
        return;
      }

      item.statusElement.textContent = "Sin empezar";
    });

    if (pendingCopyElement) {
      pendingCopyElement.textContent = `${pendingCount} pendientes`;
    }

    applyCompletedFilter();
    updateNavButtons();
  }

  function applyCompletedFilter() {
    const shouldHideCompleted = hideCompletedToggle?.dataset.filterState === "hidden";

    items.forEach((item) => {
      item.element.classList.toggle("is-hidden-by-filter", shouldHideCompleted && isItemCompleted(item));
    });
  }

  function syncHideCompletedToggle(shouldHideCompleted) {
    if (!hideCompletedToggle) {
      return;
    }

    hideCompletedToggle.dataset.filterState = shouldHideCompleted ? "hidden" : "showing";
    hideCompletedToggle.setAttribute("aria-pressed", shouldHideCompleted ? "true" : "false");

    if (hideCompletedToggleLabel) {
      hideCompletedToggleLabel.textContent = shouldHideCompleted ? "Mostrar escuchados" : "Ocultar escuchados";
    }

    if (hideCompletedToggleIcon) {
      hideCompletedToggleIcon.className = shouldHideCompleted
        ? "fa-regular fa-eye audio-hub-page__filter-toggle-icon"
        : "fa-regular fa-eye-slash audio-hub-page__filter-toggle-icon";
    }
  }

  function findBestResumeItem() {
    const store = readAudioProgressStore();

    return items
      .map((item) => ({
        item,
        state: store[item.id] ?? null
      }))
      .filter(({ state }) => state && !state.completed && (state.progressPercent ?? 0) > 0)
      .sort((a, b) => new Date(b.state.updatedAt ?? 0).getTime() - new Date(a.state.updatedAt ?? 0).getTime())[0]
      ?.item ?? null;
  }

  function syncContinueButton() {
    const resumeItem = findBestResumeItem();

    if (!continueButton) {
      return;
    }

    if (!resumeItem) {
      continueButton.classList.add("hidden");
      continueButton.removeAttribute("data-resume-id");
      return;
    }

    continueButton.classList.remove("hidden");
    continueButton.dataset.resumeId = resumeItem.id;

    const labelElement = continueButton.querySelector("span");

    if (labelElement) {
      labelElement.textContent = `Continuar · ${resumeItem.title}`;
    }
  }

  function selectItem(index) {
    if (index < 0 || index >= items.length) {
      return false;
    }

    const nextItem = items[index];
    const previousItem = getCurrentItem();

    if (previousItem?.id !== nextItem.id) {
      if (!audioElement.paused || audioElement.currentTime > 0) {
        saveAudioState();
      }

      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
      audioLoaded = false;
      shouldRestoreSavedTime = true;
      setBufferingState(false);
      updatePlaybackState();
      resetPlaybackMetrics();
    }

    currentIndex = index;
    setPlayerVisible(true);
    syncPlayerMeta();
    primeProgressFromStore();
    updateDownloadLink();
    updateNavButtons();
    syncTransportPosition();

    updateActiveItemUi();
    return true;
  }

  async function playCurrentItem({ restart = false } = {}) {
    const currentItem = getCurrentItem();

    if (!currentItem) {
      return;
    }

    const savedState = getSavedAudioState(currentItem.id);
    const shouldRestartFromBeginning = restart || audioElement.ended || savedState?.completed;

    if (shouldRestartFromBeginning) {
      resetSavedCompletionState();
      resetPlaybackMetrics();
    }

    shouldRestoreSavedTime = !shouldRestartFromBeginning;
    pendingResumeState = shouldRestoreSavedTime && savedState?.currentTime > 0 ? savedState : null;
    setBufferingState(true);
    ensureCurrentAudioLoaded();

    if (audioLoaded) {
      if (shouldRestartFromBeginning) {
        audioElement.currentTime = 0;
        updateProgress();
      } else {
        restoreSavedProgress();
      }
    }

    try {
      await audioElement.play();
      audioElement.playbackRate = currentPlaybackRate;
      trackAudioPlay();
      updateActiveItemUi();
    } catch {
      setBufferingState(false);
    }
  }

  async function playItemAt(index, options = {}) {
    if (!selectItem(index)) {
      return;
    }

    await playCurrentItem(options);
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
      buttonElement.classList.toggle("bg-[#F4F1E9]", isActive);
      buttonElement.classList.toggle("dark:bg-[#1a2529]", isActive);
      buttonElement.classList.toggle("text-black", isActive);
      buttonElement.classList.toggle("dark:text-white", isActive);
    });
  }

  items.forEach((item) => {
    item.playButtons.forEach((buttonElement) => {
      buttonElement.addEventListener("click", async () => {
        if (isItemCompleted(item) || (getSavedAudioState(item.id)?.progressPercent ?? 0) >= 100) {
          resetCompletionStateForItem(item);
        }

        if (currentIndex === item.index && !audioElement.paused && !audioElement.ended) {
          audioElement.pause();
          return;
        }

        await playItemAt(item.index);
      });
    });
  });

  continueButton?.addEventListener("click", async () => {
    const resumeItem = items.find((item) => item.id === continueButton.dataset.resumeId) || findBestResumeItem();

    if (!resumeItem) {
      return;
    }

    await playItemAt(resumeItem.index);
  });

  playToggleButton?.addEventListener("click", async () => {
    if (currentIndex < 0) {
      const resumeItem = findBestResumeItem() || items[0];

      if (!resumeItem) {
        return;
      }

      await playItemAt(resumeItem.index);
      return;
    }

    if (audioElement.paused || audioElement.ended) {
      await playCurrentItem();
      return;
    }

    audioElement.pause();
  });

  previousItemButton?.addEventListener("click", async () => {
    const previousPendingIndex = findAdjacentPendingIndex(currentIndex, -1);

    if (previousPendingIndex >= 0) {
      await playItemAt(previousPendingIndex, { restart: true });
    }
  });

  nextItemButton?.addEventListener("click", async () => {
    const nextPendingIndex = findAdjacentPendingIndex(currentIndex, 1);

    if (nextPendingIndex >= 0) {
      await playItemAt(nextPendingIndex, { restart: true });
    }
  });

  skipButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", () => {
      const skipSeconds = Number(buttonElement.dataset.skipSeconds ?? 0);

      if (!Number.isFinite(skipSeconds)) {
        return;
      }

      const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
      const nextTime = Math.min(Math.max(audioElement.currentTime + skipSeconds, 0), duration || Number.MAX_SAFE_INTEGER);
      audioElement.currentTime = nextTime;
      updateProgress();
      saveAudioState();
    });
  });

  speedToggleButton?.addEventListener("click", () => {
    const isOpen = speedToggleButton.getAttribute("aria-expanded") === "true";
    speedMenuElement?.classList.toggle("hidden", isOpen);
    speedToggleButton.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });

  speedOptionButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", () => {
      const nextRate = Number(buttonElement.dataset.speed ?? 1);

      if (!Number.isFinite(nextRate)) {
        return;
      }

      updatePlaybackRate(nextRate);
      closeSpeedMenu();
    });
  });

  downloadLink?.addEventListener("click", () => {
    trackAudioMetric("download", 1);
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

  audioElement.addEventListener("loadedmetadata", () => {
    restoreSavedProgress();
    updateProgress();
  });

  audioElement.addEventListener("waiting", () => {
    if (!audioElement.paused) {
      setBufferingState(true);
    }
  });

  audioElement.addEventListener("playing", () => {
    setBufferingState(false);
    updatePlaybackState();
    updateActiveItemUi();
  });

  audioElement.addEventListener("pause", () => {
    setBufferingState(false);
    updatePlaybackState();
    updateActiveItemUi();
    saveAudioState();
  });

  audioElement.addEventListener("timeupdate", () => {
    updateProgress();
    saveAudioState();
  });

  audioElement.addEventListener("ended", async () => {
    trackAudioComplete();
    updatePlaybackState();
    updateActiveItemUi();

    const nextPendingIndex = findAdjacentPendingIndex(currentIndex, 1);

    if (nextPendingIndex >= 0) {
      await playItemAt(nextPendingIndex, { restart: true });
    }
  });

  audioElement.addEventListener("error", () => {
    setBufferingState(false);
  });

  seekElement?.addEventListener("input", () => {
    isSeeking = true;
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    const nextTime = duration > 0 ? (Number(seekElement.value) / 100) * duration : 0;

    if (currentTimeElement) {
      currentTimeElement.textContent = formatTime(nextTime);
    }
  });

  seekElement?.addEventListener("change", () => {
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

    if (duration > 0) {
      audioElement.currentTime = (Number(seekElement.value) / 100) * duration;
      updateProgress();
      saveAudioState();
    }

    isSeeking = false;
  });

  window.addEventListener("pagehide", () => {
    saveAudioState();
  });

  window.addEventListener("beforeunload", () => {
    saveAudioState();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveAudioState();
    }
  });

  hideCompletedToggle?.addEventListener("click", () => {
    const shouldHideCompleted = hideCompletedToggle.dataset.filterState !== "hidden";
    syncHideCompletedToggle(shouldHideCompleted);
    saveHideCompletedPreference(shouldHideCompleted);
    applyCompletedFilter();
  });

  window.addEventListener("resize", () => {
    syncTransportPosition();
  });

  updatePlaybackRate(readSavedPlaybackRate());
  if (hideCompletedToggle) {
    const shouldHideCompleted = readHideCompletedPreference();
    syncHideCompletedToggle(shouldHideCompleted);
  }
  renderStoredState();
  syncContinueButton();
  updateNavButtons();
  syncTransportPosition();
}

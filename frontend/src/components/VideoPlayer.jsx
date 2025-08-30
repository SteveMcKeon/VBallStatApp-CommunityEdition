import { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef } from "react";
import { getRallyTimes } from "@/utils/getRallyTimes";
import { getVideoTime as getSavedVideoTime, setVideoTime as saveVideoTime } from "../utils/videoTimes";
import { urlForKey, relinkForKey, makeGameKey, opfsUrlForKey } from "../utils/localFiles";
import Toast from './Toast';
const REWIND_AMOUNT = 3;
const FORWARD_AMOUNT = 10;
const RALLY_NAVIGATION_BUFFER = 2;
const RALLY_EXTRA_END_BUFFER = 3;
const DOUBLE_TAP_THRESHOLD_MS = 300;
const SCROLL_THRESHOLD_PX = 15;
const VOLUME_OVERLAY_TIMEOUT_MS = 1000;
const CONTROLS_TIMEOUT_MS = 3000;
const INTRO_SKIP_THRESHOLD = 0.5;
const TOUCH_BUFFER_INTERVAL_MS = 500;
const FRAME_DURATION = 1 / 60;
const DASH_HLS_START_TIMEOUT_MS = 15000;
const STREAM_FAIL_LIMIT = 10;
const DEMO_GAME_ID = "8c35de74-90d9-4ab3-a198-45c0eb38047c";
const CDN_BASE = "https://cdn.mckeon.ca";
const isAppleUA =
  /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) &&
  /Apple/.test(navigator.vendor || '') &&
  !/CriOS|EdgiOS|FxiOS/.test(navigator.userAgent);
const Key = ({ combo }) => {
  const prettify = (s) =>
    s
      .trim()
      .replace(/^\(|\)$/g, '')
      .replace(/\bctrl\b/gi, 'Ctrl')
      .replace(/\balt\b/gi, 'Alt')
      .replace(/\bshift\b/gi, 'Shift')
      .replace(/\bspace(bar)?\b/gi, 'Space')
      .replace(/\b[a-z]\b/g, (m) => m.toUpperCase());
  return <span className="text-neutral-400">{prettify(combo)}</span>;
};
const VideoPlayer = forwardRef(({ selectedVideo, videoRef, containerRef, stats, gameId, team_id, gameTitle }, ref) => {
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState(null);
  const [toastDuration, setToastDuration] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const setToast = (message, type = 'error', duration) => {
    setToastMessage(message); setToastType(type); setToastDuration(duration); setShowToast(true);
  };
  const streamFailCountRef = useRef(0);
  const offlineWarnedRef = useRef(false);
  const [isCustomPlayback, setIsCustomPlayback] = useState(false);
  const customPlaybackCancelledRef = useRef(false);
  const [isPiP, setIsPiP] = useState(false);
  const playbackSessionRef = useRef(0);
  useImperativeHandle(ref, () => ({
    playCustomSequences: async (sequences) => {
      setIsCustomPlayback(true);
      customPlaybackCancelledRef.current = false;
      setIsAutoplayOn(false);
      const video = videoRef.current;
      if (!video) return;
      const sessionId = ++playbackSessionRef.current;
      video.removeEventListener('timeupdate', video._customPlaybackListener);
      delete video._customPlaybackListener;
      for (const [start, end] of sequences) {
        if (customPlaybackCancelledRef.current) break;
        await new Promise((resolve) => {
          const onTimeUpdate = () => {
            if (playbackSessionRef.current !== sessionId) {
              video.removeEventListener('timeupdate', onTimeUpdate);
              return;
            }
            if (video.currentTime >= end) {
              video.removeEventListener('timeupdate', onTimeUpdate);
              video.pause();
              resolve();
            }
          };
          video._customPlaybackListener = onTimeUpdate;
          video.currentTime = start;
          video.play().then(() => {
            video.addEventListener('timeupdate', onTimeUpdate);
          }).catch((e) => {
            console.error("Playback failed:", e);
            resolve();
          });
        });
      }
      video.removeEventListener('timeupdate', video._customPlaybackListener);
      delete video._customPlaybackListener;
      setIsCustomPlayback(false);
    },
    closeControlsOverlay: () => {
      if (controlTimeoutRef.current) {
        clearTimeout(controlTimeoutRef.current);
        controlTimeoutRef.current = null;
      }
      setIsSettingsOpen(false);
      setSettingsView("main");
      setShowControls(false);
      setHideCursor(true);
    },
    stopFilteredTouches: () => {
      setIsCustomPlayback(false);
      customPlaybackCancelledRef.current = true;
      playbackSessionRef.current++;
      const video = videoRef.current;
      if (video && video._customPlaybackListener) {
        video.removeEventListener('timeupdate', video._customPlaybackListener);
        delete video._customPlaybackListener;
      }
    }
  }));
  const getLocal = (key) => localStorage.getItem(key);
  const setLocal = (key, value) => localStorage.setItem(key, value);
  const hasShownControlsRef = useRef(false);
  const [videoTime, setVideoTime] = useState({ current: 0, duration: 0 });
  const isStatUpdatePausedRef = useRef(false);
  const resumeAfterTimeRef = useRef(null);
  const [hideCursor, setHideCursor] = useState(false);
  const statsRef = useRef(stats);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const normalizeRotation = (deg) => (((deg + 180) % 360 + 360) % 360 - 180);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isMobile = useMemo(() => {
    const coarse = !window.matchMedia("(pointer: fine)").matches;
    const narrow = window.innerWidth < 768;
    return coarse && narrow;
  }, []);
  const [isLandscape, setIsLandscape] = useState(
    window.matchMedia("(orientation: landscape)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handleChange = (e) => setIsLandscape(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);
  const [isAutoplayOn, setIsAutoplayOn] = useState(() => {
    const stored = getLocal("autoplay");
    if (stored === null) return true;
    return stored !== "false";
  });
  const isAutoplayOnRef = useRef(isAutoplayOn);
  const rallyTimes = useMemo(() => getRallyTimes(stats, RALLY_EXTRA_END_BUFFER), [stats]);
  const rallyStartTimestamps = useMemo(
    () => rallyTimes.map((r) => r.start),
    [rallyTimes]
  );
  const ralliesBySet = useMemo(() => {
    const map = new Map();
    for (const rally of rallyTimes) {
      if (!rally.set) continue;
      if (!map.has(rally.set)) map.set(rally.set, []);
      map.get(rally.set).push(rally);
    }
    for (const rallies of map.values()) {
      rallies.sort((a, b) => a.start - b.start);
    }
    return map;
  }, [rallyTimes]);
  const currentRallyIndexRef = useRef(-1);
  const [currentRallyNumber, setCurrentRallyNumber] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [touchBuffer, setTouchBuffer] = useState([]);
  const [currentScore, setCurrentScore] = useState("0 - 0");
  const previousScoreRef = useRef(null);
  const [currentSet, setCurrentSet] = useState("1");
  const isLastSet = useMemo(() => {
    const current = parseInt(currentSet);
    const allSets = Array.from(ralliesBySet.keys()).sort((a, b) => a - b);
    return current >= allSets[allSets.length - 1];
  }, [currentSet, ralliesBySet]);
  const effectiveDisabled = isCustomPlayback || isLastSet;
  const isFirstSet = useMemo(() => {
    const current = parseInt(currentSet);
    const allSets = Array.from(ralliesBySet.keys()).sort((a, b) => a - b);
    return current <= allSets[0];
  }, [currentSet, ralliesBySet]);
  const [showControls, setShowControls] = useState(true);
  const [volumeOverlay, setVolumeOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(!isMobile)
  const [showScoreOverlay, setShowScoreOverlay] = useState(true);
  const [showTouchesOverlay, setShowTouchesOverlay] = useState(() => {
    return !isMobile;
  });
  const showControlsRef = useRef(showControls);
  const showOverlayRef = useRef(showOverlay);
  const controlTimeoutRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);
  const volumeOverlayTimeoutRef = useRef(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState("main");
  const settingsRef = useRef(null);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const requestFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) await el.msRequestFullscreen();
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
      return;
    }
    try {
      if (screen.orientation?.lock) await screen.orientation.lock("landscape");
    } catch (err) {
      console.warn("Orientation lock failed or not supported:", err);
    }
  };
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
  const showVolumeOverlay = (volume) => {
    setVolumeOverlay(Math.round(volume * 100));
    if (volumeOverlayTimeoutRef.current) {
      clearTimeout(volumeOverlayTimeoutRef.current);
    }
    volumeOverlayTimeoutRef.current = setTimeout(() => {
      setVolumeOverlay(null);
    }, VOLUME_OVERLAY_TIMEOUT_MS);
  };
  const resetControlsTimer = () => {
    setShowControls(true);
    setHideCursor(false);
    if (isPiP) return;
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    controlTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setIsSettingsOpen(false);
      setHideCursor(true);
      hasShownControlsRef.current = false;
    }, CONTROLS_TIMEOUT_MS);
  };
  const panByArrow = (direction) => {
    const step = 20;
    let dx = 0, dy = 0;
    switch (direction) {
      case "up":
        dy = step;
        break;
      case "down":
        dy = -step;
        break;
      case "left":
        dx = step;
        break;
      case "right":
        dx = -step;
        break;
      default:
        return;
    }
    setPan((prev) => ({
      x: Math.max(Math.min(prev.x + dx, (zoom - 1) * 500), (zoom - 1) * -500),
      y: Math.max(Math.min(prev.y + dy, (zoom - 1) * 300), (zoom - 1) * -300),
    }));
  };
  const updateTouchBuffer = (overrideSetNumber = null) => {
    const video = videoRef.current;
    if (!video || stats.length === 0 || rallyTimes.length === 0) return;
    const currentTime = video.currentTime;
    const currentIndex = rallyTimes.findIndex(
      (r) => currentTime >= r.start && currentTime < r.end
    );
    const isInRally = currentIndex !== -1;
    const indexToUse = isInRally ? currentIndex : currentRallyIndexRef.current;
    const currentRally = rallyTimes[indexToUse];
    if (isInRally) {
      currentRallyIndexRef.current = currentIndex;
      if (currentRally?.set != null && ralliesBySet.has(currentRally.set)) {
        const ralliesInSet = ralliesBySet.get(currentRally.set);
        const rallyInSetIndex = ralliesInSet.findIndex(r => r.start === currentRally.start);
        setCurrentSet(currentRally.set.toString());
        setCurrentRallyNumber(rallyInSetIndex + 1);
      }
    }
    if (
      isAutoplayOnRef.current &&
      currentRally &&
      currentTime > currentRally.end &&
      indexToUse < rallyTimes.length - 1
    ) {
      const sorted = [...rallyStartTimestamps].sort((a, b) => a - b);
      const next = sorted.find((ts) => ts > currentTime);
      if (next !== undefined) {
        video.currentTime = next;
        return;
      }
    }
    const futureTouches = stats.filter((s) => s.timestamp > currentTime).slice(0, 3);
    setTouchBuffer(futureTouches);
    if (isStatUpdatePausedRef.current) {
      if (overrideSetNumber) {
        setCurrentSet(overrideSetNumber.toString());
        setCurrentScore("0 - 0");
        previousScoreRef.current = "0 - 0";
      }
      return;
    }
    if (video.paused) return;
    if (resumeAfterTimeRef.current != null && currentTime < resumeAfterTimeRef.current) return;
    if (resumeAfterTimeRef.current != null && currentTime >= resumeAfterTimeRef.current) {
      resumeAfterTimeRef.current = null;
    }
    const latest = [...stats]
      .filter(
        (s) =>
          s.timestamp != null &&
          s.timestamp <= currentTime &&
          s.our_score != null &&
          s.opp_score != null
      )
      .reverse()[0];
    if (latest) {
      const newScore = `${latest.our_score} - ${latest.opp_score}`;
      previousScoreRef.current = newScore;
      setCurrentScore(newScore);
      setCurrentSet(latest.set?.toString() || "1");
    } else {
      setCurrentScore("0 - 0");
      setCurrentSet("1");
      previousScoreRef.current = null;
    }
  };
  const seekToSet = (setNumber) => {
    const rallies = ralliesBySet.get(setNumber);
    if (rallies && rallies.length > 0) {
      const firstRally = rallies[0];
      const video = videoRef.current;
      video.currentTime = firstRally.start;
      const resumeAfter = stats.find((s) => s.timestamp > firstRally.start);
      resumeAfterTimeRef.current = resumeAfter ? resumeAfter.timestamp : null;
      setCurrentSet(setNumber.toString());
      setCurrentRallyNumber(1);
      isStatUpdatePausedRef.current = true;
      updateTouchBuffer(setNumber);
      setTimeout(() => {
        isStatUpdatePausedRef.current = false;
        updateTouchBuffer();
      }, 2100);
    }
  };
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  useEffect(() => {
    if (isSettingsOpen && settingsRef.current) {
      settingsRef.current.focus();
    }
  }, [isSettingsOpen]);
  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setZoom(1);
        setRotation(0);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  useEffect(() => {
    isAutoplayOnRef.current = isAutoplayOn;
  }, [isAutoplayOn]);
  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const events = ["mousemove", "mousedown", "keydown", "touchstart"];
    const maybeResetControls = () => {
      if (!isPiP) resetControlsTimer();
    };
    events.forEach((event) => container.addEventListener(event, maybeResetControls));
    if (!isPiP) resetControlsTimer();
    return () => {
      events.forEach((event) => container.removeEventListener(event, maybeResetControls));
      clearTimeout(controlTimeoutRef.current);
    };
  }, [isPiP]);
  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);
  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);
  useEffect(() => {
    setLocal('autoplay', isAutoplayOn.toString());
  }, [isAutoplayOn]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoadedData = () => {
      const timeoutId = setTimeout(() => {
        const saveTime = () => {
          if (gameId) saveVideoTime(gameId, video.currentTime);
        };
        video.addEventListener('timeupdate', saveTime);
        video._saveTimeHandler = saveTime;
      }, 1000);
      video._saveTimeTimeoutId = timeoutId;
    };
    video.addEventListener('loadeddata', handleLoadedData);
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      if (video._saveTimeHandler) {
        video.removeEventListener('timeupdate', video._saveTimeHandler);
        delete video._saveTimeHandler;
      }
    };
  }, [selectedVideo, gameId]);
  const media = useMemo(() => {
    if (!selectedVideo) return null;
    const isDemo = String(gameId) === DEMO_GAME_ID;
    if (isDemo) {
      const baseNoExt = String(selectedVideo).replace(/\.(mp4|m4v|mov)$/i, "");
      const demoBase = `${CDN_BASE}/${DEMO_GAME_ID}/${baseNoExt}`;
      return {
        isDemo: true,
        hls: `${demoBase}/master.m3u8`,
        dash: `${demoBase}/manifest.mpd`,
      };
    }
    return { isDemo: false };
  }, [selectedVideo, gameId]);
  useEffect(() => {
    if (!videoRef.current || !media) return;
    const video = videoRef.current;
    const savedVolume = parseFloat(localStorage.getItem("videoVolume") ?? "1");
    video.volume = savedVolume;
    video.muted = savedVolume === 0;
    setIsMuted(video.muted);
    setCurrentSet(null);
    setCurrentRallyNumber(null);
    setTouchBuffer([]);
    setVideoTime({ current: 0, duration: 0 });
    const pendingTimers = [];
    let canceled = false;
    let currentBlobUrl = null;
    let createdObjectUrl = false;
    const tryAutoplay = () =>
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        return video.play().catch(() => { });
      });
    const seekToSaved = () => {
      const t = gameId ? getSavedVideoTime(gameId) : 0;
      if (t > 0 && !Number.isNaN(t)) {
        try { video.currentTime = t; } catch { }
      }
    };
    const destroyHls = () => {
      if (video._hls) {
        try { video._hls.destroy(); } catch { }
        delete video._hls;
      }
    };
    const destroyDash = () => {
      if (video._dash) {
        try { video._dash.reset?.(); } catch { }
        delete video._dash;
      }
    };
    const loadDemoStream = async () => {
      streamFailCountRef.current = 0;
      offlineWarnedRef.current = false;
      const markFail = (why = '') => {
        streamFailCountRef.current += 1;
        if (!offlineWarnedRef.current && streamFailCountRef.current >= STREAM_FAIL_LIMIT) {
          offlineWarnedRef.current = true;
          canceled = true;
          pendingTimers.forEach(clearTimeout);
          destroyHls(); destroyDash();
          setToast("Can't load the Demo video. Check your internet connection and try again.");
        }
      };
      const hlsCandidates = [media.hls];
      const dashCandidates = [media.dash];
      const loadHlsFrom = async (urls) => {
        if (isAppleUA && video.canPlayType("application/vnd.apple.mpegurl")) {
          destroyHls(); destroyDash();
          video.pause(); video.removeAttribute("src"); video.load();
          const onErr = () => { markFail('hls tag error'); /* no MP4 fallback for demo */ };
          video.addEventListener("error", onErr, { once: true });
          video.onloadeddata = async () => {
            video.removeEventListener("error", onErr);
            if (canceled) return;
            seekToSaved();
            await tryAutoplay();
          };
          video.src = urls[0];
          return;
        }
        const HlsGlobal = window.Hls;
        if (!HlsGlobal || !HlsGlobal.isSupported()) {
          return loadDashFrom(dashCandidates);
        }
        destroyHls(); destroyDash();
        const hls = new HlsGlobal({
          enableWorker: true,
          lowLatencyMode: false,
          abrMaxWithRealBitrate: true,
          maxBufferLength: 60,
          backBufferLength: 90,
          startLevel: -1,
        });
        video._hls = hls;
        let started = false;
        let urlIndex = 0;
        const bailToNext = () => {
          markFail('hls start/fatal');
          if (canceled) return;
          try { hls.stopLoad(); hls.detachMedia(); } catch { }
          if (++urlIndex < urls.length) {
            hls.attachMedia(video);
            hls.loadSource(urls[urlIndex]);
            armStartTimer();
          } else {
            try { hls.destroy(); } catch { }
            delete video._hls;
            loadDashFrom(dashCandidates);
          }
        };
        const armStartTimer = () => {
          const id = setTimeout(() => { bailToNext(); }, DASH_HLS_START_TIMEOUT_MS);
          pendingTimers.push(id);
        };
        const startOnce = async () => {
          if (started) return;
          started = true;
          pendingTimers.forEach(clearTimeout);
          if (canceled) return;
          seekToSaved();
          await tryAutoplay();
        };
        hls.on(HlsGlobal.Events.LEVEL_LOADED, startOnce);
        hls.on(HlsGlobal.Events.MANIFEST_PARSED, startOnce);
        hls.on(HlsGlobal.Events.FRAG_LOADED, startOnce);
        hls.on(HlsGlobal.Events.ERROR, (_evt, data) => {
          if (data?.fatal) bailToNext();
          else markFail('hls non-fatal');
        });
        hls.attachMedia(video);
        hls.loadSource(urls[urlIndex]);
        armStartTimer();
      };
      const loadDashFrom = (urls) => {
        const dashjs = window.dashjs;
        if (!dashjs?.MediaPlayer) {
          return loadHlsFrom(hlsCandidates);
        }
        destroyHls(); destroyDash();
        video.pause(); video.removeAttribute("src"); video.load();
        const player = dashjs.MediaPlayer().create();
        video._dash = player;
        player.updateSettings({
          streaming: {
            abr: { autoSwitchBitrate: { video: true } },
            cacheInitSegments: true,
            buffer: {
              fastSwitchEnabled: true,
              reuseExistingSourceBuffers: true,
              stableBufferTime: 20,
              bufferTimeAtTopQualityLongForm: 20,
            },
          },
        });
        let urlIndex = 0;
        const tryNext = () => {
          markFail('dash error/timeout');
          if (urlIndex >= urls.length) {
            destroyDash();
            loadHlsFrom(hlsCandidates);
            return;
          }
          const url = urls[urlIndex++];
          player.initialize(video, url, true);
        };
        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, async () => {
          if (canceled) return;
          seekToSaved();
          await tryAutoplay();
        });
        player.on(dashjs.MediaPlayer.events.ERROR, () => { tryNext(); });
        tryNext();
      };
      if (window.dashjs?.MediaPlayer && !isAppleUA) {
        loadDashFrom(dashCandidates);
      } else {
        loadHlsFrom(hlsCandidates);
      }
    };
    const loadLocalBlob = async () => {
      destroyHls(); destroyDash();
      video.pause();
      video.removeAttribute("src");
      video.load();
      const isFileLike =
        selectedVideo &&
        typeof selectedVideo === 'object' &&
        typeof selectedVideo.arrayBuffer === 'function';
      try {
        if (isFileLike) {
          currentBlobUrl = URL.createObjectURL(selectedVideo);
          createdObjectUrl = true;
        } else if (typeof selectedVideo === 'string' && selectedVideo.startsWith('blob:')) {
          currentBlobUrl = selectedVideo;
        } else {
          const key = makeGameKey(team_id, gameTitle);
          currentBlobUrl = await urlForKey(key);
        }
      } catch (e) {
        try {
          const key = makeGameKey(team_id, gameTitle);
          currentBlobUrl = await opfsUrlForKey(key);
        } catch {
          try {
            if (!isFileLike) {
              const key = makeGameKey(team_id, gameTitle);
              const suggested = typeof selectedVideo === "string"
                ? (selectedVideo.split(/[\\/]/).pop() || "video.mp4")
                : "video.mp4";
              await relinkForKey(key, suggested);
              currentBlobUrl = await urlForKey(key);
            } else {
              console.warn("Skipping relink: file already provided.");
            }
          } catch (relinkErr) {
            console.warn("Local file not linked:", relinkErr);
            const expectedName =
              typeof selectedVideo === "string"
                ? (selectedVideo.split(/[\\/]/).pop() || "video.mp4")
                : "video.mp4";
            const noFSAccess =
              !("showOpenFilePicker" in window) ||
              String(relinkErr?.message || relinkErr).includes("picker-unavailable");
            if (noFSAccess) {
              setToast(
                `Your browser can’t remember local files. Please pick “${expectedName}”.`);
              try {
                const file = await new Promise((resolve) => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "video/*";
                  input.onchange = () => resolve(input.files?.[0] || null);
                  input.style.position = "fixed";
                  input.style.left = "-9999px";
                  document.body.appendChild(input);
                  input.click();
                  setTimeout(() => input.remove(), 0);
                });
                if (file) {
                  if (file.name !== expectedName) {
                    setToast(
                      `Loaded “${file.name}”. Expected “${expectedName}”. Playing selected file.`,
                      "success",
                      5000
                    );
                  }
                  currentBlobUrl = URL.createObjectURL(file);
                  createdObjectUrl = true;
                  video.onloadeddata = async () => {
                    if (canceled) return;
                    seekToSaved();
                    await tryAutoplay();
                  };
                  video.src = currentBlobUrl;
                }
              } catch {
              }
            }
            return;
          }
        }
      }
      video.onloadeddata = async () => {
        if (canceled) return;
        seekToSaved();
        await tryAutoplay();
      };
      video.src = currentBlobUrl;
    };
    if (media.isDemo) {
      loadDemoStream();
    } else {
      loadLocalBlob();
    }
    return () => {
      canceled = true;
      pendingTimers.forEach(clearTimeout);
      destroyHls();
      destroyDash();
      try { video.pause(); } catch { }
      video.removeAttribute("src");
      video.load();
      video.onloadeddata = null;
      if (currentBlobUrl && createdObjectUrl) {
        try { URL.revokeObjectURL(currentBlobUrl); } catch { }
      }
    };
  }, [media]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      setVideoTime({
        current: video.currentTime,
        duration: video.duration || 0,
      });
    };
    const handleLoadedMetadata = () => {
      setVideoTime({
        current: video.currentTime,
        duration: video.duration || 0,
      });
    };
    const handleEnterPiP = () => {
      setIsPiP(true);
      setShowControls(true);
      if (controlTimeoutRef.current) {
        clearTimeout(controlTimeoutRef.current);
        controlTimeoutRef.current = null;
      }
    };
    const handleLeavePiP = () => {
      setIsPiP(false);
      resetControlsTimer();
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [videoRef]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || rallyTimes.length === 0) return;
    const firstStart = rallyTimes[0]?.start ?? 0;
    if (
      isAutoplayOn &&
      video.readyState >= 2 &&
      video.currentTime < firstStart - 1 &&
      firstStart > INTRO_SKIP_THRESHOLD
    ) {
      video.currentTime = firstStart;
    }
    const handleAutoSeekToFirstRally = () => {
      if (
        isAutoplayOn &&
        video.currentTime < firstStart - 1 &&
        firstStart > INTRO_SKIP_THRESHOLD
      ) {
        video.currentTime = firstStart;
      }
    };
    if (video.readyState < 2) {
      video.addEventListener("loadeddata", handleAutoSeekToFirstRally, { once: true });
    }
  }, [rallyTimes, isAutoplayOn, videoRef]);
  useEffect(() => {
    if (!videoRef.current || !isMobile) return;
    const video = videoRef.current;
    let startX = 0;
    let startY = 0;
    let lastTapTime = 0;
    let singleTapTimeout;
    let doubleTapDetected = false;
    let didScroll = false;
    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      didScroll = false;
    };
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - startY);
      if (deltaY > SCROLL_THRESHOLD_PX) didScroll = true;
    };
    const handleTouchEnd = () => {
      if (didScroll) return;
      if (!hasShownControlsRef.current) {
        setShowControls(true);
        hasShownControlsRef.current = true;
        return;
      }
      const now = Date.now();
      const tapInterval = now - lastTapTime;
      lastTapTime = now;
      const { left, width } = video.getBoundingClientRect();
      const isLeft = startX < left + width / 2;
      if (tapInterval < DOUBLE_TAP_THRESHOLD_MS) {
        clearTimeout(singleTapTimeout);
        doubleTapDetected = true;
        video.currentTime = Math.max(
          0,
          video.currentTime + (isLeft ? -REWIND_AMOUNT : FORWARD_AMOUNT)
        );
      } else {
        doubleTapDetected = false;
        clearTimeout(singleTapTimeout);
        singleTapTimeout = setTimeout(() => {
          if (doubleTapDetected) return;
          video.paused ? video.play() : video.pause();
        }, DOUBLE_TAP_THRESHOLD_MS);
      }
    };
    video.addEventListener("touchstart", handleTouchStart, { passive: true });
    video.addEventListener("touchmove", handleTouchMove, { passive: true });
    video.addEventListener("touchend", handleTouchEnd);
    return () => {
      video.removeEventListener("touchstart", handleTouchStart);
      video.removeEventListener("touchmove", handleTouchMove);
      video.removeEventListener("touchend", handleTouchEnd);
      clearTimeout(singleTapTimeout);
    };
  }, []);
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    let lastSpacePress = 0;
    let autoplayInterval;
    let singleTapTimeout;
    const handleKeyDown = async (e) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) {
        e.stopPropagation();
        return;
      }
      if (isCustomPlayback && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setIsCustomPlayback(false);
        customPlaybackCancelledRef.current = true;
        return;
      }
      if (isCustomPlayback && e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        return;
      }
      if (zoom !== 1 && isSettingsOpen) {
        switch (e.key) {
          case "ArrowUp":
            panByArrow("up");
            e.preventDefault();
            return;
          case "ArrowDown":
            panByArrow("down");
            e.preventDefault();
            return;
          case "ArrowLeft":
            panByArrow("left");
            e.preventDefault();
            return;
          case "ArrowRight":
            panByArrow("right");
            e.preventDefault();
            return;
        }
      }
      if (isSettingsOpenRef.current || !video) return;
      const currentTime = video.currentTime;
      if (!isCustomPlayback && e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const sorted = [...rallyStartTimestamps].sort((a, b) => a - b);
        if (e.key === "ArrowRight") {
          const next = sorted.find((ts) => ts > currentTime);
          if (next !== undefined) video.currentTime = next;
        } else {
          const previous = [...sorted].reverse().find((ts) => ts < currentTime - RALLY_NAVIGATION_BUFFER);
          if (previous !== undefined) video.currentTime = previous;
        }
        e.preventDefault();
        return;
      }
      if (video.paused) {
        if (e.key === ",") {
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - FRAME_DURATION);
        }
        if (e.key === ".") {
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + FRAME_DURATION);
        }
      }
      switch (e.key) {
        case "a":
        case "A":
          setIsAutoplayOn((prev) => !prev);
          if (!isPiP) resetControlsTimer();
          break;
        case "ArrowLeft":
          video.currentTime = Math.max(0, video.currentTime - REWIND_AMOUNT);
          if (!isPiP) resetControlsTimer();
          break;
        case "ArrowRight":
          video.currentTime += FORWARD_AMOUNT;
          if (!isPiP) resetControlsTimer();
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          setLocal('videoVolume', video.volume.toString());
          if (video.volume > 0) {
            video.muted = false;
            setIsMuted(false);
          }
          showVolumeOverlay(video.volume);
          if (!isPiP) resetControlsTimer();
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          setLocal('videoVolume', video.volume.toString());
          if (video.volume === 0) {
            video.muted = true;
            setIsMuted(true);
          }
          showVolumeOverlay(video.volume);
          if (!isPiP) resetControlsTimer();
          break;
        case " ":
        case "Spacebar": {
          const now = Date.now();
          if (now - lastSpacePress < DOUBLE_TAP_THRESHOLD_MS) return;
          lastSpacePress = now;
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          if (!isPiP) resetControlsTimer();
          break;
        }
        case "f":
        case "F":
          document.fullscreenElement ? document.exitFullscreen() : requestFullscreen();
          if (!isPiP) resetControlsTimer();
          break;
        case "c":
        case "C":
          setShowOverlay(!showOverlayRef.current);
          if (!isPiP) resetControlsTimer();
          break;
        case "m":
        case "M":
          video.muted = !video.muted;
          setIsMuted(video.muted);
          if (!isPiP) resetControlsTimer();
          break;
        case "p":
        case "P":
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
            } else {
              await video.requestPictureInPicture();
            }
          } catch (err) {
            console.error("PiP failed:", err);
          }
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          const percent = parseInt(e.key, 10) / 10;
          video.currentTime = percent * video.duration;
          setIsAutoplayOn(false);
          if (!isPiP) resetControlsTimer();
          break;
        }
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            ref.current?.closeControlsOverlay();
          }
          resetControlsTimer();
          break;
        default:
          break;
      }
    };
    autoplayInterval = setInterval(updateTouchBuffer, TOUCH_BUFFER_INTERVAL_MS);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(autoplayInterval);
      clearTimeout(singleTapTimeout);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoom, isSettingsOpen, stats, isCustomPlayback]);
  useEffect(() => {
    if (isMobile) return;
    const handleGlobalClick = (e) => {
      const clickedOutside =
        isSettingsOpenRef.current &&
        settingsRef.current &&
        !settingsRef.current.contains(e.target);
      if (clickedOutside) {
        setIsSettingsOpen(false);
        setSettingsView("main");
        return;
      }
      if (isSettingsOpenRef.current) return;
      if (videoRef.current && videoRef.current.contains(e.target)) {
        clickCountRef.current += 1;
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
          if (clickCountRef.current === 1) {
            videoRef.current.paused
              ? videoRef.current.play()
              : videoRef.current.pause();
          } else if (clickCountRef.current === 2) {
            document.fullscreenElement
              ? document.exitFullscreen()
              : requestFullscreen();
          }
          clickCountRef.current = 0;
        }, 250);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);
  const rewindSVG = (amount) => `
  <svg viewBox="0 0 48 48" width="20" height="20" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.74215 9L14.1212 3.62115L12 1.5L3 10.5L12 19.5L14.1212 17.3789L8.74215 12H39C40.6569 12 42 13.3431 42 15V33C42 34.6569 40.6569 36 39 36H27V39H39C42.3137 39 45 36.3137 45 33V15C45 11.6863 42.3137 9 39 9H8.74215Z" />
    <text x="20" y="44" text-anchor="end" font-size="16" fill="white" font-weight="bold">${amount}</text>
  </svg>`;
  const RewindButton = ({ amount, onClick }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button className="w-6 h-6 cursor-pointer focus:outline-none" aria-label="Rewind" onMouseDown={onClick}>
        <div dangerouslySetInnerHTML={{ __html: rewindSVG(amount) }} />
      </button>
    );
  };
  const forwardSVG = (amount) => `
  <svg viewBox="0 0 48 48" width="20" height="20" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M39.2579 9H9C5.68629 9 3 11.6863 3 15V33C3 36.3137 5.68629 39 9 39H17V36H9C7.34315 36 6 34.6569 6 33V15C6 13.3431 7.34315 12 9 12H32.9091L33 11.985L33 12H39.2579L33.8788 17.3789L36 19.5L45 10.5L36 1.5L33.8788 3.62115L39.2579 9Z" />
    <text x="22" y="44" text-anchor="start" font-size="16" fill="white" font-weight="bold">${amount}</text>
  </svg>`;
  const ForwardButton = ({ amount, onClick }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button className="w-6 h-6 cursor-pointer focus:outline-none" aria-label="Forward" onMouseDown={onClick}>
        <div dangerouslySetInnerHTML={{ __html: forwardSVG(amount) }} />
      </button>
    );
  };
  const PreviousRallyButton = ({ onClick, disabled }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button onMouseDown={onClick} disabled={disabled} aria-label="Previous Rally" className={`w-4 h-4 cursor-pointer focus:outline-none ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
        <svg viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6H6V42H3V6Z" />
          <path d="M39.7485 41.7978C39.9768 41.9303 40.236 42.0001 40.5 42C40.8978 42 41.2794 41.842 41.5607 41.5607C41.842 41.2794 42 40.8978 42 40.5V7.50001C41.9998 7.23664 41.9303 6.97795 41.7985 6.74997C41.6666 6.52199 41.477 6.33274 41.2488 6.20126C41.0206 6.06978 40.7618 6.00071 40.4985 6.00098C40.2351 6.00125 39.9764 6.07086 39.7485 6.20281L11.2485 22.7028C11.0212 22.8347 10.8325 23.0239 10.7014 23.2516C10.5702 23.4793 10.5012 23.7375 10.5012 24.0003C10.5012 24.2631 10.5702 24.5213 10.7014 24.749C10.8325 24.9767 11.0212 25.1659 11.2485 25.2978L39.7485 41.7978Z" />
        </svg>
      </button>
    );
  };
  const NextRallyButton = ({ onClick, disabled }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button onMouseDown={onClick} disabled={disabled} aria-label="Next Rally" className={`w-4 h-4 cursor-pointer focus:outline-none ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
        <svg viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M42 6H45V42H42V6Z" />
          <path d="M6.43934 41.5607C6.72064 41.842 7.10218 42 7.5 42C7.764 41.9999 8.02328 41.9299 8.2515 41.7972L36.7515 25.2972C36.9788 25.1653 37.1675 24.9761 37.2986 24.7484C37.4298 24.5207 37.4988 24.2625 37.4988 23.9997C37.4988 23.7369 37.4298 23.4787 37.2986 23.251C37.1675 23.0233 36.9788 22.8341 36.7515 22.7022L8.2515 6.2022C8.02352 6.07022 7.76481 6.00061 7.50139 6.00037C7.23797 6.00012 6.97913 6.06925 6.75091 6.2008C6.52269 6.33235 6.33314 6.52168 6.20132 6.74975C6.0695 6.97782 6.00007 7.23658 6 7.5V40.5C6 40.8978 6.15804 41.2793 6.43934 41.5607Z" />
        </svg>
      </button>
    );
  };
  const AutoplayIcon = ({ size = 16, color = "white", className = "focus:outline-none" }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} fill={color} xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" >
      <path fillRule="evenodd" d="M5.23331,0.493645 C6.8801,-0.113331 8.6808,-0.161915 10.3579,0.355379 C11.4019,0.6773972 12.361984,1.20757325 13.1838415,1.90671757 L13.4526,2.14597 L14.2929,1.30564 C14.8955087,0.703065739 15.9071843,1.0850774 15.994017,1.89911843 L16,2.01275 L16,6.00002 L12.0127,6.00002 C11.1605348,6.00002 10.7153321,5.01450817 11.2294893,4.37749065 L11.3056,4.29291 L12.0372,3.56137 C11.389,2.97184 10.6156,2.52782 9.76845,2.26653 C8.5106,1.87856 7.16008,1.915 5.92498,2.37023 C4.68989,2.82547 3.63877,3.67423 2.93361,4.78573 C2.22844,5.89723 1.90836,7.20978 2.02268,8.52112 C2.13701,9.83246 2.6794,11.0698 3.56627,12.0425 C4.45315,13.0152 5.63528,13.6693 6.93052,13.9039 C8.22576,14.1385 9.56221,13.9407 10.7339,13.3409 C11.9057,12.7412 12.8476,11.7727 13.4147,10.5848 C13.6526,10.0864 14.2495,9.8752 14.748,10.1131 C15.2464,10.351 15.4575,10.948 15.2196,11.4464 C14.4635,13.0302 13.2076,14.3215 11.6453,15.1213 C10.0829,15.921 8.30101,16.1847 6.57402,15.8719 C4.84704,15.559 3.27086,14.687 2.08836,13.39 C0.905861,12.0931 0.182675,10.4433 0.0302394,8.69483 C-0.122195,6.94637 0.304581,5.1963 1.2448,3.7143 C2.18503,2.2323 3.58652,1.10062 5.23331,0.493645 Z M6,5.46077 C6,5.09472714 6.37499031,4.86235811 6.69509872,5.0000726 L6.7678,5.03853 L10.7714,7.57776 C11.0528545,7.75626909 11.0784413,8.14585256 10.8481603,8.36273881 L10.7714,8.42224 L6.7678,10.9615 C6.45867857,11.1575214 6.06160816,10.965274 6.00646097,10.6211914 L6,10.5392 L6,5.46077 Z"
      />
    </svg>
  );
  const PreviousSetButton = ({ onClick, disabled }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button
        onMouseDown={onClick}
        disabled={disabled}
        aria-label="Previous Set"
        className={`w-4 h-4 cursor-pointer focus:outline-none ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
      >
        <svg viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 6H9V42H6V6Z" />
          <path d="M12 6H15V42H12V6Z" />
          <path d="M41.2485 6.20126C41.0203 6.06979 40.7614 6.00072 40.498 6.00099C40.2346 6.00126 39.9758 6.07088 39.748 6.20284L11.248 22.7028C11.0207 22.8347 10.832 23.0239 10.7008 23.2516C10.5696 23.4793 10.5006 23.7375 10.5006 24.0003C10.5006 24.2631 10.5696 24.5213 10.7008 24.749C10.832 24.9767 11.0207 25.1659 11.248 25.2978L39.748 41.7978C39.9763 41.9303 40.2355 42.0001 40.4995 42C40.8973 42 41.2789 41.842 41.5602 41.5607C41.8415 41.2794 41.9995 40.8978 41.9995 40.5V7.50001C41.9993 7.23665 41.9298 6.97796 41.798 6.74998C41.6662 6.522 41.4766 6.33275 41.2485 6.20126Z" />
        </svg>
      </button>
    );
  };
  const NextSetButton = ({ onClick, disabled }) => {
    if (!document.fullscreenElement && isMobile && !isLandscape) return null;
    return (
      <button
        onMouseDown={onClick}
        disabled={disabled}
        aria-label="Next Set"
        className={`w-4 h-4 cursor-pointer focus:outline-none ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
      >
        <svg viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M39 6H42V42H39V6Z" />
          <path d="M33 6H36V42H33V6Z" />
          <path d="M6.43934 41.5607C6.72064 41.842 7.10218 42 7.5 42C7.764 41.9999 8.02328 41.9299 8.2515 41.7972L36.7515 25.2972C36.9788 25.1653 37.1675 24.9761 37.2986 24.7484C37.4298 24.5207 37.4988 24.2625 37.4988 23.9997C37.4988 23.7369 37.4298 23.4787 37.2986 23.251C37.1675 23.0233 36.9788 22.8341 36.7515 22.7022L8.2515 6.2022C8.02352 6.07022 7.76481 6.00061 7.50139 6.00037C7.23797 6.00012 6.97913 6.06925 6.75091 6.2008C6.52269 6.33235 6.33314 6.52168 6.20132 6.74975C6.0695 6.97782 6.00007 7.23658 6 7.5V40.5C6 40.8978 6.15804 41.2793 6.43934 41.5607Z" />
        </svg>
      </button>
    );
  };
  const [hoverTimeTooltip, setHoverTimeTooltip] = useState(null);
  return (
    <>
      <div
        ref={containerRef}
        className={`relative w-full mb-4 touch-manipulation ${hideCursor ? "cursor-none" : ""}`}
      >
        <video
          ref={videoRef}
          tabIndex={-1}
          className="w-full transition-transform origin-center"
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)` }}
          controls={false}
          playsInline
          x-webkit-airplay="allow"
        />
        {volumeOverlay !== null && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xl px-4 py-2 rounded-lg z-50">
            {volumeOverlay}%
          </div>
        )}
        {showControls && (
          <>
            <div className="absolute bottom-[58px] left-0 right-0 px-4 z-40 mb-2">
              <div className="relative w-full h-4">
                {/* Seekbar*/}
                <input
                  type="range"
                  min="0"
                  max={videoRef.current?.duration || 0}
                  value={videoRef.current?.currentTime || 0}
                  step="0.1"
                  onChange={(e) => {
                    videoRef.current.currentTime = parseFloat(e.target.value);
                    setIsAutoplayOn(false);
                  }}
                  onClick={(e) => {
                    const seekBarRect = e.currentTarget.getBoundingClientRect();
                    const relativeX = e.clientX - seekBarRect.left;
                    const percent = Math.min(Math.max(relativeX / seekBarRect.width, 0), 1);
                    const clickedTime = percent * (videoRef.current?.duration || 0);
                    videoRef.current.currentTime = clickedTime;
                    setIsAutoplayOn(false);
                    e.currentTarget.blur();
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relativeX = e.clientX - rect.left;
                    const percent = Math.max(0, Math.min(1, relativeX / rect.width));
                    const hoverTime = percent * (videoRef.current?.duration || 0);
                    setHoverTimeTooltip({ percent, time: hoverTime });
                  }}
                  onMouseLeave={() => setHoverTimeTooltip(null)}
                  disabled={isCustomPlayback}
                  className={`relative z-20 w-full h-1 accent-red-600 cursor-pointer focus:outline-none ${isCustomPlayback ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                />
                {hoverTimeTooltip && (
                  <div
                    className="absolute -top-7 px-2 z-40 py-1 bg-black text-white text-xs rounded whitespace-nowrap pointer-events-none"
                    style={{ left: `${hoverTimeTooltip.percent * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {formatTime(hoverTimeTooltip.time)}
                  </div>
                )}
              </div>
            </div>
            <div className="absolute bottom-2 left-0 right-0 px-4 flex items-center justify-between bg-black/50 text-white rounded-lg py-2 text-sm z-50">
              {/* Left Controls */}
              <div className="flex items-center gap-4">
                {/* Volume Button + Slider */}
                <div className="relative flex items-center group focus:outline-none"> {/* Outer group controls slider visibility */}
                  {/* Volume Button with its own group for tooltip */}
                  <div className="relative group focus:outline-none"> {/* Inner group just for tooltip */}
                    <button
                      onClick={() => {
                        const video = videoRef.current;
                        video.muted = !video.muted;
                        setIsMuted(video.muted);
                      }}
                      className="w-6 h-6 flex items-center justify-center cursor-pointer focus:outline-none"
                      aria-label="Volume"
                    >
                      {isMuted ? (
                        <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white">
                          <path d="m 21.48,17.98 c 0,-1.77 -1.02,-3.29 -2.5,-4.03 v 2.21 l 2.45,2.45 c .03,-0.2 .05,-0.41 .05,-0.63 z m 2.5,0 c 0,.94 -0.2,1.82 -0.54,2.64 l 1.51,1.51 c .66,-1.24 1.03,-2.65 1.03,-4.15 0,-4.28 -2.99,-7.86 -7,-8.76 v 2.05 c 2.89,.86 5,3.54 5,6.71 z M 9.25,8.98 l -1.27,1.26 4.72,4.73 H 7.98 v 6 H 11.98 l 5,5 v -6.73 l 4.25,4.25 c -0.67,.52 -1.42,.93 -2.25,1.18 v 2.06 c 1.38,-0.31 2.63,-0.95 3.69,-1.81 l 2.04,2.05 1.27,-1.27 -9,-9 -7.72,-7.72 z m 7.72,.99 -2.09,2.08 2.09,2.09 V 9.98 z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white">
                          <path d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" />
                        </svg>
                      )}
                    </button>
                    <div className="focus:outline-none absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                      Mute <Key combo="m" /><br />Volume <Key combo="↑↓" />
                    </div>
                    {/* Volume Slider — visible on hover of button or slider */}
                    <div className="absolute left-full focus:outline-none top-1/2 -translate-y-1/2 ml-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-40 bg-transparent">
                      <div className="relative w-24 h-1 bg-white/50 rounded focus:outline-none">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full"
                          style={{
                            left: `${(videoRef.current?.volume ?? 1) * 96}px`,
                          }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={videoRef.current?.volume ?? 1}
                          onChange={(e) => {
                            const vol = parseFloat(e.target.value);
                            videoRef.current.volume = vol;
                            videoRef.current.muted = vol === 0;
                            setIsMuted(videoRef.current.muted);
                            showVolumeOverlay(vol);
                            setLocal('videoVolume', vol.toString());
                          }}
                          className="absolute top-0 left-0 w-full h-4 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Video Time Display */}
                  <div className="ml-2 whitespace-nowrap transition-transform duration-200 group-hover:translate-x-28">
                    {formatTime(videoTime.current)}
                    {(!isMobile || document.fullscreenElement || isLandscape) && (
                      <> / {formatTime(videoTime.duration)}</>
                    )}
                    {currentSet != null && currentRallyNumber != null && (!isMobile || document.fullscreenElement || isLandscape) && (
                      <span className="ml-2 text-sm text-gray-300">
                        Set {currentSet}, Rally {currentRallyNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Center Controls */}
              <div className="flex items-center justify-center gap-3">
                {/* Previous Set */}
                <div className="relative group inline-flex items-center justify-center">
                  <PreviousSetButton
                    onClick={() => {
                      if (isCustomPlayback) return;
                      const current = parseInt(currentSet, 10);
                      const currentRallies = ralliesBySet.get(current);
                      if (!currentRallies || currentRallies.length === 0) return;
                      const firstRallyStart = currentRallies[0].start;
                      const currentTime = videoRef.current.currentTime;
                      if (currentTime <= firstRallyStart + RALLY_NAVIGATION_BUFFER) {
                        const prevSet = isFirstSet ? current : current - 1;
                        seekToSet(prevSet);
                      } else {
                        seekToSet(current);
                      }
                    }}
                    disabled={isCustomPlayback}
                  />
                  <div className="focus:outline-none absolute bottom-[58px] left-1/2 whitespace-nowrap -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    {isCustomPlayback ? "Disabled during highlight reel playback" : isFirstSet ? "First Set" : "Previous Set"}
                  </div>
                </div>
                {/* Previous Rally */}
                <div className="relative group inline-flex items-center justify-center">
                  <PreviousRallyButton
                    onClick={() => {
                      if (isCustomPlayback) return;
                      const video = videoRef.current;
                      const currentTime = video.currentTime;
                      const sorted = [...rallyStartTimestamps].sort((a, b) => b - a);
                      const prev = sorted.find((ts) => ts < currentTime - RALLY_NAVIGATION_BUFFER);
                      if (prev !== undefined) video.currentTime = prev;
                    }}
                    disabled={isCustomPlayback}
                  />
                  <div className="absolute bottom-[58px] left-1/2 whitespace-nowrap -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    {isCustomPlayback ? "Disabled during highlight reel playback" : <>Previous Rally <Key combo="ctrl + ←" /></>}
                  </div>
                </div>
                {/* Rewind Button */}
                <div className="relative group inline-flex items-center justify-center">
                  <RewindButton amount={REWIND_AMOUNT} onClick={() => {
                    const video = videoRef.current;
                    video.currentTime = Math.max(0, video.currentTime - REWIND_AMOUNT);
                  }}
                  />
                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    <>Rewind {REWIND_AMOUNT}s <Key combo="←" /></>
                  </div>
                </div>
                {/*  Play/Pause Button */}
                <div className="relative group inline-flex items-center justify-center">
                  <button onClick={() => {
                    const video = videoRef.current;
                    if (video.paused) video.play();
                    else video.pause();
                  }}
                    className="w-8 h-8 cursor-pointer"
                    aria-label="Play/Pause"
                  >
                    {videoRef.current?.paused ? (
                      <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white" >
                        <path d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white" >
                        <path d="M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z" />
                      </svg>
                    )}
                  </button>
                  <div className="absolute bottom-[62px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    <>Play/Pause <Key combo="Space" /></>
                  </div>
                </div>
                {/* Forward Button */}
                <div className="relative group inline-flex items-center justify-center">
                  <ForwardButton amount={FORWARD_AMOUNT} onClick={() => {
                    const video = videoRef.current;
                    video.currentTime = Math.min(video.duration, video.currentTime + FORWARD_AMOUNT);
                  }} />
                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    <>Forward {FORWARD_AMOUNT}s <Key combo="→" /></>
                  </div>
                </div>
                {/* Next Rally */}
                <div className="relative group inline-flex items-center justify-center">
                  <NextRallyButton
                    onClick={() => {
                      if (isCustomPlayback) return;
                      const video = videoRef.current;
                      const currentTime = video.currentTime;
                      const sorted = [...rallyStartTimestamps].sort((a, b) => a - b);
                      const next = sorted.find((ts) => ts > currentTime);
                      if (next !== undefined) video.currentTime = next;
                    }}
                    disabled={isCustomPlayback}
                  />
                  <div className="absolute bottom-[58px] left-1/2 whitespace-nowrap -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    {isCustomPlayback ? "Disabled during highlight reel playback" : <>Next Rally <Key combo="ctrl + →" /></>}
                  </div>
                </div>
                {/* Next Set */}
                <div className="relative group inline-flex items-center justify-center">
                  <NextSetButton
                    onClick={() => {
                      if (effectiveDisabled) return;
                      const nextSet = parseInt(currentSet, 10) + 1;
                      const firstRallyStart = rallyTimes[0]?.start ?? 0;
                      const currentTime = videoRef.current.currentTime;
                      if (currentTime < firstRallyStart) {
                        videoRef.current.currentTime = firstRallyStart;
                      } else {
                        seekToSet(nextSet);
                      }
                    }}
                    disabled={effectiveDisabled}
                  />
                  <div className="absolute bottom-[58px] left-1/2 whitespace-nowrap -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    {isCustomPlayback ? "Disabled during highlight reel playback" : isLastSet ? "Last Set" : "Next Set"}
                  </div>
                </div>
              </div>
              {/* Right Controls */}
              <div className="flex items-center gap-2">
                {/* Autoplay Toggle */}
                <div className="relative group inline-flex items-center justify-center">
                  <button
                    onMouseDown={() => {
                      if (isCustomPlayback) {
                        setIsCustomPlayback(false);
                        customPlaybackCancelledRef.current = true;
                        return;
                      }
                      setIsAutoplayOn((prev) => !prev);
                    }}
                    className="w-6 h-6 flex items-center justify-center focus:ring-0"
                    aria-label="Autoplay"
                  >
                    <AutoplayIcon
                      size={16}
                      color={
                        isCustomPlayback ? "#22c55e" : isAutoplayOn ? "white" : "gray"
                      }
                      className="transition-colors duration-200 cursor-pointer"
                    />
                  </button>
                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    {isCustomPlayback
                      ? <>Stop Highlight Reel <Key combo="s" /></>
                      : <>Toggle Autoplay <Key combo="a" /></>}
                  </div>
                </div>
                {/* Toggle Overlay */}
                <div className="relative group inline-flex items-center justify-center">
                  <button onMouseDown={() => setShowOverlay((prev) => !prev)} className="w-8 h-8 cursor-pointer focus:outline-none" aria-label="Toggle Overlay" >
                    <svg className="" viewBox="0 0 36 36" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" >
                      <path d="M11,11 C9.89,11 9,11.9 9,13 L9,23 C9,24.1 9.89,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M17,17 L15.5,17 L15.5,16.5 L13.5,16.5 L13.5,19.5 L15.5,19.5 L15.5,19 L17,19 L17,20 C17,20.55 16.55,21 16,21 L13,21 C12.45,21 12,20.55 12,20 L12,16 C12,15.45 12.45,15 13,15 L16,15 C16.55,15 17,15.45 17,16 L17,17 L17,17 Z M24,17 L22.5,17 L22.5,16.5 L20.5,16.5 L20.5,19.5 L22.5,19.5 L22.5,19 L24,19 L24,20 C24,20.55 23.55,21 23,21 L20,21 C19.45,21 19,20.55 19,20 L19,16 C19,15.45 19.45,15 20,15 L23,15 C23.55,15 24,15.45 24,16 L24,17 L24,17 Z" fill={showOverlay ? "white" : "gray"} className="transition-colors duration-200" />
                    </svg>
                  </button>
                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    Toggle Overlay <Key combo="c" />
                  </div>
                </div>
                {/* PiP */}
                {!(!document.fullscreenElement && isMobile && !isLandscape) && (
                  <div className="relative group inline-flex items-center justify-center">
                    <button onMouseDown={async () => {
                      try {
                        if (document.pictureInPictureElement) {
                          await document.exitPictureInPicture();
                        } else if (videoRef.current) {
                          await videoRef.current.requestPictureInPicture();
                        }
                      } catch (err) {
                        console.error("PiP failed:", err);
                      }
                    }}
                      className="w-8 h-8 cursor-pointer focus:outline-none" aria-label="Picture-in-Picture" >
                      <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white" >
                        <path d="M25,17 L17,17 L17,23 L25,23 L25,17 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 L27,25.02 Z" />
                      </svg>
                    </button>
                    <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                      Pop Out <Key combo="p" />
                    </div>
                  </div>
                )}
                {/* Fullscreen */}
                <div className="relative group inline-flex items-center justify-center">
                  <button onMouseDown={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      requestFullscreen();
                    }
                  }}
                    className="w-8 h-8 cursor-pointer focus:outline-none" aria-label="Fullscreen">
                    <svg viewBox="0 0 36 36" width="100%" height="100%" fill="white" >
                      <g>
                        <path d="m10,16 2,0 0,-4 4,0 0,-2 L10,10 l 0,6 Z" />
                      </g>
                      <g>
                        <path d="m20,10 0,2 4,0 0,4 2,0 L26,10 l -6,0 Z" />
                      </g>
                      <g>
                        <path d="m24,24 -4,0 0,2 L26,26 l 0,-6 -2,0 0,4 Z" />
                      </g>
                      <g>
                        <path d="M12,20 10,20 10,26 l 6,0 0,-2 -4,0 0,-4 Z" />
                      </g>
                    </svg>
                  </button>
                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                    Full Screen <Key combo="f" />
                  </div>
                </div>
                {/* Settings Button */}
                {!(!document.fullscreenElement && isMobile && !isLandscape) && (
                  <div className="relative inline-flex items-center justify-center" ref={settingsRef}>
                    <button type="button" tabIndex="0"
                      onMouseDown={() => {
                        setIsSettingsOpen((prev) => !prev);
                        setSettingsView("main");
                      }}
                      className="w-8 h-8 cursor-pointer focus:outline-none" aria-label="Settings" >
                      <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                        <path
                          d="m 23.94,18.78 c .03,-0.25 .05,-0.51 .05,-0.78 0,-0.27 -0.02,-0.52 -0.05,-0.78 l 1.68,-1.32 c .15,-0.12 .19,-0.33 .09,-0.51 l -1.6,-2.76 c -0.09,-0.17 -0.31,-0.24 -0.48,-0.17 l -1.99,.8 c -0.41,-0.32 -0.86,-0.58 -1.35,-0.78 l -0.30,-2.12 c -0.02,-0.19 -0.19,-0.33 -0.39,-0.33 l -3.2,0 c -0.2,0 -0.36,.14 -0.39,.33 l -0.30,2.12 c -0.48,.2 -0.93,.47 -1.35,.78 l -1.99,-0.8 c -0.18,-0.07 -0.39,0 -0.48,.17 l -1.6,2.76 c -0.10,.17 -0.05,.39 .09,.51 l 1.68,1.32 c -0.03,.25 -0.05,.52 -0.05,.78 0,.26 .02,.52 .05,.78 l -1.68,1.32 c -0.15,.12 -0.19,.33 -0.09,.51 l 1.6,2.76 c .09,.17 .31,.24 .48,.17 l 1.99,-0.8 c .41,.32 .86,.58 1.35,.78 l .30,2.12 c .02,.19 .19,.33 .39,.33 l 3.2,0 c .2,0 .36,-0.14 .39,-0.33 l .30,-2.12 c .48,-0.2 .93,-0.47 1.35,-0.78 l 1.99,.8 c .18,.07 .39,0 .48,-0.17 l 1.6,-2.76 c .09,-0.17 .05,-0.39 -0.09,-0.51 l -1.68,-1.32 0,0 z m -5.94,2.01 c -1.54,0 -2.8,-1.25 -2.8,-2.8 0,-1.54 1.25,-2.8 2.8,-2.8 1.54,0 2.8,1.25 2.8,2.8 0,1.54 -1.25,2.8 -2.8,2.8 l 0,0 z"
                          fill="#fff"
                        />
                      </svg>
                    </button>
                    {/* Main Menu */}
                    {isSettingsOpen && settingsView === "main" && (
                      <div className="absolute bottom-[58px] right-0 w-64 text-white text-sm rounded-lg shadow-lg z-50 p-2 bg-black/30 backdrop-blur-sm border border-white/10">
                        <button
                          onClick={() => setSettingsView("overlay")}
                          className="flex items-center justify-between w-full hover:bg-white/10 px-3 py-2 rounded"
                        >
                          {/* Left side: Icon + Label */}
                          <div className="flex items-center gap-2 w-full justify-start">
                            <svg
                              viewBox="9 11 18 14"
                              width="18"
                              height="18"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M11,11 C9.89,11 9,11.9 9,13 L9,23 C9,24.1 9.89,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M17,17 L15.5,17 L15.5,16.5 L13.5,16.5 L13.5,19.5 L15.5,19.5 L15.5,19 L17,19 L17,20 C17,20.55 16.55,21 16,21 L13,21 C12.45,21 12,20.55 12,20 L12,16 C12,15.45 12.45,15 13,15 L16,15 C16.55,15 17,15.45 17,16 L17,17 Z M24,17 L22.5,17 L22.5,16.5 L20.5,16.5 L20.5,19.5 L22.5,19.5 L22.5,19 L24,19 L24,20 C24,20.55 23.55,21 23,21 L20,21 C19.45,21 19,20.55 19,20 L19,16 C19,15.45 19.45,15 20,15 L23,15 C23.55,15 24,15.45 24,16 L24,17 Z"
                                fill={showOverlay ? "white" : "gray"}
                                className="transition-colors duration-200 "
                              />
                            </svg>
                            <span className="text-sm">Overlay</span>
                          </div>
                          {/* Right side: On/Off + arrow */}
                          <div className="flex items-center gap-2 text-gray-300">
                            <span>{showOverlay ? "On" : "Off"}</span>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M6 12l4-4-4-4v8z" />
                            </svg>
                          </div>
                        </button>
                        {/* Zoom Control (only when fullscreen) */}
                        {document.fullscreenElement ? (
                          <button
                            onClick={() => setSettingsView("zoom")}
                            className="flex items-center justify-between w-full hover:bg-white/10 px-3 py-2 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              <span className="text-sm">Camera View</span>
                            </div>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M6 12l4-4-4-4v8z" />
                            </svg>
                          </button>
                        ) : (
                          <div className="w-full px-3 py-2 rounded opacity-50 cursor-not-allowed text-gray-400">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm">Camera View</span>
                                  <span className="text-xs">(fullscreen only)</span>
                                </div>
                              </div>
                              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M6 12l4-4-4-4v8z" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Zoom & Pan Submenu */}
                    {isSettingsOpen && settingsView === "zoom" && (
                      <div className="absolute bottom-[58px] right-0 w-64 text-white text-sm rounded-lg shadow-lg z-50 p-3 bg-black/30 backdrop-blur-sm border border-white/10 space-y-3">
                        {/* Back Header */}
                        <button
                          onClick={() => setSettingsView("main")}
                          className="flex items-center w-full gap-2 px-3 py-2 hover:bg-white/10 rounded text-white text-sm"
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M10 12L6 8l4-4v8z" />
                          </svg>
                          <span className="font-medium">Zoom, Pan, & Tilt</span>
                        </button>
                        {/* Zoom Label + Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm">Zoom</span>
                            <span className="text-xs text-gray-300">{zoom.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="2"
                            step="0.05"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full accent-orange-500"
                          />
                        </div>
                        {/* Pan Arrows */}
                        <div className="flex justify-center mt-4">
                          <div className="bg-black/60 rounded-lg p-1">
                            <div className="grid grid-cols-3 gap-0.5 text-white">
                              {/* Top-left: Rotate -5° */}
                              <button
                                onClick={() => setRotation((prev) => normalizeRotation(prev + 5))}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                                aria-label="Rotate Right 5°"
                              >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path d="M15 3l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M19 7h-6a7 7 0 1 0 7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              {/* Pan Up */}
                              <button
                                onClick={() => panByArrow("up")}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              {/* Top-right: Rotate -5° */}
                              <button
                                onClick={() => setRotation((prev) => normalizeRotation(prev - 5))}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                                aria-label="Rotate Left 5°"
                              >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path d="M9 3L5 7l4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M5 7h6a7 7 0 1 1-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              {/* Pan Left */}
                              <button
                                onClick={() => panByArrow("left")}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              {/* Center: Optional reset or angle display */}
                              <div className="w-14 h-14 flex items-center justify-center text-xs text-gray-400">
                                <button
                                  onClick={() => {
                                    setZoom(1);
                                    setPan({ x: 0, y: 0 });
                                    setRotation(0);
                                  }}
                                  className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex flex-col items-center justify-center text-xs text-white"
                                  aria-label="Reset View"
                                >
                                  <span className="font-semibold">{rotation}°</span>
                                  <span className="text-[10px] text-gray-300">Reset</span>
                                </button>
                              </div>
                              {/* Pan Right */}
                              <button
                                onClick={() => panByArrow("right")}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              {/* Bottom-left: Rotate -1° */}
                              <button
                                onClick={() => setRotation((prev) => normalizeRotation(prev + 1))}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                                aria-label="Rotate Right 1°"
                              >
                                <span className="text-lg font-semibold">+1°</span>
                              </button>
                              {/* Pan Down */}
                              <button
                                onClick={() => panByArrow("down")}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {/* Bottom-right: Rotate +1° */}
                              <button
                                onClick={() => setRotation((prev) => normalizeRotation(prev - 1))}
                                className="w-14 h-14 bg-white/10 hover:bg-orange-400/20 rounded flex items-center justify-center"
                                aria-label="Rotate Left 1°"
                              >
                                <span className="text-lg font-semibold">-1°</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Hint */}
                        <p className="text-xs text-gray-400 italic text-center mt-1">
                          Use arrow keys to pan while Settings is open
                        </p>
                      </div>
                    )}
                    {/* Overlay Submenu */}
                    {isSettingsOpen && settingsView === "overlay" && (
                      <div className="absolute bottom-[58px] right-0 w-64 text-white text-sm rounded-lg shadow-lg z-50 p-2 bg-black/30 backdrop-blur-sm border border-white/10">
                        {/* Back Header */}
                        <button
                          onClick={() => setSettingsView("main")}
                          className="flex items-center w-full gap-2 px-3 py-2 hover:bg-white/10 rounded text-white text-sm"
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M10 12L6 8l4-4v8z" />
                          </svg>
                          <span className="font-medium">Overlay Options</span>
                        </button>
                        <div className="h-px bg-white/10 my-2" />
                        {/* Toggle: Show Overlay */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded">
                          <span className="text-sm">Show Overlay</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={showOverlay}
                              onChange={() => setShowOverlay((prev) => !prev)}
                            />
                            <div className="w-9 h-5 bg-gray-600 peer-checked:bg-red-600 rounded-full peer peer-focus:ring-2 ring-red-500 transition-all duration-200" />
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform peer-checked:translate-x-4 transition duration-200" />
                          </label>
                        </div>
                        <div className="ml-4 bg-white/5 rounded px-2 py-1">
                          {/* Toggle: Show Score */}
                          <div className="flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded">
                            <span className="text-sm">Show Score</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={showScoreOverlay}
                                onChange={() => {
                                  if (!showScoreOverlay && !showOverlay) setShowOverlay(true);
                                  setShowScoreOverlay((prev) => !prev);
                                }}
                              />
                              <div className="w-9 h-5 bg-gray-600 peer-checked:bg-red-600 rounded-full peer peer-focus:ring-2 ring-red-500 transition-all duration-200" />
                              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform peer-checked:translate-x-4 transition duration-200" />
                            </label>
                          </div>
                          {/* Toggle: Show Touches */}
                          <div className="flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded">
                            <span className="text-sm">Show Touches</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={showTouchesOverlay}
                                onChange={() => {
                                  if (!showTouchesOverlay && !showOverlay) setShowOverlay(true);
                                  setShowTouchesOverlay((prev) => !prev);
                                }}
                              />
                              <div className="w-9 h-5 bg-gray-600 peer-checked:bg-red-600 rounded-full peer peer-focus:ring-2 ring-red-500 transition-all duration-200" />
                              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform peer-checked:translate-x-4 transition duration-200" />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>)}
        {showOverlay && (
          <>
            {showScoreOverlay && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-30">
                <div className="flex items-center gap-4 bg-black/30 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full tracking-wide shadow-sm">
                  <div className="text-gray-300 whitespace-nowrap">MY TEAM</div>
                  <div className="text-xl">{currentScore.split(" - ")[0]}</div>
                  <div className="text-gray-400 whitespace-nowrap">SET {currentSet}</div>
                  <div className="text-xl">{currentScore.split(" - ")[1]}</div>
                  <div className="text-gray-300">OPPONENT</div>
                </div>
              </div>
            )}
            {showTouchesOverlay && (
              <div className={`absolute bottom-4 left-4 pointer-events-none transition-all duration-300 z-30 ${showControls ? "mb-16" : ""}`} >
                <div className="flex flex-col gap-1 bg-black/30 text-white text-xs px-3 py-2 rounded-md max-w-[240px] backdrop-blur-sm">
                  <div className="text-gray-400 font-semibold mb-1 tracking-wide">
                    Upcoming Touches
                  </div>
                  {touchBuffer.length === 0 ? (
                    <div className="text-gray-500 italic">None</div>
                  ) : (
                    touchBuffer.map((touch, idx) => (
                      <div key={idx} className="bg-white/5 rounded px-2 py-1 text-[11px] leading-snug" >
                        {touch.player ? (
                          <>
                            <div className="flex justify-between text-gray-200 font-medium">
                              <span>{touch.player}</span>
                              <span className="text-gray-300">{touch.quality}</span>
                            </div>
                            <div className="text-gray-300">{touch.action_type}</div>
                            {touch.notes && (
                              <div className="text-gray-300 italic mt-0.5">{touch.notes}</div>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-300">{touch.notes}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Toast
        message={toastMessage}
        show={showToast}
        duration={toastDuration}
        onClose={() => setShowToast(false)}
        type={toastType}
      />
    </>
  );
});
export default VideoPlayer;
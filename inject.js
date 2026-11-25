/* ==========================================================================
 *   FILE: inject.js
 *   - MAIN World (Seitenkontext)
 *   - getUserMedia-Hook + Live-Updates
 *   - NEU in v9: Leichtmodus — vor dem Aufruf der nativen getUserMedia
 *     werden die Video-Constraints weich gekappt (640x360 ideal, 15 fps
 *     ideal). "ideal" ist nicht hart: keine Kamera scheitert daran, aber
 *     Chrome waehlt auf schwachen Maschinen gern die kleinere Variante.
 *     Leichtmodus wirkt beim Kamerastart (Seite neu laden).
 *   - Blur: options.bgBlur = Sigma (Slider 1-100), options.bgBlurRadius =
 *     2 x Slider. NICHT options.blur anfassen (Frame-Pre-Blur, nur mit
 *     enableFilters aktiv — das wuerde die Person mitverwischen)!
 *   - Eigenes Bild: options.backgroundUrl = dataURL — der Proxy-Setter
 *     laedt die Quelle selbst (fetch -> createImageBitmap).
 *   - "Aus": options.enabled = false — Frames laufen live unveraendert durch.
 *   ========================================================================== */
(() => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  const nativeGetUserMedia =
  navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  /* ---------- Konfiguration + Einstellungen aus dem data-Attribut ---------- */
  let cfgPromise = null;
  const getCfg = () => {
    if (cfgPromise) return cfgPromise;
    cfgPromise = new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        const attr = document.documentElement.getAttribute('data-vb-urls');
        if (attr && attr.includes('"settings"')) {
          clearInterval(timer);
          try {
            resolve(JSON.parse(attr));
          } catch (e) {
            reject(e);
          }
        } else if (++tries > 2000) {
          clearInterval(timer);
          reject(new Error('VirtualBackground: keine Konfiguration erhalten'));
        }
      }, 5);
    });
    return cfgPromise;
  };

  /* ---------- Bibliothek laden (<script src=...>, echte src fuer webpack) -- */
  let libPromise = null;
  const loadLibrary = (src) => {
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () =>
      reject(new Error('VirtualBackground: Script konnte nicht geladen werden: ' + src));
      (document.head || document.documentElement).appendChild(script);
    });
    return libPromise;
  };

  /* ---------- WASM + Modell als Blob-URLs ---------- */
  const blobUrl = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch fehlgeschlagen (${res.status}): ${url}`);
    return URL.createObjectURL(await res.blob());
  };

  let configured = false;
  const configureOnce = async (cfg) => {
    if (configured) return;
    if (!window.VirtualBackground) {
      throw new Error('VirtualBackground library nicht geladen');
    }
    const opts = window.VirtualBackground.options;
    if (typeof opts.wasmLoaderPath === 'string' &&
      (opts.wasmLoaderPath.startsWith('mediapipe') ||
      opts.wasmLoaderPath === 'mediapipe/tasks-vision/wasm/vision_wasm_internal.js')) {
      opts.wasmLoaderPath = await blobUrl(cfg.wasmJs);
    opts.wasmBinaryPath = await blobUrl(cfg.wasmBin);
    opts.modelPath = await blobUrl(cfg.model);
      }
      configured = true;
  };

  /* ---------- Einstellungen anwenden (live; Render-Loop liest jeden Frame) --
   *     Slider 1-100 = Gauss-Sigma (Sigma bestimmt die sichtbare Unschärfe),
   *     Radius = 2 x Slider (Sample-Reichweite; Tap-Anzahl ist fix im Shader,
   *     der Radius kostet also nichts Extra). enableFilters NICHT setzen. */
  let lastBackgroundUrl = null;

  const applySettings = (s) => {
    const opts = window.VirtualBackground.options;
    const blur = Number(s.blur) || 0;
    opts.enableFilters = false;

    if (s.mode === 'blur') {
      opts.enabled = true;
      opts.bgBlur = Math.max(1, blur);        // Sigma = Sliderwert
      opts.bgBlurRadius = Math.max(2, blur * 2); // Sample-Reichweite
      lastBackgroundUrl = null;
    } else if (s.mode === 'image' && s.imageDataUrl) {
      opts.enabled = true;
      opts.bgBlur = 0;
      // Nur neu setzen, wenn sich das Bild wirklich geändert hat:
      // der Setter löst sonst bei jedem Poll erneut fetch + Textur-Upload aus.
      if (s.imageDataUrl !== lastBackgroundUrl) {
        opts.backgroundUrl = s.imageDataUrl;
        lastBackgroundUrl = s.imageDataUrl;
      }
    } else {
      // Modus "Aus": Frame läuft unangetastet durch den Blend-Shader.
      opts.enabled = false;
    }

    console.log('[VB] angewendet:', {
      mode: s.mode,
      blur: s.mode === 'blur' ? { sigma: opts.bgBlur, radius: opts.bgBlurRadius } : undefined,
      image: s.mode === 'image' ? Boolean(s.imageDataUrl) : undefined,
                enabled: opts.enabled
    });
  };

  /* ---------- Live-Update: data-Attribut beobachten ---------- */
  let lastJson = null;
  let applying = false;
  setInterval(async () => {
    if (!window.VirtualBackground || !configured || applying) return;
    const attr = document.documentElement.getAttribute('data-vb-urls');
    if (!attr || attr === lastJson) return;
    lastJson = attr;
    try {
      const cfg = JSON.parse(attr);
      if (cfg.settings) {
        applying = true;
        applySettings(cfg.settings);
        applying = false;
      }
    } catch (e) {
      applying = false;
      console.warn('VirtualBackground: live update fehlgeschlagen', e);
    }
  }, 500);

  /* ---------- Leichtmodus: Video-Constraints weich kappen -------------------
   *     Wichtig: ausschließlich "ideal"/weiche Werte — harte Constraints
   *     ("max"/"exact") koennen auf manchen Kameras OverconstrainedError
   *     werfen und den getUserMedia-Aufruf komplett scheitern lassen.
   *     Wir stiften hier nur eine Praeferenz, kein Zwang. */
  const LITE_VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } };

  const capConstraints = (constraints) => {
    // Kein Objekt (z. B. undefined) → sinnvolle Defaults mit Lite-Caps
    const c = (constraints && typeof constraints === 'object') ? { ...constraints } : {};
    // video: true/undefined → Objekt mit Caps; bereits Objekt → Caps hineinmergen;
    // deviceId etc. bleiben erhalten.
    if (c.video === true || c.video === undefined) c.video = { ...LITE_VIDEO };
    else if (c.video && typeof c.video === 'object') c.video = { ...c.video, ...LITE_VIDEO };
    // video: "deviceId"-String oder false → unangetastet lassen.
    return c;
  };

  /* ---------- getUserMedia-Hook ---------- */
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    let effective = constraints;
    try {
      const cfg = await getCfg();
      if (cfg.settings && cfg.settings.lite) {
        effective = capConstraints(constraints);
        console.log('[VB] Leichtmodus aktiv — Constraints gekappt:', JSON.stringify(effective));
      }
    } catch (e) {
      /* keine Config da (noch keine Einstellungen veröffentlicht) —
       *         normaler Aufruf ohne Caps */
    }
    console.log('getUserMedia:', JSON.stringify(effective));
    const mediaStream = await nativeGetUserMedia(effective);
    const track = mediaStream.getVideoTracks()[0];
    if (track) {
      try {
        const cfg = await getCfg();
        const s = cfg.settings;
        if (s.mode === 'off') {
          return mediaStream; // nichts zu tun
        }
        await loadLibrary(cfg.lib);
        await configureOnce(cfg);
        applySettings(s);
        const newTrack = await window.VirtualBackground.processVideoTrack(track);
        mediaStream.removeTrack(track);
        mediaStream.addTrack(newTrack);
      } catch (e) {
        console.error('VirtualBackground error', e);
      }
    }
    return mediaStream;
  };

  navigator.getUserMedia = function (constraints, onSuccess, onError) {
    navigator.mediaDevices
    .getUserMedia(constraints)
    .then((mediaStream) => onSuccess(mediaStream))
    .catch((error) => onError(error));
  };
})();

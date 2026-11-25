/* ==========================================================================
  FILE: inject.js
 - MAIN World (Seitenkontext)
 - getUserMedia-Hook + Live-Updates
 - Blur-Mapping v8: das Shader-Gewicht exp(-offset^2/(2*sigma^2)) macht die
 SICHTBARE Unschraefe allein vom Sigma abhaengig (~ +/-3 sigma Texel).
 Die Schleife ist fix (24 x 21 Taps) -> Radius kostet nichts.
 bgBlur (Sigma) = slider  (1..100, kein Cap)
 bgBlurRadius   = slider*2 (Sample-Reichweite >= 3 sigma)
 - Eigenes Bild: options.backgroundUrl = dataURL — der Proxy-Setter laedt
 die Quelle selbst (fetch -> createImageBitmap -> backgroundSource-Objekt).
 - "Aus": options.enabled = false — Frames laufen live unveraendert durch.
 ========================================================================== */
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
   * Slider 1..100 -> Sigma 1..100 (sichtbare Unschraefe ~ +/-3 sigma Texel),
   * Radius = 2x Slider (>= 3 sigma, damit der Gaussian nicht abgeschnitten
   * wird). Fixe Tap-Anzahl: grosse Werte kosten keine zusaetzliche Leistung.
   * WICHTIG: enableFilters NICHT setzen — options.blur wäre der falsche
   * Hebel (blurriert den ganzen Frame inkl. Person, nur mit enableFilters). */
  let lastBackgroundUrl = null;
  let lastLoggedKey = '';

  const applySettings = (s) => {
    const opts = window.VirtualBackground.options;
    const blur = Number(s.blur) || 0;
    opts.enableFilters = false;

    if (s.mode === 'blur') {
      opts.enabled = true;
      opts.bgBlur = Math.max(1, blur);          // Sigma ohne Cap
      opts.bgBlurRadius = Math.max(30, blur * 2); // Reichweite >= 3 sigma
      // Hintergrundquelle unberührt lassen — der Blur-Zweig gewinnt im Shader.
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

    const key = `${s.mode}|${blur}`;
    if (key !== lastLoggedKey) {
      lastLoggedKey = key;
      console.log('[VB] angewendet:', s.mode,
                  '| bgBlur (Sigma):', opts.bgBlur,
                  '| bgBlurRadius:', opts.bgBlurRadius,
                  '| enabled:', opts.enabled,
                  '| backgroundUrl gesetzt:', s.mode === 'image' && !!s.imageDataUrl);
    }
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

  /* ---------- getUserMedia-Hook ---------- */
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    console.log('getUserMedia:', JSON.stringify(constraints));
    const mediaStream = await nativeGetUserMedia(constraints);
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

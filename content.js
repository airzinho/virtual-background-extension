/* ==========================================================================
 *   FILE: content.js
 *   - Isolated World: Resource-URLs + Einstellungen als data-Attribut,
 *     UI-Panel (Shadow DOM), Persistenz in chrome.storage.local
 *   - NEU in v9: Leichtmodus-Checkbox im Panel.
 *   ========================================================================== */
(() => {
  const SETTINGS_KEY = 'vbSettings';
  const DEFAULT_SETTINGS = { mode: 'blur', blur: 20, imageDataUrl: null, lite: false };

  const BASE_URLS = {
    lib: chrome.runtime.getURL('vendor/virtual-background.js'),
 wasmJs: chrome.runtime.getURL('vendor/vision_wasm_internal.js'),
 wasmBin: chrome.runtime.getURL('vendor/vision_wasm_internal.wasm'),
 model: chrome.runtime.getURL('vendor/selfie_multiclass_256x256.tflite')
  };
  const publish = (settings) => {
    document.documentElement.setAttribute(
      'data-vb-urls',
      JSON.stringify({ ...BASE_URLS, settings })
    );
  };

  chrome.storage.local.get(SETTINGS_KEY, (res) => {
    publish({ ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      publish({ ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue });
    }
  });

  const saveSettings = (settings) =>
  chrome.storage.local.set({ [SETTINGS_KEY]: settings });

  /* ---------- Farbvoreinstellungen als dataURL ---------- */
  const colorPreset = (css) => {
    const c = document.createElement('canvas');
    c.width = c.height = 320;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 320);
    css.forEach((col, i) => g.addColorStop(i / (css.length - 1), col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 320);
    return c.toDataURL('image/jpeg', 0.9);
  };

  const PRESETS = [
    { name: 'Studio Grau', css: ['#2b2b30', '#3c3c45'] },
    { name: 'Blau', css: ['#1e3a8a', '#3b82f6'] },
    { name: 'Grün', css: ['#14532d', '#22c55e'] },
    { name: 'Abendrot', css: ['#7c2d12', '#f97316'] }
  ];

  /* ---------- UI (Shadow DOM) ---------- */
  const buildUI = () => {
    const host = document.createElement('div');
    host.id = 'vb-extension-host';
    host.style.cssText =
    'position:fixed;left:16px;bottom:16px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
    <style>
    :host { all: initial; font-family: system-ui, sans-serif; }
    .fab {
      width: 42px; height: 42px; border-radius: 50%;
      border: none; cursor: pointer; font-size: 20px;
      background: #6d4aff; color: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }
    .panel {
      display: none; position: absolute; left: 0; bottom: 52px;
      width: 280px; padding: 14px; border-radius: 12px;
      background: #1e1e24; color: #eee;
      box-shadow: 0 4px 16px rgba(0,0,0,.45);
    }
    .panel.open { display: block; }
    .panel h3 { margin: 0 0 10px; font-size: 14px; }
    .panel label { display: block; font-size: 12px; margin: 8px 0 4px; }
    .panel select, .panel button.opt {
      width: 100%; padding: 6px; border-radius: 6px;
      border: 1px solid #444; background: #2a2a33; color: #eee;
    }
    .panel input[type=range] { width: 100%; }
    .lite-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; margin-top: 10px; cursor: pointer;
    }
    .lite-row input { accent-color: #6d4aff; }
    .swatches { display: flex; gap: 6px; margin-top: 6px; }
    .swatches button {
      width: 34px; height: 34px; border-radius: 6px;
      border: 2px solid transparent; cursor: pointer;
    }
    .swatches button.active { border-color: #6d4aff; }
    .imgbtn { margin-top: 6px; cursor: pointer; }
    .hint { font-size: 11px; color: #999; margin-top: 8px; }
    </style>
    <button class="fab" title="Virtual Background">🎬</button>
    <div class="panel">
    <h3>Virtual Background</h3>
    <label for="vb-mode">Modus</label>
    <select id="vb-mode">
    <option value="off">Aus (Original)</option>
    <option value="blur">Hintergrund weichzeichnen</option>
    <option value="image">Eigenes Hintergrundbild</option>
    </select>
    <div id="vb-blur-row">
    <label for="vb-blur">Weichzeichnen: <span id="vb-blur-val"></span></label>
    <input type="range" id="vb-blur" min="1" max="100" step="1" />
    </div>
    <div id="vb-img-row">
    <label for="vb-file">Bild hochladen</label>
    <input type="file" id="vb-file" accept="image/*" class="imgbtn" />
    <label>Voreinstellungen</label>
    <div class="swatches" id="vb-swatches"></div>
    </div>
    <label class="lite-row">
    <input type="checkbox" id="vb-lite" />
    Leichtmodus (640×360, 15 fps — für schwache Rechner)
    </label>
    <div class="hint">Blur/Bild/Aus greifen sofort. Der Leichtmodus wird
    beim nächsten Kamerastart wirksam (Seite neu laden).</div>
    </div>
    `;

    const fab = shadow.querySelector('.fab');
    const panel = shadow.querySelector('.panel');
    const modeSel = shadow.querySelector('#vb-mode');
    const blurRow = shadow.querySelector('#vb-blur-row');
    const imgRow = shadow.querySelector('#vb-img-row');
    const blurInput = shadow.querySelector('#vb-blur');
    const blurVal = shadow.querySelector('#vb-blur-val');
    const fileInput = shadow.querySelector('#vb-file');
    const swatchBox = shadow.querySelector('#vb-swatches');
    const liteCheck = shadow.querySelector('#vb-lite');

    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.title = p.name;
      b.style.background = `linear-gradient(${p.css[0]}, ${p.css[1]})`;
      b.addEventListener('click', () => {
        const url = colorPreset(p.css);
        update({ mode: 'image', imageDataUrl: url });
        setActiveSwatch(b);
      });
      swatchBox.appendChild(b);
    });

    const setActiveSwatch = (btn) => {
      shadow.querySelectorAll('.swatches button').forEach((b) =>
      b.classList.toggle('active', b === btn)
      );
    };

    fab.addEventListener('click', () => panel.classList.toggle('open'));

    const refresh = (s) => {
      modeSel.value = s.mode;
      blurInput.value = s.blur;
      blurVal.textContent = s.blur;
      blurRow.style.display = s.mode === 'blur' ? 'block' : 'none';
      imgRow.style.display = s.mode === 'image' ? 'block' : 'none';
      liteCheck.checked = !!s.lite;
    };

    const update = (partial) => {
      chrome.storage.local.get(SETTINGS_KEY, (res) => {
        const next = { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}), ...partial };
        saveSettings(next);
        refresh(next);
      });
    };

    modeSel.addEventListener('change', () => update({ mode: modeSel.value }));
    blurInput.addEventListener('input', () =>
    update({ blur: Number(blurInput.value) })
    );
    liteCheck.addEventListener('change', () =>
    update({ lite: liteCheck.checked })
    );
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
      update({ mode: 'image', imageDataUrl: String(reader.result) });
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    chrome.storage.local.get(SETTINGS_KEY, (res) =>
    refresh({ ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) })
    );

    const mount = () => document.body.appendChild(host);
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', buildUI, { once: true });
  else buildUI();
})();

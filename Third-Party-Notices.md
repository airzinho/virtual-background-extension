# Third-Party Notices / Hinweise zu Fremdsoftware

Diese Erweiterung bündelt Dateien aus folgenden Upstream-Projekten. Die
jeweiligen Originaldateien liegen im Ordner `vendor/` und werden bei der
Installation automatisch von den unten angegebenen Quellen heruntergeladen.
Diese Datei wird mit der Distribution ausgeliefert und erfüllt die
Hinweispflichten der jeweiligen Lizenzen.

---

## 1. @vpalmisano/virtual-background

- **Datei:** `vendor/virtual-background.js`
- **Quelle:** https://unpkg.com/@vpalmisano/virtual-background/dist/virtual-background.js
- **Projekt:** https://github.com/vpalmisano/virtual-background
- **Autor:** Vittorio Palmisano
- **Lizenz:** ISC
- **Copyright:** Copyright (c) Vittorio Palmisano

> ISC License: Permission to use, copy, modify, and/or distribute this
> software for any purpose with or without fee is hereby granted, provided
> that the above copyright notice and this permission notice appear in all
> copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
> WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
> OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
> FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
> ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
> IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

## 2. @mediapipe/tasks-vision (Web WASM Runtime)

- **Dateien:** `vendor/vision_wasm_internal.js`, `vendor/vision_wasm_internal.wasm`
- **Quelle:** https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm/
- **Projekt:** https://github.com/google-ai-edge/mediapipe
- **Autor/Urheber:** Google LLC
- **Lizenz:** Apache License 2.0

> Licensed under the Apache License, Version 2.0 (the "License");
> you may not use this file except in compliance with the License.
> You may obtain a copy of the License at
>
>     http://www.apache.org/licenses/LICENSE-2.0
>
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS,
> WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
> See the License for the specific language governing permissions and
> limitations under the License.

Den vollständigen Apache-2.0-Lizenztext finden Sie unter:
https://www.apache.org/licenses/LICENSE-2.0

---

## 3. MediaPipe Model: selfie_multiclass_256x256

- **Datei:** `vendor/selfie_multiclass_256x256.tflite`
- **Quelle:** https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
- **Dokumentation (Model Card):**
  https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- **Autor/Urheber:** Google LLC
- **Lizenz:** Apache 2.0 (laut offizieller Model Card)

> Hinweis: In der Entwickler-Community wird diskutiert, ob die Apache-2.0-
> Angabe der MediaPipe-Model-Cards sämtliche Bestandteile der gebündelten
> Modelldateien lückenlos abdeckt. Der Download erfolgt bei der Installation
> direkt von Google; es werden keine Modelldateien in diesem Repository
> verbreitet.

---

## Eigenanteil

- **Dateien:** `manifest.json`, `content.js`, `inject.js`, `README.md`,
  `THIRD-PARTY-NOTICES.md`, `LICENSE`
- **Lizenz:** MIT (siehe LICENSE)
- **Copyright:** Copyright (c) 2026 [Wolfram Rach / airzinho]

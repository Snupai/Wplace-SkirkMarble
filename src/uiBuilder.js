/** @file UI Builder functions for creating overlay interfaces
 * Contains all the complex UI building logic that was previously in main.js
 * @since 1.0.0
 */

import * as icons from './icons.js';
import { getOverlayState, saveOverlayState, getCoords, saveCoords, saveLastTemplateFile, restoreLastTemplateFile, getTileRefreshPaused, saveTileRefreshPaused } from './settingsManager.js';
// UI Builder utilities - currently minimal

/** Builds the main overlay interface
 * @param {Object} params - Parameters object
 * @param {Object} params.templateManager - The template manager instance
 * @param {Object} params.apiManager - The API manager instance
 * @param {string} params.version - The script version
 * @param {Function} params.updateMiniTracker - Function to update mini tracker
 * @param {Function} params.deleteAllTemplates - Function to delete all templates
 * @param {Function} params.deleteSelectedTemplate - Function to delete selected template
 * @param {Function} params.buildColorFilterOverlay - Function to build color filter overlay
 * @returns {Object} The built overlay main
 * @since 1.0.0
 */
export async function buildOverlayMain({ templateManager, apiManager, version, updateMiniTracker, deleteAllTemplates, deleteSelectedTemplate, buildColorFilterOverlay }) {
  let isMinimized = false;
  const Overlay = (await import('./Overlay.js')).default;

  const overlayMain = new Overlay({
    'id': 'bm-overlay-main',
    'style': 'z-index: 999999; right: 20px; top: 20px; min-width: 400px; max-width: 500px; position: fixed; display: flex; background: rgba(40, 44, 52, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); font-family: Inter, system-ui, sans-serif; font-size: 14px; color: white; flex-direction: column; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
    'innerHTML': `
    <div style="
      padding: 16px 20px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 12px 12px 0 0;
      margin: -1px -1px 0 -1px;
      cursor: move;
    ">
      <h3 style="
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      ">Blue Marble</h3>
      <button id="bm-minimize-btn" style="
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        transition: background 0.2s ease;
        font-family: monospace;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">−</button>
    </div>
    <div id="bm-content" style="
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ">`,
    apiManager: apiManager
  });

  // Restore overlay state (position + minimized)
  try {
    const st = getOverlayState() || {};
    if (Number.isFinite(st.x) && Number.isFinite(st.y)) {
      overlayMain.element.style.transform = `translate(${st.x}px, ${st.y}px)`;
      overlayMain.element.style.left = '0px';
      overlayMain.element.style.top = '0px';
      overlayMain.element.style.right = '';
    }
    isMinimized = !!st.minimized;
    const content = document.getElementById('bm-content');
    const btn = document.getElementById('bm-minimize-btn');
    if (content && btn) {
      if (isMinimized) {
        content.style.display = 'none';
        btn.textContent = '+';
        overlayMain.element.style.minWidth = 'auto';
      } else {
        content.style.display = 'flex';
        content.style.opacity = '1';
        btn.textContent = '−';
        overlayMain.element.style.minWidth = '400px';
      }
    }
  } catch {}

  // Add drag functionality to the header
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  const header = overlayMain.element.querySelector('div[style*="cursor: move"]');
  const computeOverlayXY = () => {
    let x = currentX ?? 0;
    let y = currentY ?? 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const tf = window.getComputedStyle(overlayMain.element).transform;
      if (tf && tf !== 'none') {
        const m = new DOMMatrix(tf);
        x = m.m41; y = m.m42;
      } else {
        const r = overlayMain.element.getBoundingClientRect();
        x = r.left; y = r.top;
      }
    }
    return { x, y };
  };
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.id === 'bm-minimize-btn') return;
    isDragging = true;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      overlayMain.element.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'move';
      try {
        const { x, y } = computeOverlayXY();
        const st = getOverlayState() || {};
        saveOverlayState({ ...st, minimized: !!st.minimized, x, y });
      } catch {}
    }
  });

  // Minimize/maximize functionality
  document.getElementById('bm-minimize-btn').addEventListener('click', () => {
    const content = document.getElementById('bm-content');
    const btn = document.getElementById('bm-minimize-btn');
    
    if (isMinimized) {
      content.style.display = 'flex';
      content.style.opacity = '1';
      btn.textContent = '−';
      overlayMain.element.style.minWidth = '400px';
    } else {
      content.style.display = 'none';
      btn.textContent = '+';
      overlayMain.element.style.minWidth = 'auto';
    }
    isMinimized = !isMinimized;
    try {
      const { x, y } = computeOverlayXY();
      saveOverlayState({ minimized: isMinimized, x, y });
    } catch {}
  });

  // Persist current state on initialization and before unload to ensure durability
  try {
    const { x, y } = computeOverlayXY();
    const st = getOverlayState() || {};
    saveOverlayState({ ...st, minimized: !!st.minimized || isMinimized, x, y });
  } catch {}

  window.addEventListener('beforeunload', () => {
    try {
      const { x, y } = computeOverlayXY();
      saveOverlayState({ minimized: isMinimized, x, y });
    } catch {}
  });

  const buildContent = () => {
    return overlayMain
      .addDiv({'style': 'display: flex; flex-direction: column; gap: 12px;'})
        // Coordinates input section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>📍 Coordinates</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addDiv({'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;'})
            .addInput({'id': 'bm-input-tx', 'type': 'number', 'placeholder': 'Tile X', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addInput({'id': 'bm-input-ty', 'type': 'number', 'placeholder': 'Tile Y', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
          .buildElement()
          .addDiv({'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'})
            .addInput({'id': 'bm-input-px', 'type': 'number', 'placeholder': 'Pixel X', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addInput({'id': 'bm-input-py', 'type': 'number', 'placeholder': 'Pixel Y', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
          .buildElement()
          .addDiv({'style': 'display:flex; gap:8px; margin-top: 8px; flex-wrap: wrap;'})
            .addButton({'id': 'bm-button-coords-use-last', innerHTML: icons.pointerIcon + ' Use Last Click (Corner 1)', 'style': 'background: linear-gradient(135deg, #6ee7b7, #10b981); color: #0b2239; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;'}, (instance, button) => {
              button.onclick = () => {
                const c = apiManager?.coordsTilePixel;
                if (!Array.isArray(c) || c.length < 4) { instance.handleDisplayError('Click on the canvas first to detect coordinates.'); return; }
                const [tx, ty, px, py] = c.map(Number);
                const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
                set('bm-input-tx', tx); set('bm-input-ty', ty); set('bm-input-px', px); set('bm-input-py', py);
              };
            }).buildElement()
            .addButton({'id': 'bm-button-coords2-use-last', innerHTML: icons.pointerIcon + ' Use Last Click (Corner 2)', 'style': 'background: linear-gradient(135deg, #93c5fd, #3b82f6); color: #0b2239; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;'}, (instance, button) => {
              button.onclick = () => {
                const c = apiManager?.coordsTilePixel;
                if (!Array.isArray(c) || c.length < 4) { instance.handleDisplayError('Click on the canvas first to detect coordinates.'); return; }
                const [tx, ty, px, py] = c.map(Number);
                const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
                set('bm-input2-tx', tx); set('bm-input2-ty', ty); set('bm-input2-px', px); set('bm-input2-py', py);
              };
            }).buildElement()
          .buildElement()
        .buildElement()

        // Template management section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>🎨 Template</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addInput({'id': 'bm-input-file', 'type': 'file', 'accept': '.png,.jpg,.jpeg,.gif,.bmp,.webp', 'style': 'margin-bottom: 12px; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px; width: 100%; box-sizing: border-box;'}).buildElement()
          .addDiv({'style': 'display:flex; gap:8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;'})
            .addInput({'id': 'bm-input-gallery-url', 'type': 'text', 'placeholder': 'Paste gallery URL (pxl-wplace.snupai.dev/gallery/...)', 'style': 'flex:1; min-width: 180px; padding: 8px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(255,255,255,0.1); color: white; font-size: 13px;'}).buildElement()
            .addButton({'id': 'bm-button-import-gallery', innerHTML: icons.importIcon + ' Import', 'style': 'background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;'}, (instance, button) => {
              button.onclick = async () => {
                const url = document.getElementById('bm-input-gallery-url')?.value?.trim();
                if (!url) { instance.handleDisplayError('Enter a gallery URL first.'); return; }
                try {
                  const html = await (typeof GM_xmlhttpRequest === 'function' ? new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({ method: 'GET', url, onload: (res) => resolve(res.responseText), onerror: () => reject(new Error('Failed to load URL')) });
                  }) : fetch(url).then(r => r.text()));

                  // Try to parse coords from HTML
                  const patterns = [
                    /data-coords\s*=\s*"(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)"/i,
                    /"coords"\s*:\s*\[(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\]/i,
                    /Tl\s*X\s*[:=]\s*(\d+).*?Tl\s*Y\s*[:=]\s*(\d+).*?Px\s*X\s*[:=]\s*(\d+).*?Px\s*Y\s*[:=]\s*(\d+)/is
                  ];
                  let match = null;
                  for (const re of patterns) { match = html.match(re); if (match) break; }
                  if (match) {
                    const [_, tx, ty, px, py] = match.map((v, i) => i === 0 ? v : Number(v));
                    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
                    set('bm-input-tx', tx); set('bm-input-ty', ty); set('bm-input-px', px); set('bm-input-py', py);
                    instance.handleDisplayStatus('Parsed coordinates from gallery page.');
                  } else {
                    instance.handleDisplayError('Could not parse coordinates from the gallery page.');
                  }

                  // Try to find an image (og:image)
                  const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*template[^"']*["'][^>]*>/i);
                  if (imgMatch && imgMatch[1]) {
                    const imgUrl = new URL(imgMatch[1], url).toString();
                    const blob = await (typeof GM_xmlhttpRequest === 'function' ? new Promise((resolve, reject) => {
                      GM_xmlhttpRequest({ method: 'GET', url: imgUrl, responseType: 'blob', onload: (res) => resolve(res.response), onerror: () => reject(new Error('Failed to fetch image')) });
                    }) : fetch(imgUrl).then(r => r.blob()));
                    const file = new File([blob], 'gallery.png', { type: blob.type || 'image/png' });
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    const input = document.getElementById('bm-input-file');
                    if (input) {
                      input.files = dt.files;
                      input.dispatchEvent(new Event('change'));
                    }
                    instance.handleDisplayStatus('Loaded image from gallery.');
                  }
                } catch (e) {
                  instance.handleDisplayError('Failed to import from gallery URL.');
                }
              };
            }).buildElement()
          .buildElement()
          .addDiv({'style': 'display: flex; gap: 8px; flex-wrap: wrap;'})
            .addButton({'id': 'bm-button-upload', innerHTML: icons.createIcon + ' Upload', 'style': 'flex: 1; min-width: 100px; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => {
                const input = document.getElementById('bm-input-file');
                const coordTlX = document.getElementById('bm-input-tx');
                const coordTlY = document.getElementById('bm-input-ty');
                const coordPxX = document.getElementById('bm-input-px');
                const coordPxY = document.getElementById('bm-input-py');

                if (!coordTlX.value || !coordTlY.value || !coordPxX.value || !coordPxY.value) {
                  instance.handleDisplayError(`Please fill in all coordinate fields!`);
                  return;
                }

                if (!input?.files[0]) {
                  instance.handleDisplayError(`No file selected!`);
                  return;
                }

                templateManager.createTemplate(
                  input.files[0], 
                  input.files[0]?.name.replace(/\.[^/.]+$/, ''), 
                  [Number(coordTlX.value), Number(coordTlY.value), Number(coordPxX.value), Number(coordPxY.value)]
                );

                try { saveLastTemplateFile(input.files[0]); } catch {}
                setTimeout(() => updateMiniTracker(), 500);
                instance.handleDisplayStatus(`Template uploaded successfully!`);
              }
            }).buildElement()
            .addButton({'id': 'bm-button-enable', innerHTML: icons.enableIcon + ' Enable', 'style': 'background: linear-gradient(135deg, #2196F3, #1976D2); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => {
                instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(true);
                instance.handleDisplayStatus(`Templates enabled!`);
              }
            }).buildElement()
            .addButton({'id': 'bm-button-disable', innerHTML: icons.disableIcon + ' Disable', 'style': 'background: linear-gradient(135deg, #ff9800, #f57c00); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => {
                instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(false);
                instance.handleDisplayStatus(`Templates disabled!`);
              }
            }).buildElement()
          .buildElement()
        .buildElement()

        // Area Capture section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>🧭 Area Capture</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addDiv({'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;'})
            .addInput({'id': 'bm-input2-tx', 'type': 'number', 'placeholder': 'Tile X2', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addInput({'id': 'bm-input2-ty', 'type': 'number', 'placeholder': 'Tile Y2', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
          .buildElement()
          .addDiv({'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;'})
            .addInput({'id': 'bm-input2-px', 'type': 'number', 'placeholder': 'Pixel X2', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addInput({'id': 'bm-input2-py', 'type': 'number', 'placeholder': 'Pixel Y2', 'style': 'padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
          .buildElement()
          .addDiv({'style': 'display: flex; gap: 8px; flex-wrap: wrap;'})
            .addButton({'id': 'bm-button-save-area', innerHTML: icons.downloadIcon + ' Save Area', 'style': 'background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = async () => {
                try {
                  const sel = (id) => /** @type {HTMLInputElement|null} */(document.getElementById(id));
                  const tx1 = Number(sel('bm-input-tx')?.value);
                  const ty1 = Number(sel('bm-input-ty')?.value);
                  const px1 = Number(sel('bm-input-px')?.value);
                  const py1 = Number(sel('bm-input-py')?.value);
                  const tx2 = Number(sel('bm-input2-tx')?.value);
                  const ty2 = Number(sel('bm-input2-ty')?.value);
                  const px2 = Number(sel('bm-input2-px')?.value);
                  const py2 = Number(sel('bm-input2-py')?.value);
                  const vals = [tx1,ty1,px1,py1,tx2,ty2,px2,py2];
                  if (vals.some(v => !Number.isFinite(v))) { instance.handleDisplayError('Coordinates are malformed!'); return; }
                  const tileSize = templateManager.tileSize || 1000;
                  const gx1 = tx1 * tileSize + px1;
                  const gy1 = ty1 * tileSize + py1;
                  const gx2 = tx2 * tileSize + px2;
                  const gy2 = ty2 * tileSize + py2;
                  const minGx = Math.min(gx1, gx2);
                  const minGy = Math.min(gy1, gy2);
                  const maxGx = Math.max(gx1, gx2);
                  const maxGy = Math.max(gy1, gy2);
                  const width = maxGx - minGx + 1;
                  const height = maxGy - minGy + 1;
                  const startTileX = Math.floor(minGx / tileSize);
                  const startTileY = Math.floor(minGy / tileSize);
                  const endTileX = Math.floor(maxGx / tileSize);
                  const endTileY = Math.floor(maxGy / tileSize);
                  const base = apiManager?.tileServerBase;
                  if (!base) { instance.handleDisplayError('Tile server not detected yet; open the board to load tiles.'); return; }
                  const canvas = new OffscreenCanvas(width, height);
                  const ctx = canvas.getContext('2d', { willReadFrequently: true });
                  ctx.imageSmoothingEnabled = false;
                  const fetchTile = (x, y) => new Promise((resolve, reject) => {
                    try {
                      const url = `${base}/${x}/${y}.png`;
                      if (typeof GM_xmlhttpRequest === 'function') {
                        GM_xmlhttpRequest({
                          method: 'GET', url, responseType: 'blob', onload: (res) => {
                            if (res.status >= 200 && res.status < 300 && res.response) resolve(res.response);
                            else {
                              const img = new Image(); img.crossOrigin = 'anonymous';
                              img.onload = async () => { const c = new OffscreenCanvas(img.width, img.height); const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0); const b = await c.convertToBlob({ type: 'image/png' }); resolve(b); };
                              img.onerror = () => reject(new Error('Tile fetch failed (img)'));
                              img.src = url;
                            }
                          }, onerror: () => {
                            const img = new Image(); img.crossOrigin = 'anonymous';
                            img.onload = async () => { const c = new OffscreenCanvas(img.width, img.height); const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0); const b = await c.convertToBlob({ type: 'image/png' }); resolve(b); };
                            img.onerror = () => reject(new Error('Tile fetch failed (img)'));
                            img.src = url;
                          }
                        });
                      } else {
                        const img = new Image(); img.crossOrigin = 'anonymous';
                        img.onload = async () => { const c = new OffscreenCanvas(img.width, img.height); const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0); const b = await c.convertToBlob({ type: 'image/png' }); resolve(b); };
                        img.onerror = () => reject(new Error('Tile fetch failed (img)'));
                        img.src = url;
                      }
                    } catch (e) { reject(e); }
                  });
                  for (let ty = startTileY; ty <= endTileY; ty++) {
                    for (let tx = startTileX; tx <= endTileX; tx++) {
                      const tileBlob = await fetchTile(tx, ty);
                      const bmp = await createImageBitmap(tileBlob);
                      const tileOriginX = tx * tileSize;
                      const tileOriginY = ty * tileSize;
                      const srcX = Math.max(0, minGx - tileOriginX);
                      const srcY = Math.max(0, minGy - tileOriginY);
                      const dstX = Math.max(0, tileOriginX - minGx);
                      const dstY = Math.max(0, tileOriginY - minGy);
                      const drawW = Math.min(tileSize - srcX, width - dstX);
                      const drawH = Math.min(tileSize - srcY, height - dstY);
                      if (drawW > 0 && drawH > 0) {
                        ctx.drawImage(bmp, srcX, srcY, drawW, drawH, dstX, dstY, drawW, drawH);
                      }
                    }
                  }
                  const blob = await canvas.convertToBlob({ type: 'image/png' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const ts = new Date().toISOString().replace(/[:.]/g,'-');
                  a.download = `wplace_area_${String(Math.floor(minGx/tileSize)).padStart(4,'0')},${String(Math.floor(minGy/tileSize)).padStart(4,'0')}_${ts}.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  instance.handleDisplayStatus('Downloaded area image!');
                } catch (e) {
                  instance.handleDisplayError('Failed to capture area');
                }
              };
            }).buildElement()
          .buildElement()
        .buildElement()

        // Quick Paint section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>🎯 Quick Paint</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addDiv({'id': 'bm-quick-paint-container', 'style': 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;'})
            .addInput({'id': 'bm-quick-fill-input', 'type': 'number', 'placeholder': 'Count', 'min': 1, 'max': 1000, 'value': 5, 'style': 'width: 70px; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addInput({'id': 'bm-color-id-input', 'type': 'number', 'placeholder': 'Color ID', 'min': 1, 'max': 65, 'value': 25, 'style': 'width: 80px; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 13px;'}).buildElement()
            .addButton({'id': 'bm-button-quick-paint', innerHTML: icons.quickFillIcon + ' Quick Paint', 'style': 'background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => {
                const currentlyEnabled = localStorage.getItem('bm-quick-paint-enabled') === 'true';
                if (currentlyEnabled) {
                  localStorage.setItem('bm-quick-paint-enabled', 'false');
                  button.innerHTML = icons.quickFillIcon + ' Quick Paint';
                  button.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                  instance.handleDisplayStatus('Quick Paint disabled.');
                } else {
                  localStorage.setItem('bm-quick-paint-enabled', 'true');
                  button.innerHTML = icons.quickFillIcon + ' Quick Paint ON';
                  button.style.background = 'linear-gradient(135deg, #ffc107, #ff8c00)';
                  instance.handleDisplayStatus('Quick Paint enabled! Place a pixel to automatically paint more with selected color.');
                }
              }
            }).buildElement()
          .buildElement()
        .buildElement()

        // Controls section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>⚙️ Controls</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addDiv({'style': 'display: flex; gap: 8px; flex-wrap: wrap;'})
            .addButton({'id': 'bm-button-color-filter', innerHTML: icons.colorFilterIcon + ' Color Filter', 'style': 'background: linear-gradient(135deg, #9c27b0, #7b1fa2); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => buildColorFilterOverlay();
            }).buildElement()
            .addButton({'id': 'bm-button-pause-tiles', innerHTML: (getTileRefreshPaused() ? icons.playIcon + ' Resume Tiles' : icons.pauseIcon + ' Pause Tiles'), 'style': 'background: linear-gradient(135deg, #ff5722, #e64a19); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
              button.onmouseover = () => button.style.transform = 'translateY(-1px)';
              button.onmouseout = () => button.style.transform = 'translateY(0)';
              button.onclick = () => {
                const next = !getTileRefreshPaused();
                saveTileRefreshPaused(next);
                button.innerHTML = next ? icons.playIcon + ' Resume Tiles' : icons.pauseIcon + ' Pause Tiles';
                instance.handleDisplayStatus(next ? 'Tile refresh paused' : 'Tile refresh resumed');
              };
            }).buildElement()
          .buildElement()
        .buildElement()

        // Status section
        .addDiv({'style': 'background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1);'})
          .addP({'innerHTML': '<strong>📋 Status</strong>', 'style': 'margin: 0 0 12px 0; font-size: 14px; color: #e0e0e0;'}).buildElement()
          .addTextarea({'id': overlayMain.outputStatusId, 'placeholder': `Status: Ready...\nVersion: ${version}`, 'readOnly': true, 'style': 'width: 100%; min-height: 80px; padding: 12px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(0, 0, 0, 0.3); color: #e0e0e0; font-family: monospace; font-size: 12px; resize: vertical; box-sizing: border-box;'}).buildElement()
        .buildElement()

        // Action buttons section
        .addDiv({'id': 'bm-contain-buttons-action', 'style': 'display: flex; gap: 8px; flex-wrap: wrap;'})
          .addButton({'id': 'bm-button-delete-all', innerHTML: icons.deleteIcon + ' Delete All', 'style': 'flex: 1; min-width: 120px; background: linear-gradient(135deg, #f44336, #d32f2f); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
            button.onmouseover = () => button.style.transform = 'translateY(-1px)';
            button.onmouseout = () => button.style.transform = 'translateY(0)';
            button.onclick = () => deleteAllTemplates(instance);
          }).buildElement()
          .addButton({'id': 'bm-button-delete-selected', innerHTML: icons.deleteIcon + ' Delete Selected', 'style': 'flex: 1; min-width: 140px; background: linear-gradient(135deg, #ff5722, #e64a19); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;'}, (instance, button) => {
            button.onmouseover = () => button.style.transform = 'translateY(-1px)';
            button.onmouseout = () => button.style.transform = 'translateY(0)';
            button.onclick = () => deleteSelectedTemplate(instance);
          }).buildElement()
        .buildElement()
      .buildElement();
  };

  buildContent();
  // Restore coords and wire persistence; restore last template file
  try {
    const coords = getCoords();
    const tx = document.getElementById('bm-input-tx');
    const ty = document.getElementById('bm-input-ty');
    const px = document.getElementById('bm-input-px');
    const py = document.getElementById('bm-input-py');
    if (tx && coords.tx !== undefined) tx.value = String(coords.tx);
    if (ty && coords.ty !== undefined) ty.value = String(coords.ty);
    if (px && coords.px !== undefined) px.value = String(coords.px);
    if (py && coords.py !== undefined) py.value = String(coords.py);

    const saveIfNum = (el, key) => {
      el && el.addEventListener('input', () => {
        const n = Number(el.value);
        if (el.value !== '' && Number.isFinite(n)) saveCoords({ [key]: n });
      });
    };
    saveIfNum(tx, 'tx');
    saveIfNum(ty, 'ty');
    saveIfNum(px, 'px');
    saveIfNum(py, 'py');

    restoreLastTemplateFile('#bm-input-file');
  } catch {}

  // Gallery opener integration: notify ready and listen for import messages
  try { window.opener && window.opener.postMessage({ source: 'blue-marble', type: 'ready' }, '*'); } catch (_) {}
  try {
    const loadImageIntoFileInput = async (urlOrData) => {
      try {
        let blob;
        if (typeof urlOrData === 'string' && urlOrData.startsWith('data:')) {
          const base64 = urlOrData.split(',')[1] || '';
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          blob = new Blob([bytes], { type: 'image/png' });
        } else if (typeof urlOrData === 'string') {
          blob = await (typeof GM_xmlhttpRequest === 'function' ? new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: urlOrData, responseType: 'blob', onload: (res) => resolve(res.response), onerror: () => reject(new Error('Failed to fetch image')) });
          }) : fetch(urlOrData).then(r => r.blob()));
        } else if (urlOrData instanceof Blob) {
          blob = urlOrData;
        }
        if (!blob) return false;
        const file = new File([blob], 'gallery.png', { type: blob.type || 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.getElementById('bm-input-file');
        if (input) {
          input.files = dt.files;
          input.dispatchEvent(new Event('change'));
          return true;
        }
      } catch (_) {}
      return false;
    };

    const setCoords = (coords) => {
      if (!Array.isArray(coords) || coords.length < 4) return false;
      const [tx, ty, px2, py2] = coords.map(Number);
      const set = (id, v) => { const el = document.getElementById(id); if (el != null) el.value = String(v); };
      set('bm-input-tx', tx); set('bm-input-ty', ty); set('bm-input-px', px2); set('bm-input-py', py2);
      return true;
    };

    window.addEventListener('message', async (e) => {
      try {
        const d = e?.data || {};
        if (!d) return;
        if (d.type === 'gallery-import' || d.bmEvent === 'gallery-import' || d.source === 'snupai-gallery') {
          // Accept coords in various forms
          let ok = false;
          if (Array.isArray(d.coords)) ok = setCoords(d.coords);
          else if (typeof d.coordsText === 'string') {
            const m = d.coordsText.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (m) ok = setCoords([+m[1],+m[2],+m[3],+m[4]]);
          }
          if (!ok && typeof d.url === 'string') {
            const u = new URL(d.url, location.href);
            const c = u.searchParams.get('coords');
            if (c) {
              const parts = c.split(',').map(n => Number(n));
              if (parts.length === 4 && parts.every(Number.isFinite)) ok = setCoords(parts);
            }
          }

          // Load image if provided
          if (d.imageData || d.imageUrl || d.url) {
            const imgSrc = d.imageData || d.imageUrl || d.url;
            await loadImageIntoFileInput(imgSrc);
          }
        }
      } catch (_) {}
    });
  } catch (_) {}
  return overlayMain;
}

/** Builds the template tab overlay interface
 * @returns {Object} The built overlay template tab
 * @since 1.0.0
 */
export function buildOverlayTabTemplate() {
  // Implementation would go here - this was a smaller function
  // For now, keeping the original structure but could be expanded
  return null;
}

/** Builds the color filter overlay interface
 * @param {Object} params - Parameters object
 * @param {Object} params.templateManager - The template manager instance
 * @param {Function} params.refreshTemplateDisplay - Function to refresh template display
 * @param {Function} params.updateMiniTracker - Function to update mini tracker
 * @returns {Object} The built color filter overlay
 * @since 1.0.0
 */
export function buildColorFilterOverlay({ templateManager, refreshTemplateDisplay, updateMiniTracker }) {
  try {
    const existing = document.getElementById('bm-color-filter-overlay');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'bm-color-filter-overlay';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000000';

    const panel = document.createElement('div');
    panel.style.background = '#1f2937';
    panel.style.color = 'white';
    panel.style.border = '1px solid rgba(255,255,255,0.1)';
    panel.style.borderRadius = '10px';
    panel.style.minWidth = '320px';
    panel.style.maxWidth = '520px';
    panel.style.maxHeight = '70vh';
    panel.style.overflow = 'hidden';
    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '10px 14px';
    header.style.background = 'linear-gradient(135deg, #9c27b0, #7b1fa2)';
    const title = document.createElement('div');
    title.textContent = 'Color Filter';
    title.style.fontWeight = '600';
    header.appendChild(title);
    const close = document.createElement('button');
    close.textContent = '×';
    close.style.background = 'transparent';
    close.style.border = 'none';
    close.style.color = 'white';
    close.style.fontSize = '18px';
    close.style.cursor = 'pointer';
    close.onclick = () => modal.remove();
    header.appendChild(close);

    const body = document.createElement('div');
    body.style.padding = '12px';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '8px';
    body.style.maxHeight = '56vh';
    body.style.overflow = 'auto';

    const t = templateManager?.templatesArray?.[0];
    if (!t) {
      const p = document.createElement('div');
      p.textContent = 'No template loaded.';
      p.style.opacity = '0.8';
      body.appendChild(p);
    } else if (!t.colorPalette || Object.keys(t.colorPalette).length === 0) {
      const p = document.createElement('div');
      p.innerHTML = 'This template has no color palette metadata available.<br>Basic template colors UI will appear once palette data is present (e.g., from certain imports).';
      p.style.opacity = '0.8';
      p.style.fontSize = '12px';
      body.appendChild(p);
    } else {
      // Render rows: [checkbox][swatch][label with count]
      const entries = Object.entries(t.colorPalette).sort((a,b) => (b[1]?.count||0) - (a[1]?.count||0));
      for (const [rgb, meta] of entries) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '4px 2px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!meta.enabled;

        const sw = document.createElement('div');
        sw.style.width = '14px';
        sw.style.height = '14px';
        sw.style.border = '1px solid rgba(255,255,255,0.4)';
        if (rgb === 'other') {
          sw.style.background = '#777';
        } else if (rgb === '#deface') {
          sw.style.background = '#deface';
        } else {
          const [r,g,b] = rgb.split(',').map(Number);
          sw.style.background = `rgb(${r},${g},${b})`;
        }

        const label = document.createElement('span');
        label.style.fontSize = '12px';
        const countText = meta?.count != null ? ` • ${meta.count.toLocaleString()}` : '';
        label.textContent = `${rgb}${countText}`;

        cb.addEventListener('change', async () => {
          try {
            // Update in-memory palette
            if (!t.colorPalette[rgb]) t.colorPalette[rgb] = { count: meta?.count||0, enabled: true };
            t.colorPalette[rgb].enabled = cb.checked;

            // Persist palette into JSON storage for this template if storageKey known
            try {
              const key = t.storageKey || `${t.sortID} ${t.authorID}`;
              if (templateManager.templatesJSON?.templates?.[key]) {
                templateManager.templatesJSON.templates[key].palette = t.colorPalette;
              }
              // Persist via GM/localStorage for now
              const s = JSON.stringify(templateManager.templatesJSON);
              if (typeof GM_setValue !== 'undefined') GM_setValue('bmTemplates', s);
              localStorage.setItem('bmTemplates', s);
            } catch (_) {}

            // Try to apply filter to existing tiles when disabling/enabling colors
            try {
              // Derive disabled set from palette
              const disabled = Object.entries(t.colorPalette)
                .filter(([,m]) => m && m.enabled === false)
                .map(([rgb]) => rgb);
              t.setDisabledColors(disabled);
              if (t.chunked) {
                const updated = await t.applyColorFilterToExistingTiles();
                t.chunked = updated;
                refreshTemplateDisplay && refreshTemplateDisplay();
              }
            } catch (_) {}
          } catch (_) {}
        });

        row.appendChild(cb);
        row.appendChild(sw);
        row.appendChild(label);
        body.appendChild(row);
      }
    }

    panel.appendChild(header);
    panel.appendChild(body);
    modal.appendChild(panel);
    document.body.appendChild(modal);
    return modal;
  } catch (_) {
    return null;
  }
}

/** Builds the crosshair settings overlay interface
 * @param {Object} params - Parameters object
 * @returns {Object} The built crosshair settings overlay
 * @since 1.0.0
 */
export function buildCrosshairSettingsOverlay(params) {
  // This would contain the crosshair settings overlay building logic
  // For now, returning null to maintain compatibility
  return null;
}

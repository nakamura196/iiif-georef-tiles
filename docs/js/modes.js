import { CONFIG, createBaseStyle, createOverlayStyle } from './config.js';

// 地図の同期ユーティリティ
function syncMaps(source, target) {
  if (target._syncing) return;
  source._syncing = true;
  target.jumpTo({
    center: source.getCenter(),
    zoom: source.getZoom(),
    bearing: source.getBearing(),
    pitch: source.getPitch()
  });
  source._syncing = false;
}

// ========== 透過モード ==========
export class OpacityMode {
  constructor(container) {
    this.container = container;
    this.map = null;
  }

  init() {
    if (this.map) return;

    this.map = new maplibregl.Map({
      container: this.container,
      style: createOverlayStyle(0.7),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });
    this.map.addControl(new maplibregl.NavigationControl());
  }

  setOpacity(value) {
    if (this.map && this.map.getLayer('overlay')) {
      this.map.setPaintProperty('overlay', 'raster-opacity', value);
    }
  }

  resize() {
    if (this.map) this.map.resize();
  }

  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}

// ========== スワイプモード ==========
export class SwipeMode {
  constructor(container, handle) {
    this.container = container;
    this.handle = handle;
    this.baseMap = null;
    this.overlayMap = null;
    this.swipeX = 0;
    this.dragging = false;
  }

  init() {
    if (this.baseMap) return;

    // 下層: ベースマップ
    const baseDiv = document.createElement('div');
    baseDiv.className = 'swipe-layer';
    this.container.appendChild(baseDiv);

    this.baseMap = new maplibregl.Map({
      container: baseDiv,
      style: createBaseStyle(),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });

    // 上層: オーバーレイマップ
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'swipe-layer';
    this.container.appendChild(overlayDiv);

    this.overlayMap = new maplibregl.Map({
      container: overlayDiv,
      style: createOverlayStyle(1.0),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });
    this.overlayMap.addControl(new maplibregl.NavigationControl());

    // 同期
    this.baseMap.on('move', () => syncMaps(this.baseMap, this.overlayMap));
    this.overlayMap.on('move', () => syncMaps(this.overlayMap, this.baseMap));

    // スワイプ初期化
    this.swipeX = this.container.offsetWidth / 2;
    this.updateClip();
    this.setupDrag();
  }

  updateClip() {
    this.handle.style.left = this.swipeX + 'px';
    const canvas = this.container.querySelectorAll('canvas.maplibregl-canvas')[1];
    if (canvas) {
      canvas.style.clipPath = `inset(0 0 0 ${this.swipeX}px)`;
    }
  }

  setupDrag() {
    const onMove = (clientX) => {
      if (!this.dragging) return;
      const rect = this.container.getBoundingClientRect();
      this.swipeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      this.updateClip();
    };

    this.handle.addEventListener('mousedown', () => this.dragging = true);
    document.addEventListener('mousemove', (e) => onMove(e.clientX));
    document.addEventListener('mouseup', () => this.dragging = false);

    this.handle.addEventListener('touchstart', () => this.dragging = true);
    document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX));
    document.addEventListener('touchend', () => this.dragging = false);
  }

  resize() {
    if (this.baseMap) this.baseMap.resize();
    if (this.overlayMap) this.overlayMap.resize();
    this.swipeX = this.container.offsetWidth / 2;
    this.updateClip();
  }

  destroy() {
    if (this.baseMap) this.baseMap.remove();
    if (this.overlayMap) this.overlayMap.remove();
    this.container.innerHTML = '';
    this.baseMap = null;
    this.overlayMap = null;
  }
}

// ========== 左右分割モード ==========
export class SplitMode {
  constructor(leftContainer, rightContainer) {
    this.leftContainer = leftContainer;
    this.rightContainer = rightContainer;
    this.leftMap = null;
    this.rightMap = null;
  }

  init() {
    if (this.leftMap) return;

    this.leftMap = new maplibregl.Map({
      container: this.leftContainer,
      style: createBaseStyle(),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });
    this.leftMap.addControl(new maplibregl.NavigationControl());

    this.rightMap = new maplibregl.Map({
      container: this.rightContainer,
      style: createOverlayStyle(1.0),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });
    this.rightMap.addControl(new maplibregl.NavigationControl());

    // 同期
    this.leftMap.on('move', () => syncMaps(this.leftMap, this.rightMap));
    this.rightMap.on('move', () => syncMaps(this.rightMap, this.leftMap));
  }

  resize() {
    if (this.leftMap) this.leftMap.resize();
    if (this.rightMap) this.rightMap.resize();
  }

  destroy() {
    if (this.leftMap) this.leftMap.remove();
    if (this.rightMap) this.rightMap.remove();
    this.leftMap = null;
    this.rightMap = null;
  }
}

// ========== スパイグラスモード ==========
export class SpyglassMode {
  constructor(container, circle) {
    this.container = container;
    this.circle = circle;
    this.baseMap = null;
    this.overlayMap = null;
    this.radius = 100;
  }

  init() {
    if (this.baseMap) return;

    // 下層: ベースマップ
    const baseDiv = document.createElement('div');
    baseDiv.className = 'spyglass-layer';
    this.container.appendChild(baseDiv);

    this.baseMap = new maplibregl.Map({
      container: baseDiv,
      style: createBaseStyle(),
      center: CONFIG.center,
      zoom: CONFIG.zoom
    });
    this.baseMap.addControl(new maplibregl.NavigationControl());

    // 上層: オーバーレイ
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'spyglass-layer spyglass-overlay';
    this.container.appendChild(overlayDiv);

    this.overlayMap = new maplibregl.Map({
      container: overlayDiv,
      style: createOverlayStyle(1.0),
      center: CONFIG.center,
      zoom: CONFIG.zoom,
      interactive: false
    });

    // 同期
    this.baseMap.on('move', () => syncMaps(this.baseMap, this.overlayMap));

    // マウス追従
    this.container.addEventListener('mousemove', (e) => this.onMove(e.clientX, e.clientY));
    this.container.addEventListener('mouseleave', () => this.onLeave());

    // タッチ対応
    this.container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onMove(touch.clientX, touch.clientY);
    }, { passive: false });
    this.container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onMove(touch.clientX, touch.clientY);
    }, { passive: false });
    this.container.addEventListener('touchend', () => this.onLeave());
  }

  onMove(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    this.circle.style.display = 'block';
    this.circle.style.width = this.radius * 2 + 'px';
    this.circle.style.height = this.radius * 2 + 'px';
    this.circle.style.left = (x - this.radius) + 'px';
    this.circle.style.top = (y - this.radius) + 'px';

    const canvas = this.container.querySelector('.spyglass-overlay canvas.maplibregl-canvas');
    if (canvas) {
      canvas.style.clipPath = `circle(${this.radius}px at ${x}px ${y}px)`;
    }
  }

  onLeave() {
    this.circle.style.display = 'none';
    const canvas = this.container.querySelector('.spyglass-overlay canvas.maplibregl-canvas');
    if (canvas) {
      canvas.style.clipPath = 'circle(0px at 0px 0px)';
    }
  }

  setRadius(value) {
    this.radius = value;
  }

  resize() {
    if (this.baseMap) this.baseMap.resize();
    if (this.overlayMap) this.overlayMap.resize();
  }

  destroy() {
    if (this.baseMap) this.baseMap.remove();
    if (this.overlayMap) this.overlayMap.remove();
    this.container.querySelectorAll('.spyglass-layer').forEach(el => el.remove());
    this.baseMap = null;
    this.overlayMap = null;
  }
}

import { OpacityMode, SwipeMode, SplitMode, SpyglassMode } from './modes.js';

class CompareApp {
  constructor() {
    this.currentMode = null;
    this.modes = {};
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.switchMode('opacity');
  }

  cacheElements() {
    this.elements = {
      modeButtons: document.querySelectorAll('.mode-btn'),
      opacityContainer: document.getElementById('opacity-container'),
      swipeContainer: document.getElementById('swipe-container'),
      swipeHandle: document.getElementById('swipe-handle'),
      splitLeft: document.getElementById('split-left'),
      splitRight: document.getElementById('split-right'),
      spyglassContainer: document.getElementById('spyglass-container'),
      spyglassCircle: document.getElementById('spyglass-circle'),
      opacitySlider: document.getElementById('opacity-slider'),
      opacityValue: document.getElementById('opacity-value'),
      radiusSlider: document.getElementById('radius-slider'),
      radiusValue: document.getElementById('radius-value'),
      opacityControl: document.getElementById('opacity-control'),
      radiusControl: document.getElementById('radius-control')
    };
  }

  setupEventListeners() {
    // モード切り替えボタン
    this.elements.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    // 透過度スライダー
    this.elements.opacitySlider.addEventListener('input', (e) => {
      const value = e.target.value / 100;
      this.elements.opacityValue.textContent = e.target.value;
      if (this.modes.opacity) {
        this.modes.opacity.setOpacity(value);
      }
    });

    // 半径スライダー
    this.elements.radiusSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.radiusValue.textContent = value;
      if (this.modes.spyglass) {
        this.modes.spyglass.setRadius(value);
      }
    });
  }

  switchMode(mode) {
    // 前のモードを破棄
    if (this.currentMode && this.modes[this.currentMode]) {
      this.modes[this.currentMode].destroy();
      this.modes[this.currentMode] = null;
    }

    this.currentMode = mode;

    // ボタンのアクティブ状態を更新
    this.elements.modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // コンテナの表示切り替え
    document.querySelectorAll('.mode-container').forEach(container => {
      container.classList.remove('active');
    });
    document.getElementById(`${mode}-mode`).classList.add('active');

    // コントロールの表示切り替え
    this.elements.opacityControl.style.display = (mode === 'opacity') ? '' : 'none';
    this.elements.radiusControl.style.display = (mode === 'spyglass') ? '' : 'none';

    // モードを初期化
    setTimeout(() => this.initMode(mode), 50);
  }

  initMode(mode) {
    switch (mode) {
      case 'opacity':
        this.modes.opacity = new OpacityMode(this.elements.opacityContainer);
        this.modes.opacity.init();
        break;

      case 'swipe':
        this.modes.swipe = new SwipeMode(
          this.elements.swipeContainer,
          this.elements.swipeHandle
        );
        this.modes.swipe.init();
        break;

      case 'split':
        this.modes.split = new SplitMode(
          this.elements.splitLeft,
          this.elements.splitRight
        );
        this.modes.split.init();
        break;

      case 'spyglass':
        this.modes.spyglass = new SpyglassMode(
          this.elements.spyglassContainer,
          this.elements.spyglassCircle
        );
        this.modes.spyglass.init();
        this.modes.spyglass.setRadius(parseInt(this.elements.radiusSlider.value));
        break;
    }
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new CompareApp();
  app.init();
});

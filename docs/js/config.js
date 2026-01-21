// 地図設定
export const CONFIG = {
  center: [139.762, 35.713],
  zoom: 16,
  minZoom: 10,
  maxZoom: 18
};

// タイルソース定義
export const SOURCES = {
  osm: {
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors'
  },
  overlay: {
    type: 'raster',
    tiles: ['tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    minzoom: 14,
    maxzoom: 18,
    attribution: '<a href="https://da.dl.itc.u-tokyo.ac.jp/portal/assets/187cc82d-11e6-9912-9dd4-b4cca9b10970" target="_blank">東京帝國大學本部構内及農學部建物鳥瞰圖</a> | 東京大学デジタルアーカイブポータル'
  }
};

// ベーススタイル（OSMのみ）
export function createBaseStyle() {
  return {
    version: 8,
    sources: { osm: SOURCES.osm },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  };
}

// オーバーレイ付きスタイル
export function createOverlayStyle(opacity = 0.7) {
  return {
    version: 8,
    sources: { osm: SOURCES.osm, overlay: SOURCES.overlay },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' },
      { id: 'overlay', type: 'raster', source: 'overlay', paint: { 'raster-opacity': opacity } }
    ]
  };
}

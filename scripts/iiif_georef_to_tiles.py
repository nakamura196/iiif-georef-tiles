#!/usr/bin/env python3
"""
IIIF Georeference Extension JSONからXYZタイルを生成するスクリプト

使用例:
    python iiif_georef_to_tiles.py https://nakamura196.github.io/iiif_geo/canvas.json

必要なツール:
    - GDAL (gdal_translate, gdalwarp, gdal2tiles.py)
    - Python 3.x
"""
import json
import subprocess
import urllib.request
import os
import sys
import argparse
import shutil
from pathlib import Path


def fetch_json(url):
    """URLからJSONを取得"""
    print(f"Fetching JSON from: {url}")
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode('utf-8'))


def download_image(image_service, canvas_width, canvas_height, scale, output_path):
    """IIIF Image APIで画像をダウンロード"""
    scaled_width = int(canvas_width * scale)
    scaled_height = int(canvas_height * scale)
    image_url = f"{image_service}/full/{scaled_width},{scaled_height}/0/default.jpg"

    print(f"Downloading image: {image_url}")
    print(f"  Original size: {canvas_width}x{canvas_height}")
    print(f"  Scaled size: {scaled_width}x{scaled_height}")

    urllib.request.urlretrieve(image_url, output_path)
    print(f"  Saved to: {output_path}")
    return scaled_width, scaled_height


def extract_gcps(data, scale):
    """GCP（Ground Control Points）を抽出"""
    annotations = data["annotations"][0]["items"][0]["body"]["features"]
    gcp_args = []

    print(f"\nExtracting GCPs: {len(annotations)} points")
    for feature in annotations:
        px, py = feature["properties"]["resourceCoords"]
        lon, lat = feature["geometry"]["coordinates"]

        # スケールに合わせてピクセル座標を調整
        scaled_px = px * scale
        scaled_py = py * scale
        gcp_args.extend(["-gcp", str(scaled_px), str(scaled_py), str(lon), str(lat)])

    return gcp_args


def get_polynomial_order(data):
    """変換の次数を取得（デフォルト: 1）"""
    try:
        transformation = data["annotations"][0]["items"][0]["body"]["transformation"]
        if transformation.get("type") == "polynomial":
            return transformation.get("options", {}).get("order", 1)
    except (KeyError, IndexError):
        pass
    return 1


def main():
    parser = argparse.ArgumentParser(
        description="IIIF Georeference Extension JSONからXYZタイルを生成"
    )
    parser.add_argument("url", help="IIIF Georeference Extension JSONのURL")
    parser.add_argument("--scale", type=float, default=0.25,
                        help="画像の縮小率 (default: 0.25)")
    parser.add_argument("--zoom", default="14-18",
                        help="タイルのズームレベル範囲 (default: 14-18)")
    parser.add_argument("--output-dir", default="docs",
                        help="出力ディレクトリ (default: docs)")
    parser.add_argument("--name", default="tiles",
                        help="出力タイルのフォルダ名 (default: tiles)")
    parser.add_argument("--work-dir", default="work",
                        help="作業用ディレクトリ (default: work)")
    parser.add_argument("--keep-work", action="store_true",
                        help="作業用ファイルを削除しない")

    args = parser.parse_args()

    # ディレクトリの準備
    work_dir = Path(args.work_dir)
    output_dir = Path(args.output_dir)
    tiles_dir = output_dir / args.name

    work_dir.mkdir(exist_ok=True)
    output_dir.mkdir(exist_ok=True)

    # Step 0: JSONを取得
    print("=" * 60)
    print("Step 0: Fetching IIIF Georeference JSON")
    print("=" * 60)
    data = fetch_json(args.url)

    # 画像情報を取得
    canvas_width = data["width"]
    canvas_height = data["height"]
    image_service = data["items"][0]["items"][0]["body"]["service"][0]["id"]
    label = data.get("label", {}).get("ja", ["Unknown"])[0]

    print(f"\nCanvas: {label}")
    print(f"Size: {canvas_width}x{canvas_height}")

    # JSONを保存（参照用）
    json_path = output_dir / "source.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved JSON to: {json_path}")

    # Step 1: 画像をダウンロード
    print("\n" + "=" * 60)
    print("Step 1: Downloading image via IIIF Image API")
    print("=" * 60)
    source_image = work_dir / "source.jpg"
    download_image(image_service, canvas_width, canvas_height, args.scale, source_image)

    # Step 2: GCPを埋め込み
    print("\n" + "=" * 60)
    print("Step 2: Embedding GCPs with gdal_translate")
    print("=" * 60)
    gcp_args = extract_gcps(data, args.scale)
    gcp_tif = work_dir / "with_gcp.tif"

    cmd_translate = [
        "gdal_translate",
        "-of", "GTiff",
        *gcp_args,
        str(source_image),
        str(gcp_tif)
    ]
    subprocess.run(cmd_translate, check=True)
    print(f"Created: {gcp_tif}")

    # Step 3: 座標変換（Warping）
    print("\n" + "=" * 60)
    print("Step 3: Warping with gdalwarp")
    print("=" * 60)
    order = get_polynomial_order(data)
    warped_tif = work_dir / "warped.tif"

    cmd_warp = [
        "gdalwarp",
        "-r", "bilinear",
        "-order", str(order),
        "-t_srs", "EPSG:4326",
        "-dstalpha",
        str(gcp_tif),
        str(warped_tif)
    ]
    print(f"Polynomial order: {order}")
    subprocess.run(cmd_warp, check=True)
    print(f"Created: {warped_tif}")

    # Step 4: タイル生成
    print("\n" + "=" * 60)
    print("Step 4: Generating XYZ tiles with gdal2tiles.py")
    print("=" * 60)

    # 既存のタイルディレクトリを削除
    if tiles_dir.exists():
        shutil.rmtree(tiles_dir)

    cmd_tiles = [
        "gdal2tiles.py",
        "-z", args.zoom,
        "-w", "none",
        "--xyz",
        str(warped_tif),
        str(tiles_dir)
    ]
    print(f"Zoom levels: {args.zoom}")
    subprocess.run(cmd_tiles, check=True)
    print(f"Tiles saved to: {tiles_dir}")

    # HTMLビューアを生成
    print("\n" + "=" * 60)
    print("Step 5: Generating HTML viewer")
    print("=" * 60)

    # タイルの範囲を取得（tilemapresource.xmlから）
    tilemap_xml = tiles_dir / "tilemapresource.xml"
    center_lon, center_lat = 139.762, 35.713  # デフォルト
    if tilemap_xml.exists():
        import xml.etree.ElementTree as ET
        tree = ET.parse(tilemap_xml)
        bbox = tree.find(".//BoundingBox")
        if bbox is not None:
            minx = float(bbox.get("minx"))
            maxx = float(bbox.get("maxx"))
            miny = float(bbox.get("miny"))
            maxy = float(bbox.get("maxy"))
            center_lon = (minx + maxx) / 2
            center_lat = (miny + maxy) / 2

    zoom_min, zoom_max = args.zoom.split("-")

    html_content = f'''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{label}</title>
  <script src="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.css" rel="stylesheet">
  <style>
    body {{ margin: 0; padding: 0; }}
    #map {{ position: absolute; top: 0; bottom: 0; width: 100%; }}
    .info {{
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255,255,255,0.9);
      padding: 10px 15px;
      border-radius: 4px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 1;
      max-width: 300px;
    }}
    .info h3 {{ margin: 0 0 5px 0; font-size: 14px; }}
    .slider-container {{ margin-top: 10px; }}
    .slider-container label {{ display: block; margin-bottom: 5px; }}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info">
    <h3>{label}</h3>
    <p>IIIF Georeference Extension + MapLibre GL JS</p>
    <div class="slider-container">
      <label>Opacity: <span id="opacity-value">80</span>%</label>
      <input type="range" id="opacity" min="0" max="100" value="80" style="width: 150px;">
    </div>
  </div>
  <script>
    const map = new maplibregl.Map({{
      container: 'map',
      style: {{
        version: 8,
        sources: {{
          osm: {{
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }},
          overlay: {{
            type: 'raster',
            tiles: ['{args.name}/{{z}}/{{x}}/{{y}}.png'],
            tileSize: 256,
            minzoom: {zoom_min},
            maxzoom: {zoom_max}
          }}
        }},
        layers: [
          {{ id: 'osm-layer', type: 'raster', source: 'osm' }},
          {{ id: 'overlay-layer', type: 'raster', source: 'overlay', paint: {{ 'raster-opacity': 0.8 }} }}
        ]
      }},
      center: [{center_lon}, {center_lat}],
      zoom: 16
    }});
    map.addControl(new maplibregl.NavigationControl());

    const slider = document.getElementById('opacity');
    const opacityValue = document.getElementById('opacity-value');
    slider.addEventListener('input', (e) => {{
      const opacity = e.target.value / 100;
      opacityValue.textContent = e.target.value;
      map.setPaintProperty('overlay-layer', 'raster-opacity', opacity);
    }});
  </script>
</body>
</html>
'''

    html_path = output_dir / "index.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Created: {html_path}")

    # 作業ディレクトリの削除
    if not args.keep_work:
        print(f"\nCleaning up work directory: {work_dir}")
        shutil.rmtree(work_dir)

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
    print(f"\nOutput files:")
    print(f"  - {html_path}")
    print(f"  - {tiles_dir}/")
    print(f"  - {json_path}")
    print(f"\nTo view locally:")
    print(f"  cd {output_dir} && python3 -m http.server 8000")
    print(f"  Open: http://localhost:8000/")


if __name__ == "__main__":
    main()

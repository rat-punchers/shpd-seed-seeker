#!/usr/bin/env bash
# Builds the browser engine and copies its runtime assets into a web app.
# Usage: scripts/build-web-wasm.sh [app-dir]   (default: web-v2)
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

app_name="${1:-web-v2}"
app_dir="$repo_root/$app_name"
if [[ ! -d "$app_dir/src" ]]; then
    echo "No web app at $app_dir" >&2
    exit 1
fi

wasm_package="$app_dir/src/engine/pkg"
editor_package="$app_dir/src/engine/editor-pkg"
runtime_source="$repo_root/android/app/src/main/assets/third_party/shattered-pixel-dungeon"
runtime_destination="$app_dir/public/third_party/shattered-pixel-dungeon"

mkdir -p "$wasm_package"
wasm-pack build crates/seedfinder-wasm \
    --target web \
    --release \
    --out-dir "$wasm_package" \
    --out-name seedfinder

# The requirement editor alone: small enough to load before first render,
# while the engine module above stays lazy.
mkdir -p "$editor_package"
wasm-pack build crates/seedfinder-editor-wasm \
    --target web \
    --release \
    --out-dir "$editor_package" \
    --out-name seedfinder_editor

mkdir -p "$runtime_destination" "$app_dir/src/generated" "$app_dir/public/licenses"
for asset in \
    items.png \
    item_icons.png \
    LICENSE.txt \
    ATTRIBUTION.md \
    ASSET_MANIFEST.json \
    catalog-v4.0.2.json
do
    cp "$runtime_source/$asset" "$runtime_destination/$asset"
done
cp "$runtime_source/catalog-v4.0.2.json" "$app_dir/src/generated/catalog.json"
cp "$runtime_source/item-mapping-art.json" "$app_dir/src/generated/item-mapping-art.json"
cp "$repo_root/COPYING" "$app_dir/public/licenses/COPYING.txt"
cp "$repo_root/NOTICE" "$app_dir/public/licenses/NOTICE.txt"

python3 "$repo_root/scripts/generate-sprite-bounds.py" "$app_name"

echo "Built browser WASM package in $wasm_package"
echo "Built browser requirement-editor WASM package in $editor_package"
echo "Copied Shattered Pixel Dungeon runtime assets to $runtime_destination"
echo "Copied generated catalog and license texts into $app_name/"
echo "Generated sprite bounds into $app_name/src/generated/sprite-bounds.json"

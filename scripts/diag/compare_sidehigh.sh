#!/bin/bash
# iter-12：把 sidehigh 截圖縮放對齊參考照 ref side-high，輸出疊圖供比例比對
# 對齊參數由 scripts/diag/fit_ref_camera.mjs 算出（相機擬合 rms 4.3 px）：ref = 0.835·r − (171, 4)
# 用法：compare_sidehigh.sh <我們的 sidehigh.png> <輸出前綴>
set -e
REF="$(dirname "$0")/../../../shared/reference/ref_chevalier-ma_side-high_tamiya.jpg"
OURS="$1"; OUT="$2"
magick "$OURS" -resize 83.5% -background '#4a4c50' -extent 1000x750+171+4 "${OUT}_aligned.png"
magick "$REF" "${OUT}_aligned.png" -compose blend -define compose:args=50,50 -composite "${OUT}_blend.png"
magick "$REF" "${OUT}_aligned.png" +append "${OUT}_pair.png"

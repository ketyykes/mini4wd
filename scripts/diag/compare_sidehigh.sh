#!/bin/bash
# iter-11：把 sidehigh 截圖縮放對齊參考照 ref side-high（以前後輪心對齊，軸距 80 mm），輸出疊圖供比例比對
# 用法：compare_sidehigh.sh <我們的 sidehigh.png> <輸出前綴>
# 參考照輪心（目視量測，1000×750 原圖）：前 (270,457)、後 (728,453)；我們的截圖輪心：前 (530,527)、後 (1070,527)
set -e
REF="$(dirname "$0")/../../../shared/reference/ref_chevalier-ma_side-high_tamiya.jpg"
OURS="$1"; OUT="$2"
S=0.848
# 縮放後前輪心 = (530*S, 527*S) = (449.4, 446.9) → 平移到 (270,457)
OX=$(printf "%+d" $(echo "530*$S-270" | bc | cut -d. -f1)); OY=$(printf "%+d" $(echo "527*$S-457" | bc | cut -d. -f1))
magick "$OURS" -resize $(echo "$S*100" | bc)% -background '#4a4c50' -extent 1000x750${OX}${OY} "${OUT}_aligned.png"
magick "$REF" "${OUT}_aligned.png" -compose blend -define compose:args=50,50 -composite "${OUT}_blend.png"
magick "$REF" "${OUT}_aligned.png" +append "${OUT}_pair.png"

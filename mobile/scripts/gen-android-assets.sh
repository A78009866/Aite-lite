#!/usr/bin/env bash
set -euo pipefail
SRC=/home/ubuntu/repos/Aite-lite/views/icon-512.png
RES=/home/ubuntu/repos/Aite-lite/mobile/android/app/src/main/res

# Launcher icon sizes (legacy square + round)
declare -A SIZES=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )

for d in "${!SIZES[@]}"; do
  s=${SIZES[$d]}
  mkdir -p "$RES/mipmap-$d"
  convert "$SRC" -resize ${s}x${s} -gravity center -extent ${s}x${s} -background none "$RES/mipmap-$d/ic_launcher.png"
  convert "$SRC" -resize ${s}x${s} -gravity center -extent ${s}x${s} -background none \
    \( +clone -alpha extract -draw "fill black polygon 0,0 0,${s} ${s},${s} ${s},0 fill white circle $((s/2)),$((s/2)) $((s/2)),0" -alpha off -compose CopyOpacity \) \
    -compose CopyOpacity -composite "$RES/mipmap-$d/ic_launcher_round.png"
  # Foreground for adaptive icon (108x108dp -> safe area 72x72): make foreground a scaled copy on transparent canvas.
  fg=$((s * 108 / 48))
  inner=$((fg * 72 / 108))
  convert "$SRC" -resize ${inner}x${inner} -gravity center -background transparent -extent ${fg}x${fg} "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# Adaptive icon XML (uses launcher_background color + foreground)
mkdir -p "$RES/mipmap-anydpi-v26" "$RES/values"
cat > "$RES/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
cp "$RES/mipmap-anydpi-v26/ic_launcher.xml" "$RES/mipmap-anydpi-v26/ic_launcher_round.xml"

# Background color – Aite dark theme
cat > "$RES/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
XML

# Splash screen – centered logo on black background
mkdir -p "$RES/drawable"
convert -size 1080x1920 xc:black \
  \( "$SRC" -resize 480x480 \) -gravity center -compose over -composite \
  "$RES/drawable/splash.png"
# Density-specific splashes
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  case $d in
    mdpi) W=320; H=480;;
    hdpi) W=480; H=800;;
    xhdpi) W=720; H=1280;;
    xxhdpi) W=960; H=1600;;
    xxxhdpi) W=1280; H=1920;;
  esac
  mkdir -p "$RES/drawable-$d"
  logo=$(( W < H ? W / 3 : H / 3 ))
  convert -size ${W}x${H} xc:black \( "$SRC" -resize ${logo}x${logo} \) -gravity center -compose over -composite "$RES/drawable-$d/splash.png"
done

echo "Generated launcher icons and splash drawables."

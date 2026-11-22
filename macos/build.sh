#!/bin/bash
set -euo pipefail

MACOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$MACOS_DIR/.." && pwd)"
WEB_DIST="$PROJECT_DIR/dist"
BUILD_DIR="$MACOS_DIR/.build"
OUTPUT_DIR="$MACOS_DIR/dist-mac"
APP_BUNDLE="$OUTPUT_DIR/Dayflow.app"
DMG_PATH="$OUTPUT_DIR/Dayflow-1.0.0-arm64.dmg"
SKIP_WEB=0

if [[ "${1:-}" == "--skip-web" ]]; then
    SKIP_WEB=1
    shift
fi
if [[ $# -ne 0 ]]; then
    echo "Usage: $0 [--skip-web]" >&2
    exit 64
fi

if [[ $SKIP_WEB -eq 0 ]]; then
    echo "==> Building web assets"
    (cd "$PROJECT_DIR" && npm run build)
else
    echo "==> Skipping web build; using existing dist"
fi

if [[ ! -f "$WEB_DIST/index.html" ]]; then
    echo "error: $WEB_DIST/index.html is missing" >&2
    exit 1
fi

rm -rf "$BUILD_DIR"
rm -rf "$APP_BUNDLE"
rm -f "$DMG_PATH"
mkdir -p "$BUILD_DIR" "$OUTPUT_DIR"

echo "==> Generating Dayflow.icns with Pillow and iconutil"
python3 "$MACOS_DIR/generate_icons.py" --output-dir "$BUILD_DIR/icons"

NATIVE_STAGE="$BUILD_DIR/Dayflow.native"
CONTENTS="$NATIVE_STAGE/Contents"
MACOS_BIN="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
mkdir -p "$MACOS_BIN" "$RESOURCES"

echo "==> Compiling native executable with Swift 6"
swiftc \
    -O \
    -swift-version 6 \
    -target arm64-apple-macosx13.0 \
    -module-name Dayflow \
    -framework AppKit \
    -framework WebKit \
    -framework UserNotifications \
    -o "$MACOS_BIN/Dayflow" \
    "$MACOS_DIR"/Sources/*.swift

cp "$MACOS_DIR/Info.plist" "$CONTENTS/Info.plist"
cp "$BUILD_DIR/icons/Dayflow.icns" "$RESOURCES/Dayflow.icns"
cp -RX "$WEB_DIST" "$RESOURCES/Web"
plutil -lint "$CONTENTS/Info.plist"

echo "==> Applying ad-hoc signature and verifying"
# Some Documents providers add FinderInfo to .app roots while codesign runs.
# Build cleanly and sign under a neutral extension without xattr mutation.
codesign --force --sign - --timestamp=none "$NATIVE_STAGE"
mv "$NATIVE_STAGE" "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

DMG_MOUNT="$BUILD_DIR/dmg-mount"
DMG_RW="$BUILD_DIR/Dayflow-readwrite.dmg"
APP_SIZE_KB="$(du -sk "$APP_BUNDLE" | awk '{print $1}')"
DMG_SIZE_MB=$((APP_SIZE_KB / 1024 + 32))
if [[ $DMG_SIZE_MB -lt 64 ]]; then
    DMG_SIZE_MB=64
fi
mkdir -p "$DMG_MOUNT"

cleanup_dmg_mount() {
    hdiutil detach "$DMG_MOUNT" >/dev/null 2>&1 || true
}
trap cleanup_dmg_mount EXIT

echo "==> Creating compressed DMG"
# hdiutil -srcfolder adds FinderInfo to .app roots on this host. Populate a
# writable image under a neutral name instead, then rename before compression.
hdiutil create -size "${DMG_SIZE_MB}m" -fs APFS -volname "Dayflow" "$DMG_RW"
hdiutil attach "$DMG_RW" -nobrowse -mountpoint "$DMG_MOUNT"
cp -RX "$APP_BUNDLE" "$DMG_MOUNT/Dayflow.native"
mv "$DMG_MOUNT/Dayflow.native" "$DMG_MOUNT/Dayflow.app"
ln -s /Applications "$DMG_MOUNT/Applications"
codesign --verify --deep --strict --verbose=2 "$DMG_MOUNT/Dayflow.app"
hdiutil detach "$DMG_MOUNT"
trap - EXIT

hdiutil convert "$DMG_RW" -format UDZO -o "$DMG_PATH"
hdiutil verify "$DMG_PATH"
rm -f "$DMG_RW"
rmdir "$DMG_MOUNT"

echo "==> Native build complete"
echo "App: $APP_BUNDLE"
echo "DMG: $DMG_PATH"

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERSION_FILE="version"
VERSION=$(cat "$VERSION_FILE")

echo "=== Version: $VERSION ==="
echo ""

PACKAGE="cockpit-taskmgr"
ARCH="all"

BUILD_DIR="build"
DEB_DIR="$BUILD_DIR/deb"
DEB_ROOT="$DEB_DIR/$PACKAGE-$VERSION"
OUTPUT_DIR="$(pwd)"

MANIFEST_FILE="manifest.json"
INDEX_FILE="index.html"

echo "Syncing version to manifest.json..."
if [ -f "$MANIFEST_FILE" ]; then
    sed -i "s/\"plugin_version\": \"[^\"]*\"/\"plugin_version\": \"$VERSION\"/" "$MANIFEST_FILE"
    echo "  manifest.json: plugin_version -> $VERSION"
fi

echo "Syncing version to index.html..."
if [ -f "$INDEX_FILE" ]; then
    sed -i "s/id=\"versionDisplay\">v[^\"]*</id=\"versionDisplay\">v$VERSION</" "$INDEX_FILE"
    echo "  index.html: versionDisplay -> v$VERSION"
fi

echo ""
echo "=== Building $PACKAGE $VERSION ==="

rm -rf "$BUILD_DIR"

mkdir -p "$BUILD_DIR"
mkdir -p "$DEB_ROOT/DEBIAN"
mkdir -p "$DEB_ROOT/usr/share/cockpit/taskmgr/static/lang"
mkdir -p "$DEB_ROOT/etc/cockpit/taskmgr"

cp index.html "$DEB_ROOT/usr/share/cockpit/taskmgr/"
cp manifest.json "$DEB_ROOT/usr/share/cockpit/taskmgr/"
cp static/taskmgr.css "$DEB_ROOT/usr/share/cockpit/taskmgr/static/"
cp static/taskmgr.js "$DEB_ROOT/usr/share/cockpit/taskmgr/static/"
cp static/lang/en.json "$DEB_ROOT/usr/share/cockpit/taskmgr/static/lang/"
cp static/lang/zh-CN.json "$DEB_ROOT/usr/share/cockpit/taskmgr/static/lang/"

cat > "$DEB_ROOT/etc/cockpit/taskmgr/settings.json" << 'EOF'
{
    "theme": "light",
    "lang": "zh-CN",
    "menuLayout": "side",
    "accentColor": "#4f6ef7",
    "sidebarOpen": true,
    "refreshInterval": 1000,
    "treeView": false,
    "showCpuTemp": false
}
EOF

cat > "$DEB_ROOT/DEBIAN/control" << EOF
Package: $PACKAGE
Version: $VERSION
Section: admin
Priority: optional
Architecture: $ARCH
Maintainer: Example <example@example.com>
Description: Process and system resource monitoring for Cockpit
 Task Manager plugin for Cockpit provides a htop-like interface for
 monitoring system processes, CPU usage, memory consumption, disk I/O,
 network activity and GPU status.
Depends: cockpit (>= 276), procps, pciutils
Recommends: lm-sensors, nvtop, intel-gpu-tools
Homepage: https://github.com/example/cockpit-taskmgr
EOF

cat > "$DEB_ROOT/DEBIAN/conffiles" << EOF
/etc/cockpit/taskmgr/settings.json
EOF

cat > "$DEB_ROOT/DEBIAN/postinst" << 'EOF'
#!/bin/bash
chmod 666 /etc/cockpit/taskmgr/settings.json 2>/dev/null || true
EOF
chmod 755 "$DEB_ROOT/DEBIAN/postinst"

cat > "$DEB_ROOT/DEBIAN/postrm" << 'EOF'
#!/bin/bash
if [ -x /usr/bin/systemctl ]; then
    systemctl try-restart cockpit.socket || true
fi
EOF
chmod 755 "$DEB_ROOT/DEBIAN/postrm"

dpkg-deb --build --root-owner-group "$DEB_ROOT"

DEB_FILE="${PACKAGE}_${VERSION}_${ARCH}.deb"
mv "$BUILD_DIR/deb/${PACKAGE}-${VERSION}.deb" "$OUTPUT_DIR/$DEB_FILE"

rm -rf "$BUILD_DIR"

echo ""
echo "=== Build complete ==="
echo "Package: $OUTPUT_DIR/$DEB_FILE"
echo "Size: $(du -h "$OUTPUT_DIR/$DEB_FILE" | cut -f1)"
echo ""
echo "Install with: sudo dpkg -i $DEB_FILE"

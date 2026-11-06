#!/usr/bin/env bash
set -e

ARCHIPELAGO_VERSION="0.6.8"
ARCHIPELAGO_DIR="${HOME}/Archipelago"
TAR_FILE="Archipelago_${ARCHIPELAGO_VERSION}_linux-x86_64.tar.gz"
DOWNLOAD_URL="https://github.com/ArchipelagoMW/Archipelago/releases/download/${ARCHIPELAGO_VERSION}/${TAR_FILE}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Ensuring archipelacode.apworld is built..."
python3 "${REPO_ROOT}/apworld/build_apworld.py"

mkdir -p "${ARCHIPELAGO_DIR}"
cd "${ARCHIPELAGO_DIR}"

if [ ! -f "ArchipelagoServer" ]; then
    echo "==> Downloading Archipelago ${ARCHIPELAGO_VERSION} portable Linux build (~120MB)..."
    curl -L -o "${TAR_FILE}" "${DOWNLOAD_URL}"
    echo "==> Extracting ${TAR_FILE}..."
    tar -xzf "${TAR_FILE}"
    rm -f "${TAR_FILE}"
fi

# Ensure custom_worlds exists and install apworld
mkdir -p custom_worlds
cp -v "${REPO_ROOT}/dist/archipelacode.apworld" custom_worlds/

# Ensure Players exists and copy template YAML
mkdir -p Players
cp -v "${REPO_ROOT}/templates/ArchipelaCode.yaml" Players/

echo ""
echo "==> Generating seed from Players/ArchipelaCode.yaml..."
./ArchipelagoGenerate

LATEST_SEED="$(ls -t output/*.archipelago 2>/dev/null | head -n 1)"
if [ -n "${LATEST_SEED}" ]; then
    echo ""
    echo "==> Success! Generated seed: ${LATEST_SEED}"
    echo ""
    echo "To start your solo server now, run:"
    echo "  cd ${ARCHIPELAGO_DIR} && ./ArchipelagoServer ${LATEST_SEED}"
    echo ""
    echo "Then in the Chrome Extension Side Panel:"
    echo "  Host: localhost"
    echo "  Port: 38281"
    echo "  Slot Name: Player1"
fi

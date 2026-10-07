#!/bin/sh
# Publish only this explicit list; never upload the working directory.
set -eu
cd "$(dirname "$0")/.."
if [ -e _site ]; then
  echo "_site already exists; move it aside before building a fresh artifact." >&2
  exit 1
fi
mkdir -p _site/licenses
cp index.html hungarian-letter-studio.html hungarian-letter-studio.docs.md \
  transcribe.py whisply_script.py yt-dlp-script.py CNAME LICENSE _site/
cp licenses/JSZip-LICENSE.md _site/licenses/
touch _site/.nojekyll
echo "Static site staged in _site/"

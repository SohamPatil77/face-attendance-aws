#!/bin/bash
# Pulls the latest code from GitHub, rebuilds and restarts the app.
# Usage:  sudo bash /opt/face-attendance/deploy/update.sh
set -euxo pipefail
cd /opt/face-attendance
git pull --ff-only
cd server && npm install --omit=dev --no-audit --no-fund
cd ../client && npm install --no-audit --no-fund && npm run build
systemctl restart face-attendance
echo "UPDATE COMPLETE"

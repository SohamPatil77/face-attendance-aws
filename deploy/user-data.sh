#!/bin/bash
# =====================================================================
#  FaceTrack – EC2 bootstrap script (paste into "User data" when
#  launching an Ubuntu 24.04 EC2 instance). Installs Node.js, MongoDB,
#  Nginx, builds the React app and starts the Express server.
#  Progress log: /var/log/face-attendance-setup.log
# =====================================================================
set -euxo pipefail
exec > >(tee -a /var/log/face-attendance-setup.log) 2>&1

# ---------- settings (edit these two lines) ----------
S3_BUCKET="CHANGE-ME-bucket-name"
AWS_REGION="ap-south-1"
REPO_URL="https://github.com/SohamPatil77/face-attendance-aws.git"
APP_DIR=/opt/face-attendance
export DEBIAN_FRONTEND=noninteractive HOME=/root

# ---------- 2 GB swap (t2/t3.micro has only 1 GB RAM) ----------
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- system packages ----------
apt-get update -y
apt-get install -y curl gnupg git nginx certbot python3-certbot-nginx

# ---------- Node.js 22 LTS ----------
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ---------- MongoDB 8.0 Community ----------
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-8.0.list
apt-get update -y
apt-get install -y mongodb-org
systemctl enable --now mongod

# ---------- application ----------
rm -rf "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR/server" && npm install --omit=dev --no-audit --no-fund
cd "$APP_DIR/client" && npm install --no-audit --no-fund && npm run build

cat > "$APP_DIR/server/.env" <<EOF
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/face_attendance
S3_BUCKET=$S3_BUCKET
AWS_REGION=$AWS_REGION
MATCH_THRESHOLD=0.5
EOF

# ---------- run the API as a systemd service ----------
cat > /etc/systemd/system/face-attendance.service <<EOF
[Unit]
Description=FaceTrack AI Attendance (Express API)
After=network.target mongod.service
Requires=mongod.service

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now face-attendance

# ---------- Nginx reverse proxy (port 80 -> 5000) ----------
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/face-attendance
ln -sf /etc/nginx/sites-available/face-attendance /etc/nginx/sites-enabled/face-attendance
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "SETUP COMPLETE $(date)"

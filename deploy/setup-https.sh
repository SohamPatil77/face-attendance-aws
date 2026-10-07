#!/bin/bash
# Adds a free HTTPS certificate (Let's Encrypt) using a sslip.io hostname
# built from the instance's public IP, e.g. 13-233-10-20.sslip.io
# Run once after the Elastic IP is attached:  sudo bash /opt/face-attendance/deploy/setup-https.sh
set -euo pipefail
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
DOMAIN="${IP//./-}.sslip.io"
echo "Public IP: $IP  ->  domain: $DOMAIN"

sed -i "s/server_name .*;/server_name $DOMAIN;/" /etc/nginx/sites-available/face-attendance
nginx -t && systemctl reload nginx

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
systemctl reload nginx
echo
echo "=============================================="
echo " App is live at:  https://$DOMAIN"
echo "=============================================="

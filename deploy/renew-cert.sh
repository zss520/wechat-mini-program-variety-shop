#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
docker run --rm \
  -v "$ROOT/certs:/etc/letsencrypt" \
  -v "$ROOT/certbot-www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet
docker exec variety-shop-web-1 nginx -s reload

#!/usr/bin/env bash
# 在你自己电脑上执行：把 variety_shop 库表导入本机 MySQL（127.0.0.1 / root / root）
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
mysql -h127.0.0.1 -P3306 -uroot -proot --protocol=TCP --default-character-set=utf8mb4 \
  < "$DIR/variety_shop.sql"
echo "已导入。请在本机客户端刷新，应看到数据库 variety_shop（18 张表）。"
echo "可验证：mysql -h127.0.0.1 -uroot -proot -e 'USE variety_shop; SHOW TABLES;'"

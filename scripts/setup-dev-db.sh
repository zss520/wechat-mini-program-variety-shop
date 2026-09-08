#!/usr/bin/env bash
# 在本机 MySQL 8 创建开发库 variety_shop、测试库 variety_shop_test，并迁移/种子/单测。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RESET=0
RUN_TEST=1
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    --no-test) RUN_TEST=0 ;;
    -h|--help)
      echo "用法: bash scripts/setup-dev-db.sh [--reset] [--no-test]"
      echo "  --reset    删除并重建开发库与测试库"
      echo "  --no-test  只建库迁移，不跑单测"
      exit 0
      ;;
  esac
done

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-shop}"
DB_PASSWORD="${DB_PASSWORD:-shop123}"
DB_NAME="${DB_NAME:-variety_shop}"
DB_TEST_NAME="${DB_TEST_NAME:-variety_shop_test}"
DB_ADMIN_USER="${DB_ADMIN_USER:-root}"

mysql_admin() {
  if [ -n "${DB_ADMIN_PASSWORD:-}" ]; then
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_ADMIN_USER" -p"$DB_ADMIN_PASSWORD" --protocol=TCP "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo mysql -e "SELECT 1" >/dev/null 2>&1; then
    sudo mysql "$@"
  elif mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_ADMIN_USER" --protocol=TCP -e "SELECT 1" >/dev/null 2>&1; then
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_ADMIN_USER" --protocol=TCP "$@"
  else
    echo "无法以 MySQL 管理员连接。"
    echo "请先启动本机 MySQL 8，然后任选其一："
    echo "  1) mysql -u${DB_ADMIN_USER} -p < scripts/setup-dev-db.sql"
    echo "  2) 设置环境变量 DB_ADMIN_USER / DB_ADMIN_PASSWORD 后重跑本脚本"
    echo "  3) Linux 下确保 sudo mysql 可用"
    exit 1
  fi
}

sql_ident() {
  printf '`%s`' "${1//\`/}"
}

echo "== MySQL 版本 =="
mysql_admin -e "SELECT VERSION() AS mysql_version;"

if [ "$RESET" = "1" ]; then
  echo "== 删除已有库 ${DB_NAME} / ${DB_TEST_NAME} =="
  mysql_admin -e "DROP DATABASE IF EXISTS $(sql_ident "$DB_NAME"); DROP DATABASE IF EXISTS $(sql_ident "$DB_TEST_NAME");"
fi

echo "== 创建库与账号 =="
mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS $(sql_ident "$DB_NAME")
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS $(sql_ident "$DB_TEST_NAME")
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';

GRANT ALL PRIVILEGES ON $(sql_ident "$DB_NAME").* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON $(sql_ident "$DB_NAME").* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON $(sql_ident "$DB_TEST_NAME").* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON $(sql_ident "$DB_TEST_NAME").* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "== 校验 ${DB_USER} 可连开发库 =="
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --protocol=TCP \
  -e "USE ${DB_NAME}; SELECT DATABASE() AS current_db, @@character_set_database AS charset;"

export PATH="${NVM_DIR:+$NVM_DIR/versions/node/v16.17.0/bin:}$PATH"
if command -v nvm >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  nvm use 16.17.0 >/dev/null 2>&1 || true
fi
if [ -x /home/ubuntu/.nvm/versions/node/v16.17.0/bin/node ]; then
  export PATH="/home/ubuntu/.nvm/versions/node/v16.17.0/bin:$PATH"
fi

if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "== 安装 server 依赖 =="
  npm install --prefix "$ROOT/server"
fi

echo "== 开发库迁移 + 种子 (${DB_NAME}) =="
npm run migrate --prefix "$ROOT/server"
npm run seed --prefix "$ROOT/server"

echo "== 测试库迁移 + 种子 (${DB_TEST_NAME}) =="
npm run migrate:test --prefix "$ROOT/server"
npm run seed:test --prefix "$ROOT/server"

if [ "$RUN_TEST" = "1" ]; then
  echo "== 库存并发单测（测试库） =="
  npm test --prefix "$ROOT/server"
fi

echo
echo "开发库已就绪：${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "测试库已就绪：${DB_HOST}:${DB_PORT}/${DB_TEST_NAME}"
echo "管理端账号：${ADMIN_SEED_USERNAME:-admin} / ${ADMIN_SEED_PASSWORD:-admin123}"

-- 本地 MySQL 8：用 root 建开发库 / 测试库
--   mysql -h127.0.0.1 -P3306 -uroot -proot --protocol=TCP < scripts/setup-dev-db.sql

CREATE DATABASE IF NOT EXISTS `variety_shop`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `variety_shop_test`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

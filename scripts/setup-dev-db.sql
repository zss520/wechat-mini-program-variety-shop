-- 本地 MySQL 8 开发库 / 测试库（utf8mb4）
-- 用法（需管理员账号）：
--   mysql -uroot -p < scripts/setup-dev-db.sql
--   或：sudo mysql < scripts/setup-dev-db.sql

CREATE DATABASE IF NOT EXISTS `variety_shop`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `variety_shop_test`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'shop'@'localhost' IDENTIFIED BY 'shop123';
CREATE USER IF NOT EXISTS 'shop'@'127.0.0.1' IDENTIFIED BY 'shop123';

ALTER USER 'shop'@'localhost' IDENTIFIED BY 'shop123';
ALTER USER 'shop'@'127.0.0.1' IDENTIFIED BY 'shop123';

GRANT ALL PRIVILEGES ON `variety_shop`.* TO 'shop'@'localhost';
GRANT ALL PRIVILEGES ON `variety_shop`.* TO 'shop'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `variety_shop_test`.* TO 'shop'@'localhost';
GRANT ALL PRIVILEGES ON `variety_shop_test`.* TO 'shop'@'127.0.0.1';

FLUSH PRIVILEGES;

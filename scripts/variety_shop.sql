-- 在「你自己电脑」的 MySQL 8 上执行本文件，才会出现库和表。
-- 云端开发机里的库不会自动出现在你本机。
--
-- 命令行（密码 root）：
--   mysql -h127.0.0.1 -P3306 -uroot -proot --default-character-set=utf8mb4 < scripts/variety_shop.sql
--
-- 图形工具：用 Navicat / MySQL Workbench / DBeaver 连 127.0.0.1:3306 root/root，
-- 打开本文件并执行。执行后应看到数据库 variety_shop（18 张表）。

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

/*!40000 DROP DATABASE IF EXISTS `variety_shop`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `variety_shop` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `variety_shop`;
DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `contact_name` varchar(32) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `province` varchar(32) DEFAULT NULL,
  `city` varchar(32) DEFAULT NULL,
  `district` varchar(32) DEFAULT NULL,
  `detail` varchar(120) NOT NULL,
  `is_default` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `addresses_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(32) NOT NULL,
  `password_hash` varchar(100) NOT NULL,
  `display_name` varchar(32) NOT NULL,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_users_username_unique` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES
(1,'admin','$2a$10$NlGBZIgkBgioaHH6Oos9dOae0YHkzggqLeWs5HeryzCqRt3l.J6MC','店主',1,'2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `analytics_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `analytics_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event` varchar(32) NOT NULL,
  `ts` datetime NOT NULL,
  `received_at` datetime NOT NULL,
  `anonymous_id` varchar(64) DEFAULT NULL,
  `session_id` varchar(64) DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `page` varchar(64) DEFAULT NULL,
  `scene` int(11) DEFAULT NULL,
  `goods_id` bigint(20) unsigned DEFAULT NULL,
  `slot_id` varchar(32) DEFAULT NULL,
  `position` int(11) DEFAULT NULL,
  `order_no` varchar(32) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `app_version` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `analytics_events_event_ts_index` (`event`,`ts`),
  KEY `analytics_events_goods_id_event_ts_index` (`goods_id`,`event`,`ts`),
  KEY `analytics_events_session_id_ts_index` (`session_id`,`ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `analytics_events` WRITE;
/*!40000 ALTER TABLE `analytics_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `analytics_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `banners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `banners` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `image_url` varchar(512) NOT NULL,
  `title` varchar(40) DEFAULT NULL,
  `link_type` varchar(16) NOT NULL DEFAULT 'NONE',
  `link_value` varchar(128) DEFAULT NULL,
  `sort` int(11) NOT NULL DEFAULT 0,
  `enabled` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `banners` WRITE;
/*!40000 ALTER TABLE `banners` DISABLE KEYS */;
INSERT INTO `banners` VALUES
(1,'/static/placeholders/p1.png','邻里好货','NONE',NULL,10,1,'2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `banners` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `goods_id` bigint(20) unsigned NOT NULL,
  `qty` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cart_items_user_id_goods_id_unique` (`user_id`,`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `sort` int(11) NOT NULL DEFAULT 0,
  `icon_url` varchar(512) DEFAULT NULL,
  `enabled` tinyint(4) NOT NULL DEFAULT 1,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES
(1,'粮油调味',100,NULL,1,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(2,'休闲零食',90,NULL,1,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(3,'日用百货',80,NULL,1,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(4,'酒水饮料',70,NULL,1,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `goods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned NOT NULL,
  `name` varchar(40) NOT NULL,
  `subtitle` varchar(80) DEFAULT NULL,
  `price_cent` int(11) NOT NULL,
  `origin_price_cent` int(11) DEFAULT NULL,
  `unit` varchar(8) NOT NULL DEFAULT '件',
  `stock` int(11) NOT NULL DEFAULT 0,
  `sold_count` int(11) NOT NULL DEFAULT 0,
  `cover_url` varchar(512) DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `detail` text DEFAULT NULL,
  `on_sale` tinyint(4) NOT NULL DEFAULT 1,
  `sort` int(11) NOT NULL DEFAULT 0,
  `manual_weight` smallint(6) NOT NULL DEFAULT 0,
  `heat_score` smallint(6) NOT NULL DEFAULT 0,
  `heat_updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `goods_on_sale_category_id_sort_index` (`on_sale`,`category_id`,`sort`),
  KEY `goods_on_sale_heat_score_index` (`on_sale`,`heat_score`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `goods` WRITE;
/*!40000 ALTER TABLE `goods` DISABLE KEYS */;
INSERT INTO `goods` VALUES
(1,1,'五常大米 5kg','东北香米',3290,3990,'袋',40,12,'/static/placeholders/p1.png',NULL,'真空包装，煮粥香软。',1,100,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(2,1,'鲁花花生油 900ml','物理压榨',2590,NULL,'瓶',25,8,'/static/placeholders/p2.png',NULL,'日常炒菜用油。',1,90,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(3,2,'每日坚果 30包','混合坚果',3990,4590,'盒',18,20,'/static/placeholders/p3.png',NULL,'办公室零食。',1,100,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(4,2,'苏打饼干 400g','无蔗糖',890,NULL,'包',50,30,'/static/placeholders/p4.png',NULL,NULL,1,80,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(5,3,'抽纸 3层 10包','家庭装',1290,NULL,'提',35,16,'/static/placeholders/p5.png',NULL,NULL,1,90,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(6,3,'洗衣液 2kg','留香',1990,NULL,'瓶',22,9,'/static/placeholders/p6.png',NULL,NULL,1,70,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(7,4,'矿泉水 550ml*12','整箱',1590,NULL,'箱',40,22,'/static/placeholders/p7.png',NULL,NULL,1,100,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53'),
(8,4,'鲜榨豆浆 300ml','冷藏',600,NULL,'瓶',0,5,'/static/placeholders/p8.png',NULL,'售罄示例。',1,60,0,0,NULL,NULL,'2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `goods` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `goods_stats_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_stats_daily` (
  `stat_date` date NOT NULL,
  `goods_id` bigint(20) unsigned NOT NULL,
  `expose_pv` int(11) NOT NULL DEFAULT 0,
  `expose_uv` int(11) NOT NULL DEFAULT 0,
  `click_pv` int(11) NOT NULL DEFAULT 0,
  `click_uv` int(11) NOT NULL DEFAULT 0,
  `detail_uv` int(11) NOT NULL DEFAULT 0,
  `cart_pv` int(11) NOT NULL DEFAULT 0,
  `cart_uv` int(11) NOT NULL DEFAULT 0,
  `pay_qty` int(11) NOT NULL DEFAULT 0,
  `pay_uv` int(11) NOT NULL DEFAULT 0,
  `pay_amount_cent` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`stat_date`,`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `goods_stats_daily` WRITE;
/*!40000 ALTER TABLE `goods_stats_daily` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_stats_daily` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `knex_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `knex_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int(11) DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `knex_migrations` WRITE;
/*!40000 ALTER TABLE `knex_migrations` DISABLE KEYS */;
INSERT INTO `knex_migrations` VALUES
(1,'202609070001_init.js',1,'2026-09-08 09:49:52');
/*!40000 ALTER TABLE `knex_migrations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `knex_migrations_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `knex_migrations_lock` (
  `index` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int(11) DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `knex_migrations_lock` WRITE;
/*!40000 ALTER TABLE `knex_migrations_lock` DISABLE KEYS */;
INSERT INTO `knex_migrations_lock` VALUES
(1,0);
/*!40000 ALTER TABLE `knex_migrations_lock` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `goods_id` bigint(20) unsigned NOT NULL,
  `name_snapshot` varchar(40) NOT NULL,
  `cover_snapshot` varchar(512) DEFAULT NULL,
  `unit_snapshot` varchar(8) DEFAULT NULL,
  `price_cent` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `amount_cent` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_index` (`order_id`),
  KEY `order_items_goods_id_index` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `order_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `from_status` varchar(20) DEFAULT NULL,
  `to_status` varchar(20) NOT NULL,
  `operator_type` varchar(16) NOT NULL,
  `operator_id` bigint(20) unsigned DEFAULT NULL,
  `note` varchar(120) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_logs_order_id_index` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `order_logs` WRITE;
/*!40000 ALTER TABLE `order_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_logs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` varchar(32) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `status` varchar(20) NOT NULL,
  `fulfill_type` varchar(16) NOT NULL,
  `goods_amount_cent` int(11) NOT NULL,
  `freight_cent` int(11) NOT NULL DEFAULT 0,
  `discount_cent` int(11) NOT NULL DEFAULT 0,
  `pay_amount_cent` int(11) NOT NULL,
  `remark` varchar(80) DEFAULT NULL,
  `pickup_code` varchar(8) DEFAULT NULL,
  `address_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`address_snapshot`)),
  `paid_at` datetime DEFAULT NULL,
  `packed_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(80) DEFAULT NULL,
  `wx_transaction_id` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_no_unique` (`order_no`),
  KEY `orders_user_id_status_index` (`user_id`,`status`),
  KEY `orders_status_created_at_index` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `channel` varchar(16) NOT NULL DEFAULT 'WECHAT',
  `prepay_id` varchar(128) DEFAULT NULL,
  `status` varchar(16) NOT NULL,
  `amount_cent` int(11) NOT NULL,
  `raw_notify` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_notify`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `payments_order_id_index` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `recommend_slot_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recommend_slot_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slot_id` varchar(32) NOT NULL,
  `goods_id` bigint(20) unsigned NOT NULL,
  `pin_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recommend_slot_items_slot_id_goods_id_unique` (`slot_id`,`goods_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `recommend_slot_items` WRITE;
/*!40000 ALTER TABLE `recommend_slot_items` DISABLE KEYS */;
INSERT INTO `recommend_slot_items` VALUES
(1,'home_recommend',1,1),
(2,'home_recommend',7,2);
/*!40000 ALTER TABLE `recommend_slot_items` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `recommend_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recommend_slots` (
  `slot_id` varchar(32) NOT NULL,
  `title` varchar(40) NOT NULL,
  `capacity` int(11) NOT NULL DEFAULT 8,
  `strategy` varchar(32) NOT NULL DEFAULT 'PIN_THEN_HEAT',
  `enabled` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`slot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `recommend_slots` WRITE;
/*!40000 ALTER TABLE `recommend_slots` DISABLE KEYS */;
INSERT INTO `recommend_slots` VALUES
('home_recommend','本店推荐',8,'PIN_THEN_HEAT',1,'2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `recommend_slots` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `shop_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shop_settings` (
  `skey` varchar(64) NOT NULL,
  `svalue` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`skey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `shop_settings` WRITE;
/*!40000 ALTER TABLE `shop_settings` DISABLE KEYS */;
INSERT INTO `shop_settings` VALUES
('business_hours','07:00-22:00','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('delivery_enabled','true','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('free_freight_over_cent','3000','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('freight_cent','300','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('intro','邻里便利，线上下单，到店自提','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('logo_url','','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('low_stock_threshold','5','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('pause_order','false','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('pay_timeout_minutes','15','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('phone','13800000000','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('pickup_address','小区东门杂货铺','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('primary_color','#C2410C','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('shop_name','社区杂货铺','2026-09-08 01:49:53','2026-09-08 01:49:53'),
('wechat_id','variety-shop','2026-09-08 01:49:53','2026-09-08 01:49:53');
/*!40000 ALTER TABLE `shop_settings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `openid` varchar(64) NOT NULL,
  `unionid` varchar(64) DEFAULT NULL,
  `nickname` varchar(64) DEFAULT NULL,
  `avatar_url` varchar(512) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `phone_bound_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openid_unique` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


SET FOREIGN_KEY_CHECKS = 1;

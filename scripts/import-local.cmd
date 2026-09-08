@echo off
chcp 65001 >nul
REM 在你自己电脑上双击或在仓库根目录运行：把库表导入本机 MySQL（127.0.0.1 / root / root）
cd /d "%~dp0"
mysql -h127.0.0.1 -P3306 -uroot -proot --default-character-set=utf8mb4 < "%~dp0variety_shop.sql"
if errorlevel 1 (
  echo 导入失败。请确认本机 MySQL 已启动，且可用 root / root 连接 127.0.0.1:3306。
  pause
  exit /b 1
)
echo 已导入。请打开 Navicat / Workbench 刷新，应看到 variety_shop（18 张表）。
pause

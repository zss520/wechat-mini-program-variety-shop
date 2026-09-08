@echo off
chcp 65001 >nul
setlocal

REM 在「你自己的 Windows」上运行：把 GitHub 上的云端代码拉到本机目录并导入开发库。
REM 云端 Agent 无法直接写入 D:\ ，必须在本机执行本脚本。

set "TARGET=D:\project-code\project-code\my-cursor-project\wechat-mini-program-variety-shop"
set "BRANCH=cursor/implement-r1-r2-2abd"
set "REPO=https://github.com/zss520/wechat-mini-program-variety-shop.git"
set "DB_HOST=127.0.0.1"
set "DB_PORT=3306"
set "DB_USER=root"
set "DB_PASSWORD=root"

echo ==== 目标目录 ====
echo %TARGET%
echo ==== 分支 %BRANCH% ====

if not exist "%TARGET%\.git" (
  echo 目录尚无 git 仓库，开始 clone...
  if not exist "%TARGET%" mkdir "%TARGET%"
  git clone "%REPO%" "%TARGET%"
  if errorlevel 1 (
    echo git clone 失败。请确认已安装 Git 且能访问 GitHub。
    pause
    exit /b 1
  )
)

cd /d "%TARGET%"
git fetch origin
if errorlevel 1 (
  echo git fetch 失败。
  pause
  exit /b 1
)
git checkout %BRANCH%
git pull origin %BRANCH%
if errorlevel 1 (
  echo git pull 失败。
  pause
  exit /b 1
)

if not exist ".env" copy /Y ".env.example" ".env" >nul

echo ==== 导入本机 MySQL 开发库 variety_shop ====
where mysql >nul 2>&1
if errorlevel 1 (
  echo 未找到 mysql.exe。请把 MySQL 的 bin 目录加入 PATH 后重试，
  echo 或用 Navicat 打开 scripts\variety_shop.sql 执行。
  pause
  exit /b 1
)

mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% --default-character-set=utf8mb4 < "%TARGET%\scripts\variety_shop.sql"
if errorlevel 1 (
  echo 导入失败。请确认本机 MySQL 已启动，账号为 root / root，端口 3306。
  pause
  exit /b 1
)

echo ==== 校验表 ====
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% -e "USE variety_shop; SHOW TABLES; SELECT COUNT(*) AS goods_count FROM goods;"

echo.
echo 同步完成。
echo 代码目录: %TARGET%
echo 开发库: variety_shop （18 张表）
echo 会话记忆: docs\09-会话记忆与本地同步.md
echo 下一步: 安装 Node 16.17.0 后分别在 server 与 admin 执行 npm install / npm run dev
echo.
pause

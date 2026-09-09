# 微信小程序杂货铺

面向社区杂货铺的私域数字化经营系统：顾客使用 **微信原生小程序** 浏览与下单，店主使用 **Vite + TypeScript + React + Material UI v5** 管理后台。运行与构建环境锁定 **Node.js 16.17.0**。

## 文档

全部项目文档位于 [`docs/`](./docs/README.md)。开发顺序以 [项目开发计划](./docs/08-项目开发计划.md) 为准：R1 交易上线（M1–M6），R2 运营包（M7）。P0 埋点随交易域一起上线。

## 仓库结构

```
miniprogram/   微信原生小程序（TypeScript）
admin/         Vite 4.5.x + React 18.2 + MUI v5.15
server/        Express 4 + TypeScript + knex + mysql2
docs/          需求与技术方案
```

## 技术栈（约束）

| 端 | 技术 |
|----|------|
| 顾客端 | 微信小程序原生（禁止 uni-app / Taro） |
| 管理端 | Vite 4.5.x + TypeScript 5.3.3 + React 18.2 + Material UI v5.15 |
| 服务端 | Node.js 16.17.0 + Express 4 + knex + **MySQL 8** |
| 金额 | 整数分；订单预占库存；购买率以支付回调为准 |

## 同步到本机 Windows 目录

云端不能直接写你的 `D:\`。本机请签出分支 `cursor/implement-r1-r2-2abd`，或双击 `scripts/sync-local-windows.cmd`（目标路径 `D:\project-code\project-code\my-cursor-project\wechat-mini-program-variety-shop`）。会话记忆见 [docs/09-会话记忆与本地同步.md](./docs/09-会话记忆与本地同步.md)。

## 在你自己电脑上建库表（必做）

云端开发机里的 MySQL **不会**同步到你的电脑。要在本机看到 `variety_shop` 和表，请在你自己的 MySQL 8 上导入：

```bash
# 本机命令行（主机 127.0.0.1 端口 3306 用户 root 密码 root）
mysql -h127.0.0.1 -P3306 -uroot -proot --default-character-set=utf8mb4 < scripts/variety_shop.sql
```

Windows 也可在仓库里双击 `scripts/import-local.cmd`。  
或用 Navicat / Workbench / DBeaver 连接本机后，打开并执行 `scripts/variety_shop.sql`。

导入成功后应看到库 **variety_shop**，共 18 张表（`goods` `orders` `admin_users` 等），并带示例商品。管理端账号 `admin` / `admin123`。

## 本地启动

需要 **Node.js 16.17.0** 与本机 **MySQL 8**（utf8mb4）。默认连接 `127.0.0.1:3306`，账号 `root` / `root`。开发库 `variety_shop`，测试库 `variety_shop_test`。

```bash
nvm use 16.17.0   # 或安装后使用仓库根目录 .nvmrc
cp .env.example .env   # 已是 127.0.0.1 / root / root

# 用 root 建库并迁移种子（可选跑单测）
bash scripts/setup-dev-db.sh
# 需要清空重建时：
# bash scripts/setup-dev-db.sh --reset

cd server && npm install && npm run dev
# 另开终端
cd admin && npm install && npm run dev
```

也可手工：

```bash
mysql -h127.0.0.1 -P3306 -uroot -proot --protocol=TCP < scripts/setup-dev-db.sql
cd server && npm run migrate && npm run seed
```

- API：http://127.0.0.1:3000（健康检查 `/api/health`）
- 管理后台：http://127.0.0.1:5173 ，默认账号 `admin` / `admin123`
- 小程序：用微信开发者工具导入 `miniprogram/` 目录，AppID 为 `wx6434c5c04d4b6c6e`。界面使用 [TDesign 小程序](https://tdesign.tencent.com/miniprogram/overview)，底部菜单为 TDesign `TabBar`（微信自定义 tabBar）。仓库已预置 `miniprogram/miniprogram_npm`；若重新 `npm install`，在开发者工具执行 **工具 → 构建 npm**。真机预览请把 `miniprogram/utils/config.ts` 的 `API_BASE` 改成电脑局域网 IP。

### 预览 / 体验版二维码

云端不能代你向微信申请码，需在本机微信开发者工具操作：

1. 导入 `miniprogram/`，确认 AppID 为 `wx6434c5c04d4b6c6e`（已写入 `project.config.json`）。
2. 详情 → 本地设置：勾选 **不校验合法域名、web-view、TLS、HTTPS 证书**。
3. 点顶部 **预览**，用微信扫码（预览码）。
4. 要点 **上传** 后，到 [公众平台](https://mp.weixin.qq.com/) → 管理 → 版本管理 → 选为体验版，即可下载体验版二维码；测试微信号须先加为体验者。

开发开关（仅本地）：`.env` 中 `MOCK_WX=true`、`MOCK_PAY=true`。模拟微信授权登录会固定同一设备 openid，并可用「开发模拟授权」跳过真机手机号组件。正式上线必须关闭 `MOCK_WX` / `MOCK_PAY`，填写 `WX_APPID`、`WX_SECRET`，并配置微信支付商户号与回调 `POST /api/pay/wechat/notify`。小程序须在公众平台开通「手机号」权限，开发者工具勾选不校验合法域名。

```bash
# 库存并发单测（走测试库 variety_shop_test，1 件库存两单仅一单成功）
npm run test:server
# 管理端生产构建（须在 Node 16.17.0）
cd admin && npm run build
```

## 已实现范围

- 管理端：登录、工作台、分类/商品、订单履约（备货/核销/配送）、轮播、推荐位、热度/漏斗报表、店铺设置、改密
- 小程序：首页推荐、分类综合排序、搜索、详情、购物车、下单、模拟支付、提货码、地址、P0 埋点
- 服务端：库存条件更新、待付款超时关单、支付成功计销售、事件落库、热度日批、推荐位 PIN_THEN_HEAT

已包含营销扩展：优惠券、限时特价、积分、库存预警、备货订阅记录、拼团、秒杀、个性化推荐、详情关联、购物车凑单。

尚未包含（M6 置后）：正式微信支付证书、微信审核与合法域名、真实微信订阅消息模板下发。

已有库追加表结构可执行 `scripts/s9_p2.sql`，或重新 `npm run migrate && npm run seed`。

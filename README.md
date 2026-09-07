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
| 服务端 | Node.js 16.17.0 + Express 4 + knex + MariaDB/MySQL |
| 金额 | 整数分；订单预占库存；购买率以支付回调为准 |

## 本地启动

需要 **Node.js 16.17.0** 与 **MySQL/MariaDB**。

```bash
nvm use 16.17.0   # 或安装后使用仓库根目录 .nvmrc
cp .env.example .env
# 按 .env 创建库 variety_shop 与用户

cd server && npm install && npm run migrate && npm run seed && npm run dev
# 另开终端
cd admin && npm install && npm run dev
```

- API：http://127.0.0.1:3000（健康检查 `/api/health`）
- 管理后台：http://127.0.0.1:5173 ，默认账号 `admin` / `admin123`
- 小程序：用微信开发者工具导入 `miniprogram/` 目录。真机预览请把 `miniprogram/utils/config.ts` 的 `API_BASE` 改成电脑局域网 IP。

开发开关（仅本地）：`.env` 中 `MOCK_WX=true`、`MOCK_PAY=true`，可走模拟登录与模拟支付。正式上线必须关闭，并配置微信支付商户号与回调 `POST /api/pay/wechat/notify`。

```bash
# 库存并发单测（1 件库存两单仅一单成功）
cd server && npm test
# 管理端生产构建（须在 Node 16.17.0）
cd admin && npm run build
```

## 已实现范围

- 管理端：登录、工作台、分类/商品、订单履约（备货/核销/配送）、轮播、推荐位、热度/漏斗报表、店铺设置、改密
- 小程序：首页推荐、分类综合排序、搜索、详情、购物车、下单、模拟支付、提货码、地址、P0 埋点
- 服务端：库存条件更新、待付款超时关单、支付成功计销售、事件落库、热度日批、推荐位 PIN_THEN_HEAT

尚未包含（需店主资质或列入 R2 后置）：正式微信支付证书、微信审核与合法域名、订阅消息、优惠券/积分。

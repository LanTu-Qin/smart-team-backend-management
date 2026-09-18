# 智队搭 · 赛事组队管理后台（Web 管理端）

> 「智队搭」微信小程序（微信云开发）的 **Web 管理端**：负责赛事内容运营、用户与队伍数据核查、技能字典维护与权限授予，与 C 端小程序**共用同一份云数据库**。

## 功能模块

| 模块 | 能力 |
|---|---|
| 数据看板 | 用户 / 队伍 / 赛事总量、报名中赛事、匹配中用户与队伍；赛事按 `level` / `status` / `type` 分布、队伍按赛事分布——**全部为真实可算指标**，无虚构数据 |
| 用户管理 | 按姓名 / 学号搜索（服务端分页）；**身份与权限分离**（`role` 只做展示，`isAdmin` 才是权限开关）；邮箱仅详情接口下发（列表脱敏） |
| 队伍管理 | 按赛事筛选；队长 / 成员 / 指导老师；准入限制（无需审核 / 需审核 / 仅邀请）；匹配池状态；删除联动清理成员引用 |
| 赛事管理 | 真实枚举（`level` 六档 / `type` 三档含混合类型 / `status` 三态）；**AI 生成赛事简介与含金量**（10~25s 慢接口：行级 loading + 可重试，不锁整页） |
| 技能字典 | 全表 + 本地搜索、**使用情况统计**（一次扫描聚合出的引用计数）、增 / 改 / 删（删除由服务端做 **4 处引用检查**，有引用则拦截，不级联） |

## 技术栈

Vue 3（`<script setup>`）· Vite · Vue Router · Pinia · Element Plus（中文 locale）· ECharts / vue-echarts · lucide-vue-next
纯 JavaScript（无 TypeScript、无构建期类型检查）

## 快速开始

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
```

**演示账号**（当前为 Tier-1 模拟数据）：

| 账号 | 密码 | 身份 |
|---|---|---|
| `admin` | `admin123` | 管理员（`role=admin`，`isAdmin=true`） |
| `demo` | `123456` | **教师身份 + 管理员权限**（演示 `role` 与 `isAdmin` 解耦） |

> 数据全部来自 `src/api/mock/`，为模拟数据。浏览器控制台执行 `__resetMockDb()` 可恢复初始数据。

## 部署到云开发静态网站托管

```sh
npm run build            # 生成 dist/
# 云开发控制台 → 静态网站托管 → 上传 dist/ 目录（或使用 CLI 部署）
```

三个必须知道的点：

1. **免备案**：直接用静态托管的**默认域名**即可访问，无需备案（绑定自定义域名才需要）。
   ⚠️ 但默认域名**有访问限制，且首次访问可能出现腾讯云的"中间提示页"** —— 演示前自己先完整点一遍，别在现场被这个页面卡住。
2. **⚠️ SPA 路由回退（最容易踩的坑）**：本项目用 `createWebHistory`，直接访问 / 刷新 `/users` 这类子路径时，静态服务器找不到对应文件会 **404**。
   需要在托管配置里把**错误文档（404）也指向 `index.html`**，实现前端路由回退；否则改用 hash 模式（`createWebHashHistory`）。
   > 这正是本项目一直在讲的那件事：**能被"直接进入"的 URL（刷新 / 分享 / 收藏）必须能自己恢复到正确页面**。
3. **前端环境变量**：Tier-2 接真实后端时，在 `.env.production` 配置 `VITE_API_BASE`（云函数 HTTP 触发域名 / 网关地址）。

## 架构分层

```
页面        src/views/*.vue        ← 只负责展示与交互
  ↓
状态层      src/stores/*.js        ← 只存「服务端返回的当前状态」+ 编排请求
  ↓
接口层      src/api/*.js           ← 与接口契约一一对应（auth/dashboard/users/teams/competitions/skills）
  ↓
请求插槽    src/api/client.js      ← Tier-1: mockApi ｜ Tier-2: axios 实例 + 拦截器
  ↓
假后端      src/api/mock/db.js     ← 扮演云端 6 个集合（真实字段与真实存储形态）
```

**三条硬约定**（详见 `docs/api.md`）：

1. **契约先行**——所有接口先写进 `docs/api.md`（字段、错误码、权限、后端待办），页面按契约开发；
2. **契约 ≠ 数据库行**——接口返回扁平 DTO，映射在服务端完成（`user.userInfo.uid` → `uid`；`teams.members{uid: skillId}` → 数组并回填用户名）；
3. **store 的 action 与契约一一对应**——契约里没有的能力（例如管理端「新增用户」），界面上也不给入口。

## 数据来源（两档可切换）

| 档位 | 现状 | 切换方式 |
|---|---|---|
| **Tier-1（当前）** | mock 顶班：`api/mock/db.js` 扮演后端，含延迟、分页、脱敏、引用检查、写回持久化 | 默认启用 |
| **Tier-2** | 接真实微信云开发：页面走云函数 HTTP 触发 / Web SDK，REST 请求由网关翻译成 `{action, params}` | 只改 `api/*.js` 的函数体与 `VITE_API_BASE`，**页面与 store 零改动** |

> **认证方案待定**（Tier-2 的前置）：Web 端没有微信 `OPENID`，而云函数的 `ensureAdmin()` 依赖 OPENID。
> 当前在两条路线间选型：① 静态托管 + CloudBase Web SDK 自定义登录（用平台登录态，前端不手写 header）；
> ② 云函数 HTTP 触发 + 自签 token（`Authorization: Bearer`，自研签名/过期/强制下线）。

## 目录结构

```
src/
├─ api/            接口层：client.js（请求插槽）+ mock/db.js（假后端）+ 6 个资源模块
├─ stores/         Pinia：auth / dashboard / users / teams / competitions / skills
├─ views/          6 个页面：登录 / 看板 / 用户 / 队伍 / 赛事 / 技能字典（+ 404）
├─ layouts/        AdminLayout：响应式侧栏（≤1024px 变抽屉）+ 顶栏
├─ router/         路由 + 登录守卫（含 `/auth/me` 会话校验，权限被撤销即刻失效）
├─ composables/    toast 等轻封装
└─ styles/         设计令牌（CSS 变量）+ Element Plus 主题覆盖
docs/api.md        接口契约（当前 v0.1.16）
```

## 配套项目（小程序端）

C 端小程序提供学生 / 教师的注册、技能维护、赛事浏览、组队申请与匹配能力，后端为微信云开发：**6 个集合**
（`user` / `teams` / `competition` / `skills` / `requests` / `matching_pool`）与 **7 个云函数**
（`competitionApi` / `userApi` / `teamsApi` / `skillApi` / `requestApi` / `matching_poolApi` / `getFileUrl`，含 AI 生成赛事简介与 AI 技能评级）。

本管理端**复用其云函数能力**（如 `competitionApi.getPage` / `skillApi.getAll`），两端共用同一份数据库与同一套业务规则。

## 真后端对接进度

契约第 8 节维护着完整清单，当前状态：**已完成 12 条**（分页 / 详情 / 白名单 / 写操作权限矩阵 / 三处越权修复 / DTO 拍平与脱敏 / `usage` 聚合 / 旧函数下线 / AI 参数来源 …），**待做 2 条**（管理端登录体系、看板聚合统计）、**待决策 2 项**（AI 网关超时值、图片上传通道）。

值得单独说的两处工程实践：

- **`usage` 一次扫描聚合**：技能字典的引用计数由"扫 `user` 一次 + `teams` 一次后按 `sid` 归并"得出（**2 次查询**），而不是按技能逐个扫集合（25 个技能 × 4 处 ≈ 100 次查询）；
- **删除的引用检查**：文档型数据库没有外键，技能被 `user.skills` / `user.skill_rating` / `teams.team_needs` / `teams.team_missing` 引用时删除会产生**悬空引用**——服务端一律**拦截**而非级联（级联是破坏性的，不替管理员做主）。

## 现状与边界（诚实说明）

- 数据为 **Tier-1 模拟数据**；真后端已完成大部分契约项，但**管理端登录体系尚未实现**（认证方案选型中），因此尚未联调真实数据；
- 项目**未引入 TypeScript 与自动化测试**（作品集阶段的取舍）；
- 后端仍有两项待决策（AI 慢接口的网关超时值、图片上传通道走 base64 还是前端直传云存储），以及若干"可选优化"（`getAll`/`getByCid` 剔 `_id`、`getFileUrl` 增加归属校验）记录在契约附录。

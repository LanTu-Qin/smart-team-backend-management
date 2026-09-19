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

npm run dev          # http://localhost:5173   ← Tier-1 mock，无需任何云环境
npm run dev:cloud    # 同上，但连真实云开发环境（读 .env.cloud）

npm run build        # 产物在 dist/            ← mock 版
npm run build:cloud  # 产物在 dist/            ← 真后端版（部署用这个）
```

**两种运行模式**（构建期开关，见 `.env` / `.env.cloud`）：

| 模式 | 命令 | 数据来源 | 依赖 |
|---|---|---|---|
| **mock（默认）** | `dev` / `build` | `src/api/mock/db.js` 扮演后端：含延迟、分页、脱敏、引用检查、写回持久化 | 无（静态站直接能跑） |
| **真后端** | `dev:cloud` / `build:cloud` | 微信云开发云函数（`callFunction`）+ 线上 6 个集合 | 需配好 `ADMIN_TOKEN_SECRET` 与云函数安全规则（见下） |

> 两种模式的**函数签名完全一致**，切换只改 `.env` 的一行 → 页面与 store 零改动。
> ⚠️ Vite 的环境变量是**构建期替换**：改完必须重启 dev / 重新构建，运行时改无效。

**演示账号**：

| 模式 | 账号 | 密码 | 说明 |
|---|---|---|---|
| mock | `admin` | `admin123` | 管理员（`role=admin`，`isAdmin=true`） |
| mock | `demo` | *（无）* | 演示「首次设置密码」流程：登录会提示 `-2`，设置后直接进入 |
| 真后端 | 工号（如 `10001`）或姓名 | 由本人在登录页首次设置 | 账号 = `userInfo.uid` 或 `userInfo.username`，且 `isAdmin=true` |

> mock 数据全部来自 `src/api/mock/`；浏览器控制台执行 `__resetMockDb()` 可恢复初始数据。

### 真后端上线检查表（缺一项就会出现"登录成功但接口 403"）

1. **云函数环境变量**：`adminAuth` / `competitionApi` / `userApi` / `teamsApi` / `skillApi` 五个函数都配 `ADMIN_TOKEN_SECRET`，**值必须一致**（不一致的典型症状：登录成功、业务接口恒 `-403`）。
2. **云函数安全规则**：默认规则禁止匿名调用（Web 端会得到 `[PERMISSION_DENIED]`）→ 为上述 5 个函数单独放行 `{"invoke":"auth != null"}`，同时**保留 `*` 的严格规则**（不影响小程序端）。
3. **依赖上传**：`adminAuth` 依赖 `bcryptjs`，部署时需上传并安装依赖。
4. **构建与部署**：`npm run build:cloud` → 把 `dist` 内容上传到部署路径 `/`。
5. **首登**：用 `isAdmin=true` 的工号登录 → 出现「设置管理端密码」→ 设置后进入（服务端不允许预置弱默认密码）。

### 部署后的逐项验证（真后端模式）

在**实际部署的域名**上打开（本地 `localhost` 若被安全域名白名单拦住，就直接在线上验）：

| # | 操作 | 期望结果 | 失败时先看 |
|---|---|---|---|
| 1 | 打开站点 → 登录页 | 页脚显示「已接入微信云开发真实环境」 | `.env.cloud` 是否生效（要重新 build） |
| 2 | 用工号 + 密码登录 | 进入看板，右上角显示真实姓名 | 浏览器控制台：`[PERMISSION_DENIED]` → 云函数 invoke 规则；`-2` → 还没设密码 |
| 3 | 刷新页面 | 不掉登录（`/auth/me` 校验通过） | token 是否写进 localStorage（`stb-auth`） |
| 4 | 用户管理 | 9 条真实用户、头像为首字母、搜索/分页可用 | 该函数 `userApi` 的 invoke 规则 |
| 5 | 技能字典 | 真实技能 + 「使用情况」列有引用计数 | `skillApi` 规则；`usage` 缺失会显示 0 |
| 6 | 赛事管理 | 60 条真实赛事、keyword/status 筛选可用 | `competitionApi` 规则 |
| 7 | 赛事里点「AI 生成」 | 10~25 秒后 content 出现（**不要以为卡死**） | 超时设置（SDK 已设 35s）；AI Key 是否配在云函数环境变量 |
| 8 | 队伍管理 | 队伍列表、成员姓名/技能名正常显示、详情弹窗正常 | `teamsApi` 规则；`getBatchUids` 是否传了数字数组 |
| 9 | 顶部「修改密码」 | 提示"其它设备上的登录已失效"，本机继续可用 | 旧 token 应失效（`adminTokenVersion`） |
| 10 | 队伍删除 | 二次确认后列表少一条，成员 `tid_list` 同步清理 | 该 action 走 adminToken 通道，失败会显示 `-403` |


## 部署到云开发静态网站托管

部署在**应用根目录**（`base: '/'`）：云开发为每个应用分配独立域名（形如 `<app>-<env>.webapps.tcloudbase.com`），**该域名本身就是站点根**，内部前缀对 URL 不可见。

```sh
npm run build:cloud   # 真后端版：生成 dist/（资源引用为 /assets/...，并注入云环境 ID）
# 控制台 → 静态网站托管 → 上传：选择 dist **里面的内容**（assets/、favicon.ico、index.html）
# 部署路径填：/
```

访问地址：`https://<你的应用域名>/`

> 踩坑记录：曾把 `base` 配成 `/smart-team-backend-management/`，URL 里也带上同名子路径，
> 结果被解析成 `smart-team-backend-management//smart-team-backend-management/index.html` → **NoSuchKey**。
> 结论：**这个托管方式下没有子路径可配**，`base` 就是 `/`。

### 五个必须知道的点（第 5 条是踩坑记录）

1. **`base` 必须是 `/`**：只有把站点挂在**域名下的子路径**（如自建 Nginx 的 `/admin/`）时才需要改成 `'/admin/'`（且必须绝对路径 + 结尾带 `/` —— 相对路径在 history 模式的深层路由下会 404）。
   Vue Router 写成 `createWebHistory(import.meta.env.BASE_URL)`，会**自动跟随** `base`，无需另行配置。
2. **免备案**：用静态托管**默认域名**即可访问（绑定自定义域名才需要备案）。
   ⚠️ 默认域名**有访问限制、且首次访问可能出现腾讯云的"中间提示页"** —— 演示前自己完整点一遍，别在现场被它卡住。
3. **⚠️ SPA 路由回退（最容易踩的坑）**：`createWebHistory` 下，直接访问或刷新 `/users` 会 **404**。
   需要把托管配置里的**错误文档（404）指向 `index.html`**。
   ⚠️ 错误文档是**环境级**配置：若同一环境还托管了别的项目会互相串 → 给本项目单独一个环境，或改用 hash 模式（`createWebHashHistory`）。
   > 这正是本项目反复强调的那件事：**能被"直接进入"的 URL（刷新 / 分享 / 收藏）必须能自己恢复到正确页面。**
4. **前端环境变量**：静态托管没有"运行时环境变量"。Vite 的变量是**构建期**注入（`npm run build` 时就被替换成字面量），所以改完必须**重新构建 + 重新上传**，在控制台改是无效的。
   - 真后端模式读 `.env.cloud`：`VITE_API_MODE=cloud`、`VITE_CLOUD_ENV`（环境 ID）、`VITE_CLOUD_REGION`；
   - 环境 ID 与地域**不是密钥**（它们必然出现在前端产物里），可以提交；**真正的密钥只放在云函数环境变量**（`ADMIN_TOKEN_SECRET` / `AI_API_KEY`）；
   - ⚠️ 凡 `VITE_` 开头的变量都会被打进浏览器代码（等于公开）——**绝不能放密钥**。
5. **部署流程：本地构建 + 上传 `dist`（不要依赖平台 CI 构建）** —— 踩坑记录
   平台构建镜像是 **Node 18.20.8**，而本项目要求 ≥ 22.18（Vite 8 + `vue: "rc"`）→ 平台侧构建必然失败：
   日志会出现 `执行自定义安装命令: npm install` → `ENOENT: package.json`（把**纯静态产物**当 Node 项目去构建）。
   正确姿势：本地 `npm run build:cloud` → 把 `dist` 里的内容上传到部署路径 `/`；
   并保证**只有一个部署来源**（若还留着 Git/ZIP 的 CI 部署，它会把手动部署覆盖掉）。

## 架构分层

```
页面        src/views/*.vue        ← 只负责展示与交互
  ↓
状态层      src/stores/*.js        ← 只存「服务端返回的当前状态」+ 编排请求
  ↓
接口层      src/api/*.js           ← 与接口契约一一对应（auth/dashboard/users/teams/competitions/skills）
  ↓
请求插槽    src/api/client.js      ← mockApi（Tier-1）｜ callCloud（真后端：SDK 匿名登录 + 带 adminToken）
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
| **Tier-1（默认）** | mock 顶班：`api/mock/db.js` 扮演后端，含延迟、分页、脱敏、引用检查、写回持久化 | 默认启用（`npm run dev`） |
| **Tier-2（已接通）** | 真实微信云开发：**CloudBase Web SDK 作传输**（`signInAnonymously` + `callFunction`），请求体 `{ action, params, adminToken }` | `npm run dev:cloud` / `build:cloud` |

> **认证方案（已实现，详见契约 §2）**：Web 端没有微信 `OPENID`，因此云函数的 `ensureAdmin(event)` 为**双通道**——
> ① 小程序端仍按 `OPENID` 判定；② Web 管理端验签**自研 `adminToken`**（HMAC-SHA256，payload `{uid, v, exp}`，7 天有效；
> `adminTokenVersion` 支持**改密即强制下线**；每次请求**重读 `isAdmin`**，撤销权限当场生效）。
> 传输层用 **CloudBase Web SDK**（`signInAnonymously()` 仅为满足调用前提，**匿名登录 ≠ 管理员**，走平台内部通道 → **无需配置跨域**）。
> token 只在 `client.js` 一处携带（`setAuthToken`），各接口模块与页面都不知道 token 长什么样。

## 目录结构

```
src/
├─ api/            接口层：client.js（请求插槽：mockApi / callCloud）+ mock/db.js（假后端）+ 6 个资源模块
├─ stores/         Pinia：auth / dashboard / users / teams / competitions / skills
├─ views/          6 个页面：登录 / 看板 / 用户 / 队伍 / 赛事 / 技能字典（+ 404）
├─ layouts/        AdminLayout：响应式侧栏（≤1024px 变抽屉）+ 顶栏（含修改密码）
├─ router/         路由 + 登录守卫（含 `/auth/me` 会话校验，权限被撤销即刻失效）
├─ composables/    toast 等轻封装
└─ styles/         设计令牌（CSS 变量）+ Element Plus 主题覆盖
.env               默认 mock 模式
.env.cloud         真后端模式（云环境 ID + 地域）
docs/api.md        接口契约（当前 v0.1.17）
```

## 配套项目（小程序端）

C 端小程序提供学生 / 教师的注册、技能维护、赛事浏览、组队申请与匹配能力，后端为微信云开发：**6 个集合**
（`user` / `teams` / `competition` / `skills` / `requests` / `matching_pool`）与 **8 个云函数**
（`competitionApi` / `userApi` / `teamsApi` / `skillApi` / `requestApi` / `matching_poolApi` / `getFileUrl` / `adminAuth`）。

本管理端**复用其云函数能力**（如 `competitionApi.getPage` / `skillApi.getAll` / `adminAuth.login`），两端共用同一份数据库与同一套业务规则。

## 真后端对接进度

契约第 8 节维护着完整清单，当前状态：**已完成 13 条**（管理端登录体系 / 分页 / 详情 / 白名单 / 写操作权限矩阵 / 三处越权修复 / DTO 拍平与脱敏 / `usage` 聚合 / 旧函数下线 / AI 参数来源 …），**待做 1 条**（看板聚合统计）、**待整改 2 条**（`requestApi` 写操作缺鉴权、`skill_rating` 值类型不一致）、**待决策 2 项**（AI 网关超时值、图片上传通道）。

值得单独说的四处工程实践：

- **自研 HMAC token，而不是引入 jsonwebtoken**：payload 明文（base64url 谁都能解）+ 签名保证不可篡改，`crypto.timingSafeEqual` 防时序攻击，**零第三方依赖**——自己实现才好把原理讲清楚；
- **改密即强制下线**：`adminTokenVersion +1` 让该管理员的所有旧 token 当场失效（本机换新 token 继续用），不需要服务端会话表；
- **`usage` 一次扫描聚合**：技能字典的引用计数由"扫 `user` 一次 + `teams` 一次后按 `sid` 归并"得出（**2 次查询**），而不是按技能逐个扫集合（25 个技能 × 4 处 ≈ 100 次查询）；
- **删除的引用检查**：文档型数据库没有外键，技能被 `user.skills` / `user.skill_rating` / `teams.team_needs` / `teams.team_missing` 引用时删除会产生**悬空引用**——服务端一律**拦截**而非级联（级联是破坏性的，不替管理员做主）。

## 现状与边界（诚实说明）

- **两端已打通**：管理端登录体系（`adminAuth`）+ 用户 / 技能 / 赛事 / 队伍四个模块的真实读写均已接通线上云开发环境；`npm run dev` 即为纯 mock 演示版，两条路函数签名完全一致；
- **看板是"前端临时聚合"**：`GET /dashboard/overview` 的服务端聚合尚未实现（契约第 8 节第 2 条），真后端模式下由前端并发拉全量再分组（契约口径一致，并带 `partial` 标记）。它 **O(全表)**，数据量上去必须换回服务端一次聚合；
- **队伍页是"只读 + 删除"**：这不是偷懒 —— `teamsApi` 的 `update` / `create` 等写操作第一条就要求小程序身份（`checkTeamPerm`），Web 端无 OPENID 恒 `-401`，只有 `delete` 做了 adminToken 双通道。**管理端因此不提供编辑队伍入口**，而不是给一个必然失败的按钮；
- 赛事海报**不展示**：库里存的是 `cloud://` fileID，需临时链接（会过期），图片通道按契约第 8 节第 7 条**待决策**；
- 项目**未引入 TypeScript 与自动化测试**（作品集阶段的取舍）；
- 头像统一使用**姓名/队名首字母头像**：用户 `avatar` 是 `cloud://` fileID（临时链接会过期），`teams` 集合**没有头像字段**——不为展示凭空造字段。

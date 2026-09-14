# 智队搭 Web 管理端 — REST API 契约 v0.1（草案）

> 本文档是 Web 管理端（本仓库 `smart-team-build`）的**接口契约**，也是 Tier-1（mock 顶班）与 Tier-2（接真后端）的共用施工图纸。
> 数据模型依据：`云函数API.md`（8 云函数 / ~51 action，2026-08-29 第 3 版）+ `数据库字段.md`（6 集合，2026-08-26 版），两文档在 `E:\文档\竞赛相关\docs`（`.docx` 与 `.md` 内容一致，仅导出时间不同）。
> 通道未定：云函数 HTTP 触发 / CloudBase Web SDK 直连。**契约与通道解耦，换通道不改本文档的 URL 与字段。**

---

## 0. 设计原则（先读这段）

1. **契约 ≠ 数据库行**：接口返回的是"视图模型"（DTO），字段已按管理端需要扁平化；数据库里的嵌套（如 `userInfo.uid`）、映射差异由后端/网关消化，前端只认本文档字段。
2. **写操作默认危险**：所有写操作直接作用于**生产库**（智队搭真实数据）。Tier-2 联调必须使用测试环境/克隆集合，禁止拿线上数据练手。
3. **标 `[后端新增]` 的接口**：现云函数**没有**该能力，需要新增 action 或改造。前端可先按契约开发，Tier-2 按第 8 节清单补齐后端。
4. **标 `[核对]` 的字段**：两份文档对该字段说法不一致或取值未穷举，真实联调时确认。

---

## 1. 通用约定

### 1.1 Base URL 与路由前缀

| 环境 | Base URL |
|---|---|
| Tier-1 mock | `/api/v1`（vite mock 拦截，同源） |
| Tier-2 真后端 | `https://<env>.xxx`（待定，放 `import.meta.env.VITE_API_BASE`） |

统一前缀：`/api/v1`

### 1.2 认证（占位）[后端新增]

- 请求头：`Authorization: Bearer <token>`
- 未携带 / 失效 → `HTTP 401`
- 携带但非管理员 → `HTTP 403`，body `{code:-403, message:'无管理员权限'}`（对齐云函数 `ensureAdmin()` 语义）
- 说明：小程序端管理员靠微信 `OPENID` 识别（`user.isAdmin===true`）；**网页端没有 OPENID**，管理端登录体系需独立设计（见第 8 节）。
- 本管理端除 `/auth/*` 外，**所有接口均要求管理员身份**。

### 1.3 统一响应封装

**成功**：`HTTP 200` + body `{ code: 0, message: 'ok', data: ... }`

**错误分层**：
| 层 | HTTP 状态 | body.code | 场景 |
|---|---|---|---|
| 参数/格式错误 | 400 | 400 | 缺参、类型错、枚举非法 |
| 未认证 | 401 | 401 | token 缺失/过期（前端拦截器 → 登出跳转） |
| 无权限 | 403 | -403 | 非管理员调用管理接口 |
| 资源不存在 | 404 | -404 | cid/tid/uid 查无 |
| 业务规则失败 | 200 | -1 / 1 / 2 / 3 | 沿用云函数业务码（见 1.4），前端按 code 分支 toast |
| 服务器异常 | 500 | -500 | 带 `message` 详情 |

**业务码语义（对齐 `云函数API.md`）**：
| code | 语义 | 典型 message |
|---|---|---|
| -1 | 校验失败：不存在 / 重复 / 已满 / 已达上限 | `队伍不存在`、`重复创建` |
| 1 | 队伍不存在 / 格式错误 | — |
| 2 | 业务拦截：重复参赛 / 已满员 / 已在队 / **赛事已结束** | `赛事已结束，无法发布队伍` |
| 3 | 达同时参赛 5 场上限 | `同时参赛不能超过5场` |
| -403 | 无管理员权限 | `无管理员权限` |
| -500 | 服务器异常 | `userService.xxx is not a function` |

### 1.4 分页约定

请求：`?page=1&pageSize=20`（page 从 1 起，pageSize 上限 100）
响应 `data` 统一为：

```json
{ "list": [], "total": 0, "page": 1, "pageSize": 20 }
```

> 现云函数多为全量返回（`getAll`）或无分页（`searchUsers` ≤20 条），分页/搜索/筛选能力见第 8 节 `[后端新增]`。

### 1.5 其他约定

- 请求/响应均 `application/json; charset=utf-8`
- 日期：`YYYY-MM-DD`；时间戳：ISO8601
- **脱敏**：列表接口不下发 `email`（现 `getBatchUids`/`searchUsers` 已脱敏）；`phone` 永不下发
- **慢接口**：AI 类接口真实耗时 10~25s，**HTTP 网关超时已设为 30s**（余量偏紧，见第 10 节）；前端 axios 超时与之对齐（建议 35s，**不要设得更长**——否则网关先断，用户白等），UI 必须有独立 loading 与失败重试提示

---

## 2. 认证（占位，全部 [后端新增]）

| Method | Path | 说明 |
|---|---|---|
| POST | `/auth/login` | 管理端登录（账号体系待设计，如预置管理员账号 + 密码哈希，或工号绑定） |
| POST | `/auth/logout` | 注销 |
| GET | `/auth/me` | 当前登录管理员 `{uid, username, isAdmin}` |

登录成功返回 `{ token, user: {uid, username, isAdmin} }`，前端存入 store（替代现 mock `stb-auth`）。

---

## 3. Dashboard 统计（[后端新增]，数据可算性见字段备注）

### GET `/dashboard/overview`

| 字段 | 类型 | 数据来源 |
|---|---|---|
| `userTotal` | number | user 集合计数 |
| `teamTotal` | number | teams 集合计数 |
| `compTotal` | number | competition 集合计数 |
| `openCompCount` | number | competition `status='报名中'` 计数 |
| `matchingUsers` | number | user `is_matching=true` 计数 |
| `matchingTeams` | number | teams `is_matching=true` 计数 |
| `distByLevel` | [{name,value}] | competition 按 `level` 分组（**真实取值**：国A 37 / 国B 11 / 省B 11 / 国C 1，样本 60 条）（饼图） |
| `distByStatus` | [{name,value}] | competition 按 `status` 分组（已结束 44 / 报名中 9 / 未开始 7）（饼图或堆叠条） |
| `distByType` | [{name,value}] | competition 按 `type` 分组（团体 43 / 个人·团体 10 / 个人 7） |
| `teamsPerComp` | [{cid,name,value}] | teams 按 `cid_list` 计数前 N（柱状图，可算：遍历队伍展开 cid） |
| ~~`trend`~~ | — | **不做**：user/teams 没有 `createdAt` 字段，硬补会得到一条历史断裂的假曲线（见第 10 节第 6 条） |

响应示例：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "userTotal": 1280, "teamTotal": 356, "compTotal": 24, "openCompCount": 9,
    "matchingUsers": 210, "matchingTeams": 88,
    "distByLevel": [{"name": "国家级", "value": 6}, {"name": "省部级", "value": 12}],
    "teamsPerComp": [{"cid": 1, "name": "蓝桥杯…", "value": 42}],
    "trend": [{"month": "2026-03", "users": 120, "teams": 30}]
  }
}
```

> 现有前端 DashboardView 的"积分/报名数"指标无真实数据来源，改版时按上表字段替换（`registered/quota/rating/points` 均为演示虚构）。
>
> **为什么没有"新增趋势"折线？** 因为原则是"每个数字都要能回答它从哪来"——`createdAt` 字段不存在，历史无法追溯。**宁可不做，也不画假曲线。** 将来真需要时的正解是：从现在开始写入 `createdAt` 并往后累积，而不是回填历史。

---

## 4. 赛事 competition（内容运营核心）

数据集合：`competition`；写操作与 AI 生成服务端校验管理员（已实现 `ensureAdmin`）。

### 视图模型（DTO）

```json
{
  "cid": 1,
  "name": "中国国际“互联网+”大学生创新创业大赛",
  "url": "https://cy.ncss.cn/",
  "level": "国家级",
  "type": "团体",
  "status": "报名中",
  "start": "即日起",
  "end": "2026-12-31",
  "organizer": "教育部",          // [核对] API 接受此字段，字段文档未列出
  "content": "AI 生成的 9 标签简介与含金量",
  "posterUrl": "https://…/poster.jpg",   // 临时链接，非持久
  "hasPoster": true
}
```

- `status` 枚举（**已确认**）：`未开始` / `报名中` / `已结束`（`已结束` 是发布队伍与入池的拦截条件，对齐 `checkCompActive`）
- `level` 枚举（**已确认**，60 条真实赛事统计）：`国A`(37) / `国B`(11) / `省B`(11) / `国C`(1)。因 `省B` 存在，前端下拉建议给全 `国A/国B/国C/省A/省B/省C`；字典化仍建议后续做 [后端新增]
- `type` 枚举（**已确认**）：`团体`(43) / `个人/团体`(10) / `个人`(7) —— 注意存在第三种**混合类型**，UI 不能用二选一单选
- `organizer`：云函数 `create` / `update` 对 `compInfo` 是**整体透传**（无白名单），技术上可写；但真实 60 条数据里 **0 条使用** → v1 不做为必填项（保留为可选透传字段）
- `detailPoster` / `detailImageList`：源码中 `create` 显式初始化为 `'' / []` 并注释「预留 Word 字段」，`delete` 会清理对应云存储文件，`getFileTempUrl` 支持 `fieldType='wordImage'` 取图；真实数据 **0 条非空** → v1 **只读展示，不提供编辑**

### 接口

| Method | Path | 说明 | 对应云函数 action |
|---|---|---|---|
| GET | `/competitions?page&pageSize&keyword&status` | 分页列表（含筛选） | `getAll`（现为全量，分页/筛选 [后端新增]） |
| GET | `/competitions/:cid` | 详情（**仅"独立详情/编辑路由"需要**，见下方说明） | [后端新增]（现无 getByCid；"列表 + 弹窗"形态可直接用列表数据，不需要此接口） |
| POST | `/competitions` | 新建赛事（可带海报 base64） | `create` |
| PATCH | `/competitions/:cid` | 更新赛事（**局部更新**：只合并传进来的字段，未传字段保持不变；新图覆盖旧 poster） | `update` |
| DELETE | `/competitions/:cid` | 删除赛事（联动清理云存储海报/详情图） | `delete` |
| POST | `/competitions/:cid/ai-detail` | AI 生成简介+含金量（**10~25s 慢接口**） | `aiGenDetail` |
| POST | `/competitions/file-urls` | 批量换赛事图片临时链接 | `getFileTempUrl` |

> **为什么详情接口标 `[后端新增]`？** 这取决于**页面形态**，而不是"小程序还是网页"：
> - 「列表页 + 弹窗编辑」（本项目现状）：数据已在内存里，**不需要**单查接口；
> - 「独立详情/编辑路由」`/competitions/:cid`：用户可能**收藏、分享给同事、刷新、新开标签**，一旦刷新内存清空、只剩 URL 里的 `cid`，就必须能凭 id 把数据查回来。
>
> 通用判定规则：**凡是能被"直接进入"的页面（URL / 小程序分享卡片 / 扫码），都必须能凭参数自己取数据。**

**POST/PATCH body（扁平化）**：

```json
{
  "name": "蓝桥杯…", "url": "https://www.lanqiao.cn",
  "level": "国家级", "type": "团体", "status": "未开始",
  "start": "2026-09-01", "end": "2026-12-31",
  "organizer": "工业和信息化部",
  "posterBase64": "纯base64，不带 data:image 前缀，可为空"
}
```

> 映射备注：云函数 `create` 实参结构为 `{ compInfo: {...}, imageBase64: "" }`，契约层的扁平 body 由后端拆装。
>
> **更新语义用 PATCH 而不是 PUT**：PUT 的语义是"整体替换"（没传的字段应被清空），
> 而本接口的实现是"按白名单合并传进来的字段"，属**局部更新**。方法名必须与语义一致，
> 否则前端会误以为"少传一个字段就会被清空"而不敢做局部提交。`cid` 一律取自路由参数，body 里的忽略。

**POST /competitions/:cid/ai-detail body**：`{ "cid": 1 }` —— **前端只传 cid**：`name` / `url` 由后端从库里取，避免客户端把错误信息塞给模型（云函数侧实参仍需 `{cid, name, url}`）
返回：`{ code:0, data:{ content: "规整后的 9 标签内容" } }`（cid 必须为数字）

> **实现要点（别踩坑）**：
> 1. 本接口**复用小程序既有的云函数能力**（`competitionApi.aiGenDetail`），**不另写一套 AI 逻辑**。
>    理由：同一份 `content` 字段由 C 端与管理端共同写入，生成逻辑（prompt + `normalizeAiContent`
>    格式规整）必须唯一，否则两端产出的内容格式会分叉，数据变脏。
> 2. **鉴权落差**：云函数的 `ensureAdmin()` 依赖 **OPENID**，而 Web 端没有 OPENID ——
>    Tier-2 必须由 HTTP 网关 / 云接入层完成管理端身份校验后再转发，否则该接口会被 `-403` 拦死
>    （见第 8 节第 1 条）。
> 3. **API Key 绝不出现在前端**：讯飞 MaaS 的 Key 只存在于云函数环境变量中（现为源码硬编码，
>    属待整改项）。前端一旦持有 Key = 向每个打开网页的人公开 Key。
> 4. 批量生成**不需要新接口**：前端串行调用本接口即为"编排"（云函数只有单个 `aiGenDetail`）；
>    若将来做成服务端批量任务，才需要新增 action（第 8 节）。
> 5. Tier-1 mock：返回模板化的 9 标签内容 + 12s 延迟即可，**不需要 Key，也不需要云函数就绪**；
>    但 mock 的**输出口径必须与真实 prompt 的约束一致**——真实 prompt 禁止编造奖金 / 保研加分等
>    具体数字，mock 样例里也不要出现（否则演示时展示的是真后端永远不会产出的内容）。

---

## 5. 用户 user（含权限管理）

数据集合：`user`。

### 视图模型（DTO）

```json
{
  "uid": 10001,               // 学号/工号，number；存储位置 = userInfo.uid（云函数API 附录B），接口参数平铺传 uid
  "username": "白宫亮",
  "avatar": "cloud://…",
  "email": "a@b.com",         // 仅详情返回，列表脱敏
  "institute": "电信学院",
  "class": "软工2201",        // [核对]
  "introduction": "…",
  "role": "student",          // 身份：student / teacher / admin；权限一律看 isAdmin（两者解耦）
  "isAdmin": false,
  "skills": [1, 2, 3],        // sid 数组
  "skill_rating": {"1": 4},
  "tid_list": [1787669873428],
  "is_matching": false
}
```

> 用户管理页**不做密码/账号体系**（那是小程序注册逻辑），管理端只承担：搜索、查看、授予/撤销管理员。
> **身份与权限分离**：`role` 表示身份类型（student/teacher/admin），`isAdmin` 才是权限开关。所以 `setAdmin` 只改 `isAdmin` 不改 `role`——**新老师可以不改身份就获得后台权限**，这是标准的 RBAC 做法。

### 接口

| Method | Path | 说明 | 对应 action |
|---|---|---|---|
| GET | `/users?keyword&role&page&pageSize` | 用户列表/搜索。keyword=纯数字按 uid 精确，否则用户名模糊，不区分大小写 | `searchUsers`（现 ≤20 条无分页，分页/role 过滤 [后端新增]） |
| GET | `/users/:uid` | 单个用户完整信息（含 email） | `getByUid` |
| GET | `/users/batch?uids=1,2,3` | 批量取精简用户（**无 email**），用于队伍成员名回填 | `getBatchUids` |
| PATCH | `/users/:uid/admin` body `{isAdmin: boolean}` | 授予/撤销管理员（只改 isAdmin，不改 role） | `setAdmin` |
| GET | `/teachers` | 指导老师候选（role=teacher），返回 `{uid, username, avatar, institute}` | `getTeachers` |

**响应示例（列表）**：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "list": [{ "uid": 10001, "username": "白宫亮", "institute": "电信学院", "role": "student", "isAdmin": false }],
    "total": 1, "page": 1, "pageSize": 20
  }
}
```

---

## 6. 队伍 teams

数据集合：`teams`。管理端队伍页定位为**只读 + 删除**（组队/加人/匹配等操作属于 C 端小程序）。

### 视图模型（DTO）

```json
{
  "tid": 1787669873428,
  "name": "挑战者小队",
  "cid_list": [1, 2],
  "leader": { "uid": 10001, "username": "白宫亮" },
  "members": [{ "uid": 10002, "skillId": 3, "username": "张三", "avatar": "cloud://…" }],
  "advisor": [{ "uid": 10003, "username": "李老师" }],
  "isPersonal": false,
  "condition": 0,            // 准入限制（源码确认）：0 无需审核 / 1 需审核 / 2 仅邀请；≠2 才可进匹配池
  "maxNum": 5,
  "team_needs": { "1": 1, "3": 2 },
  "team_missing": { "1": 1 },
  "intro": "目标国赛",
  "is_matching": false
}
```

> `members` 数据库原形是 **对象 `{"uid": skillId}`**；契约层展开为数组并**回填 username/avatar**（回填靠 `GET /users/batch` 联动，前端或后端做皆可）。

### 接口

| Method | Path | 说明 | 对应 action |
|---|---|---|---|
| GET | `/teams?cid&page&pageSize` | 队伍列表（可按赛事 cid 过滤） | `getList` 全量 / `getByCid`；分页 [后端新增] |
| GET | `/teams/:tid` | 队伍详情 | `getByTid` |
| DELETE | `/teams/:tid` | 删除队伍（**联动清理成员 tid_list / onGoing_cid / 匹配池 / 指导老师**，危险操作需二次确认） | `delete` |

> 编辑类能力（改招募需求、条件、赛事列表、移除成员）不纳入管理端 v1；如确需，契约再扩。

---

## 7. 技能字典 skills（附加能力）

数据集合：`skills`（`sid` 自增，`name` + `desc`）。

### 接口

| Method | Path | 说明 | 对应 action |
|---|---|---|---|
| GET | `/skills` | 技能全表 `{sid, name, desc, usage:{users,teams}}`（**不分页**：字典表数据量小，全表下发） | `skill_getAll` |
| POST | `/skills` body `{name}` | 新增技能（sid 自动 max+1）。**`desc` 不可写入**（已确认），要管理描述需后端新增参数 | `skill_add` |
| PATCH | `/skills/:sid` | 改名 / 改描述（局部更新，用 PATCH 不用 PUT） | [后端新增]（现无 update action） |
| DELETE | `/skills/:sid` | 删除技能，**服务端做引用检查**：被引用时返回 `code 2` 拦截（不做级联删除） | [后端新增] |

> **`usage` 由服务端计算**（该 sid 被多少用户 / 多少队伍引用）：列表展示与删除前判断都要用，
> 但前端不该为此拉全量用户与队伍（N+1 / 全表扫描）。
>
> **为什么删除要拦截而不是级联**：文档型数据库**没有外键**，你删掉 sid 后，`user.skills`、
> `teams.team_needs` 里那些 sid 会变成**悬空引用**——页面显示空白、匹配算不出来、AI 拿到不存在的 sid。
> 一致性只能业务层自己守；而级联删除是破坏性操作，不能替管理员做主。

> 新增的"技能字典管理"页即对上面 4 个接口。

---

## 8. 需后端新增能力清单（集中）

Tier-2 按此清单改造/新增云函数，前端契约保持不变：

| # | 能力 | 影响接口 | Tier-1 mock（本仓库） | 真后端（云函数 / 网关） |
|---|---|---|---|---|
| 1 | **管理端登录体系**（账号 + token；网页无 OPENID，不能复用 `ensureAdmin(OPENID)`） | /auth/* | ✅ 已实现（`api/auth.js` + 守卫 `/auth/me` 校验） | ❌ 需新增账号体系与 token 签发 |
| 2 | **Dashboard 聚合统计**（跨集合分组；user/teams 无 `createdAt` → 不做趋势） | /dashboard/overview | ✅ 已实现（`api/dashboard.js`） | ❌ 需新增聚合 action（或网关聚合） |
| 3 | **列表分页 + keyword/status/role 筛选** | /competitions、/users、/teams | ✅ 已实现（服务端式分页） | ❌ 现 `getAll` 全量、`searchUsers` ≤20 无分页 |
| 4 | 赛事详情 `getByCid` | GET /competitions/:cid | ⏸ 暂不需要（"列表 + 弹窗"形态） | 仅在改用独立详情路由时才需要 |
| 5 | 技能字典 `update` / `delete` action（含引用检查） | PATCH、DELETE /skills/:sid | ✅ 已实现（`api/skills.js`，引用检查返回 `code 2`） | ❌ 需新增两个 action |
| 6 | AI 类接口的 HTTP 网关超时 | ai-detail / ai-rate | ✅ mock 12s 延迟 + 可调失败率 | ⚠️ 云端已设 30s（余量仅 5s），建议 60s 或改异步任务 |
| 7 | 图片上传通道：现走云函数内 base64→云存储，大图受限 | POST/PATCH /competitions | ⏸ 未做（mock 无海报） | ❓ 待决策：base64 经云函数 vs Web 直传云存储（临时密钥） |
| 8 | **`compInfo` 字段白名单校验**：现 `create` / `update` 对 `compInfo` 直接 `...compInfo` 整体透传写库，客户端可塞任意字段（甚至覆盖 `poster` / `cid` 等关键字段）→ 后端应改为白名单过滤（安全项） | POST/PATCH /competitions | ✅ 已实现（`EDITABLE_FIELDS` 白名单 + `SERVER_ONLY_FIELDS` 丢弃） | ❌ 云函数需从 `...compInfo` 改为白名单挑选 |

**进度小结**：前端（Tier-1）8 条已全部落地 ✅；**真后端还剩 5 件要做**（1 / 2 / 3 / 5 / 8），
另有 2 个待决策项（6 的超时值、7 的上传通道）。

---

## 9. 现有 mock 页面 ↔ 真实数据模型差异对照（Tier-1 mock 改造点）

> 当前页面/AI 演示数据里有一批**真实产品中不存在的虚构字段**，Tier-1 重构 mock 时必须替换，否则 Tier-2 对不上。

| 模块 | 现 mock 字段（虚构） | 真实字段（本文档 DTO） | 页面影响 |
|---|---|---|---|
| 用户 | `id/name/rating`、role=`organizer/player`、status=`active/disabled` | `uid/username`、role=`student/teacher/admin`、`isAdmin`、skills、无"禁用"概念 | 表格列重写：去掉积分/状态开关，加学院/技能/管理员开关 |
| 队伍 | `captain`（姓名）、`members`（姓名数组）、`category`、`points`、`frozen` | `leader/members`（uid+skillId）、`cid_list`、`condition`、`team_needs/missing`、`maxNum`、`isPersonal` | 表格列重写：队长/成员显示需 uid→用户名回填；筛选维度改"按赛事" |
| 赛事 | `title/host/registered/quota`、status=`ongoing/upcoming/finished`、type=`编程竞赛/黑客马拉松` | `name/url`、`level`=国A/国B/国C/省B、status=`未开始/报名中/已结束`、type=`团体/个人/个人·团体`、`content(AI)`、海报 | 表单字段与状态下拉全换；`type` 是三选一（含混合类型）；AI 生成详情按钮对应真实 action |
| 登录 | 写死的 admin/demo 账号 | /auth/* [后端新增]，token 化 | 登录表单逻辑保留，账号来源换后端 |
| 看板 | 积分/报名数等虚构统计 | 第 3 节可算字段 | 统计卡与图表数据源全换 |
| 技能 | 无（页面还没有） | skills 字典（sid/name/desc） | 新增页面 |

---

## 10. 未决问题（核对点清单）

1. ~~`uid` 存顶层还是 `userInfo.uid`？~~ **已定论**：存储位置为 `userInfo.uid`（依据 `云函数API` 附录B，8/29 版），接口参数平铺传 `uid`，映射由后端负责；联调时实测一次即可。
2. ~~`role` 枚举？~~ **基本定论**：`student` / `teacher` / `admin`（`updateProfile` 参数与 `addAdvisor` 的 role=teacher 校验可证）；`数据库字段.md` 的 `admin/user` 属 8/26 旧版，联调时确认是否还有遗留值。
3. ~~`competition.level` / `type` 完整取值？~~ **已确认**（60 条真实赛事统计）：`level` = 国A/国B/国C/省B；`type` = 团体/个人/个人·团体；`status` = 未开始/报名中/已结束。注意取值来自数据快照，**枚举以取值集合为准、可增补**。
4. ~~`organizer`、`detailImageList` 是否纳入 v1？~~ **已确认（源码 + 数据）**：`compInfo` 整体透传故 `organizer` 可写，但真实数据 0 条使用 → v1 非必填；`detailImageList` 是「预留 Word 字段」（`create` 初始化为 `[]`），真实数据 0 条非空 → v1 只读不编辑。
5. ~~`teams.condition` 0 与 1 的业务语义？~~ **已确认（源码）**：`0` 无需审核 / `1` 需审核 / `2` 仅邀请（`≠2` 才可进匹配池）。注意它是**准入限制**，不是队伍状态码——`数据库字段.md` 的"团队状态码"是模糊说法。
6. ~~user/teams 无 `createdAt`：趋势图数据源？~~ **已定（改设计）**：**放弃趋势图**，Dashboard 改用第 3 节的可算维度（赛事按 level/status/type 分布、队伍按赛事分布、匹配中数量）。
7. ~~`desc` 经 `skill_add` 是否可写入？~~ **已确认**：不可写入（只接收 `name`），管理 `desc` 需后端新增。
8. ~~AI 慢接口网关超时与计费风险？~~ **已确认**：网关 30s、余额充足；但 25s 上限对 30s 网关**余量仅 5s**，建议放大到 60s 或异步化。

---

---

## 11. 变更记录

| 版本 | 变更 | 依据 |
|---|---|---|
| v0.1 | 起草 11 节契约 | `云函数API`(8/29 第3版) + `数据库字段`(8/26 版) |
| v0.1.1 | 赛事详情接口改为"仅独立详情路由需要"；`uid` 存储位置、`role` 枚举结案 | 页面形态讨论；`云函数API` 附录B |
| v0.1.2 | 结案：`status` 枚举、`condition` 语义（0 无需审核/1 需审核/2 仅邀请）、`desc` 不可写、AI 网关 30s；明确 `role` 与 `isAdmin` 解耦（身份/权限分离） | 小程序云函数源码 + 云端网关配置核对 |
| v0.1.3 | 结案：`level`/`type` 真实取值（60 条数据统计）、`organizer` 与 `detailImageList` 定性（透传可写/预留字段，实际 0 使用）、**Dashboard 放弃趋势图改可算维度**；第 10 节核对点全部结案 | `赛事数据库3.0.json` 统计 + `competitionApi/service.js` 源码 |
| v0.1.4 | AI 生成详情补充实现要点：复用 `aiGenDetail` 不另写逻辑、Web 无 OPENID 的鉴权落差、Key 不进前端、批量=前端串行编排 | 架构讨论 |
| v0.1.5 | 技能字典按实现收敛：`PUT`→`PATCH`、DTO 增加服务端计算的 `usage`、明确删除用**拦截**而非级联；第 8 节清单加状态列（前端 8 条全落地，真后端剩 5 件 + 2 个待决策） | `api/skills.js` 实现 + 后端待办盘点 |
| v0.1.5 | **第 8 节第 8 条（安全项）Tier-1 落地**：`POST/PUT /competitions` 改为白名单挑字段（`EDITABLE_FIELDS`），`cid`/`content`/`posterUrl`/`hasPoster` 由服务端独占；`PUT` 的 cid 只取路由参数 | `src/api/competitions.js` |
| v0.1.6 | 赛事更新方法 `PUT` → **`PATCH`**（与"按白名单合并字段"的实现语义对齐，方法名不再撒谎）；同步 api / store 注释与第 8 节引用 | 实现自查 |

*本契约为活文档：字段以源码为准（文档可能滞后），剩余 [核对] 项见第 10 节，联调时逐条验收。*

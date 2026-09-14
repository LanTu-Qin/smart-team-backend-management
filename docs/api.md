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
- **慢接口**：AI 类接口真实耗时 10~25s，前端 axios 超时需单独配置（≥60s），UI 必须有独立 loading 与失败重试提示

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
| `distByLevel` | [{name,value}] | competition 按 `level` 分组计数（饼图） |
| `teamsPerComp` | [{cid,name,value}] | teams 按 `cid_list` 计数前 N（柱状图，可算：遍历队伍展开 cid） |
| `trend` | [{month, users, teams}] | 近 6 月新增趋势（折线图）—— **user/teams 无 `createdAt` 字段**，需用 `_id` 内置时间或补字段，见第 8 节 |

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

- `status` 枚举：`未开始` / `报名中` / `已结束`（对齐 `checkCompActive` 语义；字段文档示例为"报名中"）[核对完整枚举]
- `level`：自由字符串（国A/国家级/省部级…），建议后续字典化 [后端新增]
- 数据库另有 `detailPoster` / `detailImageList`（详情页图片），管理端编辑暂不支持，Tier-2 视需要补 [核对]

### 接口

| Method | Path | 说明 | 对应云函数 action |
|---|---|---|---|
| GET | `/competitions?page&pageSize&keyword&status` | 分页列表（含筛选） | `getAll`（现为全量，分页/筛选 [后端新增]） |
| GET | `/competitions/:cid` | 详情（**仅"独立详情/编辑路由"需要**，见下方说明） | [后端新增]（现无 getByCid；"列表 + 弹窗"形态可直接用列表数据，不需要此接口） |
| POST | `/competitions` | 新建赛事（可带海报 base64） | `create` |
| PUT | `/competitions/:cid` | 更新赛事（新图覆盖旧 poster） | `update` |
| DELETE | `/competitions/:cid` | 删除赛事（联动清理云存储海报/详情图） | `delete` |
| POST | `/competitions/:cid/ai-detail` | AI 生成简介+含金量（**10~25s 慢接口**） | `aiGenDetail` |
| POST | `/competitions/file-urls` | 批量换赛事图片临时链接 | `getFileTempUrl` |

> **为什么详情接口标 `[后端新增]`？** 这取决于**页面形态**，而不是"小程序还是网页"：
> - 「列表页 + 弹窗编辑」（本项目现状）：数据已在内存里，**不需要**单查接口；
> - 「独立详情/编辑路由」`/competitions/:cid`：用户可能**收藏、分享给同事、刷新、新开标签**，一旦刷新内存清空、只剩 URL 里的 `cid`，就必须能凭 id 把数据查回来。
>
> 通用判定规则：**凡是能被"直接进入"的页面（URL / 小程序分享卡片 / 扫码），都必须能凭参数自己取数据。**

**POST/PUT body（扁平化）**：

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

**POST /competitions/:cid/ai-detail body**：`{ "cid": 1, "name": "蓝桥杯…", "url": "https://…" }`
返回：`{ code:0, data:{ content: "规整后的 9 标签内容" } }`（cid 必须为数字）

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
  "role": "student",          // student / teacher / admin（数据库字段.md 的 admin/user 为 8/26 旧版记录）
  "isAdmin": false,
  "skills": [1, 2, 3],        // sid 数组
  "skill_rating": {"1": 4},
  "tid_list": [1787669873428],
  "is_matching": false
}
```

> 用户管理页**不做密码/账号体系**（那是小程序注册逻辑），管理端只承担：搜索、查看、授予/撤销管理员。

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
  "condition": 0,            // 0/1/2；2=仅主动邀请，不可匹配；0/1 语义 [核对]
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
| GET | `/skills` | 技能全表 `{sid, name, desc}` | `skill_getAll` |
| POST | `/skills` body `{name, desc?}` | 新增技能（sid 自动 max+1） | `skill_add`（现只接收 `name`，`desc` 是否落库 [核对]） |
| PUT | `/skills/:sid` | 改名/改描述 | [后端新增]（现无 update action） |
| DELETE | `/skills/:sid` | 删除技能 | [后端新增]；**注意**：user.skills / teams.team_needs 引用该 sid，删除需级联清理或拦截（返回 code 2） |

> 新增的"技能字典管理"页即对上面 4 个接口。

---

## 8. 需后端新增能力清单（集中）

Tier-2 按此清单改造/新增云函数，前端契约保持不变：

| # | 能力 | 影响接口 |
|---|---|---|
| 1 | **管理端登录体系**（账号 + token；网页无 OPENID，不能复用 `ensureAdmin(OPENID)`） | /auth/* |
| 2 | **Dashboard 聚合统计**（跨集合 count/分组；user/teams 缺 `createdAt`，趋势需补字段或用 `_id` 内置时间） | /dashboard/overview |
| 3 | **列表分页 + keyword/status/role 筛选**（现 getAll 全量、searchUsers ≤20 无分页） | /competitions、/users、/teams |
| 4 | 赛事详情 `getByCid` | GET /competitions/:cid |
| 5 | 技能字典 `update` / `delete` action（含引用检查） | PUT、DELETE /skills/:sid |
| 6 | AI 类接口的 HTTP 网关超时放大（真实 10~25s，默认网关 5s 会断） | ai-detail / ai-rate |
| 7 | [核对] 图片上传通道：现走云函数内 base64→云存储，大图受限；或改 Web 端直传云存储（临时密钥） | POST/PUT /competitions |

---

## 9. 现有 mock 页面 ↔ 真实数据模型差异对照（Tier-1 mock 改造点）

> 当前页面/AI 演示数据里有一批**真实产品中不存在的虚构字段**，Tier-1 重构 mock 时必须替换，否则 Tier-2 对不上。

| 模块 | 现 mock 字段（虚构） | 真实字段（本文档 DTO） | 页面影响 |
|---|---|---|---|
| 用户 | `id/name/rating`、role=`organizer/player`、status=`active/disabled` | `uid/username`、role=`student/teacher/admin`、`isAdmin`、skills、无"禁用"概念 | 表格列重写：去掉积分/状态开关，加学院/技能/管理员开关 |
| 队伍 | `captain`（姓名）、`members`（姓名数组）、`category`、`points`、`frozen` | `leader/members`（uid+skillId）、`cid_list`、`condition`、`team_needs/missing`、`maxNum`、`isPersonal` | 表格列重写：队长/成员显示需 uid→用户名回填；筛选维度改"按赛事" |
| 赛事 | `title/host/registered/quota`、status=`ongoing/upcoming/finished`、type=`编程竞赛/黑客马拉松` | `name/url/level/organizer`、status=`未开始/报名中/已结束`、type=`团体`、`content(AI)`、海报 | 表单字段与状态下拉全换；AI 生成详情按钮对应真实 action |
| 登录 | 写死的 admin/demo 账号 | /auth/* [后端新增]，token 化 | 登录表单逻辑保留，账号来源换后端 |
| 看板 | 积分/报名数等虚构统计 | 第 3 节可算字段 | 统计卡与图表数据源全换 |
| 技能 | 无（页面还没有） | skills 字典（sid/name/desc） | 新增页面 |

---

## 10. 未决问题（核对点清单）

1. ~~`uid` 存顶层还是 `userInfo.uid`？~~ **已定论**：存储位置为 `userInfo.uid`（依据 `云函数API` 附录B，8/29 版），接口参数平铺传 `uid`，映射由后端负责；联调时实测一次即可。
2. ~~`role` 枚举？~~ **基本定论**：`student` / `teacher` / `admin`（`updateProfile` 参数与 `addAdvisor` 的 role=teacher 校验可证）；`数据库字段.md` 的 `admin/user` 属 8/26 旧版，联调时确认是否还有遗留值。
3. `competition.status` / `level` / `type` 的**完整枚举值**（文档仅见部分）。
4. `competition.organizer`、详情图 `detailImageList` 是否纳入 v1 编辑。
5. `teams.condition` 0 与 1 的业务语义。
6. user/teams 无 `createdAt`：Dashboard 趋势图的数据来源方案。
7. `desc`（技能描述）经 `skill_add` 是否可写入。
8. AI 类慢接口经 HTTP 网关的超时与计费风险。

---

*本契约 v0.1 为草案：字段以 `云函数API.md` / `数据库字段.md` 为准，所有 [核对] 项待真实联调确认。*

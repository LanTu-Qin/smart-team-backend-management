// ============================================================================
// mock 数据库 —— 站在"微信云开发那 6 个集合"的位置上
// ----------------------------------------------------------------------------
// 本文件只做三件事：① 定义种子 ② 读集合 ③ 写回集合。
// 任何业务逻辑（筛选 / 分页 / 校验 / 集合间联动）都不在这里，而在 api/*.js ——
// 因为真实后端也是云函数里写校验和联动，而不是靠集合自己完成。mock 站在同一
// 位置，Tier-2 才能一行不差地对上。
//
// 三条规矩：
//  1. 只放**真实存在**的字段：依据 docs/api.md 与各集合字段文档，绝不发明字段
//  2. 集合之间的引用必须自洽：user.tid_list、team.cid_list、team.members[].uid
//     都必须能在对应集合里找到，删除时要联动清理（见 api/teams.js、api/competitions.js）
//  3. 存的是"数据库原形"（如 team.members = [{uid,skillId}]），不是"接口形态"：
//     uid → username/avatar 的回填属于**后端职责**（契约第 6 节），由 api 层完成
// ============================================================================

const PREFIX = 'stb-mock:v2:'

/* ---------------------------------------------------------------------------
 * 队伍 tid 约定：13 位时间戳（真实规则：Date.now()）
 * ⚠️ user.tid_list 与 competition 侧的引用都必须复用这里的常量，否则会变成悬空引用
 * ------------------------------------------------------------------------- */
export const TID = {
  challenger: 1787669873428, // 挑战者小队
  algo: 1787991234567, // 算法突击队
  solo: 1788300112233, // 个人参赛-罗欣妍
  fullstack: 1788450678899, // 全栈攻坚队
  sprint: 1788611222333, // 蓝桥杯冲刺队
}

/* ------------------------------- user 集合 ------------------------------- */
// 字段：uid/username/avatar/email/institute/introduction/
//       role/isAdmin/is_matching/skills/skill_rating/tid_list/onGoing_cid/profileComplete
//       _openid（真实字段，mock 可省略）
// ⚠️ 真实 user 集合没有 class / studentId 等字段（见截图）
const seedUsers = [
  {
    uid: 20260001,
    username: '白宫亮',
    avatar: '',
    email: 'baigl@stu.example.edu.cn',
    institute: '电信学院',
    introduction: '熟悉前端开发，做过微信小程序 + 云开发项目，参加过蓝桥杯省赛。',
    role: 'student',
    isAdmin: false,
    is_matching: true,
    skills: [1, 3, 4, 5],
    skill_rating: { 1: 4, 3: 4, 4: 3, 5: 5 },
    tid_list: [TID.challenger],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260002,
    username: '林一诺',
    avatar: '',
    email: 'linyn@stu.example.edu.cn',
    institute: '计算机学院',
    introduction: '算法方向，主攻动态规划与图论，ACM 校队成员。',
    role: 'student',
    isAdmin: false,
    is_matching: true,
    skills: [2, 9],
    skill_rating: { 2: 5, 9: 4 },
    tid_list: [TID.challenger, TID.sprint],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260003,
    username: '苏子航',
    avatar: '',
    email: 'suzh@stu.example.edu.cn',
    institute: '计算机学院',
    introduction: '后端方向，做过 MySQL 数据表设计与接口联调。',
    role: 'student',
    isAdmin: false,
    is_matching: false,
    skills: [7, 16, 24],
    skill_rating: { 7: 4, 16: 3, 24: 3 },
    tid_list: [TID.challenger],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260004,
    username: '赵梦琪',
    avatar: '',
    email: 'zhaomq@stu.example.edu.cn',
    institute: '数据科学学院',
    introduction: '数据分析与爬虫，做过 Flask 后端小项目。',
    role: 'student',
    isAdmin: false,
    is_matching: true,
    skills: [1, 8, 10],
    skill_rating: { 1: 4, 8: 3, 10: 3 },
    tid_list: [TID.algo],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260005,
    username: '何家乐',
    avatar: '',
    email: 'hejl@stu.example.edu.cn',
    institute: '电信学院',
    introduction: '硬件方向，STM32 单片机开发，负责软硬件结合部分。',
    role: 'student',
    isAdmin: false,
    is_matching: false,
    skills: [2, 25],
    skill_rating: { 2: 3, 25: 4 },
    tid_list: [TID.algo],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260006,
    username: '周浩宇',
    avatar: '',
    email: 'zhouhy@stu.example.edu.cn',
    institute: '计算机学院',
    introduction: '前端方向，正在准备蓝桥杯，希望找算法队友。',
    role: 'student',
    isAdmin: false,
    is_matching: true,
    skills: [3, 4, 9],
    skill_rating: { 3: 4, 4: 4, 9: 3 },
    tid_list: [TID.fullstack, TID.sprint],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260007,
    username: '罗欣妍',
    avatar: '',
    email: 'luoxy@stu.example.edu.cn',
    institute: '外国语学院',
    introduction: '负责商业计划书撰写与路演，个人报名参加创新创业大赛。',
    role: 'student',
    isAdmin: false,
    is_matching: false,
    skills: [17, 19, 20],
    skill_rating: { 17: 5, 19: 4, 20: 4 },
    tid_list: [TID.solo],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 20260008,
    username: '郑凯文',
    avatar: '',
    email: 'zhengkw@stu.example.edu.cn',
    institute: '数据科学学院',
    introduction: '音视频处理与计算机视觉，做过 FFmpeg 转码工具。',
    role: 'student',
    isAdmin: false,
    is_matching: false,
    skills: [1, 10, 11],
    skill_rating: { 1: 3, 10: 4, 11: 4 },
    tid_list: [TID.fullstack],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 10001,
    username: '陈梓萌',
    avatar: '',
    email: 'chenzm@example.edu.cn',
    institute: '创新创业学院',
    introduction: '平台运营负责人，负责赛事内容审核与 AI 生成内容质量把关。',
    role: 'admin',
    isAdmin: true,
    is_matching: false,
    skills: [14, 15, 22],
    skill_rating: { 14: 4, 15: 4, 22: 5 },
    tid_list: [],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 10002,
    username: '李建国',
    avatar: '',
    email: 'lijg@example.edu.cn',
    institute: '计算机学院',
    introduction: '指导老师，方向为分布式系统与数据库，指导过互联网+国赛队伍。',
    role: 'teacher',
    isAdmin: false,
    is_matching: false,
    skills: [7, 8, 15],
    skill_rating: { 7: 5, 8: 4, 15: 5 },
    tid_list: [TID.challenger],
    onGoing_cid: [],
    profileComplete: true,
  },
  {
    uid: 10003,
    username: '王慧敏',
    avatar: '',
    email: 'wanghm@example.edu.cn',
    institute: '创新创业学院',
    // role=teacher 但 isAdmin=true：演示"身份与权限解耦"（契约第 5 节）
    introduction: '赛事组织老师，负责校级赛事报名审核与队伍指导。',
    role: 'teacher',
    isAdmin: true,
    is_matching: false,
    skills: [14, 18, 23],
    skill_rating: { 14: 5, 18: 4, 23: 4 },
    tid_list: [TID.sprint],
    onGoing_cid: [],
    profileComplete: true,
  },
]

/* ----------------------------- competition 集合 ---------------------------- */
// 字段＝契约第 4 节 DTO：cid/name/url/level/type/status/start/end/organizer/
//                       content/posterUrl/hasPoster
// level 真实取值：国A(37) / 国B(11) / 省B(11) / 国C(1)
// type  真实取值：团体(43) / 个人/团体(10) / 个人(7)   ← 注意有"混合类型"
// status 真实取值：未开始 / 报名中 / 已结束
const seedCompetitions = [
  {
    cid: 1,
    name: '中国国际“互联网+”大学生创新创业大赛',
    url: 'https://cy.ncss.cn/',
    level: '国A',
    type: '团体',
    status: '报名中',
    start: '2026-05-01',
    end: '2026-10-31',
    organizer: '教育部',
    // AI 生成内容：格式与云函数 normalizeAiContent 一致（两段标题 + 8 个标签行，全角冒号）
    content: '赛事简介\n主办/承办单位：教育部等部委联合主办\n赛事定位：国家级双创顶级赛事，面向高校在读学生\n举办宗旨：推动创新创业教育改革，促进成果转化\n参赛人群：高校在读学生（以官方通知为准）\n基础组队与赛制：团体参赛，校赛—省赛—国赛三级选拔，规模以官方通知为准\n\n赛事含金量\n高校综测/保研认可度：高校普遍认可，具体认定以本校政策为准\n企业招聘参考价值：相关岗位简历中的加分经历，以用人单位标准为准\n行业/学术层面作用：推动创新项目落地与产学研结合',
    posterUrl: '',
    hasPoster: true,
  },
  {
    cid: 2,
    name: '蓝桥杯全国软件和信息技术专业人才大赛',
    url: 'https://www.lanqiao.cn/',
    level: '国B',
    type: '个人',
    status: '报名中',
    start: '2026-03-01',
    end: '2026-05-30',
    organizer: '工业和信息化部人才交流中心',
    content: '',
    posterUrl: '',
    hasPoster: true,
  },
  {
    cid: 3,
    name: 'ACM-ICPC 亚洲区域赛',
    url: 'https://icpc.global/',
    level: '国A',
    type: '团体',
    status: '未开始',
    start: '2026-09-12',
    end: '2026-09-14',
    organizer: '中国计算机学会',
    content: '',
    posterUrl: '',
    hasPoster: false,
  },
  {
    cid: 4,
    name: '全国大学生数学建模竞赛',
    url: 'http://www.mcm.edu.cn/',
    level: '省B',
    type: '团体',
    status: '已结束',
    start: '2026-08-08',
    end: '2026-08-11',
    organizer: '中国工业与应用数学学会',
    content: '赛事简介\n主办/承办单位：中国工业与应用数学学会\n赛事定位：国内规模最大的数学建模赛事之一，面向高校在读学生\n举办宗旨：提升学生运用数学与计算机解决实际问题的能力\n参赛人群：高校在读学生（以官方通知为准）\n基础组队与赛制：3 人团体，通常每年 9 月举行\n\n赛事含金量\n高校综测/保研认可度：高校普遍认可，具体认定以本校政策为准\n企业招聘参考价值：体现建模与数据分析能力\n行业/学术层面作用：推动数学方法在工程与产业中的应用',
    posterUrl: '',
    hasPoster: false,
  },
  {
    cid: 5,
    name: '全国大学生电子商务“创新、创意及创业”挑战赛',
    url: 'http://www.3chuang.net/',
    level: '省B',
    type: '个人/团体',
    status: '已结束',
    start: '2026-03-10',
    end: '2026-07-20',
    organizer: '教育部高等学校电子商务类专业教学指导委员会',
    content: '',
    posterUrl: '',
    hasPoster: false,
  },
  {
    cid: 6,
    name: '中国高校计算机大赛—人工智能创意赛',
    url: 'https://aicompetition.cn/',
    level: '国C',
    type: '团体',
    status: '未开始',
    start: '2026-11-06',
    end: '2026-11-08',
    organizer: '教育部高等学校计算机类专业教学指导委员会',
    content: '',
    posterUrl: '',
    hasPoster: false,
  },
  {
    cid: 7,
    name: '全国大学生算法设计与编程挑战赛',
    url: 'https://www.matiji.net/',
    level: '省B',
    type: '个人',
    status: '报名中',
    start: '2026-06-01',
    end: '2026-09-01',
    organizer: '中国计算机学会',
    content: '',
    posterUrl: '',
    hasPoster: false,
  },
]

/* -------------------------------- teams 集合 ------------------------------ */
// 字段＝**真实存储形态**（三处依据一致：数据库字段.md / 云函数API create 参数 / 附录B）：
//   leader  → number（队长 uid，不是对象）
//   members → 对象 map { "uid": skillId }（**不是数组**）
//   advisor → number[]（指导老师 uid 数组）
// 展开成数组 + 回填 username/skillName 是**接口层**的职责（api/teams.js toDto）——
// 数据库不会为了前端好看而改变形态，这正是契约第 0 节"契约 ≠ 数据库行"。
// condition：0 无需审核 / 1 需审核 / 2 仅邀请（≠2 才可进匹配池）
// isPersonal=true 时只能是 condition=2 / maxNum=1（个人队不开放组队入口）
const seedTeams = [
  {
    tid: TID.challenger,
    name: '挑战者小队',
    cid_list: [1, 3],
    leader: 20260001,
    members: { '20260001': 5, '20260002': 9, '20260003': 7 },
    advisor: [10002],
    isPersonal: false,
    condition: 0,
    maxNum: 5,
    team_needs: { 6: 1, 13: 1 },
    team_missing: { 6: 1, 13: 1 },
    intro: '依托小程序 + 云开发，冲击互联网+ 国赛。',
    is_matching: true,
  },
  {
    tid: TID.algo,
    name: '算法突击队',
    cid_list: [3, 7],
    leader: 20260004,
    members: { '20260004': 10, '20260005': 2 },
    advisor: [],
    isPersonal: false,
    condition: 1,
    maxNum: 4,
    team_needs: { 9: 1 },
    team_missing: { 9: 1 },
    intro: '主攻 ACM 区域赛，每周两次集训。',
    is_matching: true,
  },
  {
    tid: TID.solo,
    name: '个人参赛-罗欣妍',
    cid_list: [5],
    leader: 20260007,
    members: { '20260007': 17 },
    advisor: [],
    isPersonal: true,
    condition: 2,
    maxNum: 1,
    team_needs: {},
    team_missing: {},
    intro: '以个人身份参加三创赛，负责 BP 与路演。',
    is_matching: false,
  },
  {
    tid: TID.fullstack,
    name: '全栈攻坚队',
    cid_list: [2],
    leader: 20260008,
    members: { '20260008': 11, '20260006': 3 },
    advisor: [],
    isPersonal: false,
    condition: 2,
    maxNum: 4,
    team_needs: { 7: 1 },
    team_missing: { 7: 1 },
    intro: '音视频 + 前端组合，目标黑客马拉松。',
    is_matching: false,
  },
  {
    tid: TID.sprint,
    name: '蓝桥杯冲刺队',
    cid_list: [7],
    leader: 20260006,
    members: { '20260006': 9, '20260002': 2 },
    advisor: [10003],
    isPersonal: false,
    condition: 0,
    maxNum: 3,
    team_needs: { 2: 1 },
    team_missing: {},
    intro: '两个月冲刺蓝桥杯省赛，主攻动态规划。',
    is_matching: true,
  },
]

/* ------------------------------- skills 集合 ------------------------------ */
// 真实技能字典（25 条，来自平台实际数据）：sid / name / desc
export const seedSkills = [
  { sid: 1, name: 'Python', desc: '数据分析pandas/numpy、爬虫、Flask/FastAPI后端、大模型API调用、提示词工程，创新项目高频语言' },
  { sid: 2, name: 'C/C++', desc: '算法竞赛主力，蓝桥杯/ACM使用；硬件单片机项目开发' },
  { sid: 3, name: 'HTML+CSS+JavaScript', desc: 'Web前端基础，页面布局交互开发' },
  { sid: 4, name: 'Vue', desc: 'Web前端框架，快速开发网页项目' },
  { sid: 5, name: '微信小程序原生', desc: '小程序前后端页面、云开发，移动端原型开发' },
  { sid: 6, name: 'uni‑app', desc: '跨端小程序/App开发框架' },
  { sid: 7, name: 'MySQL', desc: '关系型数据库，数据表设计、索引、SQL查询' },
  { sid: 8, name: 'MongoDB', desc: '非关系型数据库，适合小程序云开发场景' },
  { sid: 9, name: '数据结构与算法', desc: '贪心、动态规划、图论、搜索、数论，算法竞赛核心' },
  { sid: 10, name: 'OpenCV', desc: '计算机视觉、图像处理项目' },
  { sid: 11, name: 'FFmpeg', desc: '音视频处理、转码处理' },
  { sid: 12, name: 'Git版本管理', desc: '代码版本控制，团队协作开发' },
  { sid: 13, name: '项目部署', desc: '云服务器、小程序云开发，项目上线演示' },
  { sid: 14, name: '需求分析', desc: '挖掘痛点，明确项目用户与业务目标' },
  { sid: 15, name: '数据库架构设计', desc: '数据表、字段、索引设计，规避业务逻辑漏洞' },
  { sid: 16, name: '接口与前后端联调', desc: 'API接口开发、异常处理，打通前后端数据交互' },
  { sid: 17, name: '商业计划书BP撰写', desc: '痛点分析、竞品对比、商业模式、团队规划，双创比赛核心文档' },
  { sid: 18, name: '技术报告写作', desc: '系统架构、技术选型、算法说明、测试结果撰写' },
  { sid: 19, name: 'PPT制作', desc: '路演PPT排版、流程图绘制、内容精简，控制页数与逻辑' },
  { sid: 20, name: '路演演讲', desc: '时间把控、项目讲解、现场演示，准备录屏备用方案' },
  { sid: 21, name: '答辩问答', desc: '应对评委技术、市场、创新点相关提问' },
  { sid: 22, name: '团队分工协作', desc: '代码、文档、路演任务分配，项目时间进度管理' },
  { sid: 23, name: '竞品调研', desc: '调研同类产品，提炼自身项目创新点' },
  { sid: 24, name: 'Java', desc: 'Web后端开发，部分业务系统项目使用' },
  { sid: 25, name: 'STM32单片机开发', desc: '硬件类计算机竞赛，软硬件结合项目' },
]

/* ----------------------------- 读写（带持久化） ----------------------------
 * mock 也要能"写"：否则管理员开关一刷新就回弹，体验不像真后端。
 * 持久化只是 mock 的内部实现，Tier-2 换成真正的云数据库。
 * ------------------------------------------------------------------------- */
const cache = {}

function readCollection(name, seed) {
  if (cache[name]) return cache[name]
  try {
    const raw = localStorage.getItem(PREFIX + name)
    if (raw) {
      cache[name] = JSON.parse(raw)
      return cache[name]
    }
  } catch (e) {
    /* localStorage 不可用或数据损坏：退回内存种子 */
  }
  // 必须深拷贝，否则 seed 里的嵌套对象/数组会被后续写操作污染
  cache[name] = seed.map((row) => {
    if (typeof structuredClone === 'function') return structuredClone(row)
    return JSON.parse(JSON.stringify(row))
  })
  return cache[name]
}

function writeCollection(name) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(cache[name]))
  } catch (e) {
    /* 忽略：写失败不影响本次会话内的使用 */
  }
}

export const getUsers = () => readCollection('users', seedUsers)
export const commitUsers = () => writeCollection('users')

export const getCompetitions = () => readCollection('competitions', seedCompetitions)
export const commitCompetitions = () => writeCollection('competitions')

export const getTeams = () => readCollection('teams', seedTeams)
export const commitTeams = () => writeCollection('teams')

export const getSkills = () => readCollection('skills', seedSkills)
export const commitSkills = () => writeCollection('skills')

/** sid 自增：真实 skill_add 就是取当前最大 sid + 1 */
export const nextSid = () =>
  Math.max(0, ...getSkills().map((s) => Number(s.sid) || 0)) + 1

/** cid 自增：真实后端由数据库分配，mock 取当前最大 cid + 1 */
export const nextCid = () =>
  Math.max(0, ...getCompetitions().map((c) => Number(c.cid) || 0)) + 1

/** 开发用：清掉 mock 写入的数据，恢复种子（控制台执行 __resetMockDb()） */
export function resetMockDb() {
  Object.keys(cache).forEach((k) => delete cache[k])
  try {
    ;['users', 'competitions', 'teams', 'skills'].forEach((k) =>
      localStorage.removeItem(PREFIX + k),
    )
  } catch (e) {
    /* 忽略 */
  }
}

if (typeof window !== 'undefined') window.__resetMockDb = resetMockDb

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import { useSkillsStore } from '@/stores/skills'
import { useToast } from '@/composables/toast'

const store = useSkillsStore()
const { toast } = useToast()

const keyword = ref('')

/* ---------------- 新增 / 编辑 ----------------
 * 真实 skillApi.add 已支持 desc（service.add(name, desc) 在 desc 非空时一并写库），
 * 因此新增与编辑共用同一套表单：名称必填，描述选填（描述会喂给 AI 技能评级）。
 * 改名 / 改描述走 PATCH /skills/:sid，sid 是引用键，不可改。
 */
const dialogOpen = ref(false)
const mode = ref('create') // create | edit
const formRef = ref(null)
const form = reactive({ sid: null, name: '', desc: '' })

const rules = {
  name: [
    { required: true, message: '请填写技能名称', trigger: 'blur' },
    { max: 30, message: '技能名称不能超过 30 个字', trigger: 'blur' },
  ],
}

const dialogTitle = computed(() => (mode.value === 'create' ? '新增技能' : '编辑技能'))

function openCreate() {
  mode.value = 'create'
  Object.assign(form, { sid: null, name: '', desc: '' })
  formRef.value?.clearValidate()
  dialogOpen.value = true
}

function openEdit(row) {
  mode.value = 'edit'
  Object.assign(form, { sid: row.sid, name: row.name, desc: row.desc })
  formRef.value?.clearValidate()
  dialogOpen.value = true
}

function save() {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    try {
      if (mode.value === 'create') {
        await store.create({ name: form.name, desc: form.desc })
        toast(`技能「${form.name.trim()}」已添加`)
      } else {
        await store.update(form.sid, { name: form.name, desc: form.desc })
        toast('技能已更新')
      }
      dialogOpen.value = false
    } catch (err) {
      // 名称重复等业务错误由后端判定（code 2），前端只负责展示
      toast(err.message || '保存失败', 'error')
    }
  })
}

/* ---------------- 删除：后端做引用检查（4 处） ----------------
 * 文档型数据库没有外键，删除不会自动拦截 —— 技能被 user.skills / user.skill_rating /
 * teams.team_needs / teams.team_missing 引用时删掉会产生"悬空引用"（尤其是评级里的幽灵键）。
 * 检查是**服务端**职责（契约第 7 节），前端只把 usage + detail 显示出来；
 * 即便这里放行，后端也会拒绝。
 */
function askDelete(row) {
  // usage 缺失时也要能工作（真实后端字段可能未提供）——否则解构会 TypeError，点了删除没反应
  const { users = 0, teams = 0, detail = null } = row.usage || {}
  const usageText =
    users || teams
      ? `当前有 ${users} 位用户、${teams} 支队伍在使用它，后端会拒绝删除。`
      : '当前没有任何用户或队伍使用它。'
  // 引用明细：帮助管理员看清引用具体落在哪（一处用户/队伍可能同时命中多个位置）
  const detailText = detail
    ? [
        detail.userSkills ? `用户技能 ${detail.userSkills}` : '',
        detail.userRating ? `技能评级 ${detail.userRating}` : '',
        detail.teamNeeds ? `招募需求 ${detail.teamNeeds}` : '',
        detail.teamMissing ? `技能缺口 ${detail.teamMissing}` : '',
      ]
        .filter(Boolean)
        .join('、')
    : ''

  ElMessageBox.confirm(
    `确定删除技能「${row.name}」吗？\n${usageText}${detailText ? `\n引用位置：${detailText}` : ''}`,
    '删除技能',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(async () => {
      try {
        await store.remove(row.sid)
        toast(`技能「${row.name}」已删除`, 'success')
      } catch (err) {
        toast(err.message || '删除失败', 'error')
      }
    })
    .catch(() => {
      /* 取消 */
    })
}

function resetKeyword() {
  keyword.value = ''
  store.setKeyword('')
}

onMounted(() => store.fetchList())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>技能字典</h2>
        <div class="page-sub">
          共 {{ store.list.length }} 个技能，其中 {{ store.usedCount }} 个已被用户或队伍使用
        </div>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增技能</el-button>
      </div>
    </div>

    <div class="card table-card" v-loading="store.loading">
      <div class="toolbar toolbar-pad">
        <!-- 本地过滤：字典表已全量在前端（25 条），不必为搜索再发一次请求 -->
        <el-input
          v-model="keyword"
          class="search"
          clearable
          placeholder="搜索技能名称 / 描述"
          @input="store.setKeyword(keyword)"
          @clear="resetKeyword"
        >
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-button v-if="keyword" :icon="RotateCcw" @click="resetKeyword">重置</el-button>
        <span class="hint">
          技能是平台的公共语言：用户技能、队伍招募需求、匹配算法都以 sid 关联
        </span>
      </div>

      <el-table :data="store.sorted" style="width: 100%">
        <el-table-column label="技能" min-width="200">
          <template #default="{ row }">
            <div class="skill-cell">
              <span class="skill-name">{{ row.name }}</span>
              <span class="sid-badge">sid {{ row.sid }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="320">
          <template #default="{ row }">
            <span v-if="row.desc">{{ row.desc }}</span>
            <span v-else class="cell-sub">暂无描述（新建的技能可补充）</span>
          </template>
        </el-table-column>
        <el-table-column label="使用情况" width="190">
          <template #default="{ row }">
            <el-tag v-if="row.usage.users" size="small" effect="light" round class="usage-tag">
              {{ row.usage.users }} 位用户
            </el-tag>
            <el-tag
              v-if="row.usage.teams"
              size="small"
              effect="light"
              type="warning"
              round
              class="usage-tag"
            >
              {{ row.usage.teams }} 支队伍
            </el-tag>
            <span v-if="!row.usage.users && !row.usage.teams" class="cell-sub">未被使用</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Pencil" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的技能">
            <span class="empty-sub">试试换个关键词，或新增一个技能</span>
          </el-empty>
        </template>
      </el-table>
    </div>

    <el-dialog v-model="dialogOpen" :title="dialogTitle" width="min(560px, 92vw)" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="技能名称" prop="name">
          <el-input v-model="form.name" placeholder="如：Python、Vue、路演演讲" maxlength="30" show-word-limit />
        </el-form-item>

        <!-- 新增 / 编辑都可填描述：真实 skillApi.add 支持 desc（service.add(name, desc)） -->
        <el-form-item label="技能描述">
          <el-input
            v-model="form.desc"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="描述会用于 AI 技能评级，建议写清该技能覆盖的能力范围"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取 消</el-button>
        <el-button type="primary" :loading="store.submitting" @click="save">
          {{ mode === 'create' ? '确认添加' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.search { width: 260px; }
.prefix-ico { color: var(--t3); }
.min-w-0 { min-width: 0; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

.skill-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.skill-name { font-weight: 600; }
.sid-badge {
  font-size: 11.5px; color: var(--t3);
  padding: 1px 6px; border-radius: 6px; background: var(--bg-soft, #f3f5fa);
  font-variant-numeric: tabular-nums;
}
.usage-tag { margin-right: 6px; }
.hint { margin-left: auto; font-size: 12.5px; color: var(--t3); }

@media (max-width: 640px) {
  .search { width: 100%; }
  .hint { display: none; }
}
</style>

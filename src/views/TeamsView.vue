<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Search, RotateCcw, Flag, Pencil, Trash2, Check } from 'lucide-vue-next'
import { useTeamsStore } from '@/stores/teams'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/toast'

const store = useTeamsStore()
const usersStore = useUsersStore()
const { toast } = useToast()

const CATS = ['算法', '工程', '数据', '综合']
const categoryTagType = { 算法: 'primary', 工程: 'info', 数据: 'warning', 综合: 'success' }
const statusOptions = [
  { value: 'active', label: '正常' },
  { value: 'frozen', label: '冻结' },
]
const statusLabel = { active: '正常', frozen: '冻结' }

/* ---------- 筛选 & 分页 ---------- */
const keyword = ref('')
const catFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(8)

watch([keyword, catFilter, statusFilter], () => { page.value = 1 })

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.items.filter((t) => {
    if (kw) {
      const hay = `${t.name} ${t.captain} ${t.members.join(' ')}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    if (catFilter.value && t.category !== catFilter.value) return false
    if (statusFilter.value && t.status !== statusFilter.value) return false
    return true
  })
})

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const hasFilter = computed(() => keyword.value || catFilter.value || statusFilter.value)
function resetFilter() {
  keyword.value = ''
  catFilter.value = ''
  statusFilter.value = ''
}

/* ---------- 新增 / 编辑 ---------- */
const emptyForm = () => ({ name: '', category: '算法', captain: '', status: 'active', points: 0, members: [] })
const modalOpen = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())
const editingId = ref(null)

const candidates = computed(() => usersStore.playerOptions)
const avatarCls = (id) => ['c1', 'c2', 'c3', 'c4'][id % 4]

const validateMembers = (_rule, value, cb) => {
  if (!Array.isArray(value) || value.length === 0) return cb(new Error('请至少勾选一名队员'))
  cb()
}
const rules = {
  name: [
    { required: true, message: '请填写队伍名称', trigger: 'blur' },
    { max: 20, message: '队伍名称不能超过 20 个字', trigger: 'blur' },
  ],
  captain: [{ required: true, message: '请选择队长', trigger: 'change' }],
  members: [{ validator: validateMembers, trigger: 'change' }],
}

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
  modalOpen.value = true
}
function openEdit(t) {
  editingId.value = t.id
  Object.assign(form, {
    name: t.name, category: t.category, captain: t.captain,
    status: t.status, points: t.points || 0, members: [...(t.members || [])],
  })
  formRef.value?.clearValidate()
  modalOpen.value = true
}

function toggleMember(name) {
  const i = form.members.indexOf(name)
  if (i > -1) form.members.splice(i, 1)
  else form.members.push(name)
  formRef.value?.validateField('members').catch(() => {})
}
function onCaptainChange() {
  // 队长不能同时是普通成员，自动移出
  const i = form.members.indexOf(form.captain)
  if (i > -1) form.members.splice(i, 1)
  formRef.value?.validateField('members').catch(() => {})
}

function save() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const payload = {
      name: form.name.trim(), category: form.category,
      captain: form.captain, status: form.status,
      points: Number(form.points) || 0, members: [...form.members],
    }
    if (editingId.value) {
      store.updateTeam(editingId.value, payload)
      toast('队伍信息已更新')
    } else {
      store.addTeam(payload)
      toast('新战队已创建')
      page.value = 1
    }
    modalOpen.value = false
  })
}

/* ---------- 删除确认 ---------- */
function askDelete(t) {
  ElMessageBox.confirm(
    `确定要删除队伍「${t.name}」吗？删除后队伍成员关系将被解散，此操作不可恢复。`,
    '删除队伍',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(() => {
      store.removeTeam(t.id)
      toast(`队伍「${t.name}」已删除`, 'info')
      const max = Math.max(1, Math.ceil(filtered.value.length / pageSize.value))
      if (page.value > max) page.value = max
    })
    .catch(() => { /* 取消 */ })
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>队伍管理</h2>
        <div class="page-sub">共 {{ store.total }} 支战队，运行中 {{ store.activeCount }} 支</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="Flag" @click="openAdd">创建队伍</el-button>
      </div>
    </div>

    <div class="card table-card">
      <div class="toolbar toolbar-pad">
        <el-input v-model="keyword" class="search" clearable placeholder="搜索队伍 / 队长 / 队员">
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-select v-model="catFilter" class="filter" clearable placeholder="全部赛道">
          <el-option v-for="c in CATS" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="statusFilter" class="filter" clearable placeholder="全部状态">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button v-if="hasFilter" class="reset-btn" :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="paged" style="width: 100%">
        <el-table-column label="队伍" min-width="180">
          <template #default="{ row }">
            <div class="team-cell">
              <span class="avatar" :class="avatarCls(row.id)">{{ row.name.slice(0, 1) }}</span>
              <span class="name-main">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="赛道" width="100">
          <template #default="{ row }">
            <el-tag :type="categoryTagType[row.category] || 'primary'" size="small" effect="light" round>
              {{ row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="队长" width="110">
          <template #default="{ row }">
            <span class="captain">{{ row.captain }}</span>
          </template>
        </el-table-column>
        <el-table-column label="队员" min-width="220">
          <template #default="{ row }">
            <div class="member-cell">
              <el-tag
                v-for="m in row.members.slice(0, 3)"
                :key="m"
                size="small"
                effect="plain"
                round
                disable-transitions
              >
                {{ m }}
              </el-tag>
              <el-tag
                v-if="row.members.length > 3"
                size="small"
                type="info"
                effect="plain"
                round
                disable-transitions
              >
                +{{ row.members.length - 3 }}
              </el-tag>
              <span v-if="row.members.length === 0" class="cell-sub">暂未添加</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'warning'" size="small" effect="light" round>
              {{ statusLabel[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" width="90">
          <template #default="{ row }">
            <b class="pts">{{ row.points }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="130" />
        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Pencil" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的队伍">
            <span class="empty-sub">试试调整搜索关键词或筛选条件</span>
          </el-empty>
        </template>
      </el-table>

      <div class="table-foot">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filtered.length"
          :page-sizes="[8, 12, 20]"
          layout="total, sizes, prev, pager, next"
          background
          @size-change="page = 1"
        />
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="modalOpen"
      :title="editingId ? '编辑队伍' : '创建队伍'"
      width="min(640px, 94vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="队伍名称" prop="name">
              <el-input v-model="form.name" placeholder="如：算法突击队" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="所属赛道">
              <el-select v-model="form.category">
                <el-option v-for="c in CATS" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="队长" prop="captain">
              <el-select v-model="form.captain" filterable placeholder="请选择队长" @change="onCaptainChange">
                <el-option v-for="u in candidates" :key="u.id" :label="u.value" :value="u.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="战队积分">
              <el-input-number
                v-model="form.points"
                :min="0"
                :max="20000"
                :step="100"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" class="full">
          <el-radio-group v-model="form.status">
            <el-radio-button v-for="o in statusOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="队员选择（可多选，队长自动排除）" prop="members">
          <div class="member-pick">
            <button
              v-for="u in candidates"
              :key="u.id"
              type="button"
              class="mp-chip"
              :class="{ on: form.members.includes(u.value), disabled: u.value === form.captain }"
              :disabled="u.value === form.captain"
              @click="toggleMember(u.value)"
            >
              <Check v-if="form.members.includes(u.value)" :size="12" />
              {{ u.value }}<span v-if="u.value === form.captain">（队长）</span>
            </button>
            <div v-if="candidates.length === 0" class="hint">暂无可用队员，请先在「用户管理」中新增启用状态的用户</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalOpen = false">取 消</el-button>
        <el-button type="primary" @click="save">{{ editingId ? '保存修改' : '创建队伍' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.search { width: 260px; }
.filter { width: 130px; }
.reset-btn { margin-left: 2px; }
.prefix-ico { color: var(--t3); }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}
.team-cell { display: flex; align-items: center; gap: 11px; }
.captain { font-weight: 600; }
.pts { color: var(--c-warning); font-variant-numeric: tabular-nums; }
.member-cell { display: flex; flex-wrap: wrap; gap: 5px; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

.member-pick { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
.mp-chip {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
  background: #fff; color: var(--t2); font-size: 12.5px; font-family: inherit;
  line-height: 1; padding: 7px 12px; transition: all 0.13s;
}
.mp-chip:hover:not(:disabled) { border-color: var(--c-primary); color: var(--c-primary); }
.mp-chip.on {
  background: var(--c-primary-soft); border-color: var(--c-primary);
  color: var(--c-primary); font-weight: 600;
}
.mp-chip.disabled {
  opacity: 0.45; cursor: not-allowed;
  background: #f8fafc; border-style: dashed;
}
.hint { color: var(--t3); font-size: 12.5px; }

@media (max-width: 640px) {
  .search { width: 100%; }
  .filter { flex: 1; min-width: 0; }
  .table-foot { justify-content: center; }
}
</style>

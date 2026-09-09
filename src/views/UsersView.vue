<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Search, RotateCcw, UserPlus, Pencil, Trash2 } from 'lucide-vue-next'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/toast'

const store = useUsersStore()
const { toast } = useToast()

const roleOptions = [
  { value: 'admin', label: '管理员' },
  { value: 'organizer', label: '组织者' },
  { value: 'player', label: '队员' },
]
const roleLabel = { admin: '管理员', organizer: '组织者', player: '队员' }
const roleTagType = { admin: 'primary', organizer: 'warning', player: 'info' }
const statusOptions = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '禁用' },
]
const statusLabel = { active: '启用', disabled: '禁用' }

/* ---------- 筛选 & 分页 ---------- */
const keyword = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(8)

watch([keyword, roleFilter, statusFilter], () => { page.value = 1 })

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.items.filter((u) => {
    if (kw && !u.name.toLowerCase().includes(kw) && !u.email.toLowerCase().includes(kw)) return false
    if (roleFilter.value && u.role !== roleFilter.value) return false
    if (statusFilter.value && u.status !== statusFilter.value) return false
    return true
  })
})

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const hasFilter = computed(() => keyword.value || roleFilter.value || statusFilter.value)
function resetFilter() {
  keyword.value = ''
  roleFilter.value = ''
  statusFilter.value = ''
}

/* ---------- 新增 / 编辑 ---------- */
const emptyForm = () => ({ name: '', email: '', role: 'player', status: 'active', rating: 0 })
const modalOpen = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())
const editingId = ref(null)

const avatarCls = (id) => ['c1', 'c2', 'c3', 'c4'][id % 4]

const rules = {
  name: [{ required: true, message: '请填写用户姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请填写邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请填写有效的邮箱地址', trigger: ['blur', 'change'] },
  ],
}

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
  modalOpen.value = true
}
function openEdit(u) {
  editingId.value = u.id
  Object.assign(form, {
    name: u.name, email: u.email, role: u.role, status: u.status, rating: u.rating || 0,
  })
  formRef.value?.clearValidate()
  modalOpen.value = true
}

function save() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const payload = {
      name: form.name.trim(), email: form.email.trim(),
      role: form.role, status: form.status,
      rating: Number(form.rating) || 0,
    }
    if (editingId.value) {
      store.updateUser(editingId.value, payload)
      toast('用户信息已更新')
    } else {
      store.addUser(payload)
      toast('新用户已添加')
      page.value = 1
    }
    modalOpen.value = false
  })
}

/* ---------- 删除确认 ---------- */
function askDelete(u) {
  ElMessageBox.confirm(
    `确定要删除用户 ${u.name}（${u.email}）吗？删除后该账号将无法登录，此操作不可恢复。`,
    '删除用户',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(() => {
      store.removeUser(u.id)
      toast(`用户 ${u.name} 已删除`, 'info')
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
        <h2>用户管理</h2>
        <div class="page-sub">共 {{ store.total }} 位注册用户，其中活跃 {{ store.activeCount }} 位</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="UserPlus" @click="openAdd">新增用户</el-button>
      </div>
    </div>

    <div class="card table-card">
      <div class="toolbar toolbar-pad">
        <el-input v-model="keyword" class="search" clearable placeholder="搜索姓名 / 邮箱">
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-select v-model="roleFilter" class="filter" clearable placeholder="全部角色">
          <el-option v-for="o in roleOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="statusFilter" class="filter" clearable placeholder="全部状态">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button v-if="hasFilter" class="reset-btn" :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="paged" style="width: 100%">
        <el-table-column label="用户" min-width="230">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="avatar" :class="avatarCls(row.id)">{{ row.name.slice(0, 1) }}</span>
              <div class="min-w-0">
                <div class="name-main">{{ row.name }}</div>
                <div class="cell-sub">{{ row.email }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTagType[row.role] || 'primary'" size="small" effect="light" round>
              {{ roleLabel[row.role] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small" effect="light" round>
              {{ statusLabel[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评级" width="90">
          <template #default="{ row }">
            <span class="rating">{{ row.rating || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="130" />
        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Pencil" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的用户">
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
      :title="editingId ? '编辑用户' : '新增用户'"
      width="min(560px, 92vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="如：张三" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="评级（积分制，可空）">
              <el-input-number
                v-model="form.rating"
                :min="0"
                :max="4000"
                :step="50"
                controls-position="right"
                placeholder="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="name@smartteam.cn" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="角色">
              <el-select v-model="form.role">
                <el-option v-for="o in roleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="状态">
              <el-select v-model="form.status">
                <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="modalOpen = false">取 消</el-button>
        <el-button type="primary" @click="save">{{ editingId ? '保存修改' : '确认添加' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.search { width: 250px; }
.filter { width: 130px; }
.reset-btn { margin-left: 2px; }
.prefix-ico { color: var(--t3); }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}
.rating { color: var(--c-warning); font-weight: 600; font-variant-numeric: tabular-nums; }
.min-w-0 { min-width: 0; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

@media (max-width: 640px) {
  .search { width: 100%; }
  .filter { flex: 1; min-width: 0; }
  .table-foot { justify-content: center; }
}
</style>

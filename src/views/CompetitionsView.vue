<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Search, RotateCcw, Trophy, Pencil, Trash2 } from 'lucide-vue-next'
import { useCompetitionsStore } from '@/stores/competitions'
import { useToast } from '@/composables/toast'

const store = useCompetitionsStore()
const { toast } = useToast()

const TYPES = ['编程竞赛', '黑客马拉松', 'AI 挑战赛', '数据大赛', '数学建模', 'CTF 夺旗赛']
const statusOptions = [
  { value: 'upcoming', label: '未开始' },
  { value: 'ongoing', label: '进行中' },
  { value: 'finished', label: '已结束' },
]
const statusLabel = { upcoming: '未开始', ongoing: '进行中', finished: '已结束' }
const statusTagType = { upcoming: 'primary', ongoing: 'success', finished: 'info' }

/* ---------- 筛选 & 分页 ---------- */
const keyword = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(8)

watch([keyword, typeFilter, statusFilter], () => { page.value = 1 })

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.items.filter((c) => {
    if (kw && !`${c.title} ${c.host}`.toLowerCase().includes(kw)) return false
    if (typeFilter.value && c.type !== typeFilter.value) return false
    if (statusFilter.value && c.status !== statusFilter.value) return false
    return true
  })
})

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const hasFilter = computed(() => keyword.value || typeFilter.value || statusFilter.value)
function resetFilter() {
  keyword.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
}

const regPercent = (c) =>
  Math.min(100, Math.round(((c.registered || 0) / Math.max(1, c.quota || 0)) * 100))
const regColor = (c) => (c.registered >= c.quota ? '#f59e0b' : undefined)

/* ---------- 新增 / 编辑 ---------- */
const emptyForm = () => ({
  title: '', host: '', type: '编程竞赛', status: 'upcoming',
  startDate: '', endDate: '', registered: 0, quota: 100,
})
const modalOpen = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())
const editingId = ref(null)

const avatarCls = (id) => ['c1', 'c2', 'c3', 'c4'][id % 4]
const titleInitial = (t) => t.replace('第 ', '').replace('届', '').slice(0, 1)

const validateRegistered = (_r, v, cb) => {
  const n = Number(v) || 0
  if (n < 0) return cb(new Error('已报名数量不能为负数'))
  const q = Number(form.quota) || 0
  if (q > 0 && n > q) return cb(new Error('已报名队伍数不能超过名额上限'))
  cb()
}
const validateQuota = (_r, v, cb) => {
  if (Number(v) < 0) return cb(new Error('名额不能为负数'))
  cb()
}
const validateEndDate = (_r, v, cb) => {
  if (form.startDate && v && v < form.startDate) return cb(new Error('结束日期不能早于开始日期'))
  cb()
}
const rules = {
  title: [{ required: true, message: '请填写赛事名称', trigger: 'blur' }],
  host: [{ required: true, message: '请填写主办方', trigger: 'blur' }],
  startDate: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  endDate: [
    { required: true, message: '请选择结束日期', trigger: 'change' },
    { validator: validateEndDate, trigger: 'change' },
  ],
  registered: [{ validator: validateRegistered, trigger: 'change' }],
  quota: [
    { required: true, message: '请填写队伍名额上限', trigger: 'blur' },
    { validator: validateQuota, trigger: 'change' },
  ],
}

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
  modalOpen.value = true
}
function openEdit(c) {
  editingId.value = c.id
  Object.assign(form, {
    title: c.title, host: c.host, type: c.type, status: c.status,
    startDate: c.startDate, endDate: c.endDate,
    registered: c.registered || 0, quota: c.quota || 100,
  })
  formRef.value?.clearValidate()
  modalOpen.value = true
}

function handleStartChange() {
  // 开始日期变化后，复核结束日期大小关系
  formRef.value?.validateField('endDate').catch(() => {})
}

function save() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const payload = {
      title: form.title.trim(), host: form.host.trim(), type: form.type,
      status: form.status, startDate: form.startDate, endDate: form.endDate,
      registered: Number(form.registered) || 0, quota: Number(form.quota) || 0,
    }
    if (editingId.value) {
      store.updateCompetition(editingId.value, payload)
      toast('赛事信息已更新')
    } else {
      store.addCompetition(payload)
      toast('赛事已创建')
      page.value = 1
    }
    modalOpen.value = false
  })
}

/* ---------- 删除确认 ---------- */
function askDelete(c) {
  ElMessageBox.confirm(
    `确定要删除赛事「${c.title}」吗？删除后关联报名记录将一并失效，此操作不可恢复。`,
    '删除赛事',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(() => {
      store.removeCompetition(c.id)
      toast(`赛事「${c.title}」已删除`, 'info')
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
        <h2>赛事管理</h2>
        <div class="page-sub">共 {{ store.total }} 场赛事，进行中 {{ store.ongoingCount }} 场</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="Trophy" @click="openAdd">新建赛事</el-button>
      </div>
    </div>

    <div class="card table-card">
      <div class="toolbar toolbar-pad">
        <el-input v-model="keyword" class="search" clearable placeholder="搜索赛事 / 主办方">
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-select v-model="typeFilter" class="filter" clearable placeholder="全部类型">
          <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="statusFilter" class="filter" clearable placeholder="全部状态">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button v-if="hasFilter" class="reset-btn" :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="paged" style="width: 100%">
        <el-table-column label="赛事" min-width="250">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="avatar" :class="avatarCls(row.id)">{{ titleInitial(row.title) }}</span>
              <div class="min-w-0">
                <div class="name-main">{{ row.title }}</div>
                <div class="cell-sub">{{ row.host }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag type="primary" size="small" effect="plain" round>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="报名情况" min-width="200">
          <template #default="{ row }">
            <div class="reg-cell">
              <el-progress
                :percentage="regPercent(row)"
                :stroke-width="6"
                :show-text="false"
                :color="regColor(row)"
                class="reg-progress"
              />
              <span class="reg-txt" :class="{ full: row.registered >= row.quota }">
                {{ row.registered }}/{{ row.quota }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType[row.status] || 'info'" size="small" effect="light" round>
              {{ statusLabel[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startDate" label="开始日期" width="120" />
        <el-table-column prop="endDate" label="结束日期" width="120" />
        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Pencil" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的赛事">
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
      :title="editingId ? '编辑赛事' : '新建赛事'"
      width="min(640px, 94vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="赛事名称" prop="title">
          <el-input v-model="form.title" placeholder="如：高校程序设计大赛" maxlength="40" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="主办方" prop="host">
              <el-input v-model="form.host" placeholder="如：智队搭平台" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="赛事类型">
              <el-select v-model="form.type">
                <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="开始日期" prop="startDate">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                placeholder="选择开始日期"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                style="width: 100%"
                @change="handleStartChange"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="结束日期" prop="endDate">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                placeholder="选择结束日期"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                :disabled-date="(d) => (form.startDate ? d.getTime() < new Date(form.startDate).getTime() - 86400000 : false)"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="已报名队伍数" prop="registered">
              <el-input-number
                v-model="form.registered"
                :min="0"
                :max="9999"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="队伍名额上限" prop="quota">
              <el-input-number
                v-model="form.quota"
                :min="1"
                :max="9999"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="赛事状态">
          <el-radio-group v-model="form.status">
            <el-radio-button v-for="o in statusOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalOpen = false">取 消</el-button>
        <el-button type="primary" @click="save">{{ editingId ? '保存修改' : '创建赛事' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.search { width: 260px; }
.filter { width: 140px; }
.reset-btn { margin-left: 2px; }
.prefix-ico { color: var(--t3); }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}
.min-w-0 { min-width: 0; }
.reg-cell { display: flex; align-items: center; gap: 10px; }
.reg-progress { flex: 1; min-width: 80px; }
.reg-txt {
  font-size: 12.5px; color: var(--t2); white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.reg-txt.full { color: var(--c-warning); font-weight: 600; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

@media (max-width: 640px) {
  .search { width: 100%; }
  .filter { flex: 1; min-width: 0; }
  .table-foot { justify-content: center; }
}
</style>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Search, RotateCcw, Trophy, Pencil, Trash2, Sparkles } from 'lucide-vue-next'
import { useCompetitionsStore } from '@/stores/competitions'
import { COMP_LEVELS, COMP_STATUS, COMP_TYPES } from '@/api/competitions'
import { useToast } from '@/composables/toast'

const store = useCompetitionsStore()
const { toast } = useToast()

/* 枚举直接取自契约层，页面不另写一份（避免与后端漂移） */
const levelTag = { 国A: 'danger', 国B: 'warning', 国C: 'primary', 省A: 'success', 省B: 'info', 省C: 'info' }
const statusTag = { 报名中: 'success', 未开始: 'primary', 已结束: 'info' }

/* ---------------- 筛选：契约只提供 keyword + status ---------------- */
const keyword = ref('')
const statusFilter = ref('')

function search() {
  store.applyFilter({ keyword: keyword.value.trim(), status: statusFilter.value })
}
function resetFilter() {
  keyword.value = ''
  statusFilter.value = ''
  store.applyFilter({ keyword: '', status: '' })
}

/* ---------------- 新建 / 编辑：字段＝契约第 4 节 DTO ----------------
   注意：content（AI 简介）不在表单里 —— 它由 POST /competitions/:cid/ai-detail 生成 */
const emptyForm = () => ({
  name: '', url: '', level: '省B', type: '团体', status: '未开始',
  start: '', end: '', organizer: '',
})

const modalOpen = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())
const editingId = ref(null)

const rules = {
  name: [
    { required: true, message: '请填写赛事名称', trigger: 'blur' },
    { max: 40, message: '赛事名称不能超过 40 个字', trigger: 'blur' },
  ],
  start: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  end: [
    { required: true, message: '请选择结束日期', trigger: 'change' },
    {
      validator: (_r, v, cb) => {
        if (form.start && v && v < form.start) return cb(new Error('结束日期不能早于开始日期'))
        cb()
      },
      trigger: 'change',
    },
  ],
}

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
  modalOpen.value = true
}

function openEdit(row) {
  editingId.value = row.cid
  Object.assign(form, {
    name: row.name, url: row.url || '', level: row.level, type: row.type,
    status: row.status, start: row.start, end: row.end, organizer: row.organizer || '',
  })
  formRef.value?.clearValidate()
  modalOpen.value = true
}

function save() {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    const payload = {
      name: form.name.trim(), url: form.url.trim(), level: form.level, type: form.type,
      status: form.status, start: form.start, end: form.end, organizer: form.organizer.trim(),
    }
    try {
      if (editingId.value) {
        await store.update(editingId.value, payload)
        toast('赛事信息已更新')
      } else {
        await store.create(payload)
        toast('赛事已创建')
      }
      modalOpen.value = false
    } catch (err) {
      toast(err.message || '保存失败', 'error')
    }
  })
}

/* ---------------- 删除：联动清理队伍的 cid_list（服务端已处理，这里只提示） ---------------- */
function askDelete(row) {
  ElMessageBox.confirm(
    `确定要删除赛事「${row.name}」吗？删除后队伍中关联的该赛事记录将一并清理，此操作不可恢复。`,
    '删除赛事',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(async () => {
      try {
        await store.remove(row.cid)
        toast(`赛事「${row.name}」已删除`, 'info')
      } catch (err) {
        toast(err.message || '删除失败', 'error')
      }
    })
    .catch(() => {
      /* 取消 */
    })
}

/* ---------------- AI 生成简介：10~25s 慢接口，只锁当前行 ---------------- */
function askGenerate(row) {
  const isRegen = !!row.content
  ElMessageBox.confirm(
    isRegen
      ? `确定重新生成赛事「${row.name}」的 AI 简介吗？\n将调用大模型，耗时 10~25 秒，期间你可以继续浏览和翻页；生成结果会覆盖现有内容。`
      : `确定为赛事「${row.name}」生成 AI 简介吗？\n将调用大模型，耗时 10~25 秒，期间你可以继续浏览和翻页。`,
    isRegen ? '重新生成 AI 简介' : 'AI 生成简介',
    {
      type: 'info',
      confirmButtonText: isRegen ? '重新生成' : '开始生成',
      cancelButtonText: '取消',
    },
  )
    .then(async () => {
      try {
        await store.generateAiDetail(row.cid)
        toast('AI 简介已生成')
      } catch (err) {
        // 失败不锁死按钮：generatingCid 已复位，用户可以直接重试
        toast(err.message || '生成失败，请重试', 'error')
      }
    })
    .catch(() => {
      /* 取消 */
    })
}

const period = (row) => `${row.start || '即日起'} ~ ${row.end || '待定'}`

onMounted(() => store.fetchList())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>赛事管理</h2>
        <div class="page-sub">共 {{ store.total }} 场赛事</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="Trophy" @click="openAdd">新建赛事</el-button>
      </div>
    </div>

    <div class="card table-card" v-loading="store.loading">
      <div class="toolbar toolbar-pad">
        <el-input
          v-model="keyword"
          class="search"
          clearable
          placeholder="搜索赛事名称 / 主办方"
          @keyup.enter="search"
          @clear="search"
        >
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-select v-model="statusFilter" class="filter" clearable placeholder="全部状态" @change="search">
          <el-option v-for="s in COMP_STATUS" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button class="reset-btn" :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="store.list" style="width: 100%">
        <el-table-column label="赛事" min-width="260">
          <template #default="{ row }">
            <div class="comp-name">
              <div class="name-main">{{ row.name }}</div>
              <div class="cell-sub">
                {{ row.organizer || '主办方未填写' }}
                <el-link
                  v-if="row.url"
                  :href="row.url"
                  target="_blank"
                  type="primary"
                  :underline="false"
                  class="ml-1"
                >
                  官网
                </el-link>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="levelTag[row.level] || 'info'" size="small" effect="light" round>
              {{ row.level }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="参赛形式" width="110">
          <template #default="{ row }">
            <el-tag type="primary" size="small" effect="plain" round>{{ row.type }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag[row.status] || 'info'" size="small" effect="light" round>
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="赛程" width="190">
          <template #default="{ row }">
            <span class="period">{{ period(row) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="AI 简介" width="110">
          <template #default="{ row }">
            <el-tag v-if="store.isGenerating(row.cid)" type="warning" size="small" effect="light" round>
              生成中…
            </el-tag>
            <el-tag v-else-if="row.content" type="success" size="small" effect="light" round>已生成</el-tag>
            <span v-else class="cell-sub">未生成</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="250" fixed="right" align="right">
          <template #default="{ row }">
            <!-- 只有 content 为空时才 Props 主按钮：引导管理员先生产内容 -->
            <el-button
              link
              :type="row.content ? 'info' : 'primary'"
              :icon="Sparkles"
              :disabled="store.isGenerating(row.cid)"
              :loading="store.isGenerating(row.cid)"
              @click="askGenerate(row)"
            >
              {{ store.isGenerating(row.cid) ? '生成中' : row.content ? '重新生成' : 'AI 生成' }}
            </el-button>
            <el-button link type="primary" :icon="Pencil" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="没有符合条件的赛事">
            <span class="empty-sub">试试调整搜索关键词或状态筛选</span>
          </el-empty>
        </template>
      </el-table>

      <div class="table-foot">
        <el-pagination
          :current-page="store.page"
          :page-size="store.pageSize"
          :total="store.total"
          :page-sizes="[8, 12, 20]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="store.goPage"
          @size-change="store.changePageSize"
        />
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog
      v-model="modalOpen"
      :title="editingId ? '编辑赛事' : '新建赛事'"
      width="min(680px, 94vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="赛事名称" prop="name">
          <el-input v-model="form.name" placeholder="如：蓝桥杯全国软件和信息技术专业人才大赛" maxlength="40" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="级别">
              <el-select v-model="form.level" class="w-full">
                <el-option v-for="l in COMP_LEVELS" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="参赛形式">
              <el-select v-model="form.type" class="w-full">
                <el-option v-for="t in COMP_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="赛事状态">
          <el-radio-group v-model="form.status">
            <el-radio-button v-for="s in COMP_STATUS" :key="s" :value="s">{{ s }}</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="开始日期" prop="start">
              <el-date-picker
                v-model="form.start"
                type="date"
                placeholder="选择开始日期"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="结束日期" prop="end">
              <el-date-picker
                v-model="form.end"
                type="date"
                placeholder="选择结束日期"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                :disabled-date="(d) => (form.start ? d.getTime() < new Date(form.start).getTime() : false)"
                class="w-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="主办方（选填）">
          <el-input v-model="form.organizer" placeholder="如：工业和信息化部人才交流中心" maxlength="30" />
        </el-form-item>

        <el-form-item label="官网链接（选填）">
          <el-input v-model="form.url" placeholder="https://" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modalOpen = false">取 消</el-button>
        <el-button type="primary" :loading="store.submitting" @click="save">
          {{ editingId ? '保存修改' : '创建赛事' }}
        </el-button>
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
.w-full { width: 100%; }
.ml-1 { margin-left: 8px; }
.min-w-0 { min-width: 0; }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}
.period { font-size: 12.5px; color: var(--t2); font-variant-numeric: tabular-nums; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

@media (max-width: 640px) {
  .search { width: 100%; }
  .filter { flex: 1; min-width: 0; }
  .table-foot { justify-content: center; }
}
</style>

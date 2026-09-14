<script setup>
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { RotateCcw, Search } from 'lucide-vue-next'
import { useUsersStore } from '@/stores/users'
import { USER_ROLES } from '@/api/users'
import { useToast } from '@/composables/toast'

const store = useUsersStore()
const { toast } = useToast()

/* 身份枚举取自契约层（api/users.js），页面不另写一份
   ⚠️ 权限看 isAdmin，role 只是身份 —— 所以列表要同时展示"身份"和"是否管理员" */
const roleOptions = USER_ROLES
const roleLabel = { student: '学生', teacher: '教师', admin: '管理员' }
const roleTag = { student: 'info', teacher: 'warning', admin: 'primary' }

const keyword = ref('')
const roleFilter = ref('')

function search() {
  store.applyFilter({ keyword: keyword.value.trim(), role: roleFilter.value })
}

function resetFilter() {
  keyword.value = ''
  roleFilter.value = ''
  store.applyFilter({ keyword: '', role: '' })
}

/* ---------------- 详情：email 只有详情接口才下发（契约 1.5） ---------------- */
const detailOpen = ref(false)
function openDetail(row) {
  detailOpen.value = true
  store.fetchDetail(row.uid)
}

/* ---------------- 管理员开关：改 isAdmin（权限），不动 role（身份） ---------------- */
function askToggleAdmin(row, next) {
  const action = next ? '授予' : '取消'
  ElMessageBox.confirm(
    next
      ? `确定授予「${row.username}」管理员权限吗？授予后该账号可以进入管理端、修改赛事数据。`
      : `确定取消「${row.username}」的管理员权限吗？取消后该账号将无法进入管理端。`,
    `${action}管理员权限`,
    {
      type: next ? 'info' : 'warning',
      confirmButtonText: `确认${action}`,
      cancelButtonText: '取消',
      customClass: next ? '' : 'stb-danger-confirm',
    },
  )
    .then(async () => {
      try {
        await store.toggleAdmin(row.uid, next)
        toast(next ? `已授予「${row.username}」管理员权限` : `已取消「${row.username}」的管理员权限`, 'success')
      } catch (err) {
        toast(err.message || '操作失败', 'error')
      }
    })
    .catch(() => {
      /* 取消：开关绑的是 row.isAdmin，没改 store，所以不会出现状态错位 */
    })
}

const avatarCls = (uid) => ['c1', 'c2', 'c3', 'c4'][Number(uid) % 4]
const firstChar = (name) => (name ? name.slice(0, 1) : '?')

onMounted(() => store.fetchList())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>用户管理</h2>
        <div class="page-sub">共 {{ store.total }} 位平台用户（学生 / 教师 / 管理员）</div>
      </div>
    </div>

    <div class="card table-card" v-loading="store.loading">
      <div class="toolbar toolbar-pad">
        <!-- 服务端搜索：显式触发，避免每敲一个字就打一次后端 -->
        <el-input
          v-model="keyword"
          class="search"
          clearable
          placeholder="搜索姓名 / 学号"
          @keyup.enter="search"
          @clear="search"
        >
          <template #prefix>
            <Search class="prefix-ico" :size="15" />
          </template>
        </el-input>
        <el-select v-model="roleFilter" class="filter" clearable placeholder="全部身份" @change="search">
          <el-option v-for="o in roleOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="search">查询</el-button>
        <el-button class="reset-btn" :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="store.list" style="width: 100%">
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="avatar" :class="avatarCls(row.uid)">{{ firstChar(row.username) }}</span>
              <div class="min-w-0">
                <div class="name-main">{{ row.username }}</div>
                <div class="cell-sub">学号/工号 {{ row.uid }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学院" min-width="150">
          <template #default="{ row }">{{ row.institute || '—' }}</template>
        </el-table-column>
        <el-table-column label="身份" width="100">
          <template #default="{ row }">
            <el-tag :type="roleTag[row.role] || 'info'" size="small" effect="light" round>
              {{ roleLabel[row.role] || row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="技能" width="90">
          <template #default="{ row }">{{ row.skills?.length || 0 }} 项</template>
        </el-table-column>
        <el-table-column label="队伍" width="90">
          <template #default="{ row }">{{ row.tid_list?.length || 0 }} 支</template>
        </el-table-column>
        <el-table-column label="匹配中" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_matching" type="success" size="small" effect="light" round>匹配中</el-tag>
            <span v-else class="cell-sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="管理端权限" width="130">
          <template #default="{ row }">
            <!-- 只改 isAdmin（权限），不动 role（身份）：老师也能被授予后台权限 -->
            <el-switch :model-value="row.isAdmin" @change="(val) => askToggleAdmin(row, val)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的用户">
            <span class="empty-sub">试试调整搜索关键词或身份筛选</span>
          </el-empty>
        </template>
      </el-table>

      <div class="table-foot">
        <el-pagination
          :current-page="store.page"
          :page-size="store.pageSize"
          :total="store.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="store.goPage"
          @size-change="store.changePageSize"
        />
      </div>
    </div>

    <!-- 详情弹窗：这里才有 email（列表接口已脱敏，契约 1.5） -->
    <el-dialog v-model="detailOpen" title="用户详情" width="min(620px, 92vw)" @closed="store.clearDetail()">
      <div v-loading="store.detailLoading">
        <el-descriptions v-if="store.detail" :column="2" border>
          <el-descriptions-item label="姓名">{{ store.detail.username }}</el-descriptions-item>
          <el-descriptions-item label="学号/工号">{{ store.detail.uid }}</el-descriptions-item>
          <el-descriptions-item label="身份">
            <el-tag :type="roleTag[store.detail.role] || 'info'" size="small" effect="light" round>
              {{ roleLabel[store.detail.role] || store.detail.role }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="管理端权限">
            <el-tag :type="store.detail.isAdmin ? 'success' : 'info'" size="small" effect="light" round>
              {{ store.detail.isAdmin ? '有' : '无' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ store.detail.email || '—' }}</el-descriptions-item>
          <el-descriptions-item label="匹配状态">
            {{ store.detail.is_matching ? '匹配中' : '未参与匹配' }}
          </el-descriptions-item>
          <el-descriptions-item label="学院">{{ store.detail.institute || '—' }}</el-descriptions-item>
          <el-descriptions-item label="技能">
            {{ store.detail.skills?.length || 0 }} 项（已评级 {{ Object.keys(store.detail.skill_rating || {}).length }} 项）
          </el-descriptions-item>
          <el-descriptions-item label="所属队伍">{{ store.detail.tid_list?.length || 0 }} 支</el-descriptions-item>
          <el-descriptions-item label="个人简介" :span="2">
            {{ store.detail.introduction || '—' }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="detail-note">
          说明：邮箱只在详情接口下发，列表接口已脱敏（对齐云函数 searchUsers / getBatchUids 的既有行为）。
        </div>
      </div>
      <template #footer>
        <el-button @click="detailOpen = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.search { width: 240px; }
.filter { width: 130px; }
.reset-btn { margin-left: 2px; }
.prefix-ico { color: var(--t3); }
.min-w-0 { min-width: 0; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}

.detail-note {
  margin-top: 12px; padding: 9px 12px;
  font-size: 12.5px; line-height: 1.6; color: var(--t3);
  background: var(--bg-soft, #f7f8fc); border-radius: 8px;
}

@media (max-width: 640px) {
  .search { width: 100%; }
  .filter { flex: 1; min-width: 0; }
  .table-foot { justify-content: center; }
}
</style>

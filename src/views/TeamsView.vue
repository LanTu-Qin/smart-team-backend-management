<script setup>
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import { useTeamsStore } from '@/stores/teams'
import { useToast } from '@/composables/toast'

const store = useTeamsStore()
const { toast } = useToast()

/* 准入限制（源码确认，契约第 6 节）：0 无需审核 / 1 需审核 / 2 仅邀请（≠2 才可进匹配池） */
const conditionLabel = { 0: '无需审核', 1: '需审核', 2: '仅邀请' }
const conditionTag = { 0: 'success', 1: 'warning', 2: 'info' }

/* ---------------- 筛选：契约只提供"按赛事 cid"过滤 ---------------- */
const cidFilter = ref('')
function onFilterChange(val) {
  store.applyFilter({ cid: val ?? '' })
}
function resetFilter() {
  cidFilter.value = ''
  store.applyFilter({ cid: '' })
}

/* ---------------- 详情：GET /teams/:tid（成员名由接口回填） ---------------- */
const detailOpen = ref(false)
function openDetail(row) {
  detailOpen.value = true
  store.fetchDetail(row.tid)
}

/* ---------------- 删除：契约里管理端唯一的写操作，危险操作需二次确认 ---------------- */
function askDelete(row) {
  ElMessageBox.confirm(
    `确定要解散队伍「${row.name}」吗？删除后队长的组队关系将被清理，此操作不可恢复。`,
    '解散队伍',
    {
      type: 'warning',
      confirmButtonText: '确认解散',
      cancelButtonText: '取消',
      customClass: 'stb-danger-confirm',
    },
  )
    .then(async () => {
      try {
        await store.remove(row.tid)
        toast(`队伍「${row.name}」已解散`, 'info')
      } catch (err) {
        toast(err.message || '解散失败', 'error')
      }
    })
    .catch(() => {
      /* 取消 */
    })
}

const firstChar = (name) => (name || '队').slice(0, 1)
const sizeText = (row) => `${row.members?.length || 0}/${row.maxNum}`

onMounted(() => store.init())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>队伍管理</h2>
        <div class="page-sub">
          共 {{ store.total }} 支队伍 · 管理端仅支持查看与解散，组队/加人在小程序端完成
        </div>
      </div>
    </div>

    <div class="card table-card" v-loading="store.loading">
      <div class="toolbar toolbar-pad">
        <el-select
          v-model="cidFilter"
          class="filter filter-wide"
          clearable
          placeholder="全部赛事"
          @change="onFilterChange"
        >
          <el-option
            v-for="c in store.compOptions"
            :key="c.cid"
            :label="c.name"
            :value="c.cid"
          />
        </el-select>
        <el-button :icon="RotateCcw" @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="store.list" style="width: 100%">
        <el-table-column label="队伍" min-width="230">
          <template #default="{ row }">
            <div class="team-cell">
              <span class="avatar c1">{{ firstChar(row.name) }}</span>
              <div class="min-w-0">
                <div class="name-main">
                  {{ row.name }}
                  <el-tag v-if="row.isPersonal" size="small" effect="plain" round class="ml-1">
                    个人参赛
                  </el-tag>
                </div>
                <div class="cell-sub" :title="row.intro">{{ row.intro || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="参与赛事" min-width="180">
          <template #default="{ row }">
            <div class="comp-cell">
              <el-tag
                v-for="cid in row.cid_list || []"
                :key="cid"
                size="small"
                type="info"
                effect="plain"
                round
                disable-transitions
              >
                {{ store.compName(cid) }}
              </el-tag>
              <span v-if="!row.cid_list?.length" class="cell-sub">未报名赛事</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="队长" width="110">
          <template #default="{ row }">
            <span class="captain">{{ row.leader?.username }}</span>
          </template>
        </el-table-column>

        <el-table-column label="成员" min-width="200">
          <template #default="{ row }">
            <div class="member-cell">
              <el-tag
                v-for="m in (row.members || []).slice(0, 3)"
                :key="m.uid"
                size="small"
                effect="plain"
                round
                disable-transitions
              >
                {{ m.username }}
              </el-tag>
              <el-tag
                v-if="(row.members || []).length > 3"
                size="small"
                type="info"
                effect="plain"
                round
                disable-transitions
              >
                +{{ row.members.length - 3 }}
              </el-tag>
              <span v-if="!row.members?.length" class="cell-sub">暂无成员</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="规模" width="90">
          <template #default="{ row }">{{ sizeText(row) }}</template>
        </el-table-column>

        <el-table-column label="准入" width="110">
          <template #default="{ row }">
            <el-tag :type="conditionTag[row.condition] || 'info'" size="small" effect="light" round>
              {{ conditionLabel[row.condition] ?? '未知' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="匹配池" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_matching" type="success" size="small" effect="light" round>
              匹配中
            </el-tag>
            <span v-else class="cell-sub">—</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button link type="danger" :icon="Trash2" @click="askDelete(row)">解散</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="没有符合条件的队伍">
            <span class="empty-sub">试试切换赛事筛选条件</span>
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

    <!-- 队伍详情 -->
    <el-dialog
      v-model="detailOpen"
      title="队伍详情"
      width="min(680px, 94vw)"
      @closed="store.clearDetail()"
    >
      <div v-loading="store.detailLoading">
        <el-descriptions v-if="store.detail" :column="2" border>
          <el-descriptions-item label="队伍名称">{{ store.detail.name }}</el-descriptions-item>
          <el-descriptions-item label="队伍 ID">{{ store.detail.tid }}</el-descriptions-item>
          <el-descriptions-item label="队长">{{ store.detail.leader?.username }}</el-descriptions-item>
          <el-descriptions-item label="参赛形式">
            {{ store.detail.isPersonal ? '个人参赛' : '团队参赛' }}
          </el-descriptions-item>
          <el-descriptions-item label="规模">
            {{ store.detail.members?.length || 0 }} / {{ store.detail.maxNum }} 人
          </el-descriptions-item>
          <el-descriptions-item label="准入限制">
            {{ conditionLabel[store.detail.condition] ?? '未知' }}
          </el-descriptions-item>
          <el-descriptions-item label="匹配池">
            <el-tag :type="store.detail.is_matching ? 'success' : 'info'" size="small" effect="light" round>
              {{ store.detail.is_matching ? '匹配中' : '未加入' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="参与赛事">
            <el-tag
              v-for="cid in store.detail.cid_list || []"
              :key="cid"
              size="small"
              type="info"
              effect="plain"
              round
              class="mr-1"
            >
              {{ store.compName(cid) }}
            </el-tag>
            <span v-if="!store.detail.cid_list?.length">—</span>
          </el-descriptions-item>

          <el-descriptions-item label="成员" :span="2">
            <div class="member-cell">
              <el-tag
                v-for="m in store.detail.members || []"
                :key="m.uid"
                size="small"
                effect="plain"
                round
                disable-transitions
              >
                {{ m.username }}<span v-if="m.skillName" class="tag-sub">· {{ m.skillName }}</span>
              </el-tag>
              <span v-if="!store.detail.members?.length" class="cell-sub">暂无成员</span>
            </div>
          </el-descriptions-item>

          <el-descriptions-item label="指导老师" :span="2">
            <span v-if="store.detail.advisor?.length">
              {{ store.detail.advisor.map((a) => a.username).join('、') }}
            </span>
            <span v-else class="cell-sub">未设置</span>
          </el-descriptions-item>

          <el-descriptions-item label="招募需求" :span="2">
            <span v-if="store.detail.needs?.length">
              {{ store.detail.needs.map((n) => `${n.name} ×${n.count}`).join('、') }}
            </span>
            <span v-else class="cell-sub">暂未填写</span>
          </el-descriptions-item>

          <el-descriptions-item label="缺口" :span="2">
            <span v-if="store.detail.missing?.length">
              {{ store.detail.missing.map((n) => `${n.name} ×${n.count}`).join('、') }}
            </span>
            <span v-else class="cell-sub">无缺口</span>
          </el-descriptions-item>

          <el-descriptions-item label="队伍简介" :span="2">
            {{ store.detail.intro || '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailOpen = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-pad { padding: 12px 16px; margin-bottom: 0; }
.filter-wide { width: 280px; }
.min-w-0 { min-width: 0; }
.ml-1 { margin-left: 6px; }
.mr-1 { margin-right: 6px; }

.table-foot {
  display: flex; justify-content: flex-end;
  padding: 14px 16px; border-top: 1px solid var(--border-light);
}
.team-cell { display: flex; align-items: center; gap: 11px; }
.captain { font-weight: 600; }
.comp-cell, .member-cell { display: flex; flex-wrap: wrap; gap: 5px; }
.tag-sub { opacity: 0.65; margin-left: 2px; }
.empty-sub { font-size: 12.5px; color: var(--t3); }

@media (max-width: 640px) {
  .filter-wide { width: 100%; }
  .table-foot { justify-content: center; }
}
</style>

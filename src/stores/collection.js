// 通用集合持久化：localStorage 读写 + 种子数据
const PREFIX = 'stb-collection:'

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function loadCollection(key, seed) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.items)) return data
    }
  } catch (e) {
    /* ignore corrupted storage */
  }
  const items = seed.map((s) => ({ ...s }))
  const nextId = Math.max(0, ...items.map((i) => Number(i.id) || 0)) + 1
  return { items, nextId }
}

export function saveCollection(key, state) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ items: state.items, nextId: state.nextId }))
  } catch (e) {
    /* storage may be unavailable */
  }
}

export { todayStr }

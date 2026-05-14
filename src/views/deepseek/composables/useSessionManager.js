import { ref, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MODEL_CONFIG, STORAGE_KEYS } from '@/config/deepseek'

function safeParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

function migrateOldStorageKeys() {
  const OLD_LIST = 'list', OLD_INDEX = 'index'
  if (localStorage.getItem(STORAGE_KEYS.sessionList) == null && localStorage.getItem(OLD_LIST)) {
    localStorage.setItem(STORAGE_KEYS.sessionList, localStorage.getItem(OLD_LIST))
    localStorage.setItem(STORAGE_KEYS.activeIndex, localStorage.getItem(OLD_INDEX) || '-1')
    localStorage.removeItem(OLD_LIST)
    localStorage.removeItem(OLD_INDEX)
  }
}

export function useSessionManager(loading, messageRef) {
  const sessionList = ref([])
  const activeIndex = ref(-1)
  const editIndex = ref(-1)

  const queryInfos = ref({
    messages: [],
    model: 'deepseek-chat',
    ...MODEL_CONFIG
  })

  watch(sessionList, (val) => {
    const list = val.map((o, i) => ({
      ...o,
      messages: i === activeIndex.value ? queryInfos.value.messages : o.messages
    }))
    localStorage.setItem(STORAGE_KEYS.sessionList, JSON.stringify(list))
  }, { deep: true })

  watch(activeIndex, (val) => {
    localStorage.setItem(STORAGE_KEYS.activeIndex, JSON.stringify(val))
  })

  function init() {
    migrateOldStorageKeys()
    sessionList.value = safeParse(localStorage.getItem(STORAGE_KEYS.sessionList), [])
    const listLen = sessionList.value.length
    const lastIndex = safeParse(localStorage.getItem(STORAGE_KEYS.activeIndex), -1)
    activeIndex.value = listLen ? (lastIndex !== -1 ? lastIndex : 0) : -1
    if (activeIndex.value !== -1) {
      queryInfos.value.messages = sessionList.value[activeIndex.value]?.messages || []
    }
  }

  function handleAddSession() {
    if (loading.value) {
      ElMessage({ type: 'warning', message: '请当前问题查询完成后重试！' })
      return
    }
    sessionList.value.push({
      title: `对话${sessionList.value.length + 1}`,
      crtTime: new Date(),
      messages: []
    })
    queryInfos.value.messages = []
    activeIndex.value = sessionList.value.length - 1
  }

  function handleDeleteSession(index = 0) {
    ElMessageBox.confirm('确认删除当前对话？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      sessionList.value.splice(index, 1)
      if (index === activeIndex.value) {
        activeIndex.value = sessionList.value[index] ? index : --index
      } else if (index < activeIndex.value) {
        activeIndex.value = --activeIndex.value
      }
      queryInfos.value.messages = activeIndex.value > -1 ? sessionList.value[activeIndex.value].messages : []
      handleChangeSessionIndex(activeIndex.value)
    }).catch(() => {})
  }

  function handleClearSession(index) {
    sessionList.value[index].messages = []
    queryInfos.value.messages = sessionList.value[index].messages
    activeIndex.value = index
  }

  function handleFocusInput(index) { editIndex.value = index }

  async function handleChangeSessionIndex(index) {
    if (loading.value) {
      ElMessage({ type: 'warning', message: '请当前问题查询完成后重试！' })
      return
    }
    activeIndex.value = index
    queryInfos.value.messages = sessionList.value[activeIndex.value]?.messages || []
    await nextTick()
    messageRef.value?.scrollBottom()
  }

  function handleClearStorage() {
    localStorage.removeItem(STORAGE_KEYS.sessionList)
    localStorage.removeItem(STORAGE_KEYS.activeIndex)
    queryInfos.value.messages = []
    sessionList.value = []
    activeIndex.value = -1
  }

  return {
    sessionList, activeIndex, editIndex, queryInfos,
    init, handleAddSession, handleDeleteSession, handleClearSession,
    handleFocusInput, handleChangeSessionIndex, handleClearStorage
  }
}

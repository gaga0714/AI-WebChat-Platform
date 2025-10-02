<script setup>
import { ref, watch, onMounted, nextTick, onBeforeUnmount,computed} from 'vue'
import MessageComp from './components/messageComp.vue'
import { Promotion, Delete, EditPen, Brush, Plus, Fold, Expand } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MobileDetect from 'mobile-detect'
import { MODEL_CONFIG, STORAGE_KEYS } from '@/config/deepseek' 
//断点
const BREAKPOINTS={
  hideDesc:1100,//隐藏顶部文字
  collapseSiderbar:1200,//自动折叠侧边栏
  mobile:768//移动端
}

const viewportWidth=ref(window.innerWidth);//网页内容部分高度
let resizeTimer=null;
const userToggledSider=ref(false);//用户是否手动点过折叠按钮



// —— 响应式数据
const isMobile = ref(false)
const sessionList = ref([])
const activeIndex = ref(-1)
const editIndex = ref(-1)
const totalAmt = ref(0)
const queryKeys = ref('')//输入内容
const loading = ref(false)//是否处于请求中（防止重复发送请求）
const messageRef = ref(null)//自组件messageComp的引用，用来调用scrollBottom，使消息区始终滚动到底部
const isSidebarCollapsed = ref(false)


const updateViewportWidth=()=>{
  //节流，避免频繁触发
  if(resizeTimer) return;
  resizeTimer=setTimeout(()=>{
    viewportWidth.value=window.innerWidth;
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer=null;
  },80)
}

watch(viewportWidth,(w)=>{
  //自动折叠
  if(!userToggledSider.value){
    isSidebarCollapsed.value=w<BREAKPOINTS.collapseSiderbar;
  }
  //宽度足够大时自动展开
  if(!userToggledSider.value&&w>=BREAKPOINTS.collapseSiderbar){
    isSidebarCollapsed.value=false;
  }
  //移动端
  isMobile.value=w<BREAKPOINTS.mobile;
})

//顶部描述文字控制
const showTopDesc=computed(()=>{
  return !isMobile.value&&viewportWidth.value>=BREAKPOINTS.hideDesc;
})


const toggleSidebar = () => { 
  userToggledSider.value=true;//如果用户手动点展开，就不被自动折叠覆盖
  isSidebarCollapsed.value = !isSidebarCollapsed.value 
}

const queryInfos = ref({
  messages: [],
  model: 'deepseek-chat',
  ...MODEL_CONFIG
})

// —— 持久化
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

// —— 工具函数
const handleClearStorage = () => {
  localStorage.removeItem(STORAGE_KEYS.sessionList)
  localStorage.removeItem(STORAGE_KEYS.activeIndex)
  queryInfos.value.messages = []
  sessionList.value = []
  activeIndex.value = -1
}

const initSessionList = () => {
  sessionList.value = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionList) || '[]')
}

const initIndex = () => {
  const listLen = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionList) || '[]').length
  const lastIndex = JSON.parse(localStorage.getItem(STORAGE_KEYS.activeIndex) || '-1')
  if (listLen) {
    activeIndex.value = (lastIndex !== -1) ? lastIndex : 0
  } else {
    activeIndex.value = -1
  }
  if (activeIndex.value !== -1) {
    queryInfos.value.messages = sessionList.value[activeIndex.value].messages || []
  }
}

const handleAddSession = () => {
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

const handleDeleteSession = (index = 0) => {
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

const handleClearSession = (index) => {
  sessionList.value[index].messages = []
  queryInfos.value.messages = sessionList.value[index].messages
  activeIndex.value = index
}

const handleFocusInput = (index) => { editIndex.value = index }

const handleChangeSessionIndex = async (index) => {
  if (loading.value) {
    ElMessage({ type: 'warning', message: '请当前问题查询完成后重试！' })
    return
  }
  activeIndex.value = index
  queryInfos.value.messages = sessionList.value[activeIndex.value]?.messages || []
  await nextTick()
  messageRef.value?.scrollBottom()
}

// —— 余额：改为请求后端 /api/balance（后端用环境变量的 Key 去查）
const initToken = async () => {
  try {
    const r = await fetch('/api/balance')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()

    // 根据返回结构取值（两种常见风格，按你实际接口调整）
    // ① 类 OpenAI credit_grants
    if (data?.total_granted !== undefined) {
      const remaining = (data.total_granted || 0) - (data.total_used || 0)
      totalAmt.value = Number((remaining || 0).toFixed(4))
      return
    }
    // ② 你自己的后端风格：{ balance_infos: [{ total_balance: '123.45' }, ...] }
    if (Array.isArray(data?.balance_infos)) {
      let sum = 0
      for (const o of data.balance_infos) sum += Number(o.total_balance || 0)
      totalAmt.value = sum
      return
    }

    totalAmt.value = 0
  } catch (e) {
    console.error('initToken error:', e)
    totalAmt.value = 0
  }
}

// —— 核心：SSE 流式读取（代理到后端 /api/chat）
async function streamDeepseek({ model, messages, onDelta }) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify({ model, messages, stream: true })
  })
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)

      if (!line || line.startsWith(':')) continue
      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content || ''
        if (delta) onDelta(delta)
      } catch {
        onDelta(payload) // 非 JSON 情况
      }
    }
  }
}

// —— 发送请求
const handleRequest = async () => {
  if (!queryKeys.value) return
  if (!sessionList.value.length) await handleAddSession()

  // 1) 追加用户消息（移除 name 字段，兼容性更好）
  queryInfos.value.messages.push({ role: 'user', content: queryKeys.value })
  queryKeys.value = null
  messageRef.value?.scrollBottom()

  try {
    loading.value = true
    // 2) 预置 assistant 空消息
    queryInfos.value.messages.push({ role: 'assistant', content: '' })

    // 3) 流式追加
    await streamDeepseek({
      model: queryInfos.value.model || 'deepseek-chat',
      messages: queryInfos.value.messages.slice(0, -1), // 不把占位这条传上去
      onDelta: (chunk) => {
        queryInfos.value.messages[queryInfos.value.messages.length - 1].content += chunk
        messageRef.value?.scrollBottom()
      }
    })

    // 4) 持久化会话
    sessionList.value[activeIndex.value].messages = queryInfos.value.messages
  } catch (error) {
    queryInfos.value.messages[queryInfos.value.messages.length - 1].content = String(error?.message || error)
  } finally {
    loading.value = false
  }
}

// —— 生命周期
onMounted(async () => {
  const meta = document.createElement('meta')
  meta.name = 'viewport'
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
  document.head.appendChild(meta)

  initSessionList()
  initIndex()
  initToken()

  const md = new MobileDetect(window.navigator.userAgent)
  isMobile.value = md.mobile()
  await nextTick()
  messageRef.value?.scrollBottom()
  window.addEventListener('resize',updateViewportWidth);
  updateViewportWidth();
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
})
</script>

<template>
  <div class="page">
    <div class="grid-space-between" :class="[!isMobile ? 'grid-box' : '', isSidebarCollapsed ? 'collapsed' : '']">
      <div class="left-container" v-if="!isMobile">
        <div class="sidebar-toggle" @click.stop="toggleSidebar" title="折叠/展开侧边栏"
             style="cursor: pointer; font-weight: bold; padding-bottom: 8px; display: flex; justify-content: center; align-items: center;">
          <el-icon :size="20"><component :is="isSidebarCollapsed ? Fold : Expand" /></el-icon>
        </div>

        <el-button v-if="!isSidebarCollapsed" type="primary" class="add-btn" :icon="Plus"
          size="large" @click="handleAddSession">新建对话</el-button>

        <div class="session-area" v-if="!isSidebarCollapsed">
          <div class="session-item" :class="activeIndex == index ? 'session-item-active' : ''"
               v-for="(item, index) in sessionList" :key="index" @click="handleChangeSessionIndex(index)">
            <span :class="activeIndex == index ? 'active-node' : 'normal-node'" v-if="editIndex != index">{{ item.title }}</span>
            <el-input :ref="`renameRef_${index}`" autofocus v-model="item.title" v-else size="small"
                      style="width: 120px" @blur="editIndex = -1" @change="editIndex = -1" />
            <div class="icon-box">
              <el-icon class="icon" color="#fff" @click.stop="handleClearSession(index)"><Brush /></el-icon>
              <el-icon class="icon" color="#fff" @click.stop="handleFocusInput(index)"><EditPen /></el-icon>
              <el-icon class="icon" color="#fff" @click.stop="handleDeleteSession(index)"><Delete /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="tips">
          <div class="title">{{ queryInfos.model }}</div>
          <div class="desc" v-if="showTopDesc">本网站采用本地缓存模式运行，不会留存任何涉及个人的信息数据，请放心使用。</div>
          <div @click="handleClearStorage" v-else class="pointer">清空</div>
        </div>

        <div class="message-area">
          <MessageComp ref="messageRef" :message="queryInfos.messages" :loading="loading" />
        </div>

        <div class="user-tokens" :class="isMobile ? 'left-space' : ''">
          <span>当前余额为：￥{{ totalAmt || 0 }}</span>
        </div>

        <div class="input-area" :class="isMobile ? 'left-space' : ''">
          <el-input v-model="queryKeys" id="keyInput" :autosize="{minRows:2,maxRows:4}" type="textarea"
            placeholder="请输入内容" show-word-limit
            @keydown.enter.prevent="(e) => { if (e.isComposing || loading) return; handleRequest(); }" />
          <el-button style="height: 50px;width: 50px;border-radius: 50%;margin-right: 50px;" type="primary" @click="handleRequest" :disabled="!queryKeys" :loading="loading">
            <el-icon :size="26"><Promotion /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './styles/common.scss' as *
</style>

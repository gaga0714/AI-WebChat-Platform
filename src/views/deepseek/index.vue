<script setup>
import { ref, onMounted, nextTick } from 'vue'
import MessageComp from './components/messageComp.vue'
import { Promotion, Delete, EditPen, Brush, Plus, Fold, Expand } from '@element-plus/icons-vue'
import { useResponsive } from './composables/useResponsive'
import { useSessionManager } from './composables/useSessionManager'
import { useStreamChat } from './composables/useStreamChat'
import { useBalance } from './composables/useBalance'

const queryKeys = ref('')
const messageRef = ref(null)

const { isMobile, isSidebarCollapsed, showTopDesc, toggleSidebar } = useResponsive()
const { totalAmt, fetchBalance } = useBalance()

const {
  sessionList, activeIndex, editIndex, queryInfos,
  init: initSessions, handleAddSession, handleDeleteSession,
  handleClearSession, handleFocusInput, handleChangeSessionIndex, handleClearStorage
} = useSessionManager(ref(false), messageRef)

const { loading, agentMode, handleRequest, handleRetry } = useStreamChat(
  queryInfos, sessionList, activeIndex, messageRef
)

const doSend = () => handleRequest(queryKeys, handleAddSession)

onMounted(async () => {
  initSessions()
  fetchBalance()
  await nextTick()
  messageRef.value?.scrollBottom()
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
          <div class="agent-toggle">
            <el-tooltip content="开启后可使用 Tavily 联网搜索实时信息（天气、新闻等）" placement="bottom">
              <el-switch v-model="agentMode" active-text="Agent" inactive-text="普通" />
            </el-tooltip>
            <span v-if="loading && agentMode" class="agent-loading-hint">正在使用联网搜索…</span>
          </div>
        </div>

        <div class="message-area">
          <MessageComp ref="messageRef" :message="queryInfos.messages" :loading="loading" @retry="handleRetry" />
        </div>

        <div class="user-tokens" :class="isMobile ? 'left-space' : ''">
          <span>当前余额为：￥{{ totalAmt || 0 }}</span>
        </div>

        <div class="input-area" :class="isMobile ? 'left-space' : ''">
          <el-input v-model="queryKeys" id="keyInput" :autosize="{minRows:2,maxRows:4}" type="textarea"
            placeholder="请输入内容" show-word-limit
            @keydown.enter.prevent="(e) => { if (e.isComposing || loading) return; doSend(); }" />
          <el-button style="height: 50px;width: 50px;border-radius: 50%;margin-right: 50px;" type="primary" @click="doSend" :disabled="!queryKeys" :loading="loading">
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

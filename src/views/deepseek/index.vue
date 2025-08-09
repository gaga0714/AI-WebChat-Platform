<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import OpenAI from "openai";
import MessageComp from "./components/messageComp.vue";
import { Promotion, Delete, EditPen, Brush, Plus, Fold, Expand } from "@element-plus/icons-vue";
import { getTokens } from "@/api/modules/deepseek.js";
import { ElMessage, ElMessageBox } from "element-plus";
import MobileDetect from "mobile-detect";
import { API_CONFIG as DEEPSEEK_CONFIG, MODEL_CONFIG, STORAGE_KEYS } from '@/config/deepseek';
import { API_CONFIG as GEMINI_CONFIG,MODEL_CONFIG as GEMINI_MODEL_CONFIG } from '@/config/gemini';

// 响应式数据
const isMobile = ref(false);
const sessionList = ref([]);
const activeIndex = ref(-1);
const editIndex = ref(-1);
const totalAmt = ref(0);
const queryKeys = ref("");
const openai = ref(null);
const loading = ref(false);
const messageRef = ref(null);
const isSidebarCollapsed = ref(false); // 是否折叠侧边栏

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const queryInfos = ref({
  messages: [],
  model:'deepseek-chat',
  ...MODEL_CONFIG
});

const currentConfig = ref(DEEPSEEK_CONFIG);

// 监听数据变化
watch(sessionList, (val) => {
  const list = val.map((o, i) => ({
    ...o,
    messages: i === activeIndex.value ? queryInfos.value.messages : o.messages
  }));
  localStorage.setItem(STORAGE_KEYS.sessionList, JSON.stringify(list));
}, { deep: true });

watch(activeIndex, (val) => {
  localStorage.setItem(STORAGE_KEYS.activeIndex, JSON.stringify(val));
}, { deep: true });

// 方法
const handleClearStorage = () => {
  localStorage.removeItem(STORAGE_KEYS.sessionList);
  localStorage.removeItem(STORAGE_KEYS.activeIndex);
  queryInfos.value.messages = [];
  sessionList.value = [];
  activeIndex.value = -1;
};

const initSessionList = () => {
  sessionList.value = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionList) || "[]");
};

const initIndex = () => {
  const listLen = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionList) || "[]").length;
  const lastIndex = JSON.parse(localStorage.getItem(STORAGE_KEYS.activeIndex) || "-1");
  if (listLen) {
    activeIndex.value = lastIndex || 0;
  } else {
    activeIndex.value = -1;
  }
  if (activeIndex.value != -1) {
    queryInfos.value.messages = sessionList.value[activeIndex.value].messages || [];
  }
};

const handleAddSession = () => {
  if (loading.value) {
    ElMessage({ type: "warning", message: "请当前问题查询完成后重试！" });
    return;
  }
  sessionList.value.push({
    title: `对话${sessionList.value.length + 1}`,
    crtTime: new Date(),
    messages: [],
  });
  queryInfos.value.messages = [];
  activeIndex.value = sessionList.value.length - 1;
};

const handleDeleteSession = (index = 0) => {
  ElMessageBox.confirm("确认删除当前对话？", "警告", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  }).then(() => {
    sessionList.value.splice(index, 1);
    if (index == activeIndex.value) {
      activeIndex.value = sessionList.value[index] ? index : --index;
    } else if (index < activeIndex.value) {
      activeIndex.value = --activeIndex.value;
    }
    queryInfos.value.messages = activeIndex.value > -1 ? sessionList.value[activeIndex.value].messages : [];
    handleChangeSessionIndex(activeIndex.value);
  }).catch(() => { });
};

const handleClearSession = (index) => {
  sessionList.value[index].messages = [];
  queryInfos.value.messages = sessionList.value[index].messages;
  activeIndex.value = index;
};

const handleFocusInput = (index) => {
  editIndex.value = index;
};

const handleChangeSessionIndex = async (index) => {
  if (loading.value) {
    ElMessage({ type: "warning", message: "请当前问题查询完成后重试！" });
    return;
  }
  activeIndex.value = index;
  queryInfos.value.messages = sessionList.value[activeIndex.value]?.messages || [];
  await nextTick()
  messageRef.value.scrollBottom();
};

const initOpenAI = () => {
  openai.value = new OpenAI({
    ...currentConfig.value
  });
};

const handleModelChange = (value) => {
  currentConfig.value = value === 'deepseek-chat' ? DEEPSEEK_CONFIG : GEMINI_CONFIG;
  initOpenAI();
};

const initToken = async () => {
  const res = await getTokens({
    deepseek: "Y",
    gptToken: DEEPSEEK_CONFIG.apiKey,
  });
  const { balance_infos = [] } = res;
  balance_infos.forEach((o) => {
    totalAmt.value += Number(o.total_balance);
  });
};

const handleRequest = async () => {
  if (!queryKeys.value) return;
  if (!openai.value) initOpenAI();
  if (!sessionList.value.length) {
    await handleAddSession();
  }

  queryInfos.value.messages.push({
    role: "user",
    content: queryKeys.value,
    name: '小智'
  });
  queryKeys.value = null;
  messageRef.value.scrollBottom();

  try {
    loading.value = true;
    queryInfos.value.messages.push({ role: "assistant", content: "" });
    
    if (queryInfos.value.model === 'gemini-chat') {
      const contents = queryInfos.value.messages.slice(0, -1).map(msg => ({
        parts: [{ text: msg.content }],
        role: msg.role === 'user' ? 'user' : 'model'
      }));
    
      const response = await fetch(currentConfig.value.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...GEMINI_MODEL_CONFIG,
          contents
        })
      });
    
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const data = JSON.parse(chunk);
        
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          queryInfos.value.messages[queryInfos.value.messages.length - 1].content += data.candidates[0].content.parts[0].text;
          messageRef.value.scrollBottom();
        }
      }
      
      if (!queryInfos.value.messages[queryInfos.value.messages.length - 1].content) {
        throw new Error('未收到有效的 Gemini API 响应');
      }
    } else {
      const requestConfig = {
        ...queryInfos.value,
        stream: true
      };

      const response = await openai.value.chat.completions.create(requestConfig);
      for await (const part of response) {
        queryInfos.value.messages[queryInfos.value.messages.length - 1].content += part.choices[0].delta.content;
      }
    }
    
    messageRef.value.scrollBottom();
    sessionList.value[activeIndex.value].messages = queryInfos.value.messages;
    loading.value = false;
  } catch (error) {
    loading.value = false;
    queryInfos.value.messages[queryInfos.value.messages.length - 1].content = error.message;
  }
};

// 生命周期钩子
onMounted(async () => {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  document.head.appendChild(meta);

  initSessionList();
  initIndex();
  initOpenAI();
  initToken();

  const md = new MobileDetect(window.navigator.userAgent);
  isMobile.value = md.mobile();
  await nextTick()
  messageRef.value.scrollBottom();
});
</script>

<template>
  <div class="page">
    <div class="grid-space-between" :class="[!isMobile ? 'grid-box' : '', isSidebarCollapsed ? 'collapsed' : '']">
      <div class="left-container" v-if="!isMobile">
        <!-- 只允许点击这个按钮折叠 -->
        <div class="sidebar-toggle" @click.stop="toggleSidebar" title="折叠/展开侧边栏" style="cursor: pointer; font-weight: bold; padding-bottom: 8px; display: flex; justify-content: center; align-items: center;">
          <el-icon :size="20">
            <component :is="isSidebarCollapsed ? Fold : Expand" />
          </el-icon>
        </div>

        <!-- 折叠时不显示新建对话和列表 -->
        <el-button v-if="!isSidebarCollapsed" type="primary" class="add-btn" :icon="Plus"
          size="large" @click="handleAddSession">新建对话</el-button>

        <div class="session-area" v-if="!isSidebarCollapsed">
          <div class="session-item" :class="activeIndex == index ? 'session-item-active' : ''"
            v-for="(item, index) in sessionList" :key="index" @click="handleChangeSessionIndex(index)">
            <span :class="activeIndex == index ? 'active-node' : 'normal-node'" v-if="editIndex != index">{{item.title}}</span>
            <el-input :ref="`renameRef_${index}`" autofocus v-model="item.title" v-else size="small"
              style="width: 120px" @blur="editIndex = -1" @change="editIndex = -1" />
            <div class="icon-box">
              <el-icon class="icon" color="#fff" @click.stop="handleClearSession(index)">
                <Brush />
              </el-icon>
              <el-icon class="icon" color="#fff" @click.stop="handleFocusInput(index)">
                <EditPen />
              </el-icon>
              <el-icon class="icon" color="#fff" @click.stop="handleDeleteSession(index)">
                <Delete />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="tips">
          <div class="title">{{queryInfos.model}}</div>
          <div class="desc" v-if="!isMobile">本网站采用本地缓存模式运行，不会留存任何涉及个人的信息数据，请放心使用。</div>
          <div @click="handleClearStorage" v-else class="pointer">清空</div>
        </div>

        <div class="message-area">
          <MessageComp ref="messageRef" :message="queryInfos.messages" :loading="loading"></MessageComp>
        </div>
        <div class="user-tokens" :class="isMobile ? 'left-space' : ''">
          <span v-if="queryInfos.model=='deepseek-chat'">
          当前余额为：￥{{ totalAmt || 0 }}
          </span>
          <span v-else>免费</span>
        </div>
        <div class="input-area" :class="isMobile ? 'left-space' : ''">
          <el-input v-model="queryKeys" id="keyInput" :autosize="{minRows:2,maxRows:4}" type="textarea" placeholder="请输入内容" show-word-limit
            @keydown.enter.native="(e) => {
              if (e.isComposing || loading) return;
              handleRequest();
            }" />
          <el-select v-model="queryInfos.model" class="model-select" @change="handleModelChange">
            <el-option label="DeepSeek" value="deepseek-chat" class="deepseek-option" />
            <el-option label="Gemini" value="gemini-chat" />
          </el-select>
          <el-button style="height: 40px" type="primary" @click="handleRequest" :disabled="!queryKeys"
            :loading="loading">
            <el-icon>
              <Promotion />
            </el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped lang="scss">
@use './styles/common.scss' as *
</style>

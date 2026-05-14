import { ref } from 'vue'
import { API_HEADERS } from '@/config/deepseek'

async function streamDeepseek({ model, messages, useTools, onDelta }) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', ...API_HEADERS },
    body: JSON.stringify({ model, messages, stream: true, useTools })
  })
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    const msg = data?.message || data?.error || `HTTP ${resp.status}`
    throw new Error(msg)
  }
  if (!resp.body) throw new Error('Empty response')

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
        onDelta(payload)
      }
    }
  }
}

export function useStreamChat(queryInfos, sessionList, activeIndex, messageRef) {
  const loading = ref(false)
  const agentMode = ref(false)

  async function handleRequestCore() {
    try {
      loading.value = true
      queryInfos.value.messages.push({ role: 'assistant', content: '' })
      await streamDeepseek({
        model: queryInfos.value.model || 'deepseek-chat',
        messages: queryInfos.value.messages.slice(0, -1),
        useTools: agentMode.value,
        onDelta: (chunk) => {
          queryInfos.value.messages[queryInfos.value.messages.length - 1].content += chunk
          messageRef.value?.scrollBottom()
        }
      })
    } catch (error) {
      const lastMsg = queryInfos.value.messages[queryInfos.value.messages.length - 1]
      const partial = lastMsg.content || ''
      lastMsg.content = partial + (partial ? '\n\n' : '') + `⚠️ ${error?.message || error}`
      lastMsg.error = true
    } finally {
      loading.value = false
      sessionList.value[activeIndex.value].messages = queryInfos.value.messages
    }
  }

  async function handleRequest(queryKeys, handleAddSession) {
    if (!queryKeys.value) return
    if (!sessionList.value.length) handleAddSession()
    queryInfos.value.messages.push({ role: 'user', content: queryKeys.value })
    queryKeys.value = null
    messageRef.value?.scrollBottom()
    await handleRequestCore()
  }

  async function handleRetry() {
    const msgs = queryInfos.value.messages
    if (msgs.length < 2) return
    const lastAssistant = msgs[msgs.length - 1]
    if (lastAssistant.role !== 'assistant' || !lastAssistant.error) return
    msgs.pop()
    await handleRequestCore()
  }

  return { loading, agentMode, handleRequest, handleRetry }
}

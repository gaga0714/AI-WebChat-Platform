// server/server.js —— Node 18+/20 ESM，SSE 透传 + Agent（Function Calling + Tavily）+ 余额查询
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import express from 'express'
import cors from 'cors'
import { Readable } from 'node:stream'

const app = express()
app.use(cors())
app.use(express.json())

const MAX_AGENT_ROUNDS = 5
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const TAVILY_URL = 'https://api.tavily.com/search'

// Tavily 工具定义（DeepSeek/OpenAI 格式）
const TAVILY_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'tavily_search',
      description: 'Search the web for real-time information. Use when the user asks about current events, weather, news, or any information that may change over time. Input should be a search query string.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query, e.g. "Beijing weather today", "latest news about ..."'
          }
        },
        required: ['query']
      }
    }
  }
]

/** 调用 Tavily Search API，返回拼接后的文本供模型消费 */
async function callTavilySearch(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return '[Tavily] API key not configured. Set TAVILY_API_KEY in .env'
  }
  try {
    const body = {
      query: String(query).slice(0, 500),
      search_depth: options.search_depth || 'basic',
      max_results: options.max_results ?? 5,
      topic: options.topic || 'general'
    }
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('[Tavily]', res.status, data)
      return `[Tavily search failed: ${res.status}]`
    }
    const results = data.results || []
    if (results.length === 0) return '[No results found for this query.]'
    return results
      .map((r, i) => `[${i + 1}] ${r.title || 'Untitled'}\n${r.content || r.snippet || ''}`)
      .join('\n\n')
  } catch (e) {
    console.error('[Tavily Error]', e)
    return `[Tavily error: ${e?.message || e}]`
  }
}

/** 单次请求 DeepSeek（不流式），返回 choices[0].message */
async function deepseekChat(messages, model, stream = false) {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json'
    },
    body: JSON.stringify({ model, messages, stream, tools: stream ? undefined : TAVILY_TOOLS, tool_choice: stream ? undefined : 'auto' })
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`DeepSeek ${res.status}: ${text?.slice(0, 200)}`)
    err.status = res.status
    err.body = text
    throw err
  }
  if (stream) return { streamBody: res.body, ok: true }
  return JSON.parse(text).choices?.[0]?.message || null
}

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true }))

// 聊天：代理到 DeepSeek，支持流式；useTools 时走 Agent 循环（Function Calling + Tavily）
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'deepseek-chat', stream = true, useTools = false } = req.body || {}

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Server] Missing DEEPSEEK_API_KEY')
      return res.status(500).json({ error: 'Server misconfigured: missing API key' })
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error('[Server] Invalid messages:', messages)
      return res.status(400).json({ error: 'Invalid request: messages required' })
    }

    // 未开启 Agent：保持原有透传逻辑
    if (!useTools) {
      const upstream = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: stream ? 'text/event-stream' : 'application/json'
        },
        body: JSON.stringify({ model, messages, stream })
      })

      if (!stream) {
        const text = await upstream.text()
        if (!upstream.ok) {
          console.error('[Upstream Non-Stream Error]', upstream.status, text)
          const status = upstream.status || 502
          if (status === 402) {
            return res.status(402).json({ error: 'Insufficient Balance', message: 'DeepSeek 账户余额不足，请充值后再试' })
          }
          return res.status(status).send(text || 'Upstream error')
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.send(text)
      }

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '')
        console.error('[Upstream Error]', upstream.status, text)
        if (upstream.status === 402) {
          return res.status(402).json({ error: 'Insufficient Balance', message: 'DeepSeek 账户余额不足，请充值后再试' })
        }
        res.status(upstream.status || 502).end(text || 'Upstream error')
        return
      }
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      const nodeStream = Readable.fromWeb(upstream.body)
      nodeStream.on('error', (e) => {
        console.error('[Proxy] Stream error', e)
        if (!res.headersSent) res.status(502)
        res.end()
      })
      nodeStream.pipe(res)
      return
    }

    // Agent 模式：需要 Tavily Key
    if (!process.env.TAVILY_API_KEY) {
      return res.status(500).json({ error: 'Agent mode requires TAVILY_API_KEY in server environment' })
    }

    let currentMessages = [...messages]

    // 注入当前时间，确保模型知道“今天”是哪一天
    const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    const timePrompt = `Current Date/Time: ${nowStr}.`
    
    if (currentMessages.length > 0 && currentMessages[0].role === 'system') {
      currentMessages[0].content += `\n\n${timePrompt}`
    } else {
      currentMessages.unshift({ role: 'system', content: timePrompt })
    }

    let round = 0

    while (round < MAX_AGENT_ROUNDS) {
      round++
      const msg = await deepseekChat(currentMessages, model, false)
      if (!msg) {
        return res.status(502).json({ error: 'Invalid response from DeepSeek' })
      }

      currentMessages.push(msg)

      const toolCalls = msg.tool_calls
      if (!toolCalls || toolCalls.length === 0) {
        // 无 tool_calls：最后一轮，将已有的 assistant content 以 SSE 形式流式返回前端
        const content = msg.content || ''
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        const data = JSON.stringify({ choices: [{ delta: { content }, index: 0, finish_reason: 'stop' }] })
        res.write(`data: ${data}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }

      // 执行每个 tool_call
      for (const tc of toolCalls) {
        const name = tc.function?.name
        let args = {}
        try {
          args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {}
        } catch (_) {}
        let content = ''
        if (name === 'tavily_search') {
          content = await callTavilySearch(args.query || '')
        } else {
          content = `[Unknown tool: ${name}]`
        }
        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content
        })
      }
    }

    // 超过最大轮数仍未得到纯文本回复，返回说明
    res.status(200).json({
      error: 'Agent max rounds reached',
      message: 'Reached maximum tool-call rounds. Try a simpler question or disable Agent mode.'
    })
  } catch (e) {
    if (e.status === 402) {
      return res.status(402).json({ error: 'Insufficient Balance', message: 'DeepSeek 账户余额不足，请充值后再试' })
    }
    console.error('[Server Error]', e)
    res.status(500).end(`Proxy error: ${e?.message || e}`)
  }
})

// 余额：代理 DeepSeek，多端点自动探测；统一返回 { balance_infos: [{ total_balance }] }
app.get('/api/balance', async (req, res) => {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(200).json({ balance_infos: [{ total_balance: 0 }], note: 'missing api key, fallback 0' })
    }

    const prefer = process.env.DEEPSEEK_BALANCE_URL
    const candidates = [
      prefer,
      'https://api.deepseek.com/v1/user/balance',
      'https://api.deepseek.com/user/balance',
      'https://api.deepseek.com/v1/dashboard/billing/credit_grants'
    ].filter(Boolean)

    let upstreamJson = null
    let picked = null

    for (const url of candidates) {
      try {
        const r = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }
        })
        const text = await r.text()
        if (!r.ok) {
          console.warn('[Balance try]', url, r.status, text?.slice(0, 120))
          continue
        }
        picked = url
        upstreamJson = JSON.parse(text)
        break
      } catch (e) {
        console.warn('[Balance try error]', url, String(e))
      }
    }

    if (!upstreamJson) {
      return res.status(200).json({ balance_infos: [{ total_balance: 0 }], note: 'no endpoint matched, fallback 0' })
    }

    if (typeof upstreamJson?.total_granted !== 'undefined') {
      const remaining = Number(upstreamJson.total_granted || 0) - Number(upstreamJson.total_used || 0)
      return res.json({
        balance_infos: [{ total_balance: Number(remaining.toFixed(4)) }],
        source: picked
      })
    }

    if (typeof upstreamJson?.balance !== 'undefined' || typeof upstreamJson?.amount !== 'undefined') {
      const v = Number(upstreamJson.balance ?? upstreamJson.amount ?? 0)
      return res.json({
        balance_infos: [{ total_balance: v }],
        source: picked
      })
    }

    if (Array.isArray(upstreamJson?.balance_infos)) {
      return res.json({ balance_infos: upstreamJson.balance_infos, source: picked })
    }

    return res.status(200).json({
      balance_infos: [{ total_balance: 0 }],
      source: picked,
      note: 'unknown schema, fallback 0',
      sample: JSON.stringify(upstreamJson).slice(0, 200)
    })
  } catch (e) {
    console.error('[Balance Server Error]', e)
    return res.status(200).json({ balance_infos: [{ total_balance: 0 }], note: 'server error, fallback 0' })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})

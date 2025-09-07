// server/server.js —— Node 18+/20 ESM，SSE 透传（Web Stream -> Node Stream）+ 余额查询
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Readable } from 'node:stream' // Web ReadableStream -> Node Readable

const app = express()
app.use(cors())
app.use(express.json())

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true }))

// 聊天：代理到 DeepSeek，支持流式
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'deepseek-chat', stream = true } = req.body || {}

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Server] Missing DEEPSEEK_API_KEY')
      return res.status(500).json({ error: 'Server misconfigured: missing API key' })
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error('[Server] Invalid messages:', messages)
      return res.status(400).json({ error: 'Invalid request: messages required' })
    }

    // console.log('[Proxy] -> DeepSeek', {
    //   model,
    //   hasStream: !!stream,
    //   firstRole: messages[0]?.role,
    //   lastRole: messages[messages.length - 1]?.role
    // })

    // DeepSeek Chat Completions（按你前面可用的地址）
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json'
      },
      body: JSON.stringify({ model, messages, stream })
    })

    // 非流式：直接转发文本
    if (!stream) {
      const text = await upstream.text()
      if (!upstream.ok) {
        console.error('[Upstream Non-Stream Error]', upstream.status, text)
        return res.status(upstream.status || 502).send(text || 'Upstream error')
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.send(text)
    }

    // 流式：先检查状态
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '')
      console.error('[Upstream Error]', upstream.status, text)
      res.status(upstream.status || 502).end(text || 'Upstream error')
      return
    }

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Web Stream → Node Stream，再 pipe 给前端
    const nodeStream = Readable.fromWeb(upstream.body)
    nodeStream.on('error', (e) => {
      console.error('[Proxy] Stream error', e)
      if (!res.headersSent) res.status(502)
      res.end()
    })
    nodeStream.on('end', () => console.log('[Proxy] Stream ended'))
    nodeStream.pipe(res)
  } catch (e) {
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

    // 可通过 .env 手动指定端点（优先级最高）
    // 例如：DEEPSEEK_BALANCE_URL=https://api.deepseek.com/v1/user/balance
    const prefer = process.env.DEEPSEEK_BALANCE_URL

    // 常见候选端点（按顺序尝试）
    const candidates = [
      prefer, // .env 指定
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

    // 都失败：兜底返回 0，避免前端红错
    if (!upstreamJson) {
      return res.status(200).json({ balance_infos: [{ total_balance: 0 }], note: 'no endpoint matched, fallback 0' })
    }

    // 统一“余额”结构
    // 1) OpenAI credit_grants 风格：{ total_granted, total_used, ... }
    if (typeof upstreamJson?.total_granted !== 'undefined') {
      const remaining = Number(upstreamJson.total_granted || 0) - Number(upstreamJson.total_used || 0)
      return res.json({
        balance_infos: [{ total_balance: Number(remaining.toFixed(4)) }],
        source: picked
      })
    }

    // 2) 直接余额：{ balance: 123.45 } 或 { amount: 123.45 }
    if (typeof upstreamJson?.balance !== 'undefined' || typeof upstreamJson?.amount !== 'undefined') {
      const v = Number(upstreamJson.balance ?? upstreamJson.amount ?? 0)
      return res.json({
        balance_infos: [{ total_balance: v }],
        source: picked
      })
    }

    // 3) 已是你项目旧结构：{ balance_infos: [{ total_balance }] }
    if (Array.isArray(upstreamJson?.balance_infos)) {
      return res.json({ balance_infos: upstreamJson.balance_infos, source: picked })
    }

    // 4) 其他未知结构：兜底 0，并附带 sample 便于调试
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

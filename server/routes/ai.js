import { Router } from 'express'

const router = Router()

function toCamel(r) {
  return {
    id: r.id,
    apiKey: r.api_key,
    apiUrl: r.api_url,
    modelName: r.model_name,
    enabled: !!r.enabled,
    cozeToken: r.coze_token || '',
    cozeWorkflowId: r.coze_workflow_id || ''
  }
}

// GET /api/aiConfig
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) {
      res.json({ apiKey: '', apiUrl: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-3.5-turbo', enabled: false, cozeToken: '', cozeWorkflowId: '' })
    } else {
      res.json(toCamel(rows[0]))
    }
  } catch (e) {
    res.status(500).json({ message: '查询AI配置失败：' + e.message })
  }
})

// POST /api/aiConfig —— 保存配置
router.post('/', async (req, res) => {
  try {
    const { apiKey, apiUrl, modelName, enabled, cozeToken, cozeWorkflowId } = req.body
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) {
      const [result] = await pool.execute(
        'INSERT INTO ai_config (api_key, api_url, model_name, enabled, coze_token, coze_workflow_id) VALUES (?, ?, ?, ?, ?, ?)',
        [apiKey || '', apiUrl || '', modelName || 'gpt-3.5-turbo', enabled ? 1 : 0, cozeToken || '', cozeWorkflowId || '']
      )
      const [r] = await pool.query('SELECT * FROM ai_config WHERE id = ?', [result.insertId])
      res.json(toCamel(r[0]))
    } else {
      await pool.execute(
        'UPDATE ai_config SET api_key = ?, api_url = ?, model_name = ?, enabled = ?, coze_token = ?, coze_workflow_id = ? WHERE id = ?',
        [apiKey || '', apiUrl || '', modelName || 'gpt-3.5-turbo', enabled ? 1 : 0, cozeToken || '', cozeWorkflowId || '', rows[0].id]
      )
      const [r] = await pool.query('SELECT * FROM ai_config WHERE id = ?', [rows[0].id])
      res.json(toCamel(r[0]))
    }
  } catch (e) {
    res.status(500).json({ message: '保存AI配置失败：' + e.message })
  }
})

// POST /api/aiConfig/test —— 测试连接
router.post('/test', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) return res.status(400).json({ message: '请先保存API配置' })
    const cfg = rows[0]
    const resp = await fetch(cfg.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`
      },
      body: JSON.stringify({
        model: cfg.model_name,
        messages: [{ role: 'user', content: req.body.question || '你好，请回复"连接成功"' }],
        max_tokens: 50
      })
    })
    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(400).json({ message: `API返回错误：${resp.status} ${txt.slice(0, 200)}` })
    }
    const data = await resp.json()
    const reply = data.choices?.[0]?.message?.content || '连接成功'
    res.json({ reply })
  } catch (e) {
    res.status(500).json({ message: '测试连接失败：' + e.message })
  }
})

// POST /api/aiConfig/ask —— LLM 问答
router.post('/ask', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) return res.status(400).json({ message: '请先配置LLM API' })
    const cfg = rows[0]
    if (!cfg.api_key || !cfg.api_url) return res.status(400).json({ message: 'API配置不完整' })
    const { question, context } = req.body
    const resp = await fetch(cfg.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`
      },
      body: JSON.stringify({
        model: cfg.model_name,
        messages: [
          { role: 'system', content: `你是考勤分析助手。基于以下考勤数据回答用户问题，回答中请包含至少3个具体数字。${context || ''}` },
          { role: 'user', content: question }
        ],
        max_tokens: 500
      })
    })
    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(400).json({ message: `API返回错误：${resp.status} ${txt.slice(0, 200)}` })
    }
    const data = await resp.json()
    const reply = data.choices?.[0]?.message?.content || '暂无回复'
    res.json({ reply })
  } catch (e) {
    res.status(500).json({ message: '调用失败：' + e.message })
  }
})

// POST /api/aiConfig/coze_run —— 调用 Coze 工作流生成考勤报告
// 请求体: { input: "考勤统计数据文本" }
// 返回: { reply: "AI 生成的报告" }
router.post('/coze_run', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) return res.status(400).json({ message: '请先配置 Coze Token 和工作流 ID' })
    const cfg = rows[0]
    const cozeToken = cfg.coze_token
    const workflowId = cfg.coze_workflow_id
    if (!cozeToken || !workflowId) {
      return res.status(400).json({ message: '请先配置 Coze Token 和工作流 ID' })
    }
    const { input } = req.body
    console.log('[Coze] 收到 input 长度:', (input || '').length, '前100字符:', (input || '').slice(0, 100))

    // 调用 Coze 工作流（流式接口）
    const resp = await fetch('https://api.coze.cn/v1/workflow/stream_run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cozeToken}`
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: { input: input || '' }
      })
    })
    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(400).json({ message: `Coze API 返回错误：${resp.status} ${txt.slice(0, 300)}` })
    }
    // 解析 SSE 流式响应——按空行分割事件块，只取 Message 事件的 content
    const raw = await resp.text()
    let reply = ''
    const events = raw.split('\n\n')
    for (const block of events) {
      let eventType = ''
      let eventData = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        else if (line.startsWith('data: ')) eventData = line.slice(6).trim()
      }
      if (eventType !== 'Message' || !eventData) continue
      try {
        const evt = JSON.parse(eventData)
        if (evt.content) reply += evt.content
      } catch { /* ignore */ }
    }
    // 如果 content 是嵌套 JSON 字符串，逐层解析提取最内层 output
    // SSE 返回结构: content = '{"output":"{\"output\":\"实际内容\",\"reasoning_content\":\"...\"}"}'
    let parsed = null
    try {
      parsed = JSON.parse(reply)
    } catch { /* content 是纯文本直接使用 */ }
    // 循环解析多层嵌套，直到取到最内层的 output 字符串
    while (parsed && typeof parsed === 'object' && parsed.output !== undefined) {
      if (typeof parsed.output === 'string') {
        try {
          const next = JSON.parse(parsed.output)
          parsed = next
        } catch {
          // output 是纯字符串（最终内容），不再需要解析
          reply = parsed.output
          parsed = null
        }
      } else {
        reply = String(parsed.output)
        parsed = null
      }
    }
    console.log('[Coze] 最终回复长度:', reply.length, '前100字符:', reply.slice(0, 100))
    if (!reply) reply = 'Coze 工作流未返回有效内容，请检查工作流配置或 input 参数。'
    res.json({ reply })
  } catch (e) {
    res.status(500).json({ message: '调用 Coze 工作流失败：' + e.message })
  }
})

export default router

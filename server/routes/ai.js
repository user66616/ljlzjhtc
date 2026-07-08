import { Router } from 'express'

const router = Router()

function toCamel(r) {
  return {
    id: r.id,
    apiKey: r.api_key,
    apiUrl: r.api_url,
    modelName: r.model_name,
    enabled: !!r.enabled
  }
}

// GET /api/aiConfig
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) {
      res.json({ apiKey: '', apiUrl: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-3.5-turbo', enabled: false })
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
    const { apiKey, apiUrl, modelName, enabled } = req.body
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) {
      const [result] = await pool.execute(
        'INSERT INTO ai_config (api_key, api_url, model_name, enabled) VALUES (?, ?, ?, ?)',
        [apiKey || '', apiUrl || '', modelName || 'gpt-3.5-turbo', enabled ? 1 : 0]
      )
      const [r] = await pool.query('SELECT * FROM ai_config WHERE id = ?', [result.insertId])
      res.json(toCamel(r[0]))
    } else {
      await pool.execute(
        'UPDATE ai_config SET api_key = ?, api_url = ?, model_name = ?, enabled = ? WHERE id = ?',
        [apiKey || '', apiUrl || '', modelName || 'gpt-3.5-turbo', enabled ? 1 : 0, rows[0].id]
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

export default router

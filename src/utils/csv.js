// CSV 解析与导出工具

export function parseCSV(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = splitLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] !== undefined ? cells[idx] : ''
    })
    rows.push(obj)
  }
  return { headers, rows }
}

function splitLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  result.push(cur)
  return result.map((s) => s.trim())
}

export function toCSV(rows, fields) {
  const header = fields.map((f) => `"${f}"`).join(',')
  const body = rows
    .map((r) =>
      fields
        .map((f) => {
          const v = r[f] === null || r[f] === undefined ? '' : r[f]
          return `"${String(v).replace(/"/g, '""')}"`
        })
        .join(',')
    )
    .join('\n')
  // BOM 保证 Excel 正确识别中文
  return '\uFEFF' + header + '\n' + body
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

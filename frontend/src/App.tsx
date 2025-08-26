import { useMemo, useState } from 'react'
import './App.css'

type DisplayRow = {
  成员: string
  分组: string
  前值: number
  后值: number
  差值: number
  达标: boolean
}

function App() {
  const [startFile, setStartFile] = useState<File | null>(null)
  const [endFile, setEndFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState<number>(1)
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const canCompute = useMemo(() => !!startFile && !!endFile, [startFile, endFile])


  const compute = async () => {
    setError(null)
    setRows([])
    if (!startFile || !endFile) return
    try {
      // 调用后端统一计算接口
      const form = new FormData()
      form.append('start', startFile)
      form.append('end', endFile)
      form.append('threshold', String(threshold))

      const resp = await fetch('http://localhost:8080/api/v1/attendance/compare', {
        method: 'POST',
        body: form,
      })
      if (!resp.ok) throw new Error(`后端错误: ${resp.status}`)
      const data = await resp.json()

      setRows(data as DisplayRow[])
    } catch (err: any) {
      setError(err?.message ?? '解析失败')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>考勤展示（CSV 对比）</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          起始CSV：
          <input type="file" accept=".csv" onChange={(e) => setStartFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          结束CSV：
          <input type="file" accept=".csv" onChange={(e) => setEndFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          出勤标准（差值≥）：
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            style={{ width: 100 }}
          />
        </label>
        <button onClick={compute} disabled={!canCompute}>
          计算并展示
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginTop: 12 }}>错误：{error}</div>
      )}

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>成员</th>
              <th>分组</th>
              <th>战功总量（前值）</th>
              <th>战功总量（后值）</th>
              <th>差值</th>
              <th>是否达标</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.成员}>
                <td>{r.成员}</td>
                <td>{r.分组}</td>
                <td>{r.前值}</td>
                <td>{r.后值}</td>
                <td>{r.差值}</td>
                <td>{r.达标 ? '出勤' : '未出勤'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App

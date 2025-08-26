import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

type DisplayRow = {
  成员: string
  分组: string
  前值: number
  后值: number
  差值: number
  达标: boolean
}

type GroupStat = {
  分组: string
  总战功增量: number
  人均战功增量: number
  出勤率: number
  小组人数: number
}

function App() {
  const [startFile, setStartFile] = useState<File | null>(null)
  const [endFile, setEndFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState<number>(1)
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members')
  const [filteredCount, setFilteredCount] = useState<number>(0)
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
      const data = (await resp.json()) as DisplayRow[]
      if (Array.isArray(data) && data.length > 0) {
        setRows(data)
        return
      }
      // fallback to local compute if backend returns empty
      const parseCsv = (file: File): Promise<Record<string, unknown>[]> => new Promise((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h: string) => h.trim(),
          complete: (res) => resolve(res.data),
          error: (err) => reject(err),
        })
      })
      const numberize = (v: unknown): number => typeof v === 'number' ? v : (typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) || 0 : 0)
      const [startData, endData] = await Promise.all([parseCsv(startFile), parseCsv(endFile)])
      const startMap = new Map<string, Record<string, unknown>>()
      for (const r of startData) {
        const key = (r['成员'] ?? '').toString().trim()
        if (!key) continue
        startMap.set(key, r)
      }
      const endMap = new Map<string, Record<string, unknown>>()
      for (const r of endData) {
        const key = (r['成员'] ?? '').toString().trim()
        if (!key) continue
        endMap.set(key, r)
      }
      const display: DisplayRow[] = []
      let filtered = 0
      for (const [member, s] of startMap.entries()) {
        const e = endMap.get(member)
        // 边界值处理：只出现在一次CSV中的成员不加入统计
        if (!e) {
          filtered++
          continue
        }
        
        const startGroup = (s['分组'] ?? '').toString()
        const endGroup = (e['分组'] ?? '').toString()
        // 边界值处理：分组不一致的成员不加入统计
        if (startGroup !== endGroup) {
          filtered++
          continue
        }
        
        const prev = numberize(s['战功总量'])
        const next = numberize(e['战功总量'])
        const diff = next - prev
        display.push({ 成员: member, 分组: startGroup, 前值: prev, 后值: next, 差值: diff, 达标: diff >= threshold })
      }
      setFilteredCount(filtered)
      display.sort((a, b) => b.差值 - a.差值)
      setRows(display)
      // 计算小组统计
      const groupMap = new Map<string, { total: number; count: number; present: number }>()
      for (const row of display) {
        const group = row.分组
        const existing = groupMap.get(group) || { total: 0, count: 0, present: 0 }
        existing.total += row.差值
        existing.count += 1
        if (row.达标) existing.present += 1
        groupMap.set(group, existing)
      }
      const stats: GroupStat[] = []
      for (const [group, data] of groupMap.entries()) {
        stats.push({
          分组: group,
          总战功增量: data.total,
          人均战功增量: data.count > 0 ? Math.round(data.total / data.count) : 0,
          出勤率: data.count > 0 ? Number(((data.present / data.count) * 100).toFixed(2)) : 0,
          小组人数: data.count
        })
      }
      stats.sort((a, b) => b.总战功增量 - a.总战功增量)
      setGroupStats(stats)
      console.log('Debug - display rows:', display.length, display.map(r => ({ member: r.成员, group: r.分组 })))
      console.log('Debug - group stats:', stats)
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

      {filteredCount > 0 && (
        <div style={{ color: 'orange', marginTop: 12 }}>
          提示：已过滤 {filteredCount} 个成员（只出现一次或分组不一致）
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setActiveTab('members')}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                background: activeTab === 'members' ? '#007bff' : '#fff',
                color: activeTab === 'members' ? '#fff' : '#000',
                cursor: 'pointer'
              }}
            >
              成员详情
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                background: activeTab === 'groups' ? '#007bff' : '#fff',
                color: activeTab === 'groups' ? '#fff' : '#000',
                cursor: 'pointer'
              }}
            >
              小组统计
            </button>
          </div>

          {activeTab === 'members' && (
            <div style={{ overflowX: 'auto' }}>
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
          )}

          {activeTab === 'groups' && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>分组</th>
                    <th>总战功增量</th>
                    <th>人均战功增量</th>
                    <th>出勤率（%）</th>
                    <th>小组人数</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStats.map((g) => (
                    <tr key={g.分组}>
                      <td>{g.分组}</td>
                      <td>{g.总战功增量}</td>
                      <td>{g.人均战功增量}</td>
                      <td>{g.出勤率}%</td>
                      <td>{g.小组人数}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App

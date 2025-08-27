import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

type DisplayRow = {
  成员: string
  分组: string
  前值: number
  后值: number
  差值: number
  助攻前值: number
  助攻后值: number
  助攻差值: number
  达标: boolean
}

type GroupStat = {
  group: string
  totalMeritIncrease: number
  averageMeritIncrease: number
  totalAssistIncrease: number
  averageAssistIncrease: number
  attendanceRate: number
  memberCount: number
}

type AttendanceResponse = {
  members: DisplayRow[]
  groups: GroupStat[]
  filteredCount: number
}

type AttendanceSession = {
  id: number
  name: string
  battleResult: 'VICTORY' | 'DEFEAT'
  status: 'ADDED' | 'SAVED' | 'SETTLED'
  createdAt: string
  updatedAt: string
  memberData?: string
  groupData?: string
  threshold?: number
}

type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

function App() {
  const [startFile, setStartFile] = useState<File | null>(null)
  const [endFile, setEndFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState<number>(1)
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add')
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'groups'>('members')
  const [filteredCount, setFilteredCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  
  // 考勤会话相关状态
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [sessionName, setSessionName] = useState('')
  const [battleResult, setBattleResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [modalActiveTab, setModalActiveTab] = useState<'members' | 'groups' | 'rewards'>('members')


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
      const data = (await resp.json()) as AttendanceResponse
      if (data && data.members && data.members.length > 0) {
        setRows(data.members)
        setGroupStats(data.groups)
        setFilteredCount(data.filteredCount)
        console.log('Debug - received data from backend:', data)
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
        
        // 处理助攻数据
        const assistPrev = numberize(s['助攻总量'])
        const assistNext = numberize(e['助攻总量'])
        const assistDiff = assistNext - assistPrev
        
        display.push({ 
          成员: member, 
          分组: startGroup, 
          前值: prev, 
          后值: next, 
          差值: diff, 
          助攻前值: assistPrev,
          助攻后值: assistNext,
          助攻差值: assistDiff,
          达标: diff >= threshold 
        })
      }
      setFilteredCount(filtered)
      display.sort((a, b) => b.差值 - a.差值)
      setRows(display)
      // 计算小组统计
      const groupMap = new Map<string, { total: number; assistTotal: number; count: number; present: number }>()
      console.log('Debug - starting group calculation with', display.length, 'rows')
      for (const row of display) {
        const group = row.分组
        console.log('Debug - processing member:', row.成员, 'group:', group, 'diff:', row.差值, 'assistDiff:', row.助攻差值, 'qualified:', row.达标)
        const existing = groupMap.get(group) || { total: 0, assistTotal: 0, count: 0, present: 0 }
        existing.total += row.差值
        existing.assistTotal += row.助攻差值
        existing.count += 1
        if (row.达标) existing.present += 1
        groupMap.set(group, existing)
      }
      console.log('Debug - groupMap entries:', Array.from(groupMap.entries()))
      const stats: GroupStat[] = []
      for (const [group, data] of groupMap.entries()) {
        stats.push({
          group: group,
          totalMeritIncrease: data.total,
          averageMeritIncrease: data.count > 0 ? Math.round(data.total / data.count) : 0,
          totalAssistIncrease: data.assistTotal,
          averageAssistIncrease: data.count > 0 ? Math.round(data.assistTotal / data.count) : 0,
          attendanceRate: data.count > 0 ? Number(((data.present / data.count) * 100).toFixed(2)) : 0,
          memberCount: data.count
        })
      }
        stats.sort((a, b) => b.totalMeritIncrease - a.totalMeritIncrease)
      setGroupStats(stats)
      console.log('Debug - display rows:', display.length, display.map(r => ({ member: r.成员, group: r.分组 })))
      console.log('Debug - group stats:', stats)
    } catch (err: any) {
      setError(err?.message ?? '解析失败')
    }
  }

  // 保存考勤会话
  const saveSession = async () => {
    if (!sessionName.trim()) {
      setError('请输入考勤名称')
      return
    }
    
    try {
      const requestBody = {
        name: sessionName,
        battleResult: battleResult,
        memberData: JSON.stringify(rows),
        // 移除小组统计数据的保存，改为实时计算
        threshold: threshold
      }
      
      const resp = await fetch(`http://localhost:8080/api/v1/attendance/save-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!resp.ok) throw new Error(`保存失败: ${resp.status}`)
      
      setSessionName('')
      setBattleResult('VICTORY')
      setError(null)
      // 切换到查看考勤记录页面并刷新列表
      setActiveTab('view')
      loadSessions()
    } catch (err: any) {
      setError(err?.message ?? '保存失败')
    }
  }

  // 加载会话列表
  const loadSessions = async (page = 0) => {
    try {
      const resp = await fetch(`http://localhost:8080/api/v1/attendance/sessions?page=${page}&size=10`)
      if (!resp.ok) throw new Error(`加载失败: ${resp.status}`)
      
      const data = await resp.json() as PageResponse<AttendanceSession>
      setSessions(data.content)
      setCurrentPage(data.number)
      setTotalPages(data.totalPages)
    } catch (err: any) {
      setError(err?.message ?? '加载失败')
    }
  }

  // 查看会话详情
  const viewSession = async (sessionId: number) => {
    console.log('查看会话:', sessionId)
    try {
      const resp = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${sessionId}`)
      console.log('API响应状态:', resp.status)
      if (!resp.ok) throw new Error(`加载失败: ${resp.status}`)
      
      const data = await resp.json()
      console.log('会话数据:', data)
      
      // 处理新的API响应格式
      const session = data.session as AttendanceSession
      const groupStats = data.groupStats as GroupStat[]
      
      // 将小组统计数据添加到会话对象中，用于弹窗显示
      const sessionWithGroupStats = {
        ...session,
        groupData: JSON.stringify(groupStats)
      }
      
      setSelectedSession(sessionWithGroupStats)
      setShowSessionModal(true)
    } catch (err: any) {
      console.error('查看会话错误:', err)
      setError(err?.message ?? '加载失败')
    }
  }

  // 删除会话
  const deleteSession = async (sessionId: number) => {
    if (!confirm('确定要删除这条考勤记录吗？')) {
      return
    }
    
    try {
      const resp = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      
      if (!resp.ok) throw new Error(`删除失败: ${resp.status}`)
      
      setError(null)
      // 刷新会话列表
      loadSessions(currentPage)
    } catch (err: any) {
      setError(err?.message ?? '删除失败')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 主导航菜单 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #dee2e6', paddingBottom: 16 }}>
        <button
          onClick={() => setActiveTab('add')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'add' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'add' ? '#fff' : '#000',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'add' ? 'bold' : 'normal',
            borderRadius: '4px 4px 0 0'
          }}
        >
          添加考勤
        </button>
        <button
          onClick={() => {
            setActiveTab('view')
            loadSessions()
          }}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'view' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'view' ? '#fff' : '#000',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'view' ? 'bold' : 'normal',
            borderRadius: '4px 4px 0 0'
          }}
        >
          查看考勤记录
        </button>
      </div>

      {activeTab === 'add' && (
        <div>
          <h2>添加考勤</h2>
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

        </div>
      )}

      {activeTab === 'view' && (
        <div>
          <h2>查看考勤记录</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>考勤名称</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>战役结果</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>出勤标准</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>状态</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>创建时间</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{session.name}</td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.battleResult === 'VICTORY' ? '胜利' : '失败'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.threshold || '未设置'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.status === 'ADDED' && '已添加'}
                      {session.status === 'SAVED' && '已保存'}
                      {session.status === 'SETTLED' && '已结算'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {new Date(session.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => viewSession(session.id)}
                          style={{ padding: '4px 8px', background: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                          查看
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          style={{ padding: '4px 8px', background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 分页 */}
          {totalPages > 1 && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button
                onClick={() => loadSessions(currentPage - 1)}
                disabled={currentPage === 0}
                style={{ padding: '8px 12px', border: '1px solid #ccc', background: currentPage === 0 ? '#f8f9fa' : '#fff', cursor: currentPage === 0 ? 'not-allowed' : 'pointer' }}
              >
                上一页
              </button>
              <span style={{ padding: '8px 12px' }}>
                第 {currentPage + 1} 页，共 {totalPages} 页
              </span>
              <button
                onClick={() => loadSessions(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                style={{ padding: '8px 12px', border: '1px solid #ccc', background: currentPage === totalPages - 1 ? '#f8f9fa' : '#fff', cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer' }}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
            {/* 保存考勤功能 */}
            <div style={{ marginBottom: 16, padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', background: '#f8f9fa' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>保存考勤</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>
                  考勤名称：
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="请输入考勤名称"
                    style={{ width: 200 }}
                  />
                </label>
                <label>
                  战役结果：
                  <select
                    value={battleResult}
                    onChange={(e) => setBattleResult(e.target.value as 'VICTORY' | 'DEFEAT')}
                    style={{ width: 100 }}
                  >
                    <option value="VICTORY">胜利</option>
                    <option value="DEFEAT">失败</option>
                  </select>
                </label>
                <button onClick={saveSession} style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  保存考勤
                </button>
              </div>
            </div>
            
            {/* 子标签栏 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActiveSubTab('members')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: activeSubTab === 'members' ? '#007bff' : '#fff',
                  color: activeSubTab === 'members' ? '#fff' : '#000',
                  cursor: 'pointer'
                }}
              >
                成员详情
              </button>
              <button
                onClick={() => setActiveSubTab('groups')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: activeSubTab === 'groups' ? '#007bff' : '#fff',
                  color: activeSubTab === 'groups' ? '#fff' : '#000',
                  cursor: 'pointer'
                }}
              >
                小组统计
              </button>
            </div>

            {activeSubTab === 'members' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>成员</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>分组</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>战功总量（前值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>战功总量（后值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>战功差值</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>助攻总量（前值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>助攻总量（后值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>助攻差值</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>是否达标</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.成员} style={{ background: r.达标 ? '#d4edda' : '#f8d7da' }}>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.成员}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.分组}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.前值}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.后值}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.差值}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.助攻前值 || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.助攻后值 || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.助攻差值 || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.达标 ? '出勤' : '未出勤'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'groups' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>分组</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>总战功增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>人均战功增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>总助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>人均助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>出勤率（%）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>小组人数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStats.map((g) => (
                      <tr key={g.group} style={{ background: '#fff' }}>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.group}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.totalMeritIncrease}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.averageMeritIncrease}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.totalAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.averageAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.attendanceRate}%</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{g.memberCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      
      {/* 会话详情弹窗 */}
      {showSessionModal && selectedSession && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>考勤详情 - {selectedSession.name}</h3>
              <button
                onClick={() => setShowSessionModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p><strong>考勤名称：</strong>{selectedSession.name}</p>
              <p><strong>战役结果：</strong>{selectedSession.battleResult === 'VICTORY' ? '胜利' : '失败'}</p>
              <p><strong>出勤标准：</strong>{selectedSession.threshold || '未设置'}</p>
              <p><strong>状态：</strong>
                {selectedSession.status === 'ADDED' && '已添加'}
                {selectedSession.status === 'SAVED' && '已保存'}
                {selectedSession.status === 'SETTLED' && '已结算'}
              </p>
              <p><strong>创建时间：</strong>{new Date(selectedSession.createdAt).toLocaleString()}</p>
              <p><strong>更新时间：</strong>{new Date(selectedSession.updatedAt).toLocaleString()}</p>
            </div>
            
            {/* 页签栏 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setModalActiveTab('members')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'members' ? '#007bff' : '#fff',
                  color: modalActiveTab === 'members' ? '#fff' : '#000',
                  cursor: 'pointer'
                }}
              >
                成员详情
              </button>
              <button
                onClick={() => setModalActiveTab('groups')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'groups' ? '#007bff' : '#fff',
                  color: modalActiveTab === 'groups' ? '#fff' : '#000',
                  cursor: 'pointer'
                }}
              >
                小组统计
              </button>
              <button
                onClick={() => setModalActiveTab('rewards')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'rewards' ? '#007bff' : '#fff',
                  color: modalActiveTab === 'rewards' ? '#fff' : '#000',
                  cursor: 'pointer'
                }}
              >
                考勤奖惩
              </button>
            </div>
            
            {/* 成员详情 */}
            {modalActiveTab === 'members' && selectedSession.memberData && selectedSession.memberData !== '[]' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>成员</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>分组</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>战功前值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>战功后值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>战功差值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>助攻前值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>助攻后值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>助攻差值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>是否达标</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        try {
                          console.log('解析成员数据:', selectedSession.memberData);
                          const memberData = JSON.parse(selectedSession.memberData);
                          console.log('解析后的成员数据:', memberData);
                          return memberData.map((member: DisplayRow, index: number) => (
                            <tr key={index} style={{ background: member.达标 ? '#d4edda' : '#f8d7da' }}>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.成员}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.分组}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.前值}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.后值}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.差值}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.助攻前值 || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.助攻后值 || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.助攻差值 || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.达标 ? '出勤' : '未出勤'}</td>
                            </tr>
                          ));
                        } catch (error) {
                          console.error('解析成员数据失败:', error);
                          return <tr><td colSpan={9} style={{ padding: '8px', border: '1px solid #dee2e6', color: 'red' }}>解析成员数据失败: {error instanceof Error ? error.message : String(error)}</td></tr>;
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* 小组统计 */}
            {modalActiveTab === 'groups' && selectedSession.groupData && selectedSession.groupData !== '[]' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>分组</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>总战功增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>人均战功增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>总助攻增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>人均助攻增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>出勤率（%）</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#000' }}>小组人数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        try {
                          const groupData = JSON.parse(selectedSession.groupData);
                          return groupData.map((group: GroupStat, index: number) => (
                            <tr key={index} style={{ background: '#fff' }}>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.group}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.totalMeritIncrease}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.averageMeritIncrease}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.totalAssistIncrease || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.averageAssistIncrease || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.attendanceRate}%</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{group.memberCount}</td>
                            </tr>
                          ));
                        } catch (error) {
                          console.error('解析小组数据失败:', error);
                          return <tr><td colSpan={7} style={{ padding: '1px solid #dee2e6', color: 'red' }}>解析小组数据失败: {error instanceof Error ? error.message : String(error)}</td></tr>;
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* 考勤奖惩 */}
            {modalActiveTab === 'rewards' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', background: '#f8f9fa' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#495057' }}>考勤奖惩规则</h4>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ margin: '8px 0', color: '#6c757d' }}>
                      <strong>出勤标准：</strong>战功差值 ≥ {selectedSession.threshold || '未设置'}
                    </p>
                    <p style={{ margin: '8px 0', color: '#6c757d' }}>
                      <strong>战役结果：</strong>{selectedSession.battleResult === 'VICTORY' ? '胜利' : '失败'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowSessionModal(false)}
                style={{ padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

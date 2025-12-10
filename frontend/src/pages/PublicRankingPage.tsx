import React, { useState, useEffect } from 'react'

interface PublicRankingPageProps {
  onBackToLogin: () => void
}

const PublicRankingPage: React.FC<PublicRankingPageProps> = ({ onBackToLogin }) => {
  // 赛季相关状态
  const [seasons, setSeasons] = useState<any[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [loadingSeasons, setLoadingSeasons] = useState(false)

  // 排名类型
  const [rankingType, setRankingType] = useState<'personal' | 'team'>('personal')

  // 个人排名相关状态
  const [personalRankingData, setPersonalRankingData] = useState<any[]>([])
  const [personalRankingLoading, setPersonalRankingLoading] = useState(false)
  const [personalRankingPage, setPersonalRankingPage] = useState(0)
  const [personalRankingSize, setPersonalRankingSize] = useState(10)
  const [personalRankingTotal, setPersonalRankingTotal] = useState(0)
  const [selectedRankingAttendanceTypes, setSelectedRankingAttendanceTypes] = useState<string[]>([])
  const [rankingMemberName, setRankingMemberName] = useState('')
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('desc')
  const [availableRankingAttendanceTypes, setAvailableRankingAttendanceTypes] = useState<string[]>([])

  // 团队排名相关状态
  const [teamRankingData, setTeamRankingData] = useState<any[]>([])
  const [teamRankingLoading, setTeamRankingLoading] = useState(false)
  const [teamRankingPage, setTeamRankingPage] = useState(0)
  const [teamRankingSize, setTeamRankingSize] = useState(10)
  const [teamRankingTotal, setTeamRankingTotal] = useState(0)
  const [rankingTeamName, setRankingTeamName] = useState('')

  // 加载赛季列表
  const loadSeasons = async () => {
    setLoadingSeasons(true)
    try {
      const response = await fetch('/api/v1/attendance/seasons?page=0&size=1000')
      if (response.ok) {
        const data = await response.json()
        setSeasons(data.content || [])
        // 如果有赛季，默认选择第一个
        if (data.content && data.content.length > 0 && !selectedSeasonId) {
          setSelectedSeasonId(data.content[0].id)
        }
      }
    } catch (error) {
      console.error('加载赛季列表失败:', error)
    } finally {
      setLoadingSeasons(false)
    }
  }

  // 加载可用考勤类型
  const loadAvailableRankingAttendanceTypes = async () => {
    try {
      const response = await fetch('/api/v1/attendance/attendance-types')
      if (response.ok) {
        const data = await response.json()
        setAvailableRankingAttendanceTypes(data || [])
      }
    } catch (error) {
      console.error('加载考勤类型失败:', error)
    }
  }

  // 加载个人排名数据
  const loadPersonalRanking = async () => {
    if (!selectedSeasonId) return

    setPersonalRankingLoading(true)
    try {
      const params = new URLSearchParams({
        seasonId: selectedSeasonId.toString(),
        page: personalRankingPage.toString(),
        size: personalRankingSize.toString(),
        sortOrder: rankingSortOrder
      })

      if (selectedRankingAttendanceTypes.length > 0) {
        selectedRankingAttendanceTypes.forEach(type => {
          params.append('attendanceTypes', type)
        })
      }

      if (rankingMemberName.trim()) {
        params.append('memberName', rankingMemberName.trim())
      }

      const response = await fetch(`/api/v1/attendance/ranking/personal?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setPersonalRankingData(data.content || [])
        setPersonalRankingTotal(data.totalElements || 0)
      } else {
        console.error('获取个人排名失败')
        setPersonalRankingData([])
      }
    } catch (error) {
      console.error('获取个人排名失败:', error)
      setPersonalRankingData([])
    } finally {
      setPersonalRankingLoading(false)
    }
  }

  // 加载团队排名数据
  const loadTeamRanking = async () => {
    if (!selectedSeasonId) return

    setTeamRankingLoading(true)
    try {
      const params = new URLSearchParams({
        seasonId: selectedSeasonId.toString(),
        page: teamRankingPage.toString(),
        size: teamRankingSize.toString(),
        sortOrder: rankingSortOrder
      })

      if (selectedRankingAttendanceTypes.length > 0) {
        selectedRankingAttendanceTypes.forEach(type => {
          params.append('attendanceTypes', type)
        })
      }

      if (rankingTeamName.trim()) {
        params.append('teamName', rankingTeamName.trim())
      }

      const response = await fetch(`/api/v1/attendance/ranking/team?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTeamRankingData(data.content || [])
        setTeamRankingTotal(data.totalElements || 0)
      } else {
        console.error('获取团队排名失败')
        setTeamRankingData([])
      }
    } catch (error) {
      console.error('获取团队排名失败:', error)
      setTeamRankingData([])
    } finally {
      setTeamRankingLoading(false)
    }
  }

  // 考勤类型选择切换
  const toggleRankingAttendanceType = (type: string) => {
    setSelectedRankingAttendanceTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }

  // 初始化加载
  useEffect(() => {
    loadSeasons()
    loadAvailableRankingAttendanceTypes()
  }, [])

  // 赛季变化时重新加载
  useEffect(() => {
    if (selectedSeasonId) {
      if (rankingType === 'personal') {
        setPersonalRankingPage(0)
        loadPersonalRanking()
      } else {
        setTeamRankingPage(0)
        loadTeamRanking()
      }
    }
  }, [selectedSeasonId])

  // 个人排名：搜索和筛选变化时重新加载
  useEffect(() => {
    if (selectedSeasonId && rankingType === 'personal') {
      setPersonalRankingPage(0)
      loadPersonalRanking()
    }
  }, [selectedRankingAttendanceTypes, rankingMemberName, rankingSortOrder, rankingType])

  // 个人排名：分页变化时重新加载
  useEffect(() => {
    if (selectedSeasonId && rankingType === 'personal') {
      loadPersonalRanking()
    }
  }, [personalRankingPage])

  // 团队排名：搜索和筛选变化时重新加载
  useEffect(() => {
    if (selectedSeasonId && rankingType === 'team') {
      setTeamRankingPage(0)
      loadTeamRanking()
    }
  }, [selectedRankingAttendanceTypes, rankingTeamName, rankingSortOrder, rankingType])

  // 团队排名：分页变化时重新加载
  useEffect(() => {
    if (selectedSeasonId && rankingType === 'team') {
      loadTeamRanking()
    }
  }, [teamRankingPage])

  // 排名类型切换时加载对应数据
  useEffect(() => {
    if (selectedSeasonId) {
      if (rankingType === 'personal') {
        setPersonalRankingPage(0)
        loadPersonalRanking()
      } else {
        setTeamRankingPage(0)
        loadTeamRanking()
      }
    }
  }, [rankingType])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: '#fff'
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: '#2d2d2d',
        borderBottom: '1px solid #555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 1000
      }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
          查看排名
        </div>
        <button
          onClick={onBackToLogin}
          style={{
            padding: '8px 16px',
            border: '1px solid #28a745',
            background: 'transparent',
            color: '#28a745',
            cursor: 'pointer',
            fontSize: '14px',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#28a745'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#28a745'
          }}
        >
          返回登录
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{
        marginTop: '60px',
        padding: '20px'
      }}>
        {/* 赛季选择 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
            选择赛季:
          </label>
          {loadingSeasons ? (
            <div style={{ color: '#fff' }}>加载中...</div>
          ) : (
            <select
              value={selectedSeasonId || ''}
              onChange={(e) => setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 12px',
                border: '1px solid #555',
                borderRadius: '4px',
                background: '#2d2d2d',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              <option value="">请选择赛季</option>
              {seasons.map(season => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedSeasonId && (
          <>
            {/* 排名类型切换 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => setRankingType('personal')}
                style={{
                  padding: '10px 20px',
                  background: rankingType === 'personal' ? '#007bff' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                个人排名
              </button>
              <button
                onClick={() => setRankingType('team')}
                style={{
                  padding: '10px 20px',
                  background: rankingType === 'team' ? '#007bff' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                团队排名
              </button>
            </div>

            {/* 个人排名内容 */}
            {rankingType === 'personal' && (
              <div>
                {/* 筛选条件 */}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 考勤类别多选 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                      考勤类别（可多选）:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {availableRankingAttendanceTypes.map(type => (
                        <label
                          key={type}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: selectedRankingAttendanceTypes.includes(type) ? '#007bff' : '#555',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#fff'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRankingAttendanceTypes.includes(type)}
                            onChange={() => toggleRankingAttendanceType(type)}
                            style={{ cursor: 'pointer' }}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 姓名搜索和排序 */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                        姓名搜索:
                      </label>
                      <input
                        type="text"
                        value={rankingMemberName}
                        onChange={(e) => setRankingMemberName(e.target.value)}
                        placeholder="输入姓名进行模糊查询"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                        排序方式:
                      </label>
                      <select
                        value={rankingSortOrder}
                        onChange={(e) => setRankingSortOrder(e.target.value as 'asc' | 'desc')}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="desc">出勤率从高到低</option>
                        <option value="asc">出勤率从低到高</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 排名表格 */}
                {personalRankingLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
                    加载中...
                  </div>
                ) : personalRankingData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
                    暂无数据
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', color: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#404040' }}>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>排名</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>人员</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>出勤率</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>实际出勤次数</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>应参与考勤次数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalRankingData.map((item, index) => (
                            <tr key={index} style={{ background: index % 2 === 0 ? '#2d2d2d' : '#1a1a1a' }}>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.rank}</td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.memberName}</td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>
                                {item.attendanceRate.toFixed(2)}%
                              </td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.qualifiedSessions}</td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.attendedSessions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 分页 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                      <div style={{ color: '#fff' }}>
                        共 {personalRankingTotal} 条记录，第 {personalRankingPage + 1} 页，共 {Math.ceil(personalRankingTotal / personalRankingSize)} 页
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setPersonalRankingPage(prev => Math.max(0, prev - 1))}
                          disabled={personalRankingPage === 0}
                          style={{
                            padding: '6px 12px',
                            background: personalRankingPage === 0 ? '#555' : '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: personalRankingPage === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => setPersonalRankingPage(prev => prev + 1)}
                          disabled={personalRankingPage >= Math.ceil(personalRankingTotal / personalRankingSize) - 1}
                          style={{
                            padding: '6px 12px',
                            background: personalRankingPage >= Math.ceil(personalRankingTotal / personalRankingSize) - 1 ? '#555' : '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: personalRankingPage >= Math.ceil(personalRankingTotal / personalRankingSize) - 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 团队排名内容 */}
            {rankingType === 'team' && (
              <div>
                {/* 筛选条件 */}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 考勤类别多选 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                      考勤类别（可多选）:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {availableRankingAttendanceTypes.map(type => (
                        <label
                          key={type}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: selectedRankingAttendanceTypes.includes(type) ? '#007bff' : '#555',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#fff'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRankingAttendanceTypes.includes(type)}
                            onChange={() => toggleRankingAttendanceType(type)}
                            style={{ cursor: 'pointer' }}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 团队名搜索和排序 */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                        团队名搜索:
                      </label>
                      <input
                        type="text"
                        value={rankingTeamName}
                        onChange={(e) => setRankingTeamName(e.target.value)}
                        placeholder="输入团队名进行模糊查询"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
                        排序方式:
                      </label>
                      <select
                        value={rankingSortOrder}
                        onChange={(e) => setRankingSortOrder(e.target.value as 'asc' | 'desc')}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="desc">平均出勤率从高到低</option>
                        <option value="asc">平均出勤率从低到高</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 排名表格 */}
                {teamRankingLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
                    加载中...
                  </div>
                ) : teamRankingData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
                    暂无数据
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', color: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#404040' }}>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>排名</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>团队名</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>平均出勤率（加成后）</th>
                            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>参与考勤次数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRankingData.map((item, index) => (
                            <tr key={index} style={{ background: index % 2 === 0 ? '#2d2d2d' : '#1a1a1a' }}>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.rank}</td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.teamName}</td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>
                                {item.averageAttendanceRate.toFixed(2)}%
                              </td>
                              <td style={{ padding: '12px', border: '1px solid #555' }}>{item.totalSessions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 分页 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                      <div style={{ color: '#fff' }}>
                        共 {teamRankingTotal} 条记录，第 {teamRankingPage + 1} 页，共 {Math.ceil(teamRankingTotal / teamRankingSize)} 页
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setTeamRankingPage(prev => Math.max(0, prev - 1))}
                          disabled={teamRankingPage === 0}
                          style={{
                            padding: '6px 12px',
                            background: teamRankingPage === 0 ? '#555' : '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: teamRankingPage === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => setTeamRankingPage(prev => prev + 1)}
                          disabled={teamRankingPage >= Math.ceil(teamRankingTotal / teamRankingSize) - 1}
                          style={{
                            padding: '6px 12px',
                            background: teamRankingPage >= Math.ceil(teamRankingTotal / teamRankingSize) - 1 ? '#555' : '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: teamRankingPage >= Math.ceil(teamRankingTotal / teamRankingSize) - 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {!selectedSeasonId && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
            请先选择赛季
          </div>
        )}
      </div>
    </div>
  )
}

export default PublicRankingPage


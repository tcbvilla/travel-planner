import { useMemo, useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import html2canvas from 'html2canvas'
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
  参加考勤: boolean
}

type GroupStat = {
  group: string
  totalMeritIncrease: number
  averageMeritIncrease: number
  averageMeritIncreaseBonus: number
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
  startTime?: string
  endTime?: string
  season?: {
    id: number
    name: string
    startDate: string
    endDate: string
  }
}

type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

// 导出组件
const GroupStatsExportComponent = ({ 
  selectedSession,
  sortBy
}: { 
  selectedSession: AttendanceSession | null
  sortBy: 'attendance' | 'averageMerit'
}) => {
  if (!selectedSession) return null

  try {
    const memberData = selectedSession.memberData ? JSON.parse(selectedSession.memberData) : []
    const groupData = selectedSession.groupData ? JSON.parse(selectedSession.groupData) : []
    
    // 只统计参加考勤的成员
    const attendingMembers = memberData.filter((member: DisplayRow) => member.参加考勤)
    
    // 计算同盟概览数据
    const totalMembers = attendingMembers.length // 总人数（参与考勤人数）
    const qualifiedMembers = attendingMembers.filter((member: DisplayRow) => member.达标).length // 参战人数（参与考勤且达标的人数）
    const battleRatio = totalMembers > 0 ? ((qualifiedMembers / totalMembers) * 100).toFixed(1) : '0.0' // 参战比例
    const totalMerit = attendingMembers.reduce((sum: number, member: DisplayRow) => sum + member.差值, 0) // 总战功
    const averageMerit = totalMembers > 0 ? Math.round(totalMerit / totalMembers) : 0 // 人均战功
    
    // 计算最高/最低战功
    const maxMeritMember = attendingMembers.reduce((max: DisplayRow, member: DisplayRow) => 
      member.差值 > max.差值 ? member : max, attendingMembers[0]
    )
    const minMeritMember = attendingMembers.reduce((min: DisplayRow, member: DisplayRow) => 
      member.差值 < min.差值 ? member : min, attendingMembers[0]
    )
    
    // 找出并列的最高/最低战功成员
    const maxMeritValue = maxMeritMember?.差值 || 0
    const minMeritValue = minMeritMember?.差值 || 0
    const maxMeritMembers = attendingMembers.filter((member: DisplayRow) => member.差值 === maxMeritValue)
    const minMeritMembers = attendingMembers.filter((member: DisplayRow) => member.差值 === minMeritValue)

    // 计算团队排名
    const sortedByAttendance = [...groupData].sort((a, b) => 
      (b.attendanceRate || 0) - (a.attendanceRate || 0)
    )
    const sortedByAverageMerit = [...groupData].sort((a, b) => (b.averageMeritIncreaseBonus || b.averageMeritIncrease) - (a.averageMeritIncreaseBonus || a.averageMeritIncrease))
    const sortedByTotalMerit = [...groupData].sort((a, b) => b.totalMeritIncrease - a.totalMeritIncrease)

    // 为每个团队计算排名（支持并列排名）
    const getTeamRank = (teamName: string, sortedList: any[], valueKey: string) => {
      const team = sortedList.find(group => group.group === teamName)
      if (!team) return 1
      
      let rank = 1
      let previousValue = null
      
      for (let i = 0; i < sortedList.length; i++) {
        const currentValue = sortedList[i][valueKey]
        if (currentValue !== previousValue) {
          rank = i + 1
        }
        if (sortedList[i].group === teamName) {
          return rank
        }
        previousValue = currentValue
      }
      
      return rank
    }

    // 根据选择的排序方式决定团队显示顺序
    const teamsBySelectedRank = sortBy === 'attendance' ? sortedByAttendance : sortedByAverageMerit

    return (
      <div style={{
        width: '800px',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box'
      }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            margin: '0', 
            fontSize: '36px', 
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
          }}>
            小组统计报告
          </h1>
          <p style={{ 
            margin: '10px 0 0 0', 
            fontSize: '20px', 
            color: '#ccc',
            opacity: 0.8
          }}>
            {selectedSession.name}
          </p>
        </div>

        {/* 同盟概览模块 */}
        <div style={{ 
          background: '#2d2d2d', 
          borderRadius: '12px', 
          padding: '30px',
          marginBottom: '30px',
          border: '2px solid #444'
        }}>
          <h2 style={{ 
            margin: '0 0 25px 0', 
            fontSize: '24px', 
            color: '#ff6b35',
            textAlign: 'center',
            borderBottom: '2px solid #ff6b35',
            paddingBottom: '10px'
          }}>
            同盟概览
          </h2>
          
          {/* 概览数据网格 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '15px',
            marginBottom: '25px'
          }}>
            {/* 总人数 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>总人数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{totalMembers}</div>
            </div>
            
            {/* 参战人数 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>参战人数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>{qualifiedMembers}</div>
            </div>
            
            {/* 参战比例 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>参战比例</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b35' }}>{battleRatio}%</div>
            </div>
            
            {/* 总战功 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>总战功</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>{totalMerit.toLocaleString()}</div>
            </div>
            
            {/* 人均战功 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>人均战功</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>{averageMerit.toLocaleString()}</div>
            </div>
            
            {/* 最高战功 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '15px', 
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #555'
            }}>
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>最高战功</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>{maxMeritValue.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                {maxMeritMembers.map((member: DisplayRow) => 
                  `${member.分组} | ${member.成员}`
                ).join('、')}
              </div>
            </div>
          </div>
          
          {/* 最低战功 */}
          <div style={{ 
            background: '#3d3d3d', 
            padding: '15px', 
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #555',
            maxWidth: '300px',
            margin: '0 auto'
          }}>
            <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>最低战功</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>{minMeritValue.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
              {minMeritMembers.map((member: DisplayRow) => 
                `${member.分组} | ${member.成员}`
              ).join('、')}
            </div>
          </div>
        </div>

        {/* 团队详细统计 */}
        {teamsBySelectedRank.map((team, index) => {
          // 计算该团队的数据
          const teamMembers = attendingMembers.filter((member: DisplayRow) => member.分组 === team.group)
          const teamTotalMembers = teamMembers.length
          const teamQualifiedMembers = teamMembers.filter((member: DisplayRow) => member.达标).length
          // 直接使用小组统计数据中的出勤率（加成后）
          const teamBattleRatio = team.attendanceRate ? team.attendanceRate.toFixed(1) : '0.0'
          const teamTotalMerit = teamMembers.reduce((sum: number, member: DisplayRow) => sum + member.差值, 0)
          // 使用人均战功增量（加成后）的值
          const teamAverageMerit = team.averageMeritIncreaseBonus || team.averageMeritIncrease
          
          // 获取排名
          const attendanceRank = getTeamRank(team.group, sortedByAttendance, 'attendanceRate')
          const averageMeritRank = getTeamRank(team.group, sortedByAverageMerit, 'averageMeritIncreaseBonus')
          const totalMeritRank = getTeamRank(team.group, sortedByTotalMerit, 'totalMeritIncrease')
          
          // 缺勤人员
          const absentMembers = teamMembers.filter((member: DisplayRow) => !member.达标)

          return (
            <div key={index} style={{ 
              background: '#2d2d2d', 
              borderRadius: '12px', 
              padding: '25px',
              marginBottom: '20px',
              border: '2px solid #444'
            }}>
              {/* 团队名称和排名概览 */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ 
                  margin: '0', 
                  fontSize: '20px', 
                  background: '#ff6b35',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold'
                }}>
                  {team.group}
                </h3>
                
                {/* 排名概览 */}
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📖</span>
                    <span style={{ fontSize: '14px', color: '#ccc' }}>出勤排名 {attendanceRank}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⚔️</span>
                    <span style={{ fontSize: '14px', color: '#ccc' }}>人均战功 {averageMeritRank}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🐉</span>
                    <span style={{ fontSize: '14px', color: '#ccc' }}>总战功 {totalMeritRank}</span>
                  </div>
                </div>
              </div>
              
              {/* 团队核心数据 */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', 
                gap: '12px',
                marginBottom: '15px'
              }}>
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>总人数</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{teamTotalMembers}</div>
                </div>
                
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>参战人数</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>{teamQualifiedMembers}</div>
                </div>
                
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>参战比例</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6b35' }}>{teamBattleRatio}%</div>
                </div>
                
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>总战功</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196f3' }}>{teamTotalMerit.toLocaleString()}</div>
                </div>
                
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>人均战功</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffc107' }}>{teamAverageMerit.toLocaleString()}</div>
                </div>
              </div>
              
              {/* 缺勤人员 */}
              {absentMembers.length > 0 && (
                <div>
                  <h4 style={{ 
                    margin: '0 0 10px 0', 
                    fontSize: '16px', 
                    color: '#f44336',
                    borderBottom: '1px solid #f44336',
                    paddingBottom: '5px'
                  }}>
                    缺勤人员
                  </h4>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#ccc', 
                    lineHeight: '1.4',
                    background: '#3d3d3d',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #555'
                  }}>
                    {absentMembers.map((member: DisplayRow, idx: number) => 
                      `${member.分组} | ${member.成员}${idx < absentMembers.length - 1 ? ', ' : ''}`
                    ).join('')}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* 备注区域 */}
        <div style={{ 
          background: '#2d2d2d', 
          borderRadius: '12px', 
          padding: '20px',
          border: '2px solid #444'
        }}>
          <h3 style={{ 
            margin: '0 0 15px 0', 
            fontSize: '18px', 
            color: '#ff6b35',
            borderBottom: '1px solid #ff6b35',
            paddingBottom: '8px'
          }}>
            备注
          </h3>
          <div style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.6' }}>
            <div>• 出勤标准：战功差值 ≥ {selectedSession.threshold || '未设置'}</div>
            <div>• 战役结果：{selectedSession.battleResult === 'VICTORY' ? '胜利' : '失败'}</div>
            <div>• 统计时间：{new Date().toLocaleString('zh-CN')}</div>
            <div>• 数据来源：仅统计参加考勤的成员</div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('导出组件渲染失败:', error)
    return (
      <div style={{
        width: '800px',
        height: '800px',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px'
      }}>
        数据解析失败，无法生成报告
      </div>
    )
  }
}

function App() {
  // 添加点击外部关闭下拉菜单的功能
  const memberDropdownRef = useRef<HTMLDivElement>(null)
  // 导出组件引用
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 加载码表数据
  const loadCodeTables = async () => {
    try {
      console.log('开始加载码表数据...')
      const [rewardResponse, penaltyResponse] = await Promise.all([
        fetch('http://localhost:8080/api/v1/attendance/code-tables?type=REWARD'),
        fetch('http://localhost:8080/api/v1/attendance/code-tables?type=PENALTY')
      ])
      
      console.log('码表响应状态:', rewardResponse.status, penaltyResponse.status)
      
      if (rewardResponse.ok && penaltyResponse.ok) {
        const rewardData = await rewardResponse.json()
        const penaltyData = await penaltyResponse.json()
        console.log('加载到的奖励码表:', rewardData)
        console.log('加载到的处罚码表:', penaltyData)
        setRewardCodes(rewardData)
        setPenaltyCodes(penaltyData)
      } else {
        console.error('码表加载失败:', rewardResponse.status, penaltyResponse.status)
      }
    } catch (error) {
      console.error('加载码表失败:', error)
    }
  }

  // 初始化码表数据
  const initCodeTables = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/code-tables/init', {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.text()
        console.log('码表初始化结果:', result)
        // 初始化成功后重新加载码表
        await loadCodeTables()
      } else {
        console.error('初始化码表失败:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('初始化码表失败:', error)
    }
  }

  // 组件加载时初始化码表数据
  useEffect(() => {
    const initializeCodeTables = async () => {
      try {
        // 先尝试加载码表
        await loadCodeTables()
        
        // 如果码表为空，则初始化
        if (rewardCodes.length === 0 && penaltyCodes.length === 0) {
          console.log('码表为空，开始初始化...')
          await initCodeTables()
        }
      } catch (error) {
        console.error('初始化码表失败:', error)
      }
    }
    
    // 只在组件首次加载时执行一次
    initializeCodeTables()
  }, []) // 空依赖数组，确保只执行一次

  // 计算加成后出勤率的函数
  const calculateBonusAttendanceRate = (attendanceRate: number, memberCount: number): number => {
    let bonus = 0
    if (memberCount >= 40 && memberCount <= 45) {
      bonus = 3
    } else if (memberCount >= 46 && memberCount <= 50) {
      bonus = 5
    }
    const result = attendanceRate + bonus
    return result > 100 ? 100 : result
  }

  // 导出小组统计图片
  const handleExportGroupStats = async () => {
    if (!selectedSession || !exportRef.current) {
      alert('无法导出：数据不完整')
      return
    }

    try {
      // 等待组件渲染完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 800,
        height: exportRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 800,
        windowHeight: exportRef.current.scrollHeight
      })
      
      // 转换为图片并下载
      const link = document.createElement('a')
      link.download = `${selectedSession.name}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.9)
      link.click()
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败，请重试')
    }
  }

  const [startFile, setStartFile] = useState<File | null>(null)
  const [endFile, setEndFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState<number>(1)
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [activeTab, setActiveTab] = useState<'add' | 'view' | 'season'>('add')
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'groups'>('members')
  const [filteredCount, setFilteredCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  // 当切换到赛季管理页面时自动加载赛季列表
  useEffect(() => {
    if (activeTab === 'season') {
      loadSeasons(0)
    }
    if (activeTab === 'add') {
      loadAllSeasons()
    }
  }, [activeTab])

  // 考勤会话相关状态
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [sessionName, setSessionName] = useState('')
  const [battleResult, setBattleResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY')
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [seasonSearchTerm, setSeasonSearchTerm] = useState('')
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)

  // 当打开会话详情时加载所有赛季（用于编辑）
  useEffect(() => {
    if (showSessionModal) {
      loadAllSeasons()
    }
  }, [showSessionModal])
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [modalActiveTab, setModalActiveTab] = useState<'members' | 'groups' | 'rewards' | 'attendance'>('members')

  // 新增状态：用于控制"若任务"的选择
  const [taskStatus, setTaskStatus] = useState<'成功' | '失败'>('成功')

  // 新增状态：用于"成功"情况下的表单字段
  const [attendanceRateSuccess, setAttendanceRateSuccess] = useState<number | ''>('')
  const [attendanceRankSuccess, setAttendanceRankSuccess] = useState<string>('')
  const [meritRankSuccess, setMeritRankSuccess] = useState<string>('')
  const [rewardTypeSuccess, setRewardTypeSuccess] = useState<string>('钱袋')

  // 新增状态：用于"失败"情况下的表单字段
  const [attendanceRateFailure, setAttendanceRateFailure] = useState<number | ''>('')
  const [attendanceRankFailure, setAttendanceRankFailure] = useState<string>('')
  const [penaltyTypeFailure, setPenaltyTypeFailure] = useState<string>('粪汤') // 默认值

  // 新增状态：奖惩条件管理
  const [rewardConditions, setRewardConditions] = useState<any[]>([])
  const [editingCondition, setEditingCondition] = useState<any>(null)
  
  // 调整参加考勤状态
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [teamAttendanceStatus, setTeamAttendanceStatus] = useState<boolean>(true)
  const [isUpdatingTeamAttendance, setIsUpdatingTeamAttendance] = useState<boolean>(false)
  
  // 个人处理状态
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('')
  const [showMemberDropdown, setShowMemberDropdown] = useState<boolean>(false)
  const [memberAttendanceStatus, setMemberAttendanceStatus] = useState<boolean>(true)
  const [isUpdatingMemberAttendance, setIsUpdatingMemberAttendance] = useState<boolean>(false)
  
  // 删除确认弹框状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null)
  
  // 码表状态
  const [rewardCodes, setRewardCodes] = useState<any[]>([])
  const [penaltyCodes, setPenaltyCodes] = useState<any[]>([])
  
  // 导出排序选择器状态
  const [exportSortBy, setExportSortBy] = useState<'attendance' | 'averageMerit'>('attendance')
  
  // 赛季管理状态
  const [seasons, setSeasons] = useState<any[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonEndDate, setSeasonEndDate] = useState('')
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  const [currentSeasonPage, setCurrentSeasonPage] = useState(0)
  const [totalSeasonPages, setTotalSeasonPages] = useState(0)
  const [totalSeasonElements, setTotalSeasonElements] = useState(0)
  const [editingSeason, setEditingSeason] = useState<any>(null)
  const [editSeasonName, setEditSeasonName] = useState('')
  const [editSeasonStartDate, setEditSeasonStartDate] = useState('')
  const [editSeasonEndDate, setEditSeasonEndDate] = useState('')





  // 新增状态：编辑阈值（现在统一在编辑会话信息中处理）
  const [editingThresholdValue, setEditingThresholdValue] = useState<number>(0)

  // 新增状态：编辑会话基本信息
  const [editingSession, setEditingSession] = useState<boolean>(false)
  const [editingSessionName, setEditingSessionName] = useState<string>('')
  const [editingBattleResult, setEditingBattleResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY')
  const [editingStartTime, setEditingStartTime] = useState<string>('')
  const [editingEndTime, setEditingEndTime] = useState<string>('')
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null)
  const [editingSeasonSearchTerm, setEditingSeasonSearchTerm] = useState('')
  const [showEditingSeasonDropdown, setShowEditingSeasonDropdown] = useState(false)

  // 新增函数：处理"若任务"状态变化
  const handleTaskStatusChange = (status: '成功' | '失败') => {
    setTaskStatus(status)
    // 当任务状态改变时，清空或重置不显示的表单字段
    if (status === '成功') {
      setAttendanceRateFailure('')
      setAttendanceRankFailure('')
      setPenaltyTypeFailure('粪汤')
    } else { // status === '失败'
      setAttendanceRateSuccess('')
      setAttendanceRankSuccess('')
      setMeritRankSuccess('')
      setRewardTypeSuccess('钱袋')
    }
  }

  // 新增函数：开始编辑会话信息
  const startEditSession = () => {
    if (!selectedSession) return
    
    setEditingSessionName(selectedSession.name || '')
    setEditingBattleResult(selectedSession.battleResult || 'VICTORY')
    
    // 处理时间，转换为本地时间（UTC+8）
    const formatLocalDateTime = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      // 转换为本地时间字符串，格式为 YYYY-MM-DDTHH:mm
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    
    setEditingStartTime(formatLocalDateTime(selectedSession.startTime || ''))
    setEditingEndTime(formatLocalDateTime(selectedSession.endTime || ''))
    setEditingThresholdValue(selectedSession.threshold || 0)
    
    // 设置赛季编辑信息
    setEditingSeasonId(selectedSession.season?.id || null)
    setEditingSeasonSearchTerm('') // 搜索栏初始置空
    
    setEditingSession(true)
  }

  // 新增函数：保存会话信息
  const saveSessionInfo = async () => {
    if (!selectedSession) return
    
    try {
      const updateData: any = {}
      
      if (editingSessionName !== selectedSession.name) {
        updateData.name = editingSessionName
      }
      if (editingBattleResult !== selectedSession.battleResult) {
        updateData.battleResult = editingBattleResult
      }
      // 处理时间比较和转换
      const formatLocalDateTime = (dateString: string) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }
      
      const currentStartTime = formatLocalDateTime(selectedSession.startTime || '')
      const currentEndTime = formatLocalDateTime(selectedSession.endTime || '')
      
      if (editingStartTime !== currentStartTime) {
        // 发送本地时间格式给后端
        if (editingStartTime) {
          updateData.startTime = editingStartTime + ':00'
        } else {
          updateData.startTime = null
        }
      }
      if (editingEndTime !== currentEndTime) {
        // 发送本地时间格式给后端
        if (editingEndTime) {
          updateData.endTime = editingEndTime + ':00'
        } else {
          updateData.endTime = null
        }
      }
      if (editingThresholdValue !== selectedSession.threshold) {
        updateData.threshold = editingThresholdValue
      }
      
      // 检查赛季是否发生变化
      if (editingSeasonId !== selectedSession.season?.id) {
        updateData.seasonId = editingSeasonId
      }
      
      // 只有当有数据需要更新时才发送请求
      if (Object.keys(updateData).length > 0) {
        console.log('发送的更新数据:', updateData)
        const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })
        
        if (response.ok) {
          const updatedSession = await response.json()
          setSelectedSession(updatedSession)
          setEditingSession(false)
          
          // 重新获取数据以刷新界面
          await recalculateSessionData()
          
          // 刷新考勤记录列表页
          await loadSessions(currentPage)
          
          alert('会话信息更新成功')
        } else {
          alert('会话信息更新失败')
        }
      } else {
        setEditingSession(false)
        alert('没有需要更新的信息')
      }
    } catch (error) {
      console.error('更新会话信息失败:', error)
      alert('更新会话信息失败: ' + error)
    }
  }

  // 新增函数：取消编辑会话信息
  const cancelEditSession = () => {
    setEditingSession(false)
    setEditingSeasonId(null)
    setEditingSeasonSearchTerm('')
    setShowEditingSeasonDropdown(false)
  }

  // 新增函数：重新计算会话数据
  const recalculateSessionData = async () => {
    if (!selectedSession) return
    
    try {
      // 重新获取会话数据（包含重新计算的小组统计和成员数据）
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}`)
      if (response.ok) {
        const data = await response.json()
        const session = data.session as AttendanceSession
        const groupStats = data.groupStats as GroupStat[]
        
        // 更新会话数据，包含重新计算的小组统计
        const updatedSession = {
          ...session,
          groupData: JSON.stringify(groupStats)
        }
        setSelectedSession(updatedSession)
      }
    } catch (error) {
      console.error('重新计算数据失败:', error)
    }
  }

  // 新增函数：获取团队列表
  const getTeamList = (): string[] => {
    if (!selectedSession?.memberData) return []
    
    try {
      const memberData = JSON.parse(selectedSession.memberData)
      const teams = [...new Set(memberData.map((member: any) => member.分组))] as string[]
      return teams.sort()
    } catch (error) {
      console.error('解析成员数据失败:', error)
      return []
    }
  }

  // 新增函数：获取成员列表
  const getMemberList = (): string[] => {
    if (!selectedSession?.memberData) return []
    
    try {
      const memberData = JSON.parse(selectedSession.memberData)
      return memberData.map((member: any) => member.成员).sort()
    } catch (error) {
      console.error('解析成员数据失败:', error)
      return []
    }
  }

  // 新增函数：过滤成员列表（用于搜索）
  const getFilteredMembers = (): string[] => {
    const allMembers = getMemberList()
    if (!memberSearchTerm) return allMembers
    
    return allMembers.filter(member => 
      member.toLowerCase().includes(memberSearchTerm.toLowerCase()) &&
      !selectedMembers.includes(member)
    )
  }

  // 新增函数：添加选中的成员
  const addSelectedMember = (memberName: string) => {
    if (!selectedMembers.includes(memberName)) {
      setSelectedMembers([...selectedMembers, memberName])
    }
    setMemberSearchTerm('')
    setShowMemberDropdown(false)
  }

  // 新增函数：移除选中的成员
  const removeSelectedMember = (memberName: string) => {
    setSelectedMembers(selectedMembers.filter(member => member !== memberName))
  }

  // 新增函数：批量更新团队参加考勤状态
  const updateTeamAttendance = async () => {
    if (!selectedTeam || !selectedSession) {
      alert('请选择团队')
      return
    }
    
    setIsUpdatingTeamAttendance(true)
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/team-attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: selectedTeam,
          isAttending: teamAttendanceStatus
        })
      })
      
      if (response.ok) {
        const updatedSession = await response.json()
        setSelectedSession(updatedSession)
        
        // 重新获取数据以刷新界面
        await recalculateSessionData()
        
        // 刷新查看考勤记录页面的会话列表
        await loadSessions(currentPage)
        
        alert(`已成功将"${selectedTeam}"设置为${teamAttendanceStatus ? '参加' : '不参加'}考勤`)
        
        // 重置表单
        setSelectedTeam('')
        setTeamAttendanceStatus(true)
      } else {
        const errorData = await response.json()
        alert(`更新失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('批量更新团队参加考勤状态失败:', error)
      alert('批量更新团队参加考勤状态失败: ' + error)
    } finally {
      setIsUpdatingTeamAttendance(false)
    }
  }

  // 新增函数：批量更新个人参加考勤状态
  const updateMembersAttendance = async () => {
    if (selectedMembers.length === 0 || !selectedSession) {
      alert('请选择要更新的成员')
      return
    }
    
    setIsUpdatingMemberAttendance(true)
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/members-attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberNames: selectedMembers,
          isAttending: memberAttendanceStatus
        })
      })
      
      if (response.ok) {
        const updatedSession = await response.json()
        setSelectedSession(updatedSession)
        
        // 重新获取数据以刷新界面
        await recalculateSessionData()
        
        // 刷新查看考勤记录页面的会话列表
        await loadSessions(currentPage)
        
        alert(`已成功将${selectedMembers.length}个成员设置为${memberAttendanceStatus ? '参加' : '不参加'}考勤`)
        
        // 重置表单
        setSelectedMembers([])
        setMemberSearchTerm('')
        setMemberAttendanceStatus(true)
      } else {
        const errorData = await response.json()
        alert(`更新失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('批量更新个人参加考勤状态失败:', error)
      alert('批量更新个人参加考勤状态失败: ' + error)
    } finally {
      setIsUpdatingMemberAttendance(false)
    }
  }

  // 新增函数：生成默认考勤名称
  const generateDefaultSessionName = () => {
    if (!startFile || !endFile) {
      return '';
    }
    
    // 从文件名解析时间
    const parseTimeFromFileName = (fileName: string) => {
      try {
        // 移除.csv扩展名
        const nameWithoutExt = fileName.replace('.csv', '');
        
        // 使用正则表达式提取时间部分
        // 匹配格式：2025年07月28日00时00分00秒
        const timePattern = /(\d{4})年(\d{2})月(\d{2})日(\d{2})时(\d{2})分(\d{2})秒/;
        const match = nameWithoutExt.match(timePattern);
        
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const day = parseInt(match[3]);
          const hour = parseInt(match[4]);
          const minute = parseInt(match[5]);
          
          // 格式化时间
          const formatTime = (y: number, m: number, d: number, h: number, min: number) => {
            return `${y}年${m.toString().padStart(2, '0')}月${d.toString().padStart(2, '0')}日${h.toString().padStart(2, '0')}时${min.toString().padStart(2, '0')}分`;
          };
          
          return formatTime(year, month, day, hour, minute);
        }
      } catch (error) {
        console.error('解析文件名时间失败:', error);
      }
      return '';
    };
    
    const startTime = parseTimeFromFileName(startFile.name);
    const endTime = parseTimeFromFileName(endFile.name);
    
    if (startTime && endTime) {
      return `${startTime} 至 ${endTime} 考勤`;
    }
    
    return '';
  };

  // 新增函数：验证表单数据
  const validateForm = () => {
    if (taskStatus === '成功') {
      // 成功情况：必须填写出勤率阈值，出勤率排名和战功增量排名只能选择一个
      if (!attendanceRateSuccess) {
        alert('请填写出勤率阈值')
        return false
      }
      if (!attendanceRankSuccess && !meritRankSuccess) {
        alert('请至少选择一个排名条件（出勤率排名或战功增量排名）')
        return false
      }
      if (attendanceRankSuccess && meritRankSuccess) {
        alert('出勤率排名和战功增量排名只能选择一个，不能同时选择两个排名')
        return false
      }
      if (!rewardTypeSuccess) {
        alert('请选择奖励类型')
        return false
      }
    } else {
      // 失败情况：必须填写出勤率阈值和排名
      if (!attendanceRateFailure) {
        alert('请填写出勤率阈值')
        return false
      }
      if (!attendanceRankFailure) {
        alert('请选择出勤率排名')
        return false
      }
      if (!penaltyTypeFailure) {
        alert('请选择处罚类型')
        return false
      }
    }
    return true
  }

  // 新增函数：保存奖惩条件
  const saveRewardCondition = async () => {
    console.log('开始保存奖惩条件...')
    if (!selectedSession) {
      console.error('没有选中的会话')
      return
    }
    
    // 验证表单
    if (!validateForm()) {
      console.log('表单验证失败')
      return
    }
    
    const requestData = {
      attendanceSessionId: selectedSession.id,
      taskStatus: taskStatus,
      attendanceRateThreshold: taskStatus === '成功' ? attendanceRateSuccess : attendanceRateFailure,
      attendanceRateRank: taskStatus === '成功' ? (attendanceRankSuccess || null) : attendanceRankFailure,
      meritIncreaseRank: taskStatus === '成功' ? (meritRankSuccess || null) : null,
      rewardType: taskStatus === '成功' ? rewardTypeSuccess : null,
      penaltyType: taskStatus === '失败' ? penaltyTypeFailure : null
    }

    console.log('请求数据:', requestData)

    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/save-reward-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      console.log('响应状态:', response.status)
      
      if (response.ok) {
        console.log('保存成功')
        // 重新加载奖惩条件列表
        loadRewardConditions()
        // 重置表单
        resetRewardForm()
      } else {
        const errorText = await response.text()
        console.error('保存失败:', errorText)
        alert('保存失败: ' + errorText)
      }
    } catch (error) {
      console.error('保存奖惩条件失败:', error)
      alert('网络错误: ' + error)
    }
  }

  // 新增函数：加载奖惩条件列表
  const loadRewardConditions = async () => {
    console.log('loadRewardConditions called, selectedSession:', selectedSession)
    if (!selectedSession) {
      console.log('selectedSession is null, skipping loadRewardConditions')
      return
    }
    
    try {
      console.log('Fetching reward conditions for session ID:', selectedSession.id)
      const response = await fetch(`http://localhost:8080/api/v1/attendance/reward-conditions/${selectedSession.id}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Received reward conditions:', data)
        setRewardConditions(data)
      } else {
        console.error('Failed to load reward conditions, status:', response.status)
      }
    } catch (error) {
      console.error('加载奖惩条件失败:', error)
    }
  }

  // 新增函数：编辑奖惩条件
  const editRewardCondition = (condition: any) => {
    setEditingCondition(condition)
    setTaskStatus(condition.taskStatus)
    
    if (condition.taskStatus === '成功') {
      setAttendanceRateSuccess(condition.attendanceRateThreshold || '')
      setAttendanceRankSuccess(condition.attendanceRateRank ? String(condition.attendanceRateRank) : '')
      setMeritRankSuccess(condition.meritIncreaseRank ? String(condition.meritIncreaseRank) : '')
              setRewardTypeSuccess(condition.rewardType || '钱袋')
    } else {
      setAttendanceRateFailure(condition.attendanceRateThreshold || '')
      setAttendanceRankFailure(condition.attendanceRateRank ? String(condition.attendanceRateRank) : '')
              setPenaltyTypeFailure(condition.penaltyType || '粪汤')
    }
  }

  // 新增函数：更新奖惩条件
  const updateRewardCondition = async () => {
    if (!editingCondition) return
    
    // 验证表单
    if (!validateForm()) {
      return
    }
    
    const requestData = {
      attendanceSessionId: selectedSession?.id,
      taskStatus: taskStatus,
      attendanceRateThreshold: taskStatus === '成功' ? attendanceRateSuccess : attendanceRateFailure,
      attendanceRateRank: taskStatus === '成功' ? (attendanceRankSuccess || null) : attendanceRankFailure,
      meritIncreaseRank: taskStatus === '成功' ? (meritRankSuccess || null) : null,
      rewardType: taskStatus === '成功' ? rewardTypeSuccess : null,
      penaltyType: taskStatus === '失败' ? penaltyTypeFailure : null
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/reward-conditions/${editingCondition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      if (response.ok) {
        loadRewardConditions()
        resetRewardForm()
        setEditingCondition(null)
      }
    } catch (error) {
      console.error('更新奖惩条件失败:', error)
    }
  }

  // 新增函数：删除奖惩条件
  const deleteRewardCondition = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/reward-conditions/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        loadRewardConditions()
      }
    } catch (error) {
      console.error('删除奖惩条件失败:', error)
    }
  }

  // 新增函数：更新考勤记录状态
  const updateSessionStatus = async (sessionId: number, newStatus: string) => {
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${sessionId}/status?status=${newStatus}`, {
        method: 'PUT'
      })
      
      if (response.ok) {
        // 重新加载会话列表
        loadSessions(currentPage)
        // 如果当前查看的是这个会话，也更新selectedSession
        if (selectedSession && selectedSession.id === sessionId) {
          // 重新获取完整的会话数据（包括小组统计）
          const sessionResponse = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${sessionId}`)
          if (sessionResponse.ok) {
            const data = await sessionResponse.json()
            const session = data.session as AttendanceSession
            const groupStats = data.groupStats as GroupStat[]
            
            // 更新会话数据，包含重新计算的小组统计
            const updatedSession = {
              ...session,
              groupData: JSON.stringify(groupStats)
            }
            setSelectedSession(updatedSession)
          }
        }
      }
    } catch (error) {
      console.error('更新状态失败:', error)
      alert('更新状态失败: ' + error)
    }
  }

  // 新增函数：重置奖惩表单
  const resetRewardForm = () => {
    setTaskStatus('成功')
    setAttendanceRateSuccess('')
    setAttendanceRankSuccess('')
    setMeritRankSuccess('')
    setRewardTypeSuccess('钱袋')
    setAttendanceRateFailure('')
    setAttendanceRankFailure('')
    setPenaltyTypeFailure('粪汤')
    setEditingCondition(null)
  }


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
        
        // 自动生成默认考勤名称
        const defaultName = generateDefaultSessionName();
        if (defaultName && !sessionName.trim()) {
          setSessionName(defaultName);
        }
        
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
          达标: diff >= threshold,
          参加考勤: true
        })
      }
      setFilteredCount(filtered)
      display.sort((a, b) => b.差值 - a.差值)
      setRows(display)
      // 计算小组统计（只包含参加考勤的人员）
      const groupMap = new Map<string, { total: number; assistTotal: number; count: number; present: number }>()
      console.log('Debug - starting group calculation with', display.length, 'rows')
      for (const row of display) {
        // 只处理参加考勤的人员
        if (!row.参加考勤) {
          console.log('Debug - skipping member:', row.成员, 'group:', row.分组, 'reason: not attending')
          continue
        }
        
        const group = row.分组
        console.log('Debug - processing member:', row.成员, 'group:', group, 'diff:', row.差值, 'assistDiff:', row.助攻差值, 'qualified:', row.达标, 'attending:', row.参加考勤)
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
        const averageMeritIncrease = data.count > 0 ? Math.round(data.total / data.count) : 0
        let averageMeritIncreaseBonus = averageMeritIncrease
        
        // 计算人均战功增量（加成后）
        if (data.count >= 40 && data.count <= 45) {
          // 小组人数40-45，加成1.03
          averageMeritIncreaseBonus = Math.round(averageMeritIncrease * 1.03)
        } else if (data.count >= 46 && data.count <= 50) {
          // 小组人数46-50，加成1.05
          averageMeritIncreaseBonus = Math.round(averageMeritIncrease * 1.05)
        }
        
        stats.push({
          group: group,
          totalMeritIncrease: data.total,
          averageMeritIncrease: averageMeritIncrease,
          averageMeritIncreaseBonus: averageMeritIncreaseBonus,
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
      
      // 自动生成默认考勤名称
      const defaultName = generateDefaultSessionName();
      if (defaultName && !sessionName.trim()) {
        setSessionName(defaultName);
      }
    } catch (err: any) {
      setError(err?.message ?? '解析失败')
    }
  }

  // 保存考勤会话
  const saveSession = async () => {
    let finalSessionName = sessionName.trim();
    
    // 验证赛季选择
    if (!selectedSeasonId) {
      setError('请选择赛季')
      return
    }
    
    // 如果考勤名称为空，使用默认名称
    if (!finalSessionName) {
      finalSessionName = generateDefaultSessionName();
      if (!finalSessionName) {
        setError('请输入考勤名称或上传包含时间信息的CSV文件')
        return
      }
    }
    
    try {
      const requestBody = {
        name: finalSessionName,
        battleResult: battleResult,
        memberData: JSON.stringify(rows),
        // 移除小组统计数据的保存，改为实时计算
        threshold: threshold,
        startTime: startFile?.name || '',
        endTime: endFile?.name || '',
        seasonId: selectedSeasonId
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
      setSelectedSeasonId(null)
      setSeasonSearchTerm('')
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
      console.log('小组统计数据:', groupStats)
      const sessionWithGroupStats = {
        ...session,
        groupData: JSON.stringify(groupStats)
      }
      console.log('设置到selectedSession的groupData:', sessionWithGroupStats.groupData)
      
      setSelectedSession(sessionWithGroupStats)
      setShowSessionModal(true)
      
      // 初始化编辑阈值状态
      setEditingThresholdValue(session.threshold || 0)
      
      // 加载奖惩条件列表 - 使用sessionWithGroupStats而不是依赖selectedSession状态
      try {
        console.log('Fetching reward conditions for session ID:', sessionWithGroupStats.id)
        const response = await fetch(`http://localhost:8080/api/v1/attendance/reward-conditions/${sessionWithGroupStats.id}`)
        if (response.ok) {
          const data = await response.json()
          console.log('Received reward conditions:', data)
          setRewardConditions(data)
        } else {
          console.error('Failed to load reward conditions, status:', response.status)
        }
      } catch (error) {
        console.error('加载奖惩条件失败:', error)
      }
    } catch (err: any) {
      console.error('查看会话错误:', err)
      setError(err?.message ?? '加载失败')
    }
  }

  // 显示删除确认弹框
  const showDeleteConfirmation = (sessionId: number) => {
    setSessionToDelete(sessionId)
    setShowDeleteConfirm(true)
  }

  // 确认删除会话
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return
    
    try {
      const resp = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${sessionToDelete}`, {
        method: 'DELETE'
      })
      
      if (!resp.ok) throw new Error(`删除失败: ${resp.status}`)
      
      setError(null)
      // 刷新会话列表
      loadSessions(currentPage)
      // 关闭弹框
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
    } catch (err: any) {
      setError(err?.message ?? '删除失败')
    }
  }

  // 取消删除
  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setSessionToDelete(null)
  }

  // 加载赛季列表
  const loadSeasons = async (page: number = 0) => {
    setLoadingSeasons(true)
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/seasons?page=${page}&size=10`)
      if (response.ok) {
        const data = await response.json()
        setSeasons(data.content || [])
        setTotalSeasonPages(data.totalPages || 0)
        setTotalSeasonElements(data.totalElements || 0)
        setCurrentSeasonPage(page)
      } else {
        console.error('加载赛季列表失败:', response.status)
      }
    } catch (error) {
      console.error('加载赛季列表失败:', error)
    } finally {
      setLoadingSeasons(false)
    }
  }

  // 创建赛季
  const createSeason = async () => {
    if (!seasonName.trim() || !seasonStartDate || !seasonEndDate) {
      setError('请填写完整的赛季信息')
      return
    }

    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: seasonName.trim(),
          startDate: seasonStartDate,
          endDate: seasonEndDate
        })
      })

      if (response.ok) {
        setSeasonName('')
        setSeasonStartDate('')
        setSeasonEndDate('')
        setError(null)
        loadSeasons(currentSeasonPage) // 重新加载赛季列表
      } else {
        const errorData = await response.text()
        setError('创建赛季失败: ' + errorData)
      }
    } catch (error) {
      setError('创建赛季失败: ' + error)
    }
  }

  // 删除赛季
  const deleteSeason = async (id: number) => {
    if (!confirm('确定要删除这个赛季吗？')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/seasons/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadSeasons(currentSeasonPage) // 重新加载赛季列表
      } else {
        const errorData = await response.text()
        setError('删除赛季失败: ' + errorData)
      }
    } catch (error) {
      setError('删除赛季失败: ' + error)
    }
  }

  // 开始编辑赛季
  const startEditSeason = (season: any) => {
    setEditingSeason(season)
    setEditSeasonName(season.name)
    setEditSeasonStartDate(season.startDate)
    setEditSeasonEndDate(season.endDate)
  }

  // 取消编辑
  const cancelEditSeason = () => {
    setEditingSeason(null)
    setEditSeasonName('')
    setEditSeasonStartDate('')
    setEditSeasonEndDate('')
  }

  // 保存编辑
  const saveEditSeason = async () => {
    if (!editingSeason || !editSeasonName.trim() || !editSeasonStartDate || !editSeasonEndDate) {
      setError('请填写完整的赛季信息')
      return
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/seasons/${editingSeason.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editSeasonName.trim(),
          startDate: editSeasonStartDate,
          endDate: editSeasonEndDate
        })
      })

      if (response.ok) {
        setEditingSeason(null)
        setEditSeasonName('')
        setEditSeasonStartDate('')
        setEditSeasonEndDate('')
        setError(null)
        loadSeasons(currentSeasonPage) // 重新加载赛季列表
      } else {
        const errorData = await response.text()
        setError('更新赛季失败: ' + errorData)
      }
    } catch (error) {
      setError('更新赛季失败: ' + error)
    }
  }

  // 计算赛季状态
  const getSeasonStatus = (startDate: string, endDate: string) => {
    const now = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // 设置时间为当天的开始和结束
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    now.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    
    if (now < start) {
      return { status: '未开始', color: '#6c757d' }
    } else if (now >= start && now <= end) {
      return { status: '进行中', color: '#28a745' }
    } else {
      return { status: '已完结', color: '#dc3545' }
    }
  }

  // 分页控制函数
  const handleSeasonPageChange = (newPage: number) => {
    loadSeasons(newPage)
  }

  // 获取所有赛季（用于下拉选择）
  const [allSeasons, setAllSeasons] = useState<any[]>([])
  const loadAllSeasons = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/seasons?page=0&size=1000')
      if (response.ok) {
        const data = await response.json()
        setAllSeasons(data.content || [])
      }
    } catch (error) {
      console.error('加载所有赛季失败:', error)
    }
  }

  // 赛季搜索和选择相关函数
  const getFilteredSeasons = () => {
    if (!seasonSearchTerm.trim()) {
      return allSeasons
    }
    return allSeasons.filter(season => 
      season.name.toLowerCase().includes(seasonSearchTerm.toLowerCase())
    )
  }

  const selectSeason = (season: any) => {
    console.log('选择赛季:', season)
    setSelectedSeasonId(season.id)
    setSeasonSearchTerm('') // 清空搜索词
    setShowSeasonDropdown(false)
  }

  // 编辑赛季选择相关函数
  const selectEditingSeason = (season: any) => {
    console.log('选择编辑赛季:', season)
    setEditingSeasonId(season.id)
    setEditingSeasonSearchTerm(season.name)
    setShowEditingSeasonDropdown(false)
  }



  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.season-dropdown-container')) {
        setShowSeasonDropdown(false)
      }
      if (!target.closest('.editing-season-dropdown-container')) {
        setShowEditingSeasonDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh',
      width: '100%'
    }}>
      {/* 固定顶部菜单 */}
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#1a1a1a',
        borderBottom: '2px solid #dee2e6',
        padding: '16px',
        display: 'flex',
        gap: 8
      }}>
        <button
          onClick={() => setActiveTab('add')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'add' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'add' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
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
            background: activeTab === 'view' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'view' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          查看考勤记录
        </button>
        <button
          onClick={() => setActiveTab('season')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'season' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'season' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          赛季管理
        </button>
      </div>

      {/* 页面内容区域 */}
      <div style={{ 
        marginTop: '80px', // 为固定菜单留出空间
        padding: '16px',
        minHeight: 'calc(100vh - 80px)' // 确保内容区域至少占满剩余空间
      }}>

      {activeTab === 'add' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ color: '#fff' }}>添加考勤</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: '#fff' }}>
          起始CSV：
                          <input type="file" accept=".csv" onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setStartFile(file);
                  // 如果两个文件都已上传，自动生成默认考勤名称
                  if (file && endFile && !sessionName.trim()) {
                    const defaultName = generateDefaultSessionName();
                    if (defaultName) {
                      setSessionName(defaultName);
                    }
                  }
                }} />
        </label>
        <label style={{ color: '#fff' }}>
          结束CSV：
                          <input type="file" accept=".csv" onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setEndFile(file);
                  // 如果两个文件都已上传，自动生成默认考勤名称
                  if (file && startFile && !sessionName.trim()) {
                    const defaultName = generateDefaultSessionName();
                    if (defaultName) {
                      setSessionName(defaultName);
                    }
                  }
                }} />
        </label>
        <label style={{ color: '#fff' }}>
          出勤标准（差值≥）：
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            style={{ width: 100 }}
          />
        </label>
        <button 
          onClick={compute} 
          disabled={!canCompute}
          style={{
            padding: '8px 16px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
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
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>赛季</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>战役结果</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>出勤标准</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>起始时间</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>结束时间</th>
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
                      {session.season?.name || '未设置'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.battleResult === 'VICTORY' ? '胜利' : '失败'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.threshold || '未设置'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.startTime ? new Date(session.startTime).toLocaleString() : '未设置'}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.endTime ? new Date(session.endTime).toLocaleString() : '未设置'}
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
                          onClick={() => showDeleteConfirmation(session.id)}
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

      {activeTab === 'season' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ color: '#fff', marginBottom: '20px' }}>赛季管理</h2>
          
          {/* 添加赛季表单 */}
          <div style={{ 
            background: '#3d3d3d', 
            padding: '20px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #555'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>添加赛季</h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                赛季名称：
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="请输入赛季名称"
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #555', 
                    borderRadius: '4px', 
                    background: '#2d2d2d',
                    color: '#fff',
                    minWidth: '200px'
                  }}
                />
              </label>
              <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                起始日期：
                <input
                  type="date"
                  value={seasonStartDate}
                  onChange={(e) => setSeasonStartDate(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #555', 
                    borderRadius: '4px', 
                    background: '#2d2d2d',
                    color: '#fff'
                  }}
                />
              </label>
              <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                结束日期：
                <input
                  type="date"
                  value={seasonEndDate}
                  onChange={(e) => setSeasonEndDate(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #555', 
                    borderRadius: '4px', 
                    background: '#2d2d2d',
                    color: '#fff'
                  }}
                />
              </label>
              <button
                onClick={createSeason}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginTop: '20px'
                }}
              >
                添加赛季
              </button>
            </div>
            
            {/* 错误提示 */}
            {error && (
              <div style={{ 
                color: '#ff6b6b', 
                marginTop: '12px', 
                padding: '8px 12px', 
                background: '#4a2d2d', 
                borderRadius: '4px',
                border: '1px solid #ff6b6b'
              }}>
                错误：{error}
              </div>
            )}
          </div>

          {/* 赛季列表 */}
          <div style={{ 
            background: '#3d3d3d', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #555'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>赛季列表</h3>
              <button
                onClick={() => loadSeasons(0)}
                style={{
                  padding: '6px 12px',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                刷新
              </button>
            </div>
            
            {loadingSeasons ? (
              <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>加载中...</div>
            ) : seasons.length === 0 ? (
              <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>暂无赛季数据</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#404040' }}>
                      <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>赛季名称</th>
                      <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>起始日期</th>
                      <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>结束日期</th>
                      <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>赛季状态</th>
                      <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map((season) => (
                      <tr key={season.id} style={{ background: '#2d2d2d' }}>
                        <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                          {editingSeason?.id === season.id ? (
                            <input
                              type="text"
                              value={editSeasonName}
                              onChange={(e) => setEditSeasonName(e.target.value)}
                              style={{ 
                                padding: '4px 8px', 
                                border: '1px solid #555', 
                                borderRadius: '4px', 
                                background: '#2d2d2d',
                                color: '#fff',
                                width: '100%'
                              }}
                            />
                          ) : (
                            season.name
                          )}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                          {editingSeason?.id === season.id ? (
                            <input
                              type="date"
                              value={editSeasonStartDate}
                              onChange={(e) => setEditSeasonStartDate(e.target.value)}
                              style={{ 
                                padding: '4px 8px', 
                                border: '1px solid #555', 
                                borderRadius: '4px', 
                                background: '#2d2d2d',
                                color: '#fff'
                              }}
                            />
                          ) : (
                            season.startDate
                          )}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                          {editingSeason?.id === season.id ? (
                            <input
                              type="date"
                              value={editSeasonEndDate}
                              onChange={(e) => setEditSeasonEndDate(e.target.value)}
                              style={{ 
                                padding: '4px 8px', 
                                border: '1px solid #555', 
                                borderRadius: '4px', 
                                background: '#2d2d2d',
                                color: '#fff'
                              }}
                            />
                          ) : (
                            season.endDate
                          )}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: getSeasonStatus(season.startDate, season.endDate).color,
                            color: '#fff'
                          }}>
                            {getSeasonStatus(season.startDate, season.endDate).status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                          {editingSeason?.id === season.id ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={saveEditSeason}
                                style={{
                                  padding: '4px 8px',
                                  background: '#28a745',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEditSeason}
                                style={{
                                  padding: '4px 8px',
                                  background: '#6c757d',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => startEditSeason(season)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#ffc107',
                                  color: '#000',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => deleteSeason(season.id)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#dc3545',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                删除
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* 分页控件 */}
                {totalSeasonPages > 1 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginTop: '16px',
                    padding: '12px',
                    background: '#2d2d2d',
                    borderRadius: '4px'
                  }}>
                    <button
                      onClick={() => handleSeasonPageChange(currentSeasonPage - 1)}
                      disabled={currentSeasonPage === 0}
                      style={{
                        padding: '6px 12px',
                        background: currentSeasonPage === 0 ? '#6c757d' : '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentSeasonPage === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      上一页
                    </button>
                    
                    <span style={{ color: '#fff', fontSize: '14px' }}>
                      第 {currentSeasonPage + 1} 页，共 {totalSeasonPages} 页
                    </span>
                    
                    <button
                      onClick={() => handleSeasonPageChange(currentSeasonPage + 1)}
                      disabled={currentSeasonPage >= totalSeasonPages - 1}
                      style={{
                        padding: '6px 12px',
                        background: currentSeasonPage >= totalSeasonPages - 1 ? '#6c757d' : '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentSeasonPage >= totalSeasonPages - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      下一页
                    </button>
                    
                    <span style={{ color: '#fff', fontSize: '14px', marginLeft: '16px' }}>
                      共 {totalSeasonElements} 条记录
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'add' && rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
            {/* 保存考勤功能 */}
            <div style={{ marginBottom: 16, padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', background: '#2d2d2d' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>保存考勤</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  考勤名称：
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="请输入考勤名称"
                    style={{ 
                      width: 200,
                      padding: '8px 12px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#2d2d2d',
                      color: '#fff',
                      minHeight: '36px'
                    }}
                  />
                </label>
                <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  战役结果：
                  <select
                    value={battleResult}
                    onChange={(e) => setBattleResult(e.target.value as 'VICTORY' | 'DEFEAT')}
                    style={{ 
                      width: 100,
                      padding: '8px 12px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#2d2d2d',
                      color: '#fff',
                      minHeight: '36px'
                    }}
                  >
                    <option value="VICTORY">胜利</option>
                    <option value="DEFEAT">失败</option>
                  </select>
                </label>
                <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} className="season-dropdown-container">
                  赛季：
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '8px 12px',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    background: '#2d2d2d',
                    color: '#fff',
                    width: 200,
                    minHeight: '36px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      {selectedSeasonId 
                        ? allSeasons.find(s => s.id === selectedSeasonId)?.name 
                        : '请选择赛季'
                      }
                    </span>
                    <span style={{ 
                      transform: showSeasonDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      ▼
                    </span>
                  </div>
                  
                  {/* 搜索框 - 只在下拉框打开时显示 */}
                  {showSeasonDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#2d2d2d',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      zIndex: 1000,
                      padding: '8px'
                    }}>
                      <input
                        type="text"
                        value={seasonSearchTerm}
                        onChange={(e) => setSeasonSearchTerm(e.target.value)}
                        placeholder="搜索赛季..."
                        style={{ 
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#1a1a1a',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                        autoFocus
                      />
                      <div style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        marginTop: '8px'
                      }}>
                        {getFilteredSeasons().map((season) => (
                          <div
                            key={season.id}
                            onClick={() => selectSeason(season)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              color: '#fff',
                              borderBottom: '1px solid #555',
                              backgroundColor: selectedSeasonId === season.id ? '#404040' : 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedSeasonId !== season.id) {
                                e.currentTarget.style.background = '#404040'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedSeasonId !== season.id) {
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                          >
                            {season.name}
                          </div>
                        ))}
                        {getFilteredSeasons().length === 0 && (
                          <div style={{ padding: '8px 12px', color: '#999', textAlign: 'center' }}>
                            没有找到匹配的赛季
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ height: '20px' }}></div>
                  <button onClick={saveSession} style={{ 
                    padding: '8px 16px', 
                    background: '#28a745', 
                    color: '#fff', 
                    border: 'none', 
                    cursor: 'pointer',
                    borderRadius: '4px',
                    minHeight: '36px'
                  }}>
                    保存考勤
                  </button>
                </div>
              </div>
            </div>
            
            {/* 子标签栏 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActiveSubTab('members')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: activeSubTab === 'members' ? '#007bff' : '#555555',
                  color: '#fff',
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
                  background: activeSubTab === 'groups' ? '#007bff' : '#555555',
                  color: '#fff',
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
                    <tr style={{ background: '#404040' }}>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>成员</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>分组</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功总量（前值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功总量（后值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功差值</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻总量（前值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻总量（后值）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻差值</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>是否参加考勤</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>是否达标</th>
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
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{r.参加考勤 ? '参加' : '不参加'}</td>
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
                    <tr style={{ background: '#404040' }}>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>分组</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总战功增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均战功增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>出勤率（%）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>出勤率（加成后）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>小组人数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStats.map((g) => (
                      <tr key={g.group} style={{ background: '#2d2d2d' }}>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.group}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.totalMeritIncrease}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.averageMeritIncrease}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.totalAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.averageAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.attendanceRate}%</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{calculateBonusAttendanceRate(g.attendanceRate, g.memberCount)}%</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.memberCount}</td>
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
            background: '#2d2d2d',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: modalActiveTab === 'rewards' ? '1200px' : '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#fff' }}>考勤详情 - {selectedSession.name}</h3>
              <button
                onClick={() => setShowSessionModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#fff' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              {editingSession ? (
                // 编辑模式
                <div style={{ background: '#404040', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>编辑会话信息</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>考勤名称：</label>
                      <input
                        type="text"
                        value={editingSessionName}
                        onChange={(e) => setEditingSessionName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>战役结果：</label>
                      <select
                        value={editingBattleResult}
                        onChange={(e) => setEditingBattleResult(e.target.value as 'VICTORY' | 'DEFEAT')}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff'
                        }}
                      >
                        <option value="VICTORY">胜利</option>
                        <option value="DEFEAT">失败</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>起始时间：</label>
                      <input
                        type="datetime-local"
                        value={editingStartTime}
                        onChange={(e) => setEditingStartTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>结束时间：</label>
                      <input
                        type="datetime-local"
                        value={editingEndTime}
                        onChange={(e) => setEditingEndTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>战功阈值：</label>
                      <input
                        type="number"
                        value={editingThresholdValue}
                        onChange={(e) => setEditingThresholdValue(Number(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>赛季：</label>
                      <div style={{ position: 'relative' }} className="editing-season-dropdown-container">
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          padding: '8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                        onClick={() => setShowEditingSeasonDropdown(!showEditingSeasonDropdown)}
                        >
                          <span style={{ flex: 1, textAlign: 'left' }}>
                            {editingSeasonId 
                              ? allSeasons.find(s => s.id === editingSeasonId)?.name 
                              : '请选择赛季'
                            }
                          </span>
                          <span style={{ 
                            transform: showEditingSeasonDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                          }}>
                            ▼
                          </span>
                        </div>
                        
                        {/* 搜索框 - 只在下拉框打开时显示 */}
                        {showEditingSeasonDropdown && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#2d2d2d',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            zIndex: 1000,
                            padding: '8px'
                          }}>
                            <input
                              type="text"
                              value={editingSeasonSearchTerm}
                              onChange={(e) => setEditingSeasonSearchTerm(e.target.value)}
                              placeholder="搜索赛季..."
                              style={{ 
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                background: '#1a1a1a',
                                color: '#fff',
                                fontSize: '14px'
                              }}
                              autoFocus
                            />
                            <div style={{
                              maxHeight: '150px',
                              overflowY: 'auto',
                              marginTop: '8px'
                            }}>
                              {allSeasons.filter(season => 
                                season.name.toLowerCase().includes(editingSeasonSearchTerm.toLowerCase())
                              ).map((season) => (
                                <div
                                  key={season.id}
                                  onClick={() => selectEditingSeason(season)}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    borderBottom: '1px solid #555',
                                    backgroundColor: editingSeasonId === season.id ? '#404040' : 'transparent'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (editingSeasonId !== season.id) {
                                      e.currentTarget.style.background = '#404040'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (editingSeasonId !== season.id) {
                                      e.currentTarget.style.background = 'transparent'
                                    }
                                  }}
                                >
                                  {season.name}
                                </div>
                              ))}
                              {allSeasons.filter(season => 
                                season.name.toLowerCase().includes(editingSeasonSearchTerm.toLowerCase())
                              ).length === 0 && (
                                <div style={{ padding: '8px 12px', color: '#999', textAlign: 'center' }}>
                                  没有找到匹配的赛季
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      onClick={saveSessionInfo}
                      style={{
                        padding: '8px 16px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEditSession}
                      style={{
                        padding: '8px 16px',
                        background: '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '14px', color: '#fff' }}>
                  <div><strong>考勤名称：</strong>{selectedSession.name}</div>
                  <div><strong>战役结果：</strong>{selectedSession.battleResult === 'VICTORY' ? '胜利' : '失败'}</div>
                  <div><strong>赛季：</strong>{selectedSession.season?.name || '未设置'}</div>
                  <div><strong>起始时间：</strong>{selectedSession.startTime ? new Date(selectedSession.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置'}</div>
                  <div><strong>结束时间：</strong>{selectedSession.endTime ? new Date(selectedSession.endTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置'}</div>
                  <div><strong>战功阈值：</strong>{selectedSession.threshold || '未设置'}</div>
                  <div><strong>状态：</strong>
                    {selectedSession.status === 'ADDED' && '已添加'}
                    {selectedSession.status === 'SAVED' && '已保存'}
                    {selectedSession.status === 'SETTLED' && '已结算'}
                  </div>
                  <div><strong>创建时间：</strong>{new Date(selectedSession.createdAt).toLocaleString()}</div>
                  <div><strong>更新时间：</strong>{new Date(selectedSession.updatedAt).toLocaleString()}</div>
                </div>
              )}
              
              {!editingSession && selectedSession.status === 'ADDED' && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={startEditSession}
                    style={{
                      padding: '6px 12px',
                      background: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    编辑
                  </button>
                </div>
              )}
            </div>
            
            {/* 页签栏 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setModalActiveTab('members')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'members' ? '#007bff' : '#555555',
                  color: '#fff',
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
                  background: modalActiveTab === 'groups' ? '#007bff' : '#555555',
                  color: '#fff',
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
                  background: modalActiveTab === 'rewards' ? '#007bff' : '#555555',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                考勤奖惩
              </button>
              <button
                onClick={() => setModalActiveTab('attendance')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'attendance' ? '#007bff' : '#555555',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                调整参加考勤
              </button>
            </div>
            
            {/* 成员详情 */}
            {modalActiveTab === 'members' && selectedSession.memberData && selectedSession.memberData !== '[]' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#404040' }}>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>成员</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>分组</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功前值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功后值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>战功差值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻前值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻后值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>助攻差值</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>是否参加考勤</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>是否达标</th>

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
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.参加考勤 ? '参加' : '不参加'}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#000' }}>{member.达标 ? '出勤' : '未出勤'}</td>

                            </tr>
                          ));
                        } catch (error) {
                          console.error('解析成员数据失败:', error);
                          return <tr><td colSpan={10} style={{ padding: '8px', border: '1px solid #dee2e6', color: 'red' }}>解析成员数据失败: {error instanceof Error ? error.message : String(error)}</td></tr>;
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* 小组统计 */}
            {modalActiveTab === 'groups' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#404040' }}>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>分组</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总战功增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均战功增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均战功增量（加成后）</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总助攻增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>出勤率（%）</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>出勤率（加成后）</th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>小组人数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        try {
                          console.log('渲染小组统计，selectedSession.groupData:', selectedSession.groupData)
                          if (!selectedSession.groupData || selectedSession.groupData === '[]') {
                            return <tr><td colSpan={9} style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff', textAlign: 'center' }}>暂无小组统计数据</td></tr>;
                          }
                          const groupData = JSON.parse(selectedSession.groupData);
                          console.log('解析后的groupData:', groupData)
                          return groupData.map((group: GroupStat, index: number) => (
                            <tr key={index} style={{ background: '#2d2d2d' }}>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.group}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.totalMeritIncrease}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.averageMeritIncrease}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.averageMeritIncreaseBonus || group.averageMeritIncrease}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.totalAssistIncrease || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.averageAssistIncrease || 0}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.attendanceRate}%</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{calculateBonusAttendanceRate(group.attendanceRate, group.memberCount)}%</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.memberCount}</td>
                            </tr>
                          ));
                        } catch (error) {
                          console.error('解析小组数据失败:', error);
                          return <tr><td colSpan={9} style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff', textAlign: 'center' }}>解析小组数据失败: {error instanceof Error ? error.message : String(error)}</td></tr>;
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
                
                {/* 导出设置和按钮 */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  {/* 排序选择器 */}
                  <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <label style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>团队排序方式：</label>
                    <select 
                      value={exportSortBy}
                      onChange={(e) => setExportSortBy(e.target.value as 'attendance' | 'averageMerit')}
                      style={{
                        padding: '6px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="attendance">按出勤率排名</option>
                      <option value="averageMerit">按人均战功增量排名</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleExportGroupStats}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#218838'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#28a745'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    导出小组统计图片
                  </button>
                </div>
              </div>
            )}
            
            {/* 考勤奖惩 */}
            {modalActiveTab === 'rewards' && (
              <div style={{ marginBottom: '16px', width: '100%' }}>
                <div style={{ padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', background: '#2d2d2d' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>考勤奖惩规则</h4>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ margin: '8px 0', color: '#fff' }}>
                      <strong>出勤标准：</strong>战功差值 ≥ {selectedSession.threshold || '未设置'}
                    </p>
                    <p style={{ margin: '8px 0', color: '#fff' }}>
                      <strong>战役结果：</strong>{selectedSession.battleResult === 'VICTORY' ? '胜利' : '失败'}
                    </p>
                  </div>
                </div>
                
                {/* 奖惩条件表单 */}
                <div style={{ marginTop: '16px', padding: '16px', border: '2px solid #007bff', borderRadius: '4px', background: '#2d2d2d' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>
                    {editingCondition ? '编辑奖惩条件' : '新增奖惩条件'}
                  </h4>
                  
                  {/* 状态提示 */}
                  {selectedSession.status === 'SAVED' && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#2d2d2d', border: '1px solid #ffc107', borderRadius: '4px', color: '#ffc107' }}>
                      <strong>提示：</strong>当前考勤记录已保存，无法修改奖惩条件。请先取消保存状态。
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 第一行：若任务 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>若任务</label>
                      <select 
                        value={taskStatus}
                        onChange={(e) => handleTaskStatusChange(e.target.value as '成功' | '失败')}
                        disabled={selectedSession.status === 'SAVED'}
                        style={{ 
                          padding: '8px 12px', 
                          border: '2px solid #007bff', 
                          borderRadius: '4px', 
                          color: '#dc3545', 
                          background: selectedSession.status === 'SAVED' ? '#f8f9fa' : '#fff',
                          minWidth: '150px',
                          opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                        }}
                      >
                        <option value="成功">成功</option>
                        <option value="失败">失败</option>
                      </select>
                    </div>
                    
                    {/* 成功情况下的表单字段 */}
                    {taskStatus === '成功' && (
                      <>
                        {/* 第二行：出勤率大于 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>出勤率大于</label>
                          <input 
                            type="number" 
                            value={attendanceRateSuccess}
                            onChange={(e) => setAttendanceRateSuccess(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="填写数字百分比" 
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          />
                        </div>
                        
                        {/* 第三行：出勤率第 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>出勤率第</label>
                          <select 
                            value={attendanceRankSuccess}
                            onChange={(e) => {
                              setAttendanceRankSuccess(e.target.value)
                              if (e.target.value) {
                                setMeritRankSuccess('') // 清空战功增量排名
                              }
                            }}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            <option value="">请选择</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                          <span style={{ color: '#000' }}>名</span>
                        </div>
                        
                        {/* 第四行：战功增量第 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>战功增量第</label>
                          <select 
                            value={meritRankSuccess}
                            onChange={(e) => {
                              setMeritRankSuccess(e.target.value)
                              if (e.target.value) {
                                setAttendanceRankSuccess('') // 清空出勤率排名
                              }
                            }}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            <option value="">请选择</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                          <span style={{ color: '#000' }}>名</span>
                        </div>
                        
                        {/* 第五行：奖励 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>奖励</label>
                          <select 
                            value={rewardTypeSuccess}
                            onChange={(e) => setRewardTypeSuccess(e.target.value)}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            {rewardCodes.map((code) => (
                              <option key={code.id} value={code.codeName}>{code.codeName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    
                    {/* 失败情况下的表单字段 */}
                    {taskStatus === '失败' && (
                      <>
                        {/* 第二行：出勤率小于 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>出勤率小于</label>
                          <input 
                            type="number" 
                            value={attendanceRateFailure}
                            onChange={(e) => setAttendanceRateFailure(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="填写数字百分比" 
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          />
                        </div>
                        
                        {/* 第三行：出勤率倒数第 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>出勤率倒数第</label>
                          <select 
                            value={attendanceRankFailure}
                            onChange={(e) => setAttendanceRankFailure(e.target.value)}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            <option value="">请选择</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                          <span style={{ color: '#000' }}>名</span>
                        </div>
                        
                        {/* 第四行：处罚 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>处罚</label>
                          <select 
                            value={penaltyTypeFailure}
                            onChange={(e) => setPenaltyTypeFailure(e.target.value)}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            {penaltyCodes.map((code) => (
                              <option key={code.id} value={code.codeName}>{code.codeName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    
                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button
                        onClick={editingCondition ? updateRewardCondition : saveRewardCondition}
                        disabled={selectedSession.status === 'SAVED'}
                        style={{
                          padding: '8px 16px',
                          background: selectedSession.status === 'SAVED' ? '#6c757d' : '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: selectedSession.status === 'SAVED' ? 'not-allowed' : 'pointer',
                          opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                        }}
                      >
                        {editingCondition ? '更新' : '新增'}
                      </button>
                      {editingCondition && (
                        <button
                          onClick={resetRewardForm}
                          disabled={selectedSession.status === 'SAVED'}
                          style={{
                            padding: '8px 16px',
                            background: selectedSession.status === 'SAVED' ? '#6c757d' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedSession.status === 'SAVED' ? 'not-allowed' : 'pointer',
                            opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                          }}
                        >
                          取消编辑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 奖惩条件列表 */}
                <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #555', borderRadius: '4px', background: '#2d2d2d' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>已保存的奖惩条件</h4>
                  
                  {rewardConditions.length === 0 ? (
                    <p style={{ color: '#ccc', fontStyle: 'italic' }}>暂无奖惩条件</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#404040' }}>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>任务状态</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>出勤率条件</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>排名条件</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>奖惩</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rewardConditions.map((condition, index) => (
                            <tr key={condition.id} style={{ background: index % 2 === 0 ? '#2d2d2d' : '#404040' }}>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {condition.taskStatus}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {condition.taskStatus === '成功' ? '大于' : '小于'} {condition.attendanceRateThreshold}%
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {condition.taskStatus === '成功' ? (
                                  condition.meritIncreaseRank && condition.meritIncreaseRank !== '' ? (
                                    <>战功增量第{condition.meritIncreaseRank}名</>
                                  ) : (
                                    <>出勤率第{condition.attendanceRateRank}名</>
                                  )
                                ) : (
                                  <>出勤率倒数第{condition.attendanceRateRank}名</>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {condition.taskStatus === '成功' ? condition.rewardType : condition.penaltyType}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                <button
                                  onClick={() => editRewardCondition(condition)}
                                  disabled={selectedSession.status === 'SAVED'}
                                  style={{
                                    padding: '4px 8px',
                                    background: selectedSession.status === 'SAVED' ? '#6c757d' : '#007bff',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: selectedSession.status === 'SAVED' ? 'not-allowed' : 'pointer',
                                    marginRight: '4px',
                                    opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                                  }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => deleteRewardCondition(condition.id)}
                                  disabled={selectedSession.status === 'SAVED'}
                                  style={{
                                    padding: '4px 8px',
                                    background: selectedSession.status === 'SAVED' ? '#6c757d' : '#dc3545',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: selectedSession.status === 'SAVED' ? 'not-allowed' : 'pointer',
                                    opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                                  }}
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* 保存/取消保存按钮 */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  {selectedSession.status === 'ADDED' ? (
                    <button
                      onClick={() => updateSessionStatus(selectedSession.id, 'SAVED')}
                      style={{
                        padding: '12px 24px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      保存考勤记录
                    </button>
                  ) : (
                    <button
                      onClick={() => updateSessionStatus(selectedSession.id, 'ADDED')}
                      style={{
                        padding: '12px 24px',
                        background: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      取消保存
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* 调整参加考勤 */}
            {modalActiveTab === 'attendance' && (
              <div style={{ marginBottom: '16px', width: '100%' }}>
                <div style={{ padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', background: '#2d2d2d' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>调整参加考勤状态</h4>
                  
                  {/* 状态提示 */}
                  {selectedSession.status === 'SAVED' && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#2d2d2d', border: '1px solid #ffc107', borderRadius: '4px', color: '#ffc107' }}>
                      <strong>提示：</strong>当前考勤记录已保存，无法调整参加考勤状态。请先取消保存状态。
                    </div>
                  )}
                  
                  {/* 团队批量处理 */}
                  <div style={{ marginBottom: '24px', padding: '16px', border: '2px solid #007bff', borderRadius: '4px', background: '#1a1a1a' }}>
                    <h5 style={{ margin: '0 0 16px 0', color: '#fff' }}>团队批量处理</h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* 团队选择 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ minWidth: '100px', color: '#fff', fontWeight: 'bold' }}>选择团队:</label>
                        <select 
                          value={selectedTeam}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          style={{ 
                            padding: '8px 12px', 
                            border: '2px solid #007bff', 
                            borderRadius: '4px', 
                            color: '#fff',
                            background: '#2d2d2d',
                            minWidth: '200px'
                          }}
                        >
                          <option value="">请选择团队</option>
                          {getTeamList().map((team) => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* 参加状态选择 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ minWidth: '100px', color: '#fff', fontWeight: 'bold' }}>参加状态:</label>
                        <select 
                          value={teamAttendanceStatus ? 'true' : 'false'}
                          onChange={(e) => setTeamAttendanceStatus(e.target.value === 'true')}
                          style={{ 
                            padding: '8px 12px', 
                            border: '2px solid #007bff', 
                            borderRadius: '4px', 
                            color: '#fff',
                            background: '#2d2d2d',
                            minWidth: '200px'
                          }}
                        >
                          <option value="true">参加考勤</option>
                          <option value="false">不参加考勤</option>
                        </select>
                      </div>
                      
                      {/* 执行按钮 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={updateTeamAttendance}
                          disabled={!selectedTeam || isUpdatingTeamAttendance || selectedSession.status === 'SAVED'}
                          style={{
                            padding: '10px 20px',
                            background: selectedTeam && !isUpdatingTeamAttendance && selectedSession.status !== 'SAVED' ? '#007bff' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedTeam && !isUpdatingTeamAttendance && selectedSession.status !== 'SAVED' ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                          }}
                        >
                          {isUpdatingTeamAttendance ? '执行中...' : '执行批量更新'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 个人处理 */}
                  <div style={{ marginBottom: '24px', padding: '16px', border: '2px solid #28a745', borderRadius: '4px', background: '#1a1a1a' }}>
                    <h5 style={{ margin: '0 0 16px 0', color: '#fff' }}>个人处理</h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* 成员搜索和选择 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ color: '#fff', fontWeight: 'bold' }}>选择成员:</label>
                        <div style={{ position: 'relative' }} ref={memberDropdownRef}>
                          <input
                            type="text"
                            value={memberSearchTerm}
                            onChange={(e) => {
                              setMemberSearchTerm(e.target.value)
                              setShowMemberDropdown(true)
                            }}
                            onFocus={() => setShowMemberDropdown(true)}
                            placeholder="输入成员姓名搜索..."
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '2px solid #28a745',
                              borderRadius: '4px',
                              color: '#fff',
                              background: '#2d2d2d',
                              boxSizing: 'border-box'
                            }}
                          />
                          
                          {/* 搜索下拉菜单 */}
                          {showMemberDropdown && getFilteredMembers().length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              maxHeight: '200px',
                              overflowY: 'auto',
                              background: '#2d2d2d',
                              border: '1px solid #28a745',
                              borderRadius: '4px',
                              zIndex: 1000,
                              boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                            }}>
                              {getFilteredMembers().slice(0, 10).map((member) => (
                                <div
                                  key={member}
                                  onClick={() => addSelectedMember(member)}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    borderBottom: '1px solid #444',
                                    background: '#2d2d2d'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#444'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#2d2d2d'
                                  }}
                                >
                                  {member}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 已选成员标签 */}
                      {selectedMembers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ color: '#fff', fontWeight: 'bold' }}>已选成员 ({selectedMembers.length}):</label>
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '8px',
                            padding: '8px',
                            border: '1px solid #28a745',
                            borderRadius: '4px',
                            background: '#2d2d2d',
                            minHeight: '40px'
                          }}>
                            {selectedMembers.map((member) => (
                              <span
                                key={member}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '4px 8px',
                                  background: '#28a745',
                                  color: '#fff',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  gap: '4px'
                                }}
                              >
                                {member}
                                <button
                                  onClick={() => removeSelectedMember(member)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    padding: '0',
                                    marginLeft: '4px'
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 参加状态选择 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ minWidth: '100px', color: '#fff', fontWeight: 'bold' }}>参加状态:</label>
                        <select 
                          value={memberAttendanceStatus ? 'true' : 'false'}
                          onChange={(e) => setMemberAttendanceStatus(e.target.value === 'true')}
                          style={{ 
                            padding: '8px 12px', 
                            border: '2px solid #28a745', 
                            borderRadius: '4px', 
                            color: '#fff',
                            background: '#2d2d2d',
                            minWidth: '200px'
                          }}
                        >
                          <option value="true">参加考勤</option>
                          <option value="false">不参加考勤</option>
                        </select>
                      </div>
                      
                      {/* 执行按钮 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={updateMembersAttendance}
                          disabled={selectedMembers.length === 0 || isUpdatingMemberAttendance || selectedSession.status === 'SAVED'}
                          style={{
                            padding: '10px 20px',
                            background: selectedMembers.length > 0 && !isUpdatingMemberAttendance && selectedSession.status !== 'SAVED' ? '#28a745' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedMembers.length > 0 && !isUpdatingMemberAttendance && selectedSession.status !== 'SAVED' ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: selectedSession.status === 'SAVED' ? 0.6 : 1
                          }}
                        >
                          {isUpdatingMemberAttendance ? '执行中...' : `批量更新 ${selectedMembers.length} 个成员`}
                        </button>
                      </div>
                    </div>
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

      {/* 页面内容区域结束 */}
      </div>

      {/* 删除确认弹框 */}
      {showDeleteConfirm && (
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
            background: '#2d2d2d',
            padding: '24px',
            borderRadius: '8px',
            border: '2px solid #dc3545',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>确认删除</h3>
            <p style={{ margin: '0 0 24px 0', color: '#fff', fontSize: '16px' }}>
              确定要删除这条考勤记录吗？此操作不可撤销。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                取消
              </button>
              <button
                onClick={confirmDeleteSession}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导出组件（隐藏） */}
      <div ref={exportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <GroupStatsExportComponent 
          selectedSession={selectedSession}
          sortBy={exportSortBy}
        />
      </div>
    </div>
  )
}

export default App

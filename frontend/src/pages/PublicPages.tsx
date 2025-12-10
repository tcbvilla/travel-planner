import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import '../App.css'

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface PublicPagesProps {
  onBackToLogin: () => void
}

const PublicPages: React.FC<PublicPagesProps> = ({ onBackToLogin }) => {
  // 页面切换状态
  const [activePage, setActivePage] = useState<'ranking' | 'statistics'>('ranking')

  // ==================== 赛季榜单相关状态 ====================
  const [allSeasons, setAllSeasons] = useState<any[]>([])
  const [rankingSeasonId, setRankingSeasonId] = useState<number | null>(null)
  const [rankingSeasonSearchTerm, setRankingSeasonSearchTerm] = useState('')
  const [showRankingSeasonDropdown, setShowRankingSeasonDropdown] = useState(false)
  const [rankingData, setRankingData] = useState<any[]>([])
  const [loadingRankingData, setLoadingRankingData] = useState(false)
  const [rankingSeasonName, setRankingSeasonName] = useState('')
  const [teamItemsSummary, setTeamItemsSummary] = useState<any[]>([])
  const [loadingTeamItems, setLoadingTeamItems] = useState(false)
  const [teamLogos, setTeamLogos] = useState<any[]>([])
  const [itemsDisplayMode, setItemsDisplayMode] = useState<'table' | 'icons'>('icons')
  
  // 结算明细相关状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [settlementDetails, setSettlementDetails] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [allTeamNames, setAllTeamNames] = useState<string[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 查看排名弹窗相关状态
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [rankingType, setRankingType] = useState<'personal' | 'team'>('personal')
  const [personalRankingData, setPersonalRankingData] = useState<any[]>([])
  const [personalRankingLoading, setPersonalRankingLoading] = useState(false)
  const [personalRankingPage, setPersonalRankingPage] = useState(0)
  const [personalRankingSize] = useState(10)
  const [personalRankingTotal, setPersonalRankingTotal] = useState(0)
  const [selectedRankingAttendanceTypes, setSelectedRankingAttendanceTypes] = useState<string[]>([])
  const [rankingMemberName, setRankingMemberName] = useState('')
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('desc')
  const [availableRankingAttendanceTypes, setAvailableRankingAttendanceTypes] = useState<string[]>([])
  
  // 团队排名相关状态
  const [teamRankingData, setTeamRankingData] = useState<any[]>([])
  const [teamRankingLoading, setTeamRankingLoading] = useState(false)
  const [teamRankingPage, setTeamRankingPage] = useState(0)
  const [teamRankingSize] = useState(10)
  const [teamRankingTotal, setTeamRankingTotal] = useState(0)
  const [rankingTeamName, setRankingTeamName] = useState('')

  // ==================== 数据统计相关状态 ====================
  const [statsStartDate, setStatsStartDate] = useState('')
  const [statsEndDate, setStatsEndDate] = useState('')
  const [statsAttendanceType, setStatsAttendanceType] = useState('全部')
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [selectedStatsTeam, setSelectedStatsTeam] = useState('')
  const [attendanceRateData, setAttendanceRateData] = useState<any[]>([])
  const [absenceStatistics, setAbsenceStatistics] = useState<any[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [statsQueryResult, setStatsQueryResult] = useState<any>(null)
  const [availableAttendanceTypes, setAvailableAttendanceTypes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [chartDisplayMode, setChartDisplayMode] = useState<'both' | 'original' | 'bonus'>('both')
  
  // 现金统计相关状态
  const [cashSummary, setCashSummary] = useState<any>(null)
  const [isLoadingCash, setIsLoadingCash] = useState(false)
  
  // 个人统计相关状态
  const [personalStats, setPersonalStats] = useState<any>(null)
  const [isLoadingPersonal, setIsLoadingPersonal] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [selectedMember, setSelectedMember] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeStatsTab, setActiveStatsTab] = useState<'team' | 'individual'>('team')
  const personalExportRef = useRef<HTMLDivElement>(null)

  // ==================== 赛季榜单相关函数 ====================
  
  // 加载所有赛季
  const loadAllSeasons = async () => {
    try {
      const response = await fetch('/api/v1/attendance/seasons?page=0&size=1000')
      if (response.ok) {
        const data = await response.json()
        setAllSeasons(data.content || [])
      }
    } catch (error) {
      console.error('加载所有赛季失败:', error)
    }
  }

  // 选择榜单赛季
  const selectRankingSeason = (season: any) => {
    setRankingSeasonId(season.id)
    setRankingSeasonSearchTerm('')
    setShowRankingSeasonDropdown(false)
    loadRankingData(season.id)
  }

  // 加载榜单数据
  const loadRankingData = async (seasonId: number) => {
    setLoadingRankingData(true)
    setLoadingTeamItems(true)
    try {
      const [rankingResponse, itemsResponse, logosResponse] = await Promise.all([
        fetch(`/api/v1/attendance/seasons/${seasonId}/ranking`),
        fetch(`/api/v1/attendance/seasons/${seasonId}/team-items-summary`),
        fetch('/api/v1/attendance/team-logos')
      ])
      
      if (rankingResponse.ok) {
        const data = await rankingResponse.json()
        setRankingData(data.rankingData || [])
        setRankingSeasonName(data.seasonName || '')
      } else {
        console.error('获取榜单数据失败')
        setRankingData([])
        setRankingSeasonName('')
      }
      
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json()
        setTeamItemsSummary(itemsData.teamsSummary || [])
      } else {
        console.error('获取队伍物品统计失败')
        setTeamItemsSummary([])
      }
      
      if (logosResponse.ok) {
        const logos = await logosResponse.json()
        setTeamLogos(logos)
      }
    } catch (error) {
      console.error('获取榜单数据失败:', error)
      setRankingData([])
      setRankingSeasonName('')
      setTeamItemsSummary([])
    } finally {
      setLoadingRankingData(false)
      setLoadingTeamItems(false)
    }
  }

  // 加载结算明细
  const loadSettlementDetails = async (seasonId: number, teams: string[] = [], start: string = '', end: string = '') => {
    setLoadingDetails(true)
    try {
      let url = `/api/v1/attendance/seasons/${seasonId}/settlement-details`
      const params = new URLSearchParams()
      
      if (teams.length > 0) {
        params.append('teams', teams.join(','))
      }
      if (start) {
        params.append('startDate', start)
      }
      if (end) {
        params.append('endDate', end)
      }
      
      if (params.toString()) {
        url += '?' + params.toString()
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSettlementDetails(data.details || [])
        if (data.allTeamNames) {
          setAllTeamNames(data.allTeamNames)
        }
      } else {
        console.error('获取结算明细失败')
        setSettlementDetails([])
      }
    } catch (error) {
      console.error('获取结算明细失败:', error)
      setSettlementDetails([])
    } finally {
      setLoadingDetails(false)
    }
  }

  // 打开结算明细弹窗
  const openDetailModal = () => {
    if (rankingSeasonId) {
      setShowDetailModal(true)
      setSelectedTeams([])
      setStartDate('')
      setEndDate('')
      loadSettlementDetails(rankingSeasonId)
    }
  }

  // 应用筛选条件
  const applyFilters = () => {
    if (rankingSeasonId) {
      loadSettlementDetails(rankingSeasonId, selectedTeams, startDate, endDate)
    }
  }

  // 团队选择处理
  const handleTeamSelection = (teamName: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedTeams([...selectedTeams, teamName])
    } else {
      setSelectedTeams(selectedTeams.filter(t => t !== teamName))
    }
  }

  // 全选/取消全选团队
  const toggleAllTeams = () => {
    if (selectedTeams.length === allTeamNames.length) {
      setSelectedTeams([])
    } else {
      setSelectedTeams([...allTeamNames])
    }
  }

  // ==================== 查看排名相关函数 ====================
  
  // 打开查看排名弹窗
  const openRankingModal = () => {
    if (!rankingSeasonId) {
      alert('请先选择赛季')
      return
    }
    setShowRankingModal(true)
    setRankingType('personal')
    loadAvailableRankingAttendanceTypes()
    loadPersonalRanking()
  }

  // 关闭查看排名弹窗
  const closeRankingModal = () => {
    setShowRankingModal(false)
    setPersonalRankingData([])
    setTeamRankingData([])
    setSelectedRankingAttendanceTypes([])
    setRankingMemberName('')
    setRankingTeamName('')
    setRankingSortOrder('desc')
    setPersonalRankingPage(0)
    setTeamRankingPage(0)
  }

  // 加载可用考勤类型（排名弹窗专用）
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
    if (!rankingSeasonId) return
    
    setPersonalRankingLoading(true)
    try {
      const params = new URLSearchParams({
        seasonId: rankingSeasonId.toString(),
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
    if (!rankingSeasonId) return
    
    setTeamRankingLoading(true)
    try {
      const params = new URLSearchParams({
        seasonId: rankingSeasonId.toString(),
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

  // 搜索和筛选变化时重新加载
  useEffect(() => {
    if (showRankingModal && rankingType === 'personal') {
      setPersonalRankingPage(0)
      loadPersonalRanking()
    }
  }, [selectedRankingAttendanceTypes, rankingMemberName, rankingSortOrder])

  useEffect(() => {
    if (showRankingModal && rankingType === 'team') {
      setTeamRankingPage(0)
      loadTeamRanking()
    }
  }, [selectedRankingAttendanceTypes, rankingTeamName, rankingSortOrder])

  useEffect(() => {
    if (showRankingModal) {
      if (rankingType === 'personal') {
        loadPersonalRanking()
      } else {
        loadTeamRanking()
      }
    }
  }, [rankingType, personalRankingPage, teamRankingPage])

  // ==================== 数据统计相关函数 ====================
  
  // 获取可用的考勤类型
  const loadAttendanceTypes = async () => {
    try {
      const response = await fetch('/api/v1/attendance/attendance-types')
      if (response.ok) {
        const types = await response.json()
        setAvailableAttendanceTypes(types)
        if (statsAttendanceType && statsAttendanceType !== '全部' && types.length > 0 && !types.includes(statsAttendanceType)) {
          setStatsAttendanceType('全部')
        }
      } else {
        console.error('获取考勤类型失败')
        setAvailableAttendanceTypes(['压秒考勤', '区间战功考勤', '区间助攻考勤', '晨练考勤', '夜战考勤', '其他'])
      }
    } catch (error) {
      console.error('获取考勤类型失败:', error)
      setAvailableAttendanceTypes(['压秒考勤', '区间战功考勤', '区间助攻考勤', '晨练考勤', '夜战考勤', '其他'])
    }
  }
  
  // 查询统计数据
  const queryStatistics = async () => {
    if (!statsStartDate || !statsEndDate) {
      alert('请填写完整的查询条件')
      return
    }
    
    setIsLoadingStats(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        startDate: statsStartDate,
        endDate: statsEndDate
      })
      
      if (statsAttendanceType && statsAttendanceType !== '全部') {
        params.append('attendanceType', statsAttendanceType)
      }
      
      const response = await fetch(`/api/v1/attendance/statistics/query?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setStatsQueryResult(data)
        setAvailableTeams(data.teams || [])
        setSelectedStatsTeam('')
        setAttendanceRateData([])
        setAbsenceStatistics([])
      } else {
        const errorData = await response.json()
        setError(`查询失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('查询统计数据失败:', error)
      setError('网络错误: ' + error)
    } finally {
      setIsLoadingStats(false)
    }
  }
  
  // 获取团队出勤率数据
  const getTeamAttendanceRate = async () => {
    if (!selectedStatsTeam || !statsQueryResult) {
      alert('请先查询数据并选择团队')
      return
    }
    
    setIsLoadingStats(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        startDate: statsStartDate,
        endDate: statsEndDate,
        teamName: selectedStatsTeam
      })
      
      if (statsAttendanceType && statsAttendanceType !== '全部') {
        params.append('attendanceType', statsAttendanceType)
      }
      
      const response = await fetch(`/api/v1/attendance/statistics/team-attendance-rate?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setAttendanceRateData(data.attendanceRateData || [])
        setAbsenceStatistics(data.absenceStatistics || [])
      } else {
        const errorData = await response.json()
        setError(`获取出勤率数据失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('获取团队出勤率失败:', error)
      setError('网络错误: ' + error)
    } finally {
      setIsLoadingStats(false)
    }
  }
  
  // 获取团队现金统计数据
  const getTeamCashSummary = async () => {
    if (!selectedStatsTeam || !statsQueryResult) {
      alert('请先查询数据并选择团队')
      return
    }
    
    setIsLoadingCash(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        startDate: statsStartDate,
        endDate: statsEndDate,
        teamName: selectedStatsTeam
      })
      if (statsAttendanceType && statsAttendanceType !== '全部') {
        params.append('attendanceType', statsAttendanceType)
      } else {
        params.append('attendanceType', '全部')
      }
      
      const response = await fetch(`/api/v1/attendance/statistics/team-cash-summary?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setCashSummary(data)
      } else {
        const errorData = await response.json()
        setError(`获取现金统计数据失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('获取现金统计数据失败:', error)
      setError('网络错误: ' + error)
    } finally {
      setIsLoadingCash(false)
    }
  }
  
  // 搜索人员
  const searchMembers = async () => {
    if (!statsStartDate || !statsEndDate) {
      alert('请先选择日期范围')
      return
    }
    
    setIsSearching(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        startDate: statsStartDate,
        endDate: statsEndDate
      })
      
      if (statsAttendanceType && statsAttendanceType !== '全部') {
        params.append('attendanceType', statsAttendanceType)
      }
      
      if (searchKeyword) {
        params.append('keyword', searchKeyword)
      }
      
      const response = await fetch(`/api/v1/attendance/statistics/personal/search?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        const errorData = await response.json()
        setError(`搜索人员失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('搜索人员失败:', error)
      setError('网络错误: ' + error)
    } finally {
      setIsSearching(false)
    }
  }
  
  // 获取个人统计数据
  const getPersonalStats = async () => {
    if (!selectedMember || !statsStartDate || !statsEndDate) {
      alert('请先选择人员')
      return
    }
    
    setIsLoadingPersonal(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        startDate: statsStartDate,
        endDate: statsEndDate,
        memberName: selectedMember
      })
      
      if (statsAttendanceType && statsAttendanceType !== '全部') {
        params.append('attendanceType', statsAttendanceType)
      }
      
      const response = await fetch(`/api/v1/attendance/statistics/personal?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setPersonalStats(data)
      } else {
        const errorData = await response.json()
        setError(`获取个人统计数据失败: ${errorData.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('获取个人统计数据失败:', error)
      setError('网络错误: ' + error)
    } finally {
      setIsLoadingPersonal(false)
    }
  }

  // 监听人员选择变化，清除上一个人员的数据
  useEffect(() => {
    // 当人员选择变化时（包括清空选择），清除个人统计数据
    setPersonalStats(null)
    // 清除错误信息
    setError(null)
  }, [selectedMember])

  // 导出个人统计数据
  const handleExportPersonalStats = async () => {
    if (!personalStats || !personalExportRef.current) {
      alert('无法导出：数据不完整')
      return
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(personalExportRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 1000,
        height: personalExportRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1000,
        windowHeight: personalExportRef.current.scrollHeight
      })
      
      const link = document.createElement('a')
      link.download = `${personalStats.memberName}_个人统计_${personalStats.timeRange}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.9)
      link.click()
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败，请重试')
    }
  }

  // 监听团队选择变化，清除上一个团队的数据
  useEffect(() => {
    setAttendanceRateData([])
    setAbsenceStatistics([])
    setCashSummary(null)
    setError(null)
  }, [selectedStatsTeam])

  // 初始化加载
  useEffect(() => {
    loadAllSeasons()
    loadAttendanceTypes()
  }, [])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.ranking-season-dropdown-container')) {
        setShowRankingSeasonDropdown(false)
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
      background: '#1a1a1a',
      padding: '20px'
    }}>
      {/* 返回登录按钮 */}
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        zIndex: 1000 
      }}>
        <button
          onClick={onBackToLogin}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          返回登录
        </button>
      </div>

      {/* 页面切换按钮 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => setActivePage('ranking')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activePage === 'ranking' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activePage === 'ranking' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          赛季榜单
        </button>
        <button
          onClick={() => setActivePage('statistics')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activePage === 'statistics' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activePage === 'statistics' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          数据统计
        </button>
      </div>

      {/* 赛季榜单页面 */}
      {activePage === 'ranking' && (
        <div style={{ 
          background: '#2d2d2d', 
          backgroundImage: 'url(/images/背景.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'local',
          padding: '60px', 
          borderRadius: '8px', 
          minWidth: '1100px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '40px', marginTop: '40px' }}>
              <h2 className="ranking-title" style={{ margin: 0, fontFamily: 'RuiZiChaoPai, Arial, sans-serif' }}>赛季榜单</h2>
              {rankingSeasonId && (
                <button
                  onClick={openRankingModal}
                  style={{
                    padding: '8px 16px',
                    background: '#17a2b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  查看排名
                </button>
              )}
            </div>
            
            {/* 赛季选择下拉框 */}
            <div style={{ position: 'relative', marginLeft: '-40px', marginTop: '40px' }} className="ranking-season-dropdown-container">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 12px',
                border: '1px solid #007bff',
                borderRadius: '4px',
                background: '#2d2d2d',
                color: '#fff',
                cursor: 'pointer',
                minWidth: '200px'
              }}
              onClick={() => setShowRankingSeasonDropdown(!showRankingSeasonDropdown)}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {rankingSeasonId 
                    ? allSeasons.find(s => s.id === rankingSeasonId)?.name 
                    : '请选择赛季'
                  }
                </span>
                <span style={{ 
                  transform: showRankingSeasonDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  ▼
                </span>
              </div>
              
              {/* 搜索框 - 只在下拉框打开时显示 */}
              {showRankingSeasonDropdown && (
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
                    value={rankingSeasonSearchTerm}
                    onChange={(e) => setRankingSeasonSearchTerm(e.target.value)}
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
                      season.name.toLowerCase().includes(rankingSeasonSearchTerm.toLowerCase())
                    ).map((season) => (
                      <div
                        key={season.id}
                        onClick={() => selectRankingSeason(season)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          color: '#fff',
                          borderBottom: '1px solid #555',
                          backgroundColor: rankingSeasonId === season.id ? '#404040' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (rankingSeasonId !== season.id) {
                            e.currentTarget.style.background = '#404040'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (rankingSeasonId !== season.id) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        {season.name}
                      </div>
                    ))}
                    {allSeasons.filter(season => 
                      season.name.toLowerCase().includes(rankingSeasonSearchTerm.toLowerCase())
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
          
          {/* 榜单内容 */}
          {loadingRankingData ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>
              <p>加载中...</p>
            </div>
          ) : !rankingSeasonId ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>
              <p>请选择赛季查看榜单</p>
            </div>
          ) : rankingData.length === 0 ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>
              <p>该赛季暂无结算数据</p>
            </div>
          ) : (
            <div>
              {/* 榜单标题 */}
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                {/* Logo 图片 */}
                <div style={{ marginBottom: '16px', marginTop: '40px' }}>
                  <img 
                    src="/images/logo.png" 
                    alt="戰盟" 
                    style={{ 
                      maxWidth: '300px', 
                      height: 'auto',
                      display: 'block',
                      margin: '0 auto'
                    }} 
                  />
                </div>
                <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>
                  {rankingSeasonName} 戰盟风云榜
                </h3>
              </div>

              {/* 柱状图 */}
              <div className="chart-container" style={{ 
                background: '#f5f5f5', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#333', margin: '0 0 20px 0', textAlign: 'center' }}>
                  奖金排行
                </h4>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  height: '400px',
                  padding: '0 20px',
                  overflowX: 'auto',
                  position: 'relative',
                  color: '#333'
                }}>
                  {/* 零轴线 */}
                  <div style={{
                    position: 'absolute',
                    left: '20px',
                    right: '20px',
                    top: 'calc(35px + 150px)',
                    height: '1px',
                    background: '#999',
                    zIndex: 1
                  }}></div>
                  
                  {rankingData.map((team) => {
                    const maxReward = Math.max(...rankingData.map(t => Math.abs(t.totalReward)))
                    const maxBarHeight = 140
                    const barHeight = maxReward > 0 ? Math.min((Math.abs(team.totalReward) / maxReward) * maxBarHeight, maxBarHeight) : 0
                    const isPositive = team.totalReward >= 0
                    
                    const totalSum = rankingData.reduce((sum, t) => sum + t.totalReward, 0)
                    const percentage = totalSum !== 0 ? Math.round((team.totalReward / totalSum) * 100) : 0
                    
                    return (
                      <div key={team.teamName} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        minWidth: '80px',
                        height: '100%',
                        position: 'relative',
                        zIndex: 2
                      }}>
                        {/* 正值时的数值显示（顶部） */}
                        <div style={{ 
                          height: '35px',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center'
                        }}>
                          {isPositive && (
                            <div className="positive-value" style={{ 
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textAlign: 'center'
                            }}>
                              +{team.totalReward}
                              <div className="positive-percentage" style={{ 
                                fontSize: '9px',
                                marginTop: '2px'
                              }}>
                                {percentage}%
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 柱子容器 */}
                        <div style={{
                          height: '300px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative'
                        }}>
                          {/* 上半部分 - 正值区域 */}
                          <div style={{
                            height: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}>
                            {isPositive && (
                              <div style={{
                                width: '40px',
                                height: `${barHeight}px`,
                                background: `linear-gradient(to top, #f44336, #ff6b6b)`,
                                borderRadius: '4px 4px 0 0',
                                transition: 'all 0.3s ease'
                              }}>
                              </div>
                            )}
                          </div>
                          
                          {/* 下半部分 - 负值区域 */}
                          <div style={{
                            height: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            alignItems: 'center'
                          }}>
                            {!isPositive && (
                              <div style={{
                                width: '40px',
                                height: `${barHeight}px`,
                                background: `linear-gradient(to bottom, #333, #666)`,
                                borderRadius: '0 0 4px 4px',
                                transition: 'all 0.3s ease'
                              }}>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 负值时的数值显示（底部） */}
                        <div style={{ 
                          height: '35px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center'
                        }}>
                          {!isPositive && (
                            <div className="negative-value" style={{ 
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textAlign: 'center'
                            }}>
                              {team.totalReward}
                              <div className="negative-percentage" style={{ 
                                fontSize: '9px',
                                marginTop: '2px'
                              }}>
                                {percentage}%
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 小组名称 */}
                        <div className="team-name" style={{ 
                          fontSize: '11px',
                          marginTop: '8px',
                          textAlign: 'center',
                          wordBreak: 'break-all',
                          lineHeight: '1.2'
                        }}>
                          {team.teamName}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 队伍物品统计表格 */}
              <div style={{ 
                background: '#3d3d3d', 
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  background: '#4a4a4a',
                  padding: '16px',
                  borderBottom: '1px solid #555',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>花粪统计</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setItemsDisplayMode('icons')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: itemsDisplayMode === 'icons' ? '#007bff' : '#555',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      图标
                    </button>
                    <button
                      onClick={() => setItemsDisplayMode('table')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: itemsDisplayMode === 'table' ? '#007bff' : '#555',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      表格
                    </button>
                  </div>
                </div>

                {loadingTeamItems ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#ccc', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    加载中...
                  </div>
                ) : teamItemsSummary.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#ccc', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    暂无数据
                  </div>
                ) : itemsDisplayMode === 'table' ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      minWidth: '1000px',
                      borderCollapse: 'collapse',
                      backgroundColor: '#3d3d3d'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#4a4a4a' }}>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'left', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            队伍名称
                          </th>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'center', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            花瓣
                          </th>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'center', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            花
                          </th>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'center', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            屎粒
                          </th>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'center', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            屎
                          </th>
                          <th style={{ 
                            padding: '12px 8px', 
                            border: '1px solid #555', 
                            textAlign: 'center', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            现金
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamItemsSummary.map((team: any, index: number) => (
                          <tr key={team.teamName} style={{ 
                            backgroundColor: index % 2 === 0 ? '#3d3d3d' : '#454545'
                          }}>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              color: '#fff',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {(() => {
                                const logo = teamLogos.find((l: any) => l.teamName === team.teamName)
                                return logo ? (
                                  <img 
                                    src={logo.logoPath} 
                                    alt={team.teamName}
                                    style={{ 
                                      width: '24px', 
                                      height: '24px', 
                                      objectFit: 'contain',
                                      borderRadius: '4px'
                                    }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                ) : null
                              })()}
                              {team.teamName}
                            </td>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              textAlign: 'center', 
                              color: team.花瓣 > 0 ? '#4caf50' : '#ccc'
                            }}>
                              {team.花瓣}
                            </td>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              textAlign: 'center', 
                              color: team.花 > 0 ? '#4caf50' : '#ccc'
                            }}>
                              {team.花}
                            </td>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              textAlign: 'center', 
                              color: team.屎粒 > 0 ? '#f44336' : '#ccc'
                            }}>
                              {team.屎粒}
                            </td>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              textAlign: 'center', 
                              color: team.屎 > 0 ? '#f44336' : '#ccc'
                            }}>
                              {team.屎}
                            </td>
                            <td style={{ 
                              padding: '12px 8px', 
                              border: '1px solid #555', 
                              textAlign: 'center', 
                              color: team.现金 > 0 ? '#f44336' : team.现金 < 0 ? '#333' : '#ccc',
                              fontWeight: team.现金 !== 0 ? 'bold' : 'normal'
                            }}>
                              {team.现金 > 0 ? '+' : ''}{team.现金}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // 图标格式展示
                  <div style={{ padding: '20px' }}>
                    {teamItemsSummary.map((team: any, index: number) => (
                      <div key={team.teamName} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        marginBottom: '8px',
                        backgroundColor: index % 2 === 0 ? '#3d3d3d' : '#454545',
                        borderRadius: '6px',
                        border: '1px solid #555'
                      }}>
                        {/* 队伍名称 */}
                        <div style={{
                          minWidth: '120px',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {(() => {
                            const logo = teamLogos.find((l: any) => l.teamName === team.teamName)
                            return logo ? (
                              <img 
                                src={logo.logoPath} 
                                alt={team.teamName}
                                style={{ 
                                  width: '24px', 
                                  height: '24px', 
                                  objectFit: 'contain',
                                  borderRadius: '4px'
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : null
                          })()}
                          {team.teamName}
                        </div>
                        
                        {/* 物品图标展示区域 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          overflowX: 'auto',
                          flex: 1,
                          padding: '4px 0'
                        }}>
                          {/* 花 */}
                          {Array.from({ length: team.花 || 0 }, (_, i) => (
                            <img
                              key={`flower-${i}`}
                              src="/images/花.png"
                              alt="花"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle' }}
                              loading="lazy"
                            />
                          ))}
                          
                          {/* 花瓣 */}
                          {Array.from({ length: team.花瓣 || 0 }, (_, i) => (
                            <img
                              key={`petal-${i}`}
                              src="/images/花瓣.png"
                              alt="花瓣"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle' }}
                              loading="lazy"
                            />
                          ))}
                          
                          {/* 屎 */}
                          {Array.from({ length: team.屎 || 0 }, (_, i) => (
                            <img
                              key={`shit-${i}`}
                              src="/images/屎.png"
                              alt="屎"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle' }}
                              loading="lazy"
                            />
                          ))}
                          
                          {/* 屎粒 */}
                          {Array.from({ length: team.屎粒 || 0 }, (_, i) => (
                            <img
                              key={`shit-particle-${i}`}
                              src="/images/屎粒.png"
                              alt="屎粒"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle' }}
                              loading="lazy"
                            />
                          ))}
                          
                          {/* 如果没有物品，显示提示 */}
                          {(!team.花 && !team.花瓣 && !team.屎 && !team.屎粒) && (
                            <span style={{ color: '#888', fontSize: '12px', fontStyle: 'italic' }}>
                              暂无物品
                            </span>
                          )}
                        </div>
                        
                        {/* 现金显示 */}
                        {team.现金 !== 0 && (
                          <div style={{
                            minWidth: '80px',
                            textAlign: 'right',
                            color: team.现金 > 0 ? '#f44336' : '#333',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px'
                          }}>
                            <img
                              src="/images/钱袋.png"
                              alt="钱袋"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle' }}
                              loading="lazy"
                            />
                            <span>{team.现金 > 0 ? '+' : ''}{team.现金}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 排行榜表格 */}
              <div style={{ 
                background: '#3d3d3d', 
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 120px', 
                  gap: '0',
                  background: '#4a4a4a',
                  padding: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                  fontSize: '14px'
                }}>
                  <div style={{ textAlign: 'center' }}>排名</div>
                  <div>小组名称</div>
                  <div style={{ textAlign: 'right' }}>已结算/总奖金</div>
                </div>
                
                {rankingData.map((team, index) => (
                  <div key={team.teamName} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '60px 1fr 120px', 
                    gap: '0',
                    padding: '12px',
                    borderBottom: index < rankingData.length - 1 ? '1px solid #555' : 'none',
                    background: index % 2 === 0 ? '#3d3d3d' : '#353535',
                    color: '#fff'
                  }}>
                    <div style={{ 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: index < 3 ? '#ffd700' : '#fff'
                    }}>
                      #{team.rank}
                    </div>
                    <div>{team.teamName}</div>
                    <div style={{ 
                      textAlign: 'right',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#28a745' }}>{team.settledReward > 0 ? '+' : ''}{team.settledReward}</span>
                      <span style={{ color: '#666' }}>/</span>
                      <span style={{ color: team.totalReward >= 0 ? '#f44336' : '#333' }}>{team.totalReward > 0 ? '+' : ''}{team.totalReward}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 查看明细按钮 */}
              <div style={{ 
                textAlign: 'center', 
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #555',
                display: 'flex',
                gap: '16px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={openDetailModal}
                  style={{
                    padding: '12px 24px',
                    background: '#17a2b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  查看明细
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 数据统计页面 */}
      {activePage === 'statistics' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', minWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', margin: 0 }}>数据统计</h2>
          </div>
          
          {/* 页签切换 */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px',
            borderBottom: '1px solid #555',
            paddingBottom: '16px'
          }}>
            <button
              onClick={() => setActiveStatsTab('team')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeStatsTab === 'team' ? '#007bff' : '#555555',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeStatsTab === 'team' ? 'bold' : 'normal',
                borderRadius: '4px',
                transition: 'all 0.3s ease'
              }}
            >
              团队统计
            </button>
            <button
              onClick={() => setActiveStatsTab('individual')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeStatsTab === 'individual' ? '#007bff' : '#555555',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeStatsTab === 'individual' ? 'bold' : 'normal',
                borderRadius: '4px',
                transition: 'all 0.3s ease'
              }}
            >
              个人统计
            </button>
          </div>

          {/* 团队统计内容 */}
          {activeStatsTab === 'team' && (
            <div style={{ color: '#fff' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>团队统计</h3>
              
              {/* 查询表单区域 */}
              <div style={{ 
                background: '#3d3d3d', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>查询条件</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 日期区间选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>日期区间:</label>
                    <input
                      type="date"
                      value={statsStartDate}
                      onChange={(e) => setStatsStartDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '150px'
                      }}
                    />
                    <span style={{ color: '#ccc' }}>至</span>
                    <input
                      type="date"
                      value={statsEndDate}
                      onChange={(e) => setStatsEndDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '150px'
                      }}
                    />
                  </div>
                  
                  {/* 考勤类型选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>考勤类型:</label>
                    <select
                      value={statsAttendanceType}
                      onChange={(e) => setStatsAttendanceType(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '200px'
                      }}
                    >
                      <option value="全部">全部</option>
                      {availableAttendanceTypes.length > 0 ? (
                        availableAttendanceTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))
                      ) : (
                        <>
                          <option value="压秒考勤">压秒考勤</option>
                          <option value="区间助攻考勤">区间助攻考勤</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  {/* 查询按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={queryStatistics}
                      disabled={isLoadingStats || !statsStartDate || !statsEndDate}
                      style={{
                        padding: '10px 20px',
                        background: !isLoadingStats && statsStartDate && statsEndDate ? '#007bff' : '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: !isLoadingStats && statsStartDate && statsEndDate ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      {isLoadingStats ? '查询中...' : '查询数据'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* 查询结果显示 */}
              {statsQueryResult && (
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>查询结果</h4>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ color: '#ccc' }}>
                      <span style={{ fontWeight: 'bold' }}>找到记录: </span>
                      <span style={{ color: '#007bff' }}>{statsQueryResult.totalCount}</span> 条
                    </div>
                    <div style={{ color: '#ccc' }}>
                      <span style={{ fontWeight: 'bold' }}>涉及团队: </span>
                      <span style={{ color: '#28a745' }}>{availableTeams.length}</span> 个
                    </div>
                  </div>
                  
                  {/* 团队选择 */}
                  {availableTeams.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>选择团队:</label>
                        <select
                          value={selectedStatsTeam}
                          onChange={(e) => setSelectedStatsTeam(e.target.value)}
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
                          {availableTeams.map((team) => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                        <button
                          onClick={getTeamAttendanceRate}
                          disabled={!selectedStatsTeam || isLoadingStats}
                          style={{
                            padding: '8px 16px',
                            background: selectedStatsTeam && !isLoadingStats ? '#28a745' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedStatsTeam && !isLoadingStats ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          {isLoadingStats ? '计算中...' : '生成出勤率曲线'}
                        </button>
                        <button
                          onClick={getTeamCashSummary}
                          disabled={!selectedStatsTeam || isLoadingCash}
                          style={{
                            padding: '8px 16px',
                            background: selectedStatsTeam && !isLoadingCash ? '#ff6b35' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedStatsTeam && !isLoadingCash ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            marginLeft: '8px'
                          }}
                        >
                          {isLoadingCash ? '计算中...' : '生成现金统计'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 出勤率曲线图 */}
              {attendanceRateData.length > 0 && (
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>
                    团队出勤率曲线 - {selectedStatsTeam}
                  </h4>
                  
                  {/* 图表显示模式控制 */}
                  <div style={{ 
                    marginBottom: '16px', 
                    display: 'flex', 
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ color: '#ccc', fontSize: '14px' }}>显示模式:</span>
                    <button
                      onClick={() => setChartDisplayMode('both')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: chartDisplayMode === 'both' ? '#007bff' : '#555',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      双线对比
                    </button>
                    <button
                      onClick={() => setChartDisplayMode('original')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: chartDisplayMode === 'original' ? '#4CAF50' : '#555',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      原始出勤率
                    </button>
                    <button
                      onClick={() => setChartDisplayMode('bonus')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: chartDisplayMode === 'bonus' ? '#2196F3' : '#555',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      加成后出勤率
                    </button>
                  </div>
                  
                  {/* 图表容器 */}
                  <div style={{ 
                    background: '#1a1a1a', 
                    padding: '20px', 
                    borderRadius: '8px',
                    minHeight: '400px'
                  }}>
                    {/* Chart.js 曲线图 */}
                    <div id="attendance-chart" style={{ height: '350px', marginBottom: '20px' }}>
                      <Line
                        data={{
                          labels: attendanceRateData.map(data => data.date),
                          datasets: (() => {
                            const datasets = [];
                            
                            if (chartDisplayMode === 'both' || chartDisplayMode === 'original') {
                              datasets.push({
                                label: '原始出勤率',
                                data: attendanceRateData.map(data => data.attendanceRate),
                                borderColor: '#4CAF50',
                                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                borderWidth: 2,
                                fill: false,
                                tension: 0.1,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                pointBackgroundColor: '#4CAF50',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2
                              });
                            }
                            
                            if (chartDisplayMode === 'both' || chartDisplayMode === 'bonus') {
                              datasets.push({
                                label: '加成后出勤率',
                                data: attendanceRateData.map(data => data.bonusRate),
                                borderColor: '#2196F3',
                                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                borderWidth: 3,
                                fill: false,
                                tension: 0.1,
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                pointBackgroundColor: '#2196F3',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2
                              });
                            }
                            
                            return datasets;
                          })()
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            title: {
                              display: true,
                              text: `团队出勤率趋势 - ${selectedStatsTeam}`,
                              color: '#fff',
                              font: {
                                size: 16,
                                weight: 'bold'
                              }
                            },
                            legend: {
                              display: true,
                              position: 'top' as const,
                              labels: {
                                color: '#fff',
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                  size: 12
                                }
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.8)',
                              titleColor: '#fff',
                              bodyColor: '#fff',
                              borderColor: '#555',
                              borderWidth: 1,
                              callbacks: {
                                afterBody: (context) => {
                                  const index = context[0].dataIndex;
                                  const data = attendanceRateData[index];
                                  return [
                                    `团队人数: ${data.memberCount}`,
                                    `详细信息: ${data.bonusDescription}`
                                  ];
                                }
                              }
                            }
                          },
                          scales: {
                            x: {
                              display: true,
                              title: {
                                display: true,
                                text: '日期',
                                color: '#fff',
                                font: {
                                  size: 14
                                }
                              },
                              ticks: {
                                color: '#ccc',
                                maxRotation: 45,
                                minRotation: 0,
                                font: {
                                  size: 11
                                }
                              },
                              grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                              }
                            },
                            y: {
                              display: true,
                              title: {
                                display: true,
                                text: '出勤率 (%)',
                                color: '#fff',
                                font: {
                                  size: 14
                                }
                              },
                              ticks: {
                                color: '#ccc',
                                font: {
                                  size: 11
                                },
                                callback: function(value) {
                                  return value + '%';
                                }
                              },
                              grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                              },
                              min: 0,
                              max: 100
                            }
                          },
                          interaction: {
                            intersect: false,
                            mode: 'index' as const
                          },
                          elements: {
                            point: {
                              hoverRadius: 8
                            }
                          }
                        }}
                      />
                    </div>
                    
                    {/* 出勤率数据表格 */}
                    <div style={{ textAlign: 'left' }}>
                      <h5 style={{ color: '#fff', margin: '0 0 10px 0' }}>出勤率数据详情:</h5>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '100px 80px 80px 60px 200px',
                            gap: '10px',
                            padding: '8px 0',
                            borderBottom: '2px solid #555',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#ccc'
                          }}>
                            <span>日期</span>
                            <span>原始出勤率</span>
                            <span>加成后</span>
                            <span>团队人数</span>
                            <span>详细信息</span>
                          </div>
                          {attendanceRateData.map((data, index) => (
                            <div key={index} style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '100px 80px 80px 60px 200px',
                              gap: '10px',
                              padding: '8px 0',
                              borderBottom: '1px solid #555',
                              fontSize: '12px',
                              alignItems: 'center'
                            }}>
                              <span style={{ color: '#007bff' }}>{data.date}</span>
                              <span style={{ color: '#fff' }}>{data.attendanceRate.toFixed(1)}%</span>
                              <span style={{ 
                                color: data.bonusRate >= 100 ? '#ff6b6b' : '#28a745',
                                fontWeight: data.bonusRate >= 100 ? 'bold' : 'normal'
                              }}>
                                {data.bonusRate.toFixed(1)}%
                                {data.bonusRate >= 100 && ' (封顶)'}
                              </span>
                              <span style={{ color: '#ccc' }}>{data.memberCount}</span>
                              <span style={{ color: '#ffc107', fontSize: '11px', wordBreak: 'break-word' }}>
                                {data.bonusDescription}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* 统计摘要 */}
                        {attendanceRateData.length > 0 && (
                          <div style={{ 
                            marginTop: '16px', 
                            padding: '12px', 
                            background: '#2d2d2d', 
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            <h6 style={{ color: '#fff', margin: '0 0 8px 0' }}>统计摘要:</h6>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#ccc' }}>
                                平均原始出勤率: <span style={{ color: '#fff' }}>
                                  {(attendanceRateData.reduce((sum, d) => sum + d.attendanceRate, 0) / attendanceRateData.length).toFixed(1)}%
                                </span>
                              </span>
                              <span style={{ color: '#ccc' }}>
                                平均加成后出勤率: <span style={{ 
                                  color: attendanceRateData.some(d => d.bonusRate >= 100) ? '#ff6b6b' : '#28a745',
                                  fontWeight: attendanceRateData.some(d => d.bonusRate >= 100) ? 'bold' : 'normal'
                                }}>
                                  {(attendanceRateData.reduce((sum, d) => sum + d.bonusRate, 0) / attendanceRateData.length).toFixed(1)}%
                                  {attendanceRateData.some(d => d.bonusRate >= 100) && ' (含封顶)'}
                                </span>
                              </span>
                              <span style={{ color: '#ccc' }}>
                                数据点数量: <span style={{ color: '#007bff' }}>{attendanceRateData.length}</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              )}
              
              {/* 缺勤统计 */}
              {absenceStatistics.length > 0 && (
                <div style={{ 
                  marginTop: '20px',
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px'
                }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>
                        缺勤统计 - {selectedStatsTeam}
                      </h4>
                      
                      <div style={{ 
                        maxHeight: '400px',
                        overflowY: 'auto',
                        background: '#2d2d2d',
                        borderRadius: '4px',
                        padding: '10px'
                      }}>
                        {/* 表头 */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 120px',
                          gap: '10px',
                          padding: '8px 12px',
                          borderBottom: '2px solid #555',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#ccc',
                          position: 'sticky',
                          top: 0,
                          background: '#2d2d2d',
                          zIndex: 10
                        }}>
                          <span>人员姓名</span>
                          <span style={{ textAlign: 'right' }}>缺勤次数</span>
                        </div>
                        
                        {/* 缺勤列表 */}
                        {absenceStatistics.map((item, index) => (
                          <div 
                            key={index} 
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 120px',
                              gap: '10px',
                              padding: '10px 12px',
                              borderBottom: '1px solid #444',
                              fontSize: '14px',
                              alignItems: 'center',
                              background: index % 2 === 0 ? '#2d2d2d' : '#252525'
                            }}
                          >
                            <span style={{ color: '#fff' }}>{item.memberName}</span>
                            <span style={{ 
                              color: '#ff6b6b', 
                              textAlign: 'right',
                              fontWeight: 'bold'
                            }}>
                              {item.absenceCount} 次
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {/* 缺勤统计摘要 */}
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '12px', 
                        background: '#252525', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#ccc' }}>
                            缺勤人员总数: <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                              {absenceStatistics.length}
                            </span>
                          </span>
                          <span style={{ color: '#ccc' }}>
                            总缺勤次数: <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                              {absenceStatistics.reduce((sum, item) => sum + item.absenceCount, 0)}
                            </span>
                          </span>
                          {absenceStatistics.length > 0 && (
                            <span style={{ color: '#ccc' }}>
                              平均缺勤次数: <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                                {(absenceStatistics.reduce((sum, item) => sum + item.absenceCount, 0) / absenceStatistics.length).toFixed(1)}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
              )}
              
              {/* 现金统计区域 */}
              {cashSummary && (
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px',
                  marginTop: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>
                    现金统计汇总 - {cashSummary.teamName}
                  </h4>
                  
                  {/* 现金汇总卡片 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ 
                      background: '#28a745', 
                      padding: '16px', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>现金奖励总额</div>
                      <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                        +{cashSummary.totalRewards.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ 
                      background: '#dc3545', 
                      padding: '16px', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>现金惩罚总额</div>
                      <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                        {cashSummary.totalPenalties.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ 
                      background: cashSummary.netCash >= 0 ? '#007bff' : '#ff6b35', 
                      padding: '16px', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>净现金收益</div>
                      <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                        {cashSummary.netCash >= 0 ? '+' : ''}{cashSummary.netCash.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {/* 现金记录详情表格 */}
                  {cashSummary.records && cashSummary.records.length > 0 && (
                    <div>
                      <h5 style={{ margin: '0 0 12px 0', color: '#fff' }}>现金记录详情</h5>
                      <div style={{ 
                        background: '#1a1a1a', 
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '200px 120px 100px 120px 200px 80px',
                          background: '#333',
                          padding: '12px',
                          fontWeight: 'bold',
                          color: '#fff',
                          fontSize: '14px'
                        }}>
                          <span>考勤记录</span>
                          <span>时间</span>
                          <span>类型</span>
                          <span>金额</span>
                          <span>描述</span>
                          <span>来源</span>
                        </div>
                        {cashSummary.records.map((record: any, index: number) => (
                          <div key={index} style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '200px 120px 100px 120px 200px 80px',
                            padding: '12px',
                            borderBottom: '1px solid #333',
                            color: '#ccc',
                            fontSize: '13px'
                          }}>
                            <span style={{ color: '#fff' }}>{record.sessionName}</span>
                            <span>{new Date(record.sessionTime).toLocaleDateString()}</span>
                            <span style={{ 
                              color: record.cashAmount > 0 ? '#28a745' : '#dc3545',
                              fontWeight: 'bold'
                            }}>
                              {record.itemType}
                            </span>
                            <span style={{ 
                              color: record.cashAmount > 0 ? '#28a745' : '#dc3545',
                              fontWeight: 'bold'
                            }}>
                              {record.cashAmount > 0 ? '+' : ''}{record.cashAmount.toFixed(2)}
                            </span>
                            <span>{record.description || '-'}</span>
                            <span style={{ 
                              color: record.isManual ? '#ff6b35' : '#007bff',
                              fontSize: '12px'
                            }}>
                              {record.isManual ? '手动' : '自动'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {(!cashSummary.records || cashSummary.records.length === 0) && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px', 
                      color: '#999',
                      background: '#1a1a1a',
                      borderRadius: '8px',
                      minHeight: '300px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无现金记录</div>
                      <div style={{ fontSize: '14px' }}>该团队在选定时间段内没有现金奖惩记录</div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 错误信息显示 */}
              {error && (
                <div style={{ 
                  background: '#dc3545', 
                  color: '#fff', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginTop: '16px'
                }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* 个人统计内容 */}
          {activeStatsTab === 'individual' && (
            <div style={{ color: '#fff' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>个人统计</h3>
              
              {/* 查询表单区域 */}
              <div style={{ 
                background: '#3d3d3d', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>查询条件</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 日期区间选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>日期区间:</label>
                    <input
                      type="date"
                      value={statsStartDate}
                      onChange={(e) => setStatsStartDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '150px'
                      }}
                    />
                    <span style={{ color: '#ccc' }}>至</span>
                    <input
                      type="date"
                      value={statsEndDate}
                      onChange={(e) => setStatsEndDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '150px'
                      }}
                    />
                  </div>
                  
                  {/* 考勤类型选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>考勤类型:</label>
                    <select
                      value={statsAttendanceType}
                      onChange={(e) => setStatsAttendanceType(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '200px'
                      }}
                    >
                      <option value="全部">全部</option>
                      {availableAttendanceTypes.length > 0 ? (
                        availableAttendanceTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))
                      ) : (
                        <>
                          <option value="压秒考勤">压秒考勤</option>
                          <option value="区间战功考勤">区间战功考勤</option>
                          <option value="区间助攻考勤">区间助攻考勤</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  {/* 人员搜索 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ minWidth: '80px', color: '#fff', fontWeight: 'bold' }}>搜索人员:</label>
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="输入人员姓名进行搜索"
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        color: '#fff',
                        background: '#2d2d2d',
                        minWidth: '200px'
                      }}
                    />
                    <button
                      onClick={searchMembers}
                      disabled={isSearching || !statsStartDate || !statsEndDate}
                      style={{
                        padding: '8px 16px',
                        background: !isSearching && statsStartDate && statsEndDate ? '#007bff' : '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: !isSearching && statsStartDate && statsEndDate ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      {isSearching ? '搜索中...' : '搜索人员'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* 搜索结果 */}
              {searchResults.length > 0 && (
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>搜索结果</h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                    gap: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {searchResults.map((member, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedMember(member)}
                        style={{
                          padding: '8px 12px',
                          background: selectedMember === member ? '#007bff' : '#555',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left'
                        }}
                      >
                        {member}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 个人统计结果 */}
              {selectedMember && (
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '20px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <h4 style={{ margin: 0, color: '#fff' }}>个人统计 - {selectedMember}</h4>
                 <button
                   onClick={getPersonalStats}
                   disabled={isLoadingPersonal}
                   style={{
                     padding: '8px 16px',
                     background: !isLoadingPersonal ? '#28a745' : '#6c757d',
                     color: '#fff',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: !isLoadingPersonal ? 'pointer' : 'not-allowed',
                     fontSize: '14px',
                     fontWeight: 'bold'
                   }}
                 >
                   {isLoadingPersonal ? '计算中...' : '生成个人统计'}
                 </button>
               </div>
                  
                  {personalStats && (
                    <div>
                      {/* 统计汇总 */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                        gap: '16px',
                        marginBottom: '20px'
                      }}>
                        <div style={{ 
                          background: '#007bff', 
                          padding: '16px', 
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>总考勤次数</div>
                          <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                            {personalStats.totalSessions}
                          </div>
                        </div>
                        <div style={{ 
                          background: '#28a745', 
                          padding: '16px', 
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>参加考勤</div>
                          <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                            {personalStats.attendedSessions}
                          </div>
                        </div>
                     <div style={{
                       background: '#ff6b35',
                       padding: '16px',
                       borderRadius: '8px',
                       textAlign: 'center'
                     }}>
                       <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>出勤次数</div>
                       <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                         {personalStats.records ? personalStats.records.filter((r: any) => r.isQualified).length : 0}
                       </div>
                     </div>
                        <div style={{ 
                          background: '#ff6b35', 
                          padding: '16px', 
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>出勤率</div>
                          <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                            {personalStats.attendanceRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* 详细记录表格 */}
                      {personalStats.records && personalStats.records.length > 0 && (
                        <div>
                          <h5 style={{ margin: '0 0 12px 0', color: '#fff' }}>考勤记录详情</h5>
                          <div style={{ 
                            background: '#1a1a1a', 
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}>
                         <div style={{
                           display: 'grid',
                           gridTemplateColumns: '150px 120px 80px 80px 100px 100px 80px 80px 100px',
                           background: '#333',
                           padding: '12px',
                           fontWeight: 'bold',
                           color: '#fff',
                           fontSize: '14px'
                         }}>
                           <span>考勤记录</span>
                           <span>时间</span>
                           <span>参加</span>
                           <span>出勤</span>
                           <span>战功差值</span>
                           <span>助攻差值</span>
                           <span>阈值</span>
                           <span>团队</span>
                           <span>结果</span>
                         </div>
                            {personalStats.records.map((record: any, index: number) => (
                              <div key={index} style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '150px 120px 80px 80px 100px 100px 80px 80px 100px',
                                padding: '12px',
                                borderBottom: '1px solid #333',
                                color: '#ccc',
                                fontSize: '13px'
                              }}>
                                <span style={{ color: '#fff' }}>{record.sessionName}</span>
                                <span>{new Date(record.sessionTime).toLocaleDateString()}</span>
                                <span style={{ 
                                  color: record.isAttended ? '#28a745' : '#dc3545',
                                  fontWeight: 'bold'
                                }}>
                                  {record.isAttended ? '参加' : '未参加'}
                                </span>
                                <span style={{ 
                                  color: (record.isQualified === true || record.isQualified === 'true') ? '#28a745' : '#dc3545',
                                  fontWeight: 'bold'
                                }}>
                                  {(record.isQualified === true || record.isQualified === 'true') ? '出勤' : '缺勤'}
                                </span>
                                <span style={{ 
                                  color: record.meritDiff >= 0 ? '#28a745' : '#dc3545'
                                }}>
                                  {record.meritDiff >= 0 ? '+' : ''}{record.meritDiff}
                                </span>
                                <span style={{ 
                                  color: record.assistDiff >= 0 ? '#28a745' : '#dc3545'
                                }}>
                                  {record.assistDiff >= 0 ? '+' : ''}{record.assistDiff}
                                </span>
                                <span>{record.threshold}</span>
                                <span>{record.group}</span>
                                <span style={{ 
                                  color: record.battleResult === 'VICTORY' ? '#28a745' :
                                         record.battleResult === 'DEFEAT' ? '#dc3545' : '#ccc'
                                }}>
                                  {record.battleResult === 'VICTORY' ? '胜利' :
                                   record.battleResult === 'DEFEAT' ? '失败' : record.battleResult}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(!personalStats.records || personalStats.records.length === 0) && (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px', 
                          color: '#999',
                          background: '#1a1a1a',
                          borderRadius: '8px',
                          minHeight: '300px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无考勤记录</div>
                          <div style={{ fontSize: '14px' }}>该人员在选定时间段内没有考勤记录</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 结算明细弹窗 */}
      {showDetailModal && (
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
            border: '1px solid #555',
            maxWidth: '80%',
            maxHeight: '80%',
            width: '900px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 弹窗标题 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #555',
              paddingBottom: '16px'
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>
                {rankingSeasonName} - 结算明细
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                关闭
              </button>
            </div>

            {/* 筛选条件 */}
            <div style={{ 
              background: '#3d3d3d', 
              padding: '16px', 
              borderRadius: '6px',
              marginBottom: '16px' 
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '16px'
              }}>
                {/* 团队筛选 */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                    团队筛选
                  </label>
                  <div style={{ 
                    maxHeight: '120px', 
                    overflowY: 'auto',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    padding: '8px',
                    background: '#2d2d2d'
                  }}>
                    {/* 全选选项 */}
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '4px 0',
                      color: '#fff',
                      fontSize: '13px',
                      borderBottom: '1px solid #444',
                      marginBottom: '4px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedTeams.length === allTeamNames.length && allTeamNames.length > 0}
                        onChange={toggleAllTeams}
                        style={{ marginRight: '8px' }}
                      />
                      全选
                    </label>
                    
                    {/* 团队选项 */}
                    {allTeamNames.map((teamName) => (
                      <label key={teamName} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '4px 0',
                        color: '#fff',
                        fontSize: '13px'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(teamName)}
                          onChange={(e) => handleTeamSelection(teamName, e.target.checked)}
                          style={{ marginRight: '8px' }}
                        />
                        {teamName}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 时间筛选 */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                    时间筛选
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ color: '#ccc', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                        开始日期
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#ccc', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                        结束日期
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#2d2d2d',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 筛选按钮 */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={applyFilters}
                  style={{
                    padding: '8px 20px',
                    background: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  应用筛选
                </button>
              </div>
            </div>

            {/* 明细内容 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loadingDetails ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px',
                  color: '#fff' 
                }}>
                  加载中...
                </div>
              ) : settlementDetails.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px',
                  color: '#ccc',
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  暂无符合条件的结算记录
                </div>
              ) : (
                <>
                  {/* 表格头部 - 删除操作列 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '150px 120px 200px 120px 1fr', 
                    gap: '12px',
                    background: '#4a4a4a',
                    padding: '12px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    color: '#fff',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}>
                    <div>结算时间</div>
                    <div>团队</div>
                    <div>奖惩详情</div>
                    <div>记录类型</div>
                    <div>考勤名称</div>
                  </div>
                  
                  {/* 表格内容 - 删除操作列 */}
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {settlementDetails.map((detail, index) => (
                      <div key={index} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '150px 120px 200px 120px 1fr', 
                        gap: '12px',
                        padding: '12px',
                        background: index % 2 === 0 ? '#3d3d3d' : '#353535',
                        color: '#fff',
                        fontSize: '13px',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        alignItems: 'center'
                      }}>
                        <div>{detail.settlementTime}</div>
                        <div>{detail.teamName}</div>
                        <div style={{ 
                          color: detail.codeValue === '花' ? '#4caf50' : '#f44336',
                          fontWeight: 'bold'
                        }}>
                          {detail.codeValue === '现金' ? detail.quantity : `${detail.codeValue} × ${detail.quantity}`}
                        </div>
                        <div style={{
                          color: detail.isSynthetic ? '#ff9800' : '#2196f3',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          {detail.synthesisType || '原始记录'}
                        </div>
                        <div>{detail.attendanceName}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 查看排名弹窗 */}
      {showRankingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeRankingModal()
          }
        }}
        >
          <div style={{
            background: '#2d2d2d',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            color: '#fff'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>查看排名</h2>
              <button
                onClick={closeRankingModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px'
                }}
              >
                ×
              </button>
            </div>

            {/* 排名类型切换 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => setRankingType('personal')}
                style={{
                  padding: '8px 16px',
                  background: rankingType === 'personal' ? '#007bff' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                个人排名
              </button>
              <button
                onClick={() => setRankingType('team')}
                style={{
                  padding: '8px 16px',
                  background: rankingType === 'team' ? '#007bff' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
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
                          background: '#1a1a1a',
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
                          background: '#1a1a1a',
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
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          background: '#1a1a1a',
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
                          background: '#1a1a1a',
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
                  <div style={{ textAlign: 'center', padding: '40px', color: '#fff', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          </div>
        </div>
      )}
    </div>
  )
}

export default PublicPages


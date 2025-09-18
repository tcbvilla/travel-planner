import { useMemo, useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
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
import './App.css'

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
  averageAssistIncreaseBonus: number
  attendanceRate: number
  attendanceRateBonus: number
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
  attendanceType?: string
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

// 个人统计导出组件
const PersonalStatsExportComponent = ({ 
  personalStats
}: { 
  personalStats: any
}) => {
  if (!personalStats) return null

  return (
    <div style={{
      width: '1000px',
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
          个人统计报告
        </h1>
        <p style={{ 
          margin: '10px 0 0 0', 
          fontSize: '20px', 
          color: '#ccc',
          opacity: 0.8
        }}>
          {personalStats.memberName} - {personalStats.timeRange}
        </p>
        <p style={{ 
          margin: '5px 0 0 0', 
          fontSize: '16px', 
          color: '#999'
        }}>
          考勤类型：{personalStats.attendanceType}
        </p>
      </div>

      {/* 统计汇总 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: '#007bff',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          <div style={{ color: '#fff', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold' }}>总考勤次数</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
            {personalStats.totalSessions}
          </div>
        </div>
        <div style={{
          background: '#28a745',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          <div style={{ color: '#fff', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold' }}>参加考勤</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
            {personalStats.attendedSessions}
          </div>
        </div>
        <div style={{
          background: '#ff6b35',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          <div style={{ color: '#fff', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold' }}>出勤次数</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
            {personalStats.records ? personalStats.records.filter((r: any) => r.isQualified).length : 0}
          </div>
        </div>
        <div style={{
          background: '#6f42c1',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          <div style={{ color: '#fff', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold' }}>出勤率</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
            {personalStats.attendanceRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 详细记录表格 */}
      {personalStats.records && personalStats.records.length > 0 && (
        <div>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            color: '#fff', 
            fontSize: '24px',
            textAlign: 'center',
            borderBottom: '2px solid #333',
            paddingBottom: '10px'
          }}>
            考勤记录详情
          </h3>
          <div style={{
            background: '#2d2d2d',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}>
            {/* 表头 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '150px 120px 80px 80px 100px 100px 80px 80px 100px',
              background: '#333',
              padding: '16px',
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
            {/* 表格内容 */}
            {personalStats.records.map((record: any, index: number) => (
              <div key={index} style={{
                display: 'grid',
                gridTemplateColumns: '150px 120px 80px 80px 100px 100px 80px 80px 100px',
                padding: '16px',
                borderBottom: '1px solid #333',
                color: '#ccc',
                fontSize: '13px',
                backgroundColor: index % 2 === 0 ? '#2d2d2d' : '#3d3d3d'
              }}>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{record.sessionName}</span>
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
                  color: record.meritDiff >= 0 ? '#28a745' : '#dc3545',
                  fontWeight: 'bold'
                }}>
                  {record.meritDiff >= 0 ? '+' : ''}{record.meritDiff}
                </span>
                <span style={{ 
                  color: record.assistDiff >= 0 ? '#28a745' : '#dc3545',
                  fontWeight: 'bold'
                }}>
                  {record.assistDiff >= 0 ? '+' : ''}{record.assistDiff}
                </span>
                <span style={{ fontWeight: 'bold' }}>{record.threshold}</span>
                <span>{record.group}</span>
                <span style={{ 
                  color: record.battleResult === 'VICTORY' ? '#28a745' :
                         record.battleResult === 'DEFEAT' ? '#dc3545' : '#ccc',
                  fontWeight: 'bold'
                }}>
                  {record.battleResult === 'VICTORY' ? '胜利' :
                   record.battleResult === 'DEFEAT' ? '失败' : record.battleResult}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div style={{
        marginTop: '40px',
        textAlign: 'center',
        color: '#999',
        fontSize: '14px',
        borderTop: '1px solid #333',
        paddingTop: '20px'
      }}>
        <p>报告生成时间：{new Date().toLocaleString()}</p>
        <p>数据来源：考勤管理系统</p>
      </div>
    </div>
  )
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
    // 根据考勤类型计算同盟数据
    const isAssistAttendance = selectedSession?.attendanceType === '区间助攻考勤'
    const totalMerit = attendingMembers.reduce((sum: number, member: DisplayRow) => 
      sum + (isAssistAttendance ? member.助攻差值 : member.差值), 0) // 总战功/总助攻
    const averageMerit = totalMembers > 0 ? Math.round(totalMerit / totalMembers) : 0 // 人均战功/人均助攻
    
    // 计算最高/最低战功/助攻
    const maxMeritMember = attendingMembers.reduce((max: DisplayRow, member: DisplayRow) => {
      const currentValue = isAssistAttendance ? member.助攻差值 : member.差值
      const maxValue = isAssistAttendance ? max.助攻差值 : max.差值
      return currentValue > maxValue ? member : max
    }, attendingMembers[0])
    const minMeritMember = attendingMembers.reduce((min: DisplayRow, member: DisplayRow) => {
      const currentValue = isAssistAttendance ? member.助攻差值 : member.差值
      const minValue = isAssistAttendance ? min.助攻差值 : min.差值
      return currentValue < minValue ? member : min
    }, attendingMembers[0])
    
    // 找出并列的最高/最低战功/助攻成员
    const maxMeritValue = isAssistAttendance ? (maxMeritMember?.助攻差值 || 0) : (maxMeritMember?.差值 || 0)
    const minMeritValue = isAssistAttendance ? (minMeritMember?.助攻差值 || 0) : (minMeritMember?.差值 || 0)
    const maxMeritMembers = attendingMembers.filter((member: DisplayRow) => 
      (isAssistAttendance ? member.助攻差值 : member.差值) === maxMeritValue)
    const minMeritMembers = attendingMembers.filter((member: DisplayRow) => 
      (isAssistAttendance ? member.助攻差值 : member.差值) === minMeritValue)

    // 计算团队排名
    const sortedByAttendance = [...groupData].sort((a, b) => 
      (b.attendanceRateBonus || 0) - (a.attendanceRateBonus || 0)
    )
    
    // 根据考勤类型选择排名依据（使用之前已声明的变量）
    const sortedByAverageMerit = [...groupData].sort((a, b) => {
      if (isAssistAttendance) {
        // 区间助攻考勤：按助攻增量排名
        return (b.averageAssistIncreaseBonus || b.averageAssistIncrease || 0) - (a.averageAssistIncreaseBonus || a.averageAssistIncrease || 0)
      } else {
        // 其他考勤类型：按战功增量排名
        return (b.averageMeritIncreaseBonus || b.averageMeritIncrease || 0) - (a.averageMeritIncreaseBonus || a.averageMeritIncrease || 0)
      }
    })
    
    const sortedByTotalMerit = [...groupData].sort((a, b) => {
      if (isAssistAttendance) {
        // 区间助攻考勤：按总助攻增量排名
        return (b.totalAssistIncrease || 0) - (a.totalAssistIncrease || 0)
      } else {
        // 其他考勤类型：按总战功增量排名
        return b.totalMeritIncrease - a.totalMeritIncrease
      }
    })

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
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>
                {isAssistAttendance ? '总助攻' : '总战功'}
              </div>
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
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>
                {isAssistAttendance ? '人均助攻' : '人均战功'}
              </div>
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
              <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>
                {isAssistAttendance ? '最高助攻' : '最高战功'}
              </div>
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
            <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '6px' }}>
              {isAssistAttendance ? '最低助攻' : '最低战功'}
            </div>
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
          const teamBattleRatio = team.attendanceRateBonus ? team.attendanceRateBonus.toFixed(1) : '0.0'
          // 根据考勤类型计算团队数据
          const teamTotalMerit = isAssistAttendance 
            ? teamMembers.reduce((sum: number, member: DisplayRow) => sum + member.助攻差值, 0)
            : teamMembers.reduce((sum: number, member: DisplayRow) => sum + member.差值, 0)
          const teamAverageMerit = isAssistAttendance 
            ? (team.averageAssistIncreaseBonus || team.averageAssistIncrease || 0)
            : (team.averageMeritIncreaseBonus || team.averageMeritIncrease || 0)
          
          // 获取排名
          const attendanceRank = getTeamRank(team.group, sortedByAttendance, 'attendanceRateBonus')
          const averageMeritRank = getTeamRank(team.group, sortedByAverageMerit, 
            isAssistAttendance ? 'averageAssistIncreaseBonus' : 'averageMeritIncreaseBonus')
          const totalMeritRank = getTeamRank(team.group, sortedByTotalMerit, 
            isAssistAttendance ? 'totalAssistIncrease' : 'totalMeritIncrease')
          
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
                    <span style={{ fontSize: '14px', color: '#ccc' }}>
                      {isAssistAttendance ? `人均助攻 ${averageMeritRank}` : `人均战功 ${averageMeritRank}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🐉</span>
                    <span style={{ fontSize: '14px', color: '#ccc' }}>
                      {isAssistAttendance ? `总助攻 ${totalMeritRank}` : `总战功 ${totalMeritRank}`}
                    </span>
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
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>
                    {isAssistAttendance ? '总助攻' : '总战功'}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196f3' }}>{teamTotalMerit.toLocaleString()}</div>
                </div>
                
                <div style={{ 
                  background: '#3d3d3d', 
                  padding: '12px', 
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #555'
                }}>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>
                    {isAssistAttendance ? '人均助攻' : '人均战功'}
                  </div>
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
  const personalExportRef = useRef<HTMLDivElement>(null)

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

  // 导出个人统计图片
  const handleExportPersonalStats = async () => {
    if (!personalStats || !personalExportRef.current) {
      alert('无法导出：数据不完整')
      return
    }

    try {
      // 等待组件渲染完成
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
      
      // 转换为图片并下载
      const link = document.createElement('a')
      link.download = `${personalStats.memberName}_个人统计_${personalStats.timeRange}.jpg`
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
  const [activeTab, setActiveTab] = useState<'add' | 'view' | 'season' | 'ranking' | 'statistics' | 'config'>('add')
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'groups'>('members')
  const [activeStatsTab, setActiveStatsTab] = useState<'team' | 'individual'>('team')
  const [attendanceType, setAttendanceType] = useState('压秒考勤')
  const [customAttendanceType, setCustomAttendanceType] = useState('')
  const [filteredCount, setFilteredCount] = useState<number>(0)
  
  // 数据统计相关状态
  const [statsStartDate, setStatsStartDate] = useState('')
  const [statsEndDate, setStatsEndDate] = useState('')
  const [statsAttendanceType, setStatsAttendanceType] = useState('压秒考勤')
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [selectedStatsTeam, setSelectedStatsTeam] = useState('')
  const [attendanceRateData, setAttendanceRateData] = useState<any[]>([])
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

  // 当切换到赛季管理页面时自动加载赛季列表
  useEffect(() => {
    if (activeTab === 'season') {
      loadSeasons(0)
    }
    if (activeTab === 'statistics') {
      loadAttendanceTypes()
    }
    if (activeTab === 'add') {
      loadAllSeasons()
    }
    if (activeTab === 'ranking') {
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
  const [modalActiveTab, setModalActiveTab] = useState<'members' | 'groups' | 'rewards' | 'attendance' | 'settlement'>('members')

  // 当切换到奖惩结算页签时加载奖惩条件
  useEffect(() => {
    if (modalActiveTab === 'settlement' && selectedSession) {
      loadSettlementRewardConditions()
      // 清除之前的结算结果，确保数据准确性
      setSettlementResults([])
    }
  }, [modalActiveTab, selectedSession])

  // 新增状态：用于控制"若任务"的选择
  const [taskStatus, setTaskStatus] = useState<'胜利' | '失败'>('胜利')

  // 新增状态：用于"胜利"情况下的表单字段
  const [attendanceRateSuccess, setAttendanceRateSuccess] = useState<number | ''>('')
  const [attendanceRankSuccess, setAttendanceRankSuccess] = useState<string>('')
  const [meritRankSuccess, setMeritRankSuccess] = useState<string>('')
  const [rewardTypeSuccess, setRewardTypeSuccess] = useState<string>('花')
  const [rewardMode, setRewardMode] = useState<string>('CODE_TABLE') // 奖励模式
  const [cashRewardAmount, setCashRewardAmount] = useState<number>(0) // 现金奖励金额

  // 新增状态：用于"失败"情况下的表单字段
  const [attendanceRateFailure, setAttendanceRateFailure] = useState<number | ''>('')
  const [attendanceRankFailure, setAttendanceRankFailure] = useState<string>('')
  const [penaltyTypeFailure, setPenaltyTypeFailure] = useState<string>('屎') // 默认值
  const [penaltyMode, setPenaltyMode] = useState<string>('CODE_TABLE') // 处罚模式
  const [cashPenaltyAmount, setCashPenaltyAmount] = useState<number>(0) // 现金处罚金额
  const [rewardPenaltyType, setRewardPenaltyType] = useState<string>('reward') // 奖惩类型选择

  // 新增状态：奖惩条件管理
  const [rewardConditions, setRewardConditions] = useState<any[]>([])
  const [editingCondition, setEditingCondition] = useState<any>(null)
  
  // 调整参加考勤状态
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
  const [editingAttendanceType, setEditingAttendanceType] = useState<string>('压秒考勤')
  const [editingCustomAttendanceType, setEditingCustomAttendanceType] = useState<string>('')
  const [editingBattleResult, setEditingBattleResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY')
  const [editingStartTime, setEditingStartTime] = useState<string>('')
  const [editingEndTime, setEditingEndTime] = useState<string>('')
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null)
  const [editingSeasonSearchTerm, setEditingSeasonSearchTerm] = useState('')
  const [showEditingSeasonDropdown, setShowEditingSeasonDropdown] = useState(false)
  
  // 榜单页面赛季选择相关状态
  const [rankingSeasonId, setRankingSeasonId] = useState<number | null>(null)
  const [rankingSeasonSearchTerm, setRankingSeasonSearchTerm] = useState('')
  const [showRankingSeasonDropdown, setShowRankingSeasonDropdown] = useState(false)
  
  // 榜单数据相关状态
  const [rankingData, setRankingData] = useState<any[]>([])
  const [loadingRankingData, setLoadingRankingData] = useState(false)
  const [rankingSeasonName, setRankingSeasonName] = useState('')
  
  // 结算明细相关状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [settlementDetails, setSettlementDetails] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [allTeamNames, setAllTeamNames] = useState<string[]>([]) // 所有团队名称
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]) // 选中的团队
  const [startDate, setStartDate] = useState('') // 开始日期
  const [endDate, setEndDate] = useState('') // 结束日期
  
  // 奖惩结算相关状态
  const [settlementRewardConditions, setSettlementRewardConditions] = useState<any[]>([])
  const [loadingSettlementConditions, setLoadingSettlementConditions] = useState(false)
  const [settlementResults, setSettlementResults] = useState<any[]>([])
  const [loadingSettlementResults, setLoadingSettlementResults] = useState(false)
  const [executingSettlement, setExecutingSettlement] = useState(false)
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false)
  
  // 查看日志相关状态
  const [showLogModal, setShowLogModal] = useState(false)
  const [showTeamItemsModal, setShowTeamItemsModal] = useState(false)
  const [teamItemsSummary, setTeamItemsSummary] = useState<any[]>([])
  const [loadingTeamItems, setLoadingTeamItems] = useState(false)
  const [settlementLogs, setSettlementLogs] = useState<any[]>([])
  
  // 手动添加奖惩相关状态
  const [showManualRewardModal, setShowManualRewardModal] = useState(false)
  const [manualRewardTeams, setManualRewardTeams] = useState<string[]>([])
  const [loadingManualRewardTeams, setLoadingManualRewardTeams] = useState(false)
  const [manualRewardType, setManualRewardType] = useState<string>('reward') // reward 或 penalty
  const [manualRewardMode, setManualRewardMode] = useState<string>('CODE_TABLE') // CODE_TABLE 或 CASH
  const [manualRewardCodeValue, setManualRewardCodeValue] = useState<string>('花')
  const [manualRewardCashAmount, setManualRewardCashAmount] = useState<number>(0)
  const [manualRewardQuantity, setManualRewardQuantity] = useState<number>(1)
  const [manualRewardDescription, setManualRewardDescription] = useState<string>('')
  const [selectedManualTeam, setSelectedManualTeam] = useState<string>('')
  
  // 撤销手动奖惩相关状态
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [revokeRecordId, setRevokeRecordId] = useState<number | null>(null)
  const [revokeRecordInfo, setRevokeRecordInfo] = useState<{teamName: string, codeValue: string} | null>(null)
  const [revokingRecord, setRevokingRecord] = useState(false)
  
  // 加成配置相关状态
  const [bonusConfig, setBonusConfig] = useState<any>({ teamSizeBonusRules: [] })
  const [loadingBonusConfig, setLoadingBonusConfig] = useState(false)
  const [savingBonusConfig, setSavingBonusConfig] = useState(false)
  
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [currentLogPage, setCurrentLogPage] = useState(0)
  const [totalLogPages, setTotalLogPages] = useState(0)
  const [totalLogElements, setTotalLogElements] = useState(0)

  // 新增函数：处理"若任务"状态变化
  const handleTaskStatusChange = (status: '胜利' | '失败') => {
    setTaskStatus(status)
    // 当任务状态改变时，清空或重置不显示的表单字段
    if (status === '胜利') {
      setAttendanceRateFailure('')
      setAttendanceRankFailure('')
      setPenaltyTypeFailure('屎')
    } else { // status === '失败'
      setAttendanceRateSuccess('')
      setAttendanceRankSuccess('')
      setMeritRankSuccess('')
      setRewardTypeSuccess('花')
    }
  }

  // 新增函数：开始编辑会话信息
  const startEditSession = () => {
    if (!selectedSession) return
    
    setEditingSessionName(selectedSession.name || '')
    const currentAttendanceType = selectedSession.attendanceType || '压秒考勤'
    if (['压秒考勤', '区间战功考勤', '区间助攻考勤', '晨练考勤', '夜战考勤'].includes(currentAttendanceType)) {
      setEditingAttendanceType(currentAttendanceType)
      setEditingCustomAttendanceType('')
    } else {
      setEditingAttendanceType('其他')
      setEditingCustomAttendanceType(currentAttendanceType)
    }
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
      
      // 考勤类型不允许修改，避免数据混乱
      // 注释掉考勤类型更新逻辑
      /*
      const finalEditingAttendanceType = editingAttendanceType === '其他' ? editingCustomAttendanceType : editingAttendanceType
      const currentAttendanceType = selectedSession.attendanceType || '压秒考勤'
      if (finalEditingAttendanceType !== currentAttendanceType) {
        updateData.attendanceType = finalEditingAttendanceType
      }
      */
      
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

  // ==================== 数据统计相关函数 ====================
  
  // 获取可用的考勤类型
  const loadAttendanceTypes = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/attendance-types')
      if (response.ok) {
        const types = await response.json()
        setAvailableAttendanceTypes(types)
        // 如果当前选择的类型不在列表中，选择第一个
        if (types.length > 0 && !types.includes(statsAttendanceType)) {
          setStatsAttendanceType(types[0])
        }
      } else {
        console.error('获取考勤类型失败')
        // 使用默认类型
        setAvailableAttendanceTypes(['压秒考勤', '区间战功考勤', '区间助攻考勤', '晨练考勤', '夜战考勤', '其他'])
      }
    } catch (error) {
      console.error('获取考勤类型失败:', error)
      // 使用默认类型
      setAvailableAttendanceTypes(['压秒考勤', '区间战功考勤', '区间助攻考勤', '晨练考勤', '夜战考勤', '其他'])
    }
  }
  
  // 查询统计数据
  const queryStatistics = async () => {
    if (!statsStartDate || !statsEndDate || !statsAttendanceType) {
      alert('请填写完整的查询条件')
      return
    }
    
    setIsLoadingStats(true)
    setError(null)
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/statistics/query?startDate=${statsStartDate}&endDate=${statsEndDate}&attendanceType=${statsAttendanceType}`)
      
      if (response.ok) {
        const data = await response.json()
        setStatsQueryResult(data)
        setAvailableTeams(data.teams || [])
        setSelectedStatsTeam('') // 重置团队选择
        setAttendanceRateData([]) // 重置出勤率数据
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
      const response = await fetch(`http://localhost:8080/api/v1/attendance/statistics/team-attendance-rate?startDate=${statsStartDate}&endDate=${statsEndDate}&attendanceType=${statsAttendanceType}&teamName=${selectedStatsTeam}`)
      
      if (response.ok) {
        const data = await response.json()
        setAttendanceRateData(data)
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
      const response = await fetch(`http://localhost:8080/api/v1/attendance/statistics/team-cash-summary?startDate=${statsStartDate}&endDate=${statsEndDate}&attendanceType=${statsAttendanceType}&teamName=${selectedStatsTeam}`)
      
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
  
  // ==================== 个人统计相关函数 ====================
  
  // 搜索人员
  const searchMembers = async () => {
    if (!statsStartDate || !statsEndDate) {
      alert('请先选择日期范围')
      return
    }
    
    setIsSearching(true)
    setError(null)
    
    try {
      const url = `http://localhost:8080/api/v1/attendance/statistics/personal/search?startDate=${statsStartDate}&endDate=${statsEndDate}&attendanceType=${statsAttendanceType}${searchKeyword ? `&keyword=${encodeURIComponent(searchKeyword)}` : ''}`
      const response = await fetch(url)
      
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
      const response = await fetch(`http://localhost:8080/api/v1/attendance/statistics/personal?startDate=${statsStartDate}&endDate=${statsEndDate}&attendanceType=${statsAttendanceType}&memberName=${encodeURIComponent(selectedMember)}`)
      
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

  // 新增函数：批量更新团队参加考勤状态
  const updateTeamAttendance = async () => {
    if (selectedTeams.length === 0 || !selectedSession) {
      alert('请选择至少一个团队')
      return
    }
    
    setIsUpdatingTeamAttendance(true)
    
    try {
      // 使用新的批量团队更新API
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/teams-attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamNames: selectedTeams,
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
        
        alert(`已成功将 ${selectedTeams.length} 个团队设置为${teamAttendanceStatus ? '参加' : '不参加'}考勤`)
        
        // 重置表单
        setSelectedTeams([])
        setTeamAttendanceStatus(true)
      } else {
        const errorData = await response.json()
        alert(`批量更新失败: ${errorData.message || '未知错误'}`)
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
    if (rewardPenaltyType === 'reward') {
      // 奖励情况：必须填写出勤率阈值，出勤率排名和战功增量排名只能选择一个
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
      if (rewardMode === 'CODE_TABLE' && !rewardTypeSuccess) {
        alert('请选择奖励类型')
        return false
      }
      if (rewardMode === 'CASH' && (!cashRewardAmount || cashRewardAmount === 0)) {
        alert('请填写现金奖励金额')
        return false
      }
    } else {
      // 惩罚情况：必须填写出勤率阈值和排名
      if (!attendanceRateFailure) {
        alert('请填写出勤率阈值')
        return false
      }
      if (!attendanceRankFailure) {
        alert('请选择出勤率排名')
        return false
      }
      if (penaltyMode === 'CODE_TABLE' && !penaltyTypeFailure) {
        alert('请选择惩罚类型')
        return false
      }
      if (penaltyMode === 'CASH' && (!cashPenaltyAmount || cashPenaltyAmount === 0)) {
        alert('请填写现金惩罚金额')
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
      attendanceRateThreshold: rewardPenaltyType === 'reward' ? attendanceRateSuccess : attendanceRateFailure,
      attendanceRateRank: rewardPenaltyType === 'reward' ? (attendanceRankSuccess || null) : attendanceRankFailure,
      meritIncreaseRank: rewardPenaltyType === 'reward' ? (meritRankSuccess || null) : null,
      rewardType: rewardPenaltyType === 'reward' ? (rewardMode === 'CODE_TABLE' ? rewardTypeSuccess : null) : null,
      penaltyType: rewardPenaltyType === 'penalty' ? (penaltyMode === 'CODE_TABLE' ? penaltyTypeFailure : null) : null,
      rewardMode: rewardPenaltyType === 'reward' ? rewardMode : null,
      cashRewardAmount: rewardPenaltyType === 'reward' && rewardMode === 'CASH' ? cashRewardAmount : null,
      penaltyMode: rewardPenaltyType === 'penalty' ? penaltyMode : null,
      cashPenaltyAmount: rewardPenaltyType === 'penalty' && penaltyMode === 'CASH' ? -Math.abs(cashPenaltyAmount) : null
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
    
    // 判断是奖励还是惩罚
    const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount)
    setRewardPenaltyType(isReward ? 'reward' : 'penalty')
    
    if (isReward) {
      // 奖励情况：设置奖励相关字段
      setAttendanceRateSuccess(condition.attendanceRateThreshold || '')
      setAttendanceRankSuccess(condition.attendanceRateRank ? String(condition.attendanceRateRank) : '')
      setMeritRankSuccess(condition.meritIncreaseRank ? String(condition.meritIncreaseRank) : '')
      setRewardMode(condition.rewardMode || 'CODE_TABLE')
      
      if (condition.rewardMode === 'CASH') {
        setCashRewardAmount(condition.cashRewardAmount || 0)
      } else {
        setRewardTypeSuccess(condition.rewardType || '花')
      }
    } else {
      // 惩罚情况：设置惩罚相关字段
      setAttendanceRateFailure(condition.attendanceRateThreshold || '')
      setAttendanceRankFailure(condition.attendanceRateRank ? String(condition.attendanceRateRank) : '')
      setPenaltyMode(condition.penaltyMode || 'CODE_TABLE')
      
      if (condition.penaltyMode === 'CASH') {
        setCashPenaltyAmount(Math.abs(condition.cashPenaltyAmount) || 0)
      } else {
        setPenaltyTypeFailure(condition.penaltyType || '屎')
      }
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
      attendanceRateThreshold: rewardPenaltyType === 'reward' ? attendanceRateSuccess : attendanceRateFailure,
      attendanceRateRank: rewardPenaltyType === 'reward' ? (attendanceRankSuccess || null) : attendanceRankFailure,
      meritIncreaseRank: rewardPenaltyType === 'reward' ? (meritRankSuccess || null) : null,
      rewardType: rewardPenaltyType === 'reward' ? (rewardMode === 'CODE_TABLE' ? rewardTypeSuccess : null) : null,
      penaltyType: rewardPenaltyType === 'penalty' ? (penaltyMode === 'CODE_TABLE' ? penaltyTypeFailure : null) : null,
      rewardMode: rewardPenaltyType === 'reward' ? rewardMode : null,
      cashRewardAmount: rewardPenaltyType === 'reward' && rewardMode === 'CASH' ? cashRewardAmount : null,
      penaltyMode: rewardPenaltyType === 'penalty' ? penaltyMode : null,
      cashPenaltyAmount: rewardPenaltyType === 'penalty' && penaltyMode === 'CASH' ? -Math.abs(cashPenaltyAmount) : null
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
    setTaskStatus('胜利')
    setAttendanceRateSuccess('')
    setAttendanceRankSuccess('')
    setMeritRankSuccess('')
    setRewardTypeSuccess('花')
    setRewardMode('CODE_TABLE')
    setCashRewardAmount(0)
    setAttendanceRateFailure('')
    setAttendanceRankFailure('')
    setPenaltyTypeFailure('屎')
    setPenaltyMode('CODE_TABLE')
    setCashPenaltyAmount(0)
    setRewardPenaltyType('reward')
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
      form.append('attendanceType', '压秒考勤') // 比较接口默认使用压秒考勤

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
        if (defaultName) {
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
        // 边界值处理：分组不一致的成员归属于起始分组
        // 不再过滤，而是使用起始分组进行统计
        
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
      // 小组统计数据由后端计算，前端不进行计算
      setGroupStats([])
      
      // 自动生成默认考勤名称
      const defaultName = generateDefaultSessionName();
      if (defaultName) {
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
      const finalAttendanceType = attendanceType === '其他' ? customAttendanceType : attendanceType;
      
      const requestBody = {
        name: finalSessionName,
        battleResult: battleResult,
        memberData: JSON.stringify(rows),
        // 移除小组统计数据的保存，改为实时计算
        threshold: threshold,
        startTime: startFile?.name || '',
        endTime: endFile?.name || '',
        seasonId: selectedSeasonId,
        attendanceType: finalAttendanceType
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
      
      if (!resp.ok) {
        // 读取后端返回的具体错误信息
        const errorMessage = await resp.text()
        throw new Error(errorMessage || `删除失败: ${resp.status}`)
      }
      
      setError(null)
      // 刷新会话列表
      loadSessions(currentPage)
      // 关闭弹框
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
    } catch (err: any) {
      setError(err?.message ?? '删除失败')
      // 删除失败时也关闭弹框，让用户能看到错误信息
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
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

  // 榜单赛季选择相关函数
  const selectRankingSeason = (season: any) => {
    console.log('选择榜单赛季:', season)
    setRankingSeasonId(season.id)
    setRankingSeasonSearchTerm('') // 清空搜索词
    setShowRankingSeasonDropdown(false)
    
    // 加载该赛季的榜单数据
    loadRankingData(season.id)
    
    // 如果日志弹窗是打开的，重新加载日志
    if (showLogModal) {
      loadSettlementLogs(0)
    }
  }

  // 加载奖惩结算条件
  const loadSettlementRewardConditions = async () => {
    if (!selectedSession) return
    
    setLoadingSettlementConditions(true)
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/reward-conditions/${selectedSession.id}`)
      if (response.ok) {
        const conditions = await response.json()
        setSettlementRewardConditions(conditions)
      } else {
        console.error('加载奖惩条件失败')
        setSettlementRewardConditions([])
      }
    } catch (error) {
      console.error('加载奖惩条件失败:', error)
      setSettlementRewardConditions([])
    } finally {
      setLoadingSettlementConditions(false)
    }
  }

  // 计算结算结果
  const calculateSettlementResults = async () => {
    if (!selectedSession) return
    
    setLoadingSettlementResults(true)
    try {
      // 重新获取最新的小组统计数据（从后端获取，确保包含正确的attendanceRateBonus）
      const sessionResponse = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}`)
      if (!sessionResponse.ok) {
        throw new Error('获取会话数据失败')
      }
      
      const sessionData = await sessionResponse.json()
      const groupStats = sessionData.groupStats || []
      
      console.log('发送给后端的groupStats:', groupStats)
      
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/calculate-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupStats)
      })
      
      if (response.ok) {
        const results = await response.json()
        setSettlementResults(results)
      } else {
        const errorText = await response.text()
        console.error('计算结算结果失败:', errorText)
        alert('计算结算结果失败: ' + errorText)
        setSettlementResults([])
      }
    } catch (error) {
      console.error('计算结算结果失败:', error)
      alert('网络错误: ' + error)
      setSettlementResults([])
    } finally {
      setLoadingSettlementResults(false)
    }
  }

  // 执行结算
  const executeSettlement = async () => {
    if (!selectedSession || settlementResults.length === 0) return
    
    setExecutingSettlement(true)
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/execute-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlementResults)
      })
      
      if (response.ok) {
        const message = await response.text()
        alert('结算执行成功: ' + message)
        
        // 更新会话状态为已结算
        setSelectedSession(prev => prev ? { ...prev, status: 'SETTLED' } : null)
        
        // 刷新会话列表
        loadSessions()
      } else {
        const errorText = await response.text()
        console.error('执行结算失败:', errorText)
        alert('执行结算失败: ' + errorText)
      }
    } catch (error) {
      console.error('执行结算失败:', error)
      alert('网络错误: ' + error)
    } finally {
      setExecutingSettlement(false)
      setShowSettlementConfirm(false)
    }
  }

  // 撤销结算
  const revokeSettlement = async () => {
    if (!selectedSession) return
    
    if (!confirm('确定要撤销结算吗？此操作将删除所有结算记录。')) {
      return
    }
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/sessions/${selectedSession.id}/revoke-settlement`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        const message = await response.text()
        alert('结算撤销成功: ' + message)
        
        // 更新会话状态为已保存
        setSelectedSession(prev => prev ? { ...prev, status: 'SAVED' } : null)
        
        // 清空结算结果
        setSettlementResults([])
        
        // 刷新会话列表
        loadSessions()
      } else {
        const errorText = await response.text()
        console.error('撤销结算失败:', errorText)
        alert('撤销结算失败: ' + errorText)
      }
    } catch (error) {
      console.error('撤销结算失败:', error)
      alert('网络错误: ' + error)
    }
  }

  // 加载结算日志

  const loadSettlementLogs = async (page: number = 0) => {
    setLoadingLogs(true)
    try {
      let url = `http://localhost:8080/api/v1/attendance/settlement-logs?page=${page}&size=10`
      if (rankingSeasonId) {
        url += `&seasonId=${rankingSeasonId}`
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSettlementLogs(data.logs || [])
        setTotalLogPages(data.totalPages || 0)
        setTotalLogElements(data.totalElements || 0)
        setCurrentLogPage(page)
      } else {
        console.error('加载日志失败')
        alert('加载日志失败')
        setSettlementLogs([])
      }
    } catch (error) {
      console.error('加载日志失败:', error)
      alert('网络错误: ' + error)
      setSettlementLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  // 打开日志弹窗
  const openLogModal = () => {
    setShowLogModal(true)
    loadSettlementLogs(0)
  }
  
  // 手动添加奖惩相关函数
  const openManualRewardModal = () => {
    if (!rankingSeasonId) {
      alert('请先选择赛季')
      return
    }
    setShowManualRewardModal(true)
    loadManualRewardTeams()
  }
  
  const loadManualRewardTeams = async () => {
    if (!rankingSeasonId) {
      console.log('loadManualRewardTeams: 没有选择赛季')
      return
    }
    
    console.log('loadManualRewardTeams: 开始加载团队列表，赛季ID:', rankingSeasonId)
    setLoadingManualRewardTeams(true)
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/teams/${rankingSeasonId}`)
      console.log('loadManualRewardTeams: 响应状态:', response.status)
      if (response.ok) {
        const teams = await response.json()
        console.log('loadManualRewardTeams: 获取到的团队列表:', teams)
        setManualRewardTeams(teams)
      } else {
        console.error('加载团队列表失败，状态码:', response.status)
        setManualRewardTeams([])
      }
    } catch (error) {
      console.error('加载团队列表失败:', error)
      setManualRewardTeams([])
    } finally {
      setLoadingManualRewardTeams(false)
    }
  }
  
  const submitManualReward = async () => {
    if (!selectedManualTeam) {
      alert('请选择团队')
      return
    }
    
    if (manualRewardMode === 'CASH' && (!manualRewardCashAmount || manualRewardCashAmount === 0)) {
      alert('请输入现金金额')
      return
    }
    
    if (manualRewardMode === 'CODE_TABLE' && !manualRewardCodeValue) {
      alert('请选择奖惩类型')
      return
    }
    
    try {
      // 处理现金金额：惩罚时转换为负数
      let finalCashAmount = manualRewardCashAmount
      if (manualRewardMode === 'CASH' && manualRewardType === 'penalty' && finalCashAmount > 0) {
        finalCashAmount = -finalCashAmount
      }
      
      const requestData = {
        teamName: selectedManualTeam,
        rewardType: manualRewardMode === 'CASH' ? '现金' : manualRewardCodeValue,
        quantity: manualRewardQuantity,
        codeValue: manualRewardMode === 'CODE_TABLE' ? manualRewardCodeValue : null,
        cashAmount: manualRewardMode === 'CASH' ? finalCashAmount : null,
        seasonId: rankingSeasonId, // 添加赛季ID
        rewardDescription: manualRewardDescription || `${manualRewardType === 'reward' ? '奖励' : '惩罚'}: ${manualRewardMode === 'CASH' ? `现金${finalCashAmount > 0 ? '+' : ''}${finalCashAmount}元` : manualRewardCodeValue}`
      }
      
      const response = await fetch('http://localhost:8080/api/v1/attendance/settlement/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })
      
      if (response.ok) {
        alert('手动添加奖惩成功')
        setShowManualRewardModal(false)
        resetManualRewardForm()
        
        // 刷新榜单数据和结算明细
        if (rankingSeasonId) {
          loadRankingData(rankingSeasonId)
          
          // 如果结算明细弹窗是打开的，也要刷新
          if (showDetailModal) {
            loadSettlementDetails(rankingSeasonId, selectedTeams, startDate, endDate)
          }
        }
        
        // 刷新结算明细（兼容原有逻辑）
        if (selectedSession) {
          calculateSettlementResults()
        }
      } else {
        const errorData = await response.json()
        alert('添加失败: ' + (errorData.error || '未知错误'))
      }
    } catch (error) {
      console.error('提交手动奖惩失败:', error)
      alert('提交失败: ' + error)
    }
  }
  
  const resetManualRewardForm = () => {
    setSelectedManualTeam('')
    setManualRewardType('reward')
    setManualRewardMode('CODE_TABLE')
    setManualRewardCodeValue('花')
    setManualRewardCashAmount(0)
    setManualRewardQuantity(1)
    setManualRewardDescription('')
  }

  // 处理撤销手动奖惩
  const handleRevokeManualSettlement = (recordId: number, teamName: string, codeValue: string) => {
    setRevokeRecordId(recordId)
    setRevokeRecordInfo({ teamName, codeValue })
    setShowRevokeConfirm(true)
  }

  // 确认撤销手动奖惩
  const confirmRevokeManualSettlement = async () => {
    if (!revokeRecordId) return
    
    setRevokingRecord(true)
    try {
      const response = await fetch(`http://localhost:8080/api/v1/attendance/settlement/manual/${revokeRecordId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        const result = await response.json()
        alert(`撤销成功！${result.impactDetails || ''}`)
        
        // 刷新相关数据
        if (rankingSeasonId) {
          loadSettlementDetails(rankingSeasonId, selectedTeams, startDate, endDate)
          loadRankingData(rankingSeasonId)
        }
        
        setShowRevokeConfirm(false)
        setRevokeRecordId(null)
        setRevokeRecordInfo(null)
      } else {
        const errorData = await response.json()
        alert('撤销失败: ' + (errorData.error || '未知错误'))
      }
    } catch (error) {
      console.error('撤销手动奖惩失败:', error)
      alert('撤销失败: 网络错误')
    } finally {
      setRevokingRecord(false)
    }
  }

  // 取消撤销
  const cancelRevokeManualSettlement = () => {
    setShowRevokeConfirm(false)
    setRevokeRecordId(null)
    setRevokeRecordInfo(null)
  }

  // 加载加成配置
  const loadBonusConfig = async () => {
    setLoadingBonusConfig(true)
    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/bonus-config')
      if (response.ok) {
        const config = await response.json()
        setBonusConfig(config)
      } else {
        console.error('加载加成配置失败')
        setBonusConfig({ teamSizeBonusRules: [] })
      }
    } catch (error) {
      console.error('加载加成配置失败:', error)
      setBonusConfig({ teamSizeBonusRules: [] })
    } finally {
      setLoadingBonusConfig(false)
    }
  }

  // 保存加成配置
  const saveBonusConfig = async () => {
    setSavingBonusConfig(true)
    try {
      const response = await fetch('http://localhost:8080/api/v1/attendance/bonus-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bonusConfig)
      })
      
      if (response.ok) {
        alert('加成配置保存成功！')
      } else {
        const errorData = await response.json()
        alert('保存失败: ' + (errorData.error || '未知错误'))
      }
    } catch (error) {
      console.error('保存加成配置失败:', error)
      alert('保存失败: 网络错误')
    } finally {
      setSavingBonusConfig(false)
    }
  }

  // 添加新的加成规则
  const addBonusRule = () => {
    const newRule = {
      minSize: 1,
      maxSize: 1,
      attendanceRateBonus: 0,
      meritBonus: 1.0,
      description: ''
    }
    setBonusConfig({
      ...bonusConfig,
      teamSizeBonusRules: [...bonusConfig.teamSizeBonusRules, newRule]
    })
  }

  // 删除加成规则
  const deleteBonusRule = (index: number) => {
    const newRules = bonusConfig.teamSizeBonusRules.filter((_: any, i: number) => i !== index)
    setBonusConfig({
      ...bonusConfig,
      teamSizeBonusRules: newRules
    })
  }

  // 更新加成规则
  const updateBonusRule = (index: number, field: string, value: any) => {
    const newRules = [...bonusConfig.teamSizeBonusRules]
    newRules[index] = { ...newRules[index], [field]: value }
    setBonusConfig({
      ...bonusConfig,
      teamSizeBonusRules: newRules
    })
  }

  // 验证加成配置
  const validateBonusConfig = () => {
    const rules = bonusConfig.teamSizeBonusRules
    
    // 检查区间重叠
    for (let i = 0; i < rules.length; i++) {
      const rule1 = rules[i]
      if (rule1.minSize > rule1.maxSize) {
        return `第${i + 1}个规则：最小人数不能大于最大人数`
      }
      
      for (let j = i + 1; j < rules.length; j++) {
        const rule2 = rules[j]
        
        // 检查区间重叠
        if (!(rule1.maxSize < rule2.minSize || rule1.minSize > rule2.maxSize)) {
          return `第${i + 1}个规则与第${j + 1}个规则区间重叠`
        }
      }
    }
    
    return null
  }

  // 加载榜单数据
  const loadRankingData = async (seasonId: number) => {
    setLoadingRankingData(true)
    setLoadingTeamItems(true)
    try {
      // 并行加载榜单数据和队伍物品统计
      const [rankingResponse, itemsResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/v1/attendance/seasons/${seasonId}/ranking`),
        fetch(`http://localhost:8080/api/v1/attendance/seasons/${seasonId}/team-items-summary`)
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

  // 加载结算明细数据
  const loadSettlementDetails = async (seasonId: number, teams: string[] = [], start: string = '', end: string = '') => {
    setLoadingDetails(true)
    try {
      let url = `http://localhost:8080/api/v1/attendance/seasons/${seasonId}/settlement-details`
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
        // 获取所有团队名称用于筛选
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
      // 重置筛选条件
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

  // 处理日志分页
  const handleLogPageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalLogPages) {
      loadSettlementLogs(newPage)
    }
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
        <button
          onClick={() => setActiveTab('ranking')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'ranking' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'ranking' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          查看榜单
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'statistics' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'statistics' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          数据统计
        </button>
        <button
          onClick={() => {
            setActiveTab('config')
            loadBonusConfig()
          }}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'config' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'config' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          加成配置
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

          {/* 过滤提示 */}
          {filteredCount > 0 && (
            <div style={{ color: 'orange', marginTop: 12 }}>
              提示：已过滤 {filteredCount} 个成员（只出现在一次CSV中）
            </div>
          )}
        </div>
      )}

      {activeTab === 'view' && (
      <div>
          <h2>查看考勤记录</h2>
          
          {/* 错误提示 */}
          {error && (
            <div style={{ 
              color: '#ff6b6b', 
              marginBottom: '12px', 
              padding: '8px 12px', 
              background: '#4a2d2d', 
              borderRadius: '4px',
              border: '1px solid #ff6b6b'
            }}>
              错误：{error}
      </div>
          )}
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>考勤名称</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>考勤类型</th>
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
                {sessions
                  .filter(session => session.attendanceType !== '手动添加') // 过滤掉手动添加的虚拟会话
                  .map((session) => (
                  <tr key={session.id}>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{session.name}</td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      {session.attendanceType || '压秒考勤'}
                    </td>
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
                  考勤类型：
                  <select
                    value={attendanceType}
                    onChange={(e) => setAttendanceType(e.target.value)}
                    style={{ 
                      width: 200,
                      padding: '8px 12px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#2d2d2d',
                      color: '#fff',
                      minHeight: '36px'
                    }}
                  >
                    <option value="压秒考勤">压秒考勤</option>
                    <option value="区间战功考勤">区间战功考勤</option>
                    <option value="区间助攻考勤">区间助攻考勤</option>
                    <option value="晨练考勤">晨练考勤</option>
                    <option value="夜战考勤">夜战考勤</option>
                    <option value="其他">其他</option>
                  </select>
                </label>
                {attendanceType === '其他' && (
                  <label style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    自定义类型：
                    <input
                      type="text"
                      value={customAttendanceType}
                      onChange={(e) => setCustomAttendanceType(e.target.value)}
                      placeholder="请输入自定义考勤类型"
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
                )}
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
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均战功增量（加成后）</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量</th>
                      <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量（加成后）</th>
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
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.averageMeritIncreaseBonus || g.averageMeritIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.totalAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.averageAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.averageAssistIncreaseBonus || g.averageAssistIncrease || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.attendanceRate}%</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{g.attendanceRateBonus}%</td>
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
            maxWidth: modalActiveTab === 'rewards' ? '1200px' : '1000px',
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
                      <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>考勤类型：</label>
                      <div style={{ fontSize: '12px', color: '#ffa500', marginBottom: '4px' }}>
                        ⚠️ 考勤类型创建后不可修改，避免数据混乱
                      </div>
                      <select
                        value={editingAttendanceType}
                        onChange={(e) => setEditingAttendanceType(e.target.value)}
                        disabled={true}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#1a1a1a',
                          color: '#888',
                          cursor: 'not-allowed'
                        }}
                      >
                        <option value="压秒考勤">压秒考勤</option>
                        <option value="区间战功考勤">区间战功考勤</option>
                        <option value="区间助攻考勤">区间助攻考勤</option>
                        <option value="晨练考勤">晨练考勤</option>
                        <option value="夜战考勤">夜战考勤</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {editingAttendanceType === '其他' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>自定义类型：</label>
                        <input
                          type="text"
                          value={editingCustomAttendanceType}
                          onChange={(e) => setEditingCustomAttendanceType(e.target.value)}
                          placeholder="请输入自定义考勤类型"
                          disabled={true}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            background: '#1a1a1a',
                            color: '#888',
                            cursor: 'not-allowed'
                          }}
                        />
                      </div>
                    )}
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
                  <div><strong>考勤类型：</strong>{selectedSession.attendanceType || '压秒考勤'}</div>
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
              <button
                onClick={() => setModalActiveTab('settlement')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  background: modalActiveTab === 'settlement' ? '#007bff' : '#555555',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                奖惩结算
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
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>
                          {selectedSession?.attendanceType === '区间助攻考勤' ? '总助攻增量' : '总战功增量'}
                        </th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>
                          {selectedSession?.attendanceType === '区间助攻考勤' ? '人均助攻增量' : '人均战功增量'}
                        </th>
                        <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>
                          {selectedSession?.attendanceType === '区间助攻考勤' ? '人均助攻增量（加成后）' : '人均战功增量（加成后）'}
                        </th>
                        {selectedSession?.attendanceType !== '区间助攻考勤' && (
                          <>
                            <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>总助攻增量</th>
                            <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量</th>
                            <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left', color: '#fff' }}>人均助攻增量（加成后）</th>
                          </>
                        )}
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
                            const colSpan = selectedSession?.attendanceType === '区间助攻考勤' ? 7 : 10;
                            return <tr><td colSpan={colSpan} style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff', textAlign: 'center' }}>暂无小组统计数据</td></tr>;
                          }
                          const groupData = JSON.parse(selectedSession.groupData);
                          console.log('解析后的groupData:', groupData)
                          return groupData.map((group: GroupStat, index: number) => (
                            <tr key={index} style={{ background: '#2d2d2d' }}>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.group}</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>
                                {selectedSession?.attendanceType === '区间助攻考勤' ? (group.totalAssistIncrease || 0) : (group.totalMeritIncrease || 0)}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>
                                {selectedSession?.attendanceType === '区间助攻考勤' ? (group.averageAssistIncrease || 0) : (group.averageMeritIncrease || 0)}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>
                                {selectedSession?.attendanceType === '区间助攻考勤' ? (group.averageAssistIncreaseBonus || group.averageAssistIncrease || 0) : (group.averageMeritIncreaseBonus || group.averageMeritIncrease || 0)}
                              </td>
                              {selectedSession?.attendanceType !== '区间助攻考勤' && (
                                <>
                                  <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.totalAssistIncrease || 0}</td>
                                  <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.averageAssistIncrease || 0}</td>
                                  <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.averageAssistIncreaseBonus || group.averageAssistIncrease || 0}</td>
                                </>
                              )}
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.attendanceRate}%</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.attendanceRateBonus}%</td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff' }}>{group.memberCount}</td>
                            </tr>
                          ));
                        } catch (error) {
                          console.error('解析小组数据失败:', error);
                          const colSpan = selectedSession?.attendanceType === '区间助攻考勤' ? 7 : 10;
                          return <tr><td colSpan={colSpan} style={{ padding: '8px', border: '1px solid #dee2e6', color: '#fff', textAlign: 'center' }}>解析小组数据失败: {error instanceof Error ? error.message : String(error)}</td></tr>;
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
                  {selectedSession.status === 'SETTLED' && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#2d2d2d', border: '1px solid #dc3545', borderRadius: '4px', color: '#dc3545' }}>
                      <strong>提示：</strong>当前考勤记录已结算，无法修改奖惩条件。如需修改，请先撤销结算。
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 第一行：若任务 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>若任务</label>
                      <select 
                        value={taskStatus}
                                                    onChange={(e) => handleTaskStatusChange(e.target.value as '胜利' | '失败')}
                        disabled={selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED'}
                        style={{ 
                          padding: '8px 12px', 
                          border: '2px solid #007bff', 
                          borderRadius: '4px', 
                          color: '#dc3545', 
                          background: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? '#f8f9fa' : '#fff',
                          minWidth: '150px',
                          opacity: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 0.6 : 1
                        }}
                      >
                                                    <option value="胜利">胜利</option>
                        <option value="失败">失败</option>
                      </select>
                    </div>
                    
                    {/* 奖惩类型选择 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>奖惩类型</label>
                      <select 
                        value={rewardPenaltyType}
                        onChange={(e) => setRewardPenaltyType(e.target.value)}
                        style={{ 
                          padding: '8px 12px', 
                          border: '2px solid #007bff', 
                          borderRadius: '4px', 
                          color: '#28a745', 
                          background: '#fff',
                          minWidth: '150px'
                        }}
                      >
                        <option value="reward">奖励</option>
                        <option value="penalty">惩罚</option>
                      </select>
                    </div>
                    
                    {/* 奖励情况下的表单字段 */}
                    {rewardPenaltyType === 'reward' && (
                      <>
                        {/* 出勤率大于 */}
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
                              color: '#28a745', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          />
                        </div>
                        
                        {/* 出勤率第 */}
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
                              color: '#28a745', 
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
                        
                        {/* 战功增量第 */}
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
                              color: '#28a745', 
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
                        
                        {/* 奖励模式 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>奖励模式</label>
                          <select 
                            value={rewardMode}
                            onChange={(e) => setRewardMode(e.target.value)}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#28a745', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            <option value="CODE_TABLE">码表奖励</option>
                            <option value="CASH">现金奖励</option>
                          </select>
                        </div>
                        
                        {/* 具体奖励 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>
                            {rewardMode === 'CASH' ? '现金金额' : '奖励类型'}
                          </label>
                          {rewardMode === 'CASH' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="number"
                                value={cashRewardAmount}
                                onChange={(e) => setCashRewardAmount(parseFloat(e.target.value) || 0)}
                                placeholder="输入现金金额（可正可负）"
                                style={{ 
                                  padding: '8px 12px', 
                                  border: '2px solid #007bff', 
                                  borderRadius: '4px', 
                                  color: '#28a745', 
                                  background: '#fff',
                                  minWidth: '200px'
                                }}
                              />
                              <span style={{ color: '#000' }}>元</span>
                            </div>
                          ) : (
                            <select 
                              value={rewardTypeSuccess}
                              onChange={(e) => setRewardTypeSuccess(e.target.value)}
                              style={{ 
                                padding: '8px 12px', 
                                border: '2px solid #007bff', 
                                borderRadius: '4px', 
                                color: '#28a745', 
                                background: '#fff',
                                minWidth: '150px'
                              }}
                            >
                              {rewardCodes.map((code) => (
                                <option key={code.id} value={code.codeName}>{code.codeName}</option>
                              ))}
                              {/* 手动添加"双"前缀选项 */}
                              <option value="双花瓣">双花瓣</option>
                              <option value="双花">双花</option>
                            </select>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* 惩罚情况下的表单字段 */}
                    {rewardPenaltyType === 'penalty' && (
                      <>
                        {/* 出勤率小于 */}
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
                        
                        {/* 出勤率倒数第 */}
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
                        
                        {/* 惩罚模式 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>惩罚模式</label>
                          <select 
                            value={penaltyMode}
                            onChange={(e) => setPenaltyMode(e.target.value)}
                            style={{ 
                              padding: '8px 12px', 
                              border: '2px solid #007bff', 
                              borderRadius: '4px', 
                              color: '#dc3545', 
                              background: '#fff',
                              minWidth: '150px'
                            }}
                          >
                            <option value="CODE_TABLE">码表惩罚</option>
                            <option value="CASH">现金惩罚</option>
                          </select>
                        </div>
                        
                        {/* 具体惩罚 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#000', fontWeight: 'bold' }}>
                            {penaltyMode === 'CASH' ? '现金金额' : '惩罚类型'}
                          </label>
                          {penaltyMode === 'CASH' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="number"
                                value={cashPenaltyAmount}
                                onChange={(e) => setCashPenaltyAmount(parseFloat(e.target.value) || 0)}
                                placeholder="输入现金金额（负数）"
                                style={{ 
                                  padding: '8px 12px', 
                                  border: '2px solid #007bff', 
                                  borderRadius: '4px', 
                                  color: '#dc3545', 
                                  background: '#fff',
                                  minWidth: '200px'
                                }}
                              />
                              <span style={{ color: '#000' }}>元</span>
                            </div>
                          ) : (
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
                              {/* 手动添加"双"前缀选项 */}
                              <option value="双屎粒">双屎粒</option>
                              <option value="双屎">双屎</option>
                            </select>
                          )}
                        </div>
                      </>
                    )}
                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button
                        onClick={editingCondition ? updateRewardCondition : saveRewardCondition}
                        disabled={selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED'}
                        style={{
                          padding: '8px 16px',
                          background: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? '#6c757d' : '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 'not-allowed' : 'pointer',
                          opacity: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 0.6 : 1
                        }}
                      >
                        {editingCondition ? '更新' : '新增'}
                      </button>
                      {editingCondition && (
                        <button
                          onClick={resetRewardForm}
                          disabled={selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED'}
                          style={{
                            padding: '8px 16px',
                            background: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? '#6c757d' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 'not-allowed' : 'pointer',
                            opacity: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 0.6 : 1
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
                                {(() => {
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  return isReward ? '大于' : '小于';
                                })()} {condition.attendanceRateThreshold}%
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {(() => {
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  if (isReward) {
                                    // 奖励情况
                                    if (condition.meritIncreaseRank && condition.meritIncreaseRank !== '') {
                                      return <>战功增量第{condition.meritIncreaseRank}名</>;
                                    } else {
                                      return <>出勤率第{condition.attendanceRateRank}名</>;
                                    }
                                  } else {
                                    // 惩罚情况
                                    return <>出勤率倒数第{condition.attendanceRateRank}名</>;
                                  }
                                })()}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {(() => {
                                  // 判断是奖励还是惩罚
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  
                                  if (isReward) {
                                    // 奖励类型
                                    if (condition.rewardMode === 'CASH') {
                                      return `现金${condition.cashRewardAmount > 0 ? '+' : ''}${condition.cashRewardAmount}元`;
                                    } else {
                                      return condition.rewardType || '未知奖励';
                                    }
                                  } else {
                                    // 惩罚类型
                                    if (condition.penaltyMode === 'CASH') {
                                      return `现金${condition.cashPenaltyAmount}元`;
                                    } else {
                                      return condition.penaltyType || '未知惩罚';
                                    }
                                  }
                                })()}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                <button
                                  onClick={() => editRewardCondition(condition)}
                                  disabled={selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED'}
                                  style={{
                                    padding: '4px 8px',
                                    background: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? '#6c757d' : '#007bff',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 'not-allowed' : 'pointer',
                                    marginRight: '4px',
                                    opacity: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 0.6 : 1
                                  }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => deleteRewardCondition(condition.id)}
                                  disabled={selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED'}
                                  style={{
                                    padding: '4px 8px',
                                    background: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? '#6c757d' : '#dc3545',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 'not-allowed' : 'pointer',
                                    opacity: selectedSession.status === 'SAVED' || selectedSession.status === 'SETTLED' ? 0.6 : 1
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
                  {selectedSession.status === 'ADDED' && (
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
                  )}
                  {selectedSession.status === 'SAVED' && (
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
                  {selectedSession.status === 'SETTLED' && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#2d2d2d', border: '1px solid #dc3545', borderRadius: '4px', color: '#dc3545' }}>
                      <strong>提示：</strong>当前考勤记录已结算，无法调整参加考勤状态。如需调整，请先撤销结算。
                    </div>
                  )}
                  
                  {/* 团队批量处理 */}
                  <div style={{ marginBottom: '24px', padding: '16px', border: '2px solid #007bff', borderRadius: '4px', background: '#1a1a1a' }}>
                    <h5 style={{ margin: '0 0 16px 0', color: '#fff' }}>团队批量处理</h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* 团队多选 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ minWidth: '100px', color: '#fff', fontWeight: 'bold' }}>选择团队:</label>
                          <button
                            onClick={() => {
                              if (selectedTeams.length === getTeamList().length) {
                                setSelectedTeams([])
                              } else {
                                setSelectedTeams([...getTeamList()])
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            {selectedTeams.length === getTeamList().length ? '取消全选' : '全选'}
                          </button>
                          <span style={{ color: '#ccc', fontSize: '12px' }}>
                            已选择 {selectedTeams.length} 个团队
                          </span>
                        </div>
                        
                        {/* 团队复选框列表 */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                          gap: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          padding: '8px',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          background: '#1a1a1a'
                        }}>
                          {getTeamList().map((team) => (
                            <label key={team} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}>
                              <input
                                type="checkbox"
                                checked={selectedTeams.includes(team)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTeams([...selectedTeams, team])
                                  } else {
                                    setSelectedTeams(selectedTeams.filter(t => t !== team))
                                  }
                                }}
                                style={{ margin: 0 }}
                              />
                              <span>{team}</span>
                            </label>
                          ))}
                        </div>
                        
                        {/* 已选择的团队显示 */}
                        {selectedTeams.length > 0 && (
                          <div style={{ 
                            marginTop: '8px',
                            padding: '8px',
                            background: '#2d2d2d',
                            borderRadius: '4px',
                            border: '1px solid #007bff'
                          }}>
                            <div style={{ color: '#fff', fontSize: '12px', marginBottom: '4px' }}>已选择的团队:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {selectedTeams.map((team) => (
                                <span
                                  key={team}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 6px',
                                    background: '#007bff',
                                    color: '#fff',
                                    borderRadius: '3px',
                                    fontSize: '11px'
                                  }}
                                >
                                  {team}
                                  <button
                                    onClick={() => setSelectedTeams(selectedTeams.filter(t => t !== team))}
                                    style={{
                                      marginLeft: '4px',
                                      background: 'none',
                                      border: 'none',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '10px'
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
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
                          disabled={selectedTeams.length === 0 || isUpdatingTeamAttendance || selectedSession.status !== 'ADDED'}
                          style={{
                            padding: '10px 20px',
                            background: selectedTeams.length > 0 && !isUpdatingTeamAttendance && selectedSession.status === 'ADDED' ? '#007bff' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedTeams.length > 0 && !isUpdatingTeamAttendance && selectedSession.status === 'ADDED' ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: selectedSession.status !== 'ADDED' ? 0.6 : 1
                          }}
                        >
                          {isUpdatingTeamAttendance ? '执行中...' : `批量更新 ${selectedTeams.length} 个团队`}
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
                          disabled={selectedMembers.length === 0 || isUpdatingMemberAttendance || selectedSession.status !== 'ADDED'}
                          style={{
                            padding: '10px 20px',
                            background: selectedMembers.length > 0 && !isUpdatingMemberAttendance && selectedSession.status === 'ADDED' ? '#28a745' : '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedMembers.length > 0 && !isUpdatingMemberAttendance && selectedSession.status === 'ADDED' ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: selectedSession.status !== 'ADDED' ? 0.6 : 1
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

            {/* 奖惩结算 */}
            {modalActiveTab === 'settlement' && (
              <div style={{ background: '#404040', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>奖惩结算</h4>
                
                {selectedSession.status === 'SAVED' && (
                  <div style={{ color: '#fff', marginBottom: '16px' }}>
                    <strong>提示：</strong>当前考勤记录已保存，可以进行奖惩结算。
                  </div>
                )}
                {selectedSession.status === 'SETTLED' && (
                  <div style={{ color: '#dc3545', marginBottom: '16px' }}>
                    <strong>提示：</strong>当前考勤记录已结算，只能查看结算结果或撤销结算。
                  </div>
                )}
                {selectedSession.status === 'ADDED' && (
                  <div style={{ color: '#fff', marginBottom: '16px' }}>
                    <strong>提示：</strong>当前考勤记录未保存，请先保存考勤记录后再进行奖惩结算。
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ color: '#fff', marginBottom: '8px' }}>结算状态</h5>
                  <div style={{ color: '#fff' }}>
                    {selectedSession.status === 'SETTLED' ? (
                      <span style={{ color: '#28a745' }}>✓ 已结算</span>
                    ) : (
                      <span style={{ color: '#ffc107' }}>○ 未结算</span>
                    )}
                  </div>
                </div>

                {/* 需要结算的奖惩条件 */}
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ color: '#fff', marginBottom: '8px' }}>需要结算的奖惩条件</h5>
                  
                  {loadingSettlementConditions ? (
                    <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
                      加载中...
                    </div>
                  ) : settlementRewardConditions.length === 0 ? (
                    <div style={{ color: '#ccc', fontStyle: 'italic', padding: '8px' }}>
                      暂无奖惩条件，请先在"考勤奖惩"页签中添加奖惩条件
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#2d2d2d' }}>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>任务状态</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>出勤率条件</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>排名条件</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>奖惩</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementRewardConditions.map((condition, index) => (
                            <tr key={condition.id} style={{ background: index % 2 === 0 ? '#404040' : '#2d2d2d' }}>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {condition.taskStatus}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {(() => {
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  return isReward ? '大于' : '小于';
                                })()} {condition.attendanceRateThreshold}%
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {(() => {
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  if (isReward) {
                                    // 奖励情况
                                    if (condition.meritIncreaseRank && condition.meritIncreaseRank !== '') {
                                      return <>战功增量第{condition.meritIncreaseRank}名</>;
                                    } else {
                                      return <>出勤率第{condition.attendanceRateRank}名</>;
                                    }
                                  } else {
                                    // 惩罚情况
                                    return <>出勤率倒数第{condition.attendanceRateRank}名</>;
                                  }
                                })()}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {(() => {
                                  const isReward = condition.rewardType || (condition.rewardMode === 'CASH' && condition.cashRewardAmount);
                                  if (isReward) {
                                    // 奖励类型
                                    if (condition.rewardMode === 'CASH') {
                                      return `现金${condition.cashRewardAmount > 0 ? '+' : ''}${condition.cashRewardAmount}元`;
                                    } else {
                                      return condition.rewardType || '未知奖励';
                                    }
                                  } else {
                                    // 惩罚类型
                                    if (condition.penaltyMode === 'CASH') {
                                      return `现金${condition.cashPenaltyAmount}元`;
                                    } else {
                                      return condition.penaltyType || '未知惩罚';
                                    }
                                  }
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 结算结果 */}
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ color: '#fff', marginBottom: '8px' }}>结算结果</h5>
                  
                  {loadingSettlementResults ? (
                    <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
                      计算中...
                    </div>
                  ) : settlementResults.length === 0 ? (
                    <div style={{ color: '#ccc', fontStyle: 'italic', padding: '8px' }}>
                      暂无结算结果，请先点击"计算结算"按钮进行计算
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#2d2d2d' }}>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>小组名</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>奖惩结果</th>
                            <th style={{ padding: '8px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>金额</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementResults.map((result, index) => (
                            <tr key={index} style={{ background: index % 2 === 0 ? '#404040' : '#2d2d2d' }}>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {result.teamName}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: '#fff' }}>
                                {result.rewardDescription}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #555', color: result.amount >= 0 ? '#28a745' : '#dc3545' }}>
                                {result.amount.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={calculateSettlementResults}
                    disabled={selectedSession.status !== 'SAVED' || settlementRewardConditions.length === 0}
                    style={{
                      padding: '8px 16px',
                      background: (selectedSession.status === 'SAVED' && settlementRewardConditions.length > 0) ? '#007bff' : '#6c757d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (selectedSession.status === 'SAVED' && settlementRewardConditions.length > 0) ? 'pointer' : 'not-allowed',
                      opacity: (selectedSession.status === 'SAVED' && settlementRewardConditions.length > 0) ? 1 : 0.6
                    }}
                    title={selectedSession.status === 'ADDED' ? '考勤记录未保存' : selectedSession.status === 'SETTLED' ? '考勤记录已结算' : settlementRewardConditions.length === 0 ? '请先添加奖惩条件' : '计算结算结果'}
                  >
                    计算结算
                  </button>
                  <button
                    onClick={() => setShowSettlementConfirm(true)}
                    disabled={selectedSession.status !== 'SAVED' || settlementResults.length === 0 || executingSettlement}
                    style={{
                      padding: '8px 16px',
                      background: (selectedSession.status === 'SAVED' && settlementResults.length > 0 && !executingSettlement) ? '#28a745' : '#6c757d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (selectedSession.status === 'SAVED' && settlementResults.length > 0 && !executingSettlement) ? 'pointer' : 'not-allowed',
                      opacity: (selectedSession.status === 'SAVED' && settlementResults.length > 0 && !executingSettlement) ? 1 : 0.6
                    }}
                    title={selectedSession.status === 'ADDED' ? '考勤记录未保存' : selectedSession.status === 'SETTLED' ? '考勤记录已结算' : settlementResults.length === 0 ? '请先计算结算结果' : '执行结算'}
                  >
                    {executingSettlement ? '执行中...' : '执行结算'}
                  </button>
                  <button
                    onClick={revokeSettlement}
                    disabled={selectedSession.status !== 'SETTLED'}
                    style={{
                      padding: '8px 16px',
                      background: selectedSession.status === 'SETTLED' ? '#dc3545' : '#6c757d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedSession.status === 'SETTLED' ? 'pointer' : 'not-allowed',
                      opacity: selectedSession.status === 'SETTLED' ? 1 : 0.6
                    }}
                  >
                    撤销结算
                  </button>
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

      {/* 执行结算确认弹窗 */}
      {showSettlementConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>确认执行结算</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <p>您确定要执行结算吗？执行后将会：</p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>保存 {settlementResults.length} 条结算记录到数据库</li>
                <li>关联到赛季：{selectedSession?.season?.name}</li>
                <li>记录操作日志</li>
                <li>考勤记录状态变更为"已结算"</li>
              </ul>
              <p style={{ color: '#ffc107', fontSize: '14px' }}>
                <strong>注意：</strong>执行后如需修改，请先撤销结算再重新操作。
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettlementConfirm(false)}
                disabled={executingSettlement}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: executingSettlement ? 'not-allowed' : 'pointer',
                  opacity: executingSettlement ? 0.6 : 1
                }}
              >
                取消
              </button>
              <button
                onClick={executeSettlement}
                disabled={executingSettlement}
                style={{
                  padding: '8px 16px',
                  background: executingSettlement ? '#6c757d' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: executingSettlement ? 'not-allowed' : 'pointer',
                  opacity: executingSettlement ? 0.6 : 1
                }}
              >
                {executingSettlement ? '执行中...' : '确认执行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ color: '#fff', margin: 0 }}>查看榜单</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={openLogModal}
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
                  查看日志
                </button>
                {rankingSeasonId && (
                  <button
                    onClick={openManualRewardModal}
                    style={{
                      padding: '8px 16px',
                      background: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    手动添加奖惩
                  </button>
                )}
              </div>
            </div>
            
            {/* 赛季选择下拉框 */}
            <div style={{ position: 'relative' }} className="ranking-season-dropdown-container">
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
                <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>
                  {rankingSeasonName} - 小组奖金榜单
                </h3>
                <p style={{ color: '#ccc', margin: 0, fontSize: '14px' }}>
                  共 {rankingData.length} 个小组参与结算
                </p>
      </div>

              {/* 柱状图 */}
              <div style={{ 
                background: '#3d3d3d', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#fff', margin: '0 0 20px 0', textAlign: 'center' }}>
                  小组总奖金柱状图
                </h4>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  height: '400px',
                  padding: '0 20px',
                  overflowX: 'auto',
                  position: 'relative'
                }}>
                  {/* 零轴线 */}
                  <div style={{
                    position: 'absolute',
                    left: '20px',
                    right: '20px',
                    top: 'calc(35px + 150px)', // 35px(正值数值) + 150px(正值区域) = 185px，正好是柱子的交界处
                    height: '1px',
                    background: '#666',
                    zIndex: 1
                  }}></div>
                  
                  {rankingData.map((team) => {
                    const maxReward = Math.max(...rankingData.map(t => Math.abs(t.totalReward)))
                    // 限制柱子最大高度为140px，留10px边距
                    const maxBarHeight = 140
                    const barHeight = maxReward > 0 ? Math.min((Math.abs(team.totalReward) / maxReward) * maxBarHeight, maxBarHeight) : 0
                    const isPositive = team.totalReward >= 0
                    
                    // 计算百分比：当前小组 / 总和
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
                            <div style={{ 
                              color: '#4caf50',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textAlign: 'center'
                            }}>
                              +{team.totalReward}
                              <div style={{ 
                                fontSize: '9px',
                                color: '#81c784',
                                marginTop: '2px'
                              }}>
                                {percentage}%
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 柱子容器 - 固定300px高度，中间是零轴线 */}
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
                                background: `linear-gradient(to top, #4caf50, #81c784)`,
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
                                background: `linear-gradient(to bottom, #f44336, #e57373)`,
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
                            <div style={{ 
                              color: '#f44336',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textAlign: 'center'
                            }}>
                              {team.totalReward}
                              <div style={{ 
                                fontSize: '9px',
                                color: '#e57373',
                                marginTop: '2px'
                              }}>
                                {percentage}%
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 小组名称 - 始终在底部 */}
                        <div style={{ 
                          color: '#fff',
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
                  borderBottom: '1px solid #555'
                }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>队伍物品统计</h4>
                </div>

                {loadingTeamItems ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                    加载中...
                  </div>
                ) : teamItemsSummary.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                    暂无数据
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
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
                              fontWeight: 'bold'
                            }}>
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
                              color: team.现金 > 0 ? '#4caf50' : team.现金 < 0 ? '#f44336' : '#ccc',
                              fontWeight: team.现金 !== 0 ? 'bold' : 'normal'
                            }}>
                              {team.现金 > 0 ? '+' : ''}{team.现金}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                  <div style={{ textAlign: 'right' }}>总奖金</div>
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
                      color: team.totalReward >= 0 ? '#4caf50' : '#f44336'
                    }}>
                      {team.totalReward > 0 ? '+' : ''}{team.totalReward}
                    </div>
                  </div>
                ))}
              </div>

              {/* 查看明细和榜单详情按钮 */}
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
      {activeTab === 'statistics' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
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
                    <button
                      onClick={() => {
                        const chartCanvas = document.querySelector('#attendance-chart canvas') as HTMLCanvasElement;
                        if (chartCanvas) {
                          const link = document.createElement('a');
                          link.download = `团队出勤率曲线_${selectedStatsTeam}_${new Date().toISOString().split('T')[0]}.png`;
                          link.href = chartCanvas.toDataURL();
                          link.click();
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginLeft: 'auto'
                      }}
                    >
                      导出图表
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
                      borderRadius: '8px'
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
                 <div style={{ display: 'flex', gap: '12px' }}>
                   <button
                     onClick={handleExportPersonalStats}
                     disabled={!personalStats}
                     style={{
                       padding: '8px 16px',
                       background: personalStats ? '#007bff' : '#6c757d',
                       color: '#fff',
                       border: 'none',
                       borderRadius: '4px',
                       cursor: personalStats ? 'pointer' : 'not-allowed',
                       fontSize: '14px',
                       fontWeight: 'bold'
                     }}
                   >
                     导出图片
                   </button>
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
                          borderRadius: '8px'
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
                  color: '#ccc' 
                }}>
                  暂无符合条件的结算记录
                </div>
              ) : (
                <>
                  {/* 表格头部 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '150px 120px 200px 120px 1fr 80px', 
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
                    <div>操作</div>
                  </div>
                  
                  {/* 表格内容 */}
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {settlementDetails.map((detail, index) => (
                      <div key={index} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '150px 120px 200px 120px 1fr 80px', 
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
                        <div>
                          {detail.isManual && detail.recordStatus !== 'DELETED' && (
                            <button
                              onClick={() => handleRevokeManualSettlement(detail.recordId, detail.teamName, detail.codeValue)}
                              style={{
                                padding: '4px 8px',
                                background: detail.recordStatus === 'SYNTHESIZED' ? '#ff9800' : '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                              onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = detail.recordStatus === 'SYNTHESIZED' ? '#f57c00' : '#c82333'}
                              onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = detail.recordStatus === 'SYNTHESIZED' ? '#ff9800' : '#dc3545'}
                              title={detail.recordStatus === 'SYNTHESIZED' ? '撤销此手动记录及其所有合成产物' : '撤销此手动记录'}
                            >
                              撤销
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 撤销确认对话框 */}
      {showRevokeConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>确认撤销</h3>
            <p style={{ color: '#ccc', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              确定要撤销 <strong style={{ color: '#fff' }}>{revokeRecordInfo?.teamName}</strong> 的 
              <strong style={{ color: '#fff' }}>{revokeRecordInfo?.codeValue}</strong> 记录吗？
            </p>
            <p style={{ color: '#ff9800', margin: '0 0 20px 0', fontSize: '14px' }}>
              ⚠️ 此操作可能会级联撤销相关的合成记录，并恢复被合成的原始记录
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelRevokeManualSettlement}
                disabled={revokingRecord}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: revokingRecord ? 'not-allowed' : 'pointer',
                  opacity: revokingRecord ? 0.6 : 1
                }}
              >
                取消
              </button>
              <button
                onClick={confirmRevokeManualSettlement}
                disabled={revokingRecord}
                style={{
                  padding: '8px 16px',
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: revokingRecord ? 'not-allowed' : 'pointer',
                  opacity: revokingRecord ? 0.6 : 1
                }}
              >
                {revokingRecord ? '撤销中...' : '确认撤销'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 加成配置页面 */}
      {activeTab === 'config' && (
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', margin: 0 }}>团队人数加成配置</h2>
            <div>
              <button
                onClick={addBonusRule}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                添加规则
              </button>
              <button
                onClick={() => {
                  const error = validateBonusConfig()
                  if (error) {
                    alert('配置验证失败：' + error)
                    return
                  }
                  saveBonusConfig()
                }}
                disabled={savingBonusConfig}
                style={{
                  padding: '8px 16px',
                  background: savingBonusConfig ? '#6c757d' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: savingBonusConfig ? 'not-allowed' : 'pointer'
                }}
              >
                {savingBonusConfig ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>

          {loadingBonusConfig ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>
              加载配置中...
            </div>
          ) : (
            <div>
              {bonusConfig.teamSizeBonusRules.length === 0 ? (
                <div style={{ 
                  color: '#ccc', 
                  textAlign: 'center', 
                  padding: '40px',
                  border: '2px dashed #555',
                  borderRadius: '8px'
                }}>
                  暂无加成规则，点击"添加规则"开始配置
                </div>
              ) : (
                <div>
                  <p style={{ color: '#ccc', marginBottom: '20px' }}>
                    配置团队人数对应的加成规则，区间不能重叠。出勤率加成单位为百分比(%)，战功加成为倍数。
                  </p>
                  
                  {bonusConfig.teamSizeBonusRules.map((rule: any, index: number) => (
                    <div key={index} style={{ 
                      background: '#3d3d3d', 
                      padding: '20px', 
                      marginBottom: '15px', 
                      borderRadius: '8px',
                      border: '1px solid #555'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ color: '#fff', margin: 0 }}>规则 {index + 1}</h4>
                        <button
                          onClick={() => deleteBonusRule(index)}
                          style={{
                            padding: '4px 8px',
                            background: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          删除
                        </button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                          <label style={{ color: '#ccc', display: 'block', marginBottom: '5px' }}>
                            人数范围：
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="number"
                              min="1"
                              value={rule.minSize || ''}
                              onChange={(e) => updateBonusRule(index, 'minSize', parseInt(e.target.value) || 1)}
                              style={{
                                padding: '8px',
                                background: '#555',
                                color: '#fff',
                                border: '1px solid #666',
                                borderRadius: '4px',
                                width: '80px'
                              }}
                            />
                            <span style={{ color: '#ccc' }}>-</span>
                            <input
                              type="number"
                              min="1"
                              value={rule.maxSize || ''}
                              onChange={(e) => updateBonusRule(index, 'maxSize', parseInt(e.target.value) || 1)}
                              style={{
                                padding: '8px',
                                background: '#555',
                                color: '#fff',
                                border: '1px solid #666',
                                borderRadius: '4px',
                                width: '80px'
                              }}
                            />
                            <span style={{ color: '#ccc' }}>人</span>
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ color: '#ccc', display: 'block', marginBottom: '5px' }}>
                            出勤率加成 (%)：
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={rule.attendanceRateBonus || ''}
                            onChange={(e) => updateBonusRule(index, 'attendanceRateBonus', parseFloat(e.target.value) || 0)}
                            style={{
                              padding: '8px',
                              background: '#555',
                              color: '#fff',
                              border: '1px solid #666',
                              borderRadius: '4px',
                              width: '100px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                          <label style={{ color: '#ccc', display: 'block', marginBottom: '5px' }}>
                            战功加成倍数：
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={rule.meritBonus || ''}
                            onChange={(e) => updateBonusRule(index, 'meritBonus', parseFloat(e.target.value) || 1.0)}
                            style={{
                              padding: '8px',
                              background: '#555',
                              color: '#fff',
                              border: '1px solid #666',
                              borderRadius: '4px',
                              width: '100px'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ color: '#ccc', display: 'block', marginBottom: '5px' }}>
                            描述（可选）：
                          </label>
                          <input
                            type="text"
                            value={rule.description || ''}
                            onChange={(e) => updateBonusRule(index, 'description', e.target.value)}
                            placeholder={`${rule.minSize}-${rule.maxSize}人团队加成`}
                            style={{
                              padding: '8px',
                              background: '#555',
                              color: '#fff',
                              border: '1px solid #666',
                              borderRadius: '4px',
                              width: '100%'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#1a1a1a', 
            borderRadius: '8px',
            border: '1px solid #444'
          }}>
            <h4 style={{ color: '#fff', margin: '0 0 10px 0' }}>使用说明：</h4>
            <ul style={{ color: '#ccc', margin: 0, paddingLeft: '20px' }}>
              <li>人数范围不能重叠，系统会自动验证</li>
              <li>出勤率加成：在基础出勤率上增加的百分比，如3表示+3%</li>
              <li>战功加成倍数：战功增量的乘数，如1.03表示×1.03倍</li>
              <li>配置保存后立即生效，影响后续的考勤计算</li>
              <li>可以设置多个不重叠的人数区间，覆盖不同规模的团队</li>
            </ul>
          </div>
        </div>
      )}

      {/* 页面内容区域结束 */}

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

      {/* 结算日志弹窗 */}
      {showLogModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>结算日志</h3>
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
                  加载中...
                </div>
              ) : settlementLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                  暂无结算日志
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#1a1a1a' }}>
                        <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff', minWidth: '140px' }}>操作时间</th>
                        <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff', minWidth: '120px' }}>考勤记录名称</th>
                        <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff', minWidth: '100px' }}>结算赛季</th>
                        <th style={{ padding: '12px', border: '1px solid #555', textAlign: 'left', color: '#fff' }}>结算内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementLogs.map((log, index) => (
                        <tr key={log.id} style={{ background: index % 2 === 0 ? '#404040' : '#2d2d2d' }}>
                          <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                            {new Date(log.operationTime).toLocaleString('zh-CN')}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                            {log.attendanceRecordName}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #555', color: '#fff' }}>
                            {log.settlementSeason}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #555', color: '#fff', maxWidth: '300px', wordBreak: 'break-word' }}>
                            {log.settlementContent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 分页控制 */}
            {totalLogPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px', 
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #555'
              }}>
                <button
                  onClick={() => handleLogPageChange(currentLogPage - 1)}
                  disabled={currentLogPage === 0}
                  style={{
                    padding: '6px 12px',
                    background: currentLogPage === 0 ? '#555' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentLogPage === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  上一页
                </button>
                <span style={{ color: '#fff', fontSize: '14px' }}>
                  第 {currentLogPage + 1} 页，共 {totalLogPages} 页 (共 {totalLogElements} 条记录)
                </span>
                <button
                  onClick={() => handleLogPageChange(currentLogPage + 1)}
                  disabled={currentLogPage >= totalLogPages - 1}
                  style={{
                    padding: '6px 12px',
                    background: currentLogPage >= totalLogPages - 1 ? '#555' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentLogPage >= totalLogPages - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  下一页
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 榜单详情弹窗 */}
      {showTeamItemsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '24px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>榜单详情 - 队伍物品统计</h3>
              <button
                onClick={() => setShowTeamItemsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px'
                }}
              >
                ×
              </button>
            </div>

            {loadingTeamItems ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                加载中...
              </div>
            ) : teamItemsSummary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                暂无数据
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: '#2d2d2d'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#404040' }}>
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
                        backgroundColor: index % 2 === 0 ? '#2d2d2d' : '#404040'
                      }}>
                        <td style={{ 
                          padding: '12px 8px', 
                          border: '1px solid #555', 
                          color: '#fff',
                          fontWeight: 'bold'
                        }}>
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
                          color: team.现金 > 0 ? '#4caf50' : team.现金 < 0 ? '#f44336' : '#ccc',
                          fontWeight: team.现金 !== 0 ? 'bold' : 'normal'
                        }}>
                          {team.现金 > 0 ? '+' : ''}{team.现金}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={() => setShowTeamItemsModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手动添加奖惩弹窗 */}
      {showManualRewardModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '24px',
            borderRadius: '8px',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 20px 0' }}>手动添加奖惩</h3>
            
            {/* 团队选择 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px' }}>选择团队</label>
              {loadingManualRewardTeams ? (
                <div style={{ color: '#ccc' }}>加载团队列表中...</div>
              ) : (
                <select
                  value={selectedManualTeam}
                  onChange={(e) => setSelectedManualTeam(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#404040',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">请选择团队</option>
                  {manualRewardTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              )}
            </div>
            
            {/* 奖惩类型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px' }}>奖惩类型</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
                  <input
                    type="radio"
                    value="reward"
                    checked={manualRewardType === 'reward'}
                    onChange={(e) => setManualRewardType(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  奖励
                </label>
                <label style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
                  <input
                    type="radio"
                    value="penalty"
                    checked={manualRewardType === 'penalty'}
                    onChange={(e) => setManualRewardType(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  惩罚
                </label>
              </div>
            </div>
            
            {/* 奖惩模式 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold' }}>奖惩模式</label>
              <select
                value={manualRewardMode}
                onChange={(e) => setManualRewardMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#404040',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
              >
                <option value="CODE_TABLE">码表</option>
                <option value="CASH">现金</option>
              </select>
            </div>
            
            {/* 具体内容 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold' }}>
                {manualRewardMode === 'CASH' ? '现金金额' : '奖惩类型'}
              </label>
              {manualRewardMode === 'CASH' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={manualRewardCashAmount}
                    onChange={(e) => setManualRewardCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder={manualRewardType === 'reward' ? '输入现金金额（可正可负）' : '输入现金金额（负数）'}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: '#404040',
                      color: manualRewardType === 'reward' ? '#28a745' : '#dc3545',
                      border: '2px solid #007bff',
                      borderRadius: '4px'
                    }}
                  />
                  <span style={{ color: '#fff' }}>元</span>
                </div>
              ) : (
                <select
                  value={manualRewardCodeValue}
                  onChange={(e) => setManualRewardCodeValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#404040',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '4px'
                  }}
                >
                  <option value="花">花</option>
                  <option value="花瓣">花瓣</option>
                  <option value="屎">屎</option>
                  <option value="屎粒">屎粒</option>
                </select>
              )}
            </div>
            
            {/* 数量 */}
            {/* 数量 - 只有码表模式才显示 */}
            {manualRewardMode === 'CODE_TABLE' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#fff', marginBottom: '8px' }}>数量</label>
                <input
                  type="number"
                  value={manualRewardQuantity}
                  onChange={(e) => setManualRewardQuantity(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#404040',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '4px'
                  }}
                  min="1"
                />
              </div>
            )}
            
            {/* 描述 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px' }}>描述（可选）</label>
              <input
                type="text"
                value={manualRewardDescription}
                onChange={(e) => setManualRewardDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#404040',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
                placeholder="请输入描述"
              />
            </div>
            
            {/* 按钮 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowManualRewardModal(false)
                  resetManualRewardForm()
                }}
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
              <button
                onClick={submitManualReward}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* 导出组件（隐藏） */}
      <div ref={exportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <GroupStatsExportComponent 
          selectedSession={selectedSession}
          sortBy={exportSortBy}
        />
      </div>
      
      {/* 个人统计导出组件（隐藏） */}
      <div ref={personalExportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <PersonalStatsExportComponent 
          personalStats={personalStats}
        />
      </div>
    </div>
  )
}

export default App

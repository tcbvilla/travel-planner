// API配置
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const API_ENDPOINTS = {
  // 认证相关
  LOGIN: `${API_BASE_URL}/auth/login`,
  VALIDATE: `${API_BASE_URL}/auth/validate`,
  
  // 考勤相关
  COMPARE: `${API_BASE_URL}/v1/attendance/compare`,
  SAVE_SESSION: `${API_BASE_URL}/v1/attendance/save-session`,
  SESSIONS: `${API_BASE_URL}/v1/attendance/sessions`,
  SESSION_DETAIL: (id: number) => `${API_BASE_URL}/v1/attendance/sessions/${id}`,
  UPDATE_SESSION: (id: number) => `${API_BASE_URL}/v1/attendance/sessions/${id}/update`,
  DELETE_SESSION: (id: number) => `${API_BASE_URL}/v1/attendance/sessions/${id}`,
  UPDATE_SESSION_STATUS: (id: number, status: string) => `${API_BASE_URL}/v1/attendance/sessions/${id}/status?status=${status}`,
  
  // 奖惩条件
  SAVE_REWARD_CONDITION: `${API_BASE_URL}/v1/attendance/save-reward-condition`,
  REWARD_CONDITIONS: (sessionId: number) => `${API_BASE_URL}/v1/attendance/reward-conditions/${sessionId}`,
  UPDATE_REWARD_CONDITION: (id: number) => `${API_BASE_URL}/v1/attendance/reward-conditions/${id}`,
  DELETE_REWARD_CONDITION: (id: number) => `${API_BASE_URL}/v1/attendance/reward-conditions/${id}`,
  
  // 赛季管理
  SEASONS: `${API_BASE_URL}/v1/attendance/seasons`,
  SEASON_DETAIL: (id: number) => `${API_BASE_URL}/v1/attendance/seasons/${id}`,
  DELETE_SEASON: (id: number) => `${API_BASE_URL}/v1/attendance/seasons/${id}`,
  UPDATE_SEASON: (id: number) => `${API_BASE_URL}/v1/attendance/seasons/${id}`,
  
  // 结算相关
  CALCULATE_SETTLEMENT: (sessionId: number) => `${API_BASE_URL}/v1/attendance/sessions/${sessionId}/calculate-settlement`,
  EXECUTE_SETTLEMENT: (sessionId: number) => `${API_BASE_URL}/v1/attendance/sessions/${sessionId}/execute-settlement`,
  REVOKE_SETTLEMENT: (sessionId: number) => `${API_BASE_URL}/v1/attendance/sessions/${sessionId}/revoke-settlement`,
  SETTLEMENT_LOGS: `${API_BASE_URL}/v1/attendance/settlement-logs`,
  
  // 统计相关
  STATISTICS_QUERY: `${API_BASE_URL}/v1/attendance/statistics/query`,
  TEAM_ATTENDANCE_RATE: `${API_BASE_URL}/v1/attendance/statistics/team-attendance-rate`,
  TEAM_CASH_SUMMARY: `${API_BASE_URL}/v1/attendance/statistics/team-cash-summary`,
  PERSONAL_SEARCH: `${API_BASE_URL}/v1/attendance/statistics/personal/search`,
  PERSONAL_STATS: `${API_BASE_URL}/v1/attendance/statistics/personal`,
  
  // 团队和成员管理
  TEAMS_ATTENDANCE: (sessionId: number) => `${API_BASE_URL}/v1/attendance/sessions/${sessionId}/teams-attendance`,
  MEMBERS_ATTENDANCE: (sessionId: number) => `${API_BASE_URL}/v1/attendance/sessions/${sessionId}/members-attendance`,
  
  // 手动奖惩
  MANUAL_REWARD: `${API_BASE_URL}/v1/attendance/settlement/manual`,
  MANUAL_REWARD_DELETE: (id: number) => `${API_BASE_URL}/v1/attendance/settlement/manual/${id}`,
  TEAMS: (seasonId: number) => `${API_BASE_URL}/v1/attendance/teams/${seasonId}`,
  
  // 配置相关
  BONUS_CONFIG: `${API_BASE_URL}/v1/attendance/bonus-config`,
  ATTENDANCE_TYPES: `${API_BASE_URL}/v1/attendance/attendance-types`,
  CODE_TABLES: `${API_BASE_URL}/v1/attendance/code-tables`,
  INIT_CODE_TABLES: `${API_BASE_URL}/v1/attendance/code-tables/init`,
  
  // 用户管理
  USERS: `${API_BASE_URL}/auth/users`,
  USERS_WITH_ROLES: `${API_BASE_URL}/auth/users/with-roles`,
  USER_DETAIL: (id: number) => `${API_BASE_URL}/auth/users/${id}`,
  CREATE_USER: `${API_BASE_URL}/auth/users`,
  UPDATE_USER: (id: number) => `${API_BASE_URL}/auth/users/${id}`,
  DELETE_USER: (id: number) => `${API_BASE_URL}/auth/users/${id}`,
  RESET_PASSWORD: (id: number) => `${API_BASE_URL}/auth/users/${id}/reset-password`,
  ASSIGN_ROLE: (id: number) => `${API_BASE_URL}/auth/users/${id}/assign-role`,
  REMOVE_ROLE: (id: number) => `${API_BASE_URL}/auth/users/${id}/remove-role`,
  
  // 角色管理
  ROLES: `${API_BASE_URL}/auth/roles`,
  ROLE_DETAIL: (id: number) => `${API_BASE_URL}/auth/roles/${id}`,
  CREATE_ROLE: `${API_BASE_URL}/auth/roles`,
  UPDATE_ROLE: (id: number) => `${API_BASE_URL}/auth/roles/${id}`,
  DELETE_ROLE: (id: number) => `${API_BASE_URL}/auth/roles/${id}`,
  ASSIGN_PERMISSION: (id: number) => `${API_BASE_URL}/auth/roles/${id}/assign-permission`,
  REMOVE_PERMISSION: (id: number) => `${API_BASE_URL}/auth/roles/${id}/remove-permission`,
  
  // 权限管理
  PERMISSIONS: `${API_BASE_URL}/auth/permissions`,
};

export default API_ENDPOINTS;


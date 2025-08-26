# 后端 API 规格（v1 草案）

## 上传与考勤
- POST /api/v1/snapshots: 上传CSV（起始/结束），返回 snapshotId
- POST /api/v1/attendance/runs: 创建考勤任务（入参：startSnapshotId, endSnapshotId, ruleSet, includedGroups, includedMembers）
- GET  /api/v1/attendance/runs/{runId}: 任务详情（包含统计）
- GET  /api/v1/attendance/runs/{runId}/export: 导出图片（结果+缺勤名单）

## 统计与榜单
- GET  /api/v1/leaderboard/season/{seasonId}: 赛季榜单（可选分组/成员维度）
- GET  /api/v1/leaderboard/season/{seasonId}/details: 明细（不可编辑）

## 奖惩与三消
- POST /api/v1/rewards/rules: 设置赛季规则
- POST /api/v1/rewards/records: 手动添加奖惩（直奖或瓣/豆/花/粪）
- GET  /api/v1/rewards/season/{seasonId}: 奖惩累计与当前奖金图表

## 系统
- GET  /api/v1/health: 健康检查

统一响应：{ code, message, data, timestamp, traceId }


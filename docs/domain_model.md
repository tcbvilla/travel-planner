# 领域模型与数据结构（草案）

## 核心实体
- Member 成员：{ id, nickname, group, active }
- Snapshot 快照：{ id, takenAt, seasonId, fileMeta }
- AttendanceRun 考勤任务：{ id, startSnapshotId, endSnapshotId, ruleSetId, includedGroups, includedMemberIds, createdAt }
- AttendanceEntry 考勤结果项：{ runId, memberId, group, startTotal, endTotal, increment, present(boolean), notes }
- GroupStat 分组统计：{ runId, group, totalIncrement, averageIncrement, presentRate }
- Season 赛季：{ id, name, startDate, endDate }
- PenaltyRewardRule 规则：阈值与奖惩映射定义
- PenaltyRewardRecord 奖惩记录：{ id, seasonId, memberId|group, type, value, reason, createdAt }
- PetalBeanFlower 粽（花/瓣/豆/花/粪）累计：{ seasonId, groupId, petals, flowers, beans, poop }

## 关系
- 一次 AttendanceRun 关联两份 Snapshot，产出多条 AttendanceEntry 和 GroupStat。
- 赛季维度归集 PenaltyRewardRecord 与三消累计。


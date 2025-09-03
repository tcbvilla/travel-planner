# 领域模型与数据结构

## 核心实体

### 基础管理
- **Season 赛季**: { id, name, startDate, endDate, status(未开始/进行中/已完结) }
- **AttendanceSession 考勤会话**: { id, name, startTime, endTime, battleResult, threshold, status(ADDED/SAVED/SETTLED), memberData, groupData, seasonId }

### 奖惩系统
- **RewardCondition 奖惩条件**: { id, attendanceSessionId, taskStatus, attendanceRateThreshold, attendanceRateRank, meritIncreaseRank, rewardType, penaltyType }
- **CodeTable 码表**: { id, codeName, codeValue, type(REWARD/PENALTY), description }
- **SettlementRecord 结算记录**: { id, teamName, codeValue, quantity, cashAmount, rewardMode(CODE_TABLE/CASH), settlementBatchId, attendanceSessionId, synthesisChainId, recordStatus(ACTIVE/SYNTHESIZED) }

### 合成机制
- **SynthesisChain 合成链**: { id, seasonId, teamName, sourceBatchIds, synthesisRecordIds, synthesisLogIds, synthesisType(UPGRADE/CASH_CONVERT), sourceItemType, targetItemType, triggerSettlementBatchId, attendanceSessionId }
- **SynthesisLog 合成日志**: { id, operationTime, teamName, seasonName, synthesisType, sourceItems, targetItem, synthesisContent, synthesisChainId }

### 日志记录
- **SettlementLog 结算日志**: { id, attendanceRecordName, settlementSeason, settlementContent, attendanceSessionId, operationTime }

## 核心关系

### 考勤流程
1. **Season** → **AttendanceSession** (一对多)
2. **AttendanceSession** → **RewardCondition** (一对多)
3. **AttendanceSession** → **SettlementRecord** (一对多)

### 结算流程
1. **SettlementRecord** 通过 `settlementBatchId` 关联到特定的奖惩条件组合
2. **SettlementRecord** 通过 `attendanceSessionId` 关联到考勤会话
3. **SettlementRecord** 通过 `synthesisChainId` 关联到合成链（如果参与合成）

### 合成流程
1. **SynthesisChain** 记录合成操作的完整链路
2. **SynthesisChain** 通过 `triggerSettlementBatchId` 关联到触发的结算批次
3. **SynthesisChain** 通过 `attendanceSessionId` 关联到考勤会话

## 数据流

### 考勤 → 结算 → 合成
1. 创建考勤会话，设置奖惩条件
2. 执行结算，生成结算记录
3. 自动检查合成条件，执行合成操作
4. 记录合成链和日志

### 撤销流程
1. 撤销结算时，级联撤销相关的合成操作
2. 恢复原始记录状态
3. 记录撤销日志

## 状态管理

### 考勤会话状态
- **ADDED**: 已添加，可编辑奖惩条件和调整考勤状态
- **SAVED**: 已保存，可执行结算
- **SETTLED**: 已结算，只能撤销结算

### 结算记录状态
- **ACTIVE**: 活跃状态，参与合成计算
- **SYNTHESIZED**: 已合成，不参与后续合成


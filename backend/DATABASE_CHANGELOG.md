# 数据库变更日志 (Database Changelog)

## 概述

本项目使用 **Liquibase** 进行数据库版本管理，确保数据库结构变更的可追溯性和一致性。所有数据库变更都记录在 XML 格式的变更日志文件中。

## 变更记录

### V004 - 考勤类型支持 (2025-01-01)
**变更集**: `004-attendance-type.xml`

#### 新增功能
- ✅ 为考勤会话添加类型分类功能
- ✅ 支持预定义类型：压秒考勤、区间战功考勤、区间助攻考勤、晨练考勤、夜战考勤
- ✅ 支持"其他"类型的自定义输入
- ✅ 在添加和编辑考勤时可选择/修改类型

#### 数据库变更
- **新增字段**:
  - `attendance_sessions.attendance_type` (VARCHAR(50)) - 考勤类型，默认为"压秒考勤"
- **新增索引**:
  - `idx_attendance_sessions_type` - 考勤类型索引，提高查询性能
- **新增注释**:
  - 为考勤类型字段添加详细说明

#### 前端变更
- **添加考勤页面**: 新增考勤类型选择器，支持下拉选择和自定义输入
- **查看考勤记录页面**: 表格中显示考勤类型列，编辑模式支持修改类型
- **类型定义**: 更新TypeScript类型定义，添加attendanceType字段

#### 后端变更
- **实体类**: AttendanceSession添加attendanceType字段
- **请求类**: SaveSessionRequest添加attendanceType字段
- **控制器**: 保存和更新接口支持考勤类型的处理

### V003 - 现金奖励支持 (2025-01-01)
**变更集**: `003-cash-rewards.xml`

#### 新增功能
- ✅ 添加现金奖励/惩罚支持
- ✅ 支持码表奖励和现金奖励的互斥选择
- ✅ 添加"双"前缀的奖励/惩罚类型

#### 数据库变更
- **新增字段**:
  - `settlement_records.cash_amount` (NUMERIC(10,2)) - 现金金额
  - `settlement_records.reward_mode` (VARCHAR(20)) - 奖励模式
- **新增索引**:
  - `idx_settlement_records_reward_mode` - 奖励模式索引
  - `idx_settlement_records_cash_amount` - 现金金额索引
- **新增约束**:
  - `chk_cash_reward_mode` - 确保现金奖励和码表奖励互斥
- **新增视图**:
  - `active_settlement_records` - 活跃结算记录视图
- **新增函数**:
  - `get_team_items_summary()` - 获取团队物品汇总
- **码表更新**:
  - 新增: "双花瓣", "双花", "双屎粒", "双屎"

#### 影响范围
- 结算记录表结构变更
- 奖惩类型选择逻辑变更
- 前端UI需要支持现金输入

---

### V002 - 合成机制 (2025-01-01)
**变更集**: `002-synthesis-tables.xml`

#### 新增功能
- ✅ 花瓣 → 花 自动合成
- ✅ 花 → 648元现金 自动合成
- ✅ 屎粒 → 屎 自动合成
- ✅ 屎 → -648元现金 自动合成
- ✅ 级联撤销机制

#### 数据库变更
- **新增表**:
  - `synthesis_chains` - 合成链记录表
  - `synthesis_logs` - 合成操作日志表
- **新增字段**:
  - `settlement_records.synthesis_chain_id` - 合成链关联
  - `settlement_records.is_synthetic` - 是否合成记录
  - `settlement_records.parent_synthesis_id` - 父合成记录ID
  - `settlement_records.record_status` - 记录状态
- **新增索引**:
  - 合成链相关索引
  - 记录状态索引
- **新增外键约束**:
  - 合成链与赛季、考勤会话的关联

#### 影响范围
- 结算后自动触发合成检查
- 撤销结算时级联撤销合成操作
- 合成操作记录完整的操作链路

---

### V001 - 初始架构 (2025-01-01)
**变更集**: `001-initial-schema.xml`

#### 基础功能
- ✅ 赛季管理
- ✅ 考勤会话管理
- ✅ 奖惩条件设置
- ✅ 结算记录存储
- ✅ 结算日志记录

#### 数据库变更
- **核心表**:
  - `seasons` - 赛季表
  - `attendance_sessions` - 考勤会话表
  - `reward_conditions` - 奖惩条件表
  - `code_tables` - 码表
  - `settlement_records` - 结算记录表
  - `settlement_logs` - 结算日志表
- **基础索引**: 所有核心查询索引
- **基础函数**: 统计和查询辅助函数
- **基础视图**: 赛季状态视图
- **初始数据**: 示例赛季和基础码表

#### 影响范围
- 完整的考勤系统基础架构
- 支持基本的奖惩结算功能

---

## 部署指南

### 新环境部署
```bash
# 1. 创建数据库
createdb game_attendance

# 2. 启动应用（Liquibase会自动执行所有变更集）
./mvnw spring-boot:run
```

### 现有环境升级
```bash
# 1. 备份数据库
pg_dump game_attendance > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 启动应用（Liquibase会自动执行未应用的变更集）
./mvnw spring-boot:run
```

### 手动执行变更
```bash
# 查看变更状态
./mvnw liquibase:status

# 执行变更
./mvnw liquibase:update

# 验证变更
./mvnw liquibase:validate
```

## 创建新的变更集

### 1. 命名规范
- **文件格式**: `{序号}-{功能描述}.xml`
- **序号**: 递增整数，从下一个可用序号开始
- **描述**: 简洁的功能描述，使用连字符分隔

### 2. 示例
```bash
# 创建新的变更集文件
touch src/main/resources/db/changelog/changesets/004-add-user-management.xml
```

### 3. 编写变更集
```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

    <changeSet id="004-001" author="dev-team">
        <comment>创建用户表</comment>
        <createTable tableName="users">
            <column name="id" type="BIGSERIAL">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="username" type="VARCHAR(50)">
                <constraints nullable="false" unique="true"/>
            </column>
            <column name="email" type="VARCHAR(100)">
                <constraints nullable="false" unique="true"/>
            </column>
            <column name="created_at" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP"/>
        </createTable>
    </changeSet>

</databaseChangeLog>
```

### 4. 更新主变更日志
```xml
<!-- 在 db.changelog-master.xml 中添加 -->
<include file="db/changelog/changesets/004-add-user-management.xml" relativeToChangelogFile="true"/>
```

## 最佳实践

### 1. 变更集编写
- **幂等性**: 变更集可以重复执行而不出错
- **原子性**: 每个变更集是一个完整的功能单元
- **可读性**: 添加详细的注释说明
- **测试**: 在测试环境充分验证

### 2. 部署流程
1. **开发环境**: 在本机测试变更集
2. **测试环境**: 在测试环境验证变更效果
3. **生产环境**: 备份后执行变更
4. **监控**: 部署后监控应用运行状态

### 3. 数据迁移
- **结构变更**: 优先使用 `createTable`、`addColumn` 等标签
- **数据迁移**: 使用 `insert`、`update` 标签
- **数据清理**: 使用 `delete` 标签清理无效数据
- **性能考虑**: 大表变更时考虑分批处理

## 常见问题

### Q: 如何回滚变更？
A: Liquibase 支持回滚，但需要预先定义回滚脚本：
```xml
<changeSet id="004-001" author="dev-team">
    <createTable tableName="users">
        <!-- 表结构 -->
    </createTable>
    <rollback>
        <dropTable tableName="users"/>
    </rollback>
</changeSet>
```

### Q: 变更失败怎么办？
A: 检查变更集语法，修复后重新执行：
```bash
./mvnw liquibase:update
```

### Q: 如何跳过某个变更集？
A: 不推荐跳过变更集，如果必须跳过：
1. 手动标记变更集为已执行
2. 在后续变更集中处理相关问题

## 环境配置

### 开发环境
```yaml
spring:
  liquibase:
    enabled: true
    drop-first: false  # 开发环境可以设置为true进行测试
```

### 生产环境
```yaml
spring:
  liquibase:
    enabled: true
    drop-first: false   # 生产环境必须为false
    contexts: default
```

## 监控和维护

### 1. 变更历史表
Liquibase 会自动创建 `databasechangelog` 和 `databasechangeloglock` 表记录变更历史。

### 2. 定期检查
```sql
-- 查看变更历史
SELECT * FROM databasechangelog ORDER BY dateexecuted DESC;

-- 检查数据库结构一致性
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. 备份策略
- **变更前**: 必须备份数据库
- **变更后**: 验证数据完整性
- **定期备份**: 建议每日备份

## 联系信息

如有数据库变更相关问题，请联系开发团队。

---

**最后更新**: 2025-01-01  
**维护者**: 开发团队
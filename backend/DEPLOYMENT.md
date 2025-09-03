# 游戏考勤系统部署说明

## 数据库管理

### 1. 数据库初始化

#### 方法一：使用初始化脚本（推荐）
```bash
# 连接到PostgreSQL
psql -h localhost -U postgres

# 创建数据库（如果不存在）
CREATE DATABASE game_attendance;

# 连接到数据库
\c game_attendance

# 执行初始化脚本
\i database_init.sql
```

#### 方法二：使用Hibernate自动创建（开发环境）
在`application.yml`中设置：
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: create-drop  # 每次启动重新创建表（仅开发环境）
```

### 2. 数据库迁移策略

#### 当前状态
- 使用`hibernate.ddl-auto: update`模式
- Hibernate会自动更新数据库结构
- 适合开发环境，生产环境建议使用数据库迁移工具

#### 生产环境建议
1. **使用Flyway或Liquibase**进行数据库版本管理
2. **备份现有数据**后再进行迁移
3. **测试环境验证**后再部署到生产环境

### 3. 数据库结构变更处理

#### 新增字段
- Hibernate会自动添加新字段
- 现有数据的新字段会使用默认值

#### 删除字段
- 需要手动处理，Hibernate不会自动删除字段
- 使用SQL脚本删除不需要的字段

#### 修改字段类型
- 需要手动处理，可能存在数据转换问题
- 建议先备份数据，再执行修改

#### 最新变更（2025年）
- 新增 `settlement_records.cash_amount` 和 `reward_mode` 字段
- 新增 `synthesis_chains.trigger_settlement_batch_id` 和 `attendance_session_id` 字段
- 新增合成相关表：`synthesis_chains`、`synthesis_logs`
- 更新码表数据：移除"钱袋"和"粪汤"，所有码表值设为0

### 4. 部署步骤

#### 开发环境
```bash
# 1. 启动PostgreSQL
brew services start postgresql

# 2. 创建数据库（如果不存在）
createdb game_attendance

# 3. 执行初始化脚本
psql -h localhost -U postgres -d game_attendance -f database_init.sql

# 4. 启动后端服务
cd backend
./mvnw spring-boot:run
```

#### 生产环境
```bash
# 1. 备份现有数据库
pg_dump -h localhost -U postgres game_attendance > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行数据库迁移脚本
psql -h localhost -U postgres -d game_attendance -f database_init.sql

# 3. 部署应用
# 使用Docker或直接部署jar文件
```

### 5. 数据库维护

#### 定期备份
```bash
# 创建备份脚本
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres game_attendance > $BACKUP_DIR/backup_$DATE.sql
```

#### 数据清理
```sql
-- 清理过期的结算记录（保留最近3个月）
DELETE FROM settlement_records 
WHERE created_at < CURRENT_DATE - INTERVAL '3 months';

-- 清理过期的日志记录（保留最近6个月）
DELETE FROM settlement_logs 
WHERE operation_time < CURRENT_DATE - INTERVAL '6 months';

-- 清理过期的合成记录（保留最近6个月）
DELETE FROM synthesis_chains 
WHERE created_at < CURRENT_DATE - INTERVAL '6 months';

-- 清理过期的合成日志（保留最近6个月）
DELETE FROM synthesis_logs 
WHERE operation_time < CURRENT_DATE - INTERVAL '6 months';
```

#### 合成机制维护
```sql
-- 检查孤立的合成记录
SELECT 
    'synthesis_chains' as table_name,
    COUNT(*) as orphaned_records
FROM synthesis_chains sc
LEFT JOIN seasons s ON sc.season_id = s.id
WHERE s.id IS NULL;

-- 检查结算记录状态一致性
SELECT 
    record_status,
    COUNT(*) as count
FROM settlement_records 
GROUP BY record_status;

-- 清理无效的合成链
DELETE FROM synthesis_chains 
WHERE season_id NOT IN (SELECT id FROM seasons);
```

### 6. 故障恢复

#### 数据库损坏恢复
```bash
# 1. 停止应用
# 2. 恢复备份
psql -h localhost -U postgres -d game_attendance < backup_20250829_120000.sql
# 3. 重启应用
```

#### 数据不一致修复
```sql
-- 检查并修复外键约束
SELECT 
    'settlement_records' as table_name,
    COUNT(*) as orphaned_records
FROM settlement_records sr
LEFT JOIN attendance_sessions as1 ON sr.attendance_session_id = as1.id
WHERE as1.id IS NULL;

-- 删除孤立的记录
DELETE FROM settlement_records 
WHERE attendance_session_id NOT IN (SELECT id FROM attendance_sessions);
```

### 7. 性能优化

#### 索引优化
```sql
-- 分析查询性能
EXPLAIN ANALYZE SELECT * FROM settlement_records WHERE attendance_session_id = 1;

-- 创建复合索引
CREATE INDEX idx_settlement_records_session_team ON settlement_records(attendance_session_id, team_name);
```

#### 分区表（大数据量时）
```sql
-- 按时间分区结算记录表
CREATE TABLE settlement_records_2025_01 PARTITION OF settlement_records
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 8. 监控和日志

#### 数据库监控
```sql
-- 查看表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看慢查询
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## 注意事项

1. **备份策略**：定期备份数据库，建议每日备份
2. **版本控制**：数据库结构变更要有版本记录
3. **测试环境**：生产环境变更前先在测试环境验证
4. **回滚计划**：准备数据库回滚脚本
5. **监控告警**：设置数据库性能监控和告警

## 联系信息

如有问题，请联系开发团队。

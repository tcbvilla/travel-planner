# 数据库迁移使用指南

## 概述

本项目使用 **Flyway** 进行数据库版本管理，确保数据库结构变更的可追溯性和一致性。

## 快速开始

### 新环境部署
```bash
# 1. 创建数据库
createdb game_attendance

# 2. 启动应用（Flyway会自动执行所有迁移）
./mvnw spring-boot:run
```

### 现有环境升级
```bash
# 1. 备份数据库
pg_dump game_attendance > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 启动应用（Flyway会自动执行未应用的迁移）
./mvnw spring-boot:run
```

## Flyway 命令

### 查看迁移状态
```bash
./mvnw flyway:info
```

### 执行迁移
```bash
./mvnw flyway:migrate
```

### 验证迁移
```bash
./mvnw flyway:validate
```

### 清理数据库（仅开发环境）
```bash
./mvnw flyway:clean
```

## 创建新的迁移脚本

### 1. 命名规范
- **格式**: `V{版本号}__{描述}.sql`
- **版本号**: 递增整数，从下一个可用版本开始
- **描述**: 简洁的功能描述，使用下划线分隔

### 2. 示例
```bash
# 创建新的迁移文件
touch src/main/resources/db/migration/V4__Add_user_management.sql
```

### 3. 编写迁移脚本
```sql
-- =============================================
-- Flyway Migration: V4__Add_user_management.sql
-- 描述: 添加用户管理功能
-- 创建时间: 2025-01-01
-- 作者: 开发团队
-- =============================================

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## 最佳实践

### 1. 迁移脚本编写
- **幂等性**: 脚本可以重复执行而不出错
- **原子性**: 每个迁移脚本是一个完整的功能单元
- **可读性**: 添加详细的注释说明
- **测试**: 在测试环境充分验证

### 2. 部署流程
1. **开发环境**: 在本机测试迁移脚本
2. **测试环境**: 在测试环境验证迁移效果
3. **生产环境**: 备份后执行迁移
4. **监控**: 部署后监控应用运行状态

### 3. 数据迁移
- **结构变更**: 优先使用 `ALTER TABLE`
- **数据迁移**: 使用 `INSERT/UPDATE` 语句
- **数据清理**: 使用 `DELETE` 语句清理无效数据
- **性能考虑**: 大表变更时考虑分批处理

## 常见问题

### Q: 如何回滚迁移？
A: Flyway 不支持自动回滚，需要手动处理：
1. 恢复数据库备份
2. 或者手动执行回滚SQL脚本

### Q: 迁移失败怎么办？
A: 检查迁移脚本语法，修复后重新执行：
```bash
./mvnw flyway:repair
./mvnw flyway:migrate
```

### Q: 如何跳过某个迁移？
A: 不推荐跳过迁移，如果必须跳过：
1. 手动标记迁移为已执行
2. 在后续迁移中处理相关问题

## 环境配置

### 开发环境
```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    clean-disabled: false  # 开发环境允许clean
```

### 生产环境
```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    clean-disabled: true   # 生产环境禁用clean
    validate-on-migrate: true
```

## 监控和维护

### 1. 迁移历史表
Flyway 会自动创建 `flyway_schema_history` 表记录迁移历史。

### 2. 定期检查
```sql
-- 查看迁移历史
SELECT * FROM flyway_schema_history ORDER BY installed_rank;

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
- **迁移前**: 必须备份数据库
- **迁移后**: 验证数据完整性
- **定期备份**: 建议每日备份

## 联系信息

如有数据库迁移相关问题，请联系开发团队。

---

**最后更新**: 2025-01-01  
**维护者**: 开发团队

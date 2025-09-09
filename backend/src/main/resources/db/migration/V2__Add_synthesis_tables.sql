-- =============================================
-- Flyway Migration: V2__Add_synthesis_tables.sql
-- 描述: 添加合成机制相关表和字段
-- 创建时间: 2025-01-01
-- 作者: 开发团队
-- =============================================

-- 1. 创建合成链表
CREATE TABLE IF NOT EXISTS synthesis_chains (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    source_batch_ids TEXT NOT NULL,        -- 原始批次ID列表 (JSON数组)
    synthesis_record_ids TEXT NOT NULL,    -- 合成记录ID列表 (JSON数组)
    synthesis_log_ids TEXT NOT NULL,       -- 合成日志ID列表 (JSON数组)
    synthesis_type VARCHAR(20) NOT NULL,   -- 'UPGRADE' 或 'CASH_CONVERT'
    source_item_type VARCHAR(50),          -- 原始物品类型
    target_item_type VARCHAR(50),          -- 目标物品类型
    trigger_settlement_batch_id VARCHAR(100),  -- 触发合成的结算批次ID
    attendance_session_id BIGINT,          -- 关联的考勤会话ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建合成日志表
CREATE TABLE IF NOT EXISTS synthesis_logs (
    id BIGSERIAL PRIMARY KEY,
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    team_name VARCHAR(100) NOT NULL,
    season_name VARCHAR(100) NOT NULL,
    synthesis_type VARCHAR(20) NOT NULL,   -- 'UPGRADE' 或 'CASH_CONVERT'
    source_items TEXT NOT NULL,            -- 被合成的原始物品JSON
    target_item TEXT NOT NULL,             -- 合成后的物品JSON
    synthesis_content TEXT NOT NULL,       -- 合成描述
    synthesis_chain_id BIGINT              -- 关联的合成链ID
);

-- 3. 为settlement_records表添加合成相关字段
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS synthesis_chain_id BIGINT;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS parent_synthesis_id BIGINT;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS record_status VARCHAR(20) DEFAULT 'ACTIVE';

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_season_team ON synthesis_chains(season_id, team_name);
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_trigger_batch ON synthesis_chains(trigger_settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_attendance_session ON synthesis_chains(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_logs_season_team ON synthesis_logs(season_name, team_name);
CREATE INDEX IF NOT EXISTS idx_settlement_records_synthesis ON settlement_records(synthesis_chain_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_status ON settlement_records(record_status);

-- 5. 添加外键约束
ALTER TABLE synthesis_chains ADD CONSTRAINT fk_synthesis_chains_season 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;

ALTER TABLE synthesis_chains ADD CONSTRAINT fk_synthesis_chains_attendance_session 
    FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE SET NULL;

ALTER TABLE synthesis_logs ADD CONSTRAINT fk_synthesis_logs_chain 
    FOREIGN KEY (synthesis_chain_id) REFERENCES synthesis_chains(id) ON DELETE SET NULL;

ALTER TABLE settlement_records ADD CONSTRAINT fk_settlement_records_synthesis_chain 
    FOREIGN KEY (synthesis_chain_id) REFERENCES synthesis_chains(id) ON DELETE SET NULL;

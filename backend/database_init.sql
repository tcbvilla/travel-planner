-- 游戏考勤系统数据库初始化脚本
-- 创建时间: 2025-08-29
-- 版本: 1.0

-- 创建数据库（如果不存在）
-- CREATE DATABASE game_attendance;

-- 连接到数据库
-- \c game_attendance;

-- 1. 创建赛季表
CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建考勤会话表
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    battle_result VARCHAR(20) NOT NULL,
    threshold INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ADDED',
    member_data TEXT,
    group_data TEXT,
    season_id BIGINT REFERENCES seasons(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建奖惩条件表
CREATE TABLE IF NOT EXISTS reward_conditions (
    id BIGSERIAL PRIMARY KEY,
    attendance_session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    task_status VARCHAR(20) NOT NULL,
    attendance_rate_threshold DOUBLE PRECISION,
    attendance_rate_rank INTEGER,
    merit_increase_rank INTEGER,
    reward_type VARCHAR(50),
    penalty_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建码表
CREATE TABLE IF NOT EXISTS code_tables (
    id BIGSERIAL PRIMARY KEY,
    code_name VARCHAR(50) NOT NULL UNIQUE,
    code_value INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    description VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 创建结算记录表（新结构）
CREATE TABLE IF NOT EXISTS settlement_records (
    id BIGSERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    code_value VARCHAR(50),  -- 允许NULL，用于现金奖励
    quantity NUMERIC(10,3) NOT NULL,  -- 数量，保留3位小数
    cash_amount NUMERIC(10,2),  -- 现金金额，用于现金奖励
    reward_mode VARCHAR(20) DEFAULT 'CODE_TABLE',  -- 奖励模式：CODE_TABLE 或 CASH
    settlement_batch_id VARCHAR(100) NOT NULL,  -- 结算批次ID，用于关联特定的奖惩条件组合
    attendance_session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 创建结算日志表
CREATE TABLE IF NOT EXISTS settlement_logs (
    id BIGSERIAL PRIMARY KEY,
    attendance_record_name VARCHAR(200) NOT NULL,
    settlement_season VARCHAR(100) NOT NULL,
    settlement_content TEXT NOT NULL,
    attendance_session_id BIGINT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_season_id ON attendance_sessions(season_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_reward_conditions_session_id ON reward_conditions(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_session_id ON settlement_records(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_batch_id ON settlement_records(settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_session_id ON settlement_logs(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_code_tables_type ON code_tables(type);

-- 插入初始码表数据
INSERT INTO code_tables (code_name, code_value, type, description) VALUES
-- 奖励码表
('花瓣', 0, 'REWARD', '花瓣奖励'),
('花', 0, 'REWARD', '花奖励'),
-- 处罚码表
('屎粒', 0, 'PENALTY', '屎粒处罚'),
('屎', 0, 'PENALTY', '屎处罚')
ON CONFLICT (code_name) DO NOTHING;

-- 插入示例赛季数据
INSERT INTO seasons (name, start_date, end_date) VALUES
('2025年第一赛季', '2025-01-01', '2025-03-31'),
('2025年第二赛季', '2025-04-01', '2025-06-30'),
('2025年第三赛季', '2025-07-01', '2025-09-30'),
('2025年第四赛季', '2025-10-01', '2025-12-31')
ON CONFLICT (name) DO NOTHING;

-- 创建视图：赛季状态视图
CREATE OR REPLACE VIEW season_status_view AS
SELECT 
    id,
    name,
    start_date,
    end_date,
    CASE 
        WHEN CURRENT_DATE < start_date THEN '未开始'
        WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN '进行中'
        ELSE '已完结'
    END as status,
    created_at,
    updated_at
FROM seasons;

-- 创建函数：更新updated_at时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reward_conditions_updated_at BEFORE UPDATE ON reward_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_tables_updated_at BEFORE UPDATE ON code_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：统计赛季关联的考勤记录数量
CREATE OR REPLACE FUNCTION count_attendance_sessions_by_season(season_id_param BIGINT)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM attendance_sessions 
        WHERE season_id = season_id_param
    );
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取结算记录统计
CREATE OR REPLACE FUNCTION get_settlement_stats(attendance_session_id_param BIGINT)
RETURNS TABLE (
    team_name VARCHAR(100),
    code_value VARCHAR(50),
    total_quantity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.team_name,
        sr.code_value,
        SUM(sr.quantity) as total_quantity
    FROM settlement_records sr
    WHERE sr.attendance_session_id = attendance_session_id_param
    GROUP BY sr.team_name, sr.code_value
    ORDER BY sr.team_name, sr.code_value;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建合成链表
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

-- 8. 创建合成日志表
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

-- 为settlement_records表添加合成相关字段
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS synthesis_chain_id BIGINT;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS parent_synthesis_id BIGINT;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS record_status VARCHAR(20) DEFAULT 'ACTIVE';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_season_team ON synthesis_chains(season_id, team_name);
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_trigger_batch ON synthesis_chains(trigger_settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_chains_attendance_session ON synthesis_chains(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_logs_season_team ON synthesis_logs(season_name, team_name);
CREATE INDEX IF NOT EXISTS idx_settlement_records_synthesis ON settlement_records(synthesis_chain_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_status ON settlement_records(record_status);
CREATE INDEX IF NOT EXISTS idx_settlement_records_reward_mode ON settlement_records(reward_mode);

-- 提交事务
COMMIT;

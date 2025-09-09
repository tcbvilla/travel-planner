-- =============================================
-- Flyway Migration: V3__Add_cash_rewards.sql
-- 描述: 添加现金奖励/惩罚支持
-- 创建时间: 2025-01-01
-- 作者: 开发团队
-- =============================================

-- 1. 为settlement_records表添加现金相关字段
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2);  -- 现金金额，用于现金奖励
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS reward_mode VARCHAR(20) DEFAULT 'CODE_TABLE';  -- 奖励模式：CODE_TABLE 或 CASH

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_records_reward_mode ON settlement_records(reward_mode);
CREATE INDEX IF NOT EXISTS idx_settlement_records_cash_amount ON settlement_records(cash_amount);

-- 3. 更新码表数据：移除"钱袋"和"粪汤"，添加"双"前缀类型
-- 删除旧的码表项
DELETE FROM code_tables WHERE code_name IN ('钱袋', '粪汤');

-- 添加"双"前缀的码表项
INSERT INTO code_tables (code_name, code_value, type, description) VALUES
-- 双奖励码表
('双花瓣', 0, 'REWARD', '双花瓣奖励'),
('双花', 0, 'REWARD', '双花奖励'),
-- 双处罚码表
('双屎粒', 0, 'PENALTY', '双屎粒处罚'),
('双屎', 0, 'PENALTY', '双屎处罚')
ON CONFLICT (code_name) DO NOTHING;

-- 4. 添加约束：确保现金奖励和码表奖励互斥
-- 创建检查约束：如果reward_mode是CASH，则cash_amount不能为NULL
ALTER TABLE settlement_records ADD CONSTRAINT chk_cash_reward_mode 
    CHECK (
        (reward_mode = 'CASH' AND cash_amount IS NOT NULL) OR 
        (reward_mode = 'CODE_TABLE' AND code_value IS NOT NULL)
    );

-- 5. 创建视图：活跃的结算记录（用于合成计算）
CREATE OR REPLACE VIEW active_settlement_records AS
SELECT 
    sr.*,
    s.name as season_name,
    as1.name as attendance_session_name
FROM settlement_records sr
LEFT JOIN attendance_sessions as1 ON sr.attendance_session_id = as1.id
LEFT JOIN seasons s ON as1.season_id = s.id
WHERE sr.record_status = 'ACTIVE';

-- 6. 创建函数：获取团队当前活跃物品汇总
CREATE OR REPLACE FUNCTION get_team_items_summary(season_id_param BIGINT)
RETURNS TABLE (
    team_name VARCHAR(100),
    item_type VARCHAR(50),
    total_quantity NUMERIC(10,3),
    total_cash NUMERIC(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.team_name,
        COALESCE(sr.code_value, '现金') as item_type,
        SUM(sr.quantity) as total_quantity,
        SUM(COALESCE(sr.cash_amount, 0)) as total_cash
    FROM settlement_records sr
    LEFT JOIN attendance_sessions as1 ON sr.attendance_session_id = as1.id
    WHERE as1.season_id = season_id_param 
        AND sr.record_status = 'ACTIVE'
    GROUP BY sr.team_name, COALESCE(sr.code_value, '现金')
    ORDER BY sr.team_name, item_type;
END;
$$ LANGUAGE plpgsql;

-- 更新 settlement_records 表结构
-- 删除旧字段并添加新字段

-- 先删除现有的结算记录（如果有的话）
DELETE FROM settlement_records;

-- 删除旧字段
ALTER TABLE settlement_records DROP COLUMN IF EXISTS reward_description;
ALTER TABLE settlement_records DROP COLUMN IF EXISTS amount;
ALTER TABLE settlement_records DROP COLUMN IF EXISTS reward_type;
ALTER TABLE settlement_records DROP COLUMN IF EXISTS multiplier;
ALTER TABLE settlement_records DROP COLUMN IF EXISTS season_id;

-- 添加新字段
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS code_value VARCHAR(50) NOT NULL;
ALTER TABLE settlement_records ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION NOT NULL;

-- 确保字段类型正确
ALTER TABLE settlement_records ALTER COLUMN team_name TYPE VARCHAR(100);
ALTER TABLE settlement_records ALTER COLUMN created_at TYPE TIMESTAMP;

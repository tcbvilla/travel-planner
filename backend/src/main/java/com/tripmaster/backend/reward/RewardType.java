package com.tripmaster.backend.reward;

public enum RewardType {
    // 奖励类型
    ATTENDANCE_BONUS("出勤奖励"),
    MERIT_BONUS("战功奖励"),
    GROUP_BONUS("小组奖励"),
    SPECIAL_BONUS("特殊奖励"),
    
    // 惩罚类型
    ABSENCE_PENALTY("缺勤惩罚"),
    LOW_MERIT_PENALTY("战功不足惩罚"),
    GROUP_PENALTY("小组惩罚"),
    SPECIAL_PENALTY("特殊惩罚");
    
    private final String description;
    
    RewardType(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}

package com.tripmaster.backend.attendance;

import lombok.Data;

@Data
public class GroupStat {
    private String group;
    private long totalMeritIncrease;
    private long averageMeritIncrease;
    private long averageMeritIncreaseBonus; // 人均战功增量（加成后）
    private long totalAssistIncrease; // 总助攻增量
    private long averageAssistIncrease; // 人均助攻增量
    private double attendanceRate;
    private int memberCount;
    private int attendedCount; // 达标人数
}

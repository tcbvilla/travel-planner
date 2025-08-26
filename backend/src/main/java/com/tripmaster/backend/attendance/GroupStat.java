package com.tripmaster.backend.attendance;

import lombok.Data;

@Data
public class GroupStat {
    private String group;
    private long totalMeritIncrease;
    private long averageMeritIncrease;
    private double attendanceRate;
    private int memberCount;
    private int attendedCount; // 达标人数
}

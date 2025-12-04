package com.tripmaster.backend.attendance;

import lombok.Data;

@Data
public class TeamRankingData {
    private Integer rank;              // 排名
    private String teamName;           // 团队名称
    private double averageAttendanceRate; // 平均出勤率（加成后）
    private int totalSessions;         // 参与考勤次数
    
    public TeamRankingData(String teamName) {
        this.teamName = teamName;
        this.averageAttendanceRate = 0.0;
        this.totalSessions = 0;
    }
}


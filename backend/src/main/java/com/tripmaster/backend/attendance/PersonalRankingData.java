package com.tripmaster.backend.attendance;

import lombok.Data;

@Data
public class PersonalRankingData {
    private Integer rank;              // 排名
    private String memberName;         // 人员姓名
    private int attendedSessions;      // 参与考勤次数（应参与考勤次数）
    private int qualifiedSessions;     // 实际出勤次数（达标次数）
    private double attendanceRate;     // 出勤率 = 实际出勤次数 / 参与考勤次数
    
    public PersonalRankingData(String memberName) {
        this.memberName = memberName;
        this.attendedSessions = 0;
        this.qualifiedSessions = 0;
        this.attendanceRate = 0.0;
    }
}


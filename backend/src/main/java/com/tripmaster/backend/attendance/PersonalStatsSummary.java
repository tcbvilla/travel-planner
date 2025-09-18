package com.tripmaster.backend.attendance;

import lombok.Data;
import java.util.List;

@Data
public class PersonalStatsSummary {
    private String memberName;
    private String timeRange;
    private String attendanceType;
    private int totalSessions;        // 总考勤次数
    private int attendedSessions;     // 参加考勤次数
    private int absentSessions;       // 缺勤次数
    private double attendanceRate;    // 出勤率
    private List<PersonalAttendanceRecord> records; // 详细记录列表
    
    public PersonalStatsSummary() {
        this.totalSessions = 0;
        this.attendedSessions = 0;
        this.absentSessions = 0;
        this.attendanceRate = 0.0;
    }
    
    public void calculateAttendanceRate() {
        if (attendedSessions > 0) {
            // 出勤率 = 出勤次数 / 参加考勤次数
            int qualifiedSessions = records != null ? (int) records.stream().filter(r -> r.getIsQualified()).count() : 0;
            this.attendanceRate = (double) qualifiedSessions / attendedSessions * 100.0;
            this.attendanceRate = Math.round(this.attendanceRate * 100.0) / 100.0;
        } else {
            this.attendanceRate = 0.0;
        }
    }
}

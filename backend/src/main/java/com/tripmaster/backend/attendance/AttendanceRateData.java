package com.tripmaster.backend.attendance;

import java.time.LocalDateTime;

public class AttendanceRateData {
    private String date;             // 考勤日期
    private LocalDateTime startTime; // 考勤开始时间
    private LocalDateTime endTime;   // 考勤结束时间
    private double attendanceRate;   // 原始出勤率
    private double bonusRate;        // 加成后出勤率
    private int memberCount;         // 团队人数
    private boolean bonusApplied;    // 是否应用了加成
    private String bonusDescription; // 加成描述

    // Constructors
    public AttendanceRateData() {}

    public AttendanceRateData(String date, LocalDateTime startTime, LocalDateTime endTime, 
                             double attendanceRate, double bonusRate, int memberCount, 
                             boolean bonusApplied, String bonusDescription) {
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.attendanceRate = attendanceRate;
        this.bonusRate = bonusRate;
        this.memberCount = memberCount;
        this.bonusApplied = bonusApplied;
        this.bonusDescription = bonusDescription;
    }

    // Getters
    public String getDate() { return date; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public double getAttendanceRate() { return attendanceRate; }
    public double getBonusRate() { return bonusRate; }
    public int getMemberCount() { return memberCount; }
    public boolean isBonusApplied() { return bonusApplied; }
    public String getBonusDescription() { return bonusDescription; }

    // Setters
    public void setDate(String date) { this.date = date; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public void setAttendanceRate(double attendanceRate) { this.attendanceRate = attendanceRate; }
    public void setBonusRate(double bonusRate) { this.bonusRate = bonusRate; }
    public void setMemberCount(int memberCount) { this.memberCount = memberCount; }
    public void setBonusApplied(boolean bonusApplied) { this.bonusApplied = bonusApplied; }
    public void setBonusDescription(String bonusDescription) { this.bonusDescription = bonusDescription; }
}

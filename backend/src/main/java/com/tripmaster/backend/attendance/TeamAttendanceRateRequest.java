package com.tripmaster.backend.attendance;

public class TeamAttendanceRateRequest {
    private String startDate;        // 开始日期 YYYY-MM-DD
    private String endDate;          // 结束日期 YYYY-MM-DD
    private String attendanceType;   // 考勤类型
    private String teamName;         // 团队名称

    // Constructors
    public TeamAttendanceRateRequest() {}

    public TeamAttendanceRateRequest(String startDate, String endDate, String attendanceType, String teamName) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.attendanceType = attendanceType;
        this.teamName = teamName;
    }

    // Getters
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getAttendanceType() { return attendanceType; }
    public String getTeamName() { return teamName; }

    // Setters
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public void setAttendanceType(String attendanceType) { this.attendanceType = attendanceType; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
}

package com.tripmaster.backend.attendance;

public class StatisticsQueryRequest {
    private String startDate;        // 开始日期 YYYY-MM-DD
    private String endDate;          // 结束日期 YYYY-MM-DD
    private String attendanceType;   // 考勤类型

    // Constructors
    public StatisticsQueryRequest() {}

    public StatisticsQueryRequest(String startDate, String endDate, String attendanceType) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.attendanceType = attendanceType;
    }

    // Getters
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getAttendanceType() { return attendanceType; }

    // Setters
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public void setAttendanceType(String attendanceType) { this.attendanceType = attendanceType; }
}

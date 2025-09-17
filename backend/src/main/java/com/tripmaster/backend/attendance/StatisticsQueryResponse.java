package com.tripmaster.backend.attendance;

import java.util.List;

public class StatisticsQueryResponse {
    private List<AttendanceSessionInfo> records;  // 考勤记录列表（简化信息）
    private List<String> teams;                   // 涉及的团队列表
    private int totalCount;                       // 记录总数

    // Constructors
    public StatisticsQueryResponse() {}

    public StatisticsQueryResponse(List<AttendanceSessionInfo> records, List<String> teams, int totalCount) {
        this.records = records;
        this.teams = teams;
        this.totalCount = totalCount;
    }

    // Getters
    public List<AttendanceSessionInfo> getRecords() { return records; }
    public List<String> getTeams() { return teams; }
    public int getTotalCount() { return totalCount; }

    // Setters
    public void setRecords(List<AttendanceSessionInfo> records) { this.records = records; }
    public void setTeams(List<String> teams) { this.teams = teams; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
}

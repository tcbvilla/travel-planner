package com.tripmaster.backend.attendance;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;
import java.util.Map;

public class SessionTeamRates {
    private String sessionName;        // 考勤名称（用于X轴显示）
    @JsonIgnore
    private LocalDateTime startTime;  // 考勤开始时间（用于排序，不返回给前端）
    private Map<String, Double> teamRates; // 团队名 -> 加成后出勤率

    public SessionTeamRates() {}

    public SessionTeamRates(String sessionName, LocalDateTime startTime, Map<String, Double> teamRates) {
        this.sessionName = sessionName;
        this.startTime = startTime;
        this.teamRates = teamRates;
    }

    // Getters and Setters
    public String getSessionName() { return sessionName; }
    public void setSessionName(String sessionName) { this.sessionName = sessionName; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public Map<String, Double> getTeamRates() { return teamRates; }
    public void setTeamRates(Map<String, Double> teamRates) { this.teamRates = teamRates; }
}



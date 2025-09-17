package com.tripmaster.backend.attendance;

import java.time.LocalDateTime;

public class AttendanceSessionInfo {
    private Long id;
    private String name;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String attendanceType;
    private String battleResult;
    private String status;

    // Constructors
    public AttendanceSessionInfo() {}

    public AttendanceSessionInfo(Long id, String name, LocalDateTime startTime, LocalDateTime endTime, 
                                String attendanceType, String battleResult, String status) {
        this.id = id;
        this.name = name;
        this.startTime = startTime;
        this.endTime = endTime;
        this.attendanceType = attendanceType;
        this.battleResult = battleResult;
        this.status = status;
    }

    // Getters
    public Long getId() { return id; }
    public String getName() { return name; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public String getAttendanceType() { return attendanceType; }
    public String getBattleResult() { return battleResult; }
    public String getStatus() { return status; }

    // Setters
    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public void setAttendanceType(String attendanceType) { this.attendanceType = attendanceType; }
    public void setBattleResult(String battleResult) { this.battleResult = battleResult; }
    public void setStatus(String status) { this.status = status; }
}

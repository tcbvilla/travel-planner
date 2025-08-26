package com.tripmaster.backend.reward;

import lombok.Data;

@Data
public class AttendanceData {
    private String memberName;
    private String groupName;
    private Long totalMerit;
    private Integer attendanceCount;
    private Integer totalSessions;
    private Double attendanceRate;
    
    public AttendanceData(String memberName, String groupName, Long totalMerit, 
                         Integer attendanceCount, Integer totalSessions, Double attendanceRate) {
        this.memberName = memberName;
        this.groupName = groupName;
        this.totalMerit = totalMerit;
        this.attendanceCount = attendanceCount;
        this.totalSessions = totalSessions;
        this.attendanceRate = attendanceRate;
    }
}

package com.tripmaster.backend.attendance;

import lombok.Data;
import java.util.List;

@Data
public class TeamAttendanceRateResponse {
    private List<AttendanceRateData> attendanceRateData;  // 出勤率数据
    private List<AbsenceStatistics> absenceStatistics;   // 缺勤统计
    
    public TeamAttendanceRateResponse() {
    }
    
    public TeamAttendanceRateResponse(List<AttendanceRateData> attendanceRateData, 
                                     List<AbsenceStatistics> absenceStatistics) {
        this.attendanceRateData = attendanceRateData;
        this.absenceStatistics = absenceStatistics;
    }
}


package com.tripmaster.backend.attendance;

import lombok.Data;

@Data
public class AbsenceStatistics {
    private String memberName;  // 人员姓名
    private int absenceCount;   // 缺勤次数
    
    public AbsenceStatistics() {
    }
    
    public AbsenceStatistics(String memberName, int absenceCount) {
        this.memberName = memberName;
        this.absenceCount = absenceCount;
    }
}


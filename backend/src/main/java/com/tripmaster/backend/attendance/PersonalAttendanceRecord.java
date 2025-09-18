package com.tripmaster.backend.attendance;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PersonalAttendanceRecord {
    private String sessionName;
    private LocalDateTime sessionTime;
    private String attendanceType;
    private boolean isAttended;       // 是否参加考勤
    private boolean isQualified;      // 是否达标
    
    // 添加getter方法确保JSON序列化正确
    public boolean getIsAttended() {
        return isAttended;
    }
    
    public boolean getIsQualified() {
        return isQualified;
    }
    private long meritBefore;         // 战功前值
    private long meritAfter;          // 战功后值
    private long meritDiff;           // 战功差值
    private long assistBefore;        // 助攻前值
    private long assistAfter;         // 助攻后值
    private long assistDiff;          // 助攻差值
    private int threshold;            // 达标阈值
    private String group;             // 所属团队
    private String battleResult;      // 战斗结果
    
    public PersonalAttendanceRecord() {}
    
    public PersonalAttendanceRecord(String sessionName, LocalDateTime sessionTime, String attendanceType,
                                  boolean isAttended, boolean isQualified, long meritBefore, long meritAfter,
                                  long assistBefore, long assistAfter, int threshold, String group, String battleResult) {
        this.sessionName = sessionName;
        this.sessionTime = sessionTime;
        this.attendanceType = attendanceType;
        this.isAttended = isAttended;
        this.isQualified = isQualified;
        this.meritBefore = meritBefore;
        this.meritAfter = meritAfter;
        this.meritDiff = meritAfter - meritBefore;
        this.assistBefore = assistBefore;
        this.assistAfter = assistAfter;
        this.assistDiff = assistAfter - assistBefore;
        this.threshold = threshold;
        this.group = group;
        this.battleResult = battleResult;
    }
}

package com.tripmaster.backend.attendance;

public class SaveSessionRequest {
    private String name;
    private BattleResult battleResult;
    private String memberData;
    private String groupData;
    private Integer threshold;
    private String startTime; // 起始时间字符串
    private String endTime; // 结束时间字符串
    private Long seasonId; // 关联的赛季ID
    private String attendanceType; // 考勤类型

    // Getters
    public String getName() { return name; }
    public BattleResult getBattleResult() { return battleResult; }
    public String getMemberData() { return memberData; }
    public String getGroupData() { return groupData; }
    public Integer getThreshold() { return threshold; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public Long getSeasonId() { return seasonId; }
    public String getAttendanceType() { return attendanceType; }

    // Setters
    public void setName(String name) { this.name = name; }
    public void setBattleResult(BattleResult battleResult) { this.battleResult = battleResult; }
    public void setMemberData(String memberData) { this.memberData = memberData; }
    public void setGroupData(String groupData) { this.groupData = groupData; }
    public void setThreshold(Integer threshold) { this.threshold = threshold; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public void setSeasonId(Long seasonId) { this.seasonId = seasonId; }
    public void setAttendanceType(String attendanceType) { this.attendanceType = attendanceType; }
}

package com.tripmaster.backend.attendance;

public class SaveSessionRequest {
    private String name;
    private BattleResult battleResult;
    private String memberData;
    private String groupData;
    private Integer threshold;
    private String startTime; // 起始时间字符串
    private String endTime; // 结束时间字符串

    // Getters
    public String getName() { return name; }
    public BattleResult getBattleResult() { return battleResult; }
    public String getMemberData() { return memberData; }
    public String getGroupData() { return groupData; }
    public Integer getThreshold() { return threshold; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }

    // Setters
    public void setName(String name) { this.name = name; }
    public void setBattleResult(BattleResult battleResult) { this.battleResult = battleResult; }
    public void setMemberData(String memberData) { this.memberData = memberData; }
    public void setGroupData(String groupData) { this.groupData = groupData; }
    public void setThreshold(Integer threshold) { this.threshold = threshold; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
}

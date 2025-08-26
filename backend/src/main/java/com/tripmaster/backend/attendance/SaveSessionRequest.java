package com.tripmaster.backend.attendance;

public class SaveSessionRequest {
    private String name;
    private BattleResult battleResult;
    private String memberData;
    private String groupData;
    private Integer threshold;

    // Getters
    public String getName() { return name; }
    public BattleResult getBattleResult() { return battleResult; }
    public String getMemberData() { return memberData; }
    public String getGroupData() { return groupData; }
    public Integer getThreshold() { return threshold; }

    // Setters
    public void setName(String name) { this.name = name; }
    public void setBattleResult(BattleResult battleResult) { this.battleResult = battleResult; }
    public void setMemberData(String memberData) { this.memberData = memberData; }
    public void setGroupData(String groupData) { this.groupData = groupData; }
    public void setThreshold(Integer threshold) { this.threshold = threshold; }
}

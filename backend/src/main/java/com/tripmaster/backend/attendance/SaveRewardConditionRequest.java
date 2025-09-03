package com.tripmaster.backend.attendance;

import java.math.BigDecimal;

public class SaveRewardConditionRequest {
    private Long attendanceSessionId;
    private String taskStatus;
    private Integer attendanceRateThreshold;
    private Integer attendanceRateRank;
    private Integer meritIncreaseRank;
    private String rewardType;
    private String penaltyType;
    private BigDecimal cashRewardAmount; // 现金奖励金额
    private String rewardMode = "CODE_TABLE"; // 奖励模式

    // Getters
    public Long getAttendanceSessionId() { return attendanceSessionId; }
    public String getTaskStatus() { return taskStatus; }
    public Integer getAttendanceRateThreshold() { return attendanceRateThreshold; }
    public Integer getAttendanceRateRank() { return attendanceRateRank; }
    public Integer getMeritIncreaseRank() { return meritIncreaseRank; }
    public String getRewardType() { return rewardType; }
    public String getPenaltyType() { return penaltyType; }
    public BigDecimal getCashRewardAmount() { return cashRewardAmount; }
    public String getRewardMode() { return rewardMode; }

    // Setters
    public void setAttendanceSessionId(Long attendanceSessionId) { this.attendanceSessionId = attendanceSessionId; }
    public void setTaskStatus(String taskStatus) { this.taskStatus = taskStatus; }
    public void setAttendanceRateThreshold(Integer attendanceRateThreshold) { this.attendanceRateThreshold = attendanceRateThreshold; }
    public void setAttendanceRateRank(Integer attendanceRateRank) { this.attendanceRateRank = attendanceRateRank; }
    public void setMeritIncreaseRank(Integer meritIncreaseRank) { this.meritIncreaseRank = meritIncreaseRank; }
    public void setRewardType(String rewardType) { this.rewardType = rewardType; }
    public void setPenaltyType(String penaltyType) { this.penaltyType = penaltyType; }
    public void setCashRewardAmount(BigDecimal cashRewardAmount) { this.cashRewardAmount = cashRewardAmount; }
    public void setRewardMode(String rewardMode) { this.rewardMode = rewardMode; }
}

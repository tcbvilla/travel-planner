package com.tripmaster.backend.attendance;

import java.math.BigDecimal;

public class ManualSettlementRequest {
    private String teamName;
    private String rewardType;
    private BigDecimal quantity;
    private String codeValue;
    private BigDecimal cashAmount;
    private Long seasonId;
    private String rewardDescription;
    
    // 构造函数
    public ManualSettlementRequest() {}
    
    // Getters
    public String getTeamName() { return teamName; }
    public String getRewardType() { return rewardType; }
    public BigDecimal getQuantity() { return quantity; }
    public String getCodeValue() { return codeValue; }
    public BigDecimal getCashAmount() { return cashAmount; }
    public Long getSeasonId() { return seasonId; }
    public String getRewardDescription() { return rewardDescription; }
    
    // Setters
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public void setRewardType(String rewardType) { this.rewardType = rewardType; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public void setCodeValue(String codeValue) { this.codeValue = codeValue; }
    public void setCashAmount(BigDecimal cashAmount) { this.cashAmount = cashAmount; }
    public void setSeasonId(Long seasonId) { this.seasonId = seasonId; }
    public void setRewardDescription(String rewardDescription) { this.rewardDescription = rewardDescription; }
}


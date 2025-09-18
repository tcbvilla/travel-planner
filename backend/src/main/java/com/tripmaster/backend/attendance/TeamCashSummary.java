package com.tripmaster.backend.attendance;

import lombok.Data;
import java.util.List;

@Data
public class TeamCashSummary {
    private String teamName;
    private String timeRange;
    private String attendanceType;
    private Double totalRewards;      // 现金奖励总额
    private Double totalPenalties;    // 现金惩罚总额
    private Double netCash;           // 净现金收益
    private List<CashRecord> records; // 详细记录列表
    
    public TeamCashSummary() {
        this.totalRewards = 0.0;
        this.totalPenalties = 0.0;
        this.netCash = 0.0;
    }
    
    public void calculateNetCash() {
        this.netCash = this.totalRewards + this.totalPenalties;
    }
}

package com.tripmaster.backend.attendance;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SettlementResult {
    private String teamName; // 小组名
    private String rewardDescription; // 奖惩描述，如"双花✖️0.333"
    private BigDecimal amount; // 金额
    private String rewardType; // 奖惩类型，如"双花"
    private BigDecimal multiplier; // 倍数，如0.333
}

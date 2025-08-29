package com.tripmaster.backend.attendance;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SettlementResult {
    private String teamName; // 小组名
    private String rewardDescription; // 奖惩描述，如"双花✖️0.333"
    private BigDecimal amount; // 金额（保持向后兼容）
    private String rewardType; // 奖惩类型/码表值，如"双花"、"花"、"屎"
    private BigDecimal multiplier; // 倍数，如0.333（保持向后兼容）
    private Double quantity; // 数量
    
    // 便利方法，用于获取码表值（rewardType就是codeValue）
    public String getCodeValue() {
        return rewardType;
    }
    
    // 便利方法，用于获取数量，优先使用quantity，如果为空则使用multiplier
    public Double getQuantity() {
        return quantity != null ? quantity : (multiplier != null ? multiplier.doubleValue() : 1.0);
    }
}
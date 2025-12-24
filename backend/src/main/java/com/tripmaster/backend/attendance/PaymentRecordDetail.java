package com.tripmaster.backend.attendance;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 支付记录详情
 * 包含结算记录信息和支付状态
 */
@Data
public class PaymentRecordDetail {
    // 结算记录信息
    private Long settlementRecordId;
    private String teamName;
    private String seasonName;
    private String attendanceSessionName;
    private LocalDateTime sessionTime;
    
    // 金额信息
    private String rewardMode;  // CODE_TABLE 或 CASH
    private String codeValue;   // 码表值（如"花"、"屎"）
    private BigDecimal quantity; // 数量
    private BigDecimal cashAmount; // 现金金额（正数=奖励，负数=惩罚）
    
    // 来源信息
    private String recordType;  // SETTLEMENT(结算记录), MANUAL(手动添加), SYNTHESIS(合成记录)
    private String settlementBatchId;
    private Boolean isSynthetic;
    
    // 支付状态
    private Boolean isPaid;
    private LocalDateTime paymentTime;
    private String operatorAccount;
    
    public PaymentRecordDetail() {
        this.isPaid = false;
    }
    
    /**
     * 判断记录类型
     */
    public String determineRecordType() {
        if (isSynthetic != null && isSynthetic) {
            return "合成记录";
        }
        if (settlementBatchId != null && settlementBatchId.startsWith("MANUAL_")) {
            return "手动添加";
        }
        return "结算记录";
    }
    
    /**
     * 获取金额显示文本
     */
    public String getAmountDisplay() {
        if ("CASH".equals(rewardMode) && cashAmount != null) {
            return cashAmount.toString() + "元";
        }
        if ("CODE_TABLE".equals(rewardMode) && codeValue != null && quantity != null) {
            return codeValue + " x" + quantity;
        }
        return "-";
    }
}




package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "settlement_records")
@Data
public class SettlementRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "team_name", nullable = false)
    private String teamName;
    
    @Column(name = "code_value")
    private String codeValue; // 具体的码表值，如"花"、"屎"
    
    @Column(name = "quantity", nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity; // 数量，保留3位小数
    
    @Column(name = "cash_amount", precision = 15, scale = 2)
    private BigDecimal cashAmount; // 现金金额（直接存储最终金额）
    
    @Column(name = "reward_mode")
    private String rewardMode = "CODE_TABLE"; // 奖励模式："CODE_TABLE" 或 "CASH"
    
    @Column(name = "settlement_batch_id", nullable = false)
    private String settlementBatchId; // 结算批次ID，用于关联特定的奖惩条件组合
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "attendance_session_id", nullable = false)
    private AttendanceSession attendanceSession;
    
    @Column(name = "synthesis_chain_id")
    private Long synthesisChainId; // 关联的合成链ID
    
    @Column(name = "is_synthetic")
    private Boolean isSynthetic = false; // 是否为合成记录
    
    @Column(name = "parent_synthesis_id")
    private Long parentSynthesisId; // 父级合成记录ID
    
    @Column(name = "record_status")
    private String recordStatus = "ACTIVE"; // 记录状态：ACTIVE, SYNTHESIZED, DELETED
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
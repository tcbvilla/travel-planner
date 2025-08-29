package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
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
    
    @Column(name = "code_value", nullable = false)
    private String codeValue; // 具体的码表值，如"花"、"屎"
    
    @Column(name = "quantity", nullable = false, precision = 10, scale = 3)
    private Double quantity; // 数量，保留3位小数
    
    @Column(name = "settlement_batch_id", nullable = false)
    private String settlementBatchId; // 结算批次ID，用于关联特定的奖惩条件组合
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "attendance_session_id", nullable = false)
    private AttendanceSession attendanceSession;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "synthesis_chains")
@Data
public class SynthesisChain {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "season_id", nullable = false)
    private Long seasonId;
    
    @Column(name = "team_name", nullable = false)
    private String teamName;
    
    @Column(name = "source_batch_ids", nullable = false, columnDefinition = "TEXT")
    private String sourceBatchIds; // JSON数组格式: ["BATCH_1", "BATCH_2"]
    
    @Column(name = "synthesis_record_ids", nullable = false, columnDefinition = "TEXT")
    private String synthesisRecordIds; // JSON数组格式: [123, 124]
    
    @Column(name = "synthesis_log_ids", nullable = false, columnDefinition = "TEXT")
    private String synthesisLogIds; // JSON数组格式: [456, 457]
    
    @Column(name = "synthesis_type", nullable = false)
    private String synthesisType; // "UPGRADE" 或 "CASH_CONVERT"
    
    @Column(name = "source_item_type")
    private String sourceItemType; // "花瓣", "花", "屎粒", "屎"
    
    @Column(name = "target_item_type")
    private String targetItemType; // "花", "现金", "屎", "现金"
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "trigger_settlement_batch_id")
    private String triggerSettlementBatchId; // 触发合成的结算批次ID
    
    @Column(name = "attendance_session_id")
    private Long attendanceSessionId; // 关联的考勤会话ID
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
    
    // Getters and Setters for new fields
    public String getTriggerSettlementBatchId() {
        return triggerSettlementBatchId;
    }
    
    public void setTriggerSettlementBatchId(String triggerSettlementBatchId) {
        this.triggerSettlementBatchId = triggerSettlementBatchId;
    }
    
    public Long getAttendanceSessionId() {
        return attendanceSessionId;
    }
    
    public void setAttendanceSessionId(Long attendanceSessionId) {
        this.attendanceSessionId = attendanceSessionId;
    }
}

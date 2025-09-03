package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "synthesis_logs")
@Data
public class SynthesisLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "operation_time", nullable = false)
    private LocalDateTime operationTime;
    
    @Column(name = "team_name", nullable = false)
    private String teamName;
    
    @Column(name = "season_name", nullable = false)
    private String seasonName;
    
    @Column(name = "synthesis_type", nullable = false)
    private String synthesisType; // "UPGRADE" 或 "CASH_CONVERT"
    
    @Column(name = "source_items", nullable = false, columnDefinition = "TEXT")
    private String sourceItems; // JSON格式的原始物品信息
    
    @Column(name = "target_item", nullable = false, columnDefinition = "TEXT")
    private String targetItem; // JSON格式的合成物品信息
    
    @Column(name = "synthesis_content", nullable = false, columnDefinition = "TEXT")
    private String synthesisContent; // 合成描述，如："3个花瓣合成1个花"
    
    @Column(name = "synthesis_chain_id")
    private Long synthesisChainId; // 关联的合成链ID
    
    @PrePersist
    protected void onCreate() {
        operationTime = LocalDateTime.now();
    }
}

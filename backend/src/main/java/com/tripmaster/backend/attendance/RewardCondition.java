package com.tripmaster.backend.attendance;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "reward_conditions")
@Data
public class RewardCondition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "attendance_session_id")
    private Long attendanceSessionId; // 关联的考勤记录ID
    
    @Column(name = "task_status")
    private String taskStatus; // 成功/失败
    
    @Column(name = "attendance_rate_threshold")
    private Integer attendanceRateThreshold; // 出勤率阈值
    
    @Column(name = "attendance_rate_rank")
    private Integer attendanceRateRank; // 出勤率排名
    
    @Column(name = "merit_increase_rank")
    private Integer meritIncreaseRank; // 战功增量排名（仅成功时）
    
    @Column(name = "reward_type")
    private String rewardType; // 奖励类型（仅成功时）
    
    @Column(name = "penalty_type")
    private String penaltyType; // 处罚类型（仅失败时）
    
    @Column(name = "cash_reward_amount", precision = 15, scale = 2)
    private BigDecimal cashRewardAmount; // 现金奖励金额（可正可负）
    
    @Column(name = "reward_mode")
    private String rewardMode = "CODE_TABLE"; // 奖励模式："CODE_TABLE" 或 "CASH"
    
    @Column(name = "penalty_mode")
    private String penaltyMode = "CODE_TABLE"; // 惩罚模式："CODE_TABLE" 或 "CASH"
    
    @Column(name = "cash_penalty_amount", precision = 15, scale = 2)
    private BigDecimal cashPenaltyAmount; // 现金惩罚金额（负数）
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

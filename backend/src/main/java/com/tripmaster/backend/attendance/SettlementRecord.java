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
    
    @Column(name = "reward_description", nullable = false)
    private String rewardDescription;
    
    @Column(name = "amount", nullable = false, precision = 10, scale = 3)
    private BigDecimal amount;
    
    @Column(name = "reward_type", nullable = false)
    private String rewardType;
    
    @Column(name = "multiplier", nullable = false, precision = 10, scale = 3)
    private BigDecimal multiplier;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "season_id", nullable = false)
    private Season season;
    
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

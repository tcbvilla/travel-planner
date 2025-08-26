package com.tripmaster.backend.reward;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "reward_records")
@Data
public class RewardRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RewardType type;
    
    @Column(nullable = false)
    private String reason;
    
    @Column(nullable = false)
    private Integer points;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column
    private String sessionId;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

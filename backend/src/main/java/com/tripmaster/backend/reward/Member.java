package com.tripmaster.backend.reward;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "members")
@Data
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String groupName;
    
    @Column(nullable = false)
    private Long totalMerit;
    
    @Column(nullable = false)
    private Integer attendanceCount;
    
    @Column(nullable = false)
    private Integer totalSessions;
    
    @Column(nullable = false)
    private Double attendanceRate;
    
    @Column(nullable = false)
    private LocalDateTime lastUpdated;
    
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }
}

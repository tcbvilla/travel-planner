package com.tripmaster.backend.attendance;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_sessions")
@Data
public class AttendanceSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BattleResult battleResult;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(columnDefinition = "TEXT")
    private String memberData; // JSON格式的成员数据
    
    @Column(columnDefinition = "TEXT")
    private String groupData; // JSON格式的小组数据
    
    @Column
    private Integer threshold; // 出勤标准
    
    @Column
    private LocalDateTime startTime; // 起始时间
    
    @Column
    private LocalDateTime endTime; // 结束时间
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "season_id")
    private Season season; // 关联的赛季
    
    @Column(nullable = false)
    private String attendanceType = "压秒考勤"; // 考勤类型
    
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

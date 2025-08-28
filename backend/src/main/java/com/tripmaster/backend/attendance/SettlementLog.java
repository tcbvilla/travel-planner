package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "settlement_logs")
@Data
public class SettlementLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "operation_time", nullable = false)
    private LocalDateTime operationTime;
    
    @Column(name = "attendance_record_name", nullable = false)
    private String attendanceRecordName;
    
    @Column(name = "settlement_season", nullable = false)
    private String settlementSeason;
    
    @Column(name = "settlement_content", nullable = false, columnDefinition = "TEXT")
    private String settlementContent;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "attendance_session_id", nullable = false)
    private AttendanceSession attendanceSession;
    
    @PrePersist
    protected void onCreate() {
        operationTime = LocalDateTime.now();
    }
}

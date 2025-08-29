package com.tripmaster.backend.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SettlementRecordRepository extends JpaRepository<SettlementRecord, Long> {
    
    List<SettlementRecord> findByAttendanceSessionId(Long attendanceSessionId);
    
    List<SettlementRecord> findBySettlementBatchId(String settlementBatchId);
    
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.attendanceSession.season.id = :seasonId ORDER BY sr.createdAt DESC")
    Page<SettlementRecord> findBySeasonIdOrderByCreatedAtDesc(@Param("seasonId") Long seasonId, Pageable pageable);
    
    boolean existsByAttendanceSessionId(Long attendanceSessionId);
    
    // 获取最新的结算批次ID
    @Query(value = "SELECT settlement_batch_id FROM settlement_records WHERE attendance_session_id = :attendanceSessionId ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    String findLatestSettlementBatchIdByAttendanceSessionId(@Param("attendanceSessionId") Long attendanceSessionId);
}

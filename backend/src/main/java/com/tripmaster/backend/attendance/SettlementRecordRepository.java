package com.tripmaster.backend.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SettlementRecordRepository extends JpaRepository<SettlementRecord, Long> {
    
    List<SettlementRecord> findByAttendanceSessionId(Long attendanceSessionId);
    
    List<SettlementRecord> findBySettlementBatchId(String settlementBatchId);
    
    List<SettlementRecord> findByTeamName(String teamName);
    
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.attendanceSession.season.id = :seasonId ORDER BY sr.createdAt DESC")
    Page<SettlementRecord> findBySeasonIdOrderByCreatedAtDesc(@Param("seasonId") Long seasonId, Pageable pageable);
    
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.attendanceSession.season.id = :seasonId")
    List<SettlementRecord> findBySeasonId(@Param("seasonId") Long seasonId);
    
    boolean existsByAttendanceSessionId(Long attendanceSessionId);
    
    // 获取最新的原始结算批次ID（排除合成记录）
    @Query(value = "SELECT settlement_batch_id FROM settlement_records WHERE attendance_session_id = :attendanceSessionId AND settlement_batch_id LIKE 'BATCH_%' ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    String findLatestSettlementBatchIdByAttendanceSessionId(@Param("attendanceSessionId") Long attendanceSessionId);
    
    // 根据考勤记录ID列表和团队名称查询结算记录
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.attendanceSession.id IN :attendanceSessionIds AND sr.teamName = :teamName")
    List<SettlementRecord> findByAttendanceSessionIdInAndTeamName(@Param("attendanceSessionIds") List<Long> attendanceSessionIds, @Param("teamName") String teamName);
    
    // 根据考勤记录ID列表、团队名称和现金金额不为空查询结算记录
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.attendanceSession.id IN :attendanceSessionIds AND sr.teamName = :teamName AND sr.cashAmount IS NOT NULL AND sr.cashAmount != 0")
    List<SettlementRecord> findByAttendanceSessionIdInAndTeamNameAndCashAmountIsNotNull(@Param("attendanceSessionIds") List<Long> attendanceSessionIds, @Param("teamName") String teamName);
    
    // 查询手动添加的结算记录（按团队名称、批次ID前缀和时间范围）
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.teamName = :teamName AND sr.settlementBatchId LIKE :batchIdPrefix AND sr.createdAt BETWEEN :startTime AND :endTime")
    List<SettlementRecord> findByTeamNameAndSettlementBatchIdStartingWithAndCreatedAtBetween(
        @Param("teamName") String teamName, 
        @Param("batchIdPrefix") String batchIdPrefix, 
        @Param("startTime") LocalDateTime startTime, 
        @Param("endTime") LocalDateTime endTime);
    
    // 查询手动添加的结算记录（按团队名称和批次ID前缀，不限制时间）
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.teamName = :teamName AND sr.settlementBatchId LIKE :batchIdPrefix")
    List<SettlementRecord> findByTeamNameAndSettlementBatchIdStartingWith(
        @Param("teamName") String teamName, 
        @Param("batchIdPrefix") String batchIdPrefix);
}

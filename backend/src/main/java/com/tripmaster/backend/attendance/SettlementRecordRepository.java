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
    
    List<SettlementRecord> findBySeasonId(Long seasonId);
    
    List<SettlementRecord> findByAttendanceSessionId(Long attendanceSessionId);
    
    @Query("SELECT sr FROM SettlementRecord sr WHERE sr.season.id = :seasonId ORDER BY sr.createdAt DESC")
    Page<SettlementRecord> findBySeasonIdOrderByCreatedAtDesc(@Param("seasonId") Long seasonId, Pageable pageable);
    
    boolean existsByAttendanceSessionId(Long attendanceSessionId);
}

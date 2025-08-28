package com.tripmaster.backend.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SettlementLogRepository extends JpaRepository<SettlementLog, Long> {
    
    @Query("SELECT sl FROM SettlementLog sl ORDER BY sl.operationTime DESC")
    Page<SettlementLog> findAllOrderByOperationTimeDesc(Pageable pageable);
    
    @Query("SELECT sl FROM SettlementLog sl WHERE sl.attendanceSession.season.id = :seasonId ORDER BY sl.operationTime DESC")
    Page<SettlementLog> findBySeasonIdOrderByOperationTimeDesc(@Param("seasonId") Long seasonId, Pageable pageable);
    
    List<SettlementLog> findByAttendanceSessionId(Long attendanceSessionId);
}

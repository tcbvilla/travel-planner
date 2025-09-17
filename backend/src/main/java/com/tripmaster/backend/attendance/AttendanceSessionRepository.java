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
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    
    Page<AttendanceSession> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    Page<AttendanceSession> findByNameContainingIgnoreCaseOrderByCreatedAtDesc(String name, Pageable pageable);
    
    List<AttendanceSession> findBySeasonId(Long seasonId);
    
    /**
     * 根据考勤类型和时间范围查询考勤记录
     * 查询条件：考勤记录的起始时间到结束时间完全落在指定时间范围内
     */
    @Query("SELECT s FROM AttendanceSession s WHERE s.attendanceType = :attendanceType " +
           "AND s.startTime >= :startTime AND s.endTime <= :endTime " +
           "ORDER BY s.startTime ASC")
    List<AttendanceSession> findByAttendanceTypeAndTimeRange(@Param("attendanceType") String attendanceType,
                                                             @Param("startTime") LocalDateTime startTime,
                                                             @Param("endTime") LocalDateTime endTime);
    
    /**
     * 查询所有不重复的考勤类型
     */
    @Query("SELECT DISTINCT s.attendanceType FROM AttendanceSession s WHERE s.attendanceType IS NOT NULL ORDER BY s.attendanceType")
    List<String> findDistinctAttendanceTypes();
}

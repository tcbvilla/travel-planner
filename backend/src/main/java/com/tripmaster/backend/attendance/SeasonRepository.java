package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SeasonRepository extends JpaRepository<Season, Long> {
    
    // 根据赛季名称查找赛季
    Season findByName(String name);
    
    // 检查赛季名称是否存在
    boolean existsByName(String name);
    
    // 检查特定赛季是否被考勤记录使用
    @Query("SELECT COUNT(a) FROM AttendanceSession a WHERE a.season.id = :seasonId")
    long countAttendanceSessionsBySeasonId(@Param("seasonId") Long seasonId);
}

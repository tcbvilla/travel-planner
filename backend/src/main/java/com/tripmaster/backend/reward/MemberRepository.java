package com.tripmaster.backend.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    
    Optional<Member> findByName(String name);
    
    List<Member> findByGroupName(String groupName);
    
    @Query("SELECT m FROM Member m WHERE m.attendanceRate >= :minRate ORDER BY m.totalMerit DESC")
    List<Member> findTopPerformersByAttendanceRate(@Param("minRate") Double minRate);
    
    @Query("SELECT m FROM Member m WHERE m.totalMerit >= :minMerit ORDER BY m.attendanceRate DESC")
    List<Member> findTopPerformersByMerit(@Param("minMerit") Long minMerit);
    
    @Query("SELECT AVG(m.attendanceRate) FROM Member m WHERE m.groupName = :groupName")
    Double getAverageAttendanceRateByGroup(@Param("groupName") String groupName);
    
    @Query("SELECT AVG(m.totalMerit) FROM Member m WHERE m.groupName = :groupName")
    Double getAverageMeritByGroup(@Param("groupName") String groupName);
}

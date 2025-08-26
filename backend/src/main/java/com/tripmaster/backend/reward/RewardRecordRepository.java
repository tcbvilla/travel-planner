package com.tripmaster.backend.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RewardRecordRepository extends JpaRepository<RewardRecord, Long> {
    
    List<RewardRecord> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    
    List<RewardRecord> findByMemberIdAndTypeOrderByCreatedAtDesc(Long memberId, RewardType type);
    
    @Query("SELECT r FROM RewardRecord r WHERE r.member.id = :memberId AND r.createdAt BETWEEN :startDate AND :endDate ORDER BY r.createdAt DESC")
    List<RewardRecord> findByMemberIdAndDateRange(@Param("memberId") Long memberId, 
                                                 @Param("startDate") LocalDateTime startDate, 
                                                 @Param("endDate") LocalDateTime endDate);
    
    @Query("SELECT SUM(r.points) FROM RewardRecord r WHERE r.member.id = :memberId AND r.type IN :types")
    Integer getTotalPointsByMemberAndTypes(@Param("memberId") Long memberId, @Param("types") List<RewardType> types);
    
    @Query("SELECT r FROM RewardRecord r WHERE r.sessionId = :sessionId ORDER BY r.createdAt DESC")
    List<RewardRecord> findBySessionId(@Param("sessionId") String sessionId);
}

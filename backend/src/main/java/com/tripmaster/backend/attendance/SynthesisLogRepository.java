package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SynthesisLogRepository extends JpaRepository<SynthesisLog, Long> {
    
    /**
     * 根据赛季名称查找合成日志
     */
    List<SynthesisLog> findBySeasonNameOrderByOperationTimeDesc(String seasonName);
    
    /**
     * 根据团队名称和赛季名称查找合成日志
     */
    List<SynthesisLog> findByTeamNameAndSeasonNameOrderByOperationTimeDesc(String teamName, String seasonName);
    
    /**
     * 根据合成链ID查找合成日志
     */
    List<SynthesisLog> findBySynthesisChainId(Long synthesisChainId);
    
    /**
     * 检查是否存在引用指定批次ID的合成日志
     */
    @Query("SELECT COUNT(sl) > 0 FROM SynthesisLog sl WHERE sl.sourceItems LIKE %:batchId%")
    boolean existsBySourceBatchIds(@Param("batchId") String batchId);
}

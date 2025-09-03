package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SynthesisChainRepository extends JpaRepository<SynthesisChain, Long> {
    
    /**
     * 根据赛季ID查找合成链
     */
    List<SynthesisChain> findBySeasonId(Long seasonId);
    
    /**
     * 根据团队名称和赛季ID查找合成链
     */
    List<SynthesisChain> findByTeamNameAndSeasonId(String teamName, Long seasonId);
    
    /**
     * 查找包含指定批次ID的合成链
     */
    @Query("SELECT sc FROM SynthesisChain sc WHERE sc.sourceBatchIds LIKE %:batchId%")
    List<SynthesisChain> findBySourceBatchIdsContaining(@Param("batchId") String batchId);
    
    /**
     * 按创建时间倒序查找合成链（用于级联撤销）
     */
    List<SynthesisChain> findBySeasonIdOrderByCreatedAtDesc(Long seasonId);
    
    /**
     * 查找由指定结算批次触发的合成链
     */
    List<SynthesisChain> findByTriggerSettlementBatchId(String triggerSettlementBatchId);
}

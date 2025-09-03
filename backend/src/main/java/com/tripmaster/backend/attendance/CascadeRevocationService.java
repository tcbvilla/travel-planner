package com.tripmaster.backend.attendance;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CascadeRevocationService {
    
    @Autowired
    private SettlementRecordRepository settlementRecordRepository;
    
    @Autowired
    private SynthesisChainRepository synthesisChainRepository;
    
    @Autowired
    private SynthesisLogRepository synthesisLogRepository;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 撤销影响分析结果
     */
    public static class RevocationImpactAnalysis {
        private List<SettlementRecord> directRecords = new ArrayList<>();
        private List<SynthesisChain> affectedChains = new ArrayList<>();
        private List<SettlementRecord> synthesisRecordsToDelete = new ArrayList<>();
        private List<SettlementRecord> recordsToRestore = new ArrayList<>();
        private boolean hasImpact = false;
        
        // Getters and Setters
        public List<SettlementRecord> getDirectRecords() { return directRecords; }
        public void setDirectRecords(List<SettlementRecord> directRecords) { this.directRecords = directRecords; }
        
        public List<SynthesisChain> getAffectedChains() { return affectedChains; }
        public void setAffectedChains(List<SynthesisChain> affectedChains) { this.affectedChains = affectedChains; }
        
        public List<SettlementRecord> getSynthesisRecordsToDelete() { return synthesisRecordsToDelete; }
        public void setSynthesisRecordsToDelete(List<SettlementRecord> synthesisRecordsToDelete) { 
            this.synthesisRecordsToDelete = synthesisRecordsToDelete; 
        }
        
        public List<SettlementRecord> getRecordsToRestore() { return recordsToRestore; }
        public void setRecordsToRestore(List<SettlementRecord> recordsToRestore) { this.recordsToRestore = recordsToRestore; }
        
        public boolean isHasImpact() { return hasImpact; }
        public void setHasImpact(boolean hasImpact) { this.hasImpact = hasImpact; }
    }
    
    /**
     * 分析撤销影响
     */
    public RevocationImpactAnalysis analyzeRevocationImpact(String batchId) {
        RevocationImpactAnalysis analysis = new RevocationImpactAnalysis();
        
        try {
            // 1. 查找直接影响的记录
            List<SettlementRecord> directRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
            analysis.setDirectRecords(directRecords);
            
            // 2. 查找受影响的合成链（包括直接和间接影响）
            List<SynthesisChain> affectedChains = findAllAffectedChains(batchId);
            analysis.setAffectedChains(affectedChains);
            
            // 3. 如果有合成链受影响，分析具体影响
            if (!affectedChains.isEmpty()) {
                analysis.setHasImpact(true);
                
                // 将被删除的合成记录
                List<SettlementRecord> synthesisRecords = new ArrayList<>();
                List<SettlementRecord> recordsToRestore = new ArrayList<>();
                
                for (SynthesisChain chain : affectedChains) {
                    // 获取合成记录
                    List<Long> synthesisRecordIds = parseIdList(chain.getSynthesisRecordIds());
                    List<SettlementRecord> chainSynthesisRecords = settlementRecordRepository.findAllById(synthesisRecordIds);
                    synthesisRecords.addAll(chainSynthesisRecords);
                    
                    // 获取将被恢复的原始记录
                    List<SettlementRecord> sourceRecords = findSourceRecords(chain);
                    recordsToRestore.addAll(sourceRecords);
                }
                
                analysis.setSynthesisRecordsToDelete(synthesisRecords);
                analysis.setRecordsToRestore(recordsToRestore);
            }
            
            System.out.println(String.format("撤销影响分析 - 批次: %s, 直接记录: %d, 受影响合成链: %d", 
                             batchId, directRecords.size(), affectedChains.size()));
            
        } catch (Exception e) {
            System.err.println("分析撤销影响失败: " + e.getMessage());
            e.printStackTrace();
        }
        
        return analysis;
    }
    
    /**
     * 查找所有受影响的合成链（基于触发批次ID和物品依赖进行查找）
     */
    private List<SynthesisChain> findAllAffectedChains(String batchId) {
        // 使用新的查找逻辑
        return findAllChainsToRevoke(batchId);
    }
    
    /**
     * 查找依赖指定批次物品的合成链
     */
    private List<SynthesisChain> findChainsDependentOnBatch(String batchId) {
        List<SynthesisChain> dependentChains = new ArrayList<>();
        List<SynthesisChain> allChains = synthesisChainRepository.findAll();
        
        for (SynthesisChain chain : allChains) {
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            if (sourceBatchIds.contains(batchId)) {
                dependentChains.add(chain);
                System.out.println("发现依赖批次 " + batchId + " 的合成链: " + chain.getId() + " (类型: " + chain.getSynthesisType() + ")");
            }
        }
        
        return dependentChains;
    }
    
    /**
     * 查找所有需要撤销的合成链（基于条件和依赖关系）
     */
    private List<SynthesisChain> findAllChainsToRevoke(String batchId) {
        List<SynthesisChain> chainsToRevoke = new ArrayList<>();
        List<SynthesisChain> allChains = synthesisChainRepository.findAll();
        
        // 1. 查找直接依赖该批次的合成链
        for (SynthesisChain chain : allChains) {
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            if (sourceBatchIds.contains(batchId)) {
                chainsToRevoke.add(chain);
                System.out.println("添加依赖批次 " + batchId + " 的合成链: " + chain.getId());
            }
        }
        
        // 2. 递归查找所有需要撤销的合成链
        Set<Long> processedChainIds = new HashSet<>();
        boolean hasNewChains;
        
        do {
            hasNewChains = false;
            
            for (SynthesisChain chain : allChains) {
                if (!processedChainIds.contains(chain.getId()) && !chainsToRevoke.contains(chain)) {
                    // 检查这个合成链是否应该被撤销
                    if (shouldRevokeChainByCondition(chain) || dependsOnRevokedChains(chain, chainsToRevoke)) {
                        chainsToRevoke.add(chain);
                        processedChainIds.add(chain.getId());
                        hasNewChains = true;
                        System.out.println("添加需要撤销的合成链: " + chain.getId() + " (类型: " + chain.getSynthesisType() + ")");
                    }
                }
            }
        } while (hasNewChains);
        
        return chainsToRevoke;
    }
    
    /**
     * 检查合成链是否依赖已被撤销的合成链
     */
    private boolean dependsOnRevokedChains(SynthesisChain chain, List<SynthesisChain> revokedChains) {
        try {
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            
            for (SynthesisChain revokedChain : revokedChains) {
                List<Long> revokedRecordIds = parseIdList(revokedChain.getSynthesisRecordIds());
                
                for (String batchId : sourceBatchIds) {
                    if (batchId.startsWith("SYNTHESIS")) {
                        List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                        for (SettlementRecord record : batchRecords) {
                            if (revokedRecordIds.contains(record.getId())) {
                                System.out.println("合成链 " + chain.getId() + " 依赖已被撤销的合成链 " + revokedChain.getId());
                                return true;
                            }
                        }
                    }
                }
            }
            
            return false;
            
        } catch (Exception e) {
            System.err.println("检查撤销依赖关系失败: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 检查合成链是否依赖已被影响的合成链
     */
    private boolean dependsOnAffectedChain(SynthesisChain chain, Set<Long> affectedChainIds) {
        try {
            // 检查合成链的源记录是否来自已被影响的合成链
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            
            for (String batchId : sourceBatchIds) {
                // 如果源批次是合成批次，检查其合成链ID
                if (batchId.startsWith("SYNTHESIS")) {
                    List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                    for (SettlementRecord record : batchRecords) {
                        if (record.getSynthesisChainId() != null && affectedChainIds.contains(record.getSynthesisChainId())) {
                            System.out.println("合成链 " + chain.getId() + " 依赖合成链 " + record.getSynthesisChainId() + " (通过批次 " + batchId + ")");
                            return true;
                        }
                    }
                }
            }
            
            // 检查合成链生成的记录是否被其他已被影响的合成链使用
            List<Long> synthesisRecordIds = parseIdList(chain.getSynthesisRecordIds());
            for (Long recordId : synthesisRecordIds) {
                SettlementRecord record = settlementRecordRepository.findById(recordId).orElse(null);
                if (record != null && record.getSynthesisChainId() != null) {
                    if (affectedChainIds.contains(record.getSynthesisChainId())) {
                        System.out.println("合成链 " + chain.getId() + " 被合成链 " + record.getSynthesisChainId() + " 使用");
                        return true;
                    }
                }
            }
            
            return false;
            
        } catch (Exception e) {
            System.err.println("检查合成链依赖关系失败: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 检查合成链是否应该被撤销（基于合成条件）
     */
    private boolean shouldRevokeChainByCondition(SynthesisChain chain) {
        try {
            // 获取合成链的源记录
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            Map<String, Double> itemCounts = new HashMap<>();
            
            for (String batchId : sourceBatchIds) {
                List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                for (SettlementRecord record : batchRecords) {
                    if (record.getCodeValue() != null && "ACTIVE".equals(record.getRecordStatus())) {
                        itemCounts.merge(record.getCodeValue(), record.getQuantity().doubleValue(), Double::sum);
                    }
                }
            }
            
            // 检查是否还满足合成条件
            return !checkSynthesisConditions(chain.getSynthesisType(), itemCounts);
            
        } catch (Exception e) {
            System.err.println("检查合成链条件失败: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 执行级联撤销
     */
    @Transactional
    public void executeRevocationWithCascade(String batchId) {
        System.out.println("开始执行级联撤销，批次ID: " + batchId);
        
        try {
            // 1. 分析撤销影响（在撤销前分析）
            RevocationImpactAnalysis analysis = analyzeRevocationImpact(batchId);
            
            // 2. 如果有级联影响，先撤销所有相关的合成链
            if (analysis.isHasImpact()) {
                System.out.println("发现级联影响，开始撤销合成链");
                
                // 按创建时间倒序处理合成链（最新的先撤销）
                List<SynthesisChain> chainsToRevoke = analysis.getAffectedChains()
                        .stream()
                        .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                        .collect(Collectors.toList());
                
                for (SynthesisChain chain : chainsToRevoke) {
                    System.out.println("撤销合成链: " + chain.getId() + ", 类型: " + chain.getSynthesisType());
                    revokeSynthesisChain(chain);
                }
            }
            
            // 3. 最后撤销原始记录
            revokeDirectRecords(analysis.getDirectRecords());
            
            System.out.println("级联撤销完成");
            
        } catch (Exception e) {
            System.err.println("级联撤销失败: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("级联撤销失败: " + e.getMessage(), e);
        }
    }
    
    /**
     * 递归处理级联撤销
     */
    private void processRecursiveRevocation(String originalBatchId) {
        System.out.println("开始递归处理级联撤销，原始批次: " + originalBatchId);
        
        // 关键修复：检查所有合成链，看撤销后是否还满足合成条件
        List<SynthesisChain> allChains = synthesisChainRepository.findAll();
        List<SynthesisChain> chainsToRevoke = new ArrayList<>();
        
        for (SynthesisChain chain : allChains) {
            if (shouldRevokeChainAfterBatchRemoval(chain, originalBatchId)) {
                chainsToRevoke.add(chain);
                System.out.println("合成链 " + chain.getId() + " 需要撤销，因为撤销批次 " + originalBatchId + " 后不再满足合成条件");
            }
        }
        
        if (chainsToRevoke.isEmpty()) {
            System.out.println("没有找到需要撤销的合成链");
            return;
        }
        
        // 按创建时间倒序处理合成链（最新的先撤销）
        chainsToRevoke.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        
        System.out.println("找到 " + chainsToRevoke.size() + " 个需要撤销的合成链");
        
        for (SynthesisChain chain : chainsToRevoke) {
            System.out.println("撤销合成链: " + chain.getId() + ", 类型: " + chain.getSynthesisType());
            revokeSynthesisChain(chain);
        }
    }
    
    /**
     * 判断撤销指定批次后，合成链是否还应该存在
     */
    private boolean shouldRevokeChainAfterBatchRemoval(SynthesisChain chain, String removedBatchId) {
        try {
            // 获取合成链的源批次ID列表
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            
            // 关键修复：检查合成链的源批次是否仍然存在
            // 如果任何源批次不存在，说明这个合成链应该被撤销
            for (String batchId : sourceBatchIds) {
                List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                if (batchRecords.isEmpty()) {
                    System.out.println("合成链 " + chain.getId() + " 的源批次 " + batchId + " 不存在，需要撤销");
                    return true;
                }
            }
            
            // 如果被撤销的批次不在源批次中，不需要撤销
            if (!sourceBatchIds.contains(removedBatchId)) {
                return false;
            }
            
            // 获取合成链的源记录
            List<SettlementRecord> sourceRecords = new ArrayList<>();
            for (String batchId : sourceBatchIds) {
                List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                sourceRecords.addAll(batchRecords);
            }
            
            // 过滤掉被撤销批次的记录
            List<SettlementRecord> remainingRecords = sourceRecords.stream()
                    .filter(record -> !removedBatchId.equals(record.getSettlementBatchId()))
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()) || "SYNTHESIZED".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            // 按类型分组统计数量
            Map<String, Double> itemCounts = new HashMap<>();
            for (SettlementRecord record : remainingRecords) {
                String codeValue = record.getCodeValue();
                if (codeValue != null) {
                    itemCounts.merge(codeValue, record.getQuantity().doubleValue(), Double::sum);
                }
            }
            
            // 检查是否还满足合成条件
            return !checkSynthesisConditions(chain.getSynthesisType(), itemCounts);
            
        } catch (Exception e) {
            System.err.println("检查合成链撤销条件失败: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 检查是否满足合成条件
     */
    private boolean checkSynthesisConditions(String synthesisType, Map<String, Double> itemCounts) {
        switch (synthesisType) {
            case "UPGRADE":
                // 花瓣→花：需要3个花瓣
                if (itemCounts.getOrDefault("花瓣", 0.0) >= 3.0) {
                    return true;
                }
                // 屎粒→屎：需要3个屎粒
                if (itemCounts.getOrDefault("屎粒", 0.0) >= 3.0) {
                    return true;
                }
                break;
            case "CASH_CONVERT":
                // 花→现金：需要3个花
                if (itemCounts.getOrDefault("花", 0.0) >= 3.0) {
                    return true;
                }
                // 屎→现金：需要3个屎
                if (itemCounts.getOrDefault("屎", 0.0) >= 3.0) {
                    return true;
                }
                break;
        }
        return false;
    }
    
    /**
     * 撤销单个合成链
     */
    private void revokeSynthesisChain(SynthesisChain chain) {
        System.out.println("撤销合成链: " + chain.getId());
        
        try {
            // 1. 删除合成产生的记录
            List<Long> synthesisRecordIds = parseIdList(chain.getSynthesisRecordIds());
            if (!synthesisRecordIds.isEmpty()) {
                settlementRecordRepository.deleteAllById(synthesisRecordIds);
                System.out.println("删除合成记录: " + synthesisRecordIds);
            }
            
            // 2. 恢复被合成的原始记录
            List<SettlementRecord> sourceRecords = findSourceRecords(chain);
            for (SettlementRecord record : sourceRecords) {
                // 关键修复：恢复记录状态和清除合成链关联
                record.setRecordStatus("ACTIVE");
                record.setSynthesisChainId(null);
                
                // 重要：确保数量字段没有被修改
                // 这里不需要修改数量，因为合成过程中数量字段本身没有被修改
                // 只是状态被改为了SYNTHESIZED
                System.out.println(String.format("恢复记录: ID=%d, 类型=%s, 数量=%.1f", 
                    record.getId(), record.getCodeValue(), record.getQuantity()));
            }
            if (!sourceRecords.isEmpty()) {
                settlementRecordRepository.saveAll(sourceRecords);
                System.out.println("恢复原始记录: " + sourceRecords.size() + " 条");
            }
            
            // 3. 删除合成日志
            List<Long> logIds = parseIdList(chain.getSynthesisLogIds());
            if (!logIds.isEmpty()) {
                synthesisLogRepository.deleteAllById(logIds);
                System.out.println("删除合成日志: " + logIds);
            }
            
            // 4. 删除合成链记录
            synthesisChainRepository.delete(chain);
            
        } catch (Exception e) {
            System.err.println("撤销合成链失败: " + e.getMessage());
            throw new RuntimeException("撤销合成链失败", e);
        }
    }
    
    /**
     * 撤销直接记录
     */
    private void revokeDirectRecords(List<SettlementRecord> directRecords) {
        if (!directRecords.isEmpty()) {
            settlementRecordRepository.deleteAll(directRecords);
            System.out.println("删除直接记录: " + directRecords.size() + " 条");
        }
    }
    
    /**
     * 查找合成链的原始记录
     */
    private List<SettlementRecord> findSourceRecords(SynthesisChain chain) {
        try {
            List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
            List<SettlementRecord> sourceRecords = new ArrayList<>();
            
            for (String batchId : sourceBatchIds) {
                List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                sourceRecords.addAll(batchRecords);
            }
            
            // 关键修复：查找所有被这个合成链影响的记录，包括状态为SYNTHESIZED的
            return sourceRecords.stream()
                    .filter(record -> Objects.equals(record.getSynthesisChainId(), chain.getId()))
                    .collect(Collectors.toList());
            
        } catch (Exception e) {
            System.err.println("查找原始记录失败: " + e.getMessage());
            return new ArrayList<>();
        }
    }
    
    /**
     * 解析ID列表
     */
    private List<Long> parseIdList(String jsonString) {
        try {
            if (jsonString == null || jsonString.trim().isEmpty()) {
                return new ArrayList<>();
            }
            return objectMapper.readValue(jsonString, new TypeReference<List<Long>>() {});
        } catch (Exception e) {
            System.err.println("解析ID列表失败: " + e.getMessage());
            return new ArrayList<>();
        }
    }
    
    /**
     * 解析字符串列表
     */
    private List<String> parseStringList(String jsonString) {
        try {
            if (jsonString == null || jsonString.trim().isEmpty()) {
                return new ArrayList<>();
            }
            return objectMapper.readValue(jsonString, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            System.err.println("解析字符串列表失败: " + e.getMessage());
            return new ArrayList<>();
        }
    }
    
    /**
     * 检查批次是否可以直接撤销（不涉及合成）
     */
    public boolean canDirectRevoke(String batchId) {
        List<SynthesisChain> affectedChains = synthesisChainRepository.findBySourceBatchIdsContaining(batchId);
        return affectedChains.isEmpty();
    }
    
    /**
     * 查找使用了指定记录的合成链
     */
    private List<SynthesisChain> findChainsUsingRecord(Long recordId) {
        try {
            // 查找所有合成链
            List<SynthesisChain> allChains = synthesisChainRepository.findAll();
            List<SynthesisChain> usingChains = new ArrayList<>();
            
            for (SynthesisChain chain : allChains) {
                // 检查这个记录是否在合成链的源记录中
                List<String> sourceBatchIds = parseStringList(chain.getSourceBatchIds());
                
                // 需要检查这个recordId是否属于源批次中的记录
                for (String batchId : sourceBatchIds) {
                    List<SettlementRecord> batchRecords = settlementRecordRepository.findBySettlementBatchId(batchId);
                    boolean containsRecord = batchRecords.stream()
                            .anyMatch(record -> record.getId().equals(recordId));
                    
                    if (containsRecord) {
                        usingChains.add(chain);
                        break; // 找到了，不需要继续检查这个链的其他批次
                    }
                }
            }
            
            return usingChains;
            
        } catch (Exception e) {
            System.err.println("查找依赖合成链失败: " + e.getMessage());
            return new ArrayList<>();
        }
    }
    
    /**
     * 验证撤销操作
     */
    public void validateRevocation(String batchId) {
        List<SettlementRecord> records = settlementRecordRepository.findBySettlementBatchId(batchId);
        
        if (records.isEmpty()) {
            // 检查是否已被合成
            boolean hasBeenSynthesized = synthesisLogRepository.existsBySourceBatchIds(batchId);
            if (hasBeenSynthesized) {
                throw new RuntimeException("该结算记录已被合成，需要使用级联撤销");
            } else {
                throw new RuntimeException("找不到要撤销的结算记录");
            }
        }
    }
}

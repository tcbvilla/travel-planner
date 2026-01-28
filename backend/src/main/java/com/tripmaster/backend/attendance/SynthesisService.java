package com.tripmaster.backend.attendance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SynthesisService {
    
    @Autowired
    private SettlementRecordRepository settlementRecordRepository;
    
    @Autowired
    private SynthesisChainRepository synthesisChainRepository;
    
    @Autowired
    private SynthesisLogRepository synthesisLogRepository;
    
    @Autowired
    private SeasonRepository seasonRepository;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 检查并执行合成操作
     */
    @Transactional
    public void checkAndPerformSynthesis(Long seasonId, String triggerBatchId, Long attendanceSessionId) {
        System.out.println("开始检查合成条件，赛季ID: " + seasonId + ", 触发批次: " + triggerBatchId);
        
        // 获取赛季信息
        Season season = seasonRepository.findById(seasonId)
                .orElseThrow(() -> new RuntimeException("赛季不存在"));
        
        // 按团队分组获取活跃的结算记录
        Map<String, List<SettlementRecord>> teamRecords = getActiveRecordsByTeam(seasonId);
        
        // 为每个团队检查合成条件
        for (Map.Entry<String, List<SettlementRecord>> entry : teamRecords.entrySet()) {
            String teamName = entry.getKey();
            List<SettlementRecord> records = entry.getValue();
            
            // 统计各类物品数量
            Map<String, List<SettlementRecord>> itemCounts = groupRecordsByCodeValue(records);
            
            // 检查并执行合成
            checkAndSynthesizeForTeam(teamName, seasonId, season.getName(), itemCounts, triggerBatchId, attendanceSessionId);
        }
    }
    
    /**
     * 检查并执行合成操作（兼容旧版本）
     */
    @Transactional
    public void checkAndPerformSynthesis(Long seasonId) {
        checkAndPerformSynthesis(seasonId, null, null);
    }
    
    /**
     * 获取赛季中所有团队的活跃结算记录
     */
    private Map<String, List<SettlementRecord>> getActiveRecordsByTeam(Long seasonId) {
        List<SettlementRecord> allRecords = settlementRecordRepository.findBySeasonId(seasonId);
        
        return allRecords.stream()
                .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                .filter(record -> "CODE_TABLE".equals(record.getRewardMode())) // 只处理码表奖励
                .collect(Collectors.groupingBy(SettlementRecord::getTeamName));
    }
    
    /**
     * 按码表值分组记录（现在后台已经存储基础类型，不需要转换）
     */
    private Map<String, List<SettlementRecord>> groupRecordsByCodeValue(List<SettlementRecord> records) {
        return records.stream()
                .collect(Collectors.groupingBy(SettlementRecord::getCodeValue));
    }
    
    /**
     * 为单个团队检查并执行合成
     */
    private void checkAndSynthesizeForTeam(String teamName, Long seasonId, String seasonName, 
                                         Map<String, List<SettlementRecord>> itemCounts, 
                                         String triggerBatchId, Long attendanceSessionId) {
        
        boolean hasSynthesis;
        int maxIterations = 10; // 防止无限循环
        int iteration = 0;
        
        do {
            hasSynthesis = false;
            iteration++;
            System.out.println(String.format("团队 %s 第 %d 轮合成检查", teamName, iteration));
            
            // 重新获取最新的记录状态
            Map<String, List<SettlementRecord>> currentItemCounts = getActiveRecordsByTeam(seasonId)
                    .getOrDefault(teamName, new ArrayList<>())
                    .stream()
                    .collect(Collectors.groupingBy(SettlementRecord::getCodeValue));
            
            // 检查花瓣合成花
            if (checkAndSynthesizePetalsToFlower(teamName, seasonId, seasonName, currentItemCounts, triggerBatchId, attendanceSessionId)) {
                hasSynthesis = true;
            }
            
            // 检查花合成现金
            if (checkAndSynthesizeFlowerToCash(teamName, seasonId, seasonName, currentItemCounts, triggerBatchId, attendanceSessionId)) {
                hasSynthesis = true;
            }
            
            // 检查屎粒合成屎
            if (checkAndSynthesizeShitParticlesToShit(teamName, seasonId, seasonName, currentItemCounts, triggerBatchId, attendanceSessionId)) {
                hasSynthesis = true;
            }
            
            // 检查屎合成现金惩罚
            if (checkAndSynthesizeShitToCash(teamName, seasonId, seasonName, currentItemCounts, triggerBatchId, attendanceSessionId)) {
                hasSynthesis = true;
            }
            
        } while (hasSynthesis && iteration < maxIterations);
        
        if (iteration >= maxIterations) {
            System.out.println(String.format("团队 %s 合成检查达到最大迭代次数，可能存在循环依赖", teamName));
        }
    }
    
    /**
     * 检查并合成：3个花瓣 → 1个花
     */
    private boolean checkAndSynthesizePetalsToFlower(String teamName, Long seasonId, String seasonName,
                                                Map<String, List<SettlementRecord>> itemCounts,
                                                String triggerBatchId, Long attendanceSessionId) {
        List<SettlementRecord> petalRecords = itemCounts.getOrDefault("花瓣", new ArrayList<>());
        
        // 简化逻辑：每条记录quantity=1，直接计算记录数量
        int totalPetals = petalRecords.size();
        
        if (totalPetals >= 3) {
            int synthesisCount = totalPetals / 3;
            
            System.out.println(String.format("团队 %s 花瓣总数: %d, 可合成次数: %d", teamName, totalPetals, synthesisCount));
            
            // 获取所有ACTIVE状态的花瓣记录
            List<SettlementRecord> currentPetalRecords = getActiveRecordsByTeam(seasonId)
                    .getOrDefault(teamName, new ArrayList<>())
                    .stream()
                    .filter(record -> "花瓣".equals(record.getCodeValue()))
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            // 逐次处理合成，每次重新获取最新状态
            for (int i = 0; i < synthesisCount; i++) {
                // 每次合成前重新获取最新的ACTIVE记录，按ID降序排序（优先使用最新创建的记录）
                List<SettlementRecord> latestPetalRecords = getActiveRecordsByTeam(seasonId)
                        .getOrDefault(teamName, new ArrayList<>())
                        .stream()
                        .filter(record -> "花瓣".equals(record.getCodeValue()))
                        .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                        .sorted((r1, r2) -> Long.compare(r2.getId(), r1.getId())) // 按ID降序，优先使用最新记录
                        .collect(Collectors.toList());
                
                System.out.println(String.format("  [花瓣→花] 第%d次合成，查询到%d条ACTIVE花瓣记录，ID列表: %s", 
                    i + 1, latestPetalRecords.size(),
                    latestPetalRecords.stream().map(r -> r.getId().toString()).collect(Collectors.joining(", "))));
                
                // 检查是否还有足够的记录进行合成
                if (latestPetalRecords.size() >= 3) {
                    List<SettlementRecord> selectedRecords = latestPetalRecords.subList(0, 3);
                    
                    System.out.println(String.format("  [花瓣→花] 选择的3条记录ID: %s", 
                        selectedRecords.stream().map(r -> r.getId().toString()).collect(Collectors.joining(", "))));
                    
                    synthesizeItems(teamName, seasonId, seasonName, selectedRecords, "花", "UPGRADE", 
                                  "3个花瓣合成1个花", triggerBatchId, attendanceSessionId);
                } else {
                    // 如果记录不足，跳出循环
                    break;
                }
            }
            
            System.out.println(String.format("团队 %s 完成 %d 次花瓣→花 合成", teamName, synthesisCount));
            return true; // 发生了合成
        }
        
        return false; // 没有发生合成
    }
    
    /**
     * 检查并合成：3个花 → 648元现金
     */
    private boolean checkAndSynthesizeFlowerToCash(String teamName, Long seasonId, String seasonName,
                                              Map<String, List<SettlementRecord>> itemCounts,
                                              String triggerBatchId, Long attendanceSessionId) {
        List<SettlementRecord> flowerRecords = itemCounts.getOrDefault("花", new ArrayList<>());
        
        // 简化逻辑：每条记录quantity=1，直接计算记录数量
        int totalFlowers = flowerRecords.size();
        
        if (totalFlowers >= 3) {
            int synthesisCount = totalFlowers / 3;
            
            System.out.println(String.format("团队 %s 花总数: %d, 可合成次数: %d", teamName, totalFlowers, synthesisCount));
            
            // 获取所有ACTIVE状态的花记录
            List<SettlementRecord> currentFlowerRecords = getActiveRecordsByTeam(seasonId)
                    .getOrDefault(teamName, new ArrayList<>())
                    .stream()
                    .filter(record -> "花".equals(record.getCodeValue()))
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            // 逐次处理合成，每次重新获取最新状态
            for (int i = 0; i < synthesisCount; i++) {
                // 每次合成前重新获取最新的ACTIVE记录，按ID降序排序（优先使用最新创建的记录）
                List<SettlementRecord> latestFlowerRecords = getActiveRecordsByTeam(seasonId)
                        .getOrDefault(teamName, new ArrayList<>())
                        .stream()
                        .filter(record -> "花".equals(record.getCodeValue()))
                        .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                        .sorted((r1, r2) -> Long.compare(r2.getId(), r1.getId())) // 按ID降序，优先使用最新记录
                        .collect(Collectors.toList());
                
                System.out.println(String.format("  [花→现金] 第%d次合成，查询到%d条ACTIVE花记录，ID列表: %s", 
                    i + 1, latestFlowerRecords.size(),
                    latestFlowerRecords.stream().map(r -> "ID:" + r.getId() + "(批次:" + r.getSettlementBatchId() + ",合成链:" + r.getSynthesisChainId() + ")").collect(Collectors.joining(", "))));
                
                // 检查是否还有足够的记录进行合成
                if (latestFlowerRecords.size() >= 3) {
                    List<SettlementRecord> selectedRecords = latestFlowerRecords.subList(0, 3);
                    
                    System.out.println(String.format("  [花→现金] 选择的3条记录: %s", 
                        selectedRecords.stream().map(r -> "ID:" + r.getId() + "(批次:" + r.getSettlementBatchId() + ")").collect(Collectors.joining(", "))));
                    
                    synthesizeItemsToCash(teamName, seasonId, seasonName, selectedRecords, 
                                        BigDecimal.valueOf(648), "CASH_CONVERT", "3个花合成648元现金",
                                        triggerBatchId, attendanceSessionId);
                } else {
                    // 如果记录不足，跳出循环
                    break;
                }
            }
            
            System.out.println(String.format("团队 %s 完成 %d 次花→现金 合成", teamName, synthesisCount));
            return true; // 发生了合成
        }
        
        return false; // 没有发生合成
    }
    
    /**
     * 检查并合成：3个屎粒 → 1个屎
     */
    private boolean checkAndSynthesizeShitParticlesToShit(String teamName, Long seasonId, String seasonName,
                                                     Map<String, List<SettlementRecord>> itemCounts,
                                                     String triggerBatchId, Long attendanceSessionId) {
        List<SettlementRecord> shitParticleRecords = itemCounts.getOrDefault("屎粒", new ArrayList<>());
        
        // 简化逻辑：每条记录quantity=1，直接计算记录数量
        int totalShitParticles = shitParticleRecords.size();
        
        if (totalShitParticles >= 3) {
            int synthesisCount = totalShitParticles / 3;
            
            System.out.println(String.format("团队 %s 屎粒总数: %d, 可合成次数: %d", teamName, totalShitParticles, synthesisCount));
            
            // 获取所有ACTIVE状态的屎粒记录
            List<SettlementRecord> currentShitParticleRecords = getActiveRecordsByTeam(seasonId)
                    .getOrDefault(teamName, new ArrayList<>())
                    .stream()
                    .filter(record -> "屎粒".equals(record.getCodeValue()))
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            // 逐次处理合成，每次重新获取最新状态
            for (int i = 0; i < synthesisCount; i++) {
                // 每次合成前重新获取最新的ACTIVE记录，按ID降序排序（优先使用最新创建的记录）
                List<SettlementRecord> latestShitParticleRecords = getActiveRecordsByTeam(seasonId)
                        .getOrDefault(teamName, new ArrayList<>())
                        .stream()
                        .filter(record -> "屎粒".equals(record.getCodeValue()))
                        .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                        .sorted((r1, r2) -> Long.compare(r2.getId(), r1.getId())) // 按ID降序，优先使用最新记录
                        .collect(Collectors.toList());
                
                System.out.println(String.format("  [屎粒→屎] 第%d次合成，查询到%d条ACTIVE屎粒记录，ID列表: %s", 
                    i + 1, latestShitParticleRecords.size(),
                    latestShitParticleRecords.stream().map(r -> r.getId().toString()).collect(Collectors.joining(", "))));
                
                // 检查是否还有足够的记录进行合成
                if (latestShitParticleRecords.size() >= 3) {
                    List<SettlementRecord> selectedRecords = latestShitParticleRecords.subList(0, 3);
                    
                    System.out.println(String.format("  [屎粒→屎] 选择的3条记录ID: %s", 
                        selectedRecords.stream().map(r -> r.getId().toString()).collect(Collectors.joining(", "))));
                    
                    synthesizeItems(teamName, seasonId, seasonName, selectedRecords, "屎", "UPGRADE",
                                  "3个屎粒合成1个屎", triggerBatchId, attendanceSessionId);
                } else {
                    // 如果记录不足，跳出循环
                    break;
                }
            }
            
            System.out.println(String.format("团队 %s 完成 %d 次屎粒→屎 合成", teamName, synthesisCount));
            return true; // 发生了合成
        }
        
        return false; // 没有发生合成
    }
    
    /**
     * 检查并合成：3个屎 → -648元现金惩罚
     */
    private boolean checkAndSynthesizeShitToCash(String teamName, Long seasonId, String seasonName,
                                            Map<String, List<SettlementRecord>> itemCounts,
                                            String triggerBatchId, Long attendanceSessionId) {
        List<SettlementRecord> shitRecords = itemCounts.getOrDefault("屎", new ArrayList<>());
        
        // 简化逻辑：每条记录quantity=1，直接计算记录数量
        int totalShits = shitRecords.size();
        
        if (totalShits >= 3) {
            int synthesisCount = totalShits / 3;
            
            System.out.println(String.format("团队 %s 屎总数: %d, 可合成次数: %d", teamName, totalShits, synthesisCount));
            
            // 获取所有ACTIVE状态的屎记录
            List<SettlementRecord> currentShitRecords = getActiveRecordsByTeam(seasonId)
                    .getOrDefault(teamName, new ArrayList<>())
                    .stream()
                    .filter(record -> "屎".equals(record.getCodeValue()))
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            System.out.println(String.format("团队 %s 屎记录详情: %s", teamName, 
                currentShitRecords.stream()
                    .map(r -> "ID:" + r.getId() + ",状态:" + r.getRecordStatus())
                    .collect(Collectors.joining(", "))));
            
            // 逐次处理合成，每次重新获取最新状态
            for (int i = 0; i < synthesisCount; i++) {
                // 每次合成前重新获取最新的ACTIVE记录，按ID降序排序（优先使用最新创建的记录）
                List<SettlementRecord> latestShitRecords = getActiveRecordsByTeam(seasonId)
                        .getOrDefault(teamName, new ArrayList<>())
                        .stream()
                        .filter(record -> "屎".equals(record.getCodeValue()))
                        .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                        .sorted((r1, r2) -> Long.compare(r2.getId(), r1.getId())) // 按ID降序，优先使用最新记录
                        .collect(Collectors.toList());
                
                System.out.println(String.format("  [屎→现金] 第%d次合成，查询到%d条ACTIVE屎记录，ID列表: %s", 
                    i + 1, latestShitRecords.size(),
                    latestShitRecords.stream().map(r -> "ID:" + r.getId() + "(批次:" + r.getSettlementBatchId() + ",合成链:" + r.getSynthesisChainId() + ")").collect(Collectors.joining(", "))));
                
                // 检查是否还有足够的记录进行合成
                if (latestShitRecords.size() >= 3) {
                    List<SettlementRecord> selectedRecords = latestShitRecords.subList(0, 3);
                    
                    System.out.println(String.format("  [屎→现金] 选择的3条记录: %s", 
                        selectedRecords.stream().map(r -> "ID:" + r.getId() + "(批次:" + r.getSettlementBatchId() + ")").collect(Collectors.joining(", "))));
                    
                    synthesizeItemsToCash(teamName, seasonId, seasonName, selectedRecords, 
                                        BigDecimal.valueOf(-648), "CASH_CONVERT", "3个屎合成-648元现金惩罚",
                                        triggerBatchId, attendanceSessionId);
                    
                    System.out.println(String.format("  [屎→现金] 第%d次合成完成", i + 1));
                } else {
                    // 如果记录不足，跳出循环
                    System.out.println(String.format("  [屎→现金] 第%d次合成时记录不足: %d < 3，跳出循环", i + 1, latestShitRecords.size()));
                    break;
                }
            }
            
            System.out.println(String.format("团队 %s 完成 %d 次屎→现金 合成", teamName, synthesisCount));
            return true; // 发生了合成
        }
        
        return false; // 没有发生合成
    }
    
    /**
     * 执行码表物品合成
     */
    private void synthesizeItems(String teamName, Long seasonId, String seasonName,
                               List<SettlementRecord> sourceRecords, String targetCodeValue,
                               String synthesisType, String synthesisDescription,
                               String triggerBatchId, Long attendanceSessionId) {
        
        // 创建合成链
        SynthesisChain chain = createSynthesisChain(teamName, seasonId, sourceRecords, synthesisType,
                                                  sourceRecords.get(0).getCodeValue(), targetCodeValue,
                                                  triggerBatchId, attendanceSessionId);
        
        // 先保存合成链获得ID
        chain = synthesisChainRepository.save(chain);
        
        // 创建合成后的记录
        SettlementRecord synthesizedRecord = createCodeTableRecord(teamName, sourceRecords.get(0).getAttendanceSession(),
                                                                  targetCodeValue, chain);
        
        // 保存合成记录获得ID
        synthesizedRecord = settlementRecordRepository.save(synthesizedRecord);
        
        System.out.println(String.format("  [合成完成] 创建新记录ID: %d, 类型: %s, 批次: %s, 合成链ID: %d", 
            synthesizedRecord.getId(), targetCodeValue, synthesizedRecord.getSettlementBatchId(), chain.getId()));
        
        // 标记原始记录为已合成
        markRecordsAsSynthesized(sourceRecords, chain.getId());
        
        // 创建合成日志
        SynthesisLog log = createSynthesisLog(teamName, seasonName, synthesisType, sourceRecords,
                                            synthesizedRecord, synthesisDescription, chain.getId());
        
        // 保存合成日志获得ID
        log = synthesisLogRepository.save(log);
        
        // 更新合成链信息
        updateSynthesisChain(chain, Arrays.asList(synthesizedRecord.getId()), Arrays.asList(log.getId()));
        
        // 保存所有变更
        synthesisChainRepository.save(chain);
        settlementRecordRepository.saveAll(sourceRecords);
    }
    
    /**
     * 执行合成为现金
     */
    private void synthesizeItemsToCash(String teamName, Long seasonId, String seasonName,
                                     List<SettlementRecord> sourceRecords, BigDecimal cashAmount,
                                     String synthesisType, String synthesisDescription,
                                     String triggerBatchId, Long attendanceSessionId) {
        
        // 创建合成链
        SynthesisChain chain = createSynthesisChain(teamName, seasonId, sourceRecords, synthesisType,
                                                  sourceRecords.get(0).getCodeValue(), "现金",
                                                  triggerBatchId, attendanceSessionId);
        
        // 先保存合成链获得ID
        chain = synthesisChainRepository.save(chain);
        
        // 创建现金记录
        SettlementRecord cashRecord = createCashRecord(teamName, sourceRecords.get(0).getAttendanceSession(),
                                                     cashAmount, chain);
        
        // 保存现金记录获得ID
        cashRecord = settlementRecordRepository.save(cashRecord);
        
        System.out.println(String.format("  [合成完成] 创建新现金记录ID: %d, 金额: %s, 批次: %s, 合成链ID: %d", 
            cashRecord.getId(), cashAmount, cashRecord.getSettlementBatchId(), chain.getId()));
        
        // 标记原始记录为已合成
        markRecordsAsSynthesized(sourceRecords, chain.getId());
        
        // 创建合成日志
        SynthesisLog log = createSynthesisLog(teamName, seasonName, synthesisType, sourceRecords,
                                            cashRecord, synthesisDescription, chain.getId());
        
        // 保存合成日志获得ID
        log = synthesisLogRepository.save(log);
        
        // 更新合成链信息
        updateSynthesisChain(chain, Arrays.asList(cashRecord.getId()), Arrays.asList(log.getId()));
        
        // 保存所有变更
        synthesisChainRepository.save(chain);
        settlementRecordRepository.saveAll(sourceRecords);
    }
    
    /**
     * 创建合成链
     */
    private SynthesisChain createSynthesisChain(String teamName, Long seasonId, List<SettlementRecord> sourceRecords,
                                              String synthesisType, String sourceItemType, String targetItemType,
                                              String triggerBatchId, Long attendanceSessionId) {
        SynthesisChain chain = new SynthesisChain();
        chain.setTeamName(teamName);
        chain.setSeasonId(seasonId);
        chain.setSynthesisType(synthesisType);
        chain.setSourceItemType(sourceItemType);
        chain.setTargetItemType(targetItemType);
        chain.setTriggerSettlementBatchId(triggerBatchId);
        chain.setAttendanceSessionId(attendanceSessionId);
        
        // 修复：收集所有批次ID，包括原始批次(BATCH_/MANUAL_)和合成批次(SYNTHESIS_)
        // 这样可以正确追踪依赖关系，支持多级合成的级联撤销
        Set<String> allBatchIds = new HashSet<>();
        
        for (SettlementRecord record : sourceRecords) {
            String batchId = record.getSettlementBatchId();
            
            if (batchId.startsWith("BATCH_") || batchId.startsWith("MANUAL_")) {
                // 直接记录原始批次ID
                allBatchIds.add(batchId);
            } else if (batchId.startsWith("SYNTHESIS_")) {
                // 对于合成记录，既要记录其批次ID，也要追溯到原始批次
                allBatchIds.add(batchId);
                
                // 追溯到原始批次
                if (record.getSynthesisChainId() != null) {
                    SynthesisChain sourceChain = synthesisChainRepository.findById(record.getSynthesisChainId())
                            .orElse(null);
                    if (sourceChain != null) {
                        try {
                            List<String> chainOriginalBatchIds = objectMapper.readValue(
                                    sourceChain.getSourceBatchIds(), new TypeReference<List<String>>() {});
                            allBatchIds.addAll(chainOriginalBatchIds);
                        } catch (Exception e) {
                            System.err.println("解析源合成链批次ID失败: " + e.getMessage());
                        }
                    }
                }
            }
        }
        
        List<String> sourceBatchIds = new ArrayList<>(allBatchIds);
        System.out.println(String.format("  [创建合成链] 源批次ID: %s", sourceBatchIds));
        
        try {
            chain.setSourceBatchIds(objectMapper.writeValueAsString(sourceBatchIds));
            // 初始化为空数组，后续会更新
            chain.setSynthesisRecordIds("[]");
            chain.setSynthesisLogIds("[]");
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化批次ID失败", e);
        }
        
        return chain;
    }
    
    /**
     * 追溯到原始批次ID
     */
    private List<String> traceToOriginalBatchIds(List<SettlementRecord> sourceRecords) {
        Set<String> originalBatchIds = new HashSet<>();
        
        for (SettlementRecord record : sourceRecords) {
            if (record.getSettlementBatchId().startsWith("BATCH_") || record.getSettlementBatchId().startsWith("MANUAL_")) {
                // 如果是原始批次或手动批次，直接添加
                originalBatchIds.add(record.getSettlementBatchId());
            } else if (record.getSynthesisChainId() != null) {
                // 如果是合成记录，查找其源合成链的原始批次
                SynthesisChain sourceChain = synthesisChainRepository.findById(record.getSynthesisChainId())
                        .orElse(null);
                if (sourceChain != null) {
                    try {
                        List<String> chainOriginalBatchIds = objectMapper.readValue(
                                sourceChain.getSourceBatchIds(), new TypeReference<List<String>>() {});
                        originalBatchIds.addAll(chainOriginalBatchIds);
                    } catch (Exception e) {
                        System.err.println("解析源合成链批次ID失败: " + e.getMessage());
                    }
                }
            }
        }
        
        return new ArrayList<>(originalBatchIds);
    }
    
    /**
     * 创建码表记录
     */
    private SettlementRecord createCodeTableRecord(String teamName, AttendanceSession session,
                                                 String codeValue, SynthesisChain chain) {
        SettlementRecord record = new SettlementRecord();
        record.setTeamName(teamName);
        record.setCodeValue(codeValue);
        record.setQuantity(BigDecimal.ONE);
        record.setRewardMode("CODE_TABLE");
        record.setSettlementBatchId("SYNTHESIS_" + chain.getId() + "_" + System.currentTimeMillis());
        record.setAttendanceSession(session);
        record.setSynthesisChainId(chain.getId());
        record.setIsSynthetic(true);
        record.setRecordStatus("ACTIVE");
        
        return record;
    }
    
    /**
     * 创建现金记录
     */
    private SettlementRecord createCashRecord(String teamName, AttendanceSession session,
                                            BigDecimal cashAmount, SynthesisChain chain) {
        SettlementRecord record = new SettlementRecord();
        record.setTeamName(teamName);
        record.setCodeValue(null); // 现金记录不需要码表值
        record.setQuantity(BigDecimal.ONE);
        record.setCashAmount(cashAmount);
        record.setRewardMode("CASH");
        record.setSettlementBatchId("SYNTHESIS_CASH_" + chain.getId() + "_" + System.currentTimeMillis());
        record.setAttendanceSession(session);
        record.setSynthesisChainId(chain.getId());
        record.setIsSynthetic(true);
        record.setRecordStatus("ACTIVE");
        
        return record;
    }
    
    /**
     * 标记记录为已合成
     */
    private void markRecordsAsSynthesized(List<SettlementRecord> records, Long chainId) {
        for (SettlementRecord record : records) {
            record.setSynthesisChainId(chainId);
            record.setRecordStatus("SYNTHESIZED");
        }
    }
    
    /**
     * 创建合成日志
     */
    private SynthesisLog createSynthesisLog(String teamName, String seasonName, String synthesisType,
                                          List<SettlementRecord> sourceRecords, SettlementRecord targetRecord,
                                          String description, Long chainId) {
        SynthesisLog log = new SynthesisLog();
        log.setTeamName(teamName);
        log.setSeasonName(seasonName);
        log.setSynthesisType(synthesisType);
        log.setSynthesisContent(description);
        log.setSynthesisChainId(chainId);
        
        try {
            // 序列化源物品信息
            List<Map<String, Object>> sourceItems = sourceRecords.stream()
                    .map(this::recordToMap)
                    .collect(Collectors.toList());
            log.setSourceItems(objectMapper.writeValueAsString(sourceItems));
            
            // 序列化目标物品信息
            log.setTargetItem(objectMapper.writeValueAsString(recordToMap(targetRecord)));
            
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化合成物品信息失败", e);
        }
        
        return log;
    }
    
    /**
     * 将记录转换为Map
     */
    private Map<String, Object> recordToMap(SettlementRecord record) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", record.getId());
        map.put("teamName", record.getTeamName());
        map.put("codeValue", record.getCodeValue());
        map.put("quantity", record.getQuantity());
        map.put("cashAmount", record.getCashAmount());
        map.put("rewardMode", record.getRewardMode());
        map.put("batchId", record.getSettlementBatchId());
        return map;
    }
    
    /**
     * 更新合成链信息
     */
    private void updateSynthesisChain(SynthesisChain chain, List<Long> recordIds, List<Long> logIds) {
        try {
            chain.setSynthesisRecordIds(objectMapper.writeValueAsString(recordIds));
            chain.setSynthesisLogIds(objectMapper.writeValueAsString(logIds));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("更新合成链信息失败", e);
        }
    }
}

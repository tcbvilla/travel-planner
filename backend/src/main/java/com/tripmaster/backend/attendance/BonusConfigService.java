package com.tripmaster.backend.attendance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.time.LocalDateTime;

@Service
public class BonusConfigService {
    
    private static final String TEAM_SIZE_BONUS_KEY = "team_size_bonus";
    
    @Autowired
    private BonusConfigRepository bonusConfigRepository;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    /**
     * 获取团队人数加成配置
     */
    public BonusConfigData getTeamSizeBonusConfig() {
        try {
            Optional<BonusConfig> configOpt = bonusConfigRepository.findByConfigKeyAndIsActive(TEAM_SIZE_BONUS_KEY, true);
            
            if (configOpt.isPresent()) {
                BonusConfig config = configOpt.get();
                return objectMapper.readValue(config.getConfigValue(), BonusConfigData.class);
            } else {
                // 返回空配置（用户可以后期添加）
                return new BonusConfigData();
            }
        } catch (Exception e) {
            System.err.println("解析加成配置失败: " + e.getMessage());
            e.printStackTrace();
            // 出错时返回空配置
            return new BonusConfigData();
        }
    }
    
    /**
     * 更新团队人数加成配置
     */
    public void updateTeamSizeBonusConfig(BonusConfigData configData) throws Exception {
        // 1. 验证配置数据
        validateBonusConfigData(configData);
        
        try {
            // 2. 将配置数据转换为JSON
            String configJson = objectMapper.writeValueAsString(configData);
            
            // 3. 查找现有配置或创建新配置
            Optional<BonusConfig> existingConfigOpt = bonusConfigRepository.findByConfigKey(TEAM_SIZE_BONUS_KEY);
            
            BonusConfig config;
            if (existingConfigOpt.isPresent()) {
                // 更新现有配置
                config = existingConfigOpt.get();
                config.setConfigValue(configJson);
                config.setUpdatedAt(LocalDateTime.now());
            } else {
                // 创建新配置
                config = new BonusConfig();
                config.setConfigKey(TEAM_SIZE_BONUS_KEY);
                config.setConfigValue(configJson);
                config.setConfigType("JSON");
                config.setDescription("团队人数加成规则配置");
                config.setIsActive(true);
            }
            
            // 4. 保存配置
            bonusConfigRepository.save(config);
            
        } catch (Exception e) {
            throw new Exception("保存加成配置失败: " + e.getMessage());
        }
    }
    
    /**
     * 验证加成配置数据
     */
    private void validateBonusConfigData(BonusConfigData configData) throws Exception {
        if (configData == null) {
            throw new Exception("配置数据不能为空");
        }
        
        if (configData.getTeamSizeBonusRules() == null) {
            return; // 空规则列表是允许的
        }
        
        // 1. 验证每个规则的有效性
        for (TeamSizeBonusRule rule : configData.getTeamSizeBonusRules()) {
            validateSingleRule(rule);
        }
        
        // 2. 验证规则之间是否有重叠
        if (configData.hasOverlappingRules()) {
            throw new Exception("规则验证失败: " + configData.getOverlapInfo());
        }
    }
    
    /**
     * 验证单个规则的有效性
     */
    private void validateSingleRule(TeamSizeBonusRule rule) throws Exception {
        if (rule == null) {
            throw new Exception("规则不能为空");
        }
        
        if (rule.getMinSize() == null || rule.getMaxSize() == null) {
            throw new Exception("人数范围不能为空");
        }
        
        if (rule.getMinSize() < 1) {
            throw new Exception("最小人数必须大于0");
        }
        
        if (rule.getMaxSize() < rule.getMinSize()) {
            throw new Exception("最大人数不能小于最小人数");
        }
        
        if (rule.getAttendanceRateBonus() == null) {
            throw new Exception("出勤率加成不能为空");
        }
        
        if (rule.getAttendanceRateBonus() < 0) {
            throw new Exception("出勤率加成不能为负数");
        }
        
        if (rule.getMeritBonus() == null) {
            throw new Exception("战功加成倍数不能为空");
        }
        
        if (rule.getMeritBonus() <= 0) {
            throw new Exception("战功加成倍数必须大于0");
        }
    }
    
    /**
     * 根据团队人数获取适用的加成规则
     */
    public TeamSizeBonusRule getApplicableBonusRule(int memberCount) {
        BonusConfigData config = getTeamSizeBonusConfig();
        return config.findApplicableRule(memberCount);
    }
    
    /**
     * 检查配置是否存在
     */
    public boolean hasTeamSizeBonusConfig() {
        BonusConfigData config = getTeamSizeBonusConfig();
        return config.getTeamSizeBonusRules() != null && !config.getTeamSizeBonusRules().isEmpty();
    }
}

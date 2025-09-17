package com.tripmaster.backend.attendance;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;
import java.util.ArrayList;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BonusConfigData {
    private List<TeamSizeBonusRule> teamSizeBonusRules = new ArrayList<>();
    
    /**
     * 根据团队人数查找适用的加成规则
     */
    public TeamSizeBonusRule findApplicableRule(int memberCount) {
        return teamSizeBonusRules.stream()
                .filter(rule -> rule.isApplicable(memberCount))
                .findFirst()
                .orElse(null);
    }
    
    /**
     * 验证所有规则是否有重叠
     */
    public boolean hasOverlappingRules() {
        for (int i = 0; i < teamSizeBonusRules.size(); i++) {
            for (int j = i + 1; j < teamSizeBonusRules.size(); j++) {
                if (teamSizeBonusRules.get(i).hasOverlapWith(teamSizeBonusRules.get(j))) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * 获取重叠的规则信息
     */
    public String getOverlapInfo() {
        for (int i = 0; i < teamSizeBonusRules.size(); i++) {
            TeamSizeBonusRule rule1 = teamSizeBonusRules.get(i);
            for (int j = i + 1; j < teamSizeBonusRules.size(); j++) {
                TeamSizeBonusRule rule2 = teamSizeBonusRules.get(j);
                if (rule1.hasOverlapWith(rule2)) {
                    return String.format("规则冲突：%d-%d人 与 %d-%d人 区间重叠", 
                        rule1.getMinSize(), rule1.getMaxSize(),
                        rule2.getMinSize(), rule2.getMaxSize());
                }
            }
        }
        return "";
    }
}

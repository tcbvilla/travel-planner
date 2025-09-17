package com.tripmaster.backend.attendance;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamSizeBonusRule {
    private Integer minSize;
    private Integer maxSize;
    private Double attendanceRateBonus; // 出勤率加成（百分比，如3.0表示+3%）
    private Double meritBonus; // 战功加成倍数（如1.03表示×1.03）
    private String description;
    
    public TeamSizeBonusRule(Integer minSize, Integer maxSize, Double attendanceRateBonus, Double meritBonus) {
        this.minSize = minSize;
        this.maxSize = maxSize;
        this.attendanceRateBonus = attendanceRateBonus;
        this.meritBonus = meritBonus;
        this.description = String.format("%d-%d人团队加成", minSize, maxSize);
    }
    
    /**
     * 检查指定人数是否在此规则的范围内
     */
    public boolean isApplicable(int memberCount) {
        return memberCount >= minSize && memberCount <= maxSize;
    }
    
    /**
     * 检查与另一个规则是否有重叠
     */
    public boolean hasOverlapWith(TeamSizeBonusRule other) {
        if (other == null) return false;
        
        // 检查区间是否重叠
        return !(this.maxSize < other.minSize || this.minSize > other.maxSize);
    }
}

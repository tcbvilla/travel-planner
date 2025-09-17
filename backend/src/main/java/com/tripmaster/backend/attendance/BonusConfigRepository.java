package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface BonusConfigRepository extends JpaRepository<BonusConfig, Long> {
    
    /**
     * 根据配置键查找活跃的配置
     */
    Optional<BonusConfig> findByConfigKeyAndIsActive(String configKey, Boolean isActive);
    
    /**
     * 根据配置键查找配置（不考虑是否活跃）
     */
    Optional<BonusConfig> findByConfigKey(String configKey);
}

package com.tripmaster.backend.attendance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SystemConfigService {
    
    @Autowired
    private SystemConfigRepository repository;
    
    public boolean isMemberGroupMappingEnabled() {
        return repository.findByConfigKey("member_group_mapping_enabled")
            .map(config -> "true".equalsIgnoreCase(config.getConfigValue()))
            .orElse(true); // Default to enabled
    }
    
    public void setMemberGroupMappingEnabled(boolean enabled) {
        SystemConfig config = repository.findByConfigKey("member_group_mapping_enabled")
            .orElseGet(() -> {
                SystemConfig newConfig = new SystemConfig();
                newConfig.setConfigKey("member_group_mapping_enabled");
                newConfig.setDescription("Whether to enable member group mapping");
                return newConfig;
            });
        config.setConfigValue(String.valueOf(enabled));
        repository.save(config);
    }
}

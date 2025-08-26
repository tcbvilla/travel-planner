package com.tripmaster.backend.attendance;

public enum BattleResult {
    VICTORY("胜利"),
    DEFEAT("失败");
    
    private final String description;
    
    BattleResult(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}

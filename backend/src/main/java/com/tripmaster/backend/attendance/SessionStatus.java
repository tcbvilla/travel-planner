package com.tripmaster.backend.attendance;

public enum SessionStatus {
    ADDED("已添加"),
    SAVED("已保存"),
    SETTLED("已结算");
    
    private final String description;
    
    SessionStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}

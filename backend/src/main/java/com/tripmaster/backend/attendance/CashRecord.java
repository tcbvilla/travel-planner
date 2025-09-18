package com.tripmaster.backend.attendance;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CashRecord {
    private String sessionName;
    private LocalDateTime sessionTime;
    private String itemType;
    private Double cashAmount;
    private String description;
    private String battleResult;
    private Boolean isManual;
    
    public CashRecord() {}
    
    public CashRecord(String sessionName, LocalDateTime sessionTime, String itemType, 
                     Double cashAmount, String description, String battleResult, Boolean isManual) {
        this.sessionName = sessionName;
        this.sessionTime = sessionTime;
        this.itemType = itemType;
        this.cashAmount = cashAmount;
        this.description = description;
        this.battleResult = battleResult;
        this.isManual = isManual;
    }
}

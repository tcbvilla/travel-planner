package com.tripmaster.backend.attendance;

import lombok.Data;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_records")
@Data
public class PaymentRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "settlement_record_id", nullable = false, unique = true)
    private Long settlementRecordId;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "settlement_record_id", insertable = false, updatable = false)
    private SettlementRecord settlementRecord;
    
    @Column(name = "payment_time", nullable = false)
    private LocalDateTime paymentTime;
    
    @Column(name = "operator_account", nullable = false, length = 100)
    private String operatorAccount;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (paymentTime == null) {
            paymentTime = LocalDateTime.now();
        }
    }
}




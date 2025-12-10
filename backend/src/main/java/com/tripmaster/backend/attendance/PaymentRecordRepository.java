package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {
    
    /**
     * 根据结算记录ID查询支付记录
     */
    Optional<PaymentRecord> findBySettlementRecordId(Long settlementRecordId);
    
    /**
     * 批量查询支付记录
     */
    List<PaymentRecord> findBySettlementRecordIdIn(List<Long> settlementRecordIds);
    
    /**
     * 检查结算记录是否已支付
     */
    boolean existsBySettlementRecordId(Long settlementRecordId);
    
    /**
     * 删除指定结算记录的支付记录
     */
    void deleteBySettlementRecordId(Long settlementRecordId);
    
    /**
     * 批量删除支付记录
     */
    void deleteBySettlementRecordIdIn(List<Long> settlementRecordIds);
}



package com.tripmaster.backend.attendance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PaymentService {
    
    @Autowired
    private SettlementRecordRepository settlementRecordRepository;
    
    @Autowired
    private PaymentRecordRepository paymentRecordRepository;
    
    @Autowired
    private AttendanceSessionRepository attendanceSessionRepository;
    
    /**
     * 查询所有金额记录及支付状态（带分页和筛选）
     */
    public Page<PaymentRecordDetail> getPaymentRecordsWithDetails(
            Long seasonId,
            String teamName,
            String paymentStatus,  // ALL, PAID, UNPAID
            String recordType,     // ALL, SETTLEMENT, MANUAL, SYNTHESIS
            int pageNum,
            int pageSize) {
        
        // 1. 查询所有金额记录（只查询现金类型的）
        List<SettlementRecord> allRecords = settlementRecordRepository.findAll();
        
        // 2. 筛选出只有现金金额的记录
        List<SettlementRecord> cashRecords = allRecords.stream()
                .filter(record -> "CASH".equals(record.getRewardMode()) && record.getCashAmount() != null)
                .collect(Collectors.toList());
        
        // 3. 批量查询支付记录
        List<Long> recordIds = cashRecords.stream()
                .map(SettlementRecord::getId)
                .collect(Collectors.toList());
        
        Map<Long, PaymentRecord> paymentMap = paymentRecordRepository
                .findBySettlementRecordIdIn(recordIds)
                .stream()
                .collect(Collectors.toMap(PaymentRecord::getSettlementRecordId, p -> p));
        
        // 4. 构建详情列表
        List<PaymentRecordDetail> details = new ArrayList<>();
        
        for (SettlementRecord record : cashRecords) {
            PaymentRecordDetail detail = new PaymentRecordDetail();
            
            // 基本信息
            detail.setSettlementRecordId(record.getId());
            detail.setTeamName(record.getTeamName());
            detail.setSettlementBatchId(record.getSettlementBatchId());
            detail.setIsSynthetic(record.getIsSynthetic());
            
            // 金额信息
            detail.setRewardMode(record.getRewardMode());
            detail.setCodeValue(record.getCodeValue());
            detail.setQuantity(record.getQuantity());
            detail.setCashAmount(record.getCashAmount());
            
            // 关联考勤信息
            if (record.getAttendanceSession() != null) {
                AttendanceSession session = record.getAttendanceSession();
                detail.setAttendanceSessionName(session.getName());
                detail.setSessionTime(session.getStartTime());
                
                if (session.getSeason() != null) {
                    detail.setSeasonName(session.getSeason().getName());
                }
            }
            
            // 支付信息
            PaymentRecord payment = paymentMap.get(record.getId());
            if (payment != null) {
                detail.setIsPaid(true);
                detail.setPaymentTime(payment.getPaymentTime());
                detail.setOperatorAccount(payment.getOperatorAccount());
            } else {
                detail.setIsPaid(false);
            }
            
            // 记录类型
            detail.setRecordType(detail.determineRecordType());
            
            details.add(detail);
        }
        
        // 5. 筛选
        List<PaymentRecordDetail> filtered = details.stream()
                .filter(d -> filterBySeasonId(d, seasonId))
                .filter(d -> filterByTeamName(d, teamName))
                .filter(d -> filterByPaymentStatus(d, paymentStatus))
                .filter(d -> filterByRecordType(d, recordType))
                .collect(Collectors.toList());
        
        // 6. 分页
        Pageable pageable = PageRequest.of(pageNum - 1, pageSize);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        
        List<PaymentRecordDetail> pageContent = start < filtered.size() 
                ? filtered.subList(start, end) 
                : new ArrayList<>();
        
        return new PageImpl<>(pageContent, pageable, filtered.size());
    }
    
    private boolean filterBySeasonId(PaymentRecordDetail detail, Long seasonId) {
        if (seasonId == null) return true;
        // 由于我们需要根据 seasonId 筛选，需要在查询时关联 season 信息
        // 这里简化处理，实际应在查询层面优化
        return true;
    }
    
    private boolean filterByTeamName(PaymentRecordDetail detail, String teamName) {
        if (teamName == null || teamName.trim().isEmpty()) return true;
        return detail.getTeamName() != null && 
               detail.getTeamName().toLowerCase().contains(teamName.toLowerCase());
    }
    
    private boolean filterByPaymentStatus(PaymentRecordDetail detail, String paymentStatus) {
        if (paymentStatus == null || "ALL".equalsIgnoreCase(paymentStatus)) return true;
        if ("PAID".equalsIgnoreCase(paymentStatus)) return detail.getIsPaid();
        if ("UNPAID".equalsIgnoreCase(paymentStatus)) return !detail.getIsPaid();
        return true;
    }
    
    private boolean filterByRecordType(PaymentRecordDetail detail, String recordType) {
        if (recordType == null || "ALL".equalsIgnoreCase(recordType)) return true;
        String detailType = detail.getRecordType();
        if ("SETTLEMENT".equalsIgnoreCase(recordType)) return "结算记录".equals(detailType);
        if ("MANUAL".equalsIgnoreCase(recordType)) return "手动添加".equals(detailType);
        if ("SYNTHESIS".equalsIgnoreCase(recordType)) return "合成记录".equals(detailType);
        return true;
    }
    
    /**
     * 标记为已支付（单个或批量）
     */
    @Transactional
    public void markAsPaid(List<Long> recordIds, String operatorAccount) {
        if (recordIds == null || recordIds.isEmpty()) {
            throw new IllegalArgumentException("记录ID列表不能为空");
        }
        
        LocalDateTime now = LocalDateTime.now();
        
        for (Long recordId : recordIds) {
            // 检查记录是否存在
            if (!settlementRecordRepository.existsById(recordId)) {
                throw new RuntimeException("结算记录不存在: " + recordId);
            }
            
            // 检查是否已支付
            if (paymentRecordRepository.existsBySettlementRecordId(recordId)) {
                throw new RuntimeException("记录已支付，无需重复操作: " + recordId);
            }
            
            // 创建支付记录
            PaymentRecord payment = new PaymentRecord();
            payment.setSettlementRecordId(recordId);
            payment.setPaymentTime(now);
            payment.setOperatorAccount(operatorAccount);
            
            paymentRecordRepository.save(payment);
        }
    }
    
    /**
     * 撤销支付（删除支付记录）
     */
    @Transactional
    public void revokePaid(List<Long> recordIds) {
        if (recordIds == null || recordIds.isEmpty()) {
            throw new IllegalArgumentException("记录ID列表不能为空");
        }
        
        for (Long recordId : recordIds) {
            // 检查是否已支付
            if (!paymentRecordRepository.existsBySettlementRecordId(recordId)) {
                throw new RuntimeException("记录未支付，无法撤销: " + recordId);
            }
            
            // 删除支付记录
            paymentRecordRepository.deleteBySettlementRecordId(recordId);
        }
    }
    
    /**
     * 检查记录是否已支付（用于撤销校验）
     */
    public boolean isPaid(Long settlementRecordId) {
        return paymentRecordRepository.existsBySettlementRecordId(settlementRecordId);
    }
    
    /**
     * 批量检查记录是否已支付
     */
    public boolean anyPaid(List<Long> settlementRecordIds) {
        if (settlementRecordIds == null || settlementRecordIds.isEmpty()) {
            return false;
        }
        
        for (Long recordId : settlementRecordIds) {
            if (isPaid(recordId)) {
                return true;
            }
        }
        return false;
    }
}




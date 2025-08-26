package com.tripmaster.backend.reward;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class RewardService {
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private RewardRecordRepository rewardRecordRepository;
    
    /**
     * 保存或更新成员信息
     */
    public Member saveOrUpdateMember(String name, String groupName, Long totalMerit, 
                                   Integer attendanceCount, Integer totalSessions) {
        Optional<Member> existingMember = memberRepository.findByName(name);
        
        if (existingMember.isPresent()) {
            Member member = existingMember.get();
            member.setGroupName(groupName);
            member.setTotalMerit(totalMerit);
            member.setAttendanceCount(attendanceCount);
            member.setTotalSessions(totalSessions);
            member.setAttendanceRate(calculateAttendanceRate(attendanceCount, totalSessions));
            return memberRepository.save(member);
        } else {
            Member newMember = new Member();
            newMember.setName(name);
            newMember.setGroupName(groupName);
            newMember.setTotalMerit(totalMerit);
            newMember.setAttendanceCount(attendanceCount);
            newMember.setTotalSessions(totalSessions);
            newMember.setAttendanceRate(calculateAttendanceRate(attendanceCount, totalSessions));
            return memberRepository.save(newMember);
        }
    }
    
    /**
     * 添加奖惩记录
     */
    public RewardRecord addRewardRecord(String memberName, RewardType type, String reason, 
                                      Integer points, String sessionId) {
        Optional<Member> memberOpt = memberRepository.findByName(memberName);
        if (!memberOpt.isPresent()) {
            throw new RuntimeException("成员不存在: " + memberName);
        }
        
        RewardRecord record = new RewardRecord();
        record.setMember(memberOpt.get());
        record.setType(type);
        record.setReason(reason);
        record.setPoints(points);
        record.setSessionId(sessionId);
        
        return rewardRecordRepository.save(record);
    }
    
    /**
     * 根据出勤情况自动计算奖惩
     */
    public void calculateRewardsFromAttendance(List<AttendanceData> attendanceDataList, String sessionId) {
        for (AttendanceData data : attendanceDataList) {
            // 保存成员信息
            Member member = saveOrUpdateMember(
                data.getMemberName(), 
                data.getGroupName(), 
                data.getTotalMerit(), 
                data.getAttendanceCount(), 
                data.getTotalSessions()
            );
            
            // 根据出勤率计算奖惩
            if (data.getAttendanceRate() >= 80.0) {
                // 出勤率80%以上给予奖励
                addRewardRecord(member.getName(), RewardType.ATTENDANCE_BONUS, 
                              "出勤率达标奖励", 10, sessionId);
            } else if (data.getAttendanceRate() < 50.0) {
                // 出勤率50%以下给予惩罚
                addRewardRecord(member.getName(), RewardType.ABSENCE_PENALTY, 
                              "出勤率过低惩罚", -10, sessionId);
            }
            
            // 根据战功计算奖惩
            if (data.getTotalMerit() >= 1000000) {
                // 战功100万以上给予奖励
                addRewardRecord(member.getName(), RewardType.MERIT_BONUS, 
                              "战功突出奖励", 20, sessionId);
            } else if (data.getTotalMerit() < 100000) {
                // 战功10万以下给予惩罚
                addRewardRecord(member.getName(), RewardType.LOW_MERIT_PENALTY, 
                              "战功不足惩罚", -15, sessionId);
            }
        }
    }
    
    /**
     * 获取成员的所有奖惩记录
     */
    public List<RewardRecord> getMemberRewardRecords(String memberName) {
        Optional<Member> memberOpt = memberRepository.findByName(memberName);
        if (!memberOpt.isPresent()) {
            return List.of();
        }
        return rewardRecordRepository.findByMemberIdOrderByCreatedAtDesc(memberOpt.get().getId());
    }
    
    /**
     * 获取成员的积分统计
     */
    public Integer getMemberTotalPoints(String memberName) {
        Optional<Member> memberOpt = memberRepository.findByName(memberName);
        if (!memberOpt.isPresent()) {
            return 0;
        }
        
        Integer totalPoints = rewardRecordRepository.getTotalPointsByMemberAndTypes(
            memberOpt.get().getId(), 
            List.of(RewardType.ATTENDANCE_BONUS, RewardType.MERIT_BONUS, RewardType.GROUP_BONUS, RewardType.SPECIAL_BONUS,
                   RewardType.ABSENCE_PENALTY, RewardType.LOW_MERIT_PENALTY, RewardType.GROUP_PENALTY, RewardType.SPECIAL_PENALTY)
        );
        
        return totalPoints != null ? totalPoints : 0;
    }
    
    /**
     * 获取小组统计
     */
    public List<Member> getGroupMembers(String groupName) {
        return memberRepository.findByGroupName(groupName);
    }
    
    private Double calculateAttendanceRate(Integer attendanceCount, Integer totalSessions) {
        if (totalSessions == 0) return 0.0;
        return Math.round((double) attendanceCount / totalSessions * 10000) / 100.0;
    }
}

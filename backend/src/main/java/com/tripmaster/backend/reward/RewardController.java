package com.tripmaster.backend.reward;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rewards")
@CrossOrigin(origins = "http://localhost:5173")
public class RewardController {
    
    @Autowired
    private RewardService rewardService;
    
    /**
     * 根据考勤数据计算奖惩
     */
    @PostMapping("/calculate")
    public ResponseEntity<String> calculateRewards(@RequestBody List<AttendanceData> attendanceDataList) {
        try {
            String sessionId = UUID.randomUUID().toString();
            rewardService.calculateRewardsFromAttendance(attendanceDataList, sessionId);
            return ResponseEntity.ok("奖惩计算完成，会话ID: " + sessionId);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("计算失败: " + e.getMessage());
        }
    }
    
    /**
     * 手动添加奖惩记录
     */
    @PostMapping("/add")
    public ResponseEntity<String> addRewardRecord(@RequestParam String memberName,
                                                @RequestParam RewardType type,
                                                @RequestParam String reason,
                                                @RequestParam Integer points,
                                                @RequestParam(required = false) String sessionId) {
        try {
            String finalSessionId = sessionId != null ? sessionId : UUID.randomUUID().toString();
            rewardService.addRewardRecord(memberName, type, reason, points, finalSessionId);
            return ResponseEntity.ok("奖惩记录添加成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("添加失败: " + e.getMessage());
        }
    }
    
    /**
     * 获取成员的奖惩记录
     */
    @GetMapping("/member/{memberName}/records")
    public ResponseEntity<List<RewardRecord>> getMemberRecords(@PathVariable String memberName) {
        try {
            List<RewardRecord> records = rewardService.getMemberRewardRecords(memberName);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 获取成员的积分统计
     */
    @GetMapping("/member/{memberName}/points")
    public ResponseEntity<Integer> getMemberPoints(@PathVariable String memberName) {
        try {
            Integer points = rewardService.getMemberTotalPoints(memberName);
            return ResponseEntity.ok(points);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 获取小组成员列表
     */
    @GetMapping("/group/{groupName}/members")
    public ResponseEntity<List<Member>> getGroupMembers(@PathVariable String groupName) {
        try {
            List<Member> members = rewardService.getGroupMembers(groupName);
            return ResponseEntity.ok(members);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 获取所有奖惩类型
     */
    @GetMapping("/types")
    public ResponseEntity<RewardType[]> getRewardTypes() {
        return ResponseEntity.ok(RewardType.values());
    }
}

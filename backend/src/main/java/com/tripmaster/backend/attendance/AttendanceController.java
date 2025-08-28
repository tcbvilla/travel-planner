package com.tripmaster.backend.attendance;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import com.tripmaster.backend.attendance.BattleResult;

@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceSessionRepository attendanceSessionRepository;
    
    @Autowired
    private RewardConditionRepository rewardConditionRepository;
    
    @Autowired
    private CodeTableRepository codeTableRepository;

    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttendanceResponse compare(@RequestPart("start") MultipartFile start,
                                    @RequestPart("end") MultipartFile end,
                                    @RequestParam(name = "threshold", defaultValue = "1") long threshold) throws Exception {
        List<Map<String, String>> startRows = readCsvAuto(start);
        List<Map<String, String>> endRows = readCsvAuto(end);

        Map<String, Map<String, String>> startMap = indexByMember(startRows);
        Map<String, Map<String, String>> endMap = indexByMember(endRows);

        List<MemberData> result = new ArrayList<>();
        int filteredCount = 0;
        
        for (Map.Entry<String, Map<String, String>> e : startMap.entrySet()) {
            String member = e.getKey();
            Map<String, String> s = e.getValue();
            Map<String, String> t = endMap.get(member);
            
            // 边界值处理：只出现在一次CSV中的成员不加入统计
            if (t == null) {
                filteredCount++;
                continue;
            }
            
            String startGroup = s.getOrDefault("分组", "");
            String endGroup = t.getOrDefault("分组", "");
            
            // 边界值处理：分组不一致的成员不加入统计
            if (!startGroup.equals(endGroup)) {
                filteredCount++;
                continue;
            }
            
            long prev = parseLong(s.getOrDefault("战功总量", "0"));
            long next = parseLong(t.getOrDefault("战功总量", "0"));
            long diff = next - prev;
            
            // 处理助攻数据
            long assistPrev = parseLong(s.getOrDefault("助攻总量", "0"));
            long assistNext = parseLong(t.getOrDefault("助攻总量", "0"));
            long assistDiff = assistNext - assistPrev;

            MemberData memberData = new MemberData();
            memberData.set成员(member);
            memberData.set分组(startGroup);
            memberData.set前值(prev);
            memberData.set后值(next);
            memberData.set助攻前值(assistPrev);
            memberData.set助攻后值(assistNext);
            memberData.set参加考勤(true); // 默认参加考勤
            result.add(memberData);
        }

        // 将基础数据转换为DisplayRow（包含计算字段）用于返回
        List<DisplayRow> displayRows = new ArrayList<>();
        for (MemberData data : result) {
            DisplayRow row = new DisplayRow();
            row.set成员(data.get成员());
            row.set分组(data.get分组());
            row.set前值(data.get前值());
            row.set后值(data.get后值());
            row.set差值(data.get后值() - data.get前值());
            row.set助攻前值(data.get助攻前值());
            row.set助攻后值(data.get助攻后值());
            row.set助攻差值(data.get助攻后值() - data.get助攻前值());
            row.set达标((data.get后值() - data.get前值()) >= threshold);
            row.set参加考勤(data.is参加考勤());
            displayRows.add(row);
        }
        
        displayRows.sort((a, b) -> Long.compare(b.get差值(), a.get差值()));
        
        // 计算小组统计
        List<GroupStat> groupStats = calculateGroupStats(displayRows);
        
        AttendanceResponse response = new AttendanceResponse();
        response.setMembers(displayRows);
        response.setGroups(groupStats);
        response.setFilteredCount(filteredCount);
        
        return response;
    }
    
    /**
     * 保存考勤会话
     */
    @PostMapping("/save-session")
    public AttendanceSession saveSession(@RequestBody SaveSessionRequest request) {
        AttendanceSession session = new AttendanceSession();
        
        // 解析时间
        LocalDateTime startTime = null;
        LocalDateTime endTime = null;
        if (request.getStartTime() != null && !request.getStartTime().isEmpty()) {
            startTime = parseTimeFromFileName(request.getStartTime());
            session.setStartTime(startTime);
        }
        if (request.getEndTime() != null && !request.getEndTime().isEmpty()) {
            endTime = parseTimeFromFileName(request.getEndTime());
            session.setEndTime(endTime);
        }
        
        // 设置考勤名称：如果为空则使用默认名称
        String sessionName = request.getName();
        if (sessionName == null || sessionName.trim().isEmpty()) {
            sessionName = generateDefaultSessionName(startTime, endTime);
        }
        session.setName(sessionName);
        
        session.setBattleResult(request.getBattleResult());
        session.setStatus(SessionStatus.ADDED);
        session.setThreshold(request.getThreshold());
        
        // 处理成员数据：将DisplayRow转换为MemberData，只保存基础字段
        if (request.getMemberData() != null && !request.getMemberData().isEmpty()) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                // 解析为DisplayRow
                List<DisplayRow> displayRows = mapper.readValue(request.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, DisplayRow.class));
                
                // 转换为MemberData，只保存基础字段
                List<MemberData> memberDataList = new ArrayList<>();
                for (DisplayRow row : displayRows) {
                    MemberData memberData = new MemberData();
                    memberData.set成员(row.get成员());
                    memberData.set分组(row.get分组());
                    memberData.set前值(row.get前值());
                    memberData.set后值(row.get后值());
                    memberData.set助攻前值(row.get助攻前值());
                    memberData.set助攻后值(row.get助攻后值());
                    memberData.set参加考勤(row.is参加考勤());
                    memberDataList.add(memberData);
                }
                
                // 保存为JSON字符串
                session.setMemberData(mapper.writeValueAsString(memberDataList));
                
            } catch (Exception e) {
                // 如果转换失败，直接保存原始数据
                session.setMemberData(request.getMemberData());
            }
        } else {
            session.setMemberData(request.getMemberData());
        }
        
        return attendanceSessionRepository.save(session);
    }
    
    /**
     * 获取考勤会话列表（分页）
     */
    @GetMapping("/sessions")
    public Page<AttendanceSession> getSessions(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "10") int size,
                                             @RequestParam(required = false) String search) {
        Pageable pageable = PageRequest.of(page, size);
        if (search != null && !search.trim().isEmpty()) {
            return attendanceSessionRepository.findByNameContainingIgnoreCaseOrderByCreatedAtDesc(search.trim(), pageable);
        }
        return attendanceSessionRepository.findAllByOrderByCreatedAtDesc(pageable);
    }
    
    /**
     * 获取考勤会话详情
     */
    @GetMapping("/sessions/{id}")
    public Map<String, Object> getSession(@PathVariable Long id) {
        AttendanceSession session = attendanceSessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("考勤会话不存在"));
        
        // 实时计算小组统计
        List<GroupStat> groupStats = new ArrayList<>();
        if (session.getMemberData() != null && !session.getMemberData().isEmpty()) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                
                // 尝试解析为MemberData（新保存的数据格式）
                List<MemberData> memberDataList = null;
                try {
                    memberDataList = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                } catch (Exception e) {
                    // 如果解析MemberData失败，尝试解析为DisplayRow（旧数据格式）
                    List<DisplayRow> displayRows = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, DisplayRow.class));
                    
                    // 转换为MemberData
                    memberDataList = new ArrayList<>();
                    for (DisplayRow row : displayRows) {
                        MemberData memberData = new MemberData();
                        memberData.set成员(row.get成员());
                        memberData.set分组(row.get分组());
                        memberData.set前值(row.get前值());
                        memberData.set后值(row.get后值());
                        memberData.set助攻前值(row.get助攻前值());
                        memberData.set助攻后值(row.get助攻后值());
                        memberData.set参加考勤(row.is参加考勤());
                        memberDataList.add(memberData);
                    }
                }
                
                // 将MemberData转换为DisplayRow，计算所有派生字段
                List<DisplayRow> members = new ArrayList<>();
                for (MemberData memberData : memberDataList) {
                    DisplayRow row = new DisplayRow();
                    row.set成员(memberData.get成员());
                    row.set分组(memberData.get分组());
                    row.set前值(memberData.get前值());
                    row.set后值(memberData.get后值());
                    row.set助攻前值(memberData.get助攻前值());
                    row.set助攻后值(memberData.get助攻后值());
                    row.set参加考勤(memberData.is参加考勤());
                    
                    // 计算派生字段
                    row.set差值(memberData.get后值() - memberData.get前值());
                    row.set助攻差值(memberData.get助攻后值() - memberData.get助攻前值());
                    row.set达标((memberData.get后值() - memberData.get前值()) >= session.getThreshold());
                    
                    members.add(row);
                }
                
                groupStats = calculateGroupStats(members);
                
                // 将重新计算后的成员数据也返回给前端
                session.setMemberData(mapper.writeValueAsString(members));
                
            } catch (Exception e) {
                // 如果解析失败，返回空的小组统计
                groupStats = new ArrayList<>();
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("session", session);
        response.put("groupStats", groupStats);
        
        return response;
    }
    
    /**
     * 更新会话状态
     */
    @PutMapping("/sessions/{id}/status")
    public AttendanceSession updateSessionStatus(@PathVariable Long id,
                                               @RequestParam SessionStatus status) {
        AttendanceSession session = attendanceSessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("考勤会话不存在"));
        session.setStatus(status);
        return attendanceSessionRepository.save(session);
    }
    
    /**
     * 删除考勤会话
     */
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<String> deleteSession(@PathVariable Long id) {
        try {
            AttendanceSession session = attendanceSessionRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("考勤会话不存在"));
            attendanceSessionRepository.delete(session);
            return ResponseEntity.ok("删除成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("删除失败: " + e.getMessage());
        }
    }
    
    private List<GroupStat> calculateGroupStats(List<DisplayRow> members) {
        Map<String, GroupStat> groupMap = new HashMap<>();
        
        for (DisplayRow member : members) {
            // 只统计参加考勤的成员
            if (!member.is参加考勤()) {
                continue;
            }
            
            String group = member.get分组();
            
            GroupStat stat = groupMap.computeIfAbsent(group, k -> {
                GroupStat gs = new GroupStat();
                gs.setGroup(group);
                gs.setTotalMeritIncrease(0);
                gs.setAverageMeritIncrease(0);
                gs.setTotalAssistIncrease(0); // 总助攻增量
                gs.setAverageAssistIncrease(0); // 人均助攻增量
                gs.setAttendanceRate(0.0);
                gs.setMemberCount(0);
                gs.setAttendedCount(0); // 新增：达标人数
                return gs;
            });
            
            stat.setTotalMeritIncrease(stat.getTotalMeritIncrease() + member.get差值());
            stat.setTotalAssistIncrease(stat.getTotalAssistIncrease() + member.get助攻差值());
            stat.setMemberCount(stat.getMemberCount() + 1);
            if (member.is达标()) {
                stat.setAttendedCount(stat.getAttendedCount() + 1);
            }
        }
        
        // 计算人均战功增量、人均助攻增量和出勤率
        for (GroupStat stat : groupMap.values()) {
            if (stat.getMemberCount() > 0) {
                stat.setAverageMeritIncrease(stat.getTotalMeritIncrease() / stat.getMemberCount());
                stat.setAverageAssistIncrease(stat.getTotalAssistIncrease() / stat.getMemberCount());
                // 计算出勤率：达标人数 / 总人数 * 100%
                double attendanceRate = (double) stat.getAttendedCount() / stat.getMemberCount() * 100.0;
                stat.setAttendanceRate(Math.round(attendanceRate * 100.0) / 100.0);
                
                // 计算人均战功增量（加成后）
                long averageMeritIncrease = stat.getAverageMeritIncrease();
                long averageMeritIncreaseBonus = averageMeritIncrease;
                
                int memberCount = stat.getMemberCount();
                if (memberCount >= 40 && memberCount <= 45) {
                    // 小组人数40-45，加成1.03
                    averageMeritIncreaseBonus = Math.round(averageMeritIncrease * 1.03);
                } else if (memberCount >= 46 && memberCount <= 50) {
                    // 小组人数46-50，加成1.05
                    averageMeritIncreaseBonus = Math.round(averageMeritIncrease * 1.05);
                }
                
                stat.setAverageMeritIncreaseBonus(averageMeritIncreaseBonus);
            }
        }
        
        List<GroupStat> result = new ArrayList<>(groupMap.values());
        result.sort((a, b) -> Long.compare(b.getTotalMeritIncrease(), a.getTotalMeritIncrease()));
        
        return result;
    }

    /**
     * 从文件名解析时间
     * 文件名格式：同盟统计2025年07月28日00时00分00秒.csv
     */
    private LocalDateTime parseTimeFromFileName(String fileName) {
        try {
            // 移除.csv扩展名
            String nameWithoutExt = fileName.replace(".csv", "");
            
            // 使用正则表达式提取时间部分
            // 匹配格式：2025年07月28日00时00分00秒
            String timePattern = "(\\d{4})年(\\d{2})月(\\d{2})日(\\d{2})时(\\d{2})分(\\d{2})秒";
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(timePattern);
            java.util.regex.Matcher matcher = pattern.matcher(nameWithoutExt);
            
            if (matcher.find()) {
                int year = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));
                int day = Integer.parseInt(matcher.group(3));
                int hour = Integer.parseInt(matcher.group(4));
                int minute = Integer.parseInt(matcher.group(5));
                int second = Integer.parseInt(matcher.group(6));
                
                return LocalDateTime.of(year, month, day, hour, minute, second);
            } else {
                throw new IllegalArgumentException("文件名格式不正确，无法解析时间");
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("解析文件名时间失败: " + e.getMessage());
        }
    }

    /**
     * 生成默认考勤名称
     * 格式：起始时间 至 结束时间 考勤
     */
    private String generateDefaultSessionName(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            return "考勤记录";
        }
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy年MM月dd日HH时mm分");
        String startStr = startTime.format(formatter);
        String endStr = endTime.format(formatter);
        
        return startStr + " 至 " + endStr + " 考勤";
    }

    private List<Map<String, String>> readCsv(InputStreamReader isr) throws Exception {
        try (CSVReader reader = new CSVReaderBuilder(isr)
                .withSkipLines(0)
                .build()) {
            List<String[]> all = reader.readAll();
            if (all.isEmpty()) return Collections.emptyList();
            String[] header = Arrays.stream(all.get(0))
                    .map(col -> removeBom(col).trim())
                    .toArray(String[]::new);
            List<Map<String, String>> rows = new ArrayList<>();
            for (int i = 1; i < all.size(); i++) {
                String[] line = all.get(i);
                Map<String, String> map = new HashMap<>();
                for (int c = 0; c < Math.min(header.length, line.length); c++) {
                    map.put(header[c], line[c] != null ? line[c].trim() : "");
                }
                rows.add(map);
            }
            return rows;
        }
    }

    private List<Map<String, String>> readCsvAuto(MultipartFile file) throws Exception {
        // Try UTF-8 first
        List<Map<String, String>> rowsUtf8 = readCsv(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
        if (!rowsUtf8.isEmpty()) return rowsUtf8;
        // Retry with GBK if headers not matched
        List<Map<String, String>> rowsGbk = readCsv(new InputStreamReader(file.getInputStream(), java.nio.charset.Charset.forName("GBK")));
        if (!rowsGbk.isEmpty()) return rowsGbk;
        // Manual fallback parsing
        List<Map<String, String>> manualUtf8 = readCsvManual(file, StandardCharsets.UTF_8.name());
        if (!manualUtf8.isEmpty()) return manualUtf8;
        return readCsvManual(file, "GBK");
    }

    private List<Map<String, String>> readCsvManual(MultipartFile file, String charset) throws Exception {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream(), java.nio.charset.Charset.forName(charset)))) {
            String headerLine = br.readLine();
            if (headerLine == null) return Collections.emptyList();
            String[] header = Arrays.stream(headerLine.split(","))
                    .map(h -> removeBom(h).trim())
                    .toArray(String[]::new);
            List<Map<String, String>> rows = new ArrayList<>();
            String line;
            while ((line = br.readLine()) != null) {
                String[] cols = line.split(",");
                Map<String, String> map = new HashMap<>();
                for (int i = 0; i < Math.min(header.length, cols.length); i++) {
                    map.put(header[i], cols[i] != null ? cols[i].trim() : "");
                }
                rows.add(map);
            }
            return rows;
        }
    }

    private Map<String, Map<String, String>> indexByMember(List<Map<String, String>> rows) {
        Map<String, Map<String, String>> map = new LinkedHashMap<>();
        if (rows == null || rows.isEmpty()) return map;
        String memberKey = findMemberKey(rows.get(0).keySet());
        for (Map<String, String> r : rows) {
            String member = Optional.ofNullable(r.get(memberKey)).orElse("").trim();
            if (!member.isEmpty()) {
                map.put(member, r);
            }
        }
        return map;
    }

    private long parseLong(String v) {
        try {
            return Long.parseLong(v.replace(",", "").trim());
        } catch (Exception e) {
            return 0L;
        }
    }

    private String removeBom(String s) {
        if (s == null) return null;
        return s.replace("\uFEFF", "");
    }

    private String getField(Map<String, String> row, String key) {
        if (row.containsKey(key)) return row.get(key);
        String bomKey = "\uFEFF" + key;
        if (row.containsKey(bomKey)) return row.get(bomKey);
        // try keys with spaces trimmed variants (defensive)
        for (String k : row.keySet()) {
            if (removeBom(k).trim().equals(key)) {
                return row.get(k);
            }
        }
        return null;
    }

    private String findMemberKey(Set<String> keys) {
        String target = "成员";
        for (String k : keys) {
            String norm = removeBom(k).trim();
            if (norm.equals(target)) return k; // return original key to access map
        }
        // fallback: contains target
        for (String k : keys) {
            String norm = removeBom(k).trim();
            if (norm.contains(target)) return k;
        }
        // last resort: first key
        return keys.iterator().next();
    }
    
    /**
     * 保存奖惩条件
     */
    @PostMapping("/save-reward-condition")
    public RewardCondition saveRewardCondition(@RequestBody SaveRewardConditionRequest request) {
        RewardCondition condition = new RewardCondition();
        condition.setAttendanceSessionId(request.getAttendanceSessionId());
        condition.setTaskStatus(request.getTaskStatus());
        condition.setAttendanceRateThreshold(request.getAttendanceRateThreshold());
        condition.setAttendanceRateRank(request.getAttendanceRateRank());
        condition.setMeritIncreaseRank(request.getMeritIncreaseRank());
        condition.setRewardType(request.getRewardType());
        condition.setPenaltyType(request.getPenaltyType());
        return rewardConditionRepository.save(condition);
    }
    
    /**
     * 获取考勤记录的奖惩条件列表
     */
    @GetMapping("/reward-conditions/{sessionId}")
    public List<RewardCondition> getRewardConditions(@PathVariable Long sessionId) {
        return rewardConditionRepository.findByAttendanceSessionIdOrderByCreatedAtDesc(sessionId);
    }
    
    /**
     * 更新奖惩条件
     */
    @PutMapping("/reward-conditions/{id}")
    public RewardCondition updateRewardCondition(@PathVariable Long id, @RequestBody SaveRewardConditionRequest request) {
        RewardCondition condition = rewardConditionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("奖惩条件不存在"));
        
        condition.setTaskStatus(request.getTaskStatus());
        condition.setAttendanceRateThreshold(request.getAttendanceRateThreshold());
        condition.setAttendanceRateRank(request.getAttendanceRateRank());
        condition.setMeritIncreaseRank(request.getMeritIncreaseRank());
        condition.setRewardType(request.getRewardType());
        condition.setPenaltyType(request.getPenaltyType());
        
        return rewardConditionRepository.save(condition);
    }
    
    /**
     * 删除奖惩条件
     */
    @DeleteMapping("/reward-conditions/{id}")
    public void deleteRewardCondition(@PathVariable Long id) {
        rewardConditionRepository.deleteById(id);
    }
    
    /**
     * 更新考勤记录的基本信息
     */
    @PutMapping("/sessions/{sessionId}/update")
    public AttendanceSession updateSession(@PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        // 更新阈值
        if (request.containsKey("threshold")) {
            Object thresholdObj = request.get("threshold");
            if (thresholdObj instanceof Integer) {
                session.setThreshold((Integer) thresholdObj);
            } else if (thresholdObj instanceof String) {
                try {
                    session.setThreshold(Integer.parseInt((String) thresholdObj));
                } catch (NumberFormatException e) {
                    throw new RuntimeException("阈值格式不正确");
                }
            }
        }
        
        // 更新考勤名称
        if (request.containsKey("name")) {
            Object nameObj = request.get("name");
            if (nameObj instanceof String) {
                session.setName((String) nameObj);
            }
        }
        
        // 更新战役结果
        if (request.containsKey("battleResult")) {
            Object battleResultObj = request.get("battleResult");
            if (battleResultObj instanceof String) {
                String battleResult = (String) battleResultObj;
                try {
                    session.setBattleResult(BattleResult.valueOf(battleResult));
                } catch (IllegalArgumentException e) {
                    throw new RuntimeException("战役结果只能是 VICTORY 或 DEFEAT");
                }
            }
        }
        
        // 更新起始时间
        if (request.containsKey("startTime")) {
            Object startTimeObj = request.get("startTime");
            if (startTimeObj instanceof String) {
                try {
                    String timeStr = (String) startTimeObj;
                    LocalDateTime startTime;
                    
                    // 处理带时区的ISO格式 (如: 2025-08-27T23:30:00.000Z)
                    if (timeStr.endsWith("Z")) {
                        // 移除Z后缀并解析为本地时间
                        timeStr = timeStr.substring(0, timeStr.length() - 1);
                        startTime = LocalDateTime.parse(timeStr);
                    } else {
                        // 处理本地时间格式 (如: 2025-08-27T23:30:00)
                        startTime = LocalDateTime.parse(timeStr);
                    }
                    session.setStartTime(startTime);
                } catch (Exception e) {
                    throw new RuntimeException("起始时间格式不正确，应为 ISO 8601 格式: " + e.getMessage());
                }
            }
        }
        
        // 更新结束时间
        if (request.containsKey("endTime")) {
            Object endTimeObj = request.get("endTime");
            if (endTimeObj instanceof String) {
                try {
                    String timeStr = (String) endTimeObj;
                    LocalDateTime endTime;
                    
                    // 处理带时区的ISO格式 (如: 2025-08-27T23:30:00.000Z)
                    if (timeStr.endsWith("Z")) {
                        // 移除Z后缀并解析为本地时间
                        timeStr = timeStr.substring(0, timeStr.length() - 1);
                        endTime = LocalDateTime.parse(timeStr);
                    } else {
                        // 处理本地时间格式 (如: 2025-08-27T23:30:00)
                        endTime = LocalDateTime.parse(timeStr);
                    }
                    session.setEndTime(endTime);
                } catch (Exception e) {
                    throw new RuntimeException("结束时间格式不正确，应为 ISO 8601 格式: " + e.getMessage());
                }
            }
        }
        
        return attendanceSessionRepository.save(session);
    }
    
    /**
     * 更新考勤记录的阈值（保持向后兼容）
     */
    @PutMapping("/sessions/{sessionId}/threshold")
    public AttendanceSession updateThreshold(@PathVariable Long sessionId, @RequestBody Map<String, Integer> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        Integer newThreshold = request.get("threshold");
        if (newThreshold == null) {
            throw new RuntimeException("阈值不能为空");
        }
        
        session.setThreshold(newThreshold);
        return attendanceSessionRepository.save(session);
    }

    /**
     * 更新成员的参加考勤状态
     */
    @PutMapping("/sessions/{sessionId}/member-attendance")
    public AttendanceSession updateMemberAttendance(@PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        String memberName = (String) request.get("memberName");
        Boolean isAttending = (Boolean) request.get("isAttending");
        
        if (memberName == null || isAttending == null) {
            throw new RuntimeException("成员名称和参加状态不能为空");
        }
        
        try {
            // 解析现有的memberData
            ObjectMapper mapper = new ObjectMapper();
            List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
            
            // 更新指定成员的参加考勤状态
            boolean found = false;
            for (MemberData member : memberDataList) {
                if (member.get成员().equals(memberName)) {
                    member.set参加考勤(isAttending);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                throw new RuntimeException("未找到指定成员: " + memberName);
            }
            
            // 保存更新后的memberData
            session.setMemberData(mapper.writeValueAsString(memberDataList));
            return attendanceSessionRepository.save(session);
            
        } catch (Exception e) {
            throw new RuntimeException("更新成员参加状态失败: " + e.getMessage());
        }
    }

    /**
     * 批量更新多个成员的参加考勤状态
     */
    @PutMapping("/sessions/{sessionId}/members-attendance")
    public AttendanceSession updateMembersAttendance(@PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        @SuppressWarnings("unchecked")
        List<String> memberNames = (List<String>) request.get("memberNames");
        Boolean isAttending = (Boolean) request.get("isAttending");
        
        if (memberNames == null || memberNames.isEmpty() || isAttending == null) {
            throw new RuntimeException("成员名称列表和参加状态不能为空");
        }
        
        try {
            // 解析现有的memberData
            ObjectMapper mapper = new ObjectMapper();
            List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
            
            // 批量更新指定成员的参加考勤状态
            Set<String> memberNameSet = new HashSet<>(memberNames);
            boolean found = false;
            int updatedCount = 0;
            List<String> notFoundMembers = new ArrayList<>();
            
            for (MemberData member : memberDataList) {
                if (memberNameSet.contains(member.get成员())) {
                    member.set参加考勤(isAttending);
                    found = true;
                    updatedCount++;
                }
            }
            
            // 检查是否有未找到的成员
            for (String memberName : memberNames) {
                boolean memberFound = false;
                for (MemberData member : memberDataList) {
                    if (member.get成员().equals(memberName)) {
                        memberFound = true;
                        break;
                    }
                }
                if (!memberFound) {
                    notFoundMembers.add(memberName);
                }
            }
            
            if (!found) {
                throw new RuntimeException("未找到任何指定成员");
            }
            
            if (!notFoundMembers.isEmpty()) {
                throw new RuntimeException("未找到以下成员: " + String.join(", ", notFoundMembers));
            }
            
            // 保存更新后的memberData
            session.setMemberData(mapper.writeValueAsString(memberDataList));
            
            // 保存更新后的数据
            return attendanceSessionRepository.save(session);
            
        } catch (Exception e) {
            throw new RuntimeException("批量更新成员参加状态失败: " + e.getMessage());
        }
    }

    /**
     * 批量更新团队的参加考勤状态
     */
    @PutMapping("/sessions/{sessionId}/team-attendance")
    public AttendanceSession updateTeamAttendance(@PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        String teamName = (String) request.get("teamName");
        Boolean isAttending = (Boolean) request.get("isAttending");
        
        if (teamName == null || isAttending == null) {
            throw new RuntimeException("团队名称和参加状态不能为空");
        }
        
        try {
            // 解析现有的memberData
            ObjectMapper mapper = new ObjectMapper();
            List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
            
            // 批量更新指定团队所有成员的参加考勤状态
            boolean found = false;
            int updatedCount = 0;
            for (MemberData member : memberDataList) {
                if (member.get分组().equals(teamName)) {
                    member.set参加考勤(isAttending);
                    found = true;
                    updatedCount++;
                }
            }
            
            if (!found) {
                throw new RuntimeException("未找到指定团队: " + teamName);
            }
            
            // 保存更新后的memberData
            session.setMemberData(mapper.writeValueAsString(memberDataList));
            
            // 保存更新后的数据
            return attendanceSessionRepository.save(session);
            
        } catch (Exception e) {
            throw new RuntimeException("批量更新团队参加状态失败: " + e.getMessage());
        }
    }

    /**
     * 获取码表列表
     */
    @GetMapping("/code-tables")
    public List<CodeTable> getCodeTables(@RequestParam(required = false) String type) {
        if (type != null && !type.isEmpty()) {
            return codeTableRepository.findByType(type);
        }
        return codeTableRepository.findAll();
    }

    /**
     * 根据码表名称获取码表值
     */
    @GetMapping("/code-tables/name/{codeName}")
    public CodeTable getCodeTableByName(@PathVariable String codeName) {
        CodeTable codeTable = codeTableRepository.findByCodeName(codeName);
        if (codeTable == null) {
            throw new RuntimeException("未找到码表: " + codeName);
        }
        return codeTable;
    }

    /**
     * 根据码表值获取码表名称
     */
    @GetMapping("/code-tables/value/{codeValue}")
    public CodeTable getCodeTableByValue(@PathVariable Integer codeValue) {
        CodeTable codeTable = codeTableRepository.findByCodeValue(codeValue);
        if (codeTable == null) {
            throw new RuntimeException("未找到码表值: " + codeValue);
        }
        return codeTable;
    }

    /**
     * 初始化码表数据
     */
    @PostMapping("/code-tables/init")
    public ResponseEntity<String> initCodeTables() {
        try {
            // 检查是否已经初始化
            if (codeTableRepository.count() > 0) {
                return ResponseEntity.ok("码表已经初始化过了");
            }

            // 初始化奖励码表
            List<CodeTable> rewardCodes = Arrays.asList(
                new CodeTable("花瓣", 72, "REWARD", "花瓣奖励"),
                new CodeTable("双花瓣", 144, "REWARD", "双花瓣奖励"),
                new CodeTable("花", 216, "REWARD", "花奖励"),
                new CodeTable("双花", 432, "REWARD", "双花奖励"),
                new CodeTable("钱袋", 648, "REWARD", "钱袋奖励")
            );

            // 初始化处罚码表
            List<CodeTable> penaltyCodes = Arrays.asList(
                new CodeTable("屎粒", -72, "PENALTY", "屎粒处罚"),
                new CodeTable("双屎粒", -144, "PENALTY", "双屎粒处罚"),
                new CodeTable("屎", -216, "PENALTY", "屎处罚"),
                new CodeTable("双屎", -432, "PENALTY", "双屎处罚"),
                new CodeTable("粪汤", -648, "PENALTY", "粪汤处罚")
            );

            // 保存所有码表
            codeTableRepository.saveAll(rewardCodes);
            codeTableRepository.saveAll(penaltyCodes);

            return ResponseEntity.ok("码表初始化成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("码表初始化失败: " + e.getMessage());
        }
    }
}



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
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import com.tripmaster.backend.attendance.BattleResult;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceSessionRepository attendanceSessionRepository;
    
    @Autowired
    private RewardConditionRepository rewardConditionRepository;
    
    @Autowired
    private CodeTableRepository codeTableRepository;
    
    @Autowired
    private SeasonRepository seasonRepository;
    
    @Autowired
    private SettlementRecordRepository settlementRecordRepository;
    
    @Autowired
    private SettlementLogRepository settlementLogRepository;

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
        
        // 设置赛季关联
        if (request.getSeasonId() != null) {
            Season season = seasonRepository.findById(request.getSeasonId())
                    .orElseThrow(() -> new RuntimeException("未找到指定的赛季: " + request.getSeasonId()));
            session.setSeason(season);
        } else {
            throw new RuntimeException("赛季是必须的，请选择赛季");
        }
        
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
                // 计算出勤率：达标人数 / 参加考勤人数 * 100%
                double attendanceRate = (double) stat.getAttendedCount() / stat.getMemberCount() * 100.0;
                stat.setAttendanceRate(Math.round(attendanceRate * 100.0) / 100.0);
                
                // 计算人均战功增量（加成后）
                long averageMeritIncrease = stat.getAverageMeritIncrease();
                long averageMeritIncreaseBonus = averageMeritIncrease;
                
                int memberCount = stat.getMemberCount();
                if (memberCount >= 40 && memberCount <= 45) {
                    // 小组人数40-45，加成1.03
                    averageMeritIncreaseBonus = Math.round((double) averageMeritIncrease * 1.03);
                } else if (memberCount >= 46 && memberCount <= 50) {
                    // 小组人数46-50，加成1.05
                    averageMeritIncreaseBonus = Math.round((double) averageMeritIncrease * 1.05);
                }
                
                stat.setAverageMeritIncreaseBonus(averageMeritIncreaseBonus);
                
                // 计算出勤率（加成后）
                double attendanceRateBonus = attendanceRate;
                if (memberCount >= 40 && memberCount <= 45) {
                    // 小组人数40-45，出勤率 + 3%
                    attendanceRateBonus = attendanceRate + 3.0;
                } else if (memberCount >= 46 && memberCount <= 50) {
                    // 小组人数46-50，出勤率 + 5%
                    attendanceRateBonus = attendanceRate + 5.0;
                }
                
                // 出勤率（加成后）100%封顶
                if (attendanceRateBonus > 100.0) {
                    attendanceRateBonus = 100.0;
                }
                
                stat.setAttendanceRateBonus(Math.round(attendanceRateBonus * 100.0) / 100.0);
                
                // 调试信息
                System.out.println("小组统计计算 - 小组: " + stat.getGroup() + 
                    ", 达标人数: " + stat.getAttendedCount() + 
                    ", 参加考勤人数: " + stat.getMemberCount() + 
                    ", 出勤率: " + stat.getAttendanceRate() + 
                    ", 出勤率(加成后): " + stat.getAttendanceRateBonus());
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
     * 计算奖惩结算结果
     */
    @PostMapping("/sessions/{sessionId}/calculate-settlement")
    public List<SettlementResult> calculateSettlement(@PathVariable Long sessionId, @RequestBody List<GroupStat> groupStats) {
        try {
            System.out.println("开始计算结算结果，sessionId: " + sessionId);
            System.out.println("接收到的groupStats数量: " + (groupStats != null ? groupStats.size() : "null"));
            
            AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
            
            List<SettlementResult> results = new ArrayList<>();
            
            // 获取所有奖惩条件
            List<RewardCondition> conditions = rewardConditionRepository.findByAttendanceSessionIdOrderByCreatedAtDesc(sessionId);
            System.out.println("获取到的奖惩条件数量: " + conditions.size());
            
            // 根据战役结果筛选奖惩条件
            String battleResult = session.getBattleResult().toString();
            System.out.println("战役结果: " + battleResult);
            
            List<RewardCondition> filteredConditions = conditions.stream()
                    .filter(condition -> {
                        if ("VICTORY".equals(battleResult)) {
                            return "胜利".equals(condition.getTaskStatus());
                        } else {
                            return "失败".equals(condition.getTaskStatus());
                        }
                    })
                    .collect(Collectors.toList());
            
            System.out.println("筛选后的奖惩条件数量: " + filteredConditions.size());
            
            // 处理每个奖惩条件
            if (groupStats == null || groupStats.isEmpty()) {
                System.out.println("小组统计数据为空，返回空结果");
                return results;
            }
            
            // 打印小组统计数据
            for (GroupStat stat : groupStats) {
                System.out.println("小组: " + stat.getGroup() + 
                    ", 出勤率(加成后): " + stat.getAttendanceRateBonus() + 
                    ", 人均战功增量(加成后): " + stat.getAverageMeritIncreaseBonus() + 
                    ", 成员数: " + stat.getMemberCount());
            }
            
            for (RewardCondition condition : filteredConditions) {
                System.out.println("处理奖惩条件: " + condition.getTaskStatus() + 
                    ", 出勤率阈值: " + condition.getAttendanceRateThreshold() + 
                    ", 出勤率排名: " + condition.getAttendanceRateRank() + 
                    ", 战功增量排名: " + condition.getMeritIncreaseRank());
                processRewardCondition(condition, groupStats, results);
            }
            
            System.out.println("结算结果数量: " + results.size());
            return results;
        } catch (Exception e) {
            System.err.println("计算结算结果时发生错误: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("计算结算结果失败: " + e.getMessage());
        }
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
        
        // 更新赛季
        if (request.containsKey("seasonId")) {
            Object seasonIdObj = request.get("seasonId");
            if (seasonIdObj == null) {
                // 如果seasonId为null，表示取消关联赛季
                session.setSeason(null);
            } else if (seasonIdObj instanceof Integer) {
                Long seasonId = ((Integer) seasonIdObj).longValue();
                Season season = seasonRepository.findById(seasonId)
                        .orElseThrow(() -> new RuntimeException("赛季不存在"));
                session.setSeason(season);
            } else if (seasonIdObj instanceof Long) {
                Long seasonId = (Long) seasonIdObj;
                Season season = seasonRepository.findById(seasonId)
                        .orElseThrow(() -> new RuntimeException("赛季不存在"));
                session.setSeason(season);
            }
        }
        
        return attendanceSessionRepository.save(session);
    }

    /**
     * 解析成员数据
     */
    private List<MemberData> parseMemberData(String memberDataJson) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(memberDataJson, mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
        } catch (Exception e) {
            throw new RuntimeException("解析成员数据失败: " + e.getMessage());
        }
    }

    /**
     * 解析小组统计数据
     */
    private List<GroupStat> parseGroupStats(String groupDataJson) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(groupDataJson, mapper.getTypeFactory().constructCollectionType(List.class, GroupStat.class));
        } catch (Exception e) {
            throw new RuntimeException("解析小组统计数据失败: " + e.getMessage());
        }
    }

    /**
     * 处理单个奖惩条件
     */
    private void processRewardCondition(RewardCondition condition, List<GroupStat> groupStats, List<SettlementResult> results) {
        try {
            System.out.println("开始处理奖惩条件: " + condition.getTaskStatus());
            
            // 根据条件类型进行排名计算
            if (condition.getMeritIncreaseRank() != null && !condition.getMeritIncreaseRank().toString().isEmpty()) {
                System.out.println("使用战功增量排名");
                // 按人均战功增量（加成后）排名
                processMeritRanking(condition, groupStats, results);
            } else {
                System.out.println("使用出勤率排名");
                // 按出勤率（加成后）排名
                processAttendanceRanking(condition, groupStats, results);
            }
        } catch (Exception e) {
            System.err.println("处理奖惩条件时发生错误: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 处理战功增量排名
     */
    private void processMeritRanking(RewardCondition condition, List<GroupStat> groupStats, List<SettlementResult> results) {
        // 按人均战功增量（加成后）排序
        List<GroupStat> sortedStats = new ArrayList<>(groupStats);
        sortedStats.sort((a, b) -> Long.compare(b.getAverageMeritIncreaseBonus(), a.getAverageMeritIncreaseBonus()));
        
        // 计算密集排名
        Map<String, Integer> rankings = calculateDenseRanking(sortedStats, 
            GroupStat::getAverageMeritIncreaseBonus, true);
        
        // 找到符合排名要求的队伍
        int targetRank = condition.getMeritIncreaseRank();
        List<String> qualifiedTeams = findTeamsByRank(rankings, targetRank);
        
        if (!qualifiedTeams.isEmpty()) {
            distributeReward(condition, qualifiedTeams, results);
        }
    }

    /**
     * 处理出勤率排名
     */
    private void processAttendanceRanking(RewardCondition condition, List<GroupStat> groupStats, List<SettlementResult> results) {
        // 先过滤出满足出勤率条件的队伍
        List<GroupStat> filteredStats = new ArrayList<>();
        double threshold = condition.getAttendanceRateThreshold();
        
        for (GroupStat stat : groupStats) {
            if ("胜利".equals(condition.getTaskStatus())) {
                // 胜利情况：出勤率（加成后）大于阈值
                if (stat.getAttendanceRateBonus() > threshold) {
                    filteredStats.add(stat);
                }
            } else {
                // 失败情况：出勤率（加成后）小于阈值
                if (stat.getAttendanceRateBonus() < threshold) {
                    filteredStats.add(stat);
                }
            }
        }
        
        if (filteredStats.isEmpty()) {
            return; // 没有队伍满足出勤率条件
        }
        
        // 按出勤率（加成后）排序
        filteredStats.sort((a, b) -> Double.compare(b.getAttendanceRateBonus(), a.getAttendanceRateBonus()));
        
        // 计算密集排名
        Map<String, Integer> rankings = calculateDenseRanking(filteredStats, 
            GroupStat::getAttendanceRateBonus, true);
        
        // 找到符合排名要求的队伍
        int targetRank = condition.getAttendanceRateRank();
        List<String> qualifiedTeams = findTeamsByRank(rankings, targetRank);
        
        if (!qualifiedTeams.isEmpty()) {
            distributeReward(condition, qualifiedTeams, results);
        }
    }

    /**
     * 计算密集排名
     */
    private <T> Map<String, Integer> calculateDenseRanking(List<GroupStat> stats, 
            java.util.function.Function<GroupStat, T> valueExtractor, boolean descending) {
        Map<String, Integer> rankings = new HashMap<>();
        int currentRank = 1;
        T previousValue = null;
        
        for (int i = 0; i < stats.size(); i++) {
            GroupStat stat = stats.get(i);
            T currentValue = valueExtractor.apply(stat);
            
            // 如果是第一个元素，或者当前值与上一个值不同，则增加排名
            if (i == 0 || (previousValue != null && !currentValue.equals(previousValue))) {
                currentRank = i + 1; // 密集排名：第1个是第1名，第2个是第2名，以此类推
            }
            
            rankings.put(stat.getGroup(), currentRank);
            previousValue = currentValue;
        }
        
        return rankings;
    }

    /**
     * 根据排名找到符合条件的队伍
     */
    private List<String> findTeamsByRank(Map<String, Integer> rankings, int targetRank) {
        return rankings.entrySet().stream()
                .filter(entry -> entry.getValue() == targetRank)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /**
     * 分配奖励
     */
    private void distributeReward(RewardCondition condition, List<String> qualifiedTeams, List<SettlementResult> results) {
        String rewardType = "胜利".equals(condition.getTaskStatus()) ? condition.getRewardType() : condition.getPenaltyType();
        
        // 获取码表值
        CodeTable codeTable = codeTableRepository.findByCodeName(rewardType);
        if (codeTable == null) {
            throw new RuntimeException("未找到奖惩类型: " + rewardType);
        }
        
        // 计算倍数
        BigDecimal multiplier = BigDecimal.valueOf(1.0 / qualifiedTeams.size());
        multiplier = multiplier.setScale(3, BigDecimal.ROUND_HALF_UP);
        
        // 计算金额
        BigDecimal amount = BigDecimal.valueOf(codeTable.getCodeValue()).multiply(multiplier);
        
        // 为每个队伍创建结算结果
        for (String teamName : qualifiedTeams) {
            SettlementResult result = new SettlementResult();
            result.setTeamName(teamName);
            result.setRewardType(rewardType);
            result.setMultiplier(multiplier);
            result.setRewardDescription(rewardType + "✖️" + multiplier);
            result.setAmount(amount);
            results.add(result);
        }
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

    // ==================== 赛季管理接口 ====================

    /**
     * 获取赛季列表（分页排序）
     */
    @GetMapping("/seasons")
    public Page<Season> getSeasons(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, org.springframework.data.domain.Sort.by("startDate").ascending());
        return seasonRepository.findAll(pageable);
    }

    /**
     * 根据ID获取赛季
     */
    @GetMapping("/seasons/{id}")
    public Season getSeasonById(@PathVariable Long id) {
        return seasonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("未找到赛季: " + id));
    }

    /**
     * 创建新赛季
     */
    @PostMapping("/seasons")
    public Season createSeason(@RequestBody Season season) {
        // 检查赛季名称是否已存在
        if (seasonRepository.existsByName(season.getName())) {
            throw new RuntimeException("赛季名称已存在: " + season.getName());
        }
        
        // 验证日期
        if (season.getStartDate().isAfter(season.getEndDate())) {
            throw new RuntimeException("起始日期不能晚于结束日期");
        }
        
        return seasonRepository.save(season);
    }

    /**
     * 更新赛季
     */
    @PutMapping("/seasons/{id}")
    public Season updateSeason(@PathVariable Long id, @RequestBody Season season) {
        Season existingSeason = seasonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("未找到赛季: " + id));
        
        // 检查赛季名称是否已被其他赛季使用
        if (!existingSeason.getName().equals(season.getName()) && 
            seasonRepository.existsByName(season.getName())) {
            throw new RuntimeException("赛季名称已存在: " + season.getName());
        }
        
        // 验证日期
        if (season.getStartDate().isAfter(season.getEndDate())) {
            throw new RuntimeException("起始日期不能晚于结束日期");
        }
        
        existingSeason.setName(season.getName());
        existingSeason.setStartDate(season.getStartDate());
        existingSeason.setEndDate(season.getEndDate());
        
        return seasonRepository.save(existingSeason);
    }

    /**
     * 测试接口：查看赛季关联的考勤记录
     */
    @GetMapping("/seasons/{id}/attendance-count")
    public ResponseEntity<String> getSeasonAttendanceCount(@PathVariable Long id) {
        try {
            Season season = seasonRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + id));
            
            long count = seasonRepository.countAttendanceSessionsBySeasonId(id);
            
            // 获取所有考勤记录，查看它们的season_id
            List<AttendanceSession> allSessions = attendanceSessionRepository.findAll();
            StringBuilder debugInfo = new StringBuilder();
            debugInfo.append("赛季 '").append(season.getName()).append("' (ID: ").append(id).append(") 关联的考勤记录数量: ").append(count).append("\n");
            debugInfo.append("所有考勤记录的season_id:\n");
            for (AttendanceSession session : allSessions) {
                debugInfo.append("考勤记录ID: ").append(session.getId())
                        .append(", 名称: ").append(session.getName())
                        .append(", season_id: ").append(session.getSeason() != null ? session.getSeason().getId() : "null")
                        .append("\n");
            }
            
            return ResponseEntity.ok(debugInfo.toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("查询失败: " + e.getMessage());
        }
    }

    /**
     * 删除赛季
     */
    @DeleteMapping("/seasons/{id}")
    public ResponseEntity<String> deleteSeason(@PathVariable Long id) {
        try {
            Season season = seasonRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + id));
            
            // 检查赛季是否被考勤记录使用
            long count = seasonRepository.countAttendanceSessionsBySeasonId(id);
            System.out.println("赛季ID: " + id + ", 关联的考勤记录数量: " + count);
            if (count > 0) {
                return ResponseEntity.badRequest().body("无法删除赛季：该赛季已被 " + count + " 条考勤记录使用，请先删除相关的考勤记录");
            }
            
            seasonRepository.delete(season);
            return ResponseEntity.ok("赛季删除成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("删除赛季失败: " + e.getMessage());
        }
    }

    /**
     * 执行结算 - 保存结算结果到数据库并记录日志
     */
    @PostMapping("/sessions/{sessionId}/execute-settlement")
    public ResponseEntity<String> executeSettlement(@PathVariable Long sessionId, @RequestBody List<SettlementResult> settlementResults) {
        try {
            AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("未找到考勤记录: " + sessionId));
            
            if (session.getSeason() == null) {
                return ResponseEntity.badRequest().body("考勤记录未关联赛季，无法执行结算");
            }
            
            // 检查是否已经结算过
            if (settlementRecordRepository.existsByAttendanceSessionId(sessionId)) {
                return ResponseEntity.badRequest().body("该考勤记录已经执行过结算，请先撤销后再重新结算");
            }
            
            System.out.println("开始执行结算，考勤记录ID: " + sessionId + ", 结算结果数量: " + settlementResults.size());
            
            // 保存结算记录
            List<SettlementRecord> records = new ArrayList<>();
            StringBuilder settlementContent = new StringBuilder();
            
            for (SettlementResult result : settlementResults) {
                SettlementRecord record = new SettlementRecord();
                record.setTeamName(result.getTeamName());
                record.setRewardDescription(result.getRewardDescription());
                record.setAmount(result.getAmount());
                record.setRewardType(result.getRewardType());
                record.setMultiplier(result.getMultiplier());
                record.setSeason(session.getSeason());
                record.setAttendanceSession(session);
                
                records.add(record);
                
                // 构建日志内容
                settlementContent.append(result.getTeamName())
                        .append(": ").append(result.getRewardDescription())
                        .append(", 金额: ").append(result.getAmount())
                        .append("; ");
            }
            
            settlementRecordRepository.saveAll(records);
            System.out.println("保存了 " + records.size() + " 条结算记录");
            
            // 记录日志
            SettlementLog log = new SettlementLog();
            log.setAttendanceRecordName(session.getName());
            log.setSettlementSeason(session.getSeason().getName());
            log.setSettlementContent(settlementContent.toString());
            log.setAttendanceSession(session);
            
            settlementLogRepository.save(log);
            System.out.println("保存结算日志成功");
            
            // 更新考勤记录状态为已结算
            session.setStatus("SETTLED");
            attendanceSessionRepository.save(session);
            System.out.println("更新考勤记录状态为已结算");
            
            return ResponseEntity.ok("结算执行成功，共处理 " + records.size() + " 条记录");
        } catch (Exception e) {
            System.err.println("执行结算失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("执行结算失败: " + e.getMessage());
        }
    }

    /**
     * 查看结算日志
     */
    @GetMapping("/settlement-logs")
    public ResponseEntity<Map<String, Object>> getSettlementLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Long seasonId) {
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<SettlementLog> logs;
            
            if (seasonId != null) {
                // 根据赛季筛选日志
                logs = settlementLogRepository.findBySeasonIdOrderByOperationTimeDesc(seasonId, pageable);
            } else {
                // 查看所有日志
                logs = settlementLogRepository.findAllOrderByOperationTimeDesc(pageable);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("logs", logs.getContent());
            response.put("totalElements", logs.getTotalElements());
            response.put("totalPages", logs.getTotalPages());
            response.put("currentPage", logs.getNumber());
            response.put("size", logs.getSize());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("查询结算日志失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "查询结算日志失败: " + e.getMessage()));
        }
    }

    /**
     * 撤销结算 - 删除结算记录和日志
     */
    @DeleteMapping("/sessions/{sessionId}/revoke-settlement")
    public ResponseEntity<String> revokeSettlement(@PathVariable Long sessionId) {
        try {
            AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("未找到考勤记录: " + sessionId));
            
            // 删除结算记录
            List<SettlementRecord> records = settlementRecordRepository.findByAttendanceSessionId(sessionId);
            if (records.isEmpty()) {
                return ResponseEntity.badRequest().body("该考勤记录没有结算记录可以撤销");
            }
            
            settlementRecordRepository.deleteAll(records);
            System.out.println("删除了 " + records.size() + " 条结算记录");
            
            // 记录撤销日志
            SettlementLog log = new SettlementLog();
            log.setAttendanceRecordName(session.getName());
            log.setSettlementSeason(session.getSeason() != null ? session.getSeason().getName() : "未知赛季");
            log.setSettlementContent("撤销结算，删除了 " + records.size() + " 条结算记录");
            log.setAttendanceSession(session);
            
            settlementLogRepository.save(log);
            System.out.println("保存撤销日志成功");
            
            // 更新考勤记录状态为已保存
            session.setStatus("SAVED");
            attendanceSessionRepository.save(session);
            System.out.println("更新考勤记录状态为已保存");
            
            return ResponseEntity.ok("结算撤销成功，删除了 " + records.size() + " 条记录");
        } catch (Exception e) {
            System.err.println("撤销结算失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("撤销结算失败: " + e.getMessage());
        }
    }
}
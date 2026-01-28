
package com.tripmaster.backend.attendance;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import java.util.HashSet;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import com.tripmaster.backend.attendance.BattleResult;
import com.tripmaster.backend.attendance.SessionStatus;
import java.math.BigDecimal;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;

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
    
    @Autowired
    private SynthesisService synthesisService;
    
    @Autowired
    private CascadeRevocationService cascadeRevocationService;
    
    @Autowired
    private SynthesisChainRepository synthesisChainRepository;
    
    @Autowired
    private BonusConfigService bonusConfigService;
    
    @Autowired
    private PaymentRecordRepository paymentRecordRepository;
    
    @Autowired
    private TeamLogoRepository teamLogoRepository;
    
    @Autowired
    private RankingExclusionRepository rankingExclusionRepository;
    
    @Autowired
    private GroupConfigService groupConfigService;
    
    @Autowired
    private SystemConfigService systemConfigService;
    
    @Value("${app.upload.team-logos-dir:${user.home}/uploads/team_logos}")
    private String teamLogosUploadDir;

    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttendanceResponse compare(@RequestPart("start") MultipartFile start,
                                    @RequestPart("end") MultipartFile end,
                                    @RequestParam(name = "threshold", defaultValue = "1") long threshold,
                                    @RequestParam(name = "attendanceType", defaultValue = "压秒考勤") String attendanceType) throws Exception {
        List<Map<String, String>> startRows = readCsvAuto(start);
        List<Map<String, String>> endRows = readCsvAuto(end);

        Map<String, Map<String, String>> startMap = indexByMember(startRows);
        Map<String, Map<String, String>> endMap = indexByMember(endRows);
        
        // Get member->group mapping from configuration (only if enabled)
        Map<String, String> memberGroupMapping = new HashMap<>();
        boolean mappingEnabled = systemConfigService.isMemberGroupMappingEnabled();
        if (mappingEnabled) {
            memberGroupMapping = groupConfigService.getMappingMap();
            System.out.println("Member group mapping enabled, loaded size: " + memberGroupMapping.size());
        } else {
            System.out.println("Member group mapping disabled, using CSV groups only");
        }

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
            
            // Support both "分组" and "门阀" column names
            String csvGroup = getGroupNameFromRow(s);
            
            // Apply mapping: use configured group if available, otherwise use CSV group
            boolean usedMapping = memberGroupMapping.containsKey(member);
            String finalGroup = memberGroupMapping.getOrDefault(member, csvGroup);
            System.out.println("Member: " + member + ", CSV group: " + csvGroup + ", Final group: " + finalGroup + ", Used mapping: " + usedMapping);
            
            // 边界值处理：分组不一致的成员归属于起始分组
            // 不再过滤，而是使用起始分组进行统计
            
            long prev = parseLong(s.getOrDefault("战功总量", "0"));
            long next = parseLong(t.getOrDefault("战功总量", "0"));
            long diff = next - prev;
            
            // 处理助攻数据
            long assistPrev = parseLong(s.getOrDefault("助攻总量", "0"));
            long assistNext = parseLong(t.getOrDefault("助攻总量", "0"));
            long assistDiff = assistNext - assistPrev;

            MemberData memberData = new MemberData();
            memberData.set成员(member);
            memberData.set分组(finalGroup);  // Use mapped group instead of CSV group
            memberData.set前值(prev);
            memberData.set后值(next);
            memberData.set助攻前值(assistPrev);
            memberData.set助攻后值(assistNext);
            memberData.set参加考勤(true); // 默认参加考勤
            memberData.set使用配置分组(usedMapping);
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
            // 根据考勤类型选择达标判断标准
            if ("区间助攻考勤".equals(attendanceType)) {
                row.set达标((data.get助攻后值() - data.get助攻前值()) >= threshold);
            } else {
                row.set达标((data.get后值() - data.get前值()) >= threshold);
            }
            row.set参加考勤(data.is参加考勤());
            row.set使用配置分组(data.is使用配置分组());
            displayRows.add(row);
        }
        
        displayRows.sort((a, b) -> Long.compare(b.get差值(), a.get差值()));
        
        // 计算小组统计
        List<GroupStat> groupStats = calculateGroupStats(displayRows, attendanceType);
        
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
        
        // 设置考勤类型：如果为空则使用默认类型
        String attendanceType = request.getAttendanceType();
        if (attendanceType == null || attendanceType.trim().isEmpty()) {
            attendanceType = "压秒考勤";
        }
        session.setAttendanceType(attendanceType);
        
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
                    // 根据考勤类型选择达标判断标准
                    if ("区间助攻考勤".equals(session.getAttendanceType())) {
                        row.set达标((memberData.get助攻后值() - memberData.get助攻前值()) >= session.getThreshold());
                    } else {
                        row.set达标((memberData.get后值() - memberData.get前值()) >= session.getThreshold());
                    }
                    
                    members.add(row);
                }
                
                groupStats = calculateGroupStats(members, session.getAttendanceType());
                
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
            
            // 检查是否已结算，如果已结算则不允许删除
            if (session.getStatus() == SessionStatus.SETTLED) {
                return ResponseEntity.badRequest().body("已结算的考勤记录不能直接删除，请先撤销结算后再删除");
            }
            
            // 检查是否有结算记录，如果有则不允许删除
            List<SettlementRecord> settlementRecords = settlementRecordRepository.findByAttendanceSessionId(id);
            if (!settlementRecords.isEmpty()) {
                return ResponseEntity.badRequest().body("该考勤记录存在结算记录，请先撤销结算后再删除");
            }
            
            attendanceSessionRepository.delete(session);
            return ResponseEntity.ok("删除成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("删除失败: " + e.getMessage());
        }
    }
    
    private List<GroupStat> calculateGroupStats(List<DisplayRow> members, String attendanceType) {
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
            
            // 根据考勤类型选择统计标准
            if ("区间助攻考勤".equals(attendanceType)) {
                // 区间助攻考勤：统计助攻数据
                stat.setTotalAssistIncrease(stat.getTotalAssistIncrease() + member.get助攻差值());
            } else {
                // 其他考勤类型：统计战功数据
                stat.setTotalMeritIncrease(stat.getTotalMeritIncrease() + member.get差值());
                // 助攻数据也统计（用于显示）
                stat.setTotalAssistIncrease(stat.getTotalAssistIncrease() + member.get助攻差值());
            }
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
                
                // 计算人均助攻增量（加成后）
                long averageAssistIncrease = stat.getAverageAssistIncrease();
                long averageAssistIncreaseBonus = averageAssistIncrease;
                
                // 计算出勤率（加成后）
                double attendanceRateBonus = attendanceRate;
                
                // 使用配置化的加成规则
                int memberCount = stat.getMemberCount();
                TeamSizeBonusRule applicableRule = bonusConfigService.getApplicableBonusRule(memberCount);
                
                if (applicableRule != null) {
                    // 应用战功加成
                    averageMeritIncreaseBonus = Math.round((double) averageMeritIncrease * applicableRule.getMeritBonus());
                    
                    // 应用助攻加成（使用与战功相同的加成倍数）
                    averageAssistIncreaseBonus = Math.round((double) averageAssistIncrease * applicableRule.getMeritBonus());
                    
                    // 应用出勤率加成
                    attendanceRateBonus = attendanceRate + applicableRule.getAttendanceRateBonus();
                    
                    System.out.println(String.format("团队 %s (%d人) 应用加成规则: 战功×%.2f, 助攻×%.2f, 出勤率+%.1f%%", 
                        stat.getGroup(), memberCount, applicableRule.getMeritBonus(), applicableRule.getMeritBonus(), applicableRule.getAttendanceRateBonus()));
                }
                
                stat.setAverageMeritIncreaseBonus(averageMeritIncreaseBonus);
                stat.setAverageAssistIncreaseBonus(averageAssistIncreaseBonus);
                
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
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy年MM月dd日HH时mm分ss秒");
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
    
    /**
     * Get group name from CSV row, supporting both "分组" and "门阀" column names
     * Priority: "分组" > "门阀"
     */
    private String getGroupNameFromRow(Map<String, String> row) {
        String groupName = row.get("分组");
        if (groupName != null && !groupName.trim().isEmpty()) {
            return groupName.trim();
        }
        // Fallback to "门阀" if "分组" is not available
        String menfa = row.get("门阀");
        return menfa != null ? menfa.trim() : "";
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
        condition.setCashRewardAmount(request.getCashRewardAmount());
        condition.setRewardMode(request.getRewardMode());
        condition.setPenaltyMode(request.getPenaltyMode());
        condition.setCashPenaltyAmount(request.getCashPenaltyAmount());
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
        condition.setCashRewardAmount(request.getCashRewardAmount());
        condition.setRewardMode(request.getRewardMode());
        condition.setPenaltyMode(request.getPenaltyMode());
        condition.setCashPenaltyAmount(request.getCashPenaltyAmount());
        
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
                processRewardCondition(condition, groupStats, results, session.getAttendanceType());
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
        
        // 考勤类型不允许修改，避免数据混乱
        // 注释掉考勤类型更新逻辑
        /*
        if (request.containsKey("attendanceType")) {
            Object attendanceTypeObj = request.get("attendanceType");
            if (attendanceTypeObj instanceof String) {
                String attendanceType = (String) attendanceTypeObj;
                if (attendanceType != null && !attendanceType.trim().isEmpty()) {
                    session.setAttendanceType(attendanceType);
                }
            }
        }
        */
        
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
    private void processRewardCondition(RewardCondition condition, List<GroupStat> groupStats, List<SettlementResult> results, String attendanceType) {
        try {
            System.out.println("开始处理奖惩条件: " + condition.getTaskStatus());
            
            // 根据条件类型进行排名计算
            if (condition.getMeritIncreaseRank() != null && !condition.getMeritIncreaseRank().toString().isEmpty()) {
                System.out.println("使用战功增量排名");
                // 按人均战功增量（加成后）排名
                processMeritRanking(condition, groupStats, results, attendanceType);
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
    private void processMeritRanking(RewardCondition condition, List<GroupStat> groupStats, List<SettlementResult> results, String attendanceType) {
        // 先过滤出满足出勤率条件的队伍（与出勤率排名逻辑保持一致）
        List<GroupStat> filteredStats = new ArrayList<>();
        double threshold = condition.getAttendanceRateThreshold();
        
        for (GroupStat stat : groupStats) {
            // 判断是奖励还是惩罚
            boolean isReward = condition.getRewardType() != null || 
                              (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
            
            if (isReward) {
                // 奖励情况：出勤率（加成后）大于等于阈值
                if (stat.getAttendanceRateBonus() >= threshold) {
                    filteredStats.add(stat);
                }
            } else {
                // 惩罚情况：出勤率（加成后）小于等于阈值
                if (stat.getAttendanceRateBonus() <= threshold) {
                    filteredStats.add(stat);
                }
            }
        }
        
        if (filteredStats.isEmpty()) {
            System.out.println("战功增量排名：没有队伍满足出勤率条件，出勤率阈值: " + threshold);
            return; // 没有队伍满足出勤率条件
        }
        
        System.out.println("战功增量排名：满足出勤率条件的队伍数量: " + filteredStats.size() + ", 出勤率阈值: " + threshold);
        
        // 按人均战功增量（加成后）排序
        List<GroupStat> sortedStats = new ArrayList<>(filteredStats);
        
        // 判断是奖励还是惩罚
        boolean isReward = condition.getRewardType() != null || 
                          (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
        
        if (isReward) {
            // 奖励情况：根据考勤类型选择排名依据
            if ("区间助攻考勤".equals(attendanceType)) {
                // 区间助攻考勤：按助攻增量降序排列
                sortedStats.sort((a, b) -> Long.compare(b.getAverageAssistIncreaseBonus(), a.getAverageAssistIncreaseBonus()));
            } else {
                // 其他考勤类型：按战功增量降序排列
                sortedStats.sort((a, b) -> Long.compare(b.getAverageMeritIncreaseBonus(), a.getAverageMeritIncreaseBonus()));
            }
        } else {
            // 惩罚情况：根据考勤类型选择排名依据
            if ("区间助攻考勤".equals(attendanceType)) {
                // 区间助攻考勤：按助攻增量升序排列
                sortedStats.sort((a, b) -> Long.compare(a.getAverageAssistIncreaseBonus(), b.getAverageAssistIncreaseBonus()));
            } else {
                // 其他考勤类型：按战功增量升序排列
                sortedStats.sort((a, b) -> Long.compare(a.getAverageMeritIncreaseBonus(), b.getAverageMeritIncreaseBonus()));
            }
        }
        
        // 计算密集排名
        Map<String, Integer> rankings;
        if ("区间助攻考勤".equals(attendanceType)) {
            rankings = calculateDenseRanking(sortedStats, 
                GroupStat::getAverageAssistIncreaseBonus, isReward);
        } else {
            rankings = calculateDenseRanking(sortedStats, 
                GroupStat::getAverageMeritIncreaseBonus, isReward);
        }
        
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
            // 判断是奖励还是惩罚
            boolean isReward = condition.getRewardType() != null || 
                              (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
            
            if (isReward) {
                // 奖励情况：出勤率（加成后）大于等于阈值
                if (stat.getAttendanceRateBonus() >= threshold) {
                    filteredStats.add(stat);
                }
            } else {
                // 惩罚情况：出勤率（加成后）小于等于阈值
                if (stat.getAttendanceRateBonus() <= threshold) {
                    filteredStats.add(stat);
                }
            }
        }
        
        if (filteredStats.isEmpty()) {
            return; // 没有队伍满足出勤率条件
        }
        
        // 按出勤率（加成后）排序
        // 判断是奖励还是惩罚
        boolean isReward = condition.getRewardType() != null || 
                          (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
        
        if (isReward) {
            // 奖励情况：按出勤率降序排列（高到低），第1名是出勤率最高的
            filteredStats.sort((a, b) -> Double.compare(b.getAttendanceRateBonus(), a.getAttendanceRateBonus()));
        } else {
            // 惩罚情况：按出勤率升序排列（低到高），第1名是出勤率最低的（倒数第1名）
            filteredStats.sort((a, b) -> Double.compare(a.getAttendanceRateBonus(), b.getAttendanceRateBonus()));
        }
        
        // 计算密集排名
        Map<String, Integer> rankings = calculateDenseRanking(filteredStats, 
            GroupStat::getAttendanceRateBonus, isReward);
        
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
        // 判断是奖励还是惩罚
        boolean isReward = condition.getRewardType() != null || 
                          (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
        
        if (isReward) {
            // 奖励情况
            if ("CASH".equals(condition.getRewardMode())) {
                // 现金奖励模式
                distributeCashReward(condition, qualifiedTeams, results);
            } else {
                // 码表奖励模式（默认）
                distributeCodeTableReward(condition, qualifiedTeams, results);
            }
        } else {
            // 惩罚情况
            if ("CASH".equals(condition.getPenaltyMode())) {
                // 现金惩罚模式
                distributeCashReward(condition, qualifiedTeams, results);
            } else {
                // 码表惩罚模式（默认）
                distributeCodeTableReward(condition, qualifiedTeams, results);
            }
        }
    }
    
    /**
     * 分配现金奖励/惩罚
     */
    private void distributeCashReward(RewardCondition condition, List<String> qualifiedTeams, List<SettlementResult> results) {
        // 判断是奖励还是惩罚
        boolean isReward = condition.getRewardType() != null || 
                          (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
        
        BigDecimal totalCashAmount;
        if (isReward) {
            totalCashAmount = condition.getCashRewardAmount();
            if (totalCashAmount == null) {
                throw new RuntimeException("现金奖励金额不能为空");
            }
        } else {
            totalCashAmount = condition.getCashPenaltyAmount();
            if (totalCashAmount == null) {
                throw new RuntimeException("现金惩罚金额不能为空");
            }
        }
        
        // 为每个队伍创建结算结果
        for (String teamName : qualifiedTeams) {
            SettlementResult result = new SettlementResult();
            result.setTeamName(teamName);
            result.setRewardType("现金"); // 现金奖励标识
            result.setQuantity(1.0); // 现金奖励数量固定为1
            
            BigDecimal cashAmount;
            String description;
            
            if (isReward) {
                // 奖励情况：平分奖励
                BigDecimal cashPerTeam = totalCashAmount.divide(BigDecimal.valueOf(qualifiedTeams.size()), 2, BigDecimal.ROUND_HALF_UP);
                cashAmount = cashPerTeam;
                description = "现金" + (cashPerTeam.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "") + cashPerTeam + "元";
                result.setAmount(cashPerTeam);
                result.setMultiplier(cashPerTeam); // 使用multiplier存储现金金额
            } else {
                // 惩罚情况：不平分，每个队伍都处罚输入的数值（负数）
                cashAmount = totalCashAmount; // 直接使用原始金额（已经是负数）
                description = "现金" + cashAmount + "元";
                result.setAmount(cashAmount);
                result.setMultiplier(cashAmount); // 使用multiplier存储现金金额
            }
            
            result.setRewardDescription(description);
            results.add(result);
        }
    }
    
    /**
     * 分配码表奖励（支持"双"前缀的数量翻倍）
     */
    private void distributeCodeTableReward(RewardCondition condition, List<String> qualifiedTeams, List<SettlementResult> results) {
        // 判断是奖励还是惩罚
        boolean isReward = condition.getRewardType() != null || 
                          (condition.getRewardMode() != null && "CASH".equals(condition.getRewardMode()) && condition.getCashRewardAmount() != null);
        
        String rewardType = isReward ? condition.getRewardType() : condition.getPenaltyType();
        
        // 解析奖励类型和数量倍数
        String baseRewardType = rewardType;
        BigDecimal quantityMultiplier = BigDecimal.ONE;
        
        if (rewardType.startsWith("双")) {
            baseRewardType = rewardType.substring(1); // 去掉"双"前缀
            quantityMultiplier = BigDecimal.valueOf(2.0); // 数量翻倍
        }
        
        // 获取基础码表值
        CodeTable codeTable = codeTableRepository.findByCodeName(baseRewardType);
        if (codeTable == null) {
            throw new RuntimeException("未找到基础奖惩类型: " + baseRewardType);
        }
        
        // 码表奖励：并列队伍不平分，每队都获得完整奖励
        BigDecimal baseQuantity = BigDecimal.valueOf(1.0); // 基础数量
        BigDecimal finalQuantity = baseQuantity.multiply(quantityMultiplier); // 最终数量
        
        // 计算倍数（保持向后兼容）
        BigDecimal multiplier = finalQuantity;
        
        // 计算金额（保持向后兼容）
        BigDecimal amount = BigDecimal.valueOf(codeTable.getCodeValue()).multiply(multiplier);
        
        // 为每个队伍创建结算结果
        for (String teamName : qualifiedTeams) {
            SettlementResult result = new SettlementResult();
            result.setTeamName(teamName);
            result.setRewardType(baseRewardType); // 保存基础类型，如"花"、"屎"（用于数据库存储和合成）
            result.setQuantity(finalQuantity.doubleValue()); // 保存最终数量，如2.0
            result.setMultiplier(multiplier); // 保持向后兼容
            result.setRewardDescription(rewardType); // 前端显示用原始类型，如"双花"、"花"
            result.setAmount(amount); // 保持向后兼容
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
     * 更新单个团队的参加考勤状态
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
            throw new RuntimeException("更新团队参加状态失败: " + e.getMessage());
        }
    }

    /**
     * 批量更新多个团队的参加考勤状态
     */
    @PutMapping("/sessions/{sessionId}/teams-attendance")
    public AttendanceSession updateTeamsAttendance(@PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("考勤记录不存在"));
        
        @SuppressWarnings("unchecked")
        List<String> teamNames = (List<String>) request.get("teamNames");
        Boolean isAttending = (Boolean) request.get("isAttending");
        
        if (teamNames == null || teamNames.isEmpty() || isAttending == null) {
            throw new RuntimeException("团队名称列表和参加状态不能为空");
        }
        
        try {
            // 解析现有的memberData
            ObjectMapper mapper = new ObjectMapper();
            List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
            
            // 批量更新指定团队所有成员的参加考勤状态
            Set<String> teamNameSet = new HashSet<>(teamNames);
            boolean found = false;
            int updatedCount = 0;
            List<String> notFoundTeams = new ArrayList<>();
            
            for (MemberData member : memberDataList) {
                if (teamNameSet.contains(member.get分组())) {
                    member.set参加考勤(isAttending);
                    found = true;
                    updatedCount++;
                }
            }
            
            // 检查是否有未找到的团队
            for (String teamName : teamNames) {
                boolean teamFound = false;
                for (MemberData member : memberDataList) {
                    if (member.get分组().equals(teamName)) {
                        teamFound = true;
                        break;
                    }
                }
                if (!teamFound) {
                    notFoundTeams.add(teamName);
                }
            }
            
            if (!found) {
                throw new RuntimeException("未找到任何指定团队");
            }
            
            if (!notFoundTeams.isEmpty()) {
                throw new RuntimeException("未找到以下团队: " + String.join(", ", notFoundTeams));
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
     * 获取所有可用的考勤类型
     */
    @GetMapping("/attendance-types")
    public List<String> getAttendanceTypes() {
        // 从数据库中查询所有已结算且不重复的考勤类型（排除手动添加类型）
        List<String> dbTypes = attendanceSessionRepository.findDistinctAttendanceTypesSettledExcludingManual();
        
        // 如果数据库中没有数据，返回默认的考勤类型列表（作为兜底）
        if (dbTypes == null || dbTypes.isEmpty()) {
            return Arrays.asList(
                "压秒考勤",
                "区间战功考勤", 
                "区间助攻考勤",
                "晨练考勤",
                "夜战考勤",
                "其他"
            );
        }
        
        return dbTypes;
    }

    // ==================== 数据统计接口 ====================

    /**
     * 数据统计查询 - 根据日期区间和考勤类型查询考勤记录
     */
    @GetMapping("/statistics/query")
    public StatisticsQueryResponse queryStatistics(@RequestParam String startDate, 
                                                  @RequestParam String endDate, 
                                                  @RequestParam(required = false) String attendanceType) {
        try {
            // 解析日期参数
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询已结算的考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                        startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                attendanceType, startDateTime, endDateTime);
            }
            
            // 转换为简化信息
            List<AttendanceSessionInfo> sessionInfos = new ArrayList<>();
            Set<String> teamSet = new HashSet<>();
            
            for (AttendanceSession session : sessions) {
                // 创建简化信息
                AttendanceSessionInfo info = new AttendanceSessionInfo(
                    session.getId(),
                    session.getName(),
                    session.getStartTime(),
                    session.getEndTime(),
                    session.getAttendanceType(),
                    session.getBattleResult().toString(),
                    session.getStatus().toString()
                );
                sessionInfos.add(info);
                
                // 提取涉及的团队
                if (session.getMemberData() != null && !session.getMemberData().isEmpty()) {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                        
                        for (MemberData member : memberDataList) {
                            if (member.get分组() != null && !member.get分组().trim().isEmpty()) {
                                teamSet.add(member.get分组());
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("解析成员数据失败: " + e.getMessage());
                    }
                }
            }
            
            // 转换为列表并排序
            List<String> teams = new ArrayList<>(teamSet);
            teams.sort(String::compareTo);
            
            return new StatisticsQueryResponse(sessionInfos, teams, sessions.size());
            
        } catch (Exception e) {
            throw new RuntimeException("查询统计数据失败: " + e.getMessage());
        }
    }

    /**
     * 团队出勤率计算 - 计算指定团队在时间段内的出勤率数据
     */
    @GetMapping("/statistics/team-attendance-rate")
    public TeamAttendanceRateResponse getTeamAttendanceRate(@RequestParam String startDate, 
                                                         @RequestParam String endDate, 
                                                         @RequestParam(required = false) String attendanceType, 
                                                         @RequestParam String teamName) {
        try {
            // 解析日期参数
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询已结算的考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                        startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                attendanceType, startDateTime, endDateTime);
            }
            
            System.out.println(String.format("数据统计调试 - 查询到 %d 条考勤记录，考勤类型: %s, 时间范围: %s 到 %s", 
                sessions.size(), attendanceType, startDateTime, endDateTime));
            
            // 如果查询不到记录，尝试查询所有记录看看有什么
            if (sessions.isEmpty()) {
                List<AttendanceSession> allSessions = attendanceSessionRepository.findAll();
                System.out.println(String.format("数据统计调试 - 数据库中总共有 %d 条考勤记录", allSessions.size()));
                for (AttendanceSession s : allSessions) {
                    System.out.println(String.format("数据统计调试 - 考勤记录: ID=%d, 名称=%s, 类型=%s, 开始时间=%s, 结束时间=%s", 
                        s.getId(), s.getName(), s.getAttendanceType(), s.getStartTime(), s.getEndTime()));
                }
            }
            
            List<AttendanceRateData> result = new ArrayList<>();
            // 用于统计缺勤的Map: 成员名 -> 缺勤次数
            Map<String, Integer> absenceMap = new HashMap<>();
            
            for (AttendanceSession session : sessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    // 解析成员数据
                    ObjectMapper mapper = new ObjectMapper();
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    // 过滤指定团队的成员
                    List<MemberData> teamMembers = memberDataList.stream()
                        .filter(member -> teamName.equals(member.get分组()))
                        .collect(Collectors.toList());
                    
                    System.out.println(String.format("数据统计调试 - 考勤记录 %d (%s), 总成员数: %d, 目标团队 %s 成员数: %d", 
                        session.getId(), session.getName(), memberDataList.size(), teamName, teamMembers.size()));
                    
                    if (teamMembers.isEmpty()) {
                        continue; // 该次考勤中没有该团队的成员
                    }
                    
                    // 计算团队出勤率 - 与考勤记录保持一致：达标人数 / 参加考勤人数
                    // 注意：这里只统计参加考勤的成员，与考勤记录的逻辑一致
                    long attendingCount = teamMembers.stream()
                        .mapToLong(member -> member.is参加考勤() ? 1 : 0)
                        .sum();
                    
                    // 重新计算达标状态，确保与考勤记录的逻辑一致
                    // 同时统计缺勤人员（参加了考勤但不达标）
                    long qualifiedCount = teamMembers.stream()
                        .mapToLong(member -> {
                            if (!member.is参加考勤()) {
                                return 0;
                            }
                            // 根据考勤类型选择达标判断标准
                            boolean isQualified;
                            if ("区间助攻考勤".equals(attendanceType)) {
                                isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                            } else {
                                isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                            }
                            
                            // 如果参加了考勤但不达标，记录为缺勤
                            if (!isQualified) {
                                absenceMap.put(member.get成员(), 
                                    absenceMap.getOrDefault(member.get成员(), 0) + 1);
                            }
                            
                            return isQualified ? 1 : 0;
                        })
                        .sum();
                    
                    // 添加调试信息
                    System.out.println(String.format("数据统计调试 - 团队: %s, 总成员数: %d, 参加考勤: %d, 达标: %d, 阈值: %d, 考勤类型: %s", 
                        teamName, teamMembers.size(), attendingCount, qualifiedCount, session.getThreshold(), attendanceType));
                    
                    // 显示前几个成员的详细数据
                    int debugCount = Math.min(3, teamMembers.size());
                    for (int i = 0; i < debugCount; i++) {
                        MemberData member = teamMembers.get(i);
                        long diff = member.get后值() - member.get前值();
                        long assistDiff = member.get助攻后值() - member.get助攻前值();
                        boolean isQualified = false;
                        if ("区间助攻考勤".equals(attendanceType)) {
                            isQualified = assistDiff >= session.getThreshold();
                        } else {
                            isQualified = diff >= session.getThreshold();
                        }
                        System.out.println(String.format("数据统计调试 - 成员 %s: 战功差值=%d, 助攻差值=%d, 达标=%s", 
                            member.get成员(), diff, assistDiff, isQualified));
                    }
                    
                    double attendanceRate = 0.0;
                    if (attendingCount > 0) {
                        attendanceRate = (double) qualifiedCount / attendingCount * 100.0;
                        // 与小组统计保持一致：四舍五入到小数点后2位
                        attendanceRate = Math.round(attendanceRate * 100.0) / 100.0;
                        System.out.println(String.format("数据统计调试 - 团队: %s, 出勤率: %.2f%%", teamName, attendanceRate));
                    } else {
                        System.out.println(String.format("数据统计调试 - 团队: %s, 无人参加考勤，出勤率为0", teamName));
                    }
                    
                    // 获取参加考勤的人数（与考勤记录中的memberCount含义一致）
                    int memberCount = (int) attendingCount;
                    
                    // 应用加成配置
                    TeamSizeBonusRule applicableRule = bonusConfigService.getApplicableBonusRule(memberCount);
                    double bonusRate = attendanceRate;
                    boolean bonusApplied = false;
                    String bonusDescription = "无加成";
                    
                    if (applicableRule != null) {
                        bonusRate = attendanceRate + applicableRule.getAttendanceRateBonus();
                        // 限制加成后出勤率不能超过100%
                        if (bonusRate > 100.0) {
                            bonusRate = 100.0;
                        }
                        // 与小组统计保持一致：四舍五入到小数点后2位
                        bonusRate = Math.round(bonusRate * 100.0) / 100.0;
                        bonusApplied = true;
                        bonusDescription = String.format("团队%d人，出勤率+%.1f%%", 
                            memberCount, applicableRule.getAttendanceRateBonus());
                        
                        // 添加调试信息，与小组统计保持一致
                        System.out.println(String.format("数据统计 - 团队 %s (%d人) 应用加成规则: 出勤率+%.1f%%", 
                            teamName, memberCount, applicableRule.getAttendanceRateBonus()));
                    }
                    
                    // 创建出勤率数据
                    String dateStr = session.getStartTime() != null ? 
                        session.getStartTime().toLocalDate().toString() : "未知日期";
                    
                    // 更新加成描述，包含更详细的信息
                    int totalTeamMembers = teamMembers.size(); // 团队总人数
                    String detailedBonusDescription = String.format("团队总人数%d人，参加考勤%d人，达标%d人，出勤率%.1f%%", 
                        totalTeamMembers, attendingCount, qualifiedCount, attendanceRate);
                    if (bonusApplied && applicableRule != null) {
                        detailedBonusDescription += String.format("，加成+%.1f%%", applicableRule.getAttendanceRateBonus());
                    }
                    
                    AttendanceRateData data = new AttendanceRateData(
                        dateStr,
                        session.getStartTime(),
                        session.getEndTime(),
                        attendanceRate,
                        bonusRate,
                        totalTeamMembers, // 使用团队总人数
                        bonusApplied,
                        detailedBonusDescription
                    );
                    
                    result.add(data);
                    
                } catch (Exception e) {
                    System.err.println("处理考勤记录失败: " + session.getId() + ", " + e.getMessage());
                }
            }
            
            // 按时间排序
            result.sort((a, b) -> {
                if (a.getStartTime() == null || b.getStartTime() == null) {
                    return 0;
                }
                return a.getStartTime().compareTo(b.getStartTime());
            });
            
            // 将缺勤统计转换为列表，按缺勤次数从高到低排序
            List<AbsenceStatistics> absenceStatistics = absenceMap.entrySet().stream()
                .map(entry -> new AbsenceStatistics(entry.getKey(), entry.getValue()))
                .sorted((a, b) -> Integer.compare(b.getAbsenceCount(), a.getAbsenceCount())) // 从高到低
                .collect(Collectors.toList());
            
            return new TeamAttendanceRateResponse(result, absenceStatistics);
            
        } catch (Exception e) {
            throw new RuntimeException("计算团队出勤率失败: " + e.getMessage());
        }
    }

    /**
     * 全团出勤率对比 - 计算所有团队在时间段内的出勤率数据（加成后）
     */
    @GetMapping("/statistics/all-teams-attendance-rate")
    public AllTeamsAttendanceRateResponse getAllTeamsAttendanceRate(
            @RequestParam String startDate, 
            @RequestParam String endDate, 
            @RequestParam(required = false) String attendanceType) {
        try {
            // 解析日期参数
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询已结算的考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                        startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                        attendanceType, startDateTime, endDateTime);
            }
            
            // 按开始时间排序
            sessions.sort((a, b) -> {
                if (a.getStartTime() == null || b.getStartTime() == null) {
                    return 0;
                }
                return a.getStartTime().compareTo(b.getStartTime());
            });
            
            List<SessionTeamRates> result = new ArrayList<>();
            
            for (AttendanceSession session : sessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    // 解析成员数据
                    ObjectMapper mapper = new ObjectMapper();
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    // 按团队分组
                    Map<String, List<MemberData>> teamMembersMap = memberDataList.stream()
                        .filter(member -> member.get分组() != null && !member.get分组().trim().isEmpty())
                        .collect(Collectors.groupingBy(MemberData::get分组));
                    
                    // 如果没有任何团队数据，跳过
                    if (teamMembersMap.isEmpty()) {
                        continue;
                    }
                    
                    // 计算每个团队的出勤率（加成后）
                    Map<String, Double> teamRates = new HashMap<>();
                    
                    for (Map.Entry<String, List<MemberData>> entry : teamMembersMap.entrySet()) {
                        String teamName = entry.getKey();
                        List<MemberData> teamMembers = entry.getValue();
                        
                        // 计算团队出勤率 - 与单个团队接口逻辑一致
                        long attendingCount = teamMembers.stream()
                            .mapToLong(member -> member.is参加考勤() ? 1 : 0)
                            .sum();
                        
                        long qualifiedCount = teamMembers.stream()
                            .mapToLong(member -> {
                                if (!member.is参加考勤()) {
                                    return 0;
                                }
                                // 根据考勤类型选择达标判断标准
                                boolean isQualified;
                                if ("区间助攻考勤".equals(attendanceType)) {
                                    isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                                } else {
                                    isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                                }
                                return isQualified ? 1 : 0;
                            })
                            .sum();
                        
                        double attendanceRate = 0.0;
                        if (attendingCount > 0) {
                            attendanceRate = (double) qualifiedCount / attendingCount * 100.0;
                            // 四舍五入到小数点后2位
                            attendanceRate = Math.round(attendanceRate * 100.0) / 100.0;
                        }
                        
                        // 应用加成配置
                        int memberCount = (int) attendingCount;
                        TeamSizeBonusRule applicableRule = bonusConfigService.getApplicableBonusRule(memberCount);
                        double bonusRate = attendanceRate;
                        
                        if (applicableRule != null) {
                            bonusRate = attendanceRate + applicableRule.getAttendanceRateBonus();
                            // 限制加成后出勤率不能超过100%
                            if (bonusRate > 100.0) {
                                bonusRate = 100.0;
                            }
                            // 四舍五入到小数点后2位
                            bonusRate = Math.round(bonusRate * 100.0) / 100.0;
                        }
                        
                        // 存储加成后出勤率
                        teamRates.put(teamName, bonusRate);
                    }
                    
                    // 创建考勤时间点的数据
                    SessionTeamRates sessionData = new SessionTeamRates(
                        session.getName(),  // 考勤名称
                        session.getStartTime(),  // 开始时间（用于排序）
                        teamRates  // 所有团队的加成后出勤率
                    );
                    
                    result.add(sessionData);
                    
                } catch (Exception e) {
                    System.err.println("处理考勤记录失败: " + session.getId() + ", " + e.getMessage());
                }
            }
            
            return new AllTeamsAttendanceRateResponse(result);
            
        } catch (Exception e) {
            throw new RuntimeException("计算全团出勤率失败: " + e.getMessage());
        }
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
                new CodeTable("花瓣", 0, "REWARD", "花瓣奖励"),
                new CodeTable("花", 0, "REWARD", "花奖励")
            );

            // 初始化处罚码表
            List<CodeTable> penaltyCodes = Arrays.asList(
                new CodeTable("屎粒", 0, "PENALTY", "屎粒处罚"),
                new CodeTable("屎", 0, "PENALTY", "屎处罚")
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
    @Transactional
    public ResponseEntity<String> deleteSeason(@PathVariable Long id) {
        try {
            Season season = seasonRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + id));
            
            // 获取该赛季的所有考勤记录
            List<AttendanceSession> sessions = attendanceSessionRepository.findBySeasonId(id);
            
            // 分离真实考勤记录和虚拟记录
            List<AttendanceSession> realSessions = sessions.stream()
                    .filter(session -> !session.getName().startsWith("手动添加-"))
                    .collect(Collectors.toList());
            
            List<AttendanceSession> virtualSessions = sessions.stream()
                    .filter(session -> session.getName().startsWith("手动添加-"))
                    .collect(Collectors.toList());
            
            System.out.println("赛季ID: " + id + ", 真实考勤记录: " + realSessions.size() + ", 虚拟记录: " + virtualSessions.size());
            
            // 如果有真实考勤记录，不允许删除
            if (!realSessions.isEmpty()) {
                return ResponseEntity.badRequest().body("无法删除赛季：该赛季已被 " + realSessions.size() + " 条真实考勤记录使用，请先删除相关的考勤记录");
            }
            
            // 如果有虚拟记录，先删除它们
            if (!virtualSessions.isEmpty()) {
                System.out.println("删除 " + virtualSessions.size() + " 个虚拟考勤记录");
                attendanceSessionRepository.deleteAll(virtualSessions);
            }
            
            // 删除赛季
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
            
            // 生成结算批次ID，基于当前时间和考勤记录ID
            String settlementBatchId = "BATCH_" + sessionId + "_" + System.currentTimeMillis();
            
            // 保存结算记录
            List<SettlementRecord> records = new ArrayList<>();
            
            for (SettlementResult result : settlementResults) {
                // 判断是否为现金奖励
                if ("现金".equals(result.getRewardType())) {
                    // 现金奖励：创建一条记录
                    SettlementRecord record = new SettlementRecord();
                    record.setTeamName(result.getTeamName());
                    record.setCodeValue(result.getRewardType());
                    record.setQuantity(BigDecimal.ONE); // 现金记录数量固定为1
                    record.setCashAmount(result.getAmount());
                    record.setRewardMode("CASH");
                    record.setSettlementBatchId(settlementBatchId);
                    record.setAttendanceSession(session);
                    records.add(record);
                } else {
                    // 码表奖励：根据数量创建多条记录
                    int quantity = result.getQuantity().intValue();
                    String baseCodeValue = result.getRewardType();
                    
                    // 处理双花双屎：转换为基础类型
                    if (baseCodeValue.startsWith("双")) {
                        baseCodeValue = baseCodeValue.substring(1); // 去掉"双"前缀
                        quantity = quantity * 2; // 数量翻倍
                    }
                    
                    // 创建多条记录，每个物品一条记录
                    for (int i = 0; i < quantity; i++) {
                        SettlementRecord record = new SettlementRecord();
                        record.setTeamName(result.getTeamName());
                        record.setCodeValue(baseCodeValue); // 使用基础类型（如"花"、"屎"）
                        record.setQuantity(BigDecimal.ONE); // 每条记录数量固定为1
                        record.setRewardMode("CODE_TABLE");
                        record.setSettlementBatchId(settlementBatchId);
                        record.setAttendanceSession(session);
                        records.add(record);
                    }
                }
            }
            
            // 保存记录后再构建日志内容，使用实际保存的 codeValue
            settlementRecordRepository.saveAll(records);
            System.out.println("保存了 " + records.size() + " 条结算记录");
            
            // 按团队分组统计，构建日志内容
            StringBuilder settlementContent = new StringBuilder();
            Map<String, Map<String, Object>> teamSummary = new HashMap<>();
            
            for (SettlementRecord record : records) {
                String teamName = record.getTeamName();
                teamSummary.putIfAbsent(teamName, new HashMap<>());
                Map<String, Object> summary = teamSummary.get(teamName);
                
                if ("CASH".equals(record.getRewardMode())) {
                    // 现金奖励
                    BigDecimal cashAmount = record.getCashAmount();
                    if (cashAmount != null) {
                        BigDecimal existingCash = (BigDecimal) summary.getOrDefault("cash", BigDecimal.ZERO);
                        summary.put("cash", existingCash.add(cashAmount));
                    }
                } else {
                    // 码表奖励，按 codeValue 分组统计数量
                    String codeValue = record.getCodeValue();
                    @SuppressWarnings("unchecked")
                    Map<String, Integer> items = (Map<String, Integer>) summary.getOrDefault("items", new HashMap<String, Integer>());
                    items.put(codeValue, items.getOrDefault(codeValue, 0) + 1);
                    summary.put("items", items);
                }
            }
            
            // 构建日志内容字符串
            for (Map.Entry<String, Map<String, Object>> entry : teamSummary.entrySet()) {
                String teamName = entry.getKey();
                Map<String, Object> summary = entry.getValue();
                
                settlementContent.append(teamName).append(": ");
                
                // 现金奖励
                if (summary.containsKey("cash")) {
                    BigDecimal cashAmount = (BigDecimal) summary.get("cash");
                    settlementContent.append("现金")
                            .append(cashAmount.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "")
                            .append(cashAmount)
                            .append("元");
                }
                
                // 码表奖励
                if (summary.containsKey("items")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Integer> items = (Map<String, Integer>) summary.get("items");
                    for (Map.Entry<String, Integer> itemEntry : items.entrySet()) {
                        if (settlementContent.length() > 0 && 
                            !settlementContent.toString().endsWith(": ")) {
                            settlementContent.append(" ");
                        }
                        settlementContent.append(itemEntry.getKey())
                                .append(" x")
                                .append(itemEntry.getValue());
                    }
                }
                
                settlementContent.append("; ");
            }
            
            // 记录日志
            SettlementLog log = new SettlementLog();
            log.setAttendanceRecordName(session.getName());
            log.setSettlementSeason(session.getSeason().getName());
            log.setSettlementContent(settlementContent.toString());
            log.setAttendanceSession(session);
            
            settlementLogRepository.save(log);
            System.out.println("保存结算日志成功");
            
            // 更新考勤记录状态为已结算
            session.setStatus(SessionStatus.SETTLED);
            attendanceSessionRepository.save(session);
            System.out.println("更新考勤记录状态为已结算");
            
            // 执行合成检查，传递触发批次ID和考勤会话ID
            try {
                synthesisService.checkAndPerformSynthesis(
                    session.getSeason().getId(), 
                    settlementBatchId, 
                    session.getId()
                );
                System.out.println("合成检查完成");
            } catch (Exception e) {
                System.err.println("合成检查失败: " + e.getMessage());
                e.printStackTrace();
                // 合成失败不影响结算成功
            }
            
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
     * 获取已结算的记录详情
     */
    @GetMapping("/sessions/{sessionId}/settled-records")
    public ResponseEntity<List<SettlementResult>> getSettledRecords(@PathVariable Long sessionId) {
        try {
            AttendanceSession session = attendanceSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("未找到考勤记录: " + sessionId));
            
            // 检查考勤记录状态
            if (session.getStatus() != SessionStatus.SETTLED) {
                return ResponseEntity.badRequest().body(null);
            }
            
            // 获取该考勤记录的所有结算记录，只包含原始记录（非合成记录）
            List<SettlementRecord> settlementRecords = settlementRecordRepository.findByAttendanceSessionId(sessionId);
            
            // 过滤掉合成记录，只保留原始结算记录
            List<SettlementRecord> originalRecords = settlementRecords.stream()
                    .filter(record -> !Boolean.TRUE.equals(record.getIsSynthetic()))
                    .collect(Collectors.toList());
            
            // 按团队聚合原始结算记录，计算每个团队的总金额和奖惩描述
            Map<String, List<SettlementRecord>> recordsByTeam = originalRecords.stream()
                    .collect(Collectors.groupingBy(SettlementRecord::getTeamName));
            
            List<SettlementResult> results = new ArrayList<>();
            
            for (Map.Entry<String, List<SettlementRecord>> entry : recordsByTeam.entrySet()) {
                String teamName = entry.getKey();
                List<SettlementRecord> teamRecords = entry.getValue();
                
                // 计算总金额
                BigDecimal totalAmount = teamRecords.stream()
                        .map(record -> record.getCashAmount() != null ? record.getCashAmount() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                
                // 生成奖惩描述
                Map<String, Long> itemCounts = teamRecords.stream()
                        .filter(record -> record.getCodeValue() != null && !record.getCodeValue().isEmpty())
                        .collect(Collectors.groupingBy(
                                SettlementRecord::getCodeValue,
                                Collectors.counting()
                        ));
                
                StringBuilder description = new StringBuilder();
                for (Map.Entry<String, Long> itemEntry : itemCounts.entrySet()) {
                    if (description.length() > 0) {
                        description.append(", ");
                    }
                    description.append(itemEntry.getValue()).append("个").append(itemEntry.getKey());
                }
                
                if (description.length() == 0) {
                    description.append("现金奖励");
                }
                
                SettlementResult result = new SettlementResult();
                result.setTeamName(teamName);
                result.setRewardDescription(description.toString());
                result.setAmount(totalAmount);
                
                results.add(result);
            }
            
            // 按团队名称排序
            results.sort(Comparator.comparing(SettlementResult::getTeamName));
            
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            System.err.println("获取已结算记录失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(null);
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
            
            // 检查考勤记录状态
            if (session.getStatus() != SessionStatus.SETTLED) {
                return ResponseEntity.badRequest().body("该考勤记录状态不是已结算，无法撤销结算");
            }
            
            // 获取最新的结算批次ID
            String latestBatchId = settlementRecordRepository.findLatestSettlementBatchIdByAttendanceSessionId(sessionId);
            if (latestBatchId == null) {
                return ResponseEntity.badRequest().body("该考勤记录没有结算记录可以撤销");
            }
            
            // 只删除最新批次的结算记录
            List<SettlementRecord> records = settlementRecordRepository.findBySettlementBatchId(latestBatchId);
            if (records.isEmpty()) {
                return ResponseEntity.badRequest().body("该考勤记录没有结算记录可以撤销");
            }
            
            System.out.println("开始撤销结算，考勤记录ID: " + sessionId + ", 批次ID: " + latestBatchId);
            
            // 分析撤销影响
            CascadeRevocationService.RevocationImpactAnalysis analysis = 
                cascadeRevocationService.analyzeRevocationImpact(latestBatchId);
            
            // 检查支付状态：不能撤销已支付的记录
            List<Long> allAffectedRecordIds = new ArrayList<>();
            allAffectedRecordIds.addAll(analysis.getDirectRecords().stream()
                    .map(SettlementRecord::getId)
                    .collect(Collectors.toList()));
            allAffectedRecordIds.addAll(analysis.getSynthesisRecordsToDelete().stream()
                    .map(SettlementRecord::getId)
                    .collect(Collectors.toList()));
            
            if (paymentService.anyPaid(allAffectedRecordIds)) {
                return ResponseEntity.badRequest().body("该结算包含已支付的记录，无法撤销。请先撤销支付状态。");
            }
            
            // 构建撤销日志内容，体现具体的撤销内容
            StringBuilder revokeContent = new StringBuilder();
            revokeContent.append("撤销结算，删除了以下结算记录：");
            
            // 记录直接删除的记录
            for (SettlementRecord record : analysis.getDirectRecords()) {
                revokeContent.append(record.getTeamName())
                        .append(": ");
                if ("CASH".equals(record.getRewardMode())) {
                    revokeContent.append("现金").append(record.getCashAmount()).append("元");
                } else {
                    revokeContent.append(record.getCodeValue())
                            .append(" x").append(record.getQuantity());
                }
                revokeContent.append("; ");
            }
            
            // 如果有级联影响，记录合成撤销信息
            if (analysis.isHasImpact()) {
                revokeContent.append(" 级联撤销合成：删除了")
                        .append(analysis.getSynthesisRecordsToDelete().size())
                        .append("条合成记录，恢复了")
                        .append(analysis.getRecordsToRestore().size())
                        .append("条原始记录");
            }
            
            // 执行级联撤销
            cascadeRevocationService.executeRevocationWithCascade(latestBatchId);
            
            // 记录撤销日志
            SettlementLog log = new SettlementLog();
            log.setAttendanceRecordName(session.getName());
            log.setSettlementSeason(session.getSeason() != null ? session.getSeason().getName() : "未知赛季");
            log.setSettlementContent(revokeContent.toString());
            log.setAttendanceSession(session);
            
            settlementLogRepository.save(log);
            System.out.println("保存撤销日志成功");
            
            // 更新考勤记录状态为已保存
            session.setStatus(SessionStatus.SAVED);
            attendanceSessionRepository.save(session);
            System.out.println("更新考勤记录状态为已保存");
            
            // 撤销后重新触发合成检查
            if (session.getSeason() != null) {
                System.out.println("撤销后重新触发合成检查，赛季ID: " + session.getSeason().getId());
                try {
                    synthesisService.checkAndPerformSynthesis(session.getSeason().getId(), "REVOKE_" + latestBatchId, session.getId());
                    System.out.println("撤销后合成检查完成");
                } catch (Exception e) {
                    System.err.println("撤销后合成检查失败: " + e.getMessage());
                    // 合成检查失败不影响撤销操作的成功
                }
            }
            
            String resultMessage = "结算撤销成功，删除了 " + analysis.getDirectRecords().size() + " 条记录";
            if (analysis.isHasImpact()) {
                resultMessage += "，级联撤销了 " + analysis.getAffectedChains().size() + " 个合成链";
            }
            
            return ResponseEntity.ok(resultMessage);
        } catch (Exception e) {
            System.err.println("撤销结算失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("撤销结算失败: " + e.getMessage());
        }
    }

    /**
     * 获取赛季榜单数据 - 按小组统计总奖金
     */
    @GetMapping("/seasons/{seasonId}/ranking")
    public ResponseEntity<Map<String, Object>> getSeasonRanking(@PathVariable Long seasonId) {
        try {
            // 验证赛季是否存在
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 获取该赛季所有已结算的考勤记录的结算记录（只统计ACTIVE状态的记录）
            List<SettlementRecord> settlementRecords = settlementRecordRepository.findBySeasonId(seasonId)
                    .stream()
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            if (settlementRecords.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("seasonName", season.getName());
                response.put("rankingData", new ArrayList<>());
                response.put("totalTeams", 0);
                return ResponseEntity.ok(response);
            }
            
            // 获取所有结算记录的ID
            List<Long> settlementRecordIds = settlementRecords.stream()
                    .map(SettlementRecord::getId)
                    .collect(Collectors.toList());
            
            // 批量查询已支付的记录
            Map<Long, PaymentRecord> paidRecordsMap = paymentRecordRepository.findBySettlementRecordIdIn(settlementRecordIds)
                    .stream()
                    .collect(Collectors.toMap(pr -> pr.getSettlementRecord().getId(), pr -> pr));
            
            // 按小组聚合计算总奖金和已结算金额
            Map<String, Double> teamTotalRewards = new HashMap<>();
            Map<String, Double> teamSettledRewards = new HashMap<>();
            
            for (SettlementRecord record : settlementRecords) {
                String teamName = record.getTeamName();
                double rewardAmount;
                
                if ("CASH".equals(record.getRewardMode())) {
                    // 现金奖励：直接使用现金金额
                    rewardAmount = record.getCashAmount() != null ? record.getCashAmount().doubleValue() : 0.0;
                } else {
                    // 码表奖励：数量 × 码表值
                    String codeValue = record.getCodeValue();
                    BigDecimal quantity = record.getQuantity();
                    
                    CodeTable codeTable = codeTableRepository.findByCodeName(codeValue);
                    if (codeTable != null) {
                        rewardAmount = quantity.doubleValue() * codeTable.getCodeValue();
                    } else {
                        rewardAmount = 0.0;
                    }
                }
                
                // 累加总金额
                teamTotalRewards.merge(teamName, rewardAmount, Double::sum);
                
                // 如果已支付，累加已结算金额
                if (paidRecordsMap.containsKey(record.getId())) {
                    teamSettledRewards.merge(teamName, rewardAmount, Double::sum);
                }
            }
            
            // 转换为榜单数据格式并排序
            List<Map<String, Object>> rankingData = teamTotalRewards.entrySet().stream()
                    .map(entry -> {
                        Map<String, Object> teamData = new HashMap<>();
                        teamData.put("teamName", entry.getKey());
                        teamData.put("totalReward", Math.round(entry.getValue() * 100.0) / 100.0); // 保留2位小数
                        teamData.put("settledReward", Math.round(teamSettledRewards.getOrDefault(entry.getKey(), 0.0) * 100.0) / 100.0); // 已结算金额
                        return teamData;
                    })
                    .sorted((a, b) -> Double.compare((Double) b.get("totalReward"), (Double) a.get("totalReward"))) // 按总奖金降序排列
                    .collect(Collectors.toList());
            
            // 添加排名
            for (int i = 0; i < rankingData.size(); i++) {
                rankingData.get(i).put("rank", i + 1);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("seasonName", season.getName());
            response.put("rankingData", rankingData);
            response.put("totalTeams", rankingData.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("获取赛季榜单失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "获取赛季榜单失败: " + e.getMessage()));
        }
    }

    /**
     * 获取赛季结算明细 - 显示所有结算记录的详细信息
     */
    @GetMapping("/seasons/{seasonId}/settlement-details")
    public ResponseEntity<Map<String, Object>> getSeasonSettlementDetails(
            @PathVariable Long seasonId,
            @RequestParam(required = false) String teams,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            // 验证赛季是否存在
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 获取该赛季所有的结算记录（显示ACTIVE和SYNTHESIZED状态的记录，用于查看完整历史）
            List<SettlementRecord> allSettlementRecords = settlementRecordRepository.findBySeasonId(seasonId)
                    .stream()
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()) || "SYNTHESIZED".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            // 获取所有团队名称
            Set<String> allTeamNamesSet = allSettlementRecords.stream()
                    .map(SettlementRecord::getTeamName)
                    .collect(Collectors.toSet());
            List<String> allTeamNames = new ArrayList<>(allTeamNamesSet);
            allTeamNames.sort(String::compareTo); // 按字母排序
            
            // 应用筛选条件
            List<SettlementRecord> filteredRecords = allSettlementRecords.stream()
                    .filter(record -> {
                        // 团队筛选
                        if (teams != null && !teams.trim().isEmpty()) {
                            List<String> selectedTeams = Arrays.asList(teams.split(","));
                            if (!selectedTeams.contains(record.getTeamName())) {
                                return false;
                            }
                        }
                        
                        // 时间筛选
                        LocalDateTime recordTime = record.getCreatedAt();
                        
                        if (startDate != null && !startDate.trim().isEmpty()) {
                            try {
                                LocalDate start = LocalDate.parse(startDate);
                                LocalDateTime startDateTime = start.atStartOfDay(); // 00:00:00
                                if (recordTime.isBefore(startDateTime)) {
                                    return false;
                                }
                            } catch (Exception e) {
                                System.err.println("解析开始日期失败: " + startDate);
                            }
                        }
                        
                        if (endDate != null && !endDate.trim().isEmpty()) {
                            try {
                                LocalDate end = LocalDate.parse(endDate);
                                LocalDateTime endDateTime = end.atTime(23, 59, 59); // 23:59:59
                                if (recordTime.isAfter(endDateTime)) {
                                    return false;
                                }
                            } catch (Exception e) {
                                System.err.println("解析结束日期失败: " + endDate);
                            }
                        }
                        
                        return true;
                    })
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())) // 按创建时间倒序排序
                    .collect(Collectors.toList());
            
            // 转换为前端需要的格式
            List<Map<String, Object>> detailsList = filteredRecords.stream()
                    .map(record -> {
                        Map<String, Object> detail = new HashMap<>();
                        
                        // 格式化结算时间
                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
                        detail.put("settlementTime", record.getCreatedAt().format(formatter));
                        
                        // 团队名称
                        detail.put("teamName", record.getTeamName());
                        
                        // 奖惩详情
                        if ("CASH".equals(record.getRewardMode())) {
                            // 现金奖励显示具体金额
                            BigDecimal cashAmount = record.getCashAmount();
                            if (cashAmount != null) {
                                detail.put("codeValue", "现金");
                                detail.put("quantity", (cashAmount.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "") + cashAmount + "元");
                            } else {
                                detail.put("codeValue", record.getCodeValue());
                                detail.put("quantity", record.getQuantity());
                            }
                        } else {
                            // 码表奖励显示基础类型和数量，便于合成逻辑
                            detail.put("codeValue", record.getCodeValue()); // 基础类型，如"花"
                            detail.put("quantity", record.getQuantity()); // 数量，如2.0
                        }
                        
                        // 标记记录类型
                        detail.put("isSynthetic", record.getIsSynthetic());
                        if (Boolean.TRUE.equals(record.getIsSynthetic())) {
                            detail.put("synthesisType", "合成记录");
                        } else if ("SYNTHESIZED".equals(record.getRecordStatus())) {
                            detail.put("synthesisType", "已合成");
                        } else {
                            detail.put("synthesisType", "原始记录");
                        }
                        
                        // 考勤名称
                        if (record.getAttendanceSession() != null) {
                            String attendanceName = record.getAttendanceSession().getName();
                            if (attendanceName.startsWith("手动添加-")) {
                                detail.put("attendanceName", "手动添加");
                            } else {
                                detail.put("attendanceName", attendanceName);
                            }
                        } else {
                            detail.put("attendanceName", "手动添加");
                        }
                        
                        // 撤销功能需要的额外字段
                        detail.put("recordId", record.getId());
                        detail.put("settlementBatchId", record.getSettlementBatchId());
                        detail.put("recordStatus", record.getRecordStatus());
                        
                        // 只有直接的手动记录才显示撤销按钮（无论是否已合成），撤销时会级联删除相关合成记录
                        boolean isDirectManualRecord = record.getSettlementBatchId().startsWith("MANUAL_");
                        detail.put("isManual", isDirectManualRecord);
                        
                        return detail;
                    })
                    .collect(Collectors.toList());
            
            // 构建响应数据
            Map<String, Object> response = new HashMap<>();
            response.put("details", detailsList);
            response.put("allTeamNames", allTeamNames);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("获取赛季结算明细失败: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("details", new ArrayList<>());
            errorResponse.put("allTeamNames", new ArrayList<>());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * 手动触发合成检查（用于调试）
     */
    @PostMapping("/seasons/{seasonId}/trigger-synthesis")
    public ResponseEntity<String> triggerSynthesis(@PathVariable Long seasonId) {
        try {
            synthesisService.checkAndPerformSynthesis(seasonId);
            return ResponseEntity.ok("合成检查完成");
        } catch (Exception e) {
            System.err.println("手动合成检查失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("合成检查失败: " + e.getMessage());
        }
    }
    
    /**
     * 获取赛季队伍物品统计 - 显示各队伍当前活跃的物品数量
     */
    @GetMapping("/seasons/{seasonId}/team-items-summary")
    public ResponseEntity<Map<String, Object>> getTeamItemsSummary(@PathVariable Long seasonId) {
        try {
            // 验证赛季是否存在
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 获取该赛季所有活跃状态的结算记录
            List<SettlementRecord> activeRecords = settlementRecordRepository.findBySeasonId(seasonId)
                    .stream()
                    .filter(record -> "ACTIVE".equals(record.getRecordStatus()))
                    .collect(Collectors.toList());
            
            if (activeRecords.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("seasonName", season.getName());
                response.put("teamsSummary", new ArrayList<>());
                response.put("totalTeams", 0);
                return ResponseEntity.ok(response);
            }
            
            // 按队伍分组统计
            Map<String, Map<String, Double>> teamItemsMap = new HashMap<>();
            
            for (SettlementRecord record : activeRecords) {
                String teamName = record.getTeamName();
                
                // 为每个队伍初始化物品统计
                teamItemsMap.putIfAbsent(teamName, new HashMap<>());
                Map<String, Double> itemsMap = teamItemsMap.get(teamName);
                
                // 初始化所有物品类型为0
                itemsMap.putIfAbsent("花瓣", 0.0);
                itemsMap.putIfAbsent("花", 0.0);
                itemsMap.putIfAbsent("屎粒", 0.0);
                itemsMap.putIfAbsent("屎", 0.0);
                itemsMap.putIfAbsent("现金", 0.0);
                
                if ("CASH".equals(record.getRewardMode())) {
                    // 现金奖励：累加现金金额
                    BigDecimal cashAmount = record.getCashAmount();
                    if (cashAmount != null) {
                        itemsMap.put("现金", itemsMap.get("现金") + cashAmount.doubleValue());
                    }
                } else {
                    // 码表奖励：累加数量
                    String codeValue = record.getCodeValue();
                    if (codeValue != null) {
                        BigDecimal quantity = record.getQuantity();
                        if (quantity != null) {
                            itemsMap.put(codeValue, itemsMap.get(codeValue) + quantity.doubleValue());
                        }
                    }
                }
            }
            
            // 转换为前端需要的格式
            List<Map<String, Object>> teamsSummary = teamItemsMap.entrySet().stream()
                    .map(entry -> {
                        Map<String, Object> teamSummary = new HashMap<>();
                        teamSummary.put("teamName", entry.getKey());
                        
                        Map<String, Double> items = entry.getValue();
                        teamSummary.put("花瓣", Math.round(items.get("花瓣") * 1000.0) / 1000.0); // 保留3位小数
                        teamSummary.put("花", Math.round(items.get("花") * 1000.0) / 1000.0);
                        teamSummary.put("屎粒", Math.round(items.get("屎粒") * 1000.0) / 1000.0);
                        teamSummary.put("屎", Math.round(items.get("屎") * 1000.0) / 1000.0);
                        teamSummary.put("现金", Math.round(items.get("现金") * 100.0) / 100.0); // 现金保留2位小数
                        
                        return teamSummary;
                    })
                    .sorted((a, b) -> ((String) a.get("teamName")).compareTo((String) b.get("teamName"))) // 按队伍名称排序
                    .collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("seasonName", season.getName());
            response.put("teamsSummary", teamsSummary);
            response.put("totalTeams", teamsSummary.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("获取队伍物品统计失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "获取队伍物品统计失败: " + e.getMessage()));
        }
    }
    
    /**
     * 根据赛季ID查询所有出现过的队伍
     */
    @GetMapping("/teams/{seasonId}")
    public ResponseEntity<List<String>> getTeamsBySeason(@PathVariable Long seasonId) {
        try {
            // 查询该赛季下所有考勤记录
            List<AttendanceSession> sessions = attendanceSessionRepository.findBySeasonId(seasonId);
            
            // 提取所有出现过的队伍名称
            Set<String> teamNames = new HashSet<>();
            for (AttendanceSession session : sessions) {
                // 从成员数据中提取队伍名称
                if (session.getMemberData() != null && !session.getMemberData().isEmpty()) {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> memberData = (List<Map<String, Object>>) mapper.readValue(session.getMemberData(), List.class);
                        for (Map<String, Object> member : memberData) {
                            String groupName = (String) member.get("分组");
                            if (groupName != null && !groupName.trim().isEmpty()) {
                                teamNames.add(groupName.trim());
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("解析成员数据失败: " + e.getMessage());
                    }
                }
            }
            
            // 转换为列表并排序
            List<String> teams = new ArrayList<>(teamNames);
            teams.sort(String::compareTo);
            
            return ResponseEntity.ok(teams);
        } catch (Exception e) {
            System.err.println("查询队伍列表失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(new ArrayList<>());
        }
    }
    
    /**
     * 获取或创建手动添加专用的虚拟AttendanceSession
     */
    private AttendanceSession getOrCreateManualSession(Season season) {
        // 查找是否已存在该赛季的手动添加虚拟会话
        String manualSessionName = "手动添加-" + season.getName();
        List<AttendanceSession> existingSessions = attendanceSessionRepository.findAll().stream()
                .filter(session -> manualSessionName.equals(session.getName()) && 
                                 session.getSeason() != null && 
                                 session.getSeason().getId().equals(season.getId()))
                .collect(Collectors.toList());
        
        if (!existingSessions.isEmpty()) {
            return existingSessions.get(0);
        }
        
        // 创建新的虚拟会话
        AttendanceSession manualSession = new AttendanceSession();
        manualSession.setName(manualSessionName);
        manualSession.setBattleResult(BattleResult.VICTORY); // 默认为胜利
        manualSession.setStatus(SessionStatus.SETTLED); // 标记为已结算状态
        manualSession.setSeason(season);
        manualSession.setAttendanceType("手动添加");
        manualSession.setMemberData("[]"); // 空的成员数据
        manualSession.setGroupData("[]"); // 空的组数据
        manualSession.setThreshold(0); // 默认阈值
        
        return attendanceSessionRepository.save(manualSession);
    }
    
    /**
     * 手动添加结算记录
     */
    @PostMapping("/settlement/manual")
    public ResponseEntity<Map<String, Object>> addManualSettlement(@RequestBody com.tripmaster.backend.attendance.ManualSettlementRequest request) {
        try {
            // 验证请求参数
            if (request.getTeamName() == null || request.getTeamName().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "团队名称不能为空"));
            }
            if (request.getRewardType() == null || request.getRewardType().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "奖惩类型不能为空"));
            }
            if (request.getSeasonId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "赛季ID不能为空"));
            }
            
            // 验证赛季是否存在
            Season season = seasonRepository.findById(request.getSeasonId())
                    .orElseThrow(() -> new RuntimeException("未找到指定的赛季: " + request.getSeasonId()));
            
            // 创建或获取手动添加专用的虚拟AttendanceSession
            AttendanceSession manualSession = getOrCreateManualSession(season);
            
            // 获取数量，默认为1
            int quantity = request.getQuantity() != null ? request.getQuantity().intValue() : 1;
            String batchId = "MANUAL_" + System.currentTimeMillis(); // 统一的批次ID
            
            // 创建多条结算记录，每个物品一条记录
            List<SettlementRecord> savedRecords = new ArrayList<>();
            for (int i = 0; i < quantity; i++) {
                SettlementRecord record = new SettlementRecord();
                record.setTeamName(request.getTeamName().trim());
                record.setQuantity(BigDecimal.ONE); // 每条记录数量固定为1
                record.setCodeValue(request.getCodeValue());
                record.setCashAmount(request.getCashAmount());
                record.setAttendanceSession(manualSession); // 关联到虚拟会话
                record.setSettlementBatchId(batchId); // 使用统一的批次ID
                record.setCreatedAt(LocalDateTime.now());
                
                // 设置奖励模式
                if (request.getCashAmount() != null) {
                    record.setRewardMode("CASH");
                } else {
                    record.setRewardMode("CODE_TABLE");
                }
                
                // 保存记录
                SettlementRecord savedRecord = settlementRecordRepository.save(record);
                savedRecords.add(savedRecord);
            }
            
            // 使用第一条记录作为代表进行后续处理
            SettlementRecord firstRecord = savedRecords.get(0);
            
            // 创建结算日志
            StringBuilder settlementContent = new StringBuilder();
            settlementContent.append(request.getTeamName().trim())
                    .append(": ");
            
            if ("CASH".equals(firstRecord.getRewardMode())) {
                // 现金奖励显示具体金额
                BigDecimal cashAmount = firstRecord.getCashAmount();
                if (cashAmount != null) {
                    settlementContent.append("现金")
                            .append(cashAmount.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "")
                            .append(cashAmount)
                            .append("元");
                } else {
                    settlementContent.append("现金 x").append(quantity);
                }
            } else {
                // 码表奖励显示类型和数量，使用 codeValue 而不是 rewardType
                settlementContent.append(firstRecord.getCodeValue())
                        .append(" x")
                        .append(quantity);
            }
            
            SettlementLog log = new SettlementLog();
            log.setAttendanceRecordName(manualSession.getName());
            log.setSettlementSeason(season.getName());
            log.setSettlementContent(settlementContent.toString());
            log.setAttendanceSession(manualSession);
            
            settlementLogRepository.save(log);
            System.out.println("保存手动添加结算日志成功");
            
            // 触发合成逻辑
            try {
                synthesisService.checkAndPerformSynthesis(
                    season.getId(), 
                    firstRecord.getSettlementBatchId(), 
                    firstRecord.getAttendanceSession().getId()
                );
            } catch (Exception e) {
                System.err.println("触发合成逻辑失败: " + e.getMessage());
                e.printStackTrace();
                // 合成失败不影响主流程，只记录错误
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("recordIds", savedRecords.stream().map(SettlementRecord::getId).collect(Collectors.toList()));
            response.put("recordCount", savedRecords.size());
            response.put("message", String.format("手动添加结算记录成功，共创建 %d 条记录", savedRecords.size()));
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("手动添加结算记录失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "手动添加结算记录失败: " + e.getMessage()));
        }
    }
    
    /**
     * 撤销手动添加的结算记录
     */
    @DeleteMapping("/settlement/manual/{recordId}")
    public ResponseEntity<Map<String, Object>> revokeManualSettlement(@PathVariable Long recordId) {
        try {
            // 1. 查找手动记录
            SettlementRecord record = settlementRecordRepository.findById(recordId)
                    .orElseThrow(() -> new RuntimeException("记录不存在: " + recordId));
            
            // 2. 验证只能撤销直接的手动记录
            if (!record.getSettlementBatchId().startsWith("MANUAL_")) {
                return ResponseEntity.badRequest().body(Map.of("error", "只能撤销直接的手动添加记录"));
            }
            
            String targetBatchId = record.getSettlementBatchId();
            
            // 3. 验证记录状态（只有已删除的记录不能撤销）
            if ("DELETED".equals(record.getRecordStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "该记录已被删除"));
            }
            
            // 4. 分析撤销影响
            CascadeRevocationService.RevocationImpactAnalysis analysis = 
                cascadeRevocationService.analyzeRevocationImpact(targetBatchId);
            
            System.out.println("撤销手动记录: " + recordId + ", 目标批次: " + targetBatchId);
            System.out.println("影响分析 - 直接记录: " + analysis.getDirectRecords().size() + 
                             ", 受影响合成链: " + analysis.getAffectedChains().size());
            
            // 检查支付状态：不能撤销已支付的记录
            List<Long> allAffectedRecordIds = new ArrayList<>();
            allAffectedRecordIds.addAll(analysis.getDirectRecords().stream()
                    .map(SettlementRecord::getId)
                    .collect(Collectors.toList()));
            allAffectedRecordIds.addAll(analysis.getSynthesisRecordsToDelete().stream()
                    .map(SettlementRecord::getId)
                    .collect(Collectors.toList()));
            
            if (paymentService.anyPaid(allAffectedRecordIds)) {
                return ResponseEntity.badRequest().body(Map.of("error", "该记录或相关合成记录已支付，无法撤销。请先撤销支付状态。"));
            }
            
            // 5. 构建撤销日志内容，体现具体的撤销内容
            StringBuilder revokeContent = new StringBuilder();
            revokeContent.append("撤销手动添加，删除了以下结算记录：");
            
            // 记录直接删除的记录
            for (SettlementRecord directRecord : analysis.getDirectRecords()) {
                revokeContent.append(directRecord.getTeamName())
                        .append(": ");
                if ("CASH".equals(directRecord.getRewardMode())) {
                    revokeContent.append("现金").append(directRecord.getCashAmount()).append("元");
                } else {
                    revokeContent.append(directRecord.getCodeValue())
                            .append(" x").append(directRecord.getQuantity());
                }
                revokeContent.append("; ");
            }
            
            // 如果有级联影响，记录合成撤销信息
            if (analysis.isHasImpact()) {
                revokeContent.append(" 级联撤销合成：删除了")
                        .append(analysis.getSynthesisRecordsToDelete().size())
                        .append("条合成记录，恢复了")
                        .append(analysis.getRecordsToRestore().size())
                        .append("条原始记录");
            }
            
            // 执行级联撤销
            cascadeRevocationService.executeRevocationWithCascade(targetBatchId);
            
            // 记录撤销日志
            AttendanceSession manualSession = record.getAttendanceSession();
            if (manualSession != null) {
                SettlementLog log = new SettlementLog();
                log.setAttendanceRecordName(manualSession.getName());
                log.setSettlementSeason(manualSession.getSeason() != null ? manualSession.getSeason().getName() : "未知赛季");
                log.setSettlementContent(revokeContent.toString());
                log.setAttendanceSession(manualSession);
                
                settlementLogRepository.save(log);
                System.out.println("保存撤销手动添加日志成功");
            }
            
            // 6. 撤销后重新触发合成检查
            Long seasonId = record.getAttendanceSession() != null && record.getAttendanceSession().getSeason() != null 
                ? record.getAttendanceSession().getSeason().getId() : null;
            
            if (seasonId != null) {
                System.out.println("撤销手动记录后重新触发合成检查，赛季ID: " + seasonId);
                try {
                    synthesisService.checkAndPerformSynthesis(seasonId, "REVOKE_MANUAL_" + targetBatchId, record.getAttendanceSession().getId());
                    System.out.println("撤销手动记录后合成检查完成");
                } catch (Exception e) {
                    System.err.println("撤销手动记录后合成检查失败: " + e.getMessage());
                    // 合成检查失败不影响撤销操作的成功
                }
            }
            
            // 7. 构建响应数据
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "手动奖惩撤销成功");
            response.put("affectedRecords", analysis.getDirectRecords().size() + 
                                          analysis.getSynthesisRecordsToDelete().size());
            response.put("restoredRecords", analysis.getRecordsToRestore().size());
            
            // 7. 添加详细影响信息
            if (analysis.isHasImpact()) {
                response.put("hasImpact", true);
                response.put("impactDetails", String.format(
                    "撤销了 %d 条直接记录，%d 条合成记录，恢复了 %d 条原始记录",
                    analysis.getDirectRecords().size(),
                    analysis.getSynthesisRecordsToDelete().size(),
                    analysis.getRecordsToRestore().size()
                ));
            } else {
                response.put("hasImpact", false);
                response.put("impactDetails", "仅撤销了当前记录，无级联影响");
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("撤销手动结算记录失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "撤销失败: " + e.getMessage()));
        }
    }
    
    // ==================== 加成配置管理接口 ====================
    
    /**
     * 获取团队人数加成配置
     */
    @GetMapping("/bonus-config")
    public ResponseEntity<BonusConfigData> getBonusConfig() {
        try {
            BonusConfigData config = bonusConfigService.getTeamSizeBonusConfig();
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            System.err.println("获取加成配置失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 更新团队人数加成配置
     */
    @PutMapping("/bonus-config")
    public ResponseEntity<Map<String, Object>> updateBonusConfig(@RequestBody BonusConfigData config) {
        try {
            bonusConfigService.updateTeamSizeBonusConfig(config);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "加成配置更新成功");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("更新加成配置失败: " + e.getMessage());
            e.printStackTrace();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    /**
     * 验证加成配置（不保存，仅验证）
     */
    @PostMapping("/bonus-config/validate")
    public ResponseEntity<Map<String, Object>> validateBonusConfig(@RequestBody BonusConfigData config) {
        try {
            // 创建临时服务实例进行验证
            BonusConfigService tempService = new BonusConfigService();
            
            // 验证配置数据（使用反射调用私有方法，或者将验证方法设为public）
            if (config.hasOverlappingRules()) {
                throw new Exception(config.getOverlapInfo());
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("valid", true);
            response.put("message", "配置验证通过");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("valid", false);
            response.put("error", e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // ==================== 团队现金统计接口 ====================
    
    /**
     * 获取团队现金统计
     */
    @GetMapping("/statistics/team-cash-summary")
    public ResponseEntity<TeamCashSummary> getTeamCashSummary(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam String attendanceType,
            @RequestParam String teamName) {
        try {
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询指定时间段内的已结算考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                    startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                attendanceType, startDateTime, endDateTime);
            }
            
            TeamCashSummary summary = new TeamCashSummary();
            summary.setTeamName(teamName);
            summary.setTimeRange(startDate + " 至 " + endDate);
            summary.setAttendanceType(attendanceType);
            
            List<CashRecord> records = new ArrayList<>();
            double totalRewards = 0.0;
            double totalPenalties = 0.0;
            
            // 获取所有相关的结算记录
            List<Long> sessionIds = sessions.stream()
                .map(AttendanceSession::getId)
                .collect(Collectors.toList());
            
            // 查询考勤相关的结算记录
            List<SettlementRecord> allSettlementRecords = new ArrayList<>();
            if (!sessionIds.isEmpty()) {
                List<SettlementRecord> attendanceRecords = settlementRecordRepository.findByAttendanceSessionIdInAndTeamName(
                    sessionIds, teamName);
                allSettlementRecords.addAll(attendanceRecords);
                
            }
            
            // 查询手动添加的结算记录（按创建时间筛选）
            List<SettlementRecord> manualRecords = settlementRecordRepository.findByTeamNameAndSettlementBatchIdStartingWithAndCreatedAtBetween(
                teamName, "MANUAL_%", startDateTime, endDateTime);
            allSettlementRecords.addAll(manualRecords);
            
            if (!allSettlementRecords.isEmpty()) {
                // 筛选有现金金额的记录（只包含直接的现金记录）
                List<SettlementRecord> settlementRecords = allSettlementRecords.stream()
                    .filter(record -> {
                        // 只筛选有直接现金金额的记录
                        boolean hasCashAmount = record.getCashAmount() != null && record.getCashAmount().compareTo(BigDecimal.ZERO) != 0;
                        
                        return hasCashAmount;
                    })
                    .collect(Collectors.toList());
                
                for (SettlementRecord record : settlementRecords) {
                    // 查找对应的考勤记录
                    AttendanceSession session = sessions.stream()
                        .filter(s -> s.getId().equals(record.getAttendanceSession().getId()))
                        .findFirst()
                        .orElse(null);
                    
                    // 处理考勤记录和手动记录
                    String sessionName;
                    LocalDateTime sessionTime;
                    String battleResult;
                    boolean isManual = false;
                    
                    if (session != null) {
                        // 考勤记录
                        sessionName = session.getName();
                        sessionTime = session.getStartTime();
                        battleResult = session.getBattleResult() != null ? session.getBattleResult().toString() : "UNKNOWN";
                    } else if (record.getSettlementBatchId().startsWith("MANUAL_")) {
                        // 手动记录
                        sessionName = "手动添加";
                        sessionTime = record.getCreatedAt();
                        battleResult = "MANUAL";
                        isManual = true;
                    } else {
                        // 跳过其他记录
                        continue;
                    }
                    
                    // 计算现金金额（只处理直接的现金记录）
                    double cashAmount = 0.0;
                    if (record.getCashAmount() != null) {
                        cashAmount = record.getCashAmount().doubleValue();
                    }
                    
                    // 只处理有现金价值的记录
                    if (Math.abs(cashAmount) > 0.01) {
                        CashRecord cashRecord = new CashRecord(
                            sessionName,
                            sessionTime,
                            record.getCodeValue() != null ? record.getCodeValue() : "现金",
                            cashAmount,
                            record.getCodeValue() != null ? record.getCodeValue() : "现金奖惩",
                            battleResult,
                            isManual
                        );
                        records.add(cashRecord);
                        
                        // 累计金额
                        if (cashAmount > 0) {
                            totalRewards += cashAmount;
                        } else {
                            totalPenalties += cashAmount;
                        }
                        
                    }
                }
            }
            
            // 按时间排序记录
            records.sort(Comparator.comparing(CashRecord::getSessionTime));
            
            summary.setTotalRewards(totalRewards);
            summary.setTotalPenalties(totalPenalties);
            summary.calculateNetCash();
            summary.setRecords(records);
            
            
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            System.err.println("获取团队现金统计失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }
    
    // ==================== 个人统计接口 ====================
    
    /**
     * 获取个人统计
     */
    @GetMapping("/statistics/personal")
    public ResponseEntity<PersonalStatsSummary> getPersonalStats(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) String attendanceType,
            @RequestParam String memberName) {
        try {
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询指定时间段内的已结算考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                        startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                attendanceType, startDateTime, endDateTime);
            }
            
            PersonalStatsSummary summary = new PersonalStatsSummary();
            summary.setMemberName(memberName);
            summary.setTimeRange(startDate + " 至 " + endDate);
            summary.setAttendanceType(attendanceType != null && !attendanceType.trim().isEmpty() && !"全部".equals(attendanceType) 
                    ? attendanceType : "全部");
            
            List<PersonalAttendanceRecord> records = new ArrayList<>();
            int totalSessions = 0;
            int attendedSessions = 0;
            int absentSessions = 0;
            
            for (AttendanceSession session : sessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    // 查找指定成员
                    MemberData member = memberDataList.stream()
                        .filter(m -> memberName.equals(m.get成员()))
                        .findFirst()
                        .orElse(null);
                    
                    if (member != null) {
                        // 总考勤次数：该人员相关的考勤记录数（不管是否参加）
                        totalSessions++;
                        
                        // 参加考勤：该人员实际参加的考勤次数
                        boolean isAttended = member.is参加考勤();
                        if (isAttended) {
                            attendedSessions++;
                        }
                        
                        // 根据考勤类型判断是否达标
                        boolean isQualified = false;
                        if (isAttended) {
                            long meritDiff = member.get后值() - member.get前值();
                            long assistDiff = member.get助攻后值() - member.get助攻前值();
                            
                            if ("区间助攻考勤".equals(attendanceType)) {
                                isQualified = assistDiff >= session.getThreshold();
                                System.out.println(String.format("助攻考勤达标判断 - 助攻差值: %d, 阈值: %d, 达标: %s", 
                                    assistDiff, session.getThreshold(), isQualified));
                            } else {
                                isQualified = meritDiff >= session.getThreshold();
                                System.out.println(String.format("战功考勤达标判断 - 战功差值: %d, 阈值: %d, 达标: %s", 
                                    meritDiff, session.getThreshold(), isQualified));
                            }
                        }
                        
                        PersonalAttendanceRecord record = new PersonalAttendanceRecord(
                            session.getName(),
                            session.getStartTime(),
                            session.getAttendanceType(),
                            isAttended, // 是否参加考勤
                            isQualified, // 是否达标
                            member.get前值(),
                            member.get后值(),
                            member.get助攻前值(),
                            member.get助攻后值(),
                            session.getThreshold(),
                            member.get分组(),
                            session.getBattleResult() != null ? session.getBattleResult().toString() : "UNKNOWN"
                        );
                        
                        // 调试信息
                        System.out.println(String.format("个人统计调试 - 人员: %s, 考勤: %s, 参加: %s, 达标: %s, 战功差值: %d, 助攻差值: %d, 阈值: %d", 
                            memberName, session.getName(), isAttended, isQualified, 
                            member.get后值() - member.get前值(), 
                            member.get助攻后值() - member.get助攻前值(), 
                            session.getThreshold()));
                        records.add(record);
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            // 按时间排序记录
            records.sort(Comparator.comparing(PersonalAttendanceRecord::getSessionTime));
            
            summary.setTotalSessions(totalSessions);
            summary.setAttendedSessions(attendedSessions);
            summary.setAbsentSessions(absentSessions);
            summary.setRecords(records);
            summary.calculateAttendanceRate(); // 在设置records之后计算出勤率
            
            // ========== 计算排名 ==========
            // 第一步：获取排除名单
            List<String> exclusionList = rankingExclusionRepository.findAll().stream()
                    .map(RankingExclusion::getMemberName)
                    .collect(Collectors.toList());
            
            // 第二步：统计时间范围内所有人员的出勤数据（排除排除名单中的人员）
            Map<String, PersonalRankingData> allMemberStats = new HashMap<>();
            ObjectMapper rankingMapper = new ObjectMapper();
            
            for (AttendanceSession session : sessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = rankingMapper.readValue(session.getMemberData(),
                            rankingMapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    for (MemberData member : memberDataList) {
                        String name = member.get成员();
                        if (name == null || name.trim().isEmpty()) {
                            continue;
                        }
                        
                        // 排除排除名单中的人员
                        if (exclusionList.contains(name)) {
                            continue;
                        }
                        
                        PersonalRankingData stats = allMemberStats.computeIfAbsent(name, 
                                k -> new PersonalRankingData(name));
                        
                        // 如果参加了考勤
                        if (member.is参加考勤()) {
                            stats.setAttendedSessions(stats.getAttendedSessions() + 1);
                            
                            // 判断是否达标（实际出勤）
                            boolean isQualified = false;
                            if ("区间助攻考勤".equals(session.getAttendanceType())) {
                                isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                            } else {
                                isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                            }
                            
                            if (isQualified) {
                                stats.setQualifiedSessions(stats.getQualifiedSessions() + 1);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败（排名计算）: " + e.getMessage());
                    continue;
                }
            }
            
            // 第三步：计算出勤率
            List<PersonalRankingData> rankingList = new ArrayList<>(allMemberStats.values());
            for (PersonalRankingData data : rankingList) {
                if (data.getAttendedSessions() > 0) {
                    double rate = (double) data.getQualifiedSessions() / data.getAttendedSessions() * 100.0;
                    data.setAttendanceRate(Math.round(rate * 100.0) / 100.0);
                } else {
                    data.setAttendanceRate(0.0);
                }
            }
            
            // 第四步：排序
            rankingList.sort(Comparator.comparing(PersonalRankingData::getAttendanceRate).reversed()
                    .thenComparing(PersonalRankingData::getQualifiedSessions, Comparator.reverseOrder())
                    .thenComparing(PersonalRankingData::getMemberName));
            
            // 第五步：计算排名（有并列规则）
            int currentRank = 1;
            for (int i = 0; i < rankingList.size(); i++) {
                PersonalRankingData current = rankingList.get(i);
                
                if (i > 0) {
                    PersonalRankingData previous = rankingList.get(i - 1);
                    // 如果出勤率和出勤次数都相同，则排名相同
                    if (Math.abs(current.getAttendanceRate() - previous.getAttendanceRate()) < 0.01 &&
                        current.getQualifiedSessions() == previous.getQualifiedSessions()) {
                        current.setRank(previous.getRank());
                    } else {
                        currentRank = i + 1;
                        current.setRank(currentRank);
                    }
                } else {
                    current.setRank(1);
                    currentRank = 1;
                }
            }
            
            // 第六步：找到当前人员的排名
            PersonalRankingData memberRanking = rankingList.stream()
                    .filter(data -> data.getMemberName().equals(memberName))
                    .findFirst()
                    .orElse(null);
            
            if (memberRanking != null) {
                summary.setRank(memberRanking.getRank());
                summary.setTotalRank(rankingList.size());
            } else {
                // 如果当前人员不在排名中（可能是排除名单中的人员，或者没有参加任何考勤）
                summary.setRank(null);
                summary.setTotalRank(rankingList.size());
            }
            // ========== 排名计算结束 ==========
            
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            System.err.println("获取个人统计失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 搜索人员列表
     */
    @GetMapping("/statistics/personal/search")
    public ResponseEntity<List<String>> searchMembers(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) String attendanceType,
            @RequestParam(required = false) String keyword) {
        try {
            LocalDateTime startDateTime = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime endDateTime = LocalDate.parse(endDate).atTime(23, 59, 59);
            
            // 查询指定时间段内的已结算考勤记录
            List<AttendanceSession> sessions;
            if (attendanceType == null || attendanceType.trim().isEmpty() || "全部".equals(attendanceType)) {
                // 查询所有类型（排除手动添加）
                sessions = attendanceSessionRepository.findByTimeRangeAndSettledExcludingManual(
                        startDateTime, endDateTime);
            } else {
                // 查询指定类型
                sessions = attendanceSessionRepository.findByAttendanceTypeAndTimeRangeAndSettled(
                attendanceType, startDateTime, endDateTime);
            }
            
            Set<String> memberNames = new HashSet<>();
            
            for (AttendanceSession session : sessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                        mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    for (MemberData member : memberDataList) {
                        String memberName = member.get成员();
                        if (memberName != null && !memberName.trim().isEmpty()) {
                            // 如果有关键词，进行模糊搜索
                            if (keyword == null || keyword.trim().isEmpty() || 
                                memberName.toLowerCase().contains(keyword.toLowerCase())) {
                                memberNames.add(memberName);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            List<String> result = new ArrayList<>(memberNames);
            result.sort(String::compareTo);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("搜索人员失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 获取个人排名（按出勤率）
     * 出勤率 = 实际出勤次数（达标次数）/ 参与考勤次数（参加考勤次数）
     */
    @GetMapping("/ranking/personal")
    public ResponseEntity<Map<String, Object>> getPersonalRanking(
            @RequestParam Long seasonId,
            @RequestParam(required = false) List<String> attendanceTypes, // 考勤类别，支持多选
            @RequestParam(required = false, defaultValue = "") String memberName, // 姓名模糊查询
            @RequestParam(required = false, defaultValue = "desc") String sortOrder, // 排序：asc/desc
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        try {
            // 获取赛季信息
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 第一步：先获取排除名单（在统计之前就获取，确保排除名单中的人员不参与排名计算）
            List<String> exclusionList = rankingExclusionRepository.findAll().stream()
                    .map(RankingExclusion::getMemberName)
                    .collect(Collectors.toList());
            
            // 查询赛季内所有已结算的考勤记录（排除手动添加类型）
            List<AttendanceSession> allSessions = attendanceSessionRepository.findBySeasonIdAndSettledExcludingManual(seasonId);
            
            // 如果指定了考勤类型，进行过滤
            if (attendanceTypes != null && !attendanceTypes.isEmpty()) {
                allSessions = allSessions.stream()
                        .filter(session -> attendanceTypes.contains(session.getAttendanceType()))
                        .collect(Collectors.toList());
            }
            
            // 统计每个人的出勤数据（排除排除名单中的人员）
            Map<String, PersonalRankingData> memberStats = new HashMap<>();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(),
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    for (MemberData member : memberDataList) {
                        String name = member.get成员();
                        if (name == null || name.trim().isEmpty()) {
                            continue;
                        }
                        
                        // 关键修改：在统计时就排除排除名单中的人员，不统计他们的数据
                        if (exclusionList.contains(name)) {
                            continue; // 跳过排除名单中的人员，不参与排名计算
                        }
                        
                        PersonalRankingData stats = memberStats.computeIfAbsent(name, 
                                k -> new PersonalRankingData(name));
                        
                        // 如果参加了考勤
                        if (member.is参加考勤()) {
                            // 参与考勤次数+1
                            stats.setAttendedSessions(stats.getAttendedSessions() + 1);
                            
                            // 判断是否达标（实际出勤）
                            boolean isQualified = false;
                            if ("区间助攻考勤".equals(session.getAttendanceType())) {
                                isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                            } else {
                                isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                            }
                            
                            if (isQualified) {
                                // 实际出勤次数+1
                                stats.setQualifiedSessions(stats.getQualifiedSessions() + 1);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            // 计算出勤率：实际出勤次数 / 参与考勤次数
            List<PersonalRankingData> rankingList = new ArrayList<>(memberStats.values());
            for (PersonalRankingData data : rankingList) {
                if (data.getAttendedSessions() > 0) {
                    // 出勤率 = 实际出勤次数（qualifiedSessions）/ 参与考勤次数（attendedSessions）
                    double rate = (double) data.getQualifiedSessions() / data.getAttendedSessions() * 100.0;
                    data.setAttendanceRate(Math.round(rate * 100.0) / 100.0);
                } else {
                    data.setAttendanceRate(0.0);
                }
            }
            
            // 第二步：排序（此时已经排除了排除名单中的人员）
            rankingList.sort(Comparator.comparing(PersonalRankingData::getAttendanceRate).reversed()
                    .thenComparing(PersonalRankingData::getQualifiedSessions, Comparator.reverseOrder())
                    .thenComparing(PersonalRankingData::getMemberName));
            
            // 第三步：计算排名（此时已经排除了排除名单中的人员，所以排名是正确的）
            int currentRank = 1;
            for (int i = 0; i < rankingList.size(); i++) {
                PersonalRankingData current = rankingList.get(i);
                
                if (i > 0) {
                    PersonalRankingData previous = rankingList.get(i - 1);
                    // 如果出勤率和出勤次数都相同，则排名相同
                    if (Math.abs(current.getAttendanceRate() - previous.getAttendanceRate()) < 0.01 &&
                        current.getQualifiedSessions() == previous.getQualifiedSessions()) {
                        current.setRank(previous.getRank());
                    } else {
                        currentRank = i + 1;
                        current.setRank(currentRank);
                    }
                } else {
                    current.setRank(1);
                    currentRank = 1;
                }
            }
            
            // 第四步：应用姓名模糊查询过滤（排名已计算，保持不变）
            if (memberName != null && !memberName.trim().isEmpty()) {
                rankingList = rankingList.stream()
                        .filter(data -> data.getMemberName().contains(memberName.trim()))
                        .collect(Collectors.toList());
            }
            
            // 第五步：如果用户选择了asc排序，重新排序（但排名保持不变）
            if ("asc".equalsIgnoreCase(sortOrder)) {
                rankingList.sort(Comparator.comparing(PersonalRankingData::getAttendanceRate)
                        .thenComparing(PersonalRankingData::getQualifiedSessions, Comparator.reverseOrder())
                        .thenComparing(PersonalRankingData::getMemberName));
            }
            
            // 第六步：分页
            int total = rankingList.size();
            int start = page * size;
            int end = Math.min(start + size, total);
            List<PersonalRankingData> pagedList = start < total ? rankingList.subList(start, end) : new ArrayList<>();
            
            Map<String, Object> result = new HashMap<>();
            result.put("content", pagedList);
            result.put("totalElements", total);
            result.put("totalPages", (total + size - 1) / size);
            result.put("currentPage", page);
            result.put("size", size);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("获取个人排名失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 获取团队排名（按平均出勤率）
     * 平均出勤率 = 本赛季所有考勤的团队出勤率（加成后）的平均值
     */
    @GetMapping("/ranking/team")
    public ResponseEntity<Map<String, Object>> getTeamRanking(
            @RequestParam Long seasonId,
            @RequestParam(required = false) List<String> attendanceTypes, // 考勤类别，支持多选
            @RequestParam(required = false, defaultValue = "") String teamName, // 团队名模糊查询
            @RequestParam(required = false, defaultValue = "desc") String sortOrder, // 排序：asc/desc
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        try {
            // 获取赛季信息
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 查询赛季内所有已结算的考勤记录（排除手动添加类型）
            List<AttendanceSession> allSessions = attendanceSessionRepository.findBySeasonIdAndSettledExcludingManual(seasonId);
            
            // 如果指定了考勤类型，进行过滤
            if (attendanceTypes != null && !attendanceTypes.isEmpty()) {
                allSessions = allSessions.stream()
                        .filter(session -> attendanceTypes.contains(session.getAttendanceType()))
                        .collect(Collectors.toList());
            }
            
            // 统计每个团队的平均出勤率
            // Map<团队名, List<每次考勤的加成后出勤率>>
            Map<String, List<Double>> teamRatesMap = new HashMap<>();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(),
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    // 按团队分组统计
                    Map<String, List<MemberData>> teamMembersMap = memberDataList.stream()
                            .filter(member -> member.get分组() != null && !member.get分组().trim().isEmpty())
                            .collect(Collectors.groupingBy(MemberData::get分组));
                    
                    // 计算每个团队在这次考勤中的出勤率（加成后）
                    for (Map.Entry<String, List<MemberData>> entry : teamMembersMap.entrySet()) {
                        String team = entry.getKey();
                        List<MemberData> teamMembers = entry.getValue();
                        
                        // 计算参加考勤的人数
                        long attendingCount = teamMembers.stream()
                                .mapToLong(member -> member.is参加考勤() ? 1 : 0)
                                .sum();
                        
                        if (attendingCount == 0) {
                            continue; // 该团队这次没有参加考勤
                        }
                        
                        // 计算达标人数
                        long qualifiedCount = teamMembers.stream()
                                .mapToLong(member -> {
                                    if (!member.is参加考勤()) {
                                        return 0;
                                    }
                                    boolean isQualified;
                                    if ("区间助攻考勤".equals(session.getAttendanceType())) {
                                        isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                                    } else {
                                        isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                                    }
                                    return isQualified ? 1 : 0;
                                })
                                .sum();
                        
                        // 计算出勤率
                        double attendanceRate = (double) qualifiedCount / attendingCount * 100.0;
                        attendanceRate = Math.round(attendanceRate * 100.0) / 100.0;
                        
                        // 应用加成
                        int memberCount = (int) attendingCount;
                        TeamSizeBonusRule applicableRule = bonusConfigService.getApplicableBonusRule(memberCount);
                        double bonusRate = attendanceRate;
                        
                        if (applicableRule != null) {
                            bonusRate = attendanceRate + applicableRule.getAttendanceRateBonus();
                            if (bonusRate > 100.0) {
                                bonusRate = 100.0;
                            }
                            bonusRate = Math.round(bonusRate * 100.0) / 100.0;
                        }
                        
                        // 添加到团队出勤率列表
                        teamRatesMap.computeIfAbsent(team, k -> new ArrayList<>()).add(bonusRate);
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            // 计算每个团队的平均出勤率
            List<TeamRankingData> rankingList = new ArrayList<>();
            for (Map.Entry<String, List<Double>> entry : teamRatesMap.entrySet()) {
                String team = entry.getKey();
                List<Double> rates = entry.getValue();
                
                if (rates.isEmpty()) {
                    continue;
                }
                
                TeamRankingData teamData = new TeamRankingData(team);
                teamData.setTotalSessions(rates.size());
                
                // 计算平均值
                double sum = rates.stream().mapToDouble(Double::doubleValue).sum();
                double average = sum / rates.size();
                teamData.setAverageAttendanceRate(Math.round(average * 100.0) / 100.0);
                
                rankingList.add(teamData);
            }
            
            // 第一步：先按默认排序（desc，从高到低）排序完整列表
            rankingList.sort(Comparator.comparing(TeamRankingData::getAverageAttendanceRate).reversed()
                    .thenComparing(TeamRankingData::getTeamName));
            
            // 第二步：在完整列表上计算排名
            int currentRank = 1;
            for (int i = 0; i < rankingList.size(); i++) {
                TeamRankingData current = rankingList.get(i);
                
                if (i > 0) {
                    TeamRankingData previous = rankingList.get(i - 1);
                    // 如果平均出勤率相同，则排名相同
                    if (Math.abs(current.getAverageAttendanceRate() - previous.getAverageAttendanceRate()) < 0.01) {
                        current.setRank(previous.getRank());
                    } else {
                        currentRank = i + 1;
                        current.setRank(currentRank);
            }
                } else {
                    current.setRank(1);
                    currentRank = 1;
                }
            }
            
            // 第三步：应用团队名模糊查询过滤（排名已计算，保持不变）
            if (teamName != null && !teamName.trim().isEmpty()) {
                rankingList = rankingList.stream()
                        .filter(data -> data.getTeamName().contains(teamName.trim()))
                        .collect(Collectors.toList());
            }
            
            // 第四步：如果用户选择了asc排序，重新排序（但排名保持不变）
            if ("asc".equalsIgnoreCase(sortOrder)) {
                rankingList.sort(Comparator.comparing(TeamRankingData::getAverageAttendanceRate)
                        .thenComparing(TeamRankingData::getTeamName));
            }
            
            // 第五步：分页
            int total = rankingList.size();
            int start = page * size;
            int end = Math.min(start + size, total);
            List<TeamRankingData> pagedList = start < total ? rankingList.subList(start, end) : new ArrayList<>();
            
            Map<String, Object> result = new HashMap<>();
            result.put("content", pagedList);
            result.put("totalElements", total);
            result.put("totalPages", (total + size - 1) / size);
            result.put("currentPage", page);
            result.put("size", size);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("获取团队排名失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== 支付管理接口 ====================
    
    @Autowired
    private PaymentService paymentService;
    
    /**
     * 查询金额记录列表（支持筛选和分页）
     */
    @GetMapping("/payments")
    public ResponseEntity<?> getPaymentRecords(
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) String teamName,
            @RequestParam(required = false, defaultValue = "ALL") String paymentStatus,  // ALL, PAID, UNPAID
            @RequestParam(required = false, defaultValue = "ALL") String recordType,     // ALL, SETTLEMENT, MANUAL, SYNTHESIS
            @RequestParam(required = false, defaultValue = "1") int pageNum,
            @RequestParam(required = false, defaultValue = "10") int pageSize) {
        try {
            Page<PaymentRecordDetail> result = paymentService.getPaymentRecordsWithDetails(
                    seasonId, teamName, paymentStatus, recordType, pageNum, pageSize);
            
            Map<String, Object> response = new HashMap<>();
            response.put("content", result.getContent());
            response.put("totalElements", result.getTotalElements());
            response.put("totalPages", result.getTotalPages());
            response.put("currentPage", pageNum);
            response.put("pageSize", pageSize);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("查询支付记录失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "查询失败: " + e.getMessage()));
        }
    }
    
    /**
     * 标记为已支付（单个或批量）
     */
    @PostMapping("/payments/mark-paid")
    public ResponseEntity<Map<String, Object>> markAsPaid(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Number> recordIdsNum = (List<Number>) request.get("recordIds");
            String operatorAccount = (String) request.get("operatorAccount");
            
            if (recordIdsNum == null || recordIdsNum.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "记录ID列表不能为空"));
            }
            
            if (operatorAccount == null || operatorAccount.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "操作人账号不能为空"));
            }
            
            // 转换为 Long 类型
            List<Long> convertedIds = recordIdsNum.stream()
                    .map(Number::longValue)
                    .collect(Collectors.toList());
            
            paymentService.markAsPaid(convertedIds, operatorAccount);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", String.format("成功标记 %d 条记录为已支付", convertedIds.size()));
            response.put("affectedCount", convertedIds.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("标记支付失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "操作失败: " + e.getMessage()));
        }
    }
    
    /**
     * 撤销支付（删除支付记录）
     */
    @PostMapping("/payments/revoke-paid")
    public ResponseEntity<Map<String, Object>> revokePaid(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Number> recordIdsNum = (List<Number>) request.get("recordIds");
            
            if (recordIdsNum == null || recordIdsNum.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "记录ID列表不能为空"));
            }
            
            // 转换为 Long 类型
            List<Long> convertedIds = recordIdsNum.stream()
                    .map(Number::longValue)
                    .collect(Collectors.toList());
            
            paymentService.revokePaid(convertedIds);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", String.format("成功撤销 %d 条记录的支付状态", convertedIds.size()));
            response.put("affectedCount", convertedIds.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("撤销支付失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", "操作失败: " + e.getMessage()));
        }
    }
    
    // ==================== 团徽管理接口 ====================
    
    /**
     * 获取所有出现过的团队名称（从所有赛季的考勤记录中提取）
     */
    @GetMapping("/teams/all")
    public ResponseEntity<List<String>> getAllTeamNames() {
        try {
            Set<String> teamNames = new HashSet<>();
            
            // 从所有考勤记录中提取团队名称
            List<AttendanceSession> allSessions = attendanceSessionRepository.findAll();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() != null && !session.getMemberData().isEmpty()) {
                    try {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> memberData = (List<Map<String, Object>>) mapper.readValue(session.getMemberData(), List.class);
                        for (Map<String, Object> member : memberData) {
                            String groupName = (String) member.get("分组");
                            if (groupName != null && !groupName.trim().isEmpty()) {
                                teamNames.add(groupName.trim());
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("解析成员数据失败: " + e.getMessage());
                    }
                }
            }
            
            // 转换为列表并排序
            List<String> teams = new ArrayList<>(teamNames);
            teams.sort(String::compareTo);
            
            return ResponseEntity.ok(teams);
        } catch (Exception e) {
            System.err.println("获取团队列表失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(new ArrayList<>());
        }
    }
    
    /**
     * 上传或更新团徽
     */
    @PostMapping(value = "/team-logos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadTeamLogo(
            @RequestParam("teamName") String teamName,
            @RequestParam("file") MultipartFile file) {
        try {
            // 验证文件类型 - 只支持JPG和PNG
            String contentType = file.getContentType();
            String[] allowedTypes = {"image/jpeg", "image/jpg", "image/png"};
            boolean isValidType = false;
            if (contentType != null) {
                for (String type : allowedTypes) {
                    if (type.equalsIgnoreCase(contentType)) {
                        isValidType = true;
                        break;
                    }
                }
            }
            if (!isValidType) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "只支持JPG和PNG格式的图片文件"
                ));
            }
            
            // 验证文件大小 - 最大10MB
            long maxSize = 10 * 1024 * 1024; // 10MB
            if (file.getSize() > maxSize) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "文件大小不能超过10MB"
                ));
            }
            
            // 创建上传目录（使用配置的路径）
            String uploadDir = teamLogosUploadDir;
            // 确保路径是绝对路径（与 WebConfig 保持一致）
            File dir = new File(uploadDir);
            if (!dir.isAbsolute()) {
                // 如果是相对路径，转换为绝对路径
                uploadDir = dir.getAbsolutePath();
            }
            // 确保路径以分隔符结尾
            if (!uploadDir.endsWith(File.separator)) {
                uploadDir += File.separator;
            }
            // 重新创建 File 对象（使用转换后的绝对路径）
            dir = new File(uploadDir);
            if (!dir.exists()) {
                boolean created = dir.mkdirs();
                if (!created) {
                    System.err.println("无法创建目录: " + uploadDir);
                    return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "无法创建上传目录: " + uploadDir
                    ));
                }
            }
            System.out.println("上传文件到目录: " + uploadDir);
            
            // 生成文件名（使用团队名+时间戳+扩展名，避免冲突）
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            // 根据 content type 确定扩展名（只支持JPG和PNG）
            if (contentType != null) {
                if (contentType.contains("jpeg") || contentType.contains("jpg")) {
                    extension = ".jpg";
                } else if (contentType.contains("png")) {
                    extension = ".png";
                } else {
                    extension = ".png"; // 默认
                }
            } else if (originalFilename != null && originalFilename.contains(".")) {
                // 如果contentType为空，尝试从文件名获取扩展名
                String fileExt = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
                if (fileExt.equals(".jpg") || fileExt.equals(".jpeg")) {
                    extension = ".jpg";
                } else if (fileExt.equals(".png")) {
                    extension = ".png";
                } else {
                    extension = ".png"; // 默认
                }
            } else {
                extension = ".png"; // 默认
            }
            
            String filename = teamName + "_" + System.currentTimeMillis() + extension;
            String filePath = uploadDir + filename;
            File destFile = new File(filePath);
            
            // 保存文件
            file.transferTo(destFile);
            
            // 保存路径到数据库
            String logoPath = "/images/team_logos/" + filename;
            Optional<TeamLogo> existingLogo = teamLogoRepository.findByTeamName(teamName);
            
            TeamLogo teamLogo;
            if (existingLogo.isPresent()) {
                // 更新现有记录
                teamLogo = existingLogo.get();
                // 删除旧文件
                String oldFilename = teamLogo.getLogoPath().substring(teamLogo.getLogoPath().lastIndexOf("/") + 1);
                String oldPath = uploadDir + oldFilename;
                File oldFile = new File(oldPath);
                if (oldFile.exists()) {
                    oldFile.delete();
                }
                teamLogo.setLogoPath(logoPath);
            } else {
                // 创建新记录
                teamLogo = new TeamLogo();
                teamLogo.setTeamName(teamName);
                teamLogo.setLogoPath(logoPath);
            }
            
            teamLogoRepository.save(teamLogo);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "团徽上传成功",
                "logoPath", logoPath,
                "teamName", teamName
            ));
        } catch (Exception e) {
            System.err.println("上传团徽失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "上传失败: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 获取所有团徽列表
     */
    @GetMapping("/team-logos")
    public ResponseEntity<List<Map<String, Object>>> getAllTeamLogos() {
        try {
            List<TeamLogo> logos = teamLogoRepository.findAll();
            List<Map<String, Object>> result = logos.stream()
                    .map(logo -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("teamName", logo.getTeamName());
                        map.put("logoPath", logo.getLogoPath());
                        map.put("createdAt", logo.getCreatedAt());
                        map.put("updatedAt", logo.getUpdatedAt());
                        return map;
                    })
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("获取团徽列表失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(new ArrayList<>());
        }
    }
    
    /**
     * 删除团徽
     */
    @DeleteMapping("/team-logos/{teamName}")
    public ResponseEntity<Map<String, Object>> deleteTeamLogo(@PathVariable String teamName) {
        try {
            Optional<TeamLogo> logoOpt = teamLogoRepository.findByTeamName(teamName);
            if (logoOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "未找到该团队的团徽"
                ));
            }
            
            TeamLogo logo = logoOpt.get();
            // 使用配置的路径删除文件（与 WebConfig 保持一致）
            String uploadDir = teamLogosUploadDir;
            // 确保路径是绝对路径
            File dir = new File(uploadDir);
            if (!dir.isAbsolute()) {
                // 如果是相对路径，转换为绝对路径
                uploadDir = dir.getAbsolutePath();
            }
            // 确保路径以分隔符结尾
            if (!uploadDir.endsWith(File.separator)) {
                uploadDir += File.separator;
            }
            String filename = logo.getLogoPath().substring(logo.getLogoPath().lastIndexOf("/") + 1);
            String filePath = uploadDir + filename;
            File file = new File(filePath);
            if (file.exists()) {
                file.delete();
            }
            
            teamLogoRepository.delete(logo);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "团徽删除成功"
            ));
        } catch (Exception e) {
            System.err.println("删除团徽失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "删除失败: " + e.getMessage()
            ));
        }
    }
    
    // ==================== 排名排除名单管理接口 ====================
    
    /**
     * 获取排名排除名单
     */
    @GetMapping("/ranking/exclusion-list")
    public ResponseEntity<Map<String, Object>> getRankingExclusionList() {
        try {
            List<String> members = rankingExclusionRepository.findAll().stream()
                    .map(RankingExclusion::getMemberName)
                    .collect(Collectors.toList());
            Map<String, Object> result = new HashMap<>();
            result.put("members", members);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("获取排名排除名单失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 保存排名排除名单
     */
    @PostMapping("/ranking/exclusion-list")
    @Transactional
    public ResponseEntity<Map<String, Object>> saveRankingExclusionList(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> members = (List<String>) request.get("members");
            if (members == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "members参数不能为空"));
            }
            
            // 删除所有现有记录
            rankingExclusionRepository.deleteAll();
            
            // 添加新记录
            for (String memberName : members) {
                if (memberName != null && !memberName.trim().isEmpty()) {
                    RankingExclusion exclusion = new RankingExclusion();
                    exclusion.setMemberName(memberName.trim());
                    rankingExclusionRepository.save(exclusion);
                }
            }
            
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            System.err.println("保存排名排除名单失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 删除排名排除名单中的成员
     */
    @DeleteMapping("/ranking/exclusion-list/{memberName}")
    @Transactional
    public ResponseEntity<Map<String, Object>> removeRankingExclusionMember(@PathVariable String memberName) {
        try {
            String decodedMemberName = java.net.URLDecoder.decode(memberName, StandardCharsets.UTF_8);
            rankingExclusionRepository.deleteByMemberName(decodedMemberName);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            System.err.println("删除排名排除成员失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 获取赛季中所有参与考勤的成员（包括未参与排名的）
     */
    @GetMapping("/seasons/{seasonId}/all-members")
    public ResponseEntity<List<String>> getAllMembersInSeason(@PathVariable Long seasonId) {
        try {
            // 查询赛季内所有已结算的考勤记录（排除手动添加类型）
            List<AttendanceSession> allSessions = attendanceSessionRepository.findBySeasonIdAndSettledExcludingManual(seasonId);
            
            Set<String> memberNames = new HashSet<>();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(),
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    for (MemberData member : memberDataList) {
                        String name = member.get成员();
                        if (name != null && !name.trim().isEmpty()) {
                            memberNames.add(name.trim());
                        }
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            List<String> sortedMembers = new ArrayList<>(memberNames);
            Collections.sort(sortedMembers);
            
            return ResponseEntity.ok(sortedMembers);
        } catch (Exception e) {
            System.err.println("获取赛季所有成员失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Collections.emptyList());
        }
    }
    
    /**
     * 导出成员详情为Excel
     */
    @GetMapping("/sessions/{id}/export-members")
    public ResponseEntity<byte[]> exportMemberDetails(@PathVariable Long id) {
        try {
            AttendanceSession session = attendanceSessionRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("考勤会话不存在"));
            
            if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            ObjectMapper mapper = new ObjectMapper();
            List<DisplayRow> memberData;
            
            try {
                // 尝试解析为DisplayRow
                List<DisplayRow> parsedRows = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, DisplayRow.class));
                
                // 重新计算差值，确保正确（因为保存时可能没有保存差值）
                memberData = new ArrayList<>();
                for (DisplayRow row : parsedRows) {
                    // 重新计算差值
                    row.set差值(row.get后值() - row.get前值());
                    row.set助攻差值(row.get助攻后值() - row.get助攻前值());
                    memberData.add(row);
                }
            } catch (Exception e) {
                // 如果解析失败，尝试解析为MemberData并转换
                List<MemberData> memberDataList = mapper.readValue(session.getMemberData(), 
                    mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                
                memberData = new ArrayList<>();
                for (MemberData data : memberDataList) {
                    DisplayRow row = new DisplayRow();
                    row.set成员(data.get成员());
                    row.set分组(data.get分组());
                    row.set前值(data.get前值());
                    row.set后值(data.get后值());
                    row.set差值(data.get后值() - data.get前值());
                    row.set助攻前值(data.get助攻前值());
                    row.set助攻后值(data.get助攻后值());
                    row.set助攻差值(data.get助攻后值() - data.get助攻前值());
                    
                    // 根据考勤类型选择达标判断标准
                    if ("区间助攻考勤".equals(session.getAttendanceType())) {
                        row.set达标((data.get助攻后值() - data.get助攻前值()) >= (session.getThreshold() != null ? session.getThreshold() : 1));
                    } else {
                        row.set达标((data.get后值() - data.get前值()) >= (session.getThreshold() != null ? session.getThreshold() : 1));
                    }
                    row.set参加考勤(data.is参加考勤());
                    memberData.add(row);
                }
            }
            
            // 创建工作簿
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("成员详情");
            
            // 创建标题行样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            
            // 创建数据行样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            
            // 创建标题行
            Row headerRow = sheet.createRow(0);
            String[] headers = {"成员", "分组", "战功前值", "战功后值", "战功差值", 
                               "助攻前值", "助攻后值", "助攻差值", "是否参加考勤", "是否达标"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            // 填充数据
            int rowNum = 1;
            for (DisplayRow member : memberData) {
                Row row = sheet.createRow(rowNum++);
                
                int colNum = 0;
                row.createCell(colNum++).setCellValue(member.get成员());
                row.createCell(colNum++).setCellValue(member.get分组());
                row.createCell(colNum++).setCellValue(member.get前值());
                row.createCell(colNum++).setCellValue(member.get后值());
                row.createCell(colNum++).setCellValue(member.get差值());
                row.createCell(colNum++).setCellValue(member.get助攻前值());
                row.createCell(colNum++).setCellValue(member.get助攻后值());
                row.createCell(colNum++).setCellValue(member.get助攻差值());
                row.createCell(colNum++).setCellValue(member.is参加考勤() ? "参加" : "不参加");
                row.createCell(colNum++).setCellValue(member.is达标() ? "出勤" : "未出勤");
                
                // 应用样式
                for (int i = 0; i < headers.length; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
            }
            
            // 自动调整列宽
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                // 设置最小列宽
                if (sheet.getColumnWidth(i) < 3000) {
                    sheet.setColumnWidth(i, 3000);
                }
            }
            
            // 将工作簿写入字节数组
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            workbook.close();
            
            // 设置响应头 - 不设置文件名，避免中文编码问题（前端会自己生成文件名）
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            
            // 不设置 Content-Disposition，前端会自己生成文件名
            
            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body(outputStream.toByteArray());
                    
        } catch (Exception e) {
            System.err.println("导出成员详情失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * 导出个人排名为Excel
     */
    @GetMapping("/ranking/personal/export")
    public ResponseEntity<byte[]> exportPersonalRanking(
            @RequestParam Long seasonId,
            @RequestParam(required = false) List<String> attendanceTypes,
            @RequestParam(required = false, defaultValue = "") String memberName,
            @RequestParam(required = false, defaultValue = "desc") String sortOrder) {
        try {
            // 获取赛季信息
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 获取排除名单
            List<String> exclusionList = rankingExclusionRepository.findAll().stream()
                    .map(RankingExclusion::getMemberName)
                    .collect(Collectors.toList());
            
            // 查询赛季内所有已结算的考勤记录（排除手动添加类型）
            List<AttendanceSession> allSessions = attendanceSessionRepository.findBySeasonIdAndSettledExcludingManual(seasonId);
            
            // 如果指定了考勤类型，进行过滤
            if (attendanceTypes != null && !attendanceTypes.isEmpty()) {
                allSessions = allSessions.stream()
                        .filter(session -> attendanceTypes.contains(session.getAttendanceType()))
                        .collect(Collectors.toList());
            }
            
            // 统计每个人的出勤数据（排除排除名单中的人员）
            Map<String, PersonalRankingData> memberStats = new HashMap<>();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(),
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    for (MemberData member : memberDataList) {
                        String name = member.get成员();
                        if (name == null || name.trim().isEmpty()) {
                            continue;
                        }
                        
                        // 排除排除名单中的人员
                        if (exclusionList.contains(name)) {
                            continue;
                        }
                        
                        PersonalRankingData stats = memberStats.computeIfAbsent(name, 
                                k -> new PersonalRankingData(name));
                        
                        if (member.is参加考勤()) {
                            stats.setAttendedSessions(stats.getAttendedSessions() + 1);
                            
                            boolean isQualified = false;
                            if ("区间助攻考勤".equals(session.getAttendanceType())) {
                                isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                            } else {
                                isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                            }
                            
                            if (isQualified) {
                                stats.setQualifiedSessions(stats.getQualifiedSessions() + 1);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            // 计算出勤率
            List<PersonalRankingData> rankingList = new ArrayList<>(memberStats.values());
            for (PersonalRankingData data : rankingList) {
                if (data.getAttendedSessions() > 0) {
                    double rate = (double) data.getQualifiedSessions() / data.getAttendedSessions() * 100.0;
                    data.setAttendanceRate(Math.round(rate * 100.0) / 100.0);
                } else {
                    data.setAttendanceRate(0.0);
                }
            }
            
            // 排序
            rankingList.sort(Comparator.comparing(PersonalRankingData::getAttendanceRate).reversed()
                    .thenComparing(PersonalRankingData::getQualifiedSessions, Comparator.reverseOrder())
                    .thenComparing(PersonalRankingData::getMemberName));
            
            // 计算排名
            int currentRank = 1;
            for (int i = 0; i < rankingList.size(); i++) {
                PersonalRankingData current = rankingList.get(i);
                
                if (i > 0) {
                    PersonalRankingData previous = rankingList.get(i - 1);
                    if (Math.abs(current.getAttendanceRate() - previous.getAttendanceRate()) < 0.01 &&
                        current.getQualifiedSessions() == previous.getQualifiedSessions()) {
                        current.setRank(previous.getRank());
                    } else {
                        currentRank = i + 1;
                        current.setRank(currentRank);
                    }
                } else {
                    current.setRank(1);
                    currentRank = 1;
                }
            }
            
            // 应用姓名模糊查询过滤
            if (memberName != null && !memberName.trim().isEmpty()) {
                rankingList = rankingList.stream()
                        .filter(data -> data.getMemberName().contains(memberName.trim()))
                        .collect(Collectors.toList());
            }
            
            // 如果用户选择了asc排序，重新排序
            if ("asc".equalsIgnoreCase(sortOrder)) {
                rankingList.sort(Comparator.comparing(PersonalRankingData::getAttendanceRate)
                        .thenComparing(PersonalRankingData::getQualifiedSessions, Comparator.reverseOrder())
                        .thenComparing(PersonalRankingData::getMemberName));
            }
            
            // 创建工作簿
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("个人排名");
            
            // 创建标题行样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            
            // 创建数据行样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            
            // 创建标题行
            Row headerRow = sheet.createRow(0);
            String[] headers = {"排名", "姓名", "出勤率(%)", "实际出勤次数", "参与考勤次数"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            // 填充数据
            int rowNum = 1;
            for (PersonalRankingData data : rankingList) {
                Row row = sheet.createRow(rowNum++);
                
                int colNum = 0;
                row.createCell(colNum++).setCellValue(data.getRank() != null ? data.getRank() : 0);
                row.createCell(colNum++).setCellValue(data.getMemberName());
                row.createCell(colNum++).setCellValue(data.getAttendanceRate());
                row.createCell(colNum++).setCellValue(data.getQualifiedSessions());
                row.createCell(colNum++).setCellValue(data.getAttendedSessions());
                
                // 应用样式
                for (int i = 0; i < headers.length; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
            }
            
            // 自动调整列宽
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                if (sheet.getColumnWidth(i) < 3000) {
                    sheet.setColumnWidth(i, 3000);
                }
            }
            
            // 将工作簿写入字节数组
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            workbook.close();
            
            // 设置响应头
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            
            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body(outputStream.toByteArray());
                    
        } catch (Exception e) {
            System.err.println("导出个人排名失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * 导出团队排名为Excel
     */
    @GetMapping("/ranking/team/export")
    public ResponseEntity<byte[]> exportTeamRanking(
            @RequestParam Long seasonId,
            @RequestParam(required = false) List<String> attendanceTypes,
            @RequestParam(required = false, defaultValue = "") String teamName,
            @RequestParam(required = false, defaultValue = "desc") String sortOrder) {
        try {
            // 获取赛季信息
            Season season = seasonRepository.findById(seasonId)
                    .orElseThrow(() -> new RuntimeException("未找到赛季: " + seasonId));
            
            // 查询赛季内所有已结算的考勤记录（排除手动添加类型）
            List<AttendanceSession> allSessions = attendanceSessionRepository.findBySeasonIdAndSettledExcludingManual(seasonId);
            
            // 如果指定了考勤类型，进行过滤
            if (attendanceTypes != null && !attendanceTypes.isEmpty()) {
                allSessions = allSessions.stream()
                        .filter(session -> attendanceTypes.contains(session.getAttendanceType()))
                        .collect(Collectors.toList());
            }
            
            // 统计每个团队的平均出勤率
            Map<String, List<Double>> teamRatesMap = new HashMap<>();
            ObjectMapper mapper = new ObjectMapper();
            
            for (AttendanceSession session : allSessions) {
                if (session.getMemberData() == null || session.getMemberData().isEmpty()) {
                    continue;
                }
                
                try {
                    List<MemberData> memberDataList = mapper.readValue(session.getMemberData(),
                            mapper.getTypeFactory().constructCollectionType(List.class, MemberData.class));
                    
                    // 按团队分组统计
                    Map<String, List<MemberData>> teamMembersMap = memberDataList.stream()
                            .filter(member -> member.get分组() != null && !member.get分组().trim().isEmpty())
                            .collect(Collectors.groupingBy(MemberData::get分组));
                    
                    // 计算每个团队在这次考勤中的出勤率（加成后）
                    for (Map.Entry<String, List<MemberData>> entry : teamMembersMap.entrySet()) {
                        String team = entry.getKey();
                        List<MemberData> teamMembers = entry.getValue();
                        
                        // 计算参加考勤的人数
                        long attendingCount = teamMembers.stream()
                                .mapToLong(member -> member.is参加考勤() ? 1 : 0)
                                .sum();
                        
                        if (attendingCount == 0) {
                            continue;
                        }
                        
                        // 计算达标人数
                        long qualifiedCount = teamMembers.stream()
                                .mapToLong(member -> {
                                    if (!member.is参加考勤()) {
                                        return 0;
                                    }
                                    boolean isQualified;
                                    if ("区间助攻考勤".equals(session.getAttendanceType())) {
                                        isQualified = (member.get助攻后值() - member.get助攻前值()) >= session.getThreshold();
                                    } else {
                                        isQualified = (member.get后值() - member.get前值()) >= session.getThreshold();
                                    }
                                    return isQualified ? 1 : 0;
                                })
                                .sum();
                        
                        // 计算出勤率
                        double attendanceRate = (double) qualifiedCount / attendingCount * 100.0;
                        attendanceRate = Math.round(attendanceRate * 100.0) / 100.0;
                        
                        // 应用加成
                        int memberCount = (int) attendingCount;
                        TeamSizeBonusRule applicableRule = bonusConfigService.getApplicableBonusRule(memberCount);
                        double bonusRate = attendanceRate;
                        
                        if (applicableRule != null) {
                            bonusRate = attendanceRate + applicableRule.getAttendanceRateBonus();
                            if (bonusRate > 100.0) {
                                bonusRate = 100.0;
                            }
                            bonusRate = Math.round(bonusRate * 100.0) / 100.0;
                        }
                        
                        // 添加到团队出勤率列表
                        teamRatesMap.computeIfAbsent(team, k -> new ArrayList<>()).add(bonusRate);
                    }
                } catch (Exception e) {
                    System.err.println("解析考勤记录失败: " + e.getMessage());
                    continue;
                }
            }
            
            // 计算每个团队的平均出勤率
            List<TeamRankingData> rankingList = new ArrayList<>();
            for (Map.Entry<String, List<Double>> entry : teamRatesMap.entrySet()) {
                String team = entry.getKey();
                List<Double> rates = entry.getValue();
                
                if (rates.isEmpty()) {
                    continue;
                }
                
                TeamRankingData teamData = new TeamRankingData(team);
                teamData.setTotalSessions(rates.size());
                
                // 计算平均值
                double sum = rates.stream().mapToDouble(Double::doubleValue).sum();
                double average = sum / rates.size();
                teamData.setAverageAttendanceRate(Math.round(average * 100.0) / 100.0);
                
                rankingList.add(teamData);
            }
            
            // 排序
            rankingList.sort(Comparator.comparing(TeamRankingData::getAverageAttendanceRate).reversed()
                    .thenComparing(TeamRankingData::getTeamName));
            
            // 计算排名
            int currentRank = 1;
            for (int i = 0; i < rankingList.size(); i++) {
                TeamRankingData current = rankingList.get(i);
                
                if (i > 0) {
                    TeamRankingData previous = rankingList.get(i - 1);
                    if (Math.abs(current.getAverageAttendanceRate() - previous.getAverageAttendanceRate()) < 0.01) {
                        current.setRank(previous.getRank());
                    } else {
                        currentRank = i + 1;
                        current.setRank(currentRank);
                    }
                } else {
                    current.setRank(1);
                    currentRank = 1;
                }
            }
            
            // 应用团队名模糊查询过滤
            if (teamName != null && !teamName.trim().isEmpty()) {
                rankingList = rankingList.stream()
                        .filter(data -> data.getTeamName().contains(teamName.trim()))
                        .collect(Collectors.toList());
            }
            
            // 如果用户选择了asc排序，重新排序
            if ("asc".equalsIgnoreCase(sortOrder)) {
                rankingList.sort(Comparator.comparing(TeamRankingData::getAverageAttendanceRate)
                        .thenComparing(TeamRankingData::getTeamName));
            }
            
            // 创建工作簿
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("团队排名");
            
            // 创建标题行样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            
            // 创建数据行样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            
            // 创建标题行
            Row headerRow = sheet.createRow(0);
            String[] headers = {"排名", "团队名称", "平均出勤率(%)", "参与考勤次数"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            // 填充数据
            int rowNum = 1;
            for (TeamRankingData data : rankingList) {
                Row row = sheet.createRow(rowNum++);
                
                int colNum = 0;
                row.createCell(colNum++).setCellValue(data.getRank() != null ? data.getRank() : 0);
                row.createCell(colNum++).setCellValue(data.getTeamName());
                row.createCell(colNum++).setCellValue(data.getAverageAttendanceRate());
                row.createCell(colNum++).setCellValue(data.getTotalSessions());
                
                // 应用样式
                for (int i = 0; i < headers.length; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
            }
            
            // 自动调整列宽
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                if (sheet.getColumnWidth(i) < 3000) {
                    sheet.setColumnWidth(i, 3000);
                }
            }
            
            // 将工作簿写入字节数组
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            workbook.close();
            
            // 设置响应头
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            
            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body(outputStream.toByteArray());
                    
        } catch (Exception e) {
            System.err.println("导出团队排名失败: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
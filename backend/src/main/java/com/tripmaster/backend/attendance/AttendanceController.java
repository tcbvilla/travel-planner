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

@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceSessionRepository attendanceSessionRepository;

    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttendanceResponse compare(@RequestPart("start") MultipartFile start,
                                    @RequestPart("end") MultipartFile end,
                                    @RequestParam(name = "threshold", defaultValue = "1") long threshold) throws Exception {
        List<Map<String, String>> startRows = readCsvAuto(start);
        List<Map<String, String>> endRows = readCsvAuto(end);

        Map<String, Map<String, String>> startMap = indexByMember(startRows);
        Map<String, Map<String, String>> endMap = indexByMember(endRows);

        List<DisplayRow> result = new ArrayList<>();
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

            DisplayRow row = new DisplayRow();
            row.set成员(member);
            row.set分组(startGroup);
            row.set前值(prev);
            row.set后值(next);
            row.set差值(diff);
            row.set助攻前值(assistPrev);
            row.set助攻后值(assistNext);
            row.set助攻差值(assistDiff);
            row.set达标(diff >= threshold);
            result.add(row);
        }

        result.sort((a, b) -> Long.compare(b.get差值(), a.get差值()));
        
        // 计算小组统计
        List<GroupStat> groupStats = calculateGroupStats(result);
        
        AttendanceResponse response = new AttendanceResponse();
        response.setMembers(result);
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
        session.setName(request.getName());
        session.setBattleResult(request.getBattleResult());
        session.setStatus(SessionStatus.ADDED);
        session.setMemberData(request.getMemberData());
        session.setGroupData(request.getGroupData());
        session.setThreshold(request.getThreshold());
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
    public AttendanceSession getSession(@PathVariable Long id) {
        return attendanceSessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("考勤会话不存在"));
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
            String group = member.get分组();
            GroupStat stat = groupMap.computeIfAbsent(group, k -> {
                GroupStat gs = new GroupStat();
                gs.setGroup(group);
                gs.setTotalMeritIncrease(0);
                gs.setAverageMeritIncrease(0);
                gs.setAttendanceRate(0.0);
                gs.setMemberCount(0);
                gs.setAttendedCount(0); // 新增：达标人数
                return gs;
            });
            
            stat.setTotalMeritIncrease(stat.getTotalMeritIncrease() + member.get差值());
            stat.setMemberCount(stat.getMemberCount() + 1);
            if (member.is达标()) {
                stat.setAttendedCount(stat.getAttendedCount() + 1);
            }
        }
        
        // 计算人均战功增量和出勤率
        for (GroupStat stat : groupMap.values()) {
            if (stat.getMemberCount() > 0) {
                stat.setAverageMeritIncrease(stat.getTotalMeritIncrease() / stat.getMemberCount());
                // 计算出勤率：达标人数 / 总人数 * 100%
                double attendanceRate = (double) stat.getAttendedCount() / stat.getMemberCount() * 100.0;
                stat.setAttendanceRate(Math.round(attendanceRate * 100.0) / 100.0);
                
                // 调试日志
                System.out.println("小组: " + stat.getGroup() + 
                    ", 总人数: " + stat.getMemberCount() + 
                    ", 达标人数: " + stat.getAttendedCount() + 
                    ", 出勤率: " + attendanceRate + 
                    ", 最终出勤率: " + stat.getAttendanceRate());
            }
        }
        
        List<GroupStat> result = new ArrayList<>(groupMap.values());
        result.sort((a, b) -> Long.compare(b.getTotalMeritIncrease(), a.getTotalMeritIncrease()));
        
        return result;
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
}



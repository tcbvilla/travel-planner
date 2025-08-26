package com.tripmaster.backend.attendance;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {

    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<DisplayRow> compare(@RequestPart("start") MultipartFile start,
                                    @RequestPart("end") MultipartFile end,
                                    @RequestParam(name = "threshold", defaultValue = "1") long threshold) throws Exception {
        List<Map<String, String>> startRows = readCsv(start);
        List<Map<String, String>> endRows = readCsv(end);

        Map<String, Map<String, String>> startMap = indexByMember(startRows);
        Map<String, Map<String, String>> endMap = indexByMember(endRows);

        List<DisplayRow> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, String>> e : startMap.entrySet()) {
            String member = e.getKey();
            Map<String, String> s = e.getValue();
            Map<String, String> t = endMap.get(member);
            long prev = parseLong(s.getOrDefault("战功总量", "0"));
            long next = parseLong(t != null ? t.getOrDefault("战功总量", "0") : "0");
            long diff = next - prev;

            DisplayRow row = new DisplayRow();
            row.set成员(member);
            row.set分组(s.getOrDefault("分组", ""));
            row.set前值(prev);
            row.set后值(next);
            row.set差值(diff);
            row.set达标(diff >= threshold);
            result.add(row);
        }

        result.sort((a, b) -> Long.compare(b.get差值(), a.get差值()));
        return result;
    }

    private List<Map<String, String>> readCsv(MultipartFile file) throws Exception {
        try (CSVReader reader = new CSVReaderBuilder(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))
                .withSkipLines(0)
                .build()) {
            List<String[]> all = reader.readAll();
            if (all.isEmpty()) return Collections.emptyList();
            String[] header = Arrays.stream(all.get(0)).map(String::trim).toArray(String[]::new);
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

    private Map<String, Map<String, String>> indexByMember(List<Map<String, String>> rows) {
        Map<String, Map<String, String>> map = new LinkedHashMap<>();
        for (Map<String, String> r : rows) {
            String member = Optional.ofNullable(r.get("成员")).orElse("").trim();
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
}



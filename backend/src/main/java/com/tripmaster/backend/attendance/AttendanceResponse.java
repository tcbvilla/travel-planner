package com.tripmaster.backend.attendance;

import lombok.Data;
import java.util.List;

@Data
public class AttendanceResponse {
    private List<DisplayRow> members;
    private List<GroupStat> groups;
    private int filteredCount;
}

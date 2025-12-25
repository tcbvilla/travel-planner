package com.tripmaster.backend.attendance;

import lombok.Data;
import java.util.List;

@Data
public class AllTeamsAttendanceRateResponse {
    private List<SessionTeamRates> sessions;

    public AllTeamsAttendanceRateResponse() {}

    public AllTeamsAttendanceRateResponse(List<SessionTeamRates> sessions) {
        this.sessions = sessions;
    }
}



package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RewardConditionRepository extends JpaRepository<RewardCondition, Long> {
    List<RewardCondition> findByAttendanceSessionIdOrderByCreatedAtDesc(Long attendanceSessionId);
}

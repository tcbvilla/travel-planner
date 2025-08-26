package com.tripmaster.backend.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    
    Page<AttendanceSession> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    Page<AttendanceSession> findByNameContainingIgnoreCaseOrderByCreatedAtDesc(String name, Pageable pageable);
}

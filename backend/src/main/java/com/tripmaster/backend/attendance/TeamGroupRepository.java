package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TeamGroupRepository extends JpaRepository<TeamGroup, Long> {
    Optional<TeamGroup> findByGroupName(String groupName);
    boolean existsByGroupName(String groupName);
}

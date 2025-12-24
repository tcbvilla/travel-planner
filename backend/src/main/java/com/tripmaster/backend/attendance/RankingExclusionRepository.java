package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RankingExclusionRepository extends JpaRepository<RankingExclusion, Long> {
    Optional<RankingExclusion> findByMemberName(String memberName);
    boolean existsByMemberName(String memberName);
    void deleteByMemberName(String memberName);
}



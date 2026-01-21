package com.tripmaster.backend.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Repository
public interface MemberGroupMappingRepository extends JpaRepository<MemberGroupMapping, Long> {
    Optional<MemberGroupMapping> findByMemberName(String memberName);
    List<MemberGroupMapping> findByTeamGroup(TeamGroup teamGroup);
    List<MemberGroupMapping> findByTeamGroupIsNull();
    Page<MemberGroupMapping> findByTeamGroupIsNull(Pageable pageable);
    Page<MemberGroupMapping> findByTeamGroup(TeamGroup teamGroup, Pageable pageable);
    
    // Fuzzy search by member name
    Page<MemberGroupMapping> findByMemberNameContainingIgnoreCase(String memberName, Pageable pageable);
    Page<MemberGroupMapping> findByTeamGroupIsNullAndMemberNameContainingIgnoreCase(String memberName, Pageable pageable);
    Page<MemberGroupMapping> findByTeamGroupAndMemberNameContainingIgnoreCase(TeamGroup teamGroup, String memberName, Pageable pageable);
    
    @Query("SELECT COUNT(m) FROM MemberGroupMapping m WHERE m.teamGroup = :teamGroup")
    long countByTeamGroup(TeamGroup teamGroup);
    
    @Modifying
    @Transactional
    @Query("DELETE FROM MemberGroupMapping m WHERE m.teamGroup IS NULL")
    void deleteByTeamGroupIsNull();
}

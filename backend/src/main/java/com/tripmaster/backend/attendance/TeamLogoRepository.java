package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TeamLogoRepository extends JpaRepository<TeamLogo, Long> {
    Optional<TeamLogo> findByTeamName(String teamName);
    boolean existsByTeamName(String teamName);
}



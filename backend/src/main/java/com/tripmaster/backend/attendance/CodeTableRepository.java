package com.tripmaster.backend.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeTableRepository extends JpaRepository<CodeTable, Long> {
    
    List<CodeTable> findByType(String type);
    
    CodeTable findByCodeName(String codeName);
    
    CodeTable findByCodeValue(Integer codeValue);
}

package com.tripmaster.backend.attendance;

import jakarta.persistence.*;

@Entity
@Table(name = "code_tables")
public class CodeTable {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "code_name", nullable = false, unique = true)
    private String codeName;
    
    @Column(name = "code_value", nullable = false)
    private Integer codeValue;
    
    @Column(name = "type", nullable = false)
    private String type; // "REWARD" 或 "PENALTY"
    
    @Column(name = "description")
    private String description;
    
    // 构造函数
    public CodeTable() {}
    
    public CodeTable(String codeName, Integer codeValue, String type, String description) {
        this.codeName = codeName;
        this.codeValue = codeValue;
        this.type = type;
        this.description = description;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getCodeName() {
        return codeName;
    }
    
    public void setCodeName(String codeName) {
        this.codeName = codeName;
    }
    
    public Integer getCodeValue() {
        return codeValue;
    }
    
    public void setCodeValue(Integer codeValue) {
        this.codeValue = codeValue;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
}

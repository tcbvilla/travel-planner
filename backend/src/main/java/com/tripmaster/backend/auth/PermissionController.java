package com.tripmaster.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 权限管理控制器
 */
@RestController
@RequestMapping("/api/auth/permissions")
@CrossOrigin(origins = "*")
// 权限管理只有超级管理员可以访问，不需要特定权限注解
public class PermissionController {
    
    @Autowired
    private PermissionRepository permissionRepository;
    
    /**
     * 获取权限列表（分页）
     */
    @GetMapping
    public ResponseEntity<Page<Permission>> getPermissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
            Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<Permission> permissions;
        if (search != null && !search.trim().isEmpty()) {
            permissions = permissionRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(
                search.trim(), search.trim(), pageable);
        } else {
            permissions = permissionRepository.findAll(pageable);
        }
        
        return ResponseEntity.ok(permissions);
    }
    
    /**
     * 获取所有权限（不分页）
     */
    @GetMapping("/all")
    public ResponseEntity<List<Permission>> getAllPermissions() {
        List<Permission> permissions = permissionRepository.findAll();
        return ResponseEntity.ok(permissions);
    }
    
    /**
     * 根据模块获取权限
     */
    @GetMapping("/by-module/{module}")
    public ResponseEntity<List<Permission>> getPermissionsByModule(@PathVariable String module) {
        List<Permission> permissions = permissionRepository.findByModule(module);
        return ResponseEntity.ok(permissions);
    }
    
    /**
     * 根据ID获取权限详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<Permission> getPermissionById(@PathVariable Long id) {
        Optional<Permission> permission = permissionRepository.findById(id);
        return permission.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 创建新权限
     */
    @PostMapping
    public ResponseEntity<Permission> createPermission(@RequestBody CreatePermissionRequest request) {
        // 检查权限代码是否已存在
        if (permissionRepository.findByCode(request.getCode()).isPresent()) {
            return ResponseEntity.badRequest().build();
        }
        
        Permission permission = new Permission();
        permission.setCode(request.getCode());
        permission.setModule(request.getModule());
        permission.setResource(request.getResource());
        permission.setAction(request.getAction());
        permission.setName(request.getName());
        permission.setDescription(request.getDescription());
        permission.setCreatedAt(LocalDateTime.now());
        permission.setUpdatedAt(LocalDateTime.now());
        // permission.setCreatedBy(currentUser);
        // permission.setUpdatedBy(currentUser);
        
        Permission savedPermission = permissionRepository.save(permission);
        return ResponseEntity.ok(savedPermission);
    }
    
    /**
     * 更新权限信息
     */
    @PutMapping("/{id}")
    public ResponseEntity<Permission> updatePermission(@PathVariable Long id, @RequestBody UpdatePermissionRequest request) {
        Optional<Permission> permissionOpt = permissionRepository.findById(id);
        if (permissionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Permission permission = permissionOpt.get();
        permission.setName(request.getName());
        permission.setDescription(request.getDescription());
        permission.setUpdatedAt(LocalDateTime.now());
        // permission.setUpdatedBy(currentUser);
        
        Permission savedPermission = permissionRepository.save(permission);
        return ResponseEntity.ok(savedPermission);
    }
    
    /**
     * 删除权限
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePermission(@PathVariable Long id) {
        if (!permissionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        permissionRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 获取权限模块列表
     */
    @GetMapping("/modules")
    public ResponseEntity<List<String>> getPermissionModules() {
        List<String> modules = permissionRepository.findDistinctModules();
        return ResponseEntity.ok(modules);
    }
    
    // DTO类
    public static class CreatePermissionRequest {
        private String code;
        private String module;
        private String resource;
        private String action;
        private String name;
        private String description;
        
        // Getters and Setters
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getModule() { return module; }
        public void setModule(String module) { this.module = module; }
        public String getResource() { return resource; }
        public void setResource(String resource) { this.resource = resource; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
    
    public static class UpdatePermissionRequest {
        private String name;
        private String description;
        
        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
}

package com.tripmaster.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 角色管理控制器
 */
@RestController
@RequestMapping("/api/auth/roles")
@CrossOrigin(origins = "*")
// 角色管理只有超级管理员可以访问，不需要特定权限注解
public class RoleController {
    
    @Autowired
    private RoleRepository roleRepository;
    
    @Autowired
    private PermissionRepository permissionRepository;
    
    @Autowired
    private RolePermissionRepository rolePermissionRepository;
    
    /**
     * 获取角色列表（分页）
     */
    @GetMapping
    public ResponseEntity<Page<Role>> getRoles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
            Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<Role> roles;
        if (search != null && !search.trim().isEmpty()) {
            roles = roleRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(
                search.trim(), search.trim(), pageable);
        } else {
            roles = roleRepository.findAll(pageable);
        }
        
        return ResponseEntity.ok(roles);
    }
    
    /**
     * 获取所有角色（不分页）
     */
    @GetMapping("/all")
    public ResponseEntity<List<Role>> getAllRoles() {
        List<Role> roles = roleRepository.findAll();
        return ResponseEntity.ok(roles);
    }
    
    /**
     * 根据ID获取角色详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<Role> getRoleById(@PathVariable Long id) {
        Optional<Role> role = roleRepository.findById(id);
        return role.map(ResponseEntity::ok)
                  .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 创建新角色
     */
    @PostMapping
    public ResponseEntity<Role> createRole(@RequestBody CreateRoleRequest request) {
        // 检查角色代码是否已存在
        if (roleRepository.findByCode(request.getCode()).isPresent()) {
            return ResponseEntity.badRequest().build();
        }
        
        Role role = new Role();
        role.setCode(request.getCode());
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setCreatedAt(LocalDateTime.now());
        role.setUpdatedAt(LocalDateTime.now());
        // role.setCreatedBy(currentUser);
        // role.setUpdatedBy(currentUser);
        
        Role savedRole = roleRepository.save(role);
        return ResponseEntity.ok(savedRole);
    }
    
    /**
     * 更新角色信息
     */
    @PutMapping("/{id}")
    public ResponseEntity<Role> updateRole(@PathVariable Long id, @RequestBody UpdateRoleRequest request) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Role role = roleOpt.get();
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setUpdatedAt(LocalDateTime.now());
        // role.setUpdatedBy(currentUser);
        
        Role savedRole = roleRepository.save(role);
        return ResponseEntity.ok(savedRole);
    }
    
    /**
     * 删除角色
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteRole(@PathVariable Long id) {
        if (!roleRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        // 先删除角色权限关联
        rolePermissionRepository.deleteByRoleId(id);
        
        // 再删除角色
        roleRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 获取角色的权限
     */
    @GetMapping("/{id}/permissions")
    public ResponseEntity<List<Permission>> getRolePermissions(@PathVariable Long id) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        // 使用Repository查询角色权限
        List<Permission> permissions = roleRepository.findRolePermissions(id);
        return ResponseEntity.ok(permissions);
    }
    
    /**
     * 为角色分配权限
     */
    @PostMapping("/{id}/permissions")
    @Transactional
    public ResponseEntity<Void> assignPermission(@PathVariable Long id, @RequestBody AssignPermissionRequest request) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Optional<Permission> permissionOpt = permissionRepository.findById(request.getPermissionId());
        if (permissionOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        // 检查是否已经分配了该权限
        if (rolePermissionRepository.existsByRoleIdAndPermissionId(id, request.getPermissionId())) {
            return ResponseEntity.badRequest().build();
        }
        
        RolePermission rolePermission = new RolePermission();
        rolePermission.setRole(roleOpt.get());
        rolePermission.setPermission(permissionOpt.get());
        rolePermission.setCreatedAt(LocalDateTime.now());
        // rolePermission.setCreatedBy(currentUser);
        
        rolePermissionRepository.save(rolePermission);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 移除角色权限
     */
    @DeleteMapping("/{id}/permissions/{permissionId}")
    @Transactional
    public ResponseEntity<Void> removePermission(@PathVariable Long id, @PathVariable Long permissionId) {
        rolePermissionRepository.deleteByRoleIdAndPermissionId(id, permissionId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 批量分配权限
     */
    @PostMapping("/{id}/permissions/batch")
    public ResponseEntity<Void> assignPermissions(@PathVariable Long id, @RequestBody BatchAssignPermissionRequest request) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Role role = roleOpt.get();
        
        for (Long permissionId : request.getPermissionIds()) {
            // 检查权限是否存在
            Optional<Permission> permissionOpt = permissionRepository.findById(permissionId);
            if (permissionOpt.isPresent() && 
                !rolePermissionRepository.existsByRoleIdAndPermissionId(id, permissionId)) {
                
                RolePermission rolePermission = new RolePermission();
                rolePermission.setRole(role);
                rolePermission.setPermission(permissionOpt.get());
                rolePermission.setCreatedAt(LocalDateTime.now());
                // rolePermission.setCreatedBy(currentUser);
                
                rolePermissionRepository.save(rolePermission);
            }
        }
        
        return ResponseEntity.ok().build();
    }
    
    // DTO类
    public static class CreateRoleRequest {
        private String code;
        private String name;
        private String description;
        
        // Getters and Setters
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
    
    public static class UpdateRoleRequest {
        private String name;
        private String description;
        
        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
    
    public static class AssignPermissionRequest {
        private Long permissionId;
        
        // Getters and Setters
        public Long getPermissionId() { return permissionId; }
        public void setPermissionId(Long permissionId) { this.permissionId = permissionId; }
    }
    
    public static class BatchAssignPermissionRequest {
        private List<Long> permissionIds;
        
        // Getters and Setters
        public List<Long> getPermissionIds() { return permissionIds; }
        public void setPermissionIds(List<Long> permissionIds) { this.permissionIds = permissionIds; }
    }
}

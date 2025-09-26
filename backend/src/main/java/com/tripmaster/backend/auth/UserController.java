package com.tripmaster.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 用户管理控制器
 */
@RestController
@RequestMapping("/api/auth/users")
@CrossOrigin(origins = "*")
// 用户管理只有超级管理员可以访问，不需要特定权限注解
public class UserController {
    
    /**
     * 用户信息DTO（包含角色信息）
     */
    public static class UserWithRolesDTO {
        private Long id;
        private String username;
        private String displayName;
        private String email;
        private String phone;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime lastLoginAt;
        private List<Role> roles;
        
        // Constructors
        public UserWithRolesDTO() {}
        
        public UserWithRolesDTO(User user, List<Role> roles) {
            this.id = user.getId();
            this.username = user.getUsername();
            this.displayName = user.getDisplayName();
            this.email = user.getEmail();
            this.phone = user.getPhone();
            this.status = user.getStatus().name();
            this.createdAt = user.getCreatedAt();
            this.updatedAt = user.getUpdatedAt();
            this.lastLoginAt = user.getLastLoginAt();
            this.roles = roles;
        }
        
        // Getters and Setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        
        public LocalDateTime getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
        
        public LocalDateTime getLastLoginAt() { return lastLoginAt; }
        public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
        
        public List<Role> getRoles() { return roles; }
        public void setRoles(List<Role> roles) { this.roles = roles; }
    }
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private RoleRepository roleRepository;
    
    @Autowired
    private UserRoleRepository userRoleRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    /**
     * 获取用户列表（分页）
     */
    @GetMapping
    public ResponseEntity<Page<User>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
            Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<User> users;
        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.findByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
                search.trim(), search.trim(), pageable);
        } else {
            users = userRepository.findAll(pageable);
        }
        
        return ResponseEntity.ok(users);
    }
    
    /**
     * 获取所有用户（不分页）
     */
    @GetMapping("/all")
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }
    
    /**
     * 获取所有用户及其角色信息（不分页）
     */
    @GetMapping("/with-roles")
    public ResponseEntity<List<UserWithRolesDTO>> getAllUsersWithRoles() {
        List<User> users = userRepository.findAll();
        
        List<UserWithRolesDTO> usersWithRoles = users.stream()
            .map(user -> {
                List<Role> roles = userRepository.findUserRoles(user.getId());
                return new UserWithRolesDTO(user, roles);
            })
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(usersWithRoles);
    }
    
    /**
     * 根据ID获取用户详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        Optional<User> user = userRepository.findById(id);
        return user.map(ResponseEntity::ok)
                  .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 创建新用户
     */
    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest request) {
        // 检查用户名是否已存在
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().build();
        }
        
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(request.getDisplayName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setStatus(User.UserStatus.ACTIVE);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        // 注意：这里应该从当前登录用户获取，暂时设为null
        // user.setCreatedBy(currentUser);
        // user.setUpdatedBy(currentUser);
        
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }
    
    /**
     * 更新用户信息
     */
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        User user = userOpt.get();
        user.setDisplayName(request.getDisplayName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setStatus(request.getStatus());
        user.setUpdatedAt(LocalDateTime.now());
        // user.setUpdatedBy(currentUser);
        
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }
    
    /**
     * 重置用户密码
     */
    @PutMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id, @RequestBody ResetPasswordRequest request) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        User user = userOpt.get();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        // user.setUpdatedBy(currentUser);
        
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 删除用户
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        // 先删除用户角色关联
        userRoleRepository.deleteByUserId(id);
        
        // 再删除用户
        userRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 获取用户的角色
     */
    @GetMapping("/{id}/roles")
    public ResponseEntity<List<Role>> getUserRoles(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        // 使用Repository查询用户角色
        List<Role> roles = userRepository.findUserRoles(id);
        return ResponseEntity.ok(roles);
    }
    
    /**
     * 为用户分配角色
     */
    @PostMapping("/{id}/roles")
    public ResponseEntity<Void> assignRole(@PathVariable Long id, @RequestBody AssignRoleRequest request) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        User user = userOpt.get();
        
        // 支持批量分配角色
        if (request.getRoleIds() == null || request.getRoleIds().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        for (Long roleId : request.getRoleIds()) {
            if (roleId == null) {
                continue; // 跳过null值
            }
            
            Optional<Role> roleOpt = roleRepository.findById(roleId);
            if (roleOpt.isEmpty()) {
                continue; // 跳过不存在的角色
            }
            
            // 检查是否已经分配了该角色
            if (userRoleRepository.existsByUserIdAndRoleId(id, roleId)) {
                continue; // 跳过已分配的角色
            }
            
            UserRole userRole = new UserRole();
            userRole.setUser(user);
            userRole.setRole(roleOpt.get());
            userRole.setCreatedAt(LocalDateTime.now());
            // userRole.setCreatedBy(currentUser);
            
            userRoleRepository.save(userRole);
        }
        
        return ResponseEntity.ok().build();
    }
    
    /**
     * 移除用户角色
     */
    @DeleteMapping("/{id}/roles/{roleId}")
    @Transactional
    public ResponseEntity<Void> removeRole(@PathVariable Long id, @PathVariable Long roleId) {
        System.out.println("删除用户角色: userId=" + id + ", roleId=" + roleId);
        
        // 检查用户是否存在
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            System.out.println("用户不存在: " + id);
            return ResponseEntity.notFound().build();
        }
        
        // 检查角色关联是否存在
        boolean exists = userRoleRepository.existsByUserIdAndRoleId(id, roleId);
        if (!exists) {
            System.out.println("用户角色关联不存在: userId=" + id + ", roleId=" + roleId);
            return ResponseEntity.notFound().build();
        }
        
        userRoleRepository.deleteByUserIdAndRoleId(id, roleId);
        System.out.println("用户角色删除成功: userId=" + id + ", roleId=" + roleId);
        return ResponseEntity.ok().build();
    }
    
    // DTO类
    public static class CreateUserRequest {
        private String username;
        private String password;
        private String displayName;
        private String email;
        private String phone;
        
        // Getters and Setters
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
    }
    
    public static class UpdateUserRequest {
        private String displayName;
        private String email;
        private String phone;
        private User.UserStatus status;
        
        // Getters and Setters
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        public User.UserStatus getStatus() { return status; }
        public void setStatus(User.UserStatus status) { this.status = status; }
    }
    
    public static class ResetPasswordRequest {
        private String newPassword;
        
        // Getters and Setters
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
    }
    
    public static class AssignRoleRequest {
        private List<Long> roleIds;
        
        // Getters and Setters
        public List<Long> getRoleIds() { return roleIds; }
        public void setRoleIds(List<Long> roleIds) { this.roleIds = roleIds; }
    }
}

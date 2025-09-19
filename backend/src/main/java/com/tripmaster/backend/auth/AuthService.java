package com.tripmaster.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 认证服务
 */
@Service
@Transactional
public class AuthService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private RoleRepository roleRepository;
    
    @Autowired
    private PermissionRepository permissionRepository;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    
    /**
     * 用户登录
     */
    public LoginResponse login(String username, String password) {
        // 查找用户
        Optional<User> userOpt = userRepository.findByUsernameAndStatus(username, User.UserStatus.ACTIVE);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("用户名或密码错误");
        }
        
        User user = userOpt.get();
        
        // 验证密码
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("用户名或密码错误");
        }
        
        // 更新最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
        
        // 生成JWT Token
        String token = jwtUtil.generateToken(user);
        
        // 获取用户权限
        List<Permission> permissions = userRepository.findUserPermissions(user.getId());
        
        return new LoginResponse(token, user, permissions);
    }
    
    /**
     * 根据Token获取用户信息
     */
    public User getUserFromToken(String token) {
        try {
            Long userId = jwtUtil.getUserIdFromToken(token);
            return userRepository.findById(userId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * 检查用户是否有指定权限
     */
    public boolean hasPermission(Long userId, String permissionCode) {
        List<Permission> permissions = userRepository.findUserPermissions(userId);
        return permissions.stream()
                .anyMatch(p -> p.getCode().equals(permissionCode));
    }
    
    /**
     * 检查用户是否有指定模块的权限
     */
    public boolean hasModulePermission(Long userId, String module) {
        List<Permission> permissions = userRepository.findUserPermissions(userId);
        return permissions.stream()
                .anyMatch(p -> p.getModule().equals(module));
    }
    
    /**
     * 获取用户的所有权限
     */
    public List<Permission> getUserPermissions(Long userId) {
        return userRepository.findUserPermissions(userId);
    }
    
    /**
     * 创建用户
     */
    public User createUser(String username, String password, String displayName, String email, String phone) {
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("用户名已存在");
        }
        
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(displayName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setStatus(User.UserStatus.ACTIVE);
        
        return userRepository.save(user);
    }
    
    /**
     * 重置用户密码
     */
    public void resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
    
    /**
     * 登录响应DTO
     */
    public static class LoginResponse {
        private String token;
        private User user;
        private List<Permission> permissions;
        
        public LoginResponse(String token, User user, List<Permission> permissions) {
            this.token = token;
            this.user = user;
            this.permissions = permissions;
        }
        
        // Getters
        public String getToken() { return token; }
        public User getUser() { return user; }
        public List<Permission> getPermissions() { return permissions; }
    }
}

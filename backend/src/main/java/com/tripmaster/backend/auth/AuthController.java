package com.tripmaster.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 认证控制器
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    
    @Autowired
    private AuthService authService;
    
    /**
     * 用户登录
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            AuthService.LoginResponse response = authService.login(request.getUsername(), request.getPassword());
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("token", response.getToken());
            result.put("user", response.getUser());
            result.put("permissions", response.getPermissions());
            result.put("roles", response.getRoles());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }
    
    /**
     * 验证Token
     */
    @PostMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestBody TokenRequest request) {
        try {
            User user = authService.getUserFromToken(request.getToken());
            if (user == null) {
                Map<String, Object> result = new HashMap<>();
                result.put("valid", false);
                result.put("message", "Token无效或已过期");
                return ResponseEntity.ok(result);
            }
            
            List<Permission> permissions = authService.getUserPermissions(user.getId());
            List<Role> roles = authService.getUserRoles(user.getId());
            
            Map<String, Object> result = new HashMap<>();
            result.put("valid", true);
            result.put("user", user);
            result.put("permissions", permissions);
            result.put("roles", roles);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("valid", false);
            result.put("message", "Token验证失败");
            return ResponseEntity.ok(result);
        }
    }
    
    /**
     * 检查权限
     */
    @PostMapping("/check-permission")
    public ResponseEntity<?> checkPermission(@RequestBody PermissionCheckRequest request) {
        try {
            User user = authService.getUserFromToken(request.getToken());
            if (user == null) {
                Map<String, Object> result = new HashMap<>();
                result.put("hasPermission", false);
                result.put("message", "用户未登录");
                return ResponseEntity.ok(result);
            }
            
            boolean hasPermission = authService.hasPermission(user.getId(), request.getPermissionCode());
            
            Map<String, Object> result = new HashMap<>();
            result.put("hasPermission", hasPermission);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("hasPermission", false);
            result.put("message", "权限检查失败");
            return ResponseEntity.ok(result);
        }
    }
    
    /**
     * 登录请求DTO
     */
    public static class LoginRequest {
        private String username;
        private String password;
        
        // Getters and Setters
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
    
    /**
     * Token请求DTO
     */
    public static class TokenRequest {
        private String token;
        
        // Getters and Setters
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
    }
    
    /**
     * 权限检查请求DTO
     */
    public static class PermissionCheckRequest {
        private String token;
        private String permissionCode;
        
        // Getters and Setters
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getPermissionCode() { return permissionCode; }
        public void setPermissionCode(String permissionCode) { this.permissionCode = permissionCode; }
    }
}

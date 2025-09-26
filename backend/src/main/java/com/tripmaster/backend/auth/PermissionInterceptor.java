package com.tripmaster.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 权限验证拦截器
 */
@Component
public class PermissionInterceptor implements HandlerInterceptor {
    
    @Autowired
    private AuthService authService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserRepository userRepository;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) throws Exception {
        // 只处理Controller方法
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        
        HandlerMethod handlerMethod = (HandlerMethod) handler;
        RequirePermission requirePermission = handlerMethod.getMethodAnnotation(RequirePermission.class);
        
        // 如果没有权限注解，直接通过
        if (requirePermission == null) {
            return true;
        }
        
        // 获取Authorization头
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return handlePermissionDenied(response, "未提供认证令牌");
        }
        
        String token = authHeader.substring(7);
        
        // 验证Token并获取用户
        User user = authService.getUserFromToken(token);
        if (user == null) {
            return handlePermissionDenied(response, "认证令牌无效或已过期");
        }
        
        // 超级管理员直接通过
        if (isSuperAdmin(user)) {
            return true;
        }
        
        // 获取用户权限
        List<Permission> userPermissions = authService.getUserPermissions(user.getId());
        List<String> permissionCodes = userPermissions.stream()
                .map(Permission::getCode)
                .toList();
        
        // 检查权限
        boolean hasPermission = checkPermission(requirePermission, permissionCodes);
        
        if (!hasPermission) {
            return handlePermissionDenied(response, requirePermission.message());
        }
        
        return true;
    }
    
    /**
     * 检查用户权限
     */
    private boolean checkPermission(RequirePermission requirePermission, List<String> userPermissions) {
        // 检查单个权限
        if (!requirePermission.value().isEmpty()) {
            return userPermissions.contains(requirePermission.value());
        }
        
        // 检查任意权限（anyOf）
        if (requirePermission.anyOf().length > 0) {
            return Arrays.stream(requirePermission.anyOf())
                    .anyMatch(userPermissions::contains);
        }
        
        // 检查全部权限（allOf）
        if (requirePermission.allOf().length > 0) {
            return Arrays.stream(requirePermission.allOf())
                    .allMatch(userPermissions::contains);
        }
        
        return false;
    }
    
    /**
     * 检查是否为超级管理员
     */
    private boolean isSuperAdmin(User user) {
        List<Role> userRoles = userRepository.findUserRoles(user.getId());
        return userRoles.stream()
                .anyMatch(role -> "SUPER_ADMIN".equals(role.getCode()));
    }
    
    /**
     * 处理权限拒绝
     */
    private boolean handlePermissionDenied(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", message);
        result.put("code", 403);
        
        response.getWriter().write(objectMapper.writeValueAsString(result));
        return false;
    }
    
}

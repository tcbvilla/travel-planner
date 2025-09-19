package com.tripmaster.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 用户数据访问接口
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    /**
     * 根据用户名查找用户
     */
    Optional<User> findByUsername(String username);
    
    /**
     * 根据用户名查找激活状态的用户
     */
    Optional<User> findByUsernameAndStatus(String username, User.UserStatus status);
    
    /**
     * 检查用户名是否存在
     */
    boolean existsByUsername(String username);
    
    /**
     * 根据状态查找用户列表
     */
    List<User> findByStatus(User.UserStatus status);
    
    /**
     * 查找用户的所有权限
     */
    @Query("SELECT DISTINCT p FROM User u " +
           "JOIN u.userRoles ur " +
           "JOIN ur.role r " +
           "JOIN r.rolePermissions rp " +
           "JOIN rp.permission p " +
           "WHERE u.id = :userId")
    List<Permission> findUserPermissions(@Param("userId") Long userId);
    
    /**
     * 查找用户的所有角色
     */
    @Query("SELECT r FROM User u " +
           "JOIN u.userRoles ur " +
           "JOIN ur.role r " +
           "WHERE u.id = :userId")
    List<Role> findUserRoles(@Param("userId") Long userId);
}

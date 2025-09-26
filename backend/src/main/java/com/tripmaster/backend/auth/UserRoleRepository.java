package com.tripmaster.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 用户角色关联表Repository
 */
@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, Long> {
    
    /**
     * 根据用户ID删除所有角色关联
     */
    void deleteByUserId(Long userId);
    
    /**
     * 根据用户ID和角色ID删除关联
     */
    void deleteByUserIdAndRoleId(Long userId, Long roleId);
    
    /**
     * 检查用户是否已分配指定角色
     */
    boolean existsByUserIdAndRoleId(Long userId, Long roleId);
    
    /**
     * 根据用户ID查找所有角色关联
     */
    List<UserRole> findByUserId(Long userId);
    
    /**
     * 根据角色ID查找所有用户关联
     */
    List<UserRole> findByRoleId(Long roleId);
}


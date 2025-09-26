package com.tripmaster.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 角色权限关联表Repository
 */
@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    
    /**
     * 根据角色ID删除所有权限关联
     */
    void deleteByRoleId(Long roleId);
    
    /**
     * 根据角色ID和权限ID删除关联
     */
    void deleteByRoleIdAndPermissionId(Long roleId, Long permissionId);
    
    /**
     * 检查角色是否已分配指定权限
     */
    boolean existsByRoleIdAndPermissionId(Long roleId, Long permissionId);
    
    /**
     * 根据角色ID查找所有权限关联
     */
    List<RolePermission> findByRoleId(Long roleId);
    
    /**
     * 根据权限ID查找所有角色关联
     */
    List<RolePermission> findByPermissionId(Long permissionId);
}



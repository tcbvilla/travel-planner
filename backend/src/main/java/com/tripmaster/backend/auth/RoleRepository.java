package com.tripmaster.backend.auth;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 角色数据访问接口
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    /**
     * 根据角色代码查找角色
     */
    Optional<Role> findByCode(String code);
    
    /**
     * 检查角色代码是否存在
     */
    boolean existsByCode(String code);
    
    /**
     * 查找角色的所有权限
     */
    @Query("SELECT p FROM Role r " +
           "JOIN r.rolePermissions rp " +
           "JOIN rp.permission p " +
           "WHERE r.id = :roleId")
    List<Permission> findRolePermissions(@Param("roleId") Long roleId);
    
    /**
     * 根据名称或描述搜索角色（分页）
     */
    @Query("SELECT r FROM Role r WHERE " +
           "LOWER(r.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(r.description) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Role> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(
        @Param("search") String search1, 
        @Param("search") String search2, 
        Pageable pageable);
}

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
 * 权限数据访问接口
 */
@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    
    /**
     * 根据权限代码查找权限
     */
    Optional<Permission> findByCode(String code);
    
    /**
     * 根据模块查找权限列表
     */
    List<Permission> findByModule(String module);
    
    /**
     * 根据模块和资源查找权限列表
     */
    List<Permission> findByModuleAndResource(String module, String resource);
    
    /**
     * 查找所有模块列表
     */
    @Query("SELECT DISTINCT p.module FROM Permission p ORDER BY p.module")
    List<String> findAllModules();
    
    /**
     * 查找指定模块下的所有资源
     */
    @Query("SELECT DISTINCT p.resource FROM Permission p WHERE p.module = :module ORDER BY p.resource")
    List<String> findResourcesByModule(@Param("module") String module);
    
    /**
     * 根据名称或描述搜索权限（分页）
     */
    @Query("SELECT p FROM Permission p WHERE " +
           "LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Permission> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(
        @Param("search") String search1, 
        @Param("search") String search2, 
        Pageable pageable);
    
    /**
     * 查找所有权限模块
     */
    @Query("SELECT DISTINCT p.module FROM Permission p ORDER BY p.module")
    List<String> findDistinctModules();
}

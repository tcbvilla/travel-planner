package com.tripmaster.backend.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 权限验证注解
 * 用于标注Controller方法所需的权限
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequirePermission {
    
    /**
     * 所需权限代码
     */
    String value() default "";
    
    /**
     * 所需权限代码列表（满足任意一个即可）
     */
    String[] anyOf() default {};
    
    /**
     * 所需权限代码列表（必须全部满足）
     */
    String[] allOf() default {};
    
    /**
     * 权限验证失败时的错误消息
     */
    String message() default "权限不足";
}


import React from 'react';
import { useAuth } from '../auth/AuthContext';

interface PermissionWrapperProps {
  children: React.ReactNode;
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  module?: string;
  fallback?: React.ReactNode;
  showIfNoPermission?: boolean;
}

/**
 * 权限包装组件
 * 根据用户权限显示或隐藏子组件
 */
const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  children,
  permission,
  anyOf = [],
  allOf = [],
  module,
  fallback = null,
  showIfNoPermission = false
}) => {
  const { checkPermission, hasModulePermission, permissions } = useAuth();

  // 检查权限
  const hasAccess = (): boolean => {
    // 超级管理员直接通过
    const isSuperAdmin = permissions.some(p => p.code === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return true;
    }

    // 检查单个权限
    if (permission && checkPermission(permission)) {
      return true;
    }

    // 检查任意权限（anyOf）
    if (anyOf.length > 0 && anyOf.some(p => checkPermission(p))) {
      return true;
    }

    // 检查全部权限（allOf）
    if (allOf.length > 0 && allOf.every(p => checkPermission(p))) {
      return true;
    }

    // 检查模块权限
    if (module && hasModulePermission(module)) {
      return true;
    }

    return false;
  };

  const hasPermission = hasAccess();

  // 如果设置了showIfNoPermission，则权限不足时显示，有权限时隐藏
  if (showIfNoPermission) {
    return hasPermission ? <>{fallback}</> : <>{children}</>;
  }

  // 正常模式：有权限时显示，无权限时显示fallback
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

export default PermissionWrapper;


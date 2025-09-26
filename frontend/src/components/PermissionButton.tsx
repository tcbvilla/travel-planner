import React from 'react';
import { useAuth } from '../auth/AuthContext';

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  module?: string;
  children: React.ReactNode;
  disabledMessage?: string;
  showIfNoPermission?: boolean;
}

/**
 * 权限按钮组件
 * 根据用户权限启用或禁用按钮
 */
const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  anyOf = [],
  allOf = [],
  module,
  children,
  disabledMessage = '权限不足',
  showIfNoPermission = false,
  disabled,
  onClick,
  style,
  ...props
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
  const isDisabled = disabled || (!hasPermission && !showIfNoPermission);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      e.preventDefault();
      if (!hasPermission && disabledMessage) {
        alert(disabledMessage);
      }
      return;
    }
    onClick?.(e);
  };

  const buttonStyle: React.CSSProperties = {
    ...style,
    opacity: isDisabled ? 0.6 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
  };

  return (
    <button
      {...props}
      disabled={isDisabled}
      onClick={handleClick}
      style={buttonStyle}
      title={isDisabled && !hasPermission ? disabledMessage : undefined}
    >
      {children}
    </button>
  );
};

export default PermissionButton;


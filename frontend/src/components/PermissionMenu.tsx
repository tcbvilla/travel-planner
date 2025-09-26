import React from 'react';
import { useAuth } from '../auth/AuthContext';

interface MenuItem {
  key: string;
  label: string;
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  module?: string;
  onClick?: () => void;
  children?: MenuItem[];
}

interface PermissionMenuProps {
  items: MenuItem[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 权限菜单组件
 * 根据用户权限显示或隐藏菜单项
 */
const PermissionMenu: React.FC<PermissionMenuProps> = ({ items, className, style }) => {
  const { checkPermission, hasModulePermission, permissions } = useAuth();

  // 检查权限
  const hasAccess = (item: MenuItem): boolean => {
    // 超级管理员直接通过
    const isSuperAdmin = permissions.some(p => p.code === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return true;
    }

    // 检查单个权限
    if (item.permission && checkPermission(item.permission)) {
      return true;
    }

    // 检查任意权限（anyOf）
    if (item.anyOf && item.anyOf.length > 0 && item.anyOf.some(p => checkPermission(p))) {
      return true;
    }

    // 检查全部权限（allOf）
    if (item.allOf && item.allOf.length > 0 && item.allOf.every(p => checkPermission(p))) {
      return true;
    }

    // 检查模块权限
    if (item.module && hasModulePermission(item.module)) {
      return true;
    }

    return false;
  };

  // 渲染菜单项
  const renderMenuItem = (item: MenuItem) => {
    if (!hasAccess(item)) {
      return null;
    }

    return (
      <div key={item.key} className="menu-item">
        <div
          className="menu-item-label"
          onClick={item.onClick}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '14px',
            borderBottom: '1px solid #444',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#555';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {item.label}
        </div>
        {item.children && item.children.length > 0 && (
          <div className="submenu" style={{ marginLeft: '16px' }}>
            {item.children.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className} style={style}>
      {items.map(renderMenuItem)}
    </div>
  );
};

export default PermissionMenu;


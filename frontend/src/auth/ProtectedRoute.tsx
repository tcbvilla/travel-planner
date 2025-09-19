import React, { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredModule?: string;
  fallback?: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission, 
  requiredModule,
  fallback 
}) => {
  const { isAuthenticated, isLoading, checkPermission, hasModulePermission } = useAuth();

  // 加载中
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#fff',
        fontSize: '16px'
      }}>
        加载中...
      </div>
    );
  }

  // 未认证
  if (!isAuthenticated) {
    return fallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#fff',
        fontSize: '16px'
      }}>
        请先登录
      </div>
    );
  }

  // 检查特定权限
  if (requiredPermission && !checkPermission(requiredPermission)) {
    return fallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#ff6b6b',
        fontSize: '16px'
      }}>
        没有访问权限
      </div>
    );
  }

  // 检查模块权限
  if (requiredModule && !hasModulePermission(requiredModule)) {
    return fallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#ff6b6b',
        fontSize: '16px'
      }}>
        没有访问权限
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

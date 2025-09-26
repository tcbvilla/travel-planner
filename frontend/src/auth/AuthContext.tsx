import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import API_ENDPOINTS from '../config/api';

// 角色接口
export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
}

// 用户信息接口
export interface User {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  roles?: Role[];
}

// 权限信息接口
export interface Permission {
  id: number;
  code: string;
  name: string;
  module: string;
  resource: string;
  action: string;
  description?: string;
}

// 认证上下文接口
interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkPermission: (permissionCode: string) => boolean;
  hasModulePermission: (module: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  isSuperAdmin: () => boolean;
  hasRole: (roleCode: string) => boolean;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证提供者组件
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查是否已认证
  const isAuthenticated = !!user && !!token;

  // 从localStorage恢复认证状态
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      validateToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // 验证Token
  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.VALIDATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToValidate }),
      });

      const data = await response.json();
      
      if (data.valid) {
        // 将角色信息添加到用户对象中
        const userWithRoles = {
          ...data.user,
          roles: data.roles || []
        };
        setUser(userWithRoles);
        setPermissions(data.permissions || []);
        setToken(tokenToValidate);
        localStorage.setItem('authToken', tokenToValidate);
      } else {
        // Token无效，清除本地存储
        localStorage.removeItem('authToken');
        setUser(null);
        setPermissions([]);
        setToken(null);
      }
    } catch (error) {
      console.error('Token验证失败:', error);
      localStorage.removeItem('authToken');
      setUser(null);
      setPermissions([]);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 登录
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 将角色信息添加到用户对象中
        const userWithRoles = {
          ...data.user,
          roles: data.roles || []
        };
        setUser(userWithRoles);
        setPermissions(data.permissions || []);
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        return true;
      } else {
        alert(data.message || '登录失败');
        return false;
      }
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败，请检查网络连接');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const logout = () => {
    setUser(null);
    setPermissions([]);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  // 检查权限
  const checkPermission = (permissionCode: string): boolean => {
    return permissions.some(p => p.code === permissionCode);
  };

  // 检查模块权限
  const hasModulePermission = (module: string): boolean => {
    return permissions.some(p => p.module === module);
  };

  // 检查是否有任意一个权限
  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => checkPermission(code));
  };

  // 检查是否有全部权限
  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    return permissionCodes.every(code => checkPermission(code));
  };

  // 检查是否为超级管理员
  const isSuperAdmin = (): boolean => {
    return permissions.some(p => p.code === 'SUPER_ADMIN');
  };

  // 检查是否有指定角色
  const hasRole = (_roleCode: string): boolean => {
    if (!user?.roles) return false;
    return user.roles.some(role => role.code === _roleCode);
  };

  const value: AuthContextType = {
    user,
    permissions,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkPermission,
    hasModulePermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 使用认证上下文的Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};

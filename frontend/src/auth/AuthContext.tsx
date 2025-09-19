import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
      const response = await fetch('http://localhost:8080/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToValidate }),
      });

      const data = await response.json();
      
      if (data.valid) {
        setUser(data.user);
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
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
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

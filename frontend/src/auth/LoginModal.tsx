import React, { useState } from 'react';
import { useAuth } from './AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(username.trim(), password);
      if (success) {
        onClose();
        setUsername('');
        setPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setUsername('');
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '30px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        <h2 style={{
          color: '#fff',
          margin: '0 0 20px 0',
          textAlign: 'center',
          fontSize: '24px'
        }}>
          用户登录
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#fff',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #555',
                borderRadius: '4px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>
          
          <div style={{ marginBottom: '30px' }}>
            <label style={{
              display: 'block',
              color: '#fff',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #555',
                borderRadius: '4px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="请输入密码"
            />
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                padding: '12px 24px',
                border: '1px solid #555',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#007bff',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;

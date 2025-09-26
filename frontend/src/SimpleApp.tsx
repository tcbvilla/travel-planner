import React from 'react'
import { AuthProvider } from './auth/AuthContext'

function SimpleApp() {
  return (
    <AuthProvider>
      <div style={{ 
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        padding: '20px'
      }}>
        <h1>游戏考勤统计系统</h1>
        <p>如果您能看到这个页面，说明应用运行正常。</p>
        <p>当前时间: {new Date().toLocaleString()}</p>
      </div>
    </AuthProvider>
  )
}

export default SimpleApp

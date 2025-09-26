import React from 'react'

function TestApp() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1>测试页面</h1>
      <p>如果您能看到这个页面，说明前端运行正常。</p>
      <p>当前时间: {new Date().toLocaleString()}</p>
    </div>
  )
}

export default TestApp

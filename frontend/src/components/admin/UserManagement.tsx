import React, { useState, useEffect } from 'react'
import { useAuth } from '../../auth/AuthContext'

interface User {
  id: number
  username: string
  displayName: string
  email: string
  phone?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  roles?: Role[]
}

interface Role {
  id: number
  code: string
  name: string
  description: string
}

interface Permission {
  id: number
  code: string
  name: string
  module: string
  resource: string
  action: string
  description: string
}

interface CreateUserRequest {
  username: string
  password: string
  displayName: string
  email: string
  phone?: string
}

interface UserManagementProps {
  activeSubTab: 'users' | 'roles'
  setActiveSubTab: (tab: 'users' | 'roles') => void
}

const UserManagement: React.FC<UserManagementProps> = ({ activeSubTab, setActiveSubTab }) => {
  const { token } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [userRoles, setUserRoles] = useState<Role[]>([])
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [resetPasswordForm, setResetPasswordForm] = useState({
    userId: 0,
    username: '',
    newPassword: ''
  })

  // 创建用户表单状态
  const [createUserForm, setCreateUserForm] = useState<CreateUserRequest>({
    username: '',
    password: '',
    displayName: '',
    email: '',
    phone: ''
  })

  // 创建角色表单状态
  const [createRoleForm, setCreateRoleForm] = useState({
    code: '',
    name: '',
    description: ''
  })

  // 加载用户列表
  const loadUsers = async () => {
    if (!token) {
      console.error('没有token，无法加载用户列表')
      return
    }
    
    console.log('开始加载用户列表，token:', token.substring(0, 20) + '...')
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/users/with-roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const usersWithRoles = await response.json()
        console.log('获取到的用户数据:', usersWithRoles)
        setUsers(usersWithRoles)
      } else {
        setError('加载用户列表失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 加载角色列表
  const loadRoles = async () => {
    if (!token) return
    
    try {
      const response = await fetch('/api/auth/roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setRoles(data.content || data)
        setAvailableRoles(data.content || data)
      } else {
        setError('加载角色列表失败')
      }
    } catch (err) {
      setError('网络错误')
    }
  }

  // 加载角色权限
  const loadRolePermissions = async (roleId: number) => {
    if (!token) return
    
    try {
      const response = await fetch(`/api/auth/roles/${roleId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setRolePermissions(data)
      } else {
        console.error('加载角色权限失败:', response.status, response.statusText)
        setRolePermissions([])
      }
    } catch (err) {
      console.error('加载角色权限失败:', err)
      setRolePermissions([])
    }
  }

  // 获取超级管理员的所有权限
  const getSuperAdminPermissions = () => {
    return availablePermissions
  }

  // 加载所有权限
  const loadAllPermissions = async () => {
    if (!token) return
    
    try {
      const response = await fetch('/api/auth/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailablePermissions(data.content || data)
      } else {
        console.error('加载权限列表失败:', response.status, response.statusText)
        setAvailablePermissions([])
      }
    } catch (err) {
      console.error('加载权限列表失败:', err)
      setAvailablePermissions([])
    }
  }

  // 为角色添加权限
  const addPermissionToRole = async (roleId: number, permissionId: number) => {
    if (!token) return
    
    try {
      console.log(`为角色 ${roleId} 添加权限 ${permissionId}`)
      const response = await fetch(`/api/auth/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissionId: permissionId })
      })
      
      if (response.ok) {
        console.log('权限添加成功')
        await loadRolePermissions(roleId)
        await loadAllPermissions() // 重新加载所有权限以更新可用权限列表
      } else {
        const errorText = await response.text()
        console.error('添加权限失败:', errorText)
        setError('添加权限失败')
      }
    } catch (err) {
      console.error('网络错误:', err)
      setError('网络错误')
    }
  }

  // 从角色移除权限
  const removePermissionFromRole = async (roleId: number, permissionId: number) => {
    if (!token) return
    
    try {
      console.log(`从角色 ${roleId} 移除权限 ${permissionId}`)
      const response = await fetch(`/api/auth/roles/${roleId}/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        console.log('权限移除成功')
        await loadRolePermissions(roleId)
        await loadAllPermissions() // 重新加载所有权限以更新可用权限列表
      } else {
        const errorText = await response.text()
        console.error('移除权限失败:', errorText)
        setError('移除权限失败')
      }
    } catch (err) {
      console.error('网络错误:', err)
      setError('网络错误')
    }
  }

  // 重置用户密码
  const resetUserPassword = async () => {
    if (!token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/auth/users/${resetPasswordForm.userId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword: resetPasswordForm.newPassword })
      })
      
      if (response.ok) {
        console.log('密码重置成功')
        setShowResetPasswordModal(false)
        setResetPasswordForm({ userId: 0, username: '', newPassword: '' })
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.message || '密码重置失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 打开重置密码弹窗
  const openResetPasswordModal = (user: User) => {
    setResetPasswordForm({
      userId: user.id,
      username: user.username,
      newPassword: ''
    })
    setShowResetPasswordModal(true)
  }

  // 创建用户
  const createUser = async () => {
    if (!token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createUserForm)
      })
      
      if (response.ok) {
        setShowCreateUserModal(false)
        setCreateUserForm({
          username: '',
          password: '',
          displayName: '',
          email: '',
          phone: ''
        })
        await loadUsers()
      } else {
        const errorData = await response.json()
        setError(errorData.message || '创建用户失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 创建角色
  const createRole = async () => {
    if (!token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/roles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createRoleForm)
      })
      
      if (response.ok) {
        setShowCreateRoleModal(false)
        setCreateRoleForm({
          code: '',
          name: '',
          description: ''
        })
        await loadRoles()
      } else {
        const errorData = await response.json()
        setError(errorData.message || '创建角色失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 删除角色
  const deleteRole = async (roleId: number) => {
    if (!token) return
    
    if (!confirm('确定要删除这个角色吗？此操作不可撤销。')) {
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/auth/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        await loadRoles()
        alert('角色删除成功')
      } else {
        const errorData = await response.json()
        setError(errorData.message || '删除角色失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 加载用户角色
  const loadUserRoles = async (userId: number) => {
    if (!token) {
      console.error('没有token，无法加载用户角色')
      return
    }
    
    console.log(`正在加载用户 ${userId} 的角色信息`)
    
    try {
      const response = await fetch(`/api/auth/users/${userId}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`用户 ${userId} 的角色数据:`, data)
        setUserRoles(data)
      } else {
        console.error(`加载用户 ${userId} 角色失败:`, response.status, response.statusText)
        setUserRoles([])
      }
    } catch (err) {
      console.error('加载用户角色失败:', err)
      setUserRoles([])
    }
  }

  // 为用户分配角色（如果已有角色则先移除再分配）
  const assignRoleToUser = async (userId: number, roleId: number) => {
    if (!token) return
    
    try {
      setError(null)
      
      // 如果用户已经有角色，先移除现有角色
      if (userRoles.length > 0) {
        console.log('移除现有角色:', userRoles[0].id)
        const removeResponse = await fetch(`/api/auth/users/${userId}/roles/${userRoles[0].id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!removeResponse.ok) {
          console.error('移除角色失败')
          setError('移除现有角色失败')
          return
        }
      }
      
      // 分配新角色
      console.log('分配新角色:', roleId)
      const response = await fetch(`/api/auth/users/${userId}/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roleIds: [roleId] })
      })
      
      if (response.ok) {
        await loadUserRoles(userId)
        // 更新用户列表中的角色信息
        await loadUsers()
        console.log('角色分配成功')
      } else {
        const errorText = await response.text()
        console.error('分配角色失败:', errorText)
        setError('分配角色失败')
      }
    } catch (err) {
      console.error('网络错误:', err)
      setError('网络错误')
    }
  }

  // 移除用户角色
  const removeUserRole = async (userId: number, roleId: number, refresh: boolean = true) => {
    if (!token) return
    
    try {
      setError(null)
      console.log('移除用户角色:', userId, roleId)
      
      const response = await fetch(`/api/auth/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        console.log('角色移除成功')
        if (refresh) {
          await loadUserRoles(userId)
          // 更新用户列表中的角色信息
          await loadUsers()
        }
      } else {
        const errorText = await response.text()
        console.error('移除角色失败:', errorText)
        setError('移除角色失败')
      }
    } catch (err) {
      console.error('网络错误:', err)
      setError('网络错误')
    }
  }

  useEffect(() => {
    if (activeSubTab === 'users') {
      loadUsers()
    } else if (activeSubTab === 'roles') {
      loadRoles()
    }
  }, [activeSubTab, token])

  useEffect(() => {
    if (selectedUser) {
      console.log('选中用户:', selectedUser)
      loadUserRoles(selectedUser.id)
    } else {
      console.log('没有选中用户')
      setUserRoles([])
    }
  }, [selectedUser])

  useEffect(() => {
    if (selectedRole) {
      console.log('选中角色:', selectedRole)
      loadRolePermissions(selectedRole.id)
      loadAllPermissions()
    } else {
      console.log('没有选中角色')
      setRolePermissions([])
      setAvailablePermissions([])
    }
  }, [selectedRole])

  console.log('UserManagement组件渲染，selectedUser:', selectedUser)
  
  return (
    <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>用户管理</h2>
      
      {/* 子菜单 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveSubTab('users')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeSubTab === 'users' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeSubTab === 'users' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          用户管理
        </button>
        <button
          onClick={() => setActiveSubTab('roles')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeSubTab === 'roles' ? '#007bff' : '#555555',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeSubTab === 'roles' ? 'bold' : 'normal',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
        >
          角色管理
        </button>
      </div>

      {error && (
        <div style={{ 
          background: '#dc3545', 
          color: '#fff', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          {error}
        </div>
      )}

      {/* 用户管理标签页 */}
      {activeSubTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#fff', margin: 0 }}>用户列表</h3>
            <button
              onClick={() => setShowCreateUserModal(true)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: '#28a745',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '4px'
              }}
            >
              创建用户
            </button>
          </div>

          {loading ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>加载中...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#3d3d3d' }}>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>ID</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>用户名</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>显示名称</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>邮箱</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>当前角色</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>状态</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    console.log('渲染用户行:', user.username, '是否admin:', user.username === 'admin')
                    return (
                      <tr key={user.id} style={{ background: selectedUser?.id === user.id ? '#4a4a4a' : '#2d2d2d' }}>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{user.id}</td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{user.username}</td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{user.displayName}</td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{user.email}</td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>
                          {user.roles && user.roles.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: role.code === 'SUPER_ADMIN' ? '#dc3545' : 
                                              role.code === 'MANAGER' ? '#ffc107' : 
                                              role.code === 'USER' ? '#28a745' : '#6c757d',
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#999', fontSize: '12px' }}>未分配角色</span>
                          )}
                        </td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            background: user.status === 'ACTIVE' ? '#28a745' : '#dc3545',
                            fontSize: '12px'
                          }}>
                            {user.status === 'ACTIVE' ? '活跃' : '停用'}
                          </span>
                        </td>
                        <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>
                          {user.username !== 'admin' ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => {
                                  console.log('点击管理角色按钮，用户:', user)
                                  setSelectedUser(user)
                                }}
                                style={{
                                  padding: '4px 8px',
                                  border: 'none',
                                  background: '#007bff',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  zIndex: 1000,
                                  position: 'relative'
                                }}
                              >
                                管理角色
                              </button>
                              <button
                                onClick={() => openResetPasswordModal(user)}
                                style={{
                                  padding: '4px 8px',
                                  border: 'none',
                                  background: '#ffc107',
                                  color: '#000',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  zIndex: 1000,
                                  position: 'relative'
                                }}
                              >
                                重置密码
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#999', fontSize: '12px' }}>超级管理员</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 用户角色管理弹窗 */}
          {selectedUser && (
            console.log('渲染角色管理弹窗，selectedUser:', selectedUser),
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000
            }}>
              <div style={{
                background: '#2d2d2d',
                padding: '20px',
                borderRadius: '8px',
                width: '500px',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}>
                <h3 style={{ color: '#fff', marginBottom: '20px' }}>
                  管理用户角色 - {selectedUser.displayName}
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '10px' }}>当前角色:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {userRoles.length > 0 ? (
                      userRoles.map((role) => (
                        <span key={role.id} style={{
                          background: '#007bff',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999', fontSize: '14px' }}>未分配角色</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '10px' }}>
                    {userRoles.length > 0 ? '更改角色:' : '分配角色:'}
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {availableRoles.filter(role => !userRoles.some(ur => ur.id === role.id)).map((role) => (
                      <button
                        key={role.id}
                        onClick={() => assignRoleToUser(selectedUser.id, role.id)}
                        style={{
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {userRoles.length > 0 ? '更改为 ' : '+ '}{role.name}
                      </button>
                    ))}
                  </div>
                  {userRoles.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => removeUserRole(selectedUser.id, userRoles[0].id)}
                        style={{
                          background: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        移除当前角色
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedUser(null)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #6c757d',
                      background: 'transparent',
                      color: '#6c757d',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 角色管理标签页 */}
      {activeSubTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#fff', margin: 0 }}>角色列表</h3>
            <button
              onClick={() => setShowCreateRoleModal(true)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: '#28a745',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '4px'
              }}
            >
              创建角色
            </button>
          </div>

          {loading ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>加载中...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#3d3d3d' }}>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>ID</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>角色代码</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>角色名称</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>描述</th>
                    <th style={{ color: '#fff', padding: '12px', textAlign: 'left', border: '1px solid #555' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} style={{ background: '#2d2d2d' }}>
                      <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{role.id}</td>
                      <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{role.code}</td>
                      <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{role.name}</td>
                      <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>{role.description}</td>
                      <td style={{ color: '#fff', padding: '12px', border: '1px solid #555' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedRole(role)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              background: '#007bff',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              borderRadius: '4px'
                            }}
                          >
                            管理权限
                          </button>
                          <button
                            onClick={() => deleteRole(role.id)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              background: '#dc3545',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              borderRadius: '4px'
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 角色权限管理弹窗 */}
      {selectedRole && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '20px',
            borderRadius: '8px',
            width: '600px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>
              管理角色权限 - {selectedRole.name}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#fff', marginBottom: '10px' }}>当前权限:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(() => {
                  const displayPermissions = selectedRole.code === 'SUPER_ADMIN' ? getSuperAdminPermissions() : rolePermissions;
                  return displayPermissions.length > 0 ? (
                    displayPermissions.map((permission) => (
                      <span key={permission.id} style={{
                        background: selectedRole.code === 'SUPER_ADMIN' ? '#dc3545' : '#007bff',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {permission.name}
                        {selectedRole.code !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => removePermissionFromRole(selectedRole.id, permission.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '10px',
                              padding: '0',
                              marginLeft: '4px'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999', fontSize: '14px' }}>未分配权限</span>
                  );
                })()}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#fff', marginBottom: '10px' }}>可用权限:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedRole.code === 'SUPER_ADMIN' ? (
                  <span style={{ color: '#999', fontSize: '14px' }}>超级管理员拥有所有权限，无需添加</span>
                ) : (
                  availablePermissions.filter(permission => !rolePermissions.some(rp => rp.id === permission.id)).map((permission) => (
                    <button
                      key={permission.id}
                      onClick={() => addPermissionToRole(selectedRole.id, permission.id)}
                      style={{
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      + {permission.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSelectedRole(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #6c757d',
                  background: 'transparent',
                  color: '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建用户弹窗 */}
      {showCreateUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '20px',
            borderRadius: '8px',
            width: '400px'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>创建新用户</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>用户名:</label>
              <input
                type="text"
                value={createUserForm.username}
                onChange={(e) => setCreateUserForm({...createUserForm, username: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>密码:</label>
              <input
                type="password"
                value={createUserForm.password}
                onChange={(e) => setCreateUserForm({...createUserForm, password: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>显示名称:</label>
              <input
                type="text"
                value={createUserForm.displayName}
                onChange={(e) => setCreateUserForm({...createUserForm, displayName: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>邮箱:</label>
              <input
                type="email"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm({...createUserForm, email: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>手机号（可选）:</label>
              <input
                type="tel"
                value={createUserForm.phone}
                onChange={(e) => setCreateUserForm({...createUserForm, phone: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCreateUserModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #6c757d',
                  background: 'transparent',
                  color: '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                取消
              </button>
              <button
                onClick={createUser}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: loading ? '#6c757d' : '#28a745',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建角色弹窗 */}
      {showCreateRoleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '20px',
            borderRadius: '8px',
            width: '400px'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>创建新角色</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>角色代码:</label>
              <input
                type="text"
                value={createRoleForm.code}
                onChange={(e) => setCreateRoleForm({...createRoleForm, code: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
                placeholder="例如: MANAGER"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>角色名称:</label>
              <input
                type="text"
                value={createRoleForm.name}
                onChange={(e) => setCreateRoleForm({...createRoleForm, name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
                placeholder="例如: 管理员"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>描述:</label>
              <textarea
                value={createRoleForm.description}
                onChange={(e) => setCreateRoleForm({...createRoleForm, description: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
                placeholder="角色描述..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCreateRoleModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #6c757d',
                  background: 'transparent',
                  color: '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                取消
              </button>
              <button
                onClick={createRole}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: loading ? '#6c757d' : '#28a745',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showResetPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#2d2d2d',
            padding: '20px',
            borderRadius: '8px',
            width: '400px'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>
              重置密码 - {resetPasswordForm.username}
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>新密码:</label>
              <input
                type="password"
                value={resetPasswordForm.newPassword}
                onChange={(e) => setResetPasswordForm({...resetPasswordForm, newPassword: e.target.value})}
                placeholder="请输入新密码"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #555',
                  background: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #6c757d',
                  background: 'transparent',
                  color: '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                取消
              </button>
              <button
                onClick={resetUserPassword}
                disabled={loading || !resetPasswordForm.newPassword.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: loading || !resetPasswordForm.newPassword.trim() ? '#6c757d' : '#ffc107',
                  color: loading || !resetPasswordForm.newPassword.trim() ? '#fff' : '#000',
                  cursor: loading || !resetPasswordForm.newPassword.trim() ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                {loading ? '重置中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement

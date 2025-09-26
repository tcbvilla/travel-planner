# 部署说明

## 🚨 重要：API地址配置问题

### 问题描述
前端代码中硬编码了 `localhost:8080` 的API地址，这在生产环境中会导致问题。

### 解决方案

#### 方案1：使用相对路径（推荐）
将所有的 `http://localhost:8080/api` 替换为 `/api`

#### 方案2：使用环境变量
1. 创建 `.env.production` 文件：
```bash
REACT_APP_API_URL=/api
```

2. 修改前端代码使用环境变量：
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
```

### 需要修改的文件
- `frontend/src/App.tsx` - 所有API调用
- `frontend/src/auth/AuthContext.tsx` - 认证相关API
- `frontend/src/components/admin/UserManagement.tsx` - 用户管理API

### 部署配置

#### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端API代理
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Apache配置示例
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/html
    
    # 前端路由支持
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
    
    # 后端API代理
    ProxyPreserveHost On
    ProxyPass /api/ http://localhost:8080/api/
    ProxyPassReverse /api/ http://localhost:8080/api/
</VirtualHost>
```

### 部署步骤

1. **修改前端代码**：将所有 `http://localhost:8080` 替换为相对路径
2. **配置Web服务器**：设置API代理
3. **重新构建前端**：`npm run build`
4. **部署到服务器**：上传构建文件到Web服务器
5. **测试API调用**：确保前后端通信正常

### 验证方法
1. 打开浏览器开发者工具
2. 查看Network标签页
3. 确认API请求使用的是相对路径（如 `/api/auth/login`）
4. 检查请求是否成功返回数据


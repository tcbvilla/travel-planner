# 云部署指南

## 概述

本指南介绍如何将游戏考勤系统部署到各种云服务提供商。

## 支持的云服务提供商

- **AWS** - Amazon Web Services
- **Azure** - Microsoft Azure
- **GCP** - Google Cloud Platform
- **阿里云** - Alibaba Cloud
- **本地部署** - Docker Compose

## 部署前准备

### 1. 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 云服务提供商 CLI 工具
- 有效的云服务账户

### 2. 配置文件

复制环境变量配置文件：
```bash
cp env.example .env
```

编辑 `.env` 文件，配置生产环境参数：
```bash
# 数据库配置
DATABASE_PASSWORD=your_secure_password
POSTGRES_PASSWORD=your_secure_password

# 云服务配置
CLOUD_PROVIDER=aws
REGION=us-east-1
DOMAIN_NAME=your-domain.com
```

## 快速部署

### 本地部署
```bash
./deploy-cloud.sh local prod
```

### AWS 部署
```bash
# 配置 AWS CLI
aws configure

# 部署到生产环境
./deploy-cloud.sh aws prod
```

### Azure 部署
```bash
# 登录 Azure
az login

# 部署到生产环境
./deploy-cloud.sh azure prod
```

### Google Cloud 部署
```bash
# 登录 Google Cloud
gcloud auth login

# 部署到生产环境
./deploy-cloud.sh gcp prod
```

### 阿里云部署
```bash
# 配置阿里云 CLI
aliyun configure

# 部署到生产环境
./deploy-cloud.sh aliyun prod
```

## 详细部署步骤

### 1. 构建镜像

```bash
# 构建后端镜像
docker build -t game-attendance-backend:latest ./backend

# 构建前端镜像
docker build -t game-attendance-frontend:latest ./frontend
```

### 2. 启动服务

```bash
# 使用生产环境配置启动
docker-compose -f docker-compose.prod.yml up -d
```

### 3. 健康检查

```bash
# 检查后端健康状态
curl http://localhost:8080/actuator/health

# 检查前端健康状态
curl http://localhost/health
```

## 云服务特定配置

### AWS 部署

#### 使用 ECS (推荐生产环境)
```bash
# 创建 ECS 集群
aws ecs create-cluster --cluster-name game-attendance

# 创建任务定义
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# 创建服务
aws ecs create-service --cluster game-attendance --service-name game-attendance-service --task-definition game-attendance:1 --desired-count 1
```

#### 使用 EC2
```bash
# 启动 EC2 实例
aws ec2 run-instances --image-id ami-0c02fb55956c7d316 --instance-type t3.medium --key-name your-key-pair

# 安装 Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# 部署应用
./deploy-cloud.sh aws prod
```

### Azure 部署

#### 使用 Container Instances
```bash
# 创建资源组
az group create --name game-attendance-rg --location eastus

# 创建容器实例
az container create --resource-group game-attendance-rg --name game-attendance --image game-attendance-backend:latest --ports 8080
```

#### 使用 App Service
```bash
# 创建应用服务计划
az appservice plan create --name game-attendance-plan --resource-group game-attendance-rg --sku B1 --is-linux

# 创建 Web 应用
az webapp create --resource-group game-attendance-rg --plan game-attendance-plan --name game-attendance-app --deployment-container-image-name game-attendance-backend:latest
```

### Google Cloud 部署

#### 使用 Cloud Run
```bash
# 构建并推送镜像到 Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/game-attendance-backend ./backend

# 部署到 Cloud Run
gcloud run deploy --image gcr.io/PROJECT_ID/game-attendance-backend --platform managed --region us-central1 --allow-unauthenticated
```

#### 使用 GKE
```bash
# 创建 GKE 集群
gcloud container clusters create game-attendance-cluster --num-nodes=3 --zone=us-central1-a

# 部署应用
kubectl apply -f k8s/
```

## 监控和日志

### 应用监控
- **健康检查**: `http://your-domain/actuator/health`
- **指标监控**: `http://your-domain/actuator/metrics`
- **应用信息**: `http://your-domain/actuator/info`

### 日志查看
```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 云服务监控
- **AWS**: CloudWatch
- **Azure**: Application Insights
- **GCP**: Cloud Monitoring
- **阿里云**: 云监控

## 备份和恢复

### 数据库备份
```bash
# 创建备份
docker exec game_attendance_postgres_prod pg_dump -U postgres game_attendance > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复备份
docker exec -i game_attendance_postgres_prod psql -U postgres game_attendance < backup_20250101_120000.sql
```

### 自动备份
```bash
# 设置定时备份（crontab）
0 2 * * * /path/to/backup-script.sh
```

## 安全配置

### SSL/TLS 配置
```bash
# 使用 Let's Encrypt 获取免费 SSL 证书
certbot --nginx -d your-domain.com

# 或使用云服务提供商的 SSL 证书服务
```

### 防火墙配置
```bash
# 只开放必要端口
# 80 (HTTP)
# 443 (HTTPS)
# 22 (SSH, 仅管理需要)
```

### 环境变量安全
- 使用云服务提供商的密钥管理服务
- 不要在代码中硬编码敏感信息
- 定期轮换密码和密钥

## 故障排除

### 常见问题

#### 1. 服务无法启动
```bash
# 检查日志
docker-compose -f docker-compose.prod.yml logs

# 检查端口占用
netstat -tulpn | grep :8080
```

#### 2. 数据库连接失败
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml ps postgres

# 检查网络连接
docker-compose -f docker-compose.prod.yml exec backend ping postgres
```

#### 3. 前端无法访问后端
```bash
# 检查 nginx 配置
docker-compose -f docker-compose.prod.yml exec frontend cat /etc/nginx/conf.d/default.conf

# 检查后端健康状态
curl http://backend:8080/actuator/health
```

### 性能优化

#### 1. 数据库优化
- 配置连接池
- 添加索引
- 定期清理日志

#### 2. 应用优化
- 启用 gzip 压缩
- 配置缓存
- 使用 CDN

#### 3. 资源优化
- 调整容器资源限制
- 使用多副本部署
- 配置自动扩缩容

## 联系信息

如有部署相关问题，请联系开发团队。

---

**最后更新**: 2025-01-01  
**维护者**: 开发团队

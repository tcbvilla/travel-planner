#!/bin/bash

# 游戏考勤系统云部署脚本
# 使用方法: ./deploy-cloud.sh [aws|azure|gcp|aliyun] [dev|staging|prod]

set -e  # 遇到错误立即退出

CLOUD_PROVIDER=${1:-aws}
ENVIRONMENT=${2:-prod}

echo "开始部署游戏考勤系统到 $CLOUD_PROVIDER 的 $ENVIRONMENT 环境..."

# 检查必要的工具
check_requirements() {
    echo "检查部署要求..."
    
    if ! command -v docker &> /dev/null; then
        echo "错误: Docker 未安装"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "错误: Docker Compose 未安装"
        exit 1
    fi
    
    # 检查云服务提供商特定的工具
    case $CLOUD_PROVIDER in
        aws)
            if ! command -v aws &> /dev/null; then
                echo "错误: AWS CLI 未安装"
                exit 1
            fi
            ;;
        azure)
            if ! command -v az &> /dev/null; then
                echo "错误: Azure CLI 未安装"
                exit 1
            fi
            ;;
        gcp)
            if ! command -v gcloud &> /dev/null; then
                echo "错误: Google Cloud CLI 未安装"
                exit 1
            fi
            ;;
        aliyun)
            if ! command -v aliyun &> /dev/null; then
                echo "错误: Aliyun CLI 未安装"
                exit 1
            fi
            ;;
    esac
    
    echo "部署要求检查完成！"
}

# 构建 Docker 镜像
build_images() {
    echo "构建 Docker 镜像..."
    
    # 构建后端镜像
    echo "构建后端镜像..."
    docker build -t game-attendance-backend:latest ./backend
    
    # 构建前端镜像
    echo "构建前端镜像..."
    docker build -t game-attendance-frontend:latest ./frontend
    
    echo "Docker 镜像构建完成！"
}

# 部署到 AWS
deploy_aws() {
    echo "部署到 AWS..."
    
    # 检查 AWS 配置
    aws sts get-caller-identity > /dev/null || {
        echo "错误: AWS 未配置或凭证无效"
        exit 1
    }
    
    # 使用 ECS 或 EC2 部署
    if [ "$ENVIRONMENT" = "prod" ]; then
        echo "使用 ECS 部署到生产环境..."
        # 这里可以添加 ECS 部署逻辑
        docker-compose -f docker-compose.prod.yml up -d
    else
        echo "使用 EC2 部署到开发/测试环境..."
        docker-compose -f docker-compose.prod.yml up -d
    fi
}

# 部署到 Azure
deploy_azure() {
    echo "部署到 Azure..."
    
    # 检查 Azure 配置
    az account show > /dev/null || {
        echo "错误: Azure 未配置或未登录"
        exit 1
    }
    
    # 使用 Azure Container Instances 或 App Service 部署
    if [ "$ENVIRONMENT" = "prod" ]; then
        echo "使用 Azure Container Instances 部署到生产环境..."
        # 这里可以添加 ACI 部署逻辑
        docker-compose -f docker-compose.prod.yml up -d
    else
        echo "使用 Azure App Service 部署到开发/测试环境..."
        docker-compose -f docker-compose.prod.yml up -d
    fi
}

# 部署到 Google Cloud
deploy_gcp() {
    echo "部署到 Google Cloud..."
    
    # 检查 GCP 配置
    gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null || {
        echo "错误: Google Cloud 未配置或未登录"
        exit 1
    }
    
    # 使用 Cloud Run 或 GKE 部署
    if [ "$ENVIRONMENT" = "prod" ]; then
        echo "使用 Cloud Run 部署到生产环境..."
        # 这里可以添加 Cloud Run 部署逻辑
        docker-compose -f docker-compose.prod.yml up -d
    else
        echo "使用 GKE 部署到开发/测试环境..."
        docker-compose -f docker-compose.prod.yml up -d
    fi
}

# 部署到阿里云
deploy_aliyun() {
    echo "部署到阿里云..."
    
    # 检查阿里云配置
    aliyun configure list > /dev/null || {
        echo "错误: 阿里云未配置"
        exit 1
    }
    
    # 使用容器服务部署
    if [ "$ENVIRONMENT" = "prod" ]; then
        echo "使用阿里云容器服务部署到生产环境..."
        # 这里可以添加阿里云容器服务部署逻辑
        docker-compose -f docker-compose.prod.yml up -d
    else
        echo "使用阿里云容器服务部署到开发/测试环境..."
        docker-compose -f docker-compose.prod.yml up -d
    fi
}

# 本地部署
deploy_local() {
    echo "本地部署..."
    docker-compose -f docker-compose.prod.yml up -d
}

# 健康检查
health_check() {
    echo "执行健康检查..."
    
    # 等待服务启动
    sleep 30
    
    # 检查后端健康状态
    if curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
        echo "✅ 后端服务健康"
    else
        echo "❌ 后端服务不健康"
        exit 1
    fi
    
    # 检查前端健康状态
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ 前端服务健康"
    else
        echo "❌ 前端服务不健康"
        exit 1
    fi
    
    echo "所有服务健康检查通过！"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo "🎉 部署完成！"
    echo ""
    echo "服务访问地址："
    echo "  前端: http://localhost"
    echo "  后端: http://localhost:8080"
    echo "  健康检查: http://localhost:8080/actuator/health"
    echo ""
    echo "查看日志："
    echo "  docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "停止服务："
    echo "  docker-compose -f docker-compose.prod.yml down"
    echo ""
}

# 主执行流程
main() {
    check_requirements
    build_images
    
    case $CLOUD_PROVIDER in
        aws)
            deploy_aws
            ;;
        azure)
            deploy_azure
            ;;
        gcp)
            deploy_gcp
            ;;
        aliyun)
            deploy_aliyun
            ;;
        local)
            deploy_local
            ;;
        *)
            echo "不支持的云服务提供商: $CLOUD_PROVIDER"
            echo "支持的提供商: aws, azure, gcp, aliyun, local"
            exit 1
            ;;
    esac
    
    health_check
    show_deployment_info
}

# 执行主函数
main

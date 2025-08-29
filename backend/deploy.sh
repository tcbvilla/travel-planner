#!/bin/bash

# 游戏考勤系统快速部署脚本
# 使用方法: ./deploy.sh [dev|prod]

set -e  # 遇到错误立即退出

ENVIRONMENT=${1:-dev}
DB_NAME="game_attendance"
DB_USER="postgres"
DB_HOST="localhost"

echo "开始部署游戏考勤系统到 $ENVIRONMENT 环境..."

# 检查PostgreSQL是否运行
if ! pg_isready -h $DB_HOST -U $DB_USER > /dev/null 2>&1; then
    echo "错误: PostgreSQL未运行，请先启动PostgreSQL"
    exit 1
fi

# 备份现有数据库（如果存在）
if psql -h $DB_HOST -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "备份现有数据库..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > $BACKUP_FILE
    echo "数据库已备份到: $BACKUP_FILE"
fi

# 创建数据库（如果不存在）
if ! psql -h $DB_HOST -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "创建数据库 $DB_NAME..."
    createdb -h $DB_HOST -U $DB_USER $DB_NAME
fi

# 执行数据库初始化脚本
echo "执行数据库初始化脚本..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database_init.sql

echo "数据库初始化完成！"

# 根据环境选择不同的启动方式
if [ "$ENVIRONMENT" = "prod" ]; then
    echo "生产环境部署..."
    # 编译项目
    ./mvnw clean package -DskipTests
    
    # 启动应用
    echo "启动应用..."
    java -jar target/backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
else
    echo "开发环境部署..."
    # 启动应用
    echo "启动应用..."
    ./mvnw spring-boot:run
fi

echo "部署完成！"

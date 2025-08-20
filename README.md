# 智能旅行规划系统（第一阶段）

## 开发环境
- Node.js >= 18（推荐 20）和 npm
- Java 17 与 Maven 3.9+
- 可选：Docker Desktop（用于本地 PG/Redis/MinIO 等）

## 项目结构
- frontend: Vite + React + TypeScript
- backend: Spring Boot 3.2 + Maven + Java 17

## 快速开始
### 前端
```bash
cd frontend
npm install
npm run dev
```

### 后端
```bash
cd backend
mvn spring-boot:run
```

### 本地依赖服务（可选）
```bash
# 在项目根目录
cp .env.example .env
docker compose up -d
```

## CI（GitHub Actions）
- 后端：Maven 构建
- 前端：Vite 构建

## 约定
- 提交前保持代码可构建
- 新模块按层次结构放置，保持命名一致

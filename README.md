# 酒店管理系统 (Hotel Management System)

本项目是一款为中小型酒店设计的现代化数字化管理方案，采用前后端分离架构，旨在提升酒店运营效率并优化客户体验。

## 🚀 核心功能

- **控制面板 (Dashboard)**：实时查看今日预订、入住率及营收等核心指标。
- **客房管理 (Room Management)**：灵活维护客房类型、价格及实时状态（空闲、占用、维修）。
- **预订与订单管理 (Booking Management)**：全流程处理客户预订请求，支持入住登记、退房办理。
- **住客管理 (Guest Management)**：详尽记录住客信息及其历史消费记录。
- **系统设置**：管理酒店基础配置及员工权限。

## 🛠️ 技术栈

### 后端 (Backend)
- **核心框架**: Java 17 + Spring 5.3 + Spring MVC
- **持久层**: MyBatis 3.5 + Druid 连接池
- **数据库**: MySQL 8.0
- **构建工具**: Maven 3.6+
- **其他**: Lombok, Jackson (JSON 处理)

### 前端 (Frontend)
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router 7
- **图标**: Lucide React

## 📂 项目结构

```text
Hotel/
├── backend/                # 后端源码 (SSM 架构)
│   ├── src/main/java       # Java 业务逻辑
│   ├── src/main/resources  # Spring/MyBatis 配置及 SQL 映射
│   ├── sql/                # 数据库初始化脚本 (init.sql)
│   └── pom.xml             # Maven 依赖配置
├── frontend/               # 前端源码 (React + Vite)
│   ├── src/                # 页面、组件、状态管理等
│   ├── tailwind.config.js  # 样式配置
│   └── package.json        # 前端依赖及脚本
└── .trae/documents/        # 项目设计文档 (PRD & 架构设计)
```

## ⚙️ 快速开始

### 1. 数据库准备
1. 确保已安装 MySQL 8.0。
2. 执行 `backend/sql/init.sql` 脚本初始化数据库表结构及初始数据。
3. 在 `backend/src/main/resources/db.properties` 中配置您的数据库连接信息。

### 2. 启动后端
1. 进入 `backend` 目录。
2. 使用 Maven 构建项目：
   ```bash
   mvn clean package
   ```
3. 将生成的 `target/hotel-api.war` 部署至 Tomcat 9+ 容器中。

### 3. 启动前端
1. 进入 `frontend` 目录。
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```
4. 访问 `http://localhost:5173` 即可查看系统。

## 📝 架构设计参考
更多详细的设计细节（如 API 定义、ER 图等），请参考：
- [产品需求文档 (PRD)](.trae/documents/prd.md)
- [技术架构说明](.trae/documents/technical-architecture.md)

---
*Powered by Trae IDE*
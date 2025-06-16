# Render 部署指南

## 1. 准备工作

### 1.1 创建 render.yaml
在项目根目录创建 `render.yaml` 文件：

```yaml
services:
  - type: web
    name: carbon-price-api
    env: go
    buildCommand: go build -o main ./cmd/server
    startCommand: ./main
    envVars:
      - key: PORT
        value: 10000
```

### 1.2 确保项目结构
```
backend/
├── cmd/
│   └── server/
│       └── main.go
├── pkg/
│   ├── crawler/
│   ├── logger/
│   ├── storage/
│   └── types/
├── go.mod
├── go.sum
└── render.yaml
```

## 2. 部署步骤

### 2.1 创建 Render 账号
1. 访问 [Render 官网](https://render.com)
2. 使用 GitHub 账号登录

### 2.2 连接 GitHub 仓库
1. 在 Render 控制台点击 "New +"
2. 选择 "Web Service"
3. 选择你的 GitHub 仓库
4. 选择要部署的分支

### 2.3 配置服务
1. 名称：`carbon-price-api`（或你想要的名称）
2. 环境：`Go`
3. 构建命令：`go build -o main ./cmd/server`
4. 启动命令：`./main`
5. 环境变量：
   - `PORT`: 10000（Render 要求）

### 2.4 高级配置
1. 自动部署：开启
2. 健康检查路径：`/health`
3. 实例类型：选择适合的配置
   - 免费版：512MB RAM
   - 付费版：根据需求选择

## 3. 环境变量配置

### 3.1 必需的环境变量
```bash
PORT=10000
```

### 3.2 可选的环境变量
```bash
GIN_MODE=release  # 生产环境模式
```

## 4. 部署后检查

### 4.1 检查服务状态
1. 访问 Render 控制台
2. 查看部署日志
3. 检查服务状态是否为 "Live"

### 4.2 测试 API 接口
```bash
# 健康检查
curl https://your-app-name.onrender.com/health

# 获取价格数据
curl https://your-app-name.onrender.com/api/carbon-price

# 获取监控指标
curl https://your-app-name.onrender.com/metrics
```

## 5. 常见问题

### 5.1 部署失败
- 检查构建日志
- 确认 Go 版本兼容性
- 验证项目结构是否正确

### 5.2 服务无法启动
- 检查端口配置
- 查看应用日志
- 确认环境变量设置

### 5.3 性能问题
- 检查实例配置
- 优化代码性能
- 考虑升级实例类型

## 6. 维护建议

### 6.1 日常维护
1. 定期检查日志
2. 监控服务状态
3. 更新依赖包

### 6.2 更新部署
1. 推送代码到 GitHub
2. Render 自动部署
3. 验证新版本

### 6.3 备份策略
1. 定期备份数据
2. 保存配置文件
3. 记录部署历史

## 7. 监控和告警

### 7.1 内置监控
- 使用 `/metrics` 接口
- 查看 Render 控制台
- 检查健康状态

### 7.2 设置告警
1. 配置健康检查告警
2. 设置错误率告警
3. 监控响应时间

## 8. 安全建议

### 8.1 基本安全
1. 使用 HTTPS
2. 配置 CORS
3. 限制 API 访问

### 8.2 高级安全
1. 添加 API 认证
2. 设置请求限制
3. 启用 WAF

## 9. 成本优化

### 9.1 免费版限制
- 512MB RAM
- 共享 CPU
- 每月 750 小时运行时间

### 9.2 升级建议
- 根据流量选择配置
- 考虑使用付费版
- 优化资源使用

## 10. 联系支持

- Render 支持：[support@render.com](mailto:support@render.com)
- 文档：[Render Docs](https://render.com/docs)
- 状态页面：[Render Status](https://status.render.com) 
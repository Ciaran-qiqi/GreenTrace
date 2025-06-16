# 碳价数据 API 部署文档

## 项目说明

本项目是一个碳价数据 API 服务，提供以下功能：
- 获取最新碳价数据
- 获取历史碳价数据
- 手动触发数据更新
- 健康检查和监控指标

## 环境要求

### 系统要求
- 操作系统：Linux/Windows/macOS
- Go 版本：1.16 或更高版本
- 内存：至少 512MB
- 磁盘空间：至少 100MB

### 依赖项
- Go 标准库
- 第三方包：
  - github.com/gin-gonic/gin
  - github.com/robfig/cron/v3

## 部署步骤

### 1. 获取代码
```bash
git clone <项目地址>
cd <项目目录>
```

### 2. 编译项目
```bash
# 在项目根目录下执行
go build -o carbon-api ./cmd/server
```

### 3. 运行服务
```bash
# 直接运行
./carbon-api

# 或者使用 nohup 在后台运行
nohup ./carbon-api > carbon-api.log 2>&1 &
```

### 4. 使用 Docker 部署（可选）
```bash
# 构建 Docker 镜像
docker build -t carbon-api .

# 运行容器
docker run -d -p 5000:5000 --name carbon-api carbon-api
```

## 配置说明

### 端口配置
- 默认端口：5000
- 可以通过环境变量修改：
  ```bash
  export PORT=8080
  ```

### 更新频率
- 自动更新：每12小时（0:00 和 12:00）
- 手动更新：通过 API 触发

## API 接口说明

### 1. 获取最新价格
- 接口：`GET /api/carbon-price`
- 说明：获取最新的碳价数据
- 示例：
  ```bash
  curl http://localhost:5000/api/carbon-price
  ```

### 2. 获取历史数据
- 接口：`GET /api/carbon-price/history`
- 说明：获取历史碳价数据
- 示例：
  ```bash
  curl http://localhost:5000/api/carbon-price/history
  ```

### 3. 手动更新数据
- 接口：`POST /api/carbon-price/update`
- 说明：手动触发数据更新
- 示例：
  ```bash
  curl -X POST http://localhost:5000/api/carbon-price/update
  ```

### 4. 健康检查
- 接口：`GET /health`
- 说明：检查服务健康状态
- 示例：
  ```bash
  curl http://localhost:5000/health
  ```

### 5. 监控指标
- 接口：`GET /metrics`
- 说明：获取服务监控指标
- 示例：
  ```bash
  curl http://localhost:5000/metrics
  ```

## 监控说明

### 健康检查
- 检查服务是否正常运行
- 返回基本状态信息
- 建议配置监控系统定期检查

### 监控指标
- 系统资源使用情况
- API 调用统计
- 响应时间统计
- 错误统计

## 日志说明

### 日志位置
- 控制台输出
- 日志文件（如果配置了文件日志）

### 日志级别
- INFO：常规操作日志
- ERROR：错误信息日志

## 故障排除

### 常见问题
1. 服务无法启动
   - 检查端口是否被占用
   - 检查权限是否正确
   - 检查依赖是否完整

2. 数据更新失败
   - 检查网络连接
   - 检查数据源是否可访问
   - 查看错误日志

3. API 响应超时
   - 检查系统资源使用情况
   - 检查网络连接
   - 查看监控指标

### 日志查看
```bash
# 查看实时日志
tail -f carbon-api.log

# 查看错误日志
grep ERROR carbon-api.log
```

## 维护说明

### 日常维护
1. 定期检查日志
2. 监控系统资源使用
3. 检查数据更新状态

### 更新部署
1. 停止当前服务
2. 备份数据（如果有）
3. 部署新版本
4. 启动服务
5. 验证服务状态

## 安全说明

### 安全建议
1. 使用 HTTPS
2. 配置防火墙
3. 限制 API 访问
4. 定期更新依赖

### 环境变量
- PORT：服务端口
- 其他配置项（如有）

## 联系支持

如有问题，请联系：
- 技术支持：[联系方式]
- 问题反馈：[问题反馈地址] 
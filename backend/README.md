├── cmd/              # 主程序入口
│   └── server/      # 服务器入口
├── pkg/             # 核心功能包
│   ├── crawler/     # 爬虫逻辑
│   ├── logger/      # 日志处理
│   ├── models/      # 数据模型
│   └── storage/     # 数据存储
├── data/            # 数据存储目录
├── logs/            # 日志文件目录
├── go.mod           # Go 模块定义
└── go.sum           # 依赖版本锁定

我们目前有三个 API 端点：

1. 获取最新价格

* 路径：GET /api/carbon-price
* 功能：获取最新的碳价格信息
* 返回：
* 成功：200 状态码，包含价格信息
* 失败：404 状态码，错误信息

1. 获取历史记录

* 路径：GET /api/carbon-price/history
* 功能：获取所有历史价格记录
* 返回：200 状态码，历史价格列表

1. 手动更新价格

* 路径：POST /api/carbon-price/update
* 功能：手动触发价格更新
* 返回：
* 成功：200 状态码，更新后的价格信息
* 失败：500 状态码，错误信息

所有 API 都支持跨域访问（CORS），并且都有详细的日志记录。

您可以通过以下方式测试这些 API：1. 使用浏览器访问 http://localhost:5000/api/carbon-price

1. 使用 Postman 或其他 API 测试工具
2. 使用 curl 命令，例如：

   bash

   Apply to README.md

   Run

   **   **curl** http://localhost:5000/api/carbon-price

   **   **curl** http://localhost:5000/api/carbon-price/history

   **   curl -X POST http://localhost:5000/api/carbon-price/update

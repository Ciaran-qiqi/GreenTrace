# GreenTrace API 接口文档

## 基础信息

- 基础URL: `https://greentrace-api.onrender.com`
- 所有接口返回 JSON 格式
- 支持 CORS 跨域访问
- 响应时间: 通常在 100ms 以内

## 接口列表

### 1. 获取最新碳价

```http
GET /api/carbon-price
```

#### 响应示例
```json
{
    "price": 75.94,
    "date": "June 13, 2025",
    "dailyChange": 0.73,
    "monthlyChange": 4.99,
    "yearlyChange": 10.81,
    "lastUpdated": "2025-06-16T05:05:15Z"
}
```

#### 前端调用示例
```javascript
// 使用 fetch
fetch('https://greentrace-api.onrender.com/api/carbon-price')
  .then(response => response.json())
  .then(data => console.log(data));

// 使用 axios
import axios from 'axios';

const getCarbonPrice = async () => {
  try {
    const response = await axios.get('https://greentrace-api.onrender.com/api/carbon-price');
    return response.data;
  } catch (error) {
    console.error('获取碳价失败:', error);
    throw error;
  }
};
```

#### Chainlink 接入
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";

contract CarbonPriceOracle is ChainlinkClient {
    using Chainlink for Chainlink.Request;
    
    uint256 public carbonPrice;
    bytes32 private jobId;
    uint256 private fee;
    
    constructor() {
        setChainlinkToken(0x779877A7B0D9E8603169DdbD7836e478b4624789); // Sepolia
        jobId = "jobId"; // 替换为实际的 jobId
        fee = 0.1 * 10 ** 18; // 0.1 LINK
    }
    
    function requestCarbonPrice() public {
        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillCarbonPrice.selector
        );
        
        req.add("get", "https://greentrace-api.onrender.com/api/carbon-price");
        req.add("path", "price");
        
        sendChainlinkRequest(req, fee);
    }
    
    function fulfillCarbonPrice(bytes32 _requestId, uint256 _price) public {
        carbonPrice = _price;
    }
}
```

### 2. 获取历史数据

```http
GET /api/carbon-price/history
```

#### 响应示例
```json
[
    {
        "price": 75.94,
        "date": "June 13, 2025",
        "dailyChange": 0.73,
        "monthlyChange": 4.99,
        "yearlyChange": 10.81,
        "lastUpdated": "2025-06-16T05:05:15Z"
    }
]
```

#### 前端调用示例
```javascript
// 使用 fetch
fetch('https://greentrace-api.onrender.com/api/carbon-price/history')
  .then(response => response.json())
  .then(data => {
    // 使用数据绘制图表
    const prices = data.map(item => item.price);
    const dates = data.map(item => item.date);
    // ... 绘制图表逻辑
  });

// 使用 axios
const getHistory = async () => {
  try {
    const response = await axios.get('https://greentrace-api.onrender.com/api/carbon-price/history');
    return response.data;
  } catch (error) {
    console.error('获取历史数据失败:', error);
    throw error;
  }
};
```

### 3. 手动更新数据

```http
POST /api/carbon-price/update
```

#### 响应示例
```json
{
    "message": "价格信息已更新",
    "data": {
        "price": 75.94,
        "date": "June 13, 2025",
        "dailyChange": 0.73,
        "monthlyChange": 4.99,
        "yearlyChange": 10.81,
        "lastUpdated": "2025-06-16T05:05:15Z"
    }
}
```

#### 前端调用示例
```javascript
// 使用 fetch
fetch('https://greentrace-api.onrender.com/api/carbon-price/update', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
})
.then(response => response.json())
.then(data => console.log(data));

// 使用 axios
const updatePrice = async () => {
  try {
    const response = await axios.post('https://greentrace-api.onrender.com/api/carbon-price/update');
    return response.data;
  } catch (error) {
    console.error('更新价格失败:', error);
    throw error;
  }
};
```

## 前端集成建议

1. 使用 axios 或 fetch 进行 API 调用
2. 实现错误处理和重试机制
3. 考虑使用缓存减少请求次数
4. 实现数据自动更新机制

完整的前端服务类示例：
```javascript
import axios from 'axios';

const API_BASE_URL = 'https://greentrace-api.onrender.com';

class CarbonPriceService {
    constructor() {
        this.axios = axios.create({
            baseURL: API_BASE_URL,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async getLatestPrice() {
        try {
            const response = await this.axios.get('/api/carbon-price');
            return response.data;
        } catch (error) {
            console.error('获取碳价失败:', error);
            throw error;
        }
    }

    async getHistory() {
        try {
            const response = await this.axios.get('/api/carbon-price/history');
            return response.data;
        } catch (error) {
            console.error('获取历史数据失败:', error);
            throw error;
        }
    }

    async updatePrice() {
        try {
            const response = await this.axios.post('/api/carbon-price/update');
            return response.data;
        } catch (error) {
            console.error('更新价格失败:', error);
            throw error;
        }
    }
}

export default new CarbonPriceService();
```

## Chainlink 集成建议

1. 使用 Chainlink 的 HTTP GET 适配器
2. 设置适当的更新间隔
3. 实现价格验证机制
4. 考虑使用多个数据源

完整的 Chainlink 合约示例：
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract CarbonPriceOracle is ChainlinkClient {
    using Chainlink for Chainlink.Request;
    
    uint256 public carbonPrice;
    bytes32 private jobId;
    uint256 private fee;
    
    // 事件
    event PriceUpdated(uint256 price, uint256 timestamp);
    
    constructor() {
        setChainlinkToken(0x779877A7B0D9E8603169DdbD7836e478b4624789); // Sepolia
        jobId = "jobId"; // 替换为实际的 jobId
        fee = 0.1 * 10 ** 18; // 0.1 LINK
    }
    
    function requestCarbonPrice() public {
        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillCarbonPrice.selector
        );
        
        req.add("get", "https://greentrace-api.onrender.com/api/carbon-price");
        req.add("path", "price");
        
        sendChainlinkRequest(req, fee);
    }
    
    function fulfillCarbonPrice(bytes32 _requestId, uint256 _price) public {
        carbonPrice = _price;
        emit PriceUpdated(_price, block.timestamp);
    }
    
    // 获取最新价格
    function getLatestPrice() public view returns (uint256) {
        return carbonPrice;
    }
}
```

## 错误处理

所有接口在发生错误时返回以下格式：

```json
{
    "error": "错误信息描述"
}
```

常见错误码：
- 404: 资源不存在
- 500: 服务器内部错误

## 安全建议

1. 在生产环境中使用 HTTPS
2. 实现请求频率限制
3. 添加 API 认证机制
4. 监控异常访问

## 性能优化

1. 使用缓存减少请求次数
2. 实现数据压缩
3. 使用 CDN 加速
4. 实现数据预加载

## 监控和告警

1. 使用 `/healthz` 接口监控服务状态
2. 使用 `/metrics` 接口监控性能指标
3. 设置错误告警阈值
4. 监控响应时间

## 更新日志

- 2024-03-21: 初始版本发布
- 2024-03-21: 添加健康检查接口
- 2024-03-21: 添加监控指标接口 
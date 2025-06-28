# GreenTrace 项目

## 项目介绍

GreenTrace 是一个基于区块链的碳减排项目，旨在通过 NFT 和碳币实现碳减排量的追踪和交易。项目包含以下核心合约：

- **CarbonToken**：碳币代币合约，实现 ERC20 标准，用于代表经过审计的碳减排量。
- **GreenTalesNFT**：绿色故事 NFT 合约，实现 ERC721 标准，用于记录和追踪碳减排项目。
- **GreenTrace**：主合约，负责碳减排项目的审计、NFT 兑换和费用分配。
- **GreenTalesAuction**：拍卖合约，支持需求征集和供应拍卖，用于碳减排项目的交易。


## 主要功能

1. **碳币生成**：通过销毁 NFT 兑换生成碳币，生成数量由审计结果决定。
2. **NFT 兑换**：将 NFT 兑换为碳币，并分配系统手续费、审计费用和兑换数量。
3. **审计管理**：添加/移除审计人员，提交和完成审计。
4. **拍卖功能**：支持需求征集和供应拍卖，用于碳减排项目的交易。

## 测试步骤

1. **安装依赖**：

   ```bash
   forge install
   ```
2. **编译合约**：

   ```bash
   forge build --via-ir --optimize
   ```
3. **运行测试**：

   ```bash
   forge test --match-path test/CarbonToken.t.sol -vvv --via-ir --optimize
   forge test --match-path test/GreenTrace.t.sol -vvv --via-ir --optimize
   forge test --match-path test/GreenTalesNFT.t.sol -vvv --via-ir --optimize
   forge test --match-path test/GreenTalesAuction.t.sol -vvv --via-ir --optimize
   ```

## 部署步骤

1. **设置环境变量**：
   在项目根目录创建 `.env` 文件，添加以下内容：

   ```
   PRIVATE_KEY=你的私钥
   ```
2. **运行部署脚本**：

   ```bash
   forge script script/Deploy.s.sol --rpc-url <你的RPC地址> --broadcast
   ```

## 注意事项

- 部署时，确保 CarbonToken 的 owner 是当前测试合约，先 setGreenTrace 再 transferOwnership。
- 测试时，确保所有合约的权限和业务逻辑都正确。

## 贡献

欢迎提交 Issue 和 Pull Request，一起完善 GreenTrace 项目！

# GreenTrace 碳币交易平台

## 前端订单簿数据处理示例

### JavaScript 排序示例

由于合约中的 `getOrderBook()` 和 `getOrderBookPaginated()` 函数不进行排序（为节省gas费用），前端需要自行处理排序逻辑：

```javascript
// 获取订单簿数据
async function getOrderBookData() {
    const [buyOrders, sellOrders] = await carbonMarket.getOrderBook();
    
    // 买单排序：按价格从高到低（价格优先的买单在前）
    const sortedBuyOrders = buyOrders.sort((a, b) => {
        const priceA = parseFloat(ethers.utils.formatUnits(a.price, 18));
        const priceB = parseFloat(ethers.utils.formatUnits(b.price, 18));
        return priceB - priceA; // 降序
    });
    
    // 卖单排序：按价格从低到高（价格优势的卖单在前）
    const sortedSellOrders = sellOrders.sort((a, b) => {
        const priceA = parseFloat(ethers.utils.formatUnits(a.price, 18));
        const priceB = parseFloat(ethers.utils.formatUnits(b.price, 18));
        return priceA - priceB; // 升序
    });
    
    return { buyOrders: sortedBuyOrders, sellOrders: sortedSellOrders };
}

// 分页获取数据（推荐，特别是订单量大时）
async function getOrderBookPaginated(offset = 0, limit = 20, orderType = 2) {
    // orderType: 0=买单, 1=卖单, 2=全部
    const [orders, hasMore] = await carbonMarket.getOrderBookPaginated(offset, limit, orderType);
    
    // 根据订单类型进行排序
    const sortedOrders = orders.sort((a, b) => {
        const priceA = parseFloat(ethers.utils.formatUnits(a.price, 18));
        const priceB = parseFloat(ethers.utils.formatUnits(b.price, 18));
        
        if (a.orderType === 0) { // 买单：价格高的在前
            return priceB - priceA;
        } else { // 卖单：价格低的在前
            return priceA - priceB;
        }
    });
    
    return { orders: sortedOrders, hasMore };
}

// 高级排序：支持多种排序方式
function sortOrders(orders, sortBy = 'price', order = 'desc') {
    return orders.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortBy) {
            case 'price':
                valueA = parseFloat(ethers.utils.formatUnits(a.price, 18));
                valueB = parseFloat(ethers.utils.formatUnits(b.price, 18));
                break;
            case 'amount':
                valueA = parseFloat(ethers.utils.formatUnits(a.remainingAmount, 18));
                valueB = parseFloat(ethers.utils.formatUnits(b.remainingAmount, 18));
                break;
            case 'timestamp':
                valueA = a.timestamp.toNumber();
                valueB = b.timestamp.toNumber();
                break;
            case 'total':
                valueA = parseFloat(ethers.utils.formatUnits(a.price, 18)) * parseFloat(ethers.utils.formatUnits(a.remainingAmount, 18));
                valueB = parseFloat(ethers.utils.formatUnits(b.price, 18)) * parseFloat(ethers.utils.formatUnits(b.remainingAmount, 18));
                break;
            default:
                return 0;
        }
        
        if (order === 'desc') {
            return valueB - valueA;
        } else {
            return valueA - valueB;
        }
    });
}

// 实际使用示例
async function displayOrderBook() {
    try {
        // 方法1：获取全部数据
        const { buyOrders, sellOrders } = await getOrderBookData();
        
        // 方法2：分页获取（推荐）
        const buyOrdersPage = await getOrderBookPaginated(0, 20, 0); // 买单
        const sellOrdersPage = await getOrderBookPaginated(0, 20, 1); // 卖单
        
        // 显示最优价格
        if (buyOrders.length > 0) {
            console.log('最高买价:', ethers.utils.formatUnits(buyOrders[0].price, 18));
        }
        if (sellOrders.length > 0) {
            console.log('最低卖价:', ethers.utils.formatUnits(sellOrders[0].price, 18));
        }
        
        // 计算价差
        if (buyOrders.length > 0 && sellOrders.length > 0) {
            const bestBid = parseFloat(ethers.utils.formatUnits(buyOrders[0].price, 18));
            const bestAsk = parseFloat(ethers.utils.formatUnits(sellOrders[0].price, 18));
            const spread = bestAsk - bestBid;
            console.log('买卖价差:', spread.toFixed(4), 'USDT');
        }
        
    } catch (error) {
        console.error('获取订单簿数据失败:', error);
    }
}
```

### React组件示例

```jsx
import React, { useState, useEffect } from 'react';

const OrderBook = ({ contract }) => {
    const [buyOrders, setBuyOrders] = useState([]);
    const [sellOrders, setSellOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadOrderBook = async () => {
        setLoading(true);
        try {
            // 使用分页API
            const [buyOrdersData] = await contract.getOrderBookPaginated(0, 50, 0);
            const [sellOrdersData] = await contract.getOrderBookPaginated(0, 50, 1);

            // 排序
            const sortedBuyOrders = buyOrdersData
                .map(order => ({
                    ...order,
                    priceFormatted: parseFloat(ethers.utils.formatUnits(order.price, 18)),
                    amountFormatted: parseFloat(ethers.utils.formatUnits(order.remainingAmount, 18))
                }))
                .sort((a, b) => b.priceFormatted - a.priceFormatted);

            const sortedSellOrders = sellOrdersData
                .map(order => ({
                    ...order,
                    priceFormatted: parseFloat(ethers.utils.formatUnits(order.price, 18)),
                    amountFormatted: parseFloat(ethers.utils.formatUnits(order.remainingAmount, 18))
                }))
                .sort((a, b) => a.priceFormatted - b.priceFormatted);

            setBuyOrders(sortedBuyOrders);
            setSellOrders(sortedSellOrders);
        } catch (error) {
            console.error('加载订单簿失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrderBook();
        const interval = setInterval(loadOrderBook, 5000); // 每5秒刷新
        return () => clearInterval(interval);
    }, [contract]);

    return (
        <div className="order-book">
            <h3>订单簿</h3>
            {loading && <p>加载中...</p>}
            
            {/* 卖单区域 */}
            <div className="sell-orders">
                <h4>卖单 (Ask)</h4>
                {sellOrders.slice(0, 10).map((order, index) => (
                    <div key={index} className="order-row sell">
                        <span>{order.priceFormatted.toFixed(4)}</span>
                        <span>{order.amountFormatted.toFixed(2)}</span>
                        <span>{(order.priceFormatted * order.amountFormatted).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            {/* 价差显示 */}
            {buyOrders.length > 0 && sellOrders.length > 0 && (
                <div className="spread">
                    价差: {(sellOrders[0].priceFormatted - buyOrders[0].priceFormatted).toFixed(4)} USDT
                </div>
            )}

            {/* 买单区域 */}
            <div className="buy-orders">
                <h4>买单 (Bid)</h4>
                {buyOrders.slice(0, 10).map((order, index) => (
                    <div key={index} className="order-row buy">
                        <span>{order.priceFormatted.toFixed(4)}</span>
                        <span>{order.amountFormatted.toFixed(2)}</span>
                        <span>{(order.priceFormatted * order.amountFormatted).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrderBook;
```

## Gas费用优化效果

通过移除链上排序，我们实现了：

- **大幅降低gas费用**：原来O(n²)的排序算法被完全移除
- **更好的用户体验**：前端排序更快，更灵活
- **支持多种排序方式**：价格、数量、时间、总额等
- **分页支持**：处理大量订单时更高效

### 建议的最佳实践

1. **优先使用分页API**：`getOrderBookPaginated()` 
2. **前端缓存**：减少重复调用
3. **实时更新**：监听订单事件自动更新
4. **用户自定义排序**：提供多种排序选项

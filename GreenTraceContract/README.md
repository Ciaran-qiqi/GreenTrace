# GreenTrace 项目

## 项目介绍

GreenTrace 是一个基于区块链的碳减排项目，旨在通过 NFT 和碳币实现碳减排量的追踪和交易。项目包含以下核心合约：

- **CarbonToken**：碳币代币合约，实现 ERC20 标准，用于代表经过审计的碳减排量。
- **GreenTalesNFT**：绿色故事 NFT 合约，实现 ERC721 标准，用于记录和追踪碳减排项目。
- **GreenTrace**：主合约，负责碳减排项目的审计、NFT 兑换和费用分配。
- **GreenTalesAuction**：拍卖合约，支持需求征集和供应拍卖，用于碳减排项目的交易。

这是一个名为 GreenTrace 的智能合约项目，主要包含以下内容：

1. 主要合约文件（在 src 目录下）：

* GreenTrace.sol - 主合约文件
* CarbonToken.sol - 碳代币合约
* GreenTalesNFT.sol - NFT 合约
* GreenTalesAuction.sol - 拍卖合约

1. 对应的测试文件（在 test 目录下）：

* GreenTrace.t.sol
* CarbonToken.t.sol
* GreenTalesNFT.t.sol
* GreenTalesAuction.t.sol

1. 项目配置文件：

* foundry.toml - Foundry 框架配置文件
* .gitignore - Git 忽略文件配置
* .gitmodules - Git 子模块配置

1. 文档文件：

* README.md - 项目说明文档
* Programming\_Plan.md - 编程计划文档

1. 其他目录：

* cache/ - Foundry 缓存目录
* out/ - 编译输出目录
* script/ - 部署脚本目录
* lib/ - 依赖库目录
* .wake/ - Wake 工具配置目录
* .vscode/ - VS Code 配置目录
* .github/ - GitHub 配置目录

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

```


这是一个名为 GreenTrace 的智能合约项目，主要包含以下内容：
主要合约文件（在 src 目录下）：
GreenTrace.sol - 主合约文件
CarbonToken.sol - 碳代币合约
GreenTalesNFT.sol - NFT 合约
GreenTalesAuction.sol - 拍卖合约
对应的测试文件（在 test 目录下）：
GreenTrace.t.sol
CarbonToken.t.sol
GreenTalesNFT.t.sol
GreenTalesAuction.t.sol
项目配置文件：
foundry.toml - Foundry 框架配置文件
.gitignore - Git 忽略文件配置
.gitmodules - Git 子模块配置
文档文件：
README.md - 项目说明文档
Programming_Plan.md - 编程计划文档
其他目录：
cache/ - Foundry 缓存目录
out/ - 编译输出目录
script/ - 部署脚本目录
lib/ - 依赖库目录
.wake/ - Wake 工具配置目录
.vscode/ - VS Code 配置目录
.github/ - GitHub 配置目录
```

# 优化、问题和开发记录：

1.觉得合约可以随意mint和burn 代币比较不安全，而且先铸造一部分数量存着，最后审计和兑现的时候还要进行一次数量的判断，这样很呆

1.优化：优化了nft销毁时的逻辑，碳币的生成只能依靠nft的兑现，取消销毁逻辑，直接在审计的时候给对应钱包铸造新碳币

2.加入了nft二级交易市场

3.优化了测试逻辑，删去了minter机制，开发环境下采用主合约给业务合约白名单的形式，测试环境下给测试合约权限。

4：初始化逻辑有问题：我先部署nft，nft需要绑定主合约地址，我先部署主合约，主合约也要绑定nft地址  双向绑定了！！

部署到第二步时出现了新的报错：

Error: script failed: Invalid GreenTrace address

问题分析

* 日志显示 CarbonToken 已经部署成功，NFT 合约部署时失败，原因是 Invalid GreenTrace address。
* 这说明在部署 NFT 时，构造函数或初始化参数需要一个有效的 GreenTrace 地址，但传入了无效地址（如 0x0 或未设置）。

可能原因

* 你的 GreenTalesNFT 合约构造函数或初始化逻辑，要求必须传入一个有效的 GreenTrace 地址，不能为 0。
* 但在部署脚本中，NFT 合约是在 GreenTrace 合约部署之前部署的，所以无法传入有效的 GreenTrace 地址。

4：主合约地址有设定nft地址的权限，可以允许一开始是0，所以先部署greentrace，再部署nft，然后再调用主合约的setNFTContract，而token里面没有这种限制，，，然后你去掉了maket的初始化，感觉没什么用；

5然后优化了一下拍卖合约

tender合约逻辑有问题，我是征集人，是出钱的人，我招标人出一个初始的意向金，然后30%的招标押金，和招标完成截至时间，投标人不需要报价，投标人同意，投标人需要给20%的投标押金给合约，然后契约生效，投标人需要在截至时间内完成一个招标人环保项目(链下系统)，截止时间时，双方确认契约是否成功，有一方确认不成功的话，合约结束，一共50%的押金退还给平台，（后续平台链下决定分配和权限），成功的话双方退还押金，招标方把项目金给平台，平台给招标方一个环保故事的nft（后续和拍卖一样可兑换），然后平台扣除手续费2%后给投标项目方

6.加入了事件，后续肯定不可能批量查数组

7.tmd一直部署不成功，部署合约里乱七八糟的都不要，别搞太多 不接受的；但是全部搞完还是不能上链；我调高了gas费用也一直Error: Transaction dropped from the mempool:

整理所有合约的 Etherscan 链接：

1. CarbonToken

* 地址：0x6eF91f1d3A64eEC47278FA45f240dd6dd5D8fB39
* Etherscan：https://sepolia.etherscan.io/address/0x6ef91f1d3a64eec47278fa45f240dd6dd5d8fb39

1. GreenTrace

* 地址：0x9127167d979c346687ca61024c530e8C9abe71ae
* Etherscan：https://sepolia.etherscan.io/address/0x9127167d979c346687ca61024c530e8c9abe71ae

1. GreenTalesNFT

* 地址：0xA989A17406045db3327eBFBfacc2C52eA68be8a7
* Etherscan：https://sepolia.etherscan.io/address/0xa989a17406045db3327ebfbfacc2c52ea68be8a7

1. GreenTalesMarket

* 地址：0x2263C25a1e57db73fe5a74B280DCE079d22a1423
* Etherscan：https://sepolia.etherscan.io/address/0x2263c25a1e57db73fe5a74b280dce079d22a1423

1. GreenTalesAuction

* 地址：0x763873aBaaEf83FA33daeECBEB4701678654Cb69
* Etherscan：https://sepolia.etherscan.io/address/0x763873abaaef83fa33daeecbeb4701678654cb69

1. GreenTalesTender

* 地址：0x5F26e81C0Ff40050c1A5B6793f55b7791ef49adA
* Etherscan：https://sepolia.etherscan.io/address/0x5f26e81c0ff40050c1a5b6793f55b7791ef49ada

614 12

本地部署：

Private Key (使用 Anvil 默认账户)

LOCAL_PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

RPC

LOCAL_RPC_URL=http://localhost:8545

* CarbonToken: 0x5FbDB2315678afecb367f032d93F642f64180aa3
* GreenTrace: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
* NFT: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
* Market: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
* Auction: 0x2279B7A0a67DB3729967a5FaB50D91eAA73d2eBe6
* Tender: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318


最新部署617

CarbonToken: 0x48757B6E7Da7f9C5566C4f952dd7A78cd437d870
NFT: 0xE0fE62C8aF74A98C3B3cBd82AA277575CD244201
GreenTrace: 0x0FA9a4D2408C93cCA02743A1e06C51f1f5AC9d60
Market: 0x2c2C17487f765bc38603E73778D0dACa7d4C1f16

这是所有合约在 Sepolia 测试网上的区块链浏览器地址：

1. CarbonToken:

https://sepolia.etherscan.io/address/0x48757B6E7Da7f9C5566C4f952dd7A78cd437d870

1. GreenTalesNFT:

https://sepolia.etherscan.io/address/0xE0fE62C8aF74A98C3B3cBd82AA277575CD244201

1. GreenTrace:

https://sepolia.etherscan.io/address/0x0FA9a4D2408C93cCA02743A1e06C51f1f5AC9d60

1. GreenTalesMarket:

https://sepolia.etherscan.io/address/0x2c2C17487f765bc38603E73778D0dACa7d4C1f16

x.准备把不太清楚的审计拿出主合约

# 后续计划：

1. 审计人员必须有约束，比如质押，审计这部分其实和eth挖矿的逻辑很类似，可以借鉴pos的机制防止审计作恶
2. 目前项目还是面向大众的碳信用自愿市场，后续可以思考如何让企业把他们分配到的碳信用额度融入我们这个体系
3. 可以用碳币发起nft环保小项目，环保人来投标，之后实现一个环保故事，最后生成nft（用碳币买个nft期货，成功后交付nft现货）---代币招标环保故事
4. 也可以是现成的环保故事，环保人发起nft拍卖，拍卖成功铸造nft（把现实项目定价为nft现货）---环保故事招标代币
5. 拍卖和审计部分的合约，是否给链上带来了太多没必要记录的信息？是否信息记录在链下，我的nft信息肯定是链下系统记录的

感觉有问题待解决的部分：

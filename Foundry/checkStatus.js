// checkStatus.js
// 用于检查你部署在 Sepolia 测试网上的五个合约的初始化和权限设置状态
// 需要 ethers v5  本地v6所以进行修改

const { JsonRpcProvider } = require("ethers");
const { Contract } = require("ethers");

// ========== 1. 配置区块链连接 ==========
const provider = new JsonRpcProvider(
  "https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4"
);

// ========== 2. 合约地址 ==========
const addresses = {
  CarbonToken: "0x96Df2E626522C256cBE631C41c5cEd2231c83441",
  GreenTrace: "0xc0Fbbc434B2BB535958A45c92cE7884ad1669dCf",
  GreenTalesNFT: "0x031B2dd1C0e7922098a5b384436c44dC8FdaDc67",
  GreenTalesAuction: "0x72AB9e418F1e9eEfba19115F7C0884C7843C4284",
  GreenTalesMarket: "0xFeB853De1653Bc205f1a7d4AFC263104748775de",
};

// ========== 3. 合约 ABI（只保留需要的函数） ==========
// CarbonToken 合约只需要 owner 和 greenTrace 查询
const carbonTokenAbi = [
  "function owner() view returns (address)",
  "function greenTrace() view returns (address)",
];

// GreenTrace 合约只需要以下状态查询
const greenTraceAbi = [
  "function initialized() view returns (bool)",
  "function businessContracts(address) view returns (bool)",
  "function nftContract() view returns (address)",
  "function owner() view returns (address)",
];

// ========== 4. 检查函数 ==========
async function main() {
  // 1. 连接合约
  const carbonToken = new Contract(addresses.CarbonToken, carbonTokenAbi, provider);
  const greenTrace = new Contract(addresses.GreenTrace, greenTraceAbi, provider);

  // 2. 检查 CarbonToken 状态
  console.log("==== CarbonToken 状态 ====");
  const carbonOwner = await carbonToken.owner();
  console.log("owner（应为 GreenTrace 地址）:", carbonOwner);
  const greenTraceAddr = await carbonToken.greenTrace();
  console.log("greenTrace 地址（应为 GreenTrace 地址）:", greenTraceAddr);

  // 3. 检查 GreenTrace 状态
  console.log("\n==== GreenTrace 状态 ====");
  const isInit = await greenTrace.initialized();
  console.log("initialized（应为 true）:", isInit);
  const nftAddr = await greenTrace.nftContract();
  console.log("nftContract（应为 GreenTalesNFT 地址）:", nftAddr);
  const gtOwner = await greenTrace.owner();
  console.log("owner（应为部署者或指定地址）:", gtOwner);

  // 4. 检查业务合约白名单
  const auctionInWhiteList = await greenTrace.businessContracts(addresses.GreenTalesAuction);
  const marketInWhiteList = await greenTrace.businessContracts(addresses.GreenTalesMarket);
  console.log("\n==== GreenTrace 白名单 ====");
  console.log("Auction 合约在白名单:", auctionInWhiteList);
  console.log("Market 合约在白名单:", marketInWhiteList);
}

main().catch((err) => {
  console.error("执行出错：", err);
});

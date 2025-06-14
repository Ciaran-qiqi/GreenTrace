const fs = require('fs');
const path = require('path');

// 网络配置
const NETWORKS = {
  foundry: {
    chainId: '31337',
    name: 'Foundry Local',
    addressesKey: 'FOUNDRY_ADDRESSES'
  },
  sepolia: {
    chainId: '11155111',
    name: 'Sepolia',
    addressesKey: 'SEPOLIA_ADDRESSES'
  }
};

// 要更新的网络
const network = process.argv[2] || 'foundry';
const networkConfig = NETWORKS[network];

if (!networkConfig) {
  console.error('❌ 无效的网络名称。可用选项：foundry, sepolia');
  process.exit(1);
}

// 读取 Foundry 部署输出
const deploymentFile = path.join(
  __dirname, 
  '..', 
  'Foundry', 
  'broadcast', 
  'Deploy.s.sol', 
  networkConfig.chainId, 
  'run-latest.json'
);

try {
  // 读取部署文件
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  // 获取合约地址
  const addresses = {};
  deployment.transactions.forEach(tx => {
    if (tx.transactionType === 'CREATE') {
      const contractName = tx.contractName;
      const address = tx.contractAddress;
      addresses[contractName] = address;
    }
  });

  // 读取当前的 addresses.ts 文件
  const addressesFile = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'addresses.ts');
  let content = fs.readFileSync(addressesFile, 'utf8');

  // 更新地址
  const newAddresses = {
    CarbonToken: addresses.CarbonToken || '',
    GreenTrace: addresses.GreenTrace || '',
    GreenTalesNFT: addresses.GreenTalesNFT || '',
    GreenTalesMarket: addresses.GreenTalesMarket || '',
    GreenTalesAuction: addresses.GreenTalesAuction || '',
    GreenTalesTender: addresses.GreenTalesTender || '',
  };

  // 替换地址部分
  const addressesStr = JSON.stringify(newAddresses, null, 2)
    .replace(/"([^"]+)":/g, '$1:') // 移除属性名的引号
    .replace(/"/g, "'"); // 将值中的双引号替换为单引号

  content = content.replace(
    new RegExp(`export const ${networkConfig.addressesKey} = {[\\s\\S]*?};`),
    `export const ${networkConfig.addressesKey} = ${addressesStr};`
  );

  // 写入更新后的文件
  fs.writeFileSync(addressesFile, content);
  console.log(`✅ ${networkConfig.name} 地址更新成功！`);

} catch (error) {
  console.error(`❌ 更新 ${networkConfig.name} 地址失败:`, error.message);
  console.log(`请确保已经运行了 Foundry 部署脚本到 ${networkConfig.name} 并生成了部署输出文件。`);
  console.log('部署命令示例：');
  console.log('本地测试网：forge script script/Deploy.s.sol:Deploy --broadcast');
  console.log('Sepolia测试网：forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url $SEPOLIA_RPC_URL');
} 
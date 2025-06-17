const fs = require('fs');
const path = require('path');

// 网络配置
const NETWORKS = {
  sepolia: {
    chainId: '11155111',
    name: 'Sepolia',
    addressesKey: 'SEPOLIA_ADDRESSES',
    // Sepolia 地址通常以 0x 开头，长度42位
    addressPattern: /^0x[a-fA-F0-9]{40}$/
  }
};

// 要更新的网络
const network = process.argv[2] || 'sepolia';
const networkConfig = NETWORKS[network];

if (!networkConfig) {
  console.error('❌ 无效的网络名称。可用选项：sepolia');
  process.exit(1);
}

// 读取部署输出
const deploymentFile = path.join(
  __dirname, 
  '..', 
  '..', 
  'Foundry', 
  'broadcast', 
  'Deploy.s.sol', 
  networkConfig.chainId, 
  'run-latest.json'
);

try {
  // 检查部署文件是否存在
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ 错误：找不到部署文件 ${deploymentFile}`);
    console.log('\n请确保您已经：');
    console.log('1. 在 Sepolia 网络上部署了合约');
    console.log('2. 使用了正确的 RPC URL');
    console.log('\n部署命令：');
    console.log('cd Foundry');
    console.log('forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url $SEPOLIA_RPC_URL');
    process.exit(1);
  }

  // 读取部署文件
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  // 获取所有合约地址，包括通过 CREATE 和 CREATE2 部署的合约
  const newAddresses = {};
  const deployedContracts = new Set();

  // 首先收集所有通过 CREATE 部署的合约
  deployment.transactions.forEach(tx => {
    if (tx.transactionType === 'CREATE' && tx.contractAddress) {
      const contractName = tx.contractName;
      const address = tx.contractAddress;
      newAddresses[contractName] = address;
      deployedContracts.add(address.toLowerCase());
    }
  });

  // 然后检查所有交易中的合约地址
  deployment.transactions.forEach(tx => {
    // 检查交易中的合约地址
    if (tx.contractAddress && !deployedContracts.has(tx.contractAddress.toLowerCase())) {
      const contractName = tx.contractName;
      const address = tx.contractAddress;
      newAddresses[contractName] = address;
      deployedContracts.add(address.toLowerCase());
    }
  });

  // 读取当前的 addresses.ts 文件
  const addressesFile = path.join(__dirname, '..', 'src', 'contracts', 'addresses.ts');
  const content = fs.readFileSync(addressesFile, 'utf8');

  // 解析 addresses.ts，提取合约名与环境变量名的映射
  // 这样可以确保所有合约都能正确找到对应的环境变量
  const contractEnvMap = {};
  const contractEnvPattern = /([A-Za-z0-9_]+):\s*process\.env\.([A-Z0-9_]+)\s*\|\|/g;
  let m;
  while ((m = contractEnvPattern.exec(content)) !== null) {
    // m[1] 是合约名，m[2] 是环境变量名
    contractEnvMap[m[1]] = m[2];
  }

  // 从部署文件中提取所有合约名，并建立与 addresses.ts 中合约名的映射
  // 例如：GreenTalesNFT -> NFT, GreenTalesMarket -> Market 等
  const deployedContractNames = new Set();
  deployment.transactions.forEach(tx => {
    if (tx.contractName) {
      deployedContractNames.add(tx.contractName);
    }
  });

  // 建立部署合约名与 addresses.ts 合约名的映射
  const contractNameMap = {};
  Object.keys(contractEnvMap).forEach(tsContractName => {
    // 尝试从部署合约名中匹配 addresses.ts 中的合约名
    // 例如：GreenTalesNFT 包含 NFT，则映射为 NFT
    const matchedDeployedName = Array.from(deployedContractNames).find(deployedName => 
      deployedName.includes(tsContractName) || tsContractName.includes(deployedName)
    );
    if (matchedDeployedName) {
      contractNameMap[tsContractName] = matchedDeployedName;
    }
  });

  // 读取 .env 文件
  const envFile = path.join(__dirname, '..', '.env');
  let envContent = '';
  let currentAddresses = {};
  
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        currentAddresses[key.trim()] = value.trim();
      }
    });
  }

  // 检查地址是否有更新
  let hasUpdates = false;
  let updatedEnvContent = envContent;
  console.log('\n📝 Sepolia 网络合约地址检查结果：');
  console.log('=====================');

  // 主要合约名称列表，确保与 addresses.ts 文件一致，自行修改
  const mainContracts = [
    'CarbonToken',
    'GreenTrace',
    'NFT',
    'Market',
   
  ];

  // 显示主要合约
  console.log('\n主要合约：');
  console.log('---------------------');
  mainContracts.forEach(contractName => {
    // 使用合约名映射查找部署文件中的合约名
    const deployedContractName = contractNameMap[contractName] || contractName;
    const newAddress = newAddresses[deployedContractName];
    const envVarName = contractEnvMap[contractName];
    if (envVarName) {
      // 验证地址格式
      if (newAddress && !networkConfig.addressPattern.test(newAddress)) {
        console.log(`\n⚠️ 警告：合约 ${contractName} 的地址格式可能不正确`);
        console.log(`当前地址: ${newAddress}`);
        console.log('这看起来像是本地测试网的地址，而不是 Sepolia 网络的地址');
        console.log('---------------------');
        return;
      }
      const currentAddress = currentAddresses[envVarName];
      console.log(`\n合约: ${contractName}`);
      console.log(`环境变量: ${envVarName}`);
      if (newAddress && (!currentAddress || currentAddress.toLowerCase() !== newAddress.toLowerCase())) {
        console.log(`状态: 🔄 需要更新`);
        if (currentAddress) {
          console.log(`当前地址: ${currentAddress}`);
        }
        console.log(`新地址: ${newAddress}`);
        
        // 更新 .env 文件内容
        const envVarPattern = new RegExp(`^${envVarName}=.*$`, 'm');
        if (envVarPattern.test(updatedEnvContent)) {
          updatedEnvContent = updatedEnvContent.replace(envVarPattern, `${envVarName}=${newAddress}`);
        } else {
          updatedEnvContent += `\n${envVarName}=${newAddress}`;
        }
        hasUpdates = true;
      } else if (currentAddress) {
        console.log(`状态: ✅ 地址已是最新`);
        console.log(`当前地址: ${currentAddress}`);
      } else if (newAddress) {
        console.log(`状态: ⚠️ 未配置`);
        console.log(`新地址: ${newAddress}`);
        updatedEnvContent += `\n${envVarName}=${newAddress}`;
        hasUpdates = true;
      } else {
        console.log(`状态: ⚠️ 未配置，且部署文件中未找到该合约地址`);
        hasUpdates = true;
      }
      console.log('---------------------');
    } else {
      // addresses.ts 中未找到该合约的环境变量映射
      console.log(`\n合约: ${contractName}`);
      console.log('状态: ⚠️ addresses.ts 未配置该合约的环境变量映射');
      if (newAddress) {
        console.log(`新地址: ${newAddress}`);
      }
      console.log('---------------------');
      hasUpdates = true;
    }
  });

  // 读取当前的 addresses.ts 文件
  const businessContracts = Object.keys(newAddresses).filter(name => name.startsWith('Business'));

  // 显示业务合约
  if (businessContracts.length > 0) {
    console.log('\n业务合约：');
    console.log('---------------------');
    businessContracts.forEach(contractName => {
      const newAddress = newAddresses[contractName];
      if (newAddress) {
        console.log(`\n合约: ${contractName}`);
        console.log(`地址: ${newAddress}`);
        console.log('---------------------');
      }
    });
  }

  if (hasUpdates) {
    // 写入更新后的 .env 文件
    fs.writeFileSync(envFile, updatedEnvContent);
    console.log('\n✅ .env 文件已更新！');
  } else {
    console.log('\n✅ 所有合约地址都是最新的，无需更新');
  }

} catch (error) {
  console.error(`❌ 检查 ${networkConfig.name} 地址失败:`, error.message);
  console.log(`\n请确保：`);
  console.log('1. 已经运行了部署脚本到 Sepolia 网络');
  console.log('2. 使用了正确的 RPC URL');
  console.log('3. 部署交易已经确认');
  console.log('\n部署命令：');
  console.log('cd Foundry');
  console.log('forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url $SEPOLIA_RPC_URL');
} 
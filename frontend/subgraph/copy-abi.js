const fs = require('fs');
const path = require('path');

// 确保abis目录存在
const abisDir = path.join(__dirname, 'abis');
if (!fs.existsSync(abisDir)) {
  fs.mkdirSync(abisDir, { recursive: true });
}

// 需要复制的ABI文件列表
const abiFiles = [
  'GreenTrace.json',
  'CarbonToken.json',
  'GreenTalesNFT.json',
  'CarbonPriceOracle.json',
  'GreenTalesMarket.json',
  'GreenTalesLiquidityPool.json',
  'CarbonUSDTMarket.json'
];

// 源目录和目标目录
const sourceDir = path.join(__dirname, '..', 'src', 'contracts', 'abi');
const targetDir = path.join(__dirname, 'abis');

console.log('开始复制ABI文件...');
console.log('源目录:', sourceDir);
console.log('目标目录:', targetDir);

// 复制每个ABI文件
abiFiles.forEach(fileName => {
  const sourcePath = path.join(sourceDir, fileName);
  const targetPath = path.join(targetDir, fileName);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ 已复制: ${fileName}`);
  } else {
    console.log(`❌ 文件不存在: ${fileName}`);
  }
});

console.log('\nABI文件复制完成！');
console.log('现在可以运行以下命令部署子图:');
console.log('npm run codegen');
console.log('npm run build');
console.log('npm run deploy'); 
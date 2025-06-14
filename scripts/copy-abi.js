const fs = require('fs');
const path = require('path');

// 源目录和目标目录
const sourceDir = path.join(__dirname, '..', 'Foundry', 'out');
const targetDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'abi');

console.log('源目录:', sourceDir);
console.log('目标目录:', targetDir);

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// 要复制的合约列表
const contracts = [
    'GreenTrace',
    'GreenTalesNFT',
    'GreenTalesMarket',
    'GreenTalesAuction',
    'CarbonToken',
    'GreenTalesTender'
];

// 复制每个合约的 ABI
contracts.forEach(contract => {
    const sourceFile = path.join(sourceDir, `${contract}.sol`, `${contract}.json`);
    const targetFile = path.join(targetDir, `${contract}.json`);

    console.log(`正在处理 ${contract}...`);
    console.log('源文件:', sourceFile);
    console.log('目标文件:', targetFile);

    try {
        // 读取源文件
        const abiContent = fs.readFileSync(sourceFile, 'utf8');
        // 解析 JSON
        const abi = JSON.parse(abiContent);
        // 只保留 abi 字段
        const abiOnly = { abi: abi.abi };
        // 写入目标文件
        fs.writeFileSync(targetFile, JSON.stringify(abiOnly, null, 2));
        console.log(`✅ 成功复制 ${contract} ABI`);
    } catch (error) {
        console.error(`❌ 复制 ${contract} ABI 失败:`, error.message);
    }
});

console.log('🎉 ABI 复制完成！'); 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/GreenTrace.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTalesMarket.sol";

/**
 * @title DeployGreenTraceAndMarket
 * @dev 部署新的GreenTrace和GreenTalesMarket合约的脚本
 * @notice 这个脚本将：
 * 1. 部署新的GreenTrace合约
 * 2. 部署新的GreenTalesMarket合约
 * 3. 更新CarbonToken和GreenTalesNFT的GreenTrace地址引用
 * 4. 配置新GreenTrace合约的各项设置
 */
contract DeployGreenTraceAndMarket is Script {
    
    // ============ 现有数据合约地址配置 ============
    // 🔧 请根据你的实际部署地址修改这些地址
    address constant CARBON_TOKEN_ADDRESS = 0x808b73A3A1D97382acF32d4F4F834e799Aa08198;
    address constant GREEN_TALES_NFT_ADDRESS = 0x3456a42043955B1626F6353936c0FEfCd1cB5f1c;

    // ============ 新合约配置 ============
    // 🔧 请根据需要修改这些配置
    address constant FEE_COLLECTOR_ADDRESS = 0x294761C91734360C5A70e33F8372778ED2849767; // 平台手续费接收地址
    uint256 constant PLATFORM_FEE_RATE = 250; // 2.5%
    
    // ============ 审计人员地址配置 ============
    // 🔧 请添加需要授权的审计人员地址
    address[] auditors = [
        0x294761C91734360C5A70e33F8372778ED2849767  // 添加你的审计人员地址
    ];
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"🚀 开始部署GreenTrace和GreenTalesMarket合约...");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"当前网络Chain ID:", block.chainid);
        
        // ============ 第一步：部署新的GreenTrace合约 ============
        console.log(unicode"\n=== 第一步：部署新的GreenTrace合约 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        GreenTrace newGreenTrace = new GreenTrace(CARBON_TOKEN_ADDRESS, GREEN_TALES_NFT_ADDRESS);
        address newGreenTraceAddress = address(newGreenTrace);
        vm.stopBroadcast();
        console.log(unicode"✅ 新GreenTrace合约部署成功！");
        console.log(unicode"新GreenTrace地址:", newGreenTraceAddress);

        // ============ 第二步：部署新的GreenTalesMarket合约 ============
        console.log(unicode"\n=== 第二步：部署新的GreenTalesMarket合约 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesMarket newMarket = new GreenTalesMarket(
            GREEN_TALES_NFT_ADDRESS,
            CARBON_TOKEN_ADDRESS,
            PLATFORM_FEE_RATE,
            FEE_COLLECTOR_ADDRESS,
            newGreenTraceAddress
        );
        address newMarketAddress = address(newMarket);
        vm.stopBroadcast();
        console.log(unicode"✅ 新GreenTalesMarket合约部署成功！");
        console.log(unicode"新Market地址:", newMarketAddress);
        
        // ============ 第三步：更新CarbonToken的GreenTrace引用 ============
        console.log(unicode"\n=== 第三步：更新CarbonToken的GreenTrace引用 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        CarbonToken carbonToken = CarbonToken(CARBON_TOKEN_ADDRESS);
        
        // 检查当前所有者
        address currentOwner = carbonToken.owner();
        console.log(unicode"CarbonToken当前所有者:", currentOwner);
        
        if (currentOwner == deployer) {
            // 如果当前所有者是部署者，直接更新
            carbonToken.setGreenTrace(newGreenTraceAddress);
            console.log(unicode"✅ CarbonToken的GreenTrace地址已更新");
            
            // 转移所有权给新的GreenTrace合约
            carbonToken.transferOwnership(newGreenTraceAddress);
            console.log(unicode"✅ CarbonToken所有权已转移给新GreenTrace");
        } else {
            console.log(unicode"⚠️  警告: CarbonToken的所有者不是当前部署者");
            console.log(unicode"   需要手动调用以下函数:");
            console.log(unicode"   1. carbonToken.setGreenTrace(", newGreenTraceAddress, ")");
            console.log(unicode"   2. carbonToken.transferOwnership(", newGreenTraceAddress, ")");
        }
        vm.stopBroadcast();
        
        // ============ 第四步：更新GreenTalesNFT的GreenTrace引用 ============
        console.log(unicode"\n=== 第四步：更新GreenTalesNFT的GreenTrace引用 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesNFT nft = GreenTalesNFT(GREEN_TALES_NFT_ADDRESS);
        
        // 检查当前所有者
        address nftOwner = nft.owner();
        console.log(unicode"GreenTalesNFT当前所有者:", nftOwner);
        
        if (nftOwner == deployer) {
            nft.setGreenTrace(newGreenTraceAddress);
            console.log(unicode"✅ GreenTalesNFT的GreenTrace地址已更新");
        } else {
            console.log(unicode"⚠️  警告: GreenTalesNFT的所有者不是当前部署者");
            console.log(unicode"   需要手动调用: nft.setGreenTrace(", newGreenTraceAddress, ")");
        }
        vm.stopBroadcast();
        
        // ============ 第五步：初始化新GreenTrace合约 ============
        console.log(unicode"\n=== 第五步：初始化新GreenTrace合约 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        newGreenTrace.initialize();
        console.log(unicode"✅ 新GreenTrace合约已初始化");
        vm.stopBroadcast();
        
        // ============ 第六步：添加审计人员 ============
        console.log(unicode"\n=== 第六步：添加审计人员 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        for (uint i = 0; i < auditors.length; i++) {
            newGreenTrace.addAuditor(auditors[i]);
            console.log(unicode"✅ 已添加审计人员:", auditors[i]);
        }
        vm.stopBroadcast();
        
        // ============ 第七步：添加业务合约到白名单 ============
        console.log(unicode"\n=== 第七步：添加业务合约到白名单 ===");
        
        vm.startBroadcast(deployerPrivateKey);
        newGreenTrace.addBusinessContract(newMarketAddress);
        console.log(unicode"✅ 已将新GreenTalesMarket添加到业务合约白名单");
        console.log(unicode"   市场合约地址:", newMarketAddress);
        vm.stopBroadcast();
        
        // ============ 部署完成总结 ============
        console.log(unicode"\n🎉 部署完成！");
        console.log(unicode"==========================================");
        console.log(unicode"新合约地址信息:");
        console.log(unicode"==========================================");
        console.log(unicode"🆕 新GreenTrace地址:", newGreenTraceAddress);
        console.log(unicode"🆕 新GreenTalesMarket地址:", newMarketAddress);
        console.log(unicode"🔄 CarbonToken地址 (不变):", CARBON_TOKEN_ADDRESS);
        console.log(unicode"🔄 GreenTalesNFT地址 (不变):", GREEN_TALES_NFT_ADDRESS);
        
        console.log(unicode"\n✅ 数据迁移状态:");
        console.log(unicode"- NFT数据: 完全保留");
        console.log(unicode"- 碳币余额: 完全保留");
        console.log(unicode"- 市场挂单: 不受影响（但旧市场将无法与新Trace交互）");
        
        console.log(unicode"\n📝 请更新你的前端配置:");
        console.log(unicode"- 将GreenTrace合约地址更新为:", newGreenTraceAddress);
        console.log(unicode"- 将GreenTalesMarket合约地址更新为:", newMarketAddress);
        console.log(unicode"- 其他合约地址保持不变");
        
        console.log(unicode"\n🔍 请使用 VerifyDeployment 脚本进行验证。");
    }
} 
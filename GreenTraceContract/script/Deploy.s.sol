// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "../src/GreenTalesAuction.sol";
import "../src/GreenTalesMarket.sol";

contract DeployScript is Script {
    // 声明为public变量，这样在部署后可以访问这些合约地址
    CarbonToken public carbonToken;
    GreenTalesNFT public greenTalesNFT;
    GreenTrace public greenTrace;
    GreenTalesAuction public auction;
    GreenTalesMarket public market;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署 CarbonToken
        carbonToken = new CarbonToken(1000000 ether); // 初始供应量 100万

        // 2. 部署 GreenTrace 主合约
        greenTrace = new GreenTrace(address(carbonToken), address(0)); // 先传入0地址

        // 3. 部署 GreenTalesNFT，传入 GreenTrace 地址
        greenTalesNFT = new GreenTalesNFT(address(greenTrace));
        // 4. 更新 GreenTrace 的 NFT 地址
        greenTrace.setNFTContract(address(greenTalesNFT));

        // 5. 部署 GreenTalesAuction
        auction = new GreenTalesAuction(
            address(carbonToken),
            address(greenTalesNFT),
            address(greenTrace)  // 添加 GreenTrace 地址
        );

        // 6. 部署 GreenTalesMarket
        market = new GreenTalesMarket(
            address(greenTalesNFT),
            address(carbonToken),
            250,  // 平台手续费率 2.5%
            address(greenTrace),  // 手续费接收地址设置为GreenTrace合约
            address(greenTrace)   // 添加 GreenTrace 地址
        );

        // 7. 设置权限
        carbonToken.setGreenTrace(address(greenTrace));  // 先设置 GreenTrace 地址
        carbonToken.transferOwnership(address(greenTrace));  // 再将 CarbonToken 的所有权转给主合约
        
        // 8. 初始化 GreenTrace
        greenTrace.initialize();

        // 9. 添加业务合约到 GreenTrace 白名单
        greenTrace.addBusinessContract(address(auction));  // 添加拍卖合约
        greenTrace.addBusinessContract(address(market));   // 添加市场合约
        
        // 10. 验证初始化
        require(greenTrace.initialized(), "GreenTrace initialization failed");
        require(carbonToken.owner() == address(greenTrace), "CarbonToken ownership transfer failed");
        
        require(greenTrace.businessContracts(address(auction)), "Auction contract not added to whitelist");
        require(greenTrace.businessContracts(address(market)), "Market contract not added to whitelist");

        vm.stopBroadcast();
    }
} 
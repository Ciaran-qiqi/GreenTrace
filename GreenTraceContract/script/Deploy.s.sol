// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "../src/GreenTalesAuction.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署 CarbonToken
        CarbonToken carbonToken = new CarbonToken(1000000 ether); // 初始供应量 100万

        // 2. 部署 GreenTalesNFT
        GreenTalesNFT greenTalesNFT = new GreenTalesNFT();

        // 3. 部署 GreenTrace 主合约
        GreenTrace greenTrace = new GreenTrace(address(carbonToken), address(greenTalesNFT));

        // 4. 部署 GreenTalesAuction
        GreenTalesAuction auction = new GreenTalesAuction(address(carbonToken), address(greenTalesNFT));

        // 5. 设置权限
        carbonToken.setGreenTrace(address(greenTrace));  // 先设置 GreenTrace 地址
        carbonToken.transferOwnership(address(greenTrace));  // 再将 CarbonToken 的所有权转给主合约
        greenTalesNFT.setMinter(address(greenTrace));       // 设置主合约为 NFT 的铸造者
        
        // 6. 初始化 GreenTrace
        greenTrace.initialize();
        
        // 7. 验证初始化
        require(greenTrace.initialized(), "GreenTrace initialization failed");
        require(carbonToken.owner() == address(greenTrace), "CarbonToken ownership transfer failed");
        require(greenTalesNFT.minter() == address(greenTrace), "GreenTalesNFT minter setting failed");

        vm.stopBroadcast();
    }
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonPriceOracle.sol";

/**
 * @title DeployOracleOnly
 * @dev 只部署预言机合约的脚本
 * @notice 用于重新部署预言机合约，使用更高的gas限制
 */
contract DeployOracleOnly is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        
        // Sepolia 配置
        address router = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0; // 正确的Sepolia Functions Router
        bytes32 donId = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
        address eurUsdPriceFeed = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910; // EUR/USD
        address linkToken = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // Sepolia LINK
        
        vm.startBroadcast(privateKey);
        
        console.log("=== Deploying CarbonPriceOracle ===");
        console.log("Router:", router);
        console.log("DON ID:", vm.toString(donId));
        console.log("EUR/USD Price Feed:", eurUsdPriceFeed);
        console.log("LINK Token:", linkToken);
        
        CarbonPriceOracle oracle = new CarbonPriceOracle(
            router,
            donId,
            eurUsdPriceFeed,
            linkToken
        );
        
        console.log("Oracle deployed at:", address(oracle));
        
        // 设置订阅ID
        oracle.setSubscriptionId(5045);
        console.log("Subscription ID set to: 5045");
        
        // 添加操作员
        address operator = 0x294761C91734360C5A70e33F8372778ED2849767;
        oracle.addOperator(operator);
        console.log("Operator added:", operator);
        
        // 检查LINK余额并转移
        IERC20 link = IERC20(linkToken);
        uint256 linkBalance = link.balanceOf(msg.sender);
        console.log("Current LINK balance:", linkBalance / 1e18, "LINK");
        
        if (linkBalance > 2 * 1e18 && linkBalance <= 12 * 1e18) {
            // 大于2个小于等于12个转1个
            uint256 linkAmount = 1 * 1e18; // 1 LINK
            require(link.transfer(address(oracle), linkAmount), "LINK transfer failed");
            console.log("Transferred", linkAmount / 1e18, "LINK to oracle (balance: 2-12 LINK)");
        } else if (linkBalance > 12 * 1e18 && linkBalance <= 25 * 1e18) {
            // 大于12个小于等于25个转2个
            uint256 linkAmount = 2 * 1e18; // 2 LINK
            require(link.transfer(address(oracle), linkAmount), "LINK transfer failed");
            console.log("Transferred", linkAmount / 1e18, "LINK to oracle (balance: 12-25 LINK)");
        } else if (linkBalance > 25 * 1e18 && linkBalance <= 50 * 1e18) {
            // 大于25个小于等于50个转5个
            uint256 linkAmount = 5 * 1e18; // 5 LINK
            require(link.transfer(address(oracle), linkAmount), "LINK transfer failed");
            console.log("Transferred", linkAmount / 1e18, "LINK to oracle (balance: 25-50 LINK)");
        } else if (linkBalance > 50 * 1e18) {
            // 大于50个转10个
            uint256 linkAmount = 10 * 1e18; // 10 LINK
            require(link.transfer(address(oracle), linkAmount), "LINK transfer failed");
            console.log("Transferred", linkAmount / 1e18, "LINK to oracle (balance: >50 LINK)");
        } else {
            console.log("Insufficient LINK balance (need >2 LINK). Skipping LINK transfer.");
            console.log("You can manually transfer LINK to the oracle later using:");
            console.log(string.concat("cast send ", vm.toString(linkToken), " \"transfer(address,uint256)\" ", vm.toString(address(oracle)), " 1000000000000000000 --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL"));
        }
        
        vm.stopBroadcast();
        
        console.log("=== Deployment Complete ===");
        console.log("Oracle Address:", address(oracle));
        console.log("Next steps:");
        console.log("1. Add oracle address to subscription consumers");
        console.log("2. Test oracle with: cast send", address(oracle), '"requestCarbonPrice()" --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL');
    }
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonUSDTMarket.sol";

/**
 * @title CarbonUSDTMarket 单独部署脚本
 * @dev 适用于Sepolia测试网，参数参考Deploy.md，部署后自动输出合约地址。
 */
contract DeployCarbonUSDTMarket is Script {
    function setUp() public {}

    function run() public {
        // 读取部署者私钥（建议通过环境变量传递）
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // ====== 部署参数（来自Deploy.md） ======
        address carbonToken = 0x808b73A3A1D97382acF32d4F4F834e799Aa08198;
        address usdtToken = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
        address ammPool = 0xCfBE2B410E5707b35231B9237bD7E523403Db889;
        address priceOracle = 0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA;
        address feeCollector = 0x294761C91734360C5A70e33F8372778ED2849767;

        // ====== 部署合约 ======
        CarbonUSDTMarket market = new CarbonUSDTMarket(
            carbonToken,
            usdtToken,
            ammPool,
            priceOracle,
            feeCollector
        );

        // ====== 输出部署结果 ======
        console2.log("CarbonUSDTMarket deployed at:", address(market));

        vm.stopBroadcast();
    }
} 
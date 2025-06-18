// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CarbonPriceOracle.sol";

/**
 * @title ConfigureOracle
 * @dev 配置碳价预言机的脚本
 * @notice 部署后需要运行此脚本来配置预言机
 */
contract ConfigureOracle is Script {
    // 预言机合约地址（部署后需要更新）
    address public oracleAddress;
    
    // 配置参数
    uint64 public subscriptionId;
    
    function setUp() public {
        // 从环境变量获取配置
        subscriptionId = uint64(vm.envUint("CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID"));
        oracleAddress = vm.envAddress("CARBON_PRICE_ORACLE_ADDRESS");
        
        console.log(unicode"=== 预言机配置脚本 ===");
        console.log(unicode"预言机地址:", oracleAddress);
        console.log(unicode"订阅ID:", subscriptionId);
        console.log("");
    }

    function run() external {
        console.log(unicode"开始配置预言机...");
        
        // 获取部署者私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. 设置订阅ID
        console.log(unicode"1. 设置订阅ID...");
        CarbonPriceOracle oracle = CarbonPriceOracle(oracleAddress);
        oracle.setSubscriptionId(subscriptionId);
        console.log(unicode"订阅ID设置成功:", subscriptionId);
        
        // 2. 添加操作员（可选）
        // 如果你想让其他地址也能调用预言机更新
        address operator = vm.envAddress("ORACLE_OPERATOR_ADDRESS");
        if (operator != address(0)) {
            console.log(unicode"2. 添加操作员...");
            oracle.addOperator(operator);
            console.log(unicode"操作员添加成功:", operator);
        }
        
        vm.stopBroadcast();
        
        // 3. 验证配置
        console.log(unicode"3. 验证配置...");
        require(oracle.subscriptionId() == subscriptionId, "Subscription ID not set correctly");
        console.log(unicode"订阅ID验证成功");
        
        if (operator != address(0)) {
            require(oracle.authorizedOperators(operator), "Operator not added correctly");
            console.log(unicode"操作员验证成功");
        }
        
        console.log(unicode"\n=== 预言机配置完成！===");
        console.log(unicode"现在可以调用 oracle.requestCarbonPrice() 来更新价格");
        console.log(unicode"注意：确保订阅账户有足够的LINK余额");
        console.log(unicode"==================");
    }
} 
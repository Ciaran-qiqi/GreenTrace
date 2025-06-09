// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";

/**
 * @title CarbonToken 测试用例
 * @dev 只测试初始分配、转账、GreenTrace 权限相关逻辑
 * 
 * 业务逻辑说明：
 * 1. CarbonToken 只能由 GreenTrace 合约铸造，不能随意铸造和销毁。
 * 2. 只能测试初始分配、转账、GreenTrace 权限。
 */
contract CarbonTokenTest is Test {
    CarbonToken public carbonToken;    // 碳币合约实例
    address public owner;              // 合约所有者
    address public user1;              // 测试用户1
    address public user2;              // 测试用户2
    address public greenTrace;         // GreenTrace合约地址
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // 初始供应量

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        greenTrace = makeAddr("greenTrace");
        carbonToken = new CarbonToken(INITIAL_SUPPLY);
    }

    /**
     * @dev 测试初始供应量
     * @notice 验证部署时铸造的代币数量是否正确
     */
    function test_InitialSupply() public view {
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY);
        assertEq(carbonToken.balanceOf(owner), INITIAL_SUPPLY);
    }

    /**
     * @dev 测试转账功能
     * @notice 验证代币转账是否正常工作
     */
    function test_Transfer() public {
        uint256 amount = 100 ether;
        carbonToken.transfer(user1, amount);
        assertEq(carbonToken.balanceOf(user1), amount);
        assertEq(carbonToken.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    /**
     * @dev 测试只有合约所有者可以设置 GreenTrace 地址
     */
    function test_SetGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        assertEq(carbonToken.greenTrace(), greenTrace);
    }

    /**
     * @dev 测试非合约所有者设置 GreenTrace 地址会失败
     */
    function test_RevertWhen_SetGreenTraceNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        carbonToken.setGreenTrace(greenTrace);
    }

    /**
     * @dev 测试只有 GreenTrace 合约可以铸造新代币
     */
    function test_RevertWhen_MintNotGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        vm.prank(user1);
        vm.expectRevert("Only GreenTrace can mint");
        carbonToken.mint(user2, 100 ether);
    }

    /**
     * @dev 测试 GreenTrace 合约可以正常铸造新代币
     */
    function test_MintByGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        vm.prank(greenTrace);
        carbonToken.mint(user2, 123 ether);
        assertEq(carbonToken.balanceOf(user2), 123 ether);
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY + 123 ether);
    }
} 
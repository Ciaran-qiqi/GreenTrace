// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonToken.sol";

/**
 * @title CarbonToken 测试用例
 * @dev 覆盖铸造、销毁、权限等核心逻辑
 * 
 * 测试用例包括：
 * 1. 初始供应量测试
 * 2. 转账功能测试
 * 3. 铸造功能测试
 * 4. 销毁功能测试
 * 5. 权限控制测试
 * 6. 错误处理测试
 */
contract CarbonTokenTest is Test {
    CarbonToken public carbonToken;    // 碳币合约实例
    address public owner;              // 合约所有者
    address public user1;              // 测试用户1
    address public user2;              // 测试用户2
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // 初始供应量

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
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
     * @dev 测试铸造功能
     * @notice 验证合约所有者是否可以铸造新代币
     */
    function test_Mint() public {
        uint256 amount = 1000 ether;
        carbonToken.mint(user1, amount);
        assertEq(carbonToken.balanceOf(user1), amount);
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY + amount);
    }

    /**
     * @dev 测试销毁功能
     * @notice 验证代币持有者是否可以销毁自己的代币
     */
    function test_Burn() public {
        uint256 amount = 100 ether;
        carbonToken.transfer(user1, amount);
        vm.prank(user1);
        carbonToken.burn(amount);
        assertEq(carbonToken.balanceOf(user1), 0);
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY - amount);
    }

    /**
     * @dev 测试非所有者铸造失败
     * @notice 验证非合约所有者无法铸造新代币
     */
    function test_RevertWhen_MintNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        carbonToken.mint(user2, 100 ether);
    }

    /**
     * @dev 测试余额不足销毁失败
     * @notice 验证余额不足时无法销毁代币
     */
    function test_RevertWhen_BurnInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert("ERC20: burn amount exceeds balance");
        carbonToken.burn(100 ether);
    }
} 
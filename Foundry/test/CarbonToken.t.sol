// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";

/**
 * @title CarbonToken Test Cases
 * @dev Only tests initial allocation, transfer, and GreenTrace permission logic
 * 
 * Business logic description:
 * 1. CarbonToken can only be minted by GreenTrace contract, cannot be minted or burned arbitrarily.
 * 2. Only tests initial allocation, transfer, and GreenTrace permissions.
 */
contract CarbonTokenTest is Test {
    CarbonToken public carbonToken;    // Carbon token contract instance
    address public owner;              // Contract owner
    address public user1;              // Test user 1
    address public user2;              // Test user 2
    address public greenTrace;         // GreenTrace contract address
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // Initial supply

    /**
     * @dev Test environment setup
     * @notice Runs before each test case execution
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        greenTrace = makeAddr("greenTrace");
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
    }

    /**
     * @dev Test initial supply
     * @notice Verify that the number of tokens minted during deployment is correct
     */
    function test_InitialSupply() public view {
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY);
        assertEq(carbonToken.balanceOf(owner), INITIAL_SUPPLY);
    }

    /**
     * @dev Test transfer functionality
     * @notice Verify that token transfer works normally
     */
    function test_Transfer() public {
        uint256 amount = 100 ether;
        carbonToken.transfer(user1, amount);
        assertEq(carbonToken.balanceOf(user1), amount);
        assertEq(carbonToken.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    /**
     * @dev Test that only contract owner can set GreenTrace address
     */
    function test_SetGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        assertEq(carbonToken.greenTrace(), greenTrace);
    }

    /**
     * @dev Test that non-owner setting GreenTrace address will fail
     */
    function test_RevertWhen_SetGreenTraceNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        carbonToken.setGreenTrace(greenTrace);
    }

    /**
     * @dev Test that only GreenTrace contract can mint new tokens
     */
    function test_RevertWhen_MintNotGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        vm.prank(user1);
        vm.expectRevert("Only GreenTrace can mint");
        carbonToken.mint(user2, 100 ether);
    }

    /**
     * @dev Test that GreenTrace contract can mint new tokens normally
     */
    function test_MintByGreenTrace() public {
        carbonToken.setGreenTrace(greenTrace);
        vm.prank(greenTrace);
        carbonToken.mint(user2, 123 ether);
        assertEq(carbonToken.balanceOf(user2), 123 ether);
        assertEq(carbonToken.totalSupply(), INITIAL_SUPPLY + 123 ether);
    }
} 
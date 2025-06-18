// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title IUSDT
 * @dev Sepolia USDT合约的接口定义
 * @notice 这是Sepolia测试网上USDT合约的接口
 * @notice 合约地址: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 */
interface IUSDT is IERC20 {
    // USDT特有函数
    function decimals() external view returns (uint8);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
} 
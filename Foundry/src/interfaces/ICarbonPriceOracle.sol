// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICarbonPriceOracle
 * @dev 碳价预言机接口
 * @notice 用于获取碳价的参考价格
 */
interface ICarbonPriceOracle {
    /**
     * @dev 获取最新碳价（美元）
     * @return 碳价（美元）
     */
    function getLatestCarbonPriceUSD() external view returns (uint256);

    /**
     * @dev 获取最新碳价（欧元）
     * @return 碳价（欧元）
     */
    function getLatestCarbonPriceEUR() external view returns (uint256);
} 
// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

/**
 * @title ICarbonPriceOracle
 * @dev Carbon price oracle interface
 * @notice Used to get carbon price reference
 */
interface ICarbonPriceOracle {
    /**
     * @dev Get latest carbon price (USD)
     * @return Carbon price (USD)
     */
    function getLatestCarbonPriceUSD() external view returns (uint256);

    /**
     * @dev Get latest carbon price (EUR)
     * @return Carbon price (EUR)
     */
    function getLatestCarbonPriceEUR() external view returns (uint256);
} 
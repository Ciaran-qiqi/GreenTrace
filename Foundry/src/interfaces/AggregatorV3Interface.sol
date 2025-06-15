// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AggregatorV3Interface
 * @dev Chainlink价格预言机接口
 * @notice 用于获取实时价格数据
 */
interface AggregatorV3Interface {
    /**
     * @dev 获取价格精度
     * @return 价格精度（小数位数）
     */
    function decimals() external view returns (uint8);

    /**
     * @dev 获取价格描述
     * @return 价格描述（例如："BTC / USD"）
     */
    function description() external view returns (string memory);

    /**
     * @dev 获取版本号
     * @return 版本号
     */
    function version() external view returns (uint256);

    /**
     * @dev 获取指定轮次的价格数据
     * @param _roundId 轮次ID
     * @return roundId 轮次ID
     * @return answer 价格数据
     * @return startedAt 开始时间
     * @return updatedAt 更新时间
     * @return answeredInRound 回答轮次
     */
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    /**
     * @dev 获取最新价格数据
     * @return roundId 轮次ID
     * @return answer 价格数据
     * @return startedAt 开始时间
     * @return updatedAt 更新时间
     * @return answeredInRound 回答轮次
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
} 
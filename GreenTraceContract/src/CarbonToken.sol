// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title CarbonToken
 * @dev 碳币代币合约，实现ERC20标准
 * @notice 用于环保项目的碳信用代币，支持铸造、销毁和转账功能
 * 
 * 主要功能：
 * 1. 初始铸造：部署时铸造初始供应量
 * 2. 额外铸造：仅合约所有者可以铸造新代币
 * 3. 代币销毁：任何持有者都可以销毁自己的代币
 * 4. 代币转账：支持标准的ERC20转账功能
 */
contract CarbonToken is ERC20, Ownable {
    /**
     * @dev 构造函数
     * @param initialSupply 初始供应量，部署时一次性铸造
     * @notice 部署时会将所有初始代币铸造给合约部署者
     */
    constructor(uint256 initialSupply) ERC20("Carbon Token", "CARB") {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev 铸造新代币
     * @param to 接收地址
     * @param amount 铸造数量
     * @notice 只有合约所有者可以调用此函数
     * @notice 用于项目发展需要增发代币时使用
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev 销毁代币
     * @param amount 销毁数量
     * @notice 任何代币持有者都可以销毁自己的代币
     * @notice 销毁后总供应量会相应减少
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
} 
// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title CarbonToken
 * @dev 碳币代币合约，实现ERC20标准
 * @notice 用于环保项目的碳信用代币，代表经过审计的碳减排量
 * 
 * 主要功能：
 * 1. 初始铸造：部署时铸造初始供应量，用于系统运营
 * 2. 代币生成：通过销毁NFT兑换生成，生成数量由审计结果决定
 * 3. 代币分配：生成时自动分配系统手续费、审计费用和兑换数量
 * 4. 代币转账：支持标准的ERC20转账功能
 * 
 * 碳币生成逻辑：
 * 1. NFT持有者申请审计
 * 2. 审计者提交审计结果
 * 3. 系统确认审计结果
 * 4. 销毁NFT并生成对应数量的碳币
 * 5. 自动分配：
 *    - 系统手续费（1%）给系统钱包
 *    - 审计费用（4%）给审计者
 *    - 剩余数量（95%）给NFT持有者
 */
contract CarbonToken is ERC20, Ownable {
    // GreenTrace合约地址
    address public greenTrace;

    // 事件定义
    event GreenTraceUpdated(address indexed oldAddress, address indexed newAddress);
    event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);

    // 初始分配结构体
    struct InitialBalance {
        address to;
        uint256 amount;
    }

    /**
     * @dev 构造函数
     * @param initialBalances 初始分配数组，部署时一次性铸造给多个地址
     * @notice 部署时会将所有初始代币铸造给指定账户，用于系统运营和测试
     */
    constructor(InitialBalance[] memory initialBalances) ERC20("Carbon Token", "CARB") {
        for (uint i = 0; i < initialBalances.length; i++) {
            _mint(initialBalances[i].to, initialBalances[i].amount);
            emit TokensMinted(initialBalances[i].to, initialBalances[i].amount, block.timestamp);
        }
    }

    /**
     * @dev 设置GreenTrace合约地址
     * @param _greenTrace GreenTrace合约地址
     * @notice 只有合约所有者可以调用此函数（所以很多情况下要先设置地址才能调用）
     */
    function setGreenTrace(address _greenTrace) external onlyOwner {
        address oldAddress = greenTrace;
        greenTrace = _greenTrace;
        emit GreenTraceUpdated(oldAddress, _greenTrace);
    }

    /**
     * @dev 铸造碳币
     * @param to 接收地址
     * @param amount 铸造数量
     * @notice 只有GreenTrace合约可以调用此函数
     * @notice 用于NFT兑换时铸造新的碳币
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == greenTrace, "Only GreenTrace can mint");
        _mint(to, amount);
        emit TokensMinted(to, amount, block.timestamp);
    }
} 
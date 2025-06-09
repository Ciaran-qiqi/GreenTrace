// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesNFT.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GreenTrace
 * @dev 绿迹项目主合约，管理NFT和代币的铸造、销毁和分发
 * @notice 负责碳减排项目的审计、NFT兑换和费用分配
 * 
 * 主要功能：
 * 1. 审计管理：添加/移除审计人员，提交和完成审计
 * 2. NFT兑换：将NFT兑换为碳币，并分配相关费用
 * 3. 费用计算：计算系统手续费和审计费用
 * 4. 权限控制：管理审计人员白名单
 */
contract GreenTrace is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    
    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    GreenTalesNFT public greenTalesNFT;  // NFT合约
    bool public initialized;           // 初始化状态
    
    // 费用比例常量
    uint256 public constant SYSTEM_FEE_RATE = 100;  // 1%
    uint256 public constant AUDIT_FEE_RATE = 400;   // 4%
    uint256 public constant BASE_RATE = 10000;      // 100%
    
    // 审计状态枚举
    enum AuditStatus { Pending, Approved, Rejected }  // 待审核、已批准、已拒绝
    
    /**
     * @dev 审计结构体
     * @param auditor 审计人员地址
     * @param tokenId NFT ID
     * @param carbonValue 碳价值
     * @param status 审计状态
     * @param timestamp 审计时间
     */
    struct Audit {
        address auditor;           // 审计人员地址
        uint256 tokenId;          // NFT ID
        uint256 carbonValue;      // 碳价值
        AuditStatus status;       // 审计状态
        uint256 timestamp;        // 审计时间
    }
    
    // 映射关系
    mapping(uint256 => Audit) public audits;  // NFT ID => 审计信息
    mapping(address => bool) public auditors; // 审计人员白名单
    
    // 事件定义
    event AuditSubmitted(uint256 indexed tokenId, address indexed auditor, uint256 carbonValue);
    event AuditCompleted(uint256 indexed tokenId, AuditStatus status);
    event NFTExchanged(uint256 indexed tokenId, address indexed owner, uint256 carbonAmount);
    event AuditorAdded(address indexed auditor);
    event AuditorRemoved(address indexed auditor);
    
    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _greenTalesNFT NFT合约地址
     */
    constructor(address _carbonToken, address _greenTalesNFT) Ownable() {
        carbonToken = CarbonToken(_carbonToken);
        greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
    }

    /**
     * @dev 初始化函数
     * @notice 必须在部署后调用此函数完成初始化
     * @notice 只有合约所有者可以调用此函数
     */
    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        require(address(carbonToken) != address(0), "CarbonToken not set");
        require(address(greenTalesNFT) != address(0), "GreenTalesNFT not set");
        
        initialized = true;
    }

    /**
     * @dev 初始化检查修饰器
     * @notice 确保合约已经完成初始化
     */
    modifier whenInitialized() {
        require(initialized, "Not initialized");
        _;
    }
    
    /**
     * @dev 添加审计人员
     * @param _auditor 审计人员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function addAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = true;
        emit AuditorAdded(_auditor);
    }
    
    /**
     * @dev 移除审计人员
     * @param _auditor 审计人员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function removeAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = false;
        emit AuditorRemoved(_auditor);
    }
    
    /**
     * @dev 提交审计结果
     * @param _tokenId NFT ID
     * @param _carbonValue 碳价值
     * @notice 只有授权的审计人员可以调用此函数
     */
    function submitAudit(uint256 _tokenId, uint256 _carbonValue) external whenInitialized {
        require(auditors[msg.sender], "Not authorized auditor");
        require(audits[_tokenId].status == AuditStatus.Pending, "Audit already exists");
        
        audits[_tokenId] = Audit({
            auditor: msg.sender,
            tokenId: _tokenId,
            carbonValue: _carbonValue,
            status: AuditStatus.Pending,
            timestamp: block.timestamp
        });
        
        emit AuditSubmitted(_tokenId, msg.sender, _carbonValue);
    }
    
    /**
     * @dev 完成审计
     * @param _tokenId NFT ID
     * @param _status 审计状态
     * @notice 只有合约所有者可以调用此函数
     */
    function completeAudit(uint256 _tokenId, AuditStatus _status) external onlyOwner whenInitialized {
        require(audits[_tokenId].status == AuditStatus.Pending, "Audit not pending");
        audits[_tokenId].status = _status;
        emit AuditCompleted(_tokenId, _status);
    }
    
    /**
     * @dev 计算系统手续费
     * @param amount 总金额
     * @return 手续费金额
     * @notice 系统手续费为总金额的1%
     */
    function calculateSystemFee(uint256 amount) public pure returns (uint256) {
        return (amount * SYSTEM_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev 计算审计费用
     * @param amount 总金额
     * @return 审计费用金额
     * @notice 审计费用为总金额的4%
     */
    function calculateAuditFee(uint256 amount) public pure returns (uint256) {
        return (amount * AUDIT_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev 计算实际返还金额
     * @param amount 总金额
     * @return 实际返还金额
     * @notice 实际返还金额 = 总金额 - 系统手续费 - 审计费用
     */
    function calculateReturnAmount(uint256 amount) public pure returns (uint256) {
        return amount - calculateSystemFee(amount) - calculateAuditFee(amount);
    }
    
    /**
     * @dev 兑换NFT为碳币
     * @param _tokenId NFT ID
     * @notice NFT必须已经通过审计
     * @notice 会销毁NFT并铸造对应数量的碳币
     * @notice 碳币分配：
     *         1. 系统手续费（1%）给系统钱包
     *         2. 审计费用（4%）给审计者
     *         3. 剩余数量（95%）给NFT持有者
     */
    function exchangeNFT(uint256 _tokenId) external nonReentrant whenInitialized {
        require(greenTalesNFT.ownerOf(_tokenId) == msg.sender, "Not NFT owner");
        require(audits[_tokenId].status == AuditStatus.Approved, "Audit not approved");
        
        uint256 carbonValue = audits[_tokenId].carbonValue;
        address auditor = audits[_tokenId].auditor;
        
        // 计算费用
        uint256 systemFee = calculateSystemFee(carbonValue);
        uint256 auditFee = calculateAuditFee(carbonValue);
        uint256 returnAmount = calculateReturnAmount(carbonValue);
        
        // 销毁NFT
        greenTalesNFT.burn(_tokenId);
        
        // 铸造碳币并分配
        carbonToken.mint(owner(), systemFee);      // 系统手续费
        carbonToken.mint(auditor, auditFee);       // 审计费用
        carbonToken.mint(msg.sender, returnAmount); // 返还给NFT持有者
        
        emit NFTExchanged(_tokenId, msg.sender, carbonValue);
    }
} 
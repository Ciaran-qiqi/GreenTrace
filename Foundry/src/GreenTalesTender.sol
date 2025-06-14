// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/console.sol";
import "./CarbonToken.sol";
import "./GreenTalesNFT.sol";
import "./GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GreenTalesTender
 * @dev 绿色故事NFT招标合约
 * @notice 支持环保项目招标和投标，支持出资发起环境项目
 * 
 * 主要功能：
 * 1. 招标：招标人支付意向金和押金
 * 2. 投标：投标人支付押金
 * 3. 项目确认：双方确认项目完成情况
 * 4. 资金分配：根据项目完成情况分配资金
 */

contract GreenTalesTender is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    
    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    GreenTalesNFT public greenTalesNFT;  // NFT合约
    GreenTrace public greenTrace;      // GreenTrace合约
    address public feeCollector;       // 手续费接收地址
    
    // 招标状态枚举
    enum TenderStatus { 
        Active,         // 活跃
        BidAccepted,    // 已接受投标
        Completed,      // 完成
        Failed,         // 失败
        Cancelled       // 取消
    }
    
    /**
     * @dev 招标结构体
     * @param creator 招标人地址
     * @param bidder 投标人地址
     * @param status 招标状态
     * @param projectAmount 项目金额
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param creatorDeposit 招标人押金
     * @param bidderDeposit 投标人押金
     * @param metadataURI 元数据URI
     */
    struct Tender {
        address creator;           // 招标人地址
        address bidder;           // 投标人地址
        TenderStatus status;      // 招标状态
        uint256 projectAmount;    // 项目金额
        uint256 startTime;        // 开始时间
        uint256 endTime;          // 结束时间
        uint256 creatorDeposit;   // 招标人押金
        uint256 bidderDeposit;    // 投标人押金
        string metadataURI;       // 元数据URI
    }
    
    // 映射关系
    mapping(uint256 => Tender) public tenders;  // 招标ID => 招标信息
    
    // 常量
    uint256 public constant CREATOR_DEPOSIT_RATE = 3000;  // 招标人押金比例 30%
    uint256 public constant BIDDER_DEPOSIT_RATE = 2000;   // 投标人押金比例 20%
    uint256 public constant PLATFORM_FEE_RATE = 200;      // 平台手续费比例 2%
    uint256 public constant BASE_RATE = 10000;            // 基础比例 100%
    
    // 事件定义
    event TenderCreated(
        uint256 indexed tenderId, 
        address indexed creator, 
        uint256 projectAmount,
        uint256 endTime,
        string metadataURI
    );
    event BidPlaced(
        uint256 indexed tenderId, 
        address indexed bidder,
        uint256 bidderDeposit
    );
    event TenderCompleted(
        uint256 indexed tenderId, 
        bool success,
        uint256 platformFee,
        uint256 bidderAmount
    );
    event TenderCancelled(
        uint256 indexed tenderId,
        address indexed cancelledBy,
        uint256 refundAmount
    );
    event NFTMinted(
        uint256 indexed tenderId, 
        uint256 indexed tokenId, 
        address indexed owner
    );
    event StatusChanged(
        uint256 indexed tenderId, 
        uint8 oldStatus, 
        uint8 newStatus,
        address indexed changedBy,
        uint256 timestamp
    );
    
    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _greenTalesNFT NFT合约地址
     * @param _greenTrace GreenTrace合约地址
     * @param _feeCollector 手续费接收地址
     */
    constructor(
        address _carbonToken, 
        address _greenTalesNFT,
        address _greenTrace,
        address _feeCollector
    ) Ownable() {
        carbonToken = CarbonToken(_carbonToken);
        greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
        greenTrace = GreenTrace(_greenTrace);
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev 创建招标
     * @param _projectAmount 项目金额
     * @param _duration 持续时间
     * @param _metadataURI 元数据URI
     * @notice 招标人需要支付项目金额和30%的押金
     */
    function createTender(
        uint256 _projectAmount,
        uint256 _duration,
        string memory _metadataURI
    ) external nonReentrant {
        require(_projectAmount > 0, "GreenTalesTender: project amount must be greater than 0");
        require(_duration > 0, "GreenTalesTender: duration must be greater than 0");
        
        // 只收取押金，不收取项目金额
        uint256 creatorDeposit = (_projectAmount * CREATOR_DEPOSIT_RATE) / BASE_RATE;
        
        carbonToken.safeTransferFrom(msg.sender, address(this), creatorDeposit);
        
        uint256 tenderId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        tenders[tenderId] = Tender({
            creator: msg.sender,
            bidder: address(0),
            status: TenderStatus.Active,
            projectAmount: _projectAmount,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            creatorDeposit: creatorDeposit,
            bidderDeposit: 0,
            metadataURI: _metadataURI
        });
        
        emit TenderCreated(tenderId, msg.sender, _projectAmount, block.timestamp + _duration, _metadataURI);
    }
    
    /**
     * @dev 检查状态转换是否有效
     * @param from 当前状态
     * @param to 目标状态
     * @return bool 是否有效
     * @notice 状态转换规则：
     * 1. Active -> BidAccepted: 当有人投标时
     * 2. Active -> Cancelled: 当招标被取消时
     * 3. BidAccepted -> Completed: 当项目成功完成时
     * 4. BidAccepted -> Failed: 当项目失败时
     * 5. BidAccepted -> Cancelled: 当招标被取消时
     * 6. Completed/Failed/Cancelled: 不允许再转换
     */
    function _isValidStatusTransition(TenderStatus from, TenderStatus to) internal pure returns (bool) {
        // 已完成、失败或取消的状态不允许再转换
        if (from == TenderStatus.Completed || 
            from == TenderStatus.Failed || 
            from == TenderStatus.Cancelled) {
            return false;
        }
        
        // Active 状态只能转换到 BidAccepted 或 Cancelled
        if (from == TenderStatus.Active) {
            return to == TenderStatus.BidAccepted || to == TenderStatus.Cancelled;
        }
        
        // BidAccepted 状态只能转换到 Completed、Failed 或 Cancelled
        if (from == TenderStatus.BidAccepted) {
            return to == TenderStatus.Completed || 
                   to == TenderStatus.Failed || 
                   to == TenderStatus.Cancelled;
        }
        
        return false;
    }
    
    /**
     * @dev 获取招标状态
     * @param _tenderId 招标ID
     * @return uint8 招标状态
     */
    function getStatus(uint256 _tenderId) external view returns (uint8) {
        return uint8(tenders[_tenderId].status);
    }
    
    /**
     * @dev 投标
     * @param _tenderId 招标ID
     * @notice 投标人需要支付20%的押金
     */
    function placeBid(uint256 _tenderId) external nonReentrant {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Active, "Tender not active");
        require(block.timestamp < tender.endTime, "Tender ended");
        require(msg.sender != tender.creator, "Creator cannot bid");
        require(_isValidStatusTransition(tender.status, TenderStatus.BidAccepted), "Invalid status transition");
        
        uint256 bidderDeposit = (tender.projectAmount * BIDDER_DEPOSIT_RATE) / BASE_RATE;
        carbonToken.safeTransferFrom(msg.sender, address(this), bidderDeposit);
        
        tender.bidder = msg.sender;
        tender.bidderDeposit = bidderDeposit;
        
        uint8 oldStatus = uint8(tender.status);
        tender.status = TenderStatus.BidAccepted;
        emit StatusChanged(_tenderId, oldStatus, uint8(TenderStatus.BidAccepted), msg.sender, block.timestamp);
        
        emit BidPlaced(_tenderId, msg.sender, bidderDeposit);
    }
    
    /**
     * @dev 确认项目完成
     * @param _tenderId 招标ID
     * @param _success 是否成功
     * @notice 只有招标人或投标人可以调用此函数
     */
    function confirmCompletion(uint256 _tenderId, bool _success) external nonReentrant {
        Tender storage tender = tenders[_tenderId];
        require(msg.sender == tender.creator || msg.sender == tender.bidder, "Not authorized");
        require(tender.status == TenderStatus.BidAccepted, "Invalid status");
        require(block.timestamp >= tender.endTime, "Project not ended");
        
        uint8 oldStatus = uint8(tender.status);
        TenderStatus newStatus = _success ? TenderStatus.Completed : TenderStatus.Failed;
        require(_isValidStatusTransition(tender.status, newStatus), "Invalid status transition");
        
        tender.status = newStatus;
        emit StatusChanged(_tenderId, oldStatus, uint8(newStatus), msg.sender, block.timestamp);
        
        if (!_success) {
            // 项目失败，押金归平台
            carbonToken.safeTransfer(feeCollector, tender.creatorDeposit + tender.bidderDeposit);
            emit TenderCompleted(_tenderId, false, tender.creatorDeposit + tender.bidderDeposit, 0);
            return;
        }
        
        // 项目成功，收取项目金额
        carbonToken.safeTransferFrom(tender.creator, address(this), tender.projectAmount);
        
        // 退还押金
        carbonToken.safeTransfer(tender.creator, tender.creatorDeposit);
        carbonToken.safeTransfer(tender.bidder, tender.bidderDeposit);
        
        // 计算平台手续费
        uint256 platformFee = (tender.projectAmount * PLATFORM_FEE_RATE) / BASE_RATE;
        uint256 bidderAmount = tender.projectAmount - platformFee;
        
        // 转移项目资金
        carbonToken.safeTransfer(feeCollector, platformFee);
        carbonToken.safeTransfer(tender.bidder, bidderAmount);
        
        // 铸造NFT给招标人，使用项目金额作为初始价格
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            tender.creator,
            "Green Story",
            "A green story about carbon reduction",
            0,  // 碳减排量由主合约决定
            tender.projectAmount,  // 使用项目金额作为NFT的初始价格
            tender.metadataURI
        );
        
        emit NFTMinted(_tenderId, tokenId, tender.creator);
        emit TenderCompleted(_tenderId, true, platformFee, bidderAmount);
    }
    
    /**
     * @dev 取消招标
     * @param _tenderId 招标ID
     * @notice 只有招标人或合约所有者可以调用此函数
     * @notice 如果招标处于活跃状态且没有投标人，退还全部资金给招标人
     * @notice 如果已经有投标人，退还投标人押金，招标人押金归平台
     */
    function cancelTender(uint256 _tenderId) external {
        Tender storage tender = tenders[_tenderId];
        require(msg.sender == tender.creator || msg.sender == owner(), "Not authorized");
        require(tender.status == TenderStatus.Active || tender.status == TenderStatus.BidAccepted, "Invalid status");
        require(_isValidStatusTransition(tender.status, TenderStatus.Cancelled), "Invalid status transition");
        
        uint8 oldStatus = uint8(tender.status);
        tender.status = TenderStatus.Cancelled;
        emit StatusChanged(_tenderId, oldStatus, uint8(TenderStatus.Cancelled), msg.sender, block.timestamp);
        
        uint256 refundAmount;
        if (tender.bidder == address(0)) {
            // 没有投标人，退还招标人押金
            refundAmount = tender.creatorDeposit;
            carbonToken.safeTransfer(tender.creator, refundAmount);
        } else {
            // 有投标人，退还投标人押金，招标人押金归平台
            carbonToken.safeTransfer(tender.bidder, tender.bidderDeposit);
            carbonToken.safeTransfer(feeCollector, tender.creatorDeposit);
            refundAmount = tender.bidderDeposit;
        }
        
        emit TenderCancelled(_tenderId, msg.sender, refundAmount);
    }
    
    /**
     * @dev 更新手续费接收地址
     * @param _newFeeCollector 新的手续费接收地址
     */
    function updateFeeCollector(address _newFeeCollector) external onlyOwner {
        require(_newFeeCollector != address(0), "Invalid fee collector");
        feeCollector = _newFeeCollector;
    }
} 
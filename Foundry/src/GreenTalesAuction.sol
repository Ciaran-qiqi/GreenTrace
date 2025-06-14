// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesNFT.sol";
import "./GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";



/**
 * @title GreenTalesAuction
 * @dev 绿色故事NFT拍卖合约
 * @notice 支持供应拍卖（现货），支出环境项目被拍卖
 * 
 * 主要功能：
 * 1. 供应拍卖：用于拍卖已经完成的碳减排项目，创建者需要支付2%押金
 * 2. 出价管理：支持多个出价者参与竞拍，每次出价需要支付押金
 * 3. 拍卖完成：最高出价者支付剩余款项，其他竞拍者押金返还
 * 4. 拍卖取消：支持创建者或管理员取消拍卖，返还所有竞拍者押金，创建者押金没收
 */


contract GreenTalesAuction is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    
    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    GreenTalesNFT public greenTalesNFT;  // NFT合约
    GreenTrace public greenTrace;      // GreenTrace合约
    address public feeCollector;       // 手续费接收地址
    
    // 拍卖状态枚举
    enum AuctionStatus { Active, Completed, Cancelled }  // 活跃、完成、取消
    
    /**
     * @dev 拍卖结构体
     * @param creator 创建者地址
     * @param status 拍卖状态
     * @param startPrice 起始价格
     * @param endPrice 结束价格
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param expectedCarbon 预期碳减排量
     * @param metadataURI 元数据URI
     * @param creatorDeposit 创建者押金
     */
    struct Auction {
        address creator;           // 创建者地址
        AuctionStatus status;      // 拍卖状态
        uint256 startPrice;        // 起始价格
        uint256 endPrice;          // 结束价格
        uint256 startTime;         // 开始时间
        uint256 endTime;           // 结束时间
        uint256 expectedCarbon;    // 预期碳减排量
        string metadataURI;        // 元数据URI
        uint256 creatorDeposit;    // 创建者押金
    }
    
    /**
     * @dev 出价结构体
     * @param bidder 出价者地址
     * @param amount 出价金额
     * @param deposit 已支付押金
     * @param timestamp 出价时间
     */
    struct Bid {
        address bidder;            // 出价者
        uint256 amount;            // 出价金额
        uint256 deposit;           // 已支付押金
        uint256 timestamp;         // 出价时间
    }
    
    // 映射关系
    mapping(uint256 => Auction) public auctions;  // 拍卖ID => 拍卖信息
    mapping(uint256 => Bid[]) public bids;        // 拍卖ID => 出价列表
    mapping(uint256 => mapping(address => uint256)) public bidderDeposits;  // 拍卖ID => (出价者 => 押金)
    
    // 常量
    uint256 public constant DEPOSIT_RATE = 1000;  // 竞拍者押金比例 10%
    uint256 public constant CREATOR_DEPOSIT_RATE = 200;  // 创建者押金比例 2%
    uint256 public constant PLATFORM_FEE_RATE = 200;  // 平台手续费比例 2%
    uint256 public constant BASE_RATE = 10000;    // 基础比例 100%
    
    // 事件定义
    event AuctionCreated(
        uint256 indexed auctionId, 
        address indexed creator, 
        string metadataURI,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 expectedCarbon,
        uint256 creatorDeposit
    );
    event BidPlaced(
        uint256 indexed auctionId, 
        address indexed bidder, 
        uint256 amount,
        uint256 deposit,
        uint256 timestamp
    );
    event AuctionCompleted(
        uint256 indexed auctionId, 
        address indexed winner, 
        uint256 amount,
        uint256 platformFee,
        uint256 creatorAmount,
        uint256 creatorDepositRefunded
    );
    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed cancelledBy,
        uint256 creatorDepositForfeited
    );
    event NFTMinted(
        uint256 indexed auctionId, 
        uint256 indexed tokenId, 
        address indexed owner,
        uint256 price,
        uint256 carbonAmount
    );
    event StatusChanged(
        uint256 indexed auctionId, 
        uint8 oldStatus, 
        uint8 newStatus,
        address indexed changedBy,
        uint256 timestamp
    );
    event DepositRefunded(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
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
     * @dev 创建供应拍卖
     * @param _startPrice 起始价格
     * @param _endPrice 结束价格
     * @param _duration 持续时间
     * @param _expectedCarbon 预期碳减排量
     * @param _metadataURI 元数据URI
     * @notice 创建者需要支付2%的押金
     */
    function createSupplyAuction(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _duration,
        uint256 _expectedCarbon,
        string memory _metadataURI
    ) external {
        require(_startPrice > 0 && _endPrice >= _startPrice, "Invalid price range");
        require(_duration > 0, "Invalid duration");
        
        // 计算创建者押金
        uint256 creatorDeposit = (_startPrice * CREATOR_DEPOSIT_RATE) / BASE_RATE;
        
        // 转移押金到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), creatorDeposit);
        
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        auctions[auctionId] = Auction({
            creator: msg.sender,
            status: AuctionStatus.Active,
            startPrice: _startPrice,
            endPrice: _endPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            expectedCarbon: _expectedCarbon,
            metadataURI: _metadataURI,
            creatorDeposit: creatorDeposit
        });
        
        emit AuctionCreated(
            auctionId, 
            msg.sender, 
            _metadataURI,
            _startPrice,
            _endPrice,
            block.timestamp,
            block.timestamp + _duration,
            _expectedCarbon,
            creatorDeposit
        );
    }
    
    /**
     * @dev 出价
     * @param _auctionId 拍卖ID
     * @param _amount 出价金额
     * @notice 出价者需要支付押金，押金为出价金额的10%
     */
    function placeBid(uint256 _auctionId, uint256 _amount) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(_amount >= auction.startPrice, "Bid too low");
        
        // 计算押金
        uint256 deposit = (_amount * DEPOSIT_RATE) / BASE_RATE;
        
        // 转移押金到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), deposit);
        
        // 记录出价者的押金
        bidderDeposits[_auctionId][msg.sender] += deposit;
        
        // 记录出价
        bids[_auctionId].push(Bid({
            bidder: msg.sender,
            amount: _amount,
            deposit: deposit,
            timestamp: block.timestamp
        }));
        
        emit BidPlaced(_auctionId, msg.sender, _amount, deposit, block.timestamp);
    }
    
    /**
     * @dev 完成拍卖
     * @param _auctionId 拍卖ID
     * @notice 只有拍卖创建者可以调用此函数
     * @notice 拍卖必须已经结束
     * @notice 如果有出价，将铸造NFT并转移给出价最高者
     * @notice 返还创建者押金
     * @notice 这步gas费用796428，后期可优化
     */
    
    function completeAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(msg.sender == auction.creator, "Not auction creator");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.status == AuctionStatus.Active, "Auction not active");

        Bid[] storage auctionBids = bids[_auctionId];
        require(auctionBids.length > 0, "No bids");

        // 找到最高出价
        uint256 highestBidIndex = 0;
        uint256 highestBidAmount = 0;
        uint256 earliestTimestamp = type(uint256).max;

        for (uint256 i = 0; i < auctionBids.length; i++) {
            // 如果当前出价金额更高，或者金额相同但时间更早，则更新最高出价
            if (auctionBids[i].amount > highestBidAmount || 
                (auctionBids[i].amount == highestBidAmount && auctionBids[i].timestamp < earliestTimestamp)) {
                highestBidAmount = auctionBids[i].amount;
                highestBidIndex = i;
                earliestTimestamp = auctionBids[i].timestamp;
            }
        }

        // 更新拍卖状态
        uint8 oldStatus = uint8(auction.status);
        auction.status = AuctionStatus.Completed;
        emit StatusChanged(_auctionId, oldStatus, uint8(AuctionStatus.Completed), msg.sender, block.timestamp);

        // 计算平台手续费
        uint256 platformFee = (highestBidAmount * PLATFORM_FEE_RATE) / BASE_RATE;
        
        // 计算创建者获得的金额
        uint256 creatorAmount = highestBidAmount - platformFee;
        
        // 最高出价者需要支付剩余款项
        address winner = auctionBids[highestBidIndex].bidder;
        uint256 remainingPayment = highestBidAmount - auctionBids[highestBidIndex].deposit;
        carbonToken.safeTransferFrom(winner, address(this), remainingPayment);
        
        // 转移资金
        carbonToken.safeTransfer(feeCollector, platformFee);
        carbonToken.safeTransfer(auction.creator, creatorAmount);
        
        // 返还创建者押金
        carbonToken.safeTransfer(auction.creator, auction.creatorDeposit);
        
        // 铸造NFT给最高出价者
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            winner,
            "Green Story",
            "A green story about carbon reduction",
            auction.expectedCarbon,
            highestBidAmount,
            auction.metadataURI
        );
        
        // 返还其他竞拍者的押金
        for (uint256 i = 0; i < auctionBids.length; i++) {
            if (i != highestBidIndex) {
                address bidder = auctionBids[i].bidder;
                uint256 deposit = bidderDeposits[_auctionId][bidder];
                if (deposit > 0) {
                    carbonToken.safeTransfer(bidder, deposit);
                    bidderDeposits[_auctionId][bidder] = 0;
                    emit DepositRefunded(_auctionId, bidder, deposit);
                }
            }
        }
        
        emit NFTMinted(
            _auctionId, 
            tokenId, 
            winner,
            highestBidAmount,
            auction.expectedCarbon
        );

        emit AuctionCompleted(
            _auctionId, 
            winner, 
            highestBidAmount,
            platformFee,
            creatorAmount,
            auction.creatorDeposit
        );
    }
    
    /**
     * @dev 取消拍卖
     * @param _auctionId 拍卖ID
     * @notice 只有拍卖创建者或合约所有者可以调用此函数
     * @notice 会退还所有竞拍者的押金，创建者押金没收
     */
    function cancelAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(msg.sender == auction.creator || msg.sender == owner(), "Not authorized");
        require(auction.status == AuctionStatus.Active, "Auction not active");
        
        uint8 oldStatus = uint8(auction.status);
        auction.status = AuctionStatus.Cancelled;
        emit StatusChanged(_auctionId, oldStatus, uint8(AuctionStatus.Cancelled), msg.sender, block.timestamp);
        
        // 没收创建者押金
        uint256 creatorDeposit = auction.creatorDeposit;
        carbonToken.safeTransfer(feeCollector, creatorDeposit);
        
        // 退还所有竞拍者的押金
        Bid[] storage auctionBids = bids[_auctionId];
        for (uint256 i = 0; i < auctionBids.length; i++) {
            address bidder = auctionBids[i].bidder;
            uint256 deposit = bidderDeposits[_auctionId][bidder];
            if (deposit > 0) {
                carbonToken.safeTransfer(bidder, deposit);
                bidderDeposits[_auctionId][bidder] = 0;
                emit DepositRefunded(_auctionId, bidder, deposit);
            }
        }
        
        emit AuctionCancelled(_auctionId, msg.sender, creatorDeposit);
    }
    
    /**
     * @dev 更新手续费接收地址
     * @param _newCollector 新的接收地址
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        feeCollector = _newCollector;
    }
} 
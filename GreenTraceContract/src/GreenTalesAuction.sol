// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesNFT.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GreenTalesAuction
 * @dev 绿色故事NFT拍卖征集合约
 * @notice 支持两种拍卖模式：需求征集（期货）和供应拍卖（现货）
 * 
 * 主要功能：
 * 1. 需求征集：用于征集未来的碳减排项目
 * 2. 供应拍卖：用于拍卖已经完成的碳减排项目
 * 3. 出价管理：支持多个出价者参与竞拍
 * 4. 拍卖完成：自动铸造NFT并处理资金转移
 * 5. 拍卖取消：支持创建者或管理员取消拍卖
 */
contract GreenTalesAuction is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    
    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    GreenTalesNFT public greenTalesNFT;  // NFT合约
    
    // 拍卖类型枚举
    enum AuctionType { Demand, Supply }  // 需求征集、供应拍卖
    
    // 拍卖状态枚举
    enum AuctionStatus { Active, Completed, Cancelled }  // 活跃、完成、取消
    
    /**
     * @dev 拍卖结构体
     * @param creator 创建者地址
     * @param auctionType 拍卖类型（需求/供应）
     * @param status 拍卖状态
     * @param startPrice 起始价格
     * @param endPrice 结束价格
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param deposit 押金
     * @param expectedCarbon 预期碳减排量
     * @param metadataURI 元数据URI
     */
    struct Auction {
        address creator;           // 创建者地址
        AuctionType auctionType;   // 拍卖类型
        AuctionStatus status;      // 拍卖状态
        uint256 startPrice;        // 起始价格
        uint256 endPrice;          // 结束价格
        uint256 startTime;         // 开始时间
        uint256 endTime;           // 结束时间
        uint256 deposit;           // 押金
        uint256 expectedCarbon;    // 预期碳减排量
        string metadataURI;        // 元数据URI
    }
    
    /**
     * @dev 出价结构体
     * @param bidder 出价者地址
     * @param amount 出价金额
     * @param timestamp 出价时间
     */
    struct Bid {
        address bidder;            // 出价者
        uint256 amount;            // 出价金额
        uint256 timestamp;         // 出价时间
    }
    
    // 映射关系
    mapping(uint256 => Auction) public auctions;  // 拍卖ID => 拍卖信息
    mapping(uint256 => Bid[]) public bids;        // 拍卖ID => 出价列表
    mapping(uint256 => uint256) public deposits;  // 拍卖ID => 押金
    
    // 常量
    uint256 public constant DEPOSIT_RATE = 1000;  // 押金比例 10%
    uint256 public constant BASE_RATE = 10000;    // 基础比例 100%
    
    // 事件定义
    event AuctionCreated(
        uint256 indexed auctionId, 
        address indexed creator, 
        AuctionType auctionType,
        string metadataURI
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionCompleted(uint256 indexed auctionId, address indexed winner, uint256 amount);
    event AuctionCancelled(uint256 indexed auctionId);
    event NFTMinted(uint256 indexed auctionId, uint256 indexed tokenId, address indexed owner);
    
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
     * @dev 创建需求征集
     * @param _startPrice 起始价格
     * @param _endPrice 结束价格
     * @param _duration 持续时间
     * @param _expectedCarbon 预期碳减排量
     * @param _metadataURI 元数据URI
     * @notice 用于征集未来的碳减排项目，创建者需要支付押金
     */
    function createDemandAuction(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _duration,
        uint256 _expectedCarbon,
        string memory _metadataURI
    ) external nonReentrant {
        require(_startPrice > 0 && _endPrice >= _startPrice, "Invalid price range");
        require(_duration > 0, "Invalid duration");
        
        uint256 deposit = (_startPrice * DEPOSIT_RATE) / BASE_RATE;
        carbonToken.safeTransferFrom(msg.sender, address(this), deposit);
        
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        auctions[auctionId] = Auction({
            creator: msg.sender,
            auctionType: AuctionType.Demand,
            status: AuctionStatus.Active,
            startPrice: _startPrice,
            endPrice: _endPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            deposit: deposit,
            expectedCarbon: _expectedCarbon,
            metadataURI: _metadataURI
        });
        
        deposits[auctionId] = deposit;
        emit AuctionCreated(auctionId, msg.sender, AuctionType.Demand, _metadataURI);
    }
    
    /**
     * @dev 创建供应拍卖
     * @param _startPrice 起始价格
     * @param _endPrice 结束价格
     * @param _duration 持续时间
     * @param _expectedCarbon 预期碳减排量
     * @param _metadataURI 元数据URI
     * @notice 用于拍卖已经完成的碳减排项目，创建者需要支付押金
     */
    function createSupplyAuction(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _duration,
        uint256 _expectedCarbon,
        string memory _metadataURI
    ) external nonReentrant {
        require(_startPrice > 0 && _endPrice >= _startPrice, "Invalid price range");
        require(_duration > 0, "Invalid duration");
        
        uint256 deposit = (_startPrice * DEPOSIT_RATE) / BASE_RATE;
        carbonToken.safeTransferFrom(msg.sender, address(this), deposit);
        
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        auctions[auctionId] = Auction({
            creator: msg.sender,
            auctionType: AuctionType.Supply,
            status: AuctionStatus.Active,
            startPrice: _startPrice,
            endPrice: _endPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            deposit: deposit,
            expectedCarbon: _expectedCarbon,
            metadataURI: _metadataURI
        });
        
        deposits[auctionId] = deposit;
        emit AuctionCreated(auctionId, msg.sender, AuctionType.Supply, _metadataURI);
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
        
        uint256 deposit = (_amount * DEPOSIT_RATE) / BASE_RATE;
        carbonToken.safeTransferFrom(msg.sender, address(this), deposit);
        
        bids[_auctionId].push(Bid({
            bidder: msg.sender,
            amount: _amount,
            timestamp: block.timestamp
        }));
        
        deposits[_auctionId] += deposit;
        emit BidPlaced(_auctionId, msg.sender, _amount);
    }
    
    /**
     * @dev 完成拍卖
     * @param _auctionId 拍卖ID
     * @param _winnerIndex 获胜者索引
     * @notice 只有合约所有者可以调用此函数
     * @notice 会铸造NFT给获胜者，并处理资金转移
     */
    function completeAuction(uint256 _auctionId, uint256 _winnerIndex) external onlyOwner {
        Auction storage auction = auctions[_auctionId];
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(_winnerIndex < bids[_auctionId].length, "Invalid winner index");
        
        Bid memory winningBid = bids[_auctionId][_winnerIndex];
        auction.status = AuctionStatus.Completed;
        
        // 计算中标者需要支付的剩余金额
        uint256 totalAmount = winningBid.amount;
        uint256 remainingAmount = totalAmount - deposits[_auctionId];
        
        // 让中标者支付剩余金额
        carbonToken.safeTransferFrom(winningBid.bidder, address(this), remainingAmount);
        
        // 添加检查：确保碳币转移成功
        require(carbonToken.balanceOf(address(this)) >= totalAmount, "Insufficient carbon token balance");
        
        // 铸造NFT，使用metadataURI，设置初始价格为中标价格
        uint256 tokenId = greenTalesNFT.mint(
            winningBid.bidder,
            "Green Story",  // 故事标题
            "A green story about carbon reduction",  // 故事详情
            auction.expectedCarbon,
            winningBid.amount,  // 设置初始价格为中标价格
            auction.metadataURI
        );
        
        // 转移资金给创建者
        carbonToken.safeTransfer(auction.creator, totalAmount);
        
        emit AuctionCompleted(_auctionId, winningBid.bidder, winningBid.amount);
        emit NFTMinted(_auctionId, tokenId, winningBid.bidder);
    }
    
    /**
     * @dev 取消拍卖
     * @param _auctionId 拍卖ID
     * @notice 只有拍卖创建者或合约所有者可以调用此函数
     * @notice 会退还押金给创建者
     */
    function cancelAuction(uint256 _auctionId) external {
        Auction storage auction = auctions[_auctionId];
        require(msg.sender == auction.creator || msg.sender == owner(), "Not authorized");
        require(auction.status == AuctionStatus.Active, "Auction not active");
        
        auction.status = AuctionStatus.Cancelled;
        
        // 退还押金
        carbonToken.safeTransfer(auction.creator, deposits[_auctionId]);
        
        emit AuctionCancelled(_auctionId);
    }
} 
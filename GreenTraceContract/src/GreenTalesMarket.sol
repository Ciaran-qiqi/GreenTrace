// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GreenTalesNFT.sol";
import "./CarbonToken.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GreenTalesMarket
 * @dev NFT交易市场合约，支持NFT的挂单、购买、取消挂单等功能
 * @notice 使用碳币作为交易货币，支持NFT的二级市场交易
 * 
 * 主要功能：
 * 1. NFT挂单：NFT持有者可以设置价格并挂单
 * 2. NFT购买：用户可以使用碳币购买已挂单的NFT
 * 3. 取消挂单：NFT持有者可以取消已挂单的NFT
 * 4. 价格管理：支持查看NFT当前挂单价格和历史成交价格
 * 5. 交易费用：支持设置和收取交易手续费
 */
contract GreenTalesMarket is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for CarbonToken;

    // 合约状态变量
    GreenTalesNFT public nftContract;     // NFT合约
    CarbonToken public carbonToken;        // 碳币合约
    uint256 public platformFeeRate;        // 平台手续费率（基点，1基点 = 0.01%）
    address public feeCollector;           // 手续费接收地址
    bool public initialized;               // 初始化状态

    // 挂单信息结构体
    struct Listing {
        address seller;        // 卖家地址
        uint256 price;        // 挂单价格（碳币数量）
        uint256 timestamp;    // 挂单时间
        bool isActive;        // 是否有效
    }

    // 历史成交记录结构体
    struct TradeHistory {
        address seller;       // 卖家地址
        address buyer;        // 买家地址
        uint256 price;        // 成交价格
        uint256 timestamp;    // 成交时间
    }

    // 映射关系
    mapping(uint256 => Listing) public listings;              // NFT ID => 挂单信息
    mapping(uint256 => TradeHistory[]) public tradeHistory;   // NFT ID => 历史成交记录
    mapping(uint256 => uint256) public lastTradePrice;        // NFT ID => 最后成交价格

    // 事件定义
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event PlatformFeeRateUpdated(uint256 newRate);
    event FeeCollectorUpdated(address newCollector);

    /**
     * @dev 构造函数
     * @param _nftContract NFT合约地址
     * @param _carbonToken 碳币合约地址
     * @param _platformFeeRate 平台手续费率（基点）
     * @param _feeCollector 手续费接收地址
     */
    constructor(
        address _nftContract,
        address _carbonToken,
        uint256 _platformFeeRate,
        address _feeCollector
    ) Ownable() {
        nftContract = GreenTalesNFT(_nftContract);
        carbonToken = CarbonToken(_carbonToken);
        platformFeeRate = _platformFeeRate;
        feeCollector = _feeCollector;
    }

    /**
     * @dev 初始化函数
     * @notice 必须在部署后调用此函数完成初始化
     */
    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        require(address(nftContract) != address(0), "NFT contract not set");
        require(address(carbonToken) != address(0), "CarbonToken not set");
        require(feeCollector != address(0), "Fee collector not set");
        
        initialized = true;
    }

    /**
     * @dev 初始化检查修饰器
     */
    modifier whenInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    /**
     * @dev 更新平台手续费率
     * @param _newRate 新的手续费率（基点）
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Fee rate too high"); // 最高10%
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(_newRate);
    }

    /**
     * @dev 更新手续费接收地址
     * @param _newCollector 新的接收地址
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid address");
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(_newCollector);
    }

    /**
     * @dev 挂单NFT
     * @param _tokenId NFT ID
     * @param _price 挂单价格（碳币数量）
     */
    function listNFT(uint256 _tokenId, uint256 _price) external whenInitialized {
        require(nftContract.ownerOf(_tokenId) == msg.sender, "Not NFT owner");
        require(_price > 0, "Price must be greater than 0");
        require(!listings[_tokenId].isActive, "NFT already listed");

        // 转移NFT到合约
        nftContract.safeTransferFrom(msg.sender, address(this), _tokenId);

        // 创建挂单信息
        listings[_tokenId] = Listing({
            seller: msg.sender,
            price: _price,
            timestamp: block.timestamp,
            isActive: true
        });

        emit NFTListed(_tokenId, msg.sender, _price);
    }

    /**
     * @dev 购买NFT
     * @param _tokenId NFT ID
     */
    function buyNFT(uint256 _tokenId) external nonReentrant whenInitialized {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");

        uint256 price = listing.price;
        uint256 platformFee = (price * platformFeeRate) / 10000;
        uint256 sellerAmount = price - platformFee;

        // 转移碳币
        carbonToken.safeTransferFrom(msg.sender, feeCollector, platformFee);
        carbonToken.safeTransferFrom(msg.sender, listing.seller, sellerAmount);

        // 转移NFT
        nftContract.safeTransferFrom(address(this), msg.sender, _tokenId);

        // 更新历史记录
        tradeHistory[_tokenId].push(TradeHistory({
            seller: listing.seller,
            buyer: msg.sender,
            price: price,
            timestamp: block.timestamp
        }));
        lastTradePrice[_tokenId] = price;

        // 更新NFT的最后成交价格
        nftContract.updateLastPrice(_tokenId, price);

        // 清除挂单信息
        delete listings[_tokenId];

        emit NFTSold(_tokenId, listing.seller, msg.sender, price);
    }

    /**
     * @dev 取消挂单
     * @param _tokenId NFT ID
     */
    function cancelListing(uint256 _tokenId) external whenInitialized {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");

        // 返还NFT给卖家
        nftContract.safeTransferFrom(address(this), msg.sender, _tokenId);

        // 清除挂单信息
        delete listings[_tokenId];

        emit ListingCancelled(_tokenId, msg.sender);
    }

    /**
     * @dev 获取NFT的历史成交记录
     * @param _tokenId NFT ID
     * @return 历史成交记录数组
     */
    function getTradeHistory(uint256 _tokenId) external view returns (TradeHistory[] memory) {
        return tradeHistory[_tokenId];
    }

    /**
     * @dev 获取NFT的最后成交价格
     * @param _tokenId NFT ID
     * @return 最后成交价格
     */
    function getLastTradePrice(uint256 _tokenId) external view returns (uint256) {
        return lastTradePrice[_tokenId];
    }

    /**
     * @dev 实现 IERC721Receiver 接口，允许本合约安全接收 NFT
     * @notice 这样 NFT safeTransferFrom 到本合约不会 revert
     * @param operator 操作人地址
     * @param from NFT 发送者地址
     * @param tokenId NFT ID
     * @param data 附加数据
     * @return 返回 IERC721Receiver 接口的 selector，表示接收成功
     */
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external pure override returns (bytes4) {
        // 返回 IERC721Receiver 接口的 selector，表示接收成功
        return IERC721Receiver.onERC721Received.selector;
    }
} 
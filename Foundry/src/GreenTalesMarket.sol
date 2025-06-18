// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "./GreenTalesNFT.sol";
import "./CarbonToken.sol";
import "./GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
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
 * 6. 价格同步：与GreenTrace合约同步NFT价格信息
 */
contract GreenTalesMarket is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for CarbonToken;

    // 合约状态变量
    GreenTalesNFT public nftContract;     // NFT合约
    CarbonToken public carbonToken;        // 碳币合约
    GreenTrace public greenTrace;          // GreenTrace合约
    uint256 public platformFeeRate;        // 平台手续费率（基点，1基点 = 0.01%）
    address public feeCollector;           // 手续费接收地址

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
    event NFTListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 timestamp
    );
    event NFTSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 platformFee,
        uint256 sellerAmount,
        uint256 timestamp
    );
    event ListingCancelled(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 timestamp
    );
    event PriceUpdated(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    event PlatformFeeRateUpdated(uint256 newRate);
    event FeeCollectorUpdated(address newCollector);

    /**
     * @dev 构造函数
     * @param _nftContract NFT合约地址
     * @param _carbonToken 碳币合约地址
     * @param _platformFeeRate 平台手续费率（基点）
     * @param _feeCollector 手续费接收地址
     * @param _greenTrace GreenTrace合约地址
     */
    constructor(
        address _nftContract,
        address _carbonToken,
        uint256 _platformFeeRate,
        address _feeCollector,
        address _greenTrace
    ) Ownable() {
        nftContract = GreenTalesNFT(_nftContract);
        carbonToken = CarbonToken(_carbonToken);
        platformFeeRate = _platformFeeRate;
        feeCollector = _feeCollector;
        greenTrace = GreenTrace(_greenTrace);
    }

    /**
     * @dev 更新平台手续费率
     * @param _newRate 新的手续费率（基点）
     * @notice 只有合约所有者可以调用此函数
     * @notice 手续费率最高为10%（1000基点）
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Fee rate too high"); // 最高10%
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(_newRate);
    }

    /**
     * @dev 更新手续费接收地址
     * @param _newCollector 新的接收地址
     * @notice 只有合约所有者可以调用此函数
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(_newCollector);
    }

    /**
     * @dev 挂单NFT
     * @param _tokenId NFT ID
     * @param _price 挂单价格（碳币数量）
     * @notice NFT持有者可以设置价格并挂单
     * @notice 挂单后NFT会转移到合约中
     */
    function listNFT(uint256 _tokenId, uint256 _price) external {
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

        emit NFTListed(_tokenId, msg.sender, _price, block.timestamp);
    }

    /**
     * @dev 购买NFT
     * @param _tokenId NFT ID
     * @notice 购买者需要支付足够的碳币
     * @notice 购买成功后，NFT将转移给购买者
     * @notice 交易完成后会自动更新NFT价格
     */
    function buyNFT(uint256 _tokenId) external nonReentrant {
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

        // 通过 GreenTrace 更新 NFT 价格
        greenTrace.updateNFTPriceByBusiness(_tokenId, price);

        // 清除挂单信息
        delete listings[_tokenId];

        emit NFTSold(
            _tokenId,
            listing.seller,
            msg.sender,
            price,
            platformFee,
            sellerAmount,
            block.timestamp
        );
    }

    /**
     * @dev 取消挂单
     * @param _tokenId NFT ID
     * @notice 只有挂单者可以取消挂单
     * @notice 取消后NFT会返还给挂单者
     */
    function cancelListing(uint256 _tokenId) external {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");

        // 返还NFT给卖家
        nftContract.safeTransferFrom(address(this), msg.sender, _tokenId);

        // 清除挂单信息
        delete listings[_tokenId];

        emit ListingCancelled(_tokenId, msg.sender, block.timestamp);
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
     * @dev 更新NFT价格
     * @param _tokenId NFT ID
     * @param _newPrice 新的价格（碳币数量）
     * @notice 只有挂单者可以更新价格
     * @notice 新价格必须大于0
     */
    function updatePrice(uint256 _tokenId, uint256 _newPrice) external {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");
        require(_newPrice > 0, "Price must be greater than 0");
        
        uint256 oldPrice = listing.price;
        listing.price = _newPrice;
        
        emit PriceUpdated(_tokenId, msg.sender, oldPrice, _newPrice, block.timestamp);
    }

    /**
     * @dev 实现 IERC721Receiver 接口，允许本合约安全接收 NFT
     * @notice 这样 NFT safeTransferFrom 到本合约不会 revert
     * @return 返回 IERC721Receiver 接口的 selector，表示接收成功
     */
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        // 返回 IERC721Receiver 接口的 selector，表示接收成功
        return IERC721Receiver.onERC721Received.selector;
    }
} 
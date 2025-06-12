// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title GreenTalesNFT
 * @dev 绿色故事NFT合约，实现ERC721标准，支持铸造、销毁、分发
 * @notice 用于记录和追踪碳减排项目的NFT，每个NFT代表一个环保故事
 * 
 * 主要功能：
 * 1. NFT铸造：记录环保故事和碳减排量
 * 2. NFT销毁：支持销毁不再需要的NFT
 * 3. 元数据管理：存储故事标题、详情和碳减排量
 * 4. 权限控制：只有授权的铸造者可以创建NFT
 * 5. 价格记录：记录NFT的初次成交价格和最后成交价格
 */
contract GreenTalesNFT is ERC721URIStorage, Ownable {
    // 下一个要铸造的NFT ID
    uint256 public nextTokenId;
    // GreenTrace合约地址
    address public greenTrace;
    // 是否为测试环境
    bool public isTestEnvironment;

    /**
     * @dev 故事元数据结构
     * @param storyTitle 故事标题
     * @param storyDetail 故事详情
     * @param carbonReduction 预期减少的碳排放量
     * @param createTime 故事创建时间
     * @param initialPrice 初次成交价格
     * @param lastPrice 最后成交价格
     */
    struct StoryMeta {
        string storyTitle;         // 故事标题
        string storyDetail;        // 故事详情
        uint256 carbonReduction;   // 预期减少的碳排放量
        uint256 createTime;        // 故事创建时间
        uint256 initialPrice;      // 初次成交价格
        uint256 lastPrice;         // 最后成交价格
    }

    // NFT ID => 故事元数据
    mapping(uint256 => StoryMeta) public storyMetadata;

    // 事件定义
    event Minted(address indexed to, uint256 indexed tokenId, string storyTitle);
    event Burned(uint256 indexed tokenId);
    event PriceUpdated(uint256 indexed tokenId, uint256 price, bool isInitial);
    event StoryMetaUpdated(
        uint256 indexed tokenId,
        string storyTitle,
        string storyDetail,
        uint256 carbonReduction,
        uint256 timestamp
    );
    event GreenTraceUpdated(address indexed oldAddress, address indexed newAddress);

    /**
     * @dev 构造函数
     * @param _greenTrace GreenTrace合约地址
     * @notice 初始化NFT名称和符号，并设置GreenTrace为铸造者
     * @notice 自动检测部署环境，在测试网络（Goerli/Sepolia/Local）上启用测试模式
     */
    constructor(address _greenTrace) ERC721("GreenTales", "GT") {
        require(_greenTrace != address(0), "Invalid GreenTrace address");
        greenTrace = _greenTrace;
        // 通过检查链ID来判断是否为测试环境
        // 1: Ethereum Mainnet
        // 5: Goerli Testnet
        // 11155111: Sepolia Testnet
        // 31337: Hardhat/Foundry Local Network
        uint256 chainId = block.chainid;
        isTestEnvironment = (chainId == 5 || chainId == 11155111 || chainId == 31337);
    }

    /**
     * @dev 只有主合约（GreenTrace）可以调用的修饰符
     * @notice 测试环境下允许测试合约直接调用
     */
    modifier onlyGreenTrace() {
        if (isTestEnvironment) {
            require(msg.sender == greenTrace || msg.sender == owner(), "Not authorized: Only GreenTrace or test owner");
        } else {
            require(msg.sender == greenTrace, "Not authorized: Only GreenTrace can call");
        }
        _;
    }

    /**
     * @dev 铸造新的NFT
     * @param to 接收地址
     * @param storyTitle 故事标题
     * @param storyDetail 故事详情
     * @param carbonReduction 碳减排量
     * @param initialPrice 初次成交价格
     * @param tokenURI NFT元数据URI
     * @return tokenId 新铸造的NFT ID
     * @notice 只有主合约（GreenTrace）可以调用
     */
    function mint(
        address to,
        string memory storyTitle,
        string memory storyDetail,
        uint256 carbonReduction,
        uint256 initialPrice,
        string memory tokenURI
    ) external onlyGreenTrace returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        storyMetadata[tokenId] = StoryMeta({
            storyTitle: storyTitle,
            storyDetail: storyDetail,
            carbonReduction: carbonReduction,
            createTime: block.timestamp,
            initialPrice: initialPrice,
            lastPrice: initialPrice
        });
        emit Minted(to, tokenId, storyTitle);
        emit PriceUpdated(tokenId, initialPrice, true);
        emit StoryMetaUpdated(tokenId, storyTitle, storyDetail, carbonReduction, block.timestamp);
        return tokenId;
    }

    /**
     * @dev 更新NFT的最后成交价格
     * @param tokenId NFT ID
     * @param newPrice 新的成交价格
     * @notice 只有主合约（GreenTrace）可以调用
     */
    function updateLastPrice(uint256 tokenId, uint256 newPrice) external onlyGreenTrace {
        require(_exists(tokenId), "Token does not exist");
        storyMetadata[tokenId].lastPrice = newPrice;
        emit PriceUpdated(tokenId, newPrice, false);
    }

    /**
     * @dev 销毁NFT
     * @param tokenId 要销毁的NFT ID
     * @notice 只有NFT所有者或被授权者可以调用此函数
     */
    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        _burn(tokenId);
        delete storyMetadata[tokenId];
        emit Burned(tokenId);
    }

    /**
     * @dev 获取NFT的故事元数据
     * @param tokenId NFT ID
     * @return StoryMeta 包含故事标题、详情、碳减排量和创建时间的结构体
     * @notice 如果NFT不存在会抛出异常
     */
    function getStoryMeta(uint256 tokenId) external view returns (StoryMeta memory) {
        require(_exists(tokenId), "Token does not exist");
        return storyMetadata[tokenId];
    }

    /**
     * @dev 设置 GreenTrace 合约地址
     * @param _greenTrace 新的 GreenTrace 合约地址
     * @notice 只有合约所有者可以调用此函数
     */
    function setGreenTrace(address _greenTrace) external onlyOwner {
        require(_greenTrace != address(0), "Invalid GreenTrace address");
        address oldAddress = greenTrace;
        greenTrace = _greenTrace;
        emit GreenTraceUpdated(oldAddress, _greenTrace);
    }
} 
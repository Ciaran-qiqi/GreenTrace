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
    // 授权铸造者地址
    address public minter;
    // GreenTrace合约地址
    address public greenTrace;
    // 额外的 minter 映射
    mapping(address => bool) public additionalMinters;

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
    mapping(uint256 => StoryMeta) public storyMetas;

    // 事件定义
    event Minted(address indexed to, uint256 indexed tokenId, string storyTitle);
    event Burned(uint256 indexed tokenId);
    event MinterChanged(address indexed newMinter);
    event PriceUpdated(uint256 indexed tokenId, uint256 price, bool isInitial);

    /**
     * @dev 仅铸造者修饰器
     * @notice 确保只有授权的铸造者可以调用特定函数
     */
    modifier onlyMinter() {
        require(msg.sender == minter || additionalMinters[msg.sender], "Not authorized");
        _;
    }

    /**
     * @dev 构造函数
     * @param _greenTrace GreenTrace合约地址
     * @notice 初始化NFT名称和符号，并设置GreenTrace为铸造者
     */
    constructor(address _greenTrace) ERC721("GreenTales NFT", "GTN") {
        require(_greenTrace != address(0), "Invalid GreenTrace address");
        greenTrace = _greenTrace;
        minter = _greenTrace;
    }

    /**
     * @dev 设置铸造者地址
     * @param _minter 新的铸造者地址
     * @notice 只有合约所有者可以调用此函数
     * @notice 主要用于测试环境，生产环境默认使用GreenTrace
     * @notice 【安全提示】生产环境请勿将业务合约（如Auction/Market）设置为minter，仅允许主合约GreenTrace为minter
     */
    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
        emit MinterChanged(_minter);
    }

    /**
     * @dev 添加额外的铸造者
     * @param _minter 要添加的铸造者地址
     * @notice 只有合约所有者可以调用此函数
     * @notice 仅用于测试环境，方便业务合约直接调用mint/updateLastPrice
     * @notice 【安全提示】生产环境请勿授权业务合约（如Auction/Market）为minter，仅允许主合约GreenTrace为minter
     */
    function addMinter(address _minter) external onlyOwner {
        additionalMinters[_minter] = true;
        emit MinterChanged(_minter);
    }

    /**
     * @dev 移除额外的铸造者
     * @param _minter 要移除的铸造者地址
     * @notice 只有合约所有者可以调用此函数
     * @notice 仅用于测试环境，生产环境下无需调用
     * @notice 【安全提示】生产环境请勿授权业务合约（如Auction/Market）为minter，仅允许主合约GreenTrace为minter
     */
    function removeMinter(address _minter) external onlyOwner {
        additionalMinters[_minter] = false;
        emit MinterChanged(address(0));
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
     * @notice 只有授权的铸造者可以调用此函数
     */
    function mint(
        address to,
        string memory storyTitle,
        string memory storyDetail,
        uint256 carbonReduction,
        uint256 initialPrice,
        string memory tokenURI
    ) external onlyMinter returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        storyMetas[tokenId] = StoryMeta({
            storyTitle: storyTitle,
            storyDetail: storyDetail,
            carbonReduction: carbonReduction,
            createTime: block.timestamp,
            initialPrice: initialPrice,
            lastPrice: initialPrice
        });
        emit Minted(to, tokenId, storyTitle);
        emit PriceUpdated(tokenId, initialPrice, true);
        return tokenId;
    }

    /**
     * @dev 更新NFT的最后成交价格
     * @param tokenId NFT ID
     * @param newPrice 新的成交价格
     * @notice 只有授权的铸造者可以调用此函数
     */
    function updateLastPrice(uint256 tokenId, uint256 newPrice) external onlyMinter {
        require(_exists(tokenId), "Token does not exist");
        storyMetas[tokenId].lastPrice = newPrice;
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
        delete storyMetas[tokenId];
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
        return storyMetas[tokenId];
    }
} 
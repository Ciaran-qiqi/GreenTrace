// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title GreenTalesNFT
 * @dev Green story NFT contract, implements ERC721 standard, supports minting, burning, distribution
 * @notice Used to record and track carbon reduction project NFTs, each NFT represents an environmental story
 * 
 * Main features:
 * 1. NFT minting: Records environmental stories and carbon reduction amounts
 * 2. NFT burning: Supports burning NFTs that are no longer needed
 * 3. Metadata management: Stores story title, details and carbon reduction amount
 * 4. Permission control: Only authorized minters can create NFTs
 * 5. Price recording: Records NFT's initial trade price and last trade price
 */
contract GreenTalesNFT is ERC721URIStorage, Ownable {
    // Next NFT ID to mint
    uint256 public nextTokenId;
    // GreenTrace contract address
    address public greenTrace;
    // Whether it's a test environment
    bool public isTestEnvironment;

    /**
     * @dev Story metadata struct
     * @param storyTitle Story title
     * @param storyDetail Story details
     * @param carbonReduction Expected carbon emission reduction amount
     * @param createTime Story creation time
     * @param initialPrice Initial trade price
     * @param lastPrice Last trade price
     */
    struct StoryMeta {
        string storyTitle;         // Story title
        string storyDetail;        // Story details
        uint256 carbonReduction;   // Expected carbon emission reduction amount
        uint256 createTime;        // Story creation time
        uint256 initialPrice;      // Initial trade price
        uint256 lastPrice;         // Last trade price
    }

    // NFT ID => Story metadata
    mapping(uint256 => StoryMeta) public storyMetadata;
    
    // Events
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
     * @dev Constructor
     * @param _greenTrace GreenTrace contract address
     * @notice Initializes NFT name and symbol, and sets GreenTrace as minter
     * @notice Automatically detects deployment environment, enables test mode on test networks (Goerli/Sepolia/Local)
     */
    constructor(address _greenTrace) ERC721("GreenTales", "GT") {
        require(_greenTrace != address(0), "Invalid GreenTrace address");
        greenTrace = _greenTrace;
        // Determine if it's a test environment by checking chain ID
        // 1: Ethereum Mainnet
        // 5: Goerli Testnet
        // 11155111: Sepolia Testnet
        // 31337: Hardhat/Foundry Local Network
        uint256 chainId = block.chainid;
        isTestEnvironment = (chainId == 5 || chainId == 11155111 || chainId == 31337);
    }

    /**
     * @dev Modifier that only main contract (GreenTrace) can call
     * @notice In test environment, allows test contracts to call directly
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
     * @dev Mint new NFT
     * @param to Recipient address
     * @param storyTitle Story title
     * @param storyDetail Story details
     * @param carbonReduction Carbon reduction amount
     * @param initialPrice Initial trade price
     * @param tokenURI NFT metadata URI
     * @return tokenId Newly minted NFT ID
     * @notice Only main contract (GreenTrace) can call
     */
    function mint(
        address to,
        string memory storyTitle,
        string memory storyDetail,
        uint256 carbonReduction,
        uint256 initialPrice,
        string memory tokenURI
    ) external onlyGreenTrace returns (uint256) {
        // Check if initial price meets minimum requirement (at least 1 carbon token)
        require(initialPrice >= 1 * 10**18, "Initial price must be at least 1 carbon token");
        
        uint256 tokenId = nextTokenId++;
        // Auto-increment
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
     * @dev Update NFT's last trade price
     * @param tokenId NFT ID
     * @param newPrice New trade price
     * @notice Only main contract (GreenTrace) can call
     */
    function updateLastPrice(uint256 tokenId, uint256 newPrice) external onlyGreenTrace {
        require(_exists(tokenId), "Token does not exist");
        storyMetadata[tokenId].lastPrice = newPrice;
        emit PriceUpdated(tokenId, newPrice, false);
    }

    /**
     * @dev Burn NFT
     * @param tokenId NFT ID to burn
     * @notice Only NFT owner or authorized party can call this function
     */
    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        _burn(tokenId);
        delete storyMetadata[tokenId];
        emit Burned(tokenId);
    }

    /**
     * @dev Get NFT's story metadata
     * @param tokenId NFT ID
     * @return StoryMeta Struct containing story title, details, carbon reduction amount and creation time
     * @notice Throws exception if NFT doesn't exist
     */
    function getStoryMeta(uint256 tokenId) external view returns (StoryMeta memory) {
        require(_exists(tokenId), "Token does not exist");
        return storyMetadata[tokenId];
    }

    /**
     * @dev Set GreenTrace contract address
     * @param _greenTrace New GreenTrace contract address
     * @notice Only contract owner can call this function
     */
    function setGreenTrace(address _greenTrace) external onlyOwner {
        require(_greenTrace != address(0), "Invalid GreenTrace address");
        address oldAddress = greenTrace;
        greenTrace = _greenTrace;
        emit GreenTraceUpdated(oldAddress, _greenTrace);
    }
} 
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
import "forge-std/console.sol";

/**
 * @title GreenTalesMarket
 * @dev NFT trading market contract, supports NFT listing, buying, canceling listings, etc.
 * @notice Uses carbon tokens as trading currency, supports NFT secondary market trading
 * 
 * Main features:
 * 1. NFT listing: NFT holders can set prices and list
 * 2. NFT buying: Users can buy listed NFTs with carbon tokens
 * 3. Cancel listing: NFT holders can cancel listed NFTs
 * 4. Price management: Supports viewing current listing price and historical trade prices
 * 5. Trading fees: Supports setting and collecting trading fees
 * 6. Price synchronization: Synchronizes NFT price information with GreenTrace contract
 */
contract GreenTalesMarket is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for CarbonToken;

    // Contract state variables
    GreenTalesNFT public nftContract;     // NFT contract
    CarbonToken public carbonToken;        // Carbon token contract
    GreenTrace public greenTrace;          // GreenTrace contract
    uint256 public platformFeeRate;        // Platform fee rate (basis points, 1 bp = 0.01%)
    address public feeCollector;           // Fee collector address

    // Listing information struct
    struct Listing {
        address seller;        // Seller address
        uint256 price;        // Listing price (carbon token amount)
        uint256 timestamp;    // Listing timestamp
        bool isActive;        // Whether active
    }

    // Historical trade record struct
    struct TradeHistory {
        address seller;       // Seller address
        address buyer;        // Buyer address
        uint256 price;        // Trade price
        uint256 timestamp;    // Trade timestamp
    }

    // Mappings
    mapping(uint256 => Listing) public listings;              // NFT ID => Listing info
    mapping(uint256 => TradeHistory[]) public tradeHistory;   // NFT ID => Historical trade records
    mapping(uint256 => uint256) public lastTradePrice;        // NFT ID => Last trade price
    
    // New: Mappings for frontend queries
    mapping(address => uint256[]) public userListings;        // User address => Listed NFT ID array
    mapping(uint256 => uint256) public listingIndex;          // NFT ID => Index in user listing array
    uint256[] public allListedNFTs;                          // All listed NFT ID array
    mapping(uint256 => uint256) public allListingIndex;       // NFT ID => Index in global listing array

    // Events
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
     * @dev Constructor
     * @param _nftContract NFT contract address
     * @param _carbonToken Carbon token contract address
     * @param _platformFeeRate Platform fee rate (basis points)
     * @param _feeCollector Fee collector address
     * @param _greenTrace GreenTrace contract address
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
     * @dev Update platform fee rate
     * @param _newRate New fee rate (basis points)
     * @notice Only contract owner can call this function
     * @notice Maximum fee rate is 10% (1000 basis points)
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Fee rate too high"); // Maximum 10%
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(_newRate);
    }

    /**
     * @dev Update fee collector address
     * @param _newCollector New collector address
     * @notice Only contract owner can call this function
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(_newCollector);
    }

    /**
     * @dev List NFT
     * @param _tokenId NFT ID
     * @param _price Listing price (carbon token amount)
     * @notice NFT holder can set price and list
     * @notice After listing, NFT will be transferred to contract
     */
    function listNFT(uint256 _tokenId, uint256 _price) external {
        require(nftContract.ownerOf(_tokenId) == msg.sender, "Not NFT owner");
        require(_price > 0, "Price must be greater than 0");
        require(!listings[_tokenId].isActive, "NFT already listed");

        // Transfer NFT to contract
        nftContract.safeTransferFrom(msg.sender, address(this), _tokenId);

        // Create listing info
        listings[_tokenId] = Listing({
            seller: msg.sender,
            price: _price,
            timestamp: block.timestamp,
            isActive: true
        });

        // Update user listing record
        userListings[msg.sender].push(_tokenId);
        listingIndex[_tokenId] = userListings[msg.sender].length - 1;
        
        // Add to global listing list
        allListedNFTs.push(_tokenId);
        allListingIndex[_tokenId] = allListedNFTs.length - 1;

        emit NFTListed(_tokenId, msg.sender, _price, block.timestamp);
    }

    /**
     * @dev Buy NFT
     * @param _tokenId NFT ID
     * @notice Buyer needs to pay sufficient carbon tokens
     * @notice After successful purchase, NFT will be transferred to buyer
     * @notice After trade completion, NFT price will be automatically updated
     */
    function buyNFT(uint256 _tokenId) external nonReentrant {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");

        uint256 price = listing.price;
        uint256 platformFee = (price * platformFeeRate) / 10000;
        uint256 sellerAmount = price - platformFee;
        address seller = listing.seller;

        // Transfer carbon tokens
        carbonToken.safeTransferFrom(msg.sender, feeCollector, platformFee);
        carbonToken.safeTransferFrom(msg.sender, seller, sellerAmount);

        // Transfer NFT
        nftContract.safeTransferFrom(address(this), msg.sender, _tokenId);

        // Update historical records
        tradeHistory[_tokenId].push(TradeHistory({
            seller: seller,
            buyer: msg.sender,
            price: price,
            timestamp: block.timestamp
        }));
        lastTradePrice[_tokenId] = price;

        // Update NFT price through GreenTrace
        greenTrace.updateNFTPriceByBusiness(_tokenId, price);

        // Clear listing info
        delete listings[_tokenId];
        
        // Remove from user listing record
        _removeFromUserListings(seller, _tokenId);
        
        // Remove from global listing list
        _removeFromAllListings(_tokenId);

        emit NFTSold(
            _tokenId,
            seller,
            msg.sender,
            price,
            platformFee,
            sellerAmount,
            block.timestamp
        );
    }

    /**
     * @dev Cancel listing
     * @param _tokenId NFT ID
     * @notice Only listing holder can cancel listing
     * @notice After cancellation, NFT will be returned to listing holder
     */
    function cancelListing(uint256 _tokenId) external {
        Listing storage listing = listings[_tokenId];
        require(listing.isActive, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");

        // Return NFT to seller
        nftContract.safeTransferFrom(address(this), msg.sender, _tokenId);

        // Clear listing info
        delete listings[_tokenId];
        
        // Remove from user listing record
        _removeFromUserListings(msg.sender, _tokenId);
        
        // Remove from global listing list
        _removeFromAllListings(_tokenId);

        emit ListingCancelled(_tokenId, msg.sender, block.timestamp);
    }

    /**
     * @dev Get historical trade records for an NFT
     * @param _tokenId NFT ID
     * @return Historical trade records array
     */
    function getTradeHistory(uint256 _tokenId) external view returns (TradeHistory[] memory) {
        return tradeHistory[_tokenId];
    }

    /**
     * @dev Get last trade price for an NFT
     * @param _tokenId NFT ID
     * @return Last trade price
     */
    function getLastTradePrice(uint256 _tokenId) external view returns (uint256) {
        return lastTradePrice[_tokenId];
    }

    /**
     * @dev Update NFT price
     * @param _tokenId NFT ID
     * @param _newPrice New price (carbon token amount)
     * @notice Only listing holder can update price
     * @notice New price must be greater than 0
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
     * @dev Implement IERC721Receiver interface, allowing this contract to safely receive NFTs
     * @notice This prevents revert when NFT safeTransferFrom to this contract
     * @return Returns IERC721Receiver interface selector, indicating successful reception
     */
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        // Returns IERC721Receiver interface selector, indicating successful reception
        return IERC721Receiver.onERC721Received.selector;
    }

    // Helper functions
    function _removeFromUserListings(address _seller, uint256 _tokenId) internal {
        uint256[] storage userListingsArray = userListings[_seller];
        uint256 index = listingIndex[_tokenId];

        if (index < userListingsArray.length - 1) {
            uint256 lastTokenId = userListingsArray[userListingsArray.length - 1];
            userListingsArray[index] = lastTokenId;
            listingIndex[lastTokenId] = index;
        }
        userListingsArray.pop();
        delete listingIndex[_tokenId];
    }

    function _removeFromAllListings(uint256 _tokenId) internal {
        uint256 indexToRemove = allListingIndex[_tokenId];
        uint256 lastIndex = allListedNFTs.length - 1;

        if (indexToRemove != lastIndex) {
            uint256 lastTokenId = allListedNFTs[lastIndex];
            allListedNFTs[indexToRemove] = lastTokenId;
            // Update index of moved last element
            allListingIndex[lastTokenId] = indexToRemove;
        }
        
        // Remove last element
        allListedNFTs.pop();
        // Delete removed tokenId index
        delete allListingIndex[_tokenId];
    }

    // ========== Frontend query functions ==========

    /**
     * @dev Get all listings for a user
     * @param _user User address
     * @return Listed NFT ID array for user
     */
    function getUserListings(address _user) external view returns (uint256[] memory) {
        return userListings[_user];
    }

    /**
     * @dev Get all listed NFTs
     * @return All listed NFT ID array
     */
    function getAllListedNFTs() external view returns (uint256[] memory) {
        return allListedNFTs;
    }

    /**
     * @dev Get listings with pagination
     * @param _offset Start position
     * @param _limit Number of listings to get
     * @return tokenIds NFT ID array
     * @return listingInfos Listing info array
     */
    function getListingsWithPagination(uint256 _offset, uint256 _limit) external view returns (
        uint256[] memory tokenIds,
        Listing[] memory listingInfos
    ) {
        uint256 totalListings = allListedNFTs.length;
        uint256 endIndex = _offset + _limit;
        if (endIndex > totalListings) {
            endIndex = totalListings;
        }
        
        uint256 count = endIndex - _offset;
        tokenIds = new uint256[](count);
        listingInfos = new Listing[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = allListedNFTs[_offset + i];
            tokenIds[i] = tokenId;
            listingInfos[i] = listings[tokenId];
        }
    }

    /**
     * @dev Get listing stats
     * @return totalListings Total listing count
     * @return totalUsers Listing user count
     */
    function getListingStats() external view returns (uint256 totalListings, uint256 totalUsers) {
        totalListings = allListedNFTs.length;
        
        // Calculate user count with listed NFTs (simplified implementation)
        uint256 userCount = 0;
        for (uint256 i = 0; i < allListedNFTs.length; i++) {
            address seller = listings[allListedNFTs[i]].seller;
            bool found = false;
            for (uint256 j = 0; j < i; j++) {
                if (listings[allListedNFTs[j]].seller == seller) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                userCount++;
            }
        }
        totalUsers = userCount;
    }

    /**
     * @dev Get full NFT info (including metadata)
     * @param _tokenId NFT ID
     * @return listing Listing info
     * @return storyMeta NFT metadata
     * @return tradeCount Trade count
     */
    function getNFTFullInfo(uint256 _tokenId) external view returns (
        Listing memory listing,
        GreenTalesNFT.StoryMeta memory storyMeta,
        uint256 tradeCount
    ) {
        listing = listings[_tokenId];
        storyMeta = nftContract.getStoryMeta(_tokenId);
        tradeCount = tradeHistory[_tokenId].length;
    }

    /**
     * @dev Check if NFT is listed
     * @param _tokenId NFT ID
     * @return Whether listed
     */
    function isNFTListed(uint256 _tokenId) external view returns (bool) {
        return listings[_tokenId].isActive;
    }

    /**
     * @dev Get user listing count
     * @param _user User address
     * @return Listing count
     */
    function getUserListingCount(address _user) external view returns (uint256) {
        return userListings[_user].length;
    }
} 
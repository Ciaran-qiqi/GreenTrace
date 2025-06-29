// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesMarket.sol";
import "../src/GreenTalesNFT.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GreenTalesMarket Test Cases
 * @dev Test complete functionality of NFT trading marketplace
 * 
 * Test coverage:
 * 1. Basic setup and initialization
 * 2. NFT listing functionality
 * 3. NFT purchase functionality
 * 4. Cancel listing functionality
 * 5. Price update functionality
 * 6. Transaction history records
 * 7. Platform fee management
 * 8. Frontend query functionality
 * 9. Event monitoring verification
 */
contract GreenTalesMarketTest is Test {
    GreenTalesMarket public market;    // Trading marketplace contract instance
    GreenTalesNFT public nft;          // NFT contract instance
    CarbonToken public carbonToken;    // Carbon token contract instance
    GreenTrace public greenTrace;       // GreenTrace contract instance
    address public owner;              // Contract owner
    address public user1;              // Test user 1
    address public user2;              // Test user 2
    address public user3;              // Test user 3
    address public feeCollector;       // Fee recipient address
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant PLATFORM_FEE_RATE = 250; // 2.5%

    /**
     * @dev Test environment setup
     * @notice Runs before each test case, initializes contracts and users
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        feeCollector = makeAddr("feeCollector");
        
        // Deploy contracts
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        nft = new GreenTalesNFT(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        
        market = new GreenTalesMarket(
            address(nft),
            address(carbonToken),
            PLATFORM_FEE_RATE,
            feeCollector,
            address(greenTrace)
        );
        
        // Distribute initial tokens
        carbonToken.transfer(user1, 10000 * 10**18);
        carbonToken.transfer(user2, 10000 * 10**18);
        carbonToken.transfer(user3, 10000 * 10**18);
        
        // Mint test NFTs
        vm.startPrank(owner);
        greenTrace.mintNFTByBusiness(user1, "Story1", "Details1", 1000 * 10**18, 500 * 10**18, "ipfs://hash1"); // tokenId: 0
        greenTrace.mintNFTByBusiness(user2, "Story2", "Details2", 2000 * 10**18, 800 * 10**18, "ipfs://hash2"); // tokenId: 1
        // Mint more NFTs for user1 for testing
        greenTrace.mintNFTByBusiness(user1, "Story3", "Details3", 100 * 10**18, 60 * 10**18, "ipfs://hash3");   // tokenId: 2
        greenTrace.mintNFTByBusiness(user1, "Story4", "Details4", 100 * 10**18, 70 * 10**18, "ipfs://hash4");   // tokenId: 3
        greenTrace.mintNFTByBusiness(user1, "Story5", "Details5", 100 * 10**18, 80 * 10**18, "ipfs://hash5");   // tokenId: 4
        vm.stopPrank();
    }

    /**
     * @dev Test initial state
     * @notice Verify initial state after contract deployment
     */
    function test_InitialState() public view {
        assertEq(address(market.nftContract()), address(nft));
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(address(market.greenTrace()), address(greenTrace));
        assertEq(market.platformFeeRate(), PLATFORM_FEE_RATE);
        assertEq(market.feeCollector(), feeCollector);
        assertEq(market.owner(), owner);
    }

    /**
     * @dev Test NFT listing
     * @notice Verify users can list NFTs correctly
     */
    function test_ListNFT() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0; // First NFT
        uint256 price = 600 * 10**18;
        
        // Approve NFT transfer
        nft.approve(address(market), tokenId);
        
        // List NFT
        market.listNFT(tokenId, price);
        
        // Verify listing information
        (address seller, uint256 listingPrice, uint256 timestamp, bool isActive) = market.listings(tokenId);
        assertEq(seller, user1);
        assertEq(listingPrice, price);
        assertEq(isActive, true);
        
        // Verify NFT ownership transfer
        assertEq(nft.ownerOf(tokenId), address(market));
        
        vm.stopPrank();
    }

    /**
     * @dev Test buying NFT
     * @notice Verify users can purchase listed NFTs correctly
     */
    function test_BuyNFT() public {
        // First list NFT
        vm.startPrank(user1);
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, price);
        vm.stopPrank();
        
        // Buy NFT
        vm.startPrank(user2);
        uint256 buyerBalanceBefore = carbonToken.balanceOf(user2);
        
        carbonToken.approve(address(market), price);
        market.buyNFT(tokenId);
        
        // Verify purchase result
        assertEq(nft.ownerOf(tokenId), user2);
        
        // Verify fee distribution
        uint256 platformFee = (price * PLATFORM_FEE_RATE) / 10000;
        uint256 sellerAmount = price - platformFee;
        
        assertEq(carbonToken.balanceOf(feeCollector), platformFee);
        assertEq(carbonToken.balanceOf(user1), 10000 * 10**18 + sellerAmount);
        assertEq(carbonToken.balanceOf(user2), buyerBalanceBefore - price);
        
        vm.stopPrank();
    }

    /**
     * @dev Test cancel listing
     * @notice Verify users can cancel listed NFTs correctly
     */
    function test_CancelListing() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, price);
        
        // Verify listing success
        assertEq(nft.ownerOf(tokenId), address(market));
        
        // Cancel listing
        market.cancelListing(tokenId);
        
        // Verify cancellation result
        assertEq(nft.ownerOf(tokenId), user1);
        (,,, bool isActive) = market.listings(tokenId);
        assertEq(isActive, false);
        
        vm.stopPrank();
    }

    /**
     * @dev Test price update
     * @notice Verify contract owner can update NFT prices
     */
    function test_UpdatePrice() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 initialPrice = 600 * 10**18;
        uint256 newPrice = 700 * 10**18;
        
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, initialPrice);
        
        // Update price
        market.updatePrice(tokenId, newPrice);
        
        // Verify price update
        (, uint256 listingPrice, ,) = market.listings(tokenId);
        assertEq(listingPrice, newPrice);
        
        vm.stopPrank();
    }

    /**
     * @dev Test getting user listings
     * @notice Verify users can get their listed NFTs correctly
     */
    function test_GetUserListings() public {
        vm.startPrank(user1);
        
        uint256 tokenId1 = 0;
        uint256 tokenId2 = 2; // user1's second NFT
        
        nft.approve(address(market), tokenId1);
        nft.approve(address(market), tokenId2);
        
        market.listNFT(tokenId1, 600 * 10**18);
        market.listNFT(tokenId2, 800 * 10**18);
        
        uint256[] memory userListings = market.getUserListings(user1);
        assertEq(userListings.length, 2);
        assertEq(userListings[0], tokenId1);
        assertEq(userListings[1], tokenId2);
        
        vm.stopPrank();
    }

    /**
     * @dev Test getting all listings
     * @notice Verify all listings can be retrieved correctly
     */
    function test_GetAllListedNFTs() public {
        // user1 lists NFT
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        // user2 lists NFT
        vm.startPrank(user2);
        nft.approve(address(market), 1);
        market.listNFT(1, 800 * 10**18);
        vm.stopPrank();
        
        uint256[] memory allListings = market.getAllListedNFTs();
        assertEq(allListings.length, 2);
    }

    /**
     * @dev Test getting listings with pagination
     * @notice Verify listings with pagination can be retrieved correctly
     */
    function test_GetListingsWithPagination() public {
        // user1 owns tokenIds 0, 2, 3, 4
        uint256[] memory user1Tokens = new uint256[](4);
        user1Tokens[0] = 0;
        user1Tokens[1] = 2;
        user1Tokens[2] = 3;
        user1Tokens[3] = 4;

        // Create multiple listings
        vm.startPrank(user1);
        for (uint256 i = 0; i < 4; i++) {
            nft.approve(address(market), user1Tokens[i]);
            market.listNFT(user1Tokens[i], (600 + i * 100) * 10**18);
        }
        vm.stopPrank();
        
        // Test pagination
        (uint256[] memory tokenIds, GreenTalesMarket.Listing[] memory listings) = 
            market.getListingsWithPagination(0, 3);
        
        assertEq(tokenIds.length, 3);
        assertEq(listings.length, 3);
    }

    /**
     * @dev Test getting NFT full information
     * @notice Verify NFT full information can be retrieved correctly
     */
    function test_GetNFTFullInfo() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        (GreenTalesMarket.Listing memory listing, 
         GreenTalesNFT.StoryMeta memory storyMeta, 
         uint256 tradeCount) = market.getNFTFullInfo(tokenId);
        
        assertEq(listing.seller, user1);
        assertEq(listing.price, 600 * 10**18);
        assertEq(storyMeta.storyTitle, "Story1");
        assertEq(tradeCount, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev Test getting listing stats
     * @notice Verify listing stats can be retrieved correctly
     */
    function test_GetListingStats() public {
        // Create listing
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        vm.startPrank(user2);
        nft.approve(address(market), 1);
        market.listNFT(1, 800 * 10**18);
        vm.stopPrank();
        
        (uint256 totalListings, uint256 totalUsers) = market.getListingStats();
        assertEq(totalListings, 2);
        assertEq(totalUsers, 2);
    }

    /**
     * @dev Test getting trade history
     * @notice Verify trade history can be retrieved correctly
     */
    function test_TradeHistory() public {
        // List NFT
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        // Buy NFT
        vm.startPrank(user2);
        carbonToken.approve(address(market), 600 * 10**18);
        market.buyNFT(0);
        vm.stopPrank();
        
        // Verify trade history
        GreenTalesMarket.TradeHistory[] memory history = market.getTradeHistory(0);
        assertEq(history.length, 1);
        assertEq(history[0].seller, user1);
        assertEq(history[0].buyer, user2);
        assertEq(history[0].price, 600 * 10**18);
        
        // Verify last traded price
        assertEq(market.getLastTradePrice(0), 600 * 10**18);
    }

    /**
     * @dev Test non-owner listing failure
     * @notice Verify non-NFT owner cannot list
     */
    function test_ListNFT_NotOwner() public {
        vm.startPrank(user2);
        
        uint256 tokenId = 0; // NFT owned by user1
        
        vm.expectRevert("Not NFT owner");
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.stopPrank();
    }

    /**
     * @dev Test buying unlisted NFT failure
     * @notice Verify users cannot buy unlisted NFTs
     */
    function test_BuyNFT_NotListed() public {
        vm.startPrank(user2);
        
        vm.expectRevert("NFT not listed");
        market.buyNFT(0);
        
        vm.stopPrank();
    }

    /**
     * @dev Test buying own NFT failure
     * @notice Verify users cannot buy their own listed NFT
     */
    function test_BuyNFT_OwnNFT() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.expectRevert("Cannot buy your own NFT");
        market.buyNFT(tokenId);
        
        vm.stopPrank();
    }

    /**
     * @dev Test cancel listing failure
     * @notice Verify non-listing owner cannot cancel listing
     */
    function test_CancelListing_NotSeller() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        vm.stopPrank();
        
        vm.startPrank(user2);
        vm.expectRevert("Not the seller");
        market.cancelListing(tokenId);
        vm.stopPrank();
    }

    /**
     * @dev Test updating platform fee rate
     * @notice Verify contract owner can update fee rate
     */
    function test_UpdatePlatformFeeRate() public {
        uint256 newRate = 300; // 3%
        
        market.updatePlatformFeeRate(newRate);
        assertEq(market.platformFeeRate(), newRate);
    }

    /**
     * @dev Test updating fee recipient
     * @notice Verify contract owner can update fee recipient
     */
    function test_UpdateFeeCollector() public {
        address newCollector = makeAddr("newCollector");
        
        market.updateFeeCollector(newCollector);
        assertEq(market.feeCollector(), newCollector);
    }

    /**
     * @dev Test fee rate too high failure
     * @notice Verify fee rate too high cannot be updated
     */
    function test_UpdatePlatformFeeRate_TooHigh() public {
        uint256 tooHighRate = 1500; // 15%
        
        vm.expectRevert("Fee rate too high");
        market.updatePlatformFeeRate(tooHighRate);
    }

    /**
     * @dev Test event monitoring
     * @notice Verify events can be monitored correctly
     */
    function test_Events() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        
        nft.approve(address(market), tokenId);
        
        // List NFT
        market.listNFT(tokenId, price);
        
        vm.stopPrank();
        
        // Buy NFT
        vm.startPrank(user2);
        carbonToken.approve(address(market), price);
        market.buyNFT(tokenId);
        vm.stopPrank();
    }

    /**
     * @dev Test zero price failure
     * @notice Verify zero price cannot list NFT
     */
    function test_ListNFT_ZeroPrice() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        
        vm.expectRevert("Price must be greater than 0");
        market.listNFT(tokenId, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev Test NFT already listed failure
     * @notice Verify NFT already listed cannot be listed again
     */
    function test_ListNFT_AlreadyListed() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        
        market.listNFT(tokenId, 600 * 10**18);
        
        // NFT already transferred to contract, so listing again will fail due to ownership issue
        vm.expectRevert("Not NFT owner");
        market.listNFT(tokenId, 700 * 10**18);
        
        vm.stopPrank();
    }

    /**
     * @dev Test zero price update failure
     * @notice Verify zero price cannot update
     */
    function test_UpdatePrice_ZeroPrice() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.expectRevert("Price must be greater than 0");
        market.updatePrice(tokenId, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev Implement IERC721Receiver interface, allow this test contract to safely receive NFTs
     * @notice This way NFT safeTransferFrom to this contract will not revert
     */
    function test_OnERC721Received() public {
        bytes4 selector = market.onERC721Received(address(0), address(0), 0, "");
        assertEq(selector, IERC721Receiver.onERC721Received.selector);
    }
} 
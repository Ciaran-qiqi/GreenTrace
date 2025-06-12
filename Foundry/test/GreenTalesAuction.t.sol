// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesAuction.sol";
import "../src/GreenTalesNFT.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";

/**
 * @title GreenTalesAuctionTest
 * @dev 拍卖合约的测试套件
 * @notice 测试拍卖合约的所有主要功能
 */
contract GreenTalesAuctionTest is Test {
    // 测试合约实例
    GreenTalesAuction public auction;
    GreenTalesNFT public nft;
    CarbonToken public carbonToken;
    GreenTrace public greenTrace;

    // 测试账户
    address public creator = address(1);
    address public bidder1 = address(2);
    address public bidder2 = address(3);
    address public feeCollector = address(4);

    // 测试常量
    uint256 public constant INITIAL_BALANCE = 1000000 * 1e18; // 100万代币
    uint256 public constant START_PRICE = 1000 * 1e18;      // 1000代币
    uint256 public constant END_PRICE = 2000 * 1e18;       // 2000代币
    uint256 public constant DURATION = 1 days;        // 1天
    uint256 public constant EXPECTED_CARBON = 1000;           // 预期碳减排量
    string public constant METADATA_URI = "ipfs://test";

    // 事件声明
    event AuctionCreated(
        uint256 indexed auctionId, 
        address indexed creator, 
        string metadataURI,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 expectedCarbon,
        uint256 deposit
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
        uint256 creatorAmount
    );

    /**
     * @dev 测试前的准备工作
     */
    function setUp() public {
        // 构造初始分配数组
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](3);
        initialBalances[0] = CarbonToken.InitialBalance(creator, INITIAL_BALANCE);
        initialBalances[1] = CarbonToken.InitialBalance(bidder1, INITIAL_BALANCE);
        initialBalances[2] = CarbonToken.InitialBalance(bidder2, INITIAL_BALANCE);
        // 部署合约
        carbonToken = new CarbonToken(initialBalances);
        nft = new GreenTalesNFT(address(this));
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        auction = new GreenTalesAuction(
            address(carbonToken),
            address(nft),
            address(greenTrace),
            feeCollector
        );
        
        // 设置权限
        nft.setGreenTrace(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        greenTrace.addBusinessContract(address(auction));
    }

    /**
     * @dev 测试创建拍卖
     */
    function test_CreateAuction() public {
        vm.startPrank(creator);
        
        // 计算创建者押金
        uint256 creatorDeposit = (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        
        // 创建拍卖
        carbonToken.approve(address(auction), creatorDeposit);
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.expectEmit(true, true, true, true);
        emit AuctionCreated(
            auctionId,
            creator,
            METADATA_URI,
            START_PRICE,
            END_PRICE,
            block.timestamp,
            block.timestamp + DURATION,
            EXPECTED_CARBON,
            creatorDeposit
        );
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        
        // 验证拍卖信息
        (address auctionCreator, GreenTalesAuction.AuctionStatus status, uint256 startPrice, uint256 endPrice, uint256 startTime, uint256 endTime, uint256 expectedCarbon, string memory metadataURI, uint256 deposit) = auction.auctions(auctionId);
        assertEq(auctionCreator, creator);
        assertEq(uint8(status), uint8(GreenTalesAuction.AuctionStatus.Active));
        assertEq(startPrice, START_PRICE);
        assertEq(endPrice, END_PRICE);
        assertEq(endTime, startTime + DURATION);
        assertEq(expectedCarbon, EXPECTED_CARBON);
        assertEq(metadataURI, METADATA_URI);
        assertEq(deposit, creatorDeposit);
        
        // 验证创建者余额
        assertEq(carbonToken.balanceOf(creator), INITIAL_BALANCE - creatorDeposit);
        assertEq(carbonToken.balanceOf(address(auction)), creatorDeposit);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试竞拍
     */
    function test_PlaceBid() public {
        // 创建拍卖
        vm.startPrank(creator);
        uint256 creatorDeposit = (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), creatorDeposit);
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        // 使用与合约一致的 auctionId 计算方式
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();
        
        // 第一个竞拍者出价
        vm.startPrank(bidder1);
        uint256 bidAmount1 = START_PRICE + 100 * 1e18;
        uint256 deposit1 = (bidAmount1 * auction.DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), deposit1);
        auction.placeBid(auctionId, bidAmount1);
        // 验证出价信息
        (address bidder, uint256 amount, uint256 deposit, uint256 timestamp) = auction.bids(auctionId, 0);
        assertEq(bidder, bidder1);
        assertEq(amount, bidAmount1);
        assertEq(deposit, deposit1);
        // 验证竞拍者余额
        assertEq(carbonToken.balanceOf(bidder1), INITIAL_BALANCE - deposit1);
        assertEq(carbonToken.balanceOf(address(auction)), creatorDeposit + deposit1);
        vm.stopPrank();
        
        // 第二个竞拍者出价
        vm.startPrank(bidder2);
        uint256 bidAmount2 = bidAmount1 + 100 * 1e18;
        uint256 deposit2 = (bidAmount2 * auction.DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), deposit2);
        auction.placeBid(auctionId, bidAmount2);
        // 验证出价信息
        (bidder, amount, deposit, timestamp) = auction.bids(auctionId, 1);
        assertEq(bidder, bidder2);
        assertEq(amount, bidAmount2);
        assertEq(deposit, deposit2);
        // 验证竞拍者余额
        assertEq(carbonToken.balanceOf(bidder2), INITIAL_BALANCE - deposit2);
        assertEq(carbonToken.balanceOf(address(auction)), creatorDeposit + deposit1 + deposit2);
        vm.stopPrank();
    }

    /**
     * @dev 测试完成拍卖
     */
    function test_CompleteAuction() public {
        // 创建拍卖
        vm.startPrank(creator);
        carbonToken.approve(address(auction), START_PRICE);
        auction.createSupplyAuction(START_PRICE, END_PRICE, DURATION, EXPECTED_CARBON, "ipfs://test");
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 第一个竞拍者出价
        vm.startPrank(bidder1);
        carbonToken.approve(address(auction), START_PRICE + 100 ether);
        auction.placeBid(auctionId, START_PRICE + 100 ether);
        vm.stopPrank();

        // 等待拍卖结束
        vm.warp(block.timestamp + DURATION + 1);

        // 先让 bidder1 授权
        vm.startPrank(bidder1);
        carbonToken.approve(address(auction), START_PRICE + 100 ether);
        vm.stopPrank();
        // 再让 creator 完成拍卖
        vm.startPrank(creator);
        auction.completeAuction(auctionId);

        // 验证拍卖状态
        (address _creator, GreenTalesAuction.AuctionStatus status, uint256 startPrice, uint256 endPrice, uint256 startTime, uint256 endTime, uint256 expectedCarbon, string memory metadataURI, uint256 creatorDeposit) = auction.auctions(auctionId);
        assertEq(uint8(status), uint8(GreenTalesAuction.AuctionStatus.Completed));
        assertEq(_creator, creator);
        assertEq(startPrice, START_PRICE);
        assertEq(endPrice, END_PRICE);
        assertEq(endTime, block.timestamp - 1);
        assertEq(expectedCarbon, EXPECTED_CARBON);
        assertEq(metadataURI, "ipfs://test");
        assertEq(creatorDeposit, (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE());

        // 验证余额变化
        uint256 platformFee = ((START_PRICE + 100 ether) * auction.PLATFORM_FEE_RATE()) / auction.BASE_RATE();
        uint256 expectedCreatorBalance = INITIAL_BALANCE - (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE() + (START_PRICE + 100 ether) - platformFee + (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        assertEq(carbonToken.balanceOf(creator), expectedCreatorBalance);
        assertEq(carbonToken.balanceOf(bidder1), INITIAL_BALANCE - (START_PRICE + 100 ether));
        assertEq(carbonToken.balanceOf(address(auction)), 0);
        vm.stopPrank();
    }

    /**
     * @dev 测试取消拍卖
     */
    function test_CancelAuction() public {
        // 创建拍卖
        vm.startPrank(creator);
        uint256 creatorDeposit = (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), creatorDeposit);
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        // 使用与合约一致的 auctionId 计算方式
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 竞拍者出价
        vm.startPrank(bidder1);
        uint256 bidAmount = START_PRICE + 100 * 1e18;
        uint256 deposit = (bidAmount * auction.DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), deposit);
        auction.placeBid(auctionId, bidAmount);
        vm.stopPrank();

        // 拍卖创建者取消拍卖
        vm.startPrank(creator);
        auction.cancelAuction(auctionId);
        // 验证拍卖状态
        ( , GreenTalesAuction.AuctionStatus status,,,,,, , ) = auction.auctions(auctionId);
        assertEq(uint8(status), uint8(GreenTalesAuction.AuctionStatus.Cancelled));
        vm.stopPrank();
    }

    /**
     * @dev 测试无效操作
     */
    function test_RevertWhen_CreateAuctionWithInvalidPrice() public {
        // 期望 revert
        vm.expectRevert("Invalid price range");
        auction.createSupplyAuction(0, 0, 1000, 1000, "ipfs://test");
    }

    /**
     * @dev 测试无效操作
     */
    function test_RevertWhen_PlaceBidWithInsufficientAmount() public {
        // 创建拍卖
        vm.startPrank(creator);
        carbonToken.approve(address(auction), START_PRICE);
        auction.createSupplyAuction(START_PRICE, END_PRICE, DURATION, EXPECTED_CARBON, "ipfs://test");
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 尝试以低于起拍价的价格出价
        vm.startPrank(bidder1);
        vm.expectRevert("Bid too low");
        auction.placeBid(auctionId, START_PRICE - 1);
        vm.stopPrank();
    }

    /**
     * @dev 测试无效操作
     */
    function test_RevertWhen_CompleteAuctionBeforeEnd() public {
        // 创建拍卖
        vm.startPrank(creator);
        uint256 creatorDeposit = (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), creatorDeposit);
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        // 使用与合约一致的 auctionId 计算方式
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 拍卖未结束，尝试完成拍卖
        vm.startPrank(creator);
        vm.expectRevert("Auction not ended");
        auction.completeAuction(auctionId);
        vm.stopPrank();
    }

    /**
     * @dev 测试无效操作
     */
    function test_RevertWhen_CancelAuctionByUnauthorized() public {
        // 创建拍卖
        vm.startPrank(creator);
        uint256 creatorDeposit = (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE();
        carbonToken.approve(address(auction), creatorDeposit);
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        // 使用与合约一致的 auctionId 计算方式
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 非创建者尝试取消拍卖
        vm.startPrank(bidder1);
        vm.expectRevert("Not authorized");
        auction.cancelAuction(auctionId);
        vm.stopPrank();
    }

    /**
     * @dev 测试事件触发
     */
    function testEvents() public {
        vm.startPrank(creator);
        carbonToken.approve(address(auction), START_PRICE);
        vm.expectEmit(true, true, true, true);
        emit AuctionCreated(
            uint256(keccak256(abi.encodePacked(block.timestamp, creator))),
            creator,
            METADATA_URI,
            START_PRICE,
            END_PRICE,
            block.timestamp,
            block.timestamp + DURATION,
            EXPECTED_CARBON,
            (START_PRICE * auction.CREATOR_DEPOSIT_RATE()) / auction.BASE_RATE()
        );
        auction.createSupplyAuction(
            START_PRICE,
            END_PRICE,
            DURATION,
            EXPECTED_CARBON,
            METADATA_URI
        );
        vm.stopPrank();
    }

    /**
     * @dev 测试相同报价时，最早出价者中标
     */
    function test_CompleteAuctionWithSameBids() public {
        // 1. 创建拍卖
        vm.startPrank(creator);
        carbonToken.approve(address(auction), START_PRICE);
        auction.createSupplyAuction(START_PRICE, END_PRICE, DURATION, EXPECTED_CARBON, "ipfs://test");
        uint256 auctionId = uint256(keccak256(abi.encodePacked(block.timestamp, creator)));
        vm.stopPrank();

        // 2. 第一个竞拍者先出价
        vm.startPrank(bidder1);
        carbonToken.approve(address(auction), START_PRICE + 100 ether);
        auction.placeBid(auctionId, START_PRICE + 100 ether);
        vm.stopPrank();

        // 3. 时间前进1小时，第二个竞拍者再出相同价格
        vm.warp(block.timestamp + 1 hours);
        vm.startPrank(bidder2);
        carbonToken.approve(address(auction), START_PRICE + 100 ether);
        auction.placeBid(auctionId, START_PRICE + 100 ether);
        vm.stopPrank();

        // 4. 等待拍卖结束
        vm.warp(block.timestamp + DURATION + 1);

        // 5. 先让 bidder1 授权
        vm.startPrank(bidder1);
        carbonToken.approve(address(auction), START_PRICE + 100 ether);
        vm.stopPrank();
        // 6. 再让 creator 完成拍卖
        vm.startPrank(creator);
        auction.completeAuction(auctionId);

        // 7. 验证NFT归第一个出价者所有
        uint256 mintedTokenId = nft.nextTokenId() - 1;
        assertEq(nft.ownerOf(mintedTokenId), bidder1); // 应该归最早出价者
        vm.stopPrank();
    }
} 
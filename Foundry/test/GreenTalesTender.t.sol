// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesTender.sol";
import "../src/GreenTalesNFT.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";

/**
 * @title GreenTalesTenderTest
 * @dev 招标合约的测试套件
 * @notice 测试招标合约的所有主要功能
 */
contract GreenTalesTenderTest is Test {
    // 测试合约实例
    GreenTalesTender public tender;
    GreenTalesNFT public nft;
    CarbonToken public carbonToken;
    GreenTrace public greenTrace;

    // 事件声明
    event TenderCreated(
        uint256 indexed tenderId,
        address indexed creator,
        uint256 projectAmount,
        uint256 endTime,
        string metadataURI
    );
    event BidSubmitted(
        uint256 indexed tenderId,
        address indexed bidder,
        uint256 amount,
        string proposal,
        uint256 timestamp
    );
    event WinnerSelected(
        uint256 indexed tenderId,
        address indexed winner,
        uint256 timestamp
    );
    event ProjectCompleted(
        uint256 indexed tenderId,
        address indexed winner,
        uint256 timestamp
    );

    // 测试账户
    address public owner;
    address public creator;
    address public bidder1;
    address public bidder2;
    address public bidder3;

    // 测试常量
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10**18; // 1000万代币
    uint256 public constant DEPOSIT_AMOUNT = 1000 * 10**18;    // 1000代币
    uint256 public constant BID_AMOUNT = 500 * 10**18;         // 500代币
    uint256 public constant TENDER_DURATION = 7 days;          // 7天

    // 测试招标ID
    uint256 public testTenderId;

    /**
     * @dev 测试前的准备工作
     */
    function setUp() public {
        // 设置固定的时间戳
        vm.warp(1000);

        // 创建测试账户
        owner = makeAddr("owner");
        creator = makeAddr("creator");
        bidder1 = makeAddr("bidder1");
        bidder2 = makeAddr("bidder2");
        bidder3 = makeAddr("bidder3");

        // 1. 部署 CarbonToken
        vm.startPrank(owner);
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);

        // 2. 部署 GreenTrace（NFT 地址为 0）
        greenTrace = new GreenTrace(address(carbonToken), address(0));

        // 3. 部署 NFT（传入 GreenTrace 地址）
        nft = new GreenTalesNFT(address(greenTrace));

        // 4. 设置 GreenTrace 的 NFT 地址
        greenTrace.setNFTContract(address(nft));

        // 5. 初始化 GreenTrace
        greenTrace.initialize();

        // 6. 部署 Tender
        tender = new GreenTalesTender(
            address(carbonToken),
            address(nft),
            address(greenTrace),
            owner
        );

        // 7. 将 Tender 添加到业务白名单
        greenTrace.addBusinessContract(address(tender));

        // 8. 转移 NFT 的 owner 给 GreenTrace
        nft.transferOwnership(address(greenTrace));

        // 验证 isTestEnvironment
        assertTrue(nft.isTestEnvironment());
        assertTrue(greenTrace.isTestEnvironment());

        // 验证 NFT 的 greenTrace 地址和 owner
        assertEq(nft.greenTrace(), address(greenTrace));
        assertEq(nft.owner(), address(greenTrace));

        // 给测试账户分配代币
        carbonToken.transfer(creator, 1_000_000 ether);
        carbonToken.transfer(bidder1, 1000 ether);
        carbonToken.transfer(bidder2, 1000 ether);
        carbonToken.transfer(bidder3, 1000 ether);

        // 通过GreenTrace合约在测试环境下铸造一个NFT给creator
        vm.stopPrank();
        vm.startPrank(address(greenTrace));
        greenTrace.mintNFTByBusiness(
            creator, // NFT接收者改为creator
            "Test Story Title",
            "Test Story Detail",
            0,
            1000 ether,
            "ipfs://test-nft"
        );
        vm.stopPrank();

        // 切换到creator账户
        vm.startPrank(creator);
        
        // 给Tender合约授权代币，只需要授权押金部分（300 ether）
        carbonToken.approve(address(tender), 300 ether);

        // 创建招标
        tender.createTender(1000 ether, TENDER_DURATION, "ipfs://test");

        // 获取创建的 tenderId
        testTenderId = uint256(keccak256(abi.encodePacked(uint256(1000), creator)));
        vm.stopPrank();
    }

    /**
     * @dev 测试创建招标
     */
    function testCreateTender() public {
        vm.warp(2000);  // 使用新的时间戳
        vm.startPrank(creator);
        
        // 确保 creator 余额充足
        carbonToken.transfer(creator, 2000 ether);

        // 授权押金部分（300 ether）
        carbonToken.approve(address(tender), 300 ether);
        
        // 创建新的招标，参数分别为：项目金额、持续时间、元数据URI
        tender.createTender(
            DEPOSIT_AMOUNT,  // projectAmount
            TENDER_DURATION, // duration
            "ipfs://test"    // metadataURI
        );
        vm.stopPrank();

        // 获取新创建的 tenderId
        uint256 newTenderId = uint256(keccak256(abi.encodePacked(uint256(2000), creator)));

        // 验证招标信息
        (
            address tenderCreator,
            address bidder,
            GreenTalesTender.TenderStatus status,
            uint256 projectAmount,
            uint256 startTime,
            uint256 endTime,
            uint256 creatorDeposit,
            uint256 bidderDeposit,
            string memory metadataURI
        ) = tender.tenders(newTenderId);

        assertEq(tenderCreator, creator);
        assertEq(projectAmount, DEPOSIT_AMOUNT);
        assertEq(creatorDeposit, (DEPOSIT_AMOUNT * 3000) / 10000);  // 30% 押金
        assertEq(uint8(status), uint8(GreenTalesTender.TenderStatus.Active));
    }

    /**
     * @dev 测试提交标书
     */
    function testSubmitBid() public {
        // 提交标书
        vm.startPrank(bidder1);
        carbonToken.approve(address(tender), BID_AMOUNT);
        tender.placeBid(testTenderId);
        vm.stopPrank();

        // 验证标书信息
        (
            ,
            address bidder,
            ,
            ,
            ,
            ,
            ,
            uint256 bidderDeposit,
            
        ) = tender.tenders(testTenderId);

        assertEq(bidder, bidder1);
        assertEq(bidderDeposit, (DEPOSIT_AMOUNT * 2000) / 10000);  // 20% 押金
    }

    /**
     * @dev 测试选择中标者
     */
    function testSelectWinner() public {
        // 1. 投标：bidder1 作为投标人进行投标
        vm.startPrank(bidder1);
        carbonToken.approve(address(tender), BID_AMOUNT);
        tender.placeBid(testTenderId);
        vm.stopPrank();

        // 2. 验证招标状态已变为 BidAccepted
        (
            ,
            ,
            GreenTalesTender.TenderStatus status,
            ,
            ,
            ,
            ,
            ,
        ) = tender.tenders(testTenderId);
        assertEq(uint8(status), uint8(GreenTalesTender.TenderStatus.BidAccepted));
    }

    /**
     * @dev 测试确认项目完成
     */
    function testConfirmCompletion() public {
        // 记录 owner（平台方）初始余额
        uint256 ownerInitialBalance = INITIAL_SUPPLY - 1_000_000 ether - 1000 ether * 3;
        // 1. 投标：bidder1 作为投标人进行投标
        vm.startPrank(bidder1);
        carbonToken.approve(address(tender), BID_AMOUNT);
        tender.placeBid(testTenderId);
        vm.stopPrank();

        // 2. 等待项目结束时间
        vm.warp(block.timestamp + TENDER_DURATION);

        // 3. 确认项目完成
        vm.startPrank(creator);
        // 授权项目金额
        carbonToken.approve(address(tender), DEPOSIT_AMOUNT);
        tender.confirmCompletion(testTenderId, true);
        vm.stopPrank();

        // 4. 验证项目状态
        (
            ,
            ,
            GreenTalesTender.TenderStatus status,
            ,
            ,
            ,
            ,
            ,
        ) = tender.tenders(testTenderId);
        assertEq(uint8(status), uint8(GreenTalesTender.TenderStatus.Completed));

        // 5. 验证资金分配
        uint256 platformFee = (DEPOSIT_AMOUNT * 200) / 10000;  // 2% 平台手续费
        uint256 bidderAmount = DEPOSIT_AMOUNT - platformFee;   // 剩余给投标人
        uint256 bidderDeposit = (DEPOSIT_AMOUNT * 2000) / 10000;  // 20% 投标人押金
        uint256 creatorDeposit = (DEPOSIT_AMOUNT * 3000) / 10000;  // 30% 招标人押金

        // 验证投标人余额：初始余额 - 押金 + 退还押金 + 项目金额
        uint256 expectedBidderBalance = 1000 ether - bidderDeposit + bidderDeposit + bidderAmount;
        assertEq(carbonToken.balanceOf(bidder1), expectedBidderBalance);
        
        // 验证平台手续费：平台余额应为初始余额加上本次手续费
        assertEq(carbonToken.balanceOf(owner), ownerInitialBalance + platformFee);
        
        // 验证招标人余额：初始余额 - 项目金额
        uint256 expectedCreatorBalance = 1_000_000 ether - DEPOSIT_AMOUNT;
        assertEq(carbonToken.balanceOf(creator), expectedCreatorBalance);
    }

    /**
     * @dev 测试取消招标
     */
    function testCancelTender() public {
        // 取消招标
        vm.prank(creator);
        tender.cancelTender(testTenderId);

        // 验证招标状态
        (
            ,
            ,
            GreenTalesTender.TenderStatus status,
            ,
            ,
            ,
            ,
            ,
            
        ) = tender.tenders(testTenderId);

        assertEq(uint8(status), uint8(GreenTalesTender.TenderStatus.Cancelled));
    }

    /**
     * @dev 测试无效操作
     */
    function testInvalidOperations() public {
        // 测试非招标人取消招标
        vm.prank(bidder1);
        vm.expectRevert("Not authorized");
        tender.cancelTender(testTenderId);

        // 测试非招标人或投标人确认完成
        vm.prank(bidder2);
        vm.expectRevert("Not authorized");
        tender.confirmCompletion(testTenderId, true);
    }

    /**
     * @dev 测试事件
     */
    function testEvents() public {
        vm.warp(3000);  // 使用新的时间戳
        // 创建新招标
        vm.startPrank(creator);
        carbonToken.approve(address(tender), DEPOSIT_AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit TenderCreated(
            uint256(keccak256(abi.encodePacked(uint256(3000), creator))),
            creator,
            DEPOSIT_AMOUNT,
            3000 + TENDER_DURATION,
            "ipfs://test"
        );
        tender.createTender(
            DEPOSIT_AMOUNT,
            TENDER_DURATION,
            "ipfs://test"
        );
        vm.stopPrank();
    }
} 
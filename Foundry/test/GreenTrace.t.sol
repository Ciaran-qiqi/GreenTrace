// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTrace.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTrace 测试用例
 * @dev 测试新版GreenTrace合约的完整功能，包括独立ID系统、审计意见存储等
 * 
 * 测试覆盖：
 * 1. 基础设置和初始化
 * 2. 铸造申请-审计-支付-铸造流程
 * 3. 兑换申请-审计-兑换流程
 * 4. 审计意见存储和查询
 * 5. ID系统独立性验证
 * 6. 权限控制和错误处理
 * 7. 数据查询功能
 */
contract GreenTraceTest is Test {
    GreenTrace public greenTrace;        // GreenTrace合约实例
    CarbonToken public carbonToken;      // 碳币合约实例
    GreenTalesNFT public nft;            // NFT合约实例
    
    address public owner;                // 合约所有者
    address public auditor;              // 审计者
    address public user1;                // 测试用户1
    address public user2;                // 测试用户2
    
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // 初始供应量

    /**
     * @dev 测试环境设置
     */
    function setUp() public {
        owner = address(this);
        auditor = makeAddr("auditor");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // 1. 部署CarbonToken
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        // 2. 部署GreenTrace合约
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        
        // 3. 部署NFT合约
        nft = new GreenTalesNFT(address(greenTrace));
        
        // 4. 设置合约关系
        carbonToken.setGreenTrace(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        greenTrace.addAuditor(auditor);

        // 5. 给测试用户分配碳币
        carbonToken.transfer(user1, 10000 ether);
        carbonToken.transfer(user2, 10000 ether);
    }

    /**
     * @dev 测试合约初始状态
     */
    function test_InitialState() public view {
        assertEq(address(greenTrace.carbonToken()), address(carbonToken));
        assertEq(address(greenTrace.greenTalesNFT()), address(nft));
        assertTrue(greenTrace.initialized());
        assertTrue(greenTrace.auditors(auditor));
        assertEq(greenTrace.nextRequestId(), 1);
        assertEq(greenTrace.nextCashId(), 1);
    }

    /**
     * @dev 测试完整的铸造流程：申请 → 审计 → 支付铸造
     */
    function test_CompleteMintFlow() public {
        vm.startPrank(user1);
        
        // 1. 计算申请手续费
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        
                          // 2. 批准并申请铸造NFT
         carbonToken.approve(address(greenTrace), requestFee);
         uint256 requestId = greenTrace.requestMintNFT(
             "Test Green Story",
             "This is a test environmental story",
             carbonReduction,
             "ipfs://QmTestHash"
         );
         
         // 验证申请记录
         assertEq(requestId, 1); // 第一个申请ID应该是1
         GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
         assertEq(audit.requester, user1);
         assertEq(audit.requestId, requestId);
         assertEq(audit.nftTokenId, 0); // 还未铸造，NFT ID为0
         assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Pending));
         assertEq(uint256(audit.auditType), uint256(GreenTrace.AuditType.Mint));
         
         vm.stopPrank();
         
         // 3. 审计员审核并通过
         vm.prank(auditor);
         uint256 carbonValue = 800 ether;
         greenTrace.submitMintAudit(requestId, carbonValue, "Data accurate, excellent quality");
         
         // 验证审计结果
         audit = greenTrace.getRequestById(requestId);
         assertEq(audit.auditor, auditor);
         assertEq(audit.carbonValue, carbonValue);
         assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Approved));
         assertEq(audit.auditComment, "Data accurate, excellent quality");
        
        // 4. 用户支付费用并铸造NFT
        vm.startPrank(user1);
        uint256 systemFee = greenTrace.calculateSystemFee(carbonValue);
        uint256 auditFee = greenTrace.calculateAuditFee(carbonValue);
        uint256 totalFee = systemFee + auditFee;
        
        carbonToken.approve(address(greenTrace), totalFee);
        uint256 nftTokenId = greenTrace.payAndMintNFT(requestId);
        
        // 验证NFT铸造
        assertEq(nft.ownerOf(nftTokenId), user1);
        assertEq(nftTokenId, 0); // 第一个NFT ID应该是0
        
        // 验证申请记录更新
        audit = greenTrace.getRequestById(requestId);
        assertEq(audit.nftTokenId, nftTokenId);
        
                 // 验证NFT元数据
         GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(nftTokenId);
         assertEq(meta.storyTitle, "Test Green Story");
        assertEq(meta.carbonReduction, carbonReduction);
        assertEq(meta.initialPrice, carbonValue);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试审计拒绝流程
     */
    function test_MintAuditRejection() public {
        vm.startPrank(user1);
        
        // 申请铸造NFT
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT(
            unicode"无效故事",
            unicode"这个故事数据不准确",
            carbonReduction,
            "ipfs://QmInvalidHash"
        );
        
        vm.stopPrank();
        
        // 审计员拒绝申请
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, 0, unicode"数据不足，请提供更详细的证明材料");
        
        // 验证拒绝结果
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Rejected));
        assertEq(audit.auditComment, unicode"数据不足，请提供更详细的证明材料");
        assertEq(audit.carbonValue, 0);
        
        // 验证无法铸造NFT
        vm.startPrank(user1);
        vm.expectRevert("Mint audit not approved");
        greenTrace.payAndMintNFT(requestId);
        vm.stopPrank();
    }

    /**
     * @dev 测试兑换流程：申请 → 审计 → 兑换
     */
    function test_CompleteExchangeFlow() public {
        // 先铸造一个NFT
        uint256 nftTokenId = _mintTestNFT(user1, 1000 ether, 800 ether);
        
        vm.startPrank(user1);
        
        // 1. 申请兑换NFT
        uint256 requestFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftTokenId);
        
        // 验证兑换申请
        assertEq(cashId, 1); // 第一个兑换申请ID应该是1
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashId);
        assertEq(cashAudit.requester, user1);
        assertEq(cashAudit.nftTokenId, nftTokenId);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Pending));
        assertEq(uint256(cashAudit.auditType), uint256(GreenTrace.AuditType.Exchange));
        
        vm.stopPrank();
        
        // 2. 审计员审核兑换
        vm.prank(auditor);
        uint256 exchangeValue = 700 ether;
        greenTrace.submitExchangeAudit(cashId, exchangeValue, unicode"兑换条件满足");
        
        // 验证审计结果
        cashAudit = greenTrace.getCashById(cashId);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Approved));
        assertEq(cashAudit.carbonValue, exchangeValue);
        assertEq(cashAudit.auditComment, unicode"兑换条件满足");
        
        // 3. 执行兑换
        vm.startPrank(user1);
        nft.approve(address(greenTrace), nftTokenId);
        
        uint256 beforeBalance = carbonToken.balanceOf(user1);
        greenTrace.exchangeNFT(cashId);
        
        // 验证NFT已销毁
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(nftTokenId);
        
        // 验证碳币增加
        uint256 returnAmount = greenTrace.calculateReturnAmount(exchangeValue);
        assertEq(carbonToken.balanceOf(user1), beforeBalance + returnAmount);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试审计意见存储功能
     */
    function test_AuditCommentStorage() public {
        vm.startPrank(user1);
        
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2);
        
        // 创建两个申请
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        
        vm.stopPrank();
        
        vm.startPrank(auditor);
        
        // 通过申请 - 带评论
        greenTrace.submitMintAudit(requestId1, 800 ether, "Quality excellent, data detailed");
        
        // 拒绝申请 - 必须有原因
        greenTrace.submitMintAudit(requestId2, 0, "Incomplete data, need more materials");
        
        vm.stopPrank();
        
        // 验证审计意见存储
        assertEq(greenTrace.getMintAuditComment(requestId1), "Quality excellent, data detailed");
        assertEq(greenTrace.getMintAuditComment(requestId2), "Incomplete data, need more materials");
        
        // 验证通过完整记录查询
        GreenTrace.Audit memory audit1 = greenTrace.getRequestById(requestId1);
        GreenTrace.Audit memory audit2 = greenTrace.getRequestById(requestId2);
        assertEq(audit1.auditComment, "Quality excellent, data detailed");
        assertEq(audit2.auditComment, "Incomplete data, need more materials");
    }

    /**
     * @dev 测试拒绝时必须提供原因
     */
    function test_RejectionReasonRequired() public {
        vm.startPrank(user1);
        
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        
        vm.stopPrank();
        
        // 测试拒绝时不提供原因会失败
        vm.prank(auditor);
        vm.expectRevert("Rejection reason is required");
        greenTrace.submitMintAudit(requestId, 0, "");
        
        // 测试提供原因后成功拒绝
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, 0, "Data does not meet requirements");
        
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Rejected));
    }

    /**
     * @dev 测试查询功能
     */
    function test_QueryFunctions() public {
        // 创建多个申请和兑换记录
        uint256 nftId1 = _mintTestNFT(user1, 1000 ether, 800 ether);
        uint256 nftId2 = _mintTestNFT(user2, 2000 ether, 1500 ether);
        
        // 创建兑换申请
        vm.startPrank(user1);
        uint256 requestFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 cashId1 = greenTrace.requestExchangeNFT(nftId1);
        vm.stopPrank();
        
        // 测试用户申请查询
        uint256[] memory userMintRequests = greenTrace.getUserMintRequests(user1);
        uint256[] memory userCashRequests = greenTrace.getUserCashRequests(user1);
        
        assertEq(userMintRequests.length, 1);
        assertEq(userCashRequests.length, 1);
        assertEq(userCashRequests[0], cashId1);
        
        // 测试待审计查询
        uint256[] memory pendingCash = greenTrace.getPendingCashAudits();
        assertEq(pendingCash.length, 1);
        assertEq(pendingCash[0], cashId1);
        
        // 测试系统统计
        (uint256 totalMint, uint256 totalCash, uint256 pendingMint, uint256 pendingCashCount,,) = greenTrace.getSystemStats();
        assertEq(totalMint, 2); // 两个铸造申请
        assertEq(totalCash, 1); // 一个兑换申请
        assertEq(pendingMint, 0); // 都已审核
        assertEq(pendingCashCount, 1); // 一个待审核兑换
    }

    /**
     * @dev 测试权限控制
     */
    function test_AccessControl() public {
        vm.startPrank(user1);
        
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        
        // 非审计员无法提交审计
        vm.expectRevert("Not authorized auditor");
        greenTrace.submitMintAudit(requestId, 800 ether, "");
        
        vm.stopPrank();
        
        // 非所有者无法添加审计员
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        greenTrace.addAuditor(user2);
    }

    /**
     * @dev 测试ID系统独立性
     */
    function test_IDSystemIndependence() public {
        // 创建多个申请，验证ID独立性
        vm.startPrank(user1);
        
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        uint256 requestFee3 = greenTrace.calculateRequestFee(3000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2 + requestFee3);
        
        // 创建3个铸造申请
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        uint256 requestId3 = greenTrace.requestMintNFT("Story3", "Details3", 3000 ether, "ipfs://hash3");
        
        // 验证申请ID连续性
        assertEq(requestId1, 1);
        assertEq(requestId2, 2);
        assertEq(requestId3, 3);
        
        vm.stopPrank();
        
        // 只审核通过第2个和第3个申请
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId2, 1500 ether, "");
        greenTrace.submitMintAudit(requestId3, 2500 ether, "");
        vm.stopPrank();
        
        // 按顺序铸造（第2个先铸造）
        vm.startPrank(user1);
        uint256 totalFee2 = greenTrace.calculateSystemFee(1500 ether) + greenTrace.calculateAuditFee(1500 ether);
        uint256 totalFee3 = greenTrace.calculateSystemFee(2500 ether) + greenTrace.calculateAuditFee(2500 ether);
        
        carbonToken.approve(address(greenTrace), totalFee2 + totalFee3);
        
        uint256 nftId2 = greenTrace.payAndMintNFT(requestId2);
        uint256 nftId3 = greenTrace.payAndMintNFT(requestId3);
        
        // 验证NFT ID连续性（从0开始）
        assertEq(nftId2, 0);
        assertEq(nftId3, 1);
        
        // 验证申请记录中的NFT ID
        GreenTrace.Audit memory audit2 = greenTrace.getRequestById(requestId2);
        GreenTrace.Audit memory audit3 = greenTrace.getRequestById(requestId3);
        assertEq(audit2.nftTokenId, nftId2);
        assertEq(audit3.nftTokenId, nftId3);
        
        vm.stopPrank();
    }

    /**
     * @dev 辅助函数：铸造测试NFT
     */
    function _mintTestNFT(address user, uint256 carbonReduction, uint256 carbonValue) internal returns (uint256 nftTokenId) {
        vm.startPrank(user);
        
        // 申请铸造
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT(unicode"测试故事", unicode"测试详情", carbonReduction, "ipfs://test");
        
        vm.stopPrank();
        
        // 审计通过
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, carbonValue, "");
        
        // 支付并铸造
        vm.startPrank(user);
        uint256 totalFee = greenTrace.calculateSystemFee(carbonValue) + greenTrace.calculateAuditFee(carbonValue);
        carbonToken.approve(address(greenTrace), totalFee);
        nftTokenId = greenTrace.payAndMintNFT(requestId);
        
        vm.stopPrank();
        
        return nftTokenId;
    }

    /**
     * @dev 测试事件监听功能
     */
    function test_EventListening() public {
        vm.startPrank(user1);
        
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        
        // 测试MintRequested事件 - 申请铸造NFT
        uint256 requestId = greenTrace.requestMintNFT("Test Story", "Test Details", carbonReduction, "ipfs://test");
        assertEq(requestId, 1); // 验证申请ID
        
        vm.stopPrank();
        
        // 测试AuditSubmitted事件 - 审计员审核
        vm.startPrank(auditor);
        uint256 carbonValue = 800 ether;
        greenTrace.submitMintAudit(requestId, carbonValue, "Good quality");
        
        // 验证审计结果
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(audit.auditor, auditor);
        assertEq(audit.carbonValue, carbonValue);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Approved));
        vm.stopPrank();
        
        // 测试NFTMintedAfterAudit事件 - 支付并铸造NFT
        vm.startPrank(user1);
        uint256 totalFee = greenTrace.calculateSystemFee(carbonValue) + greenTrace.calculateAuditFee(carbonValue);
        carbonToken.approve(address(greenTrace), totalFee);
        uint256 nftTokenId = greenTrace.payAndMintNFT(requestId);
        assertEq(nftTokenId, 0); // 验证NFT ID
        vm.stopPrank();
        
        // 测试ExchangeRequested事件 - 申请兑换NFT
        vm.startPrank(user1);
        nft.approve(address(greenTrace), nftTokenId);
        uint256 exchangeFee = greenTrace.calculateRequestFee(carbonValue);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftTokenId);
        assertEq(cashId, 1); // 验证兑换申请ID
        vm.stopPrank();
        
        // 测试AuditSubmitted事件 - 兑换审计
        vm.startPrank(auditor);
        uint256 exchangeValue = 700 ether;
        greenTrace.submitExchangeAudit(cashId, exchangeValue, "Exchange approved");
        
        // 验证兑换审计结果
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashId);
        assertEq(cashAudit.auditor, auditor);
        assertEq(cashAudit.carbonValue, exchangeValue);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Approved));
        vm.stopPrank();
        
        // 测试NFTExchanged事件 - 执行兑换
        vm.startPrank(user1);
        uint256 beforeBalance = carbonToken.balanceOf(user1);
        greenTrace.exchangeNFT(cashId);
        
        // 验证兑换结果
        uint256 returnAmount = greenTrace.calculateReturnAmount(exchangeValue);
        assertEq(carbonToken.balanceOf(user1), beforeBalance + returnAmount);
        
        // 验证NFT已销毁
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(nftTokenId);
        vm.stopPrank();
    }

    /**
     * @dev 测试前端查询功能 - 用户申请记录
     */
    function test_FrontendQueryFunctions() public {
        // 创建多个申请记录
        uint256 nftId1 = _mintTestNFT(user1, 1000 ether, 800 ether);
        uint256 nftId2 = _mintTestNFT(user2, 2000 ether, 1500 ether);
        
        // 创建兑换申请
        vm.startPrank(user1);
        uint256 exchangeFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId1 = greenTrace.requestExchangeNFT(nftId1);
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 exchangeFee2 = greenTrace.calculateRequestFee(1500 ether);
        carbonToken.approve(address(greenTrace), exchangeFee2);
        uint256 cashId2 = greenTrace.requestExchangeNFT(nftId2);
        vm.stopPrank();
        
        // 测试用户申请记录查询
        uint256[] memory user1MintRequests = greenTrace.getUserMintRequests(user1);
        uint256[] memory user1CashRequests = greenTrace.getUserCashRequests(user1);
        uint256[] memory user2MintRequests = greenTrace.getUserMintRequests(user2);
        uint256[] memory user2CashRequests = greenTrace.getUserCashRequests(user2);
        
        assertEq(user1MintRequests.length, 1);
        assertEq(user1CashRequests.length, 1);
        assertEq(user2MintRequests.length, 1);
        assertEq(user2CashRequests.length, 1);
        
        // 测试已审计申请查询
        uint256[] memory user1AuditedMint = greenTrace.getUserAuditedMintRequests(user1);
        uint256[] memory allAuditedMint = greenTrace.getAllAuditedMintRequests();
        
        assertEq(user1AuditedMint.length, 1);
        assertEq(allAuditedMint.length, 2);
        
        // 测试兑换历史查询
        uint256[] memory user1CashHistory = greenTrace.getUserCashHistory(user1);
        uint256[] memory allCashHistory = greenTrace.getAllCashHistory();
        
        assertEq(user1CashHistory.length, 1);
        assertEq(allCashHistory.length, 2);
        
        // 测试按状态筛选查询
        uint256[] memory pendingMint = greenTrace.getMintRequestsByStatus(GreenTrace.AuditStatus.Pending);
        uint256[] memory approvedMint = greenTrace.getMintRequestsByStatus(GreenTrace.AuditStatus.Approved);
        uint256[] memory pendingCash = greenTrace.getCashRequestsByStatus(GreenTrace.AuditStatus.Pending);
        
        assertEq(pendingMint.length, 0); // 都已审核
        assertEq(approvedMint.length, 2); // 两个已批准
        assertEq(pendingCash.length, 2); // 两个待审核兑换
    }

    /**
     * @dev 测试前端查询功能 - 审计中心
     */
    function test_AuditCenterQueries() public {
        // 创建待审计的申请
        vm.startPrank(user1);
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2);
        
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        vm.stopPrank();
        
        // 创建兑换申请
        uint256 nftId = _mintTestNFT(user2, 1500 ether, 1200 ether);
        vm.startPrank(user2);
        uint256 exchangeFee = greenTrace.calculateRequestFee(1200 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftId);
        vm.stopPrank();
        
        // 测试待审计查询
        uint256[] memory pendingMintAudits = greenTrace.getPendingMintAudits();
        uint256[] memory pendingCashAudits = greenTrace.getPendingCashAudits();
        
        assertEq(pendingMintAudits.length, 2);
        assertEq(pendingCashAudits.length, 1);
        assertEq(pendingMintAudits[0], requestId1);
        assertEq(pendingMintAudits[1], requestId2);
        assertEq(pendingCashAudits[0], cashId);
        
        // 测试审计员工作记录
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId1, 800 ether, "Approved");
        greenTrace.submitMintAudit(requestId2, 0, "Rejected - insufficient data");
        greenTrace.submitExchangeAudit(cashId, 1000 ether, "Exchange approved");
        vm.stopPrank();
        
        (uint256[] memory auditorMintRequests, uint256[] memory auditorCashRequests) = 
            greenTrace.getAuditorHistory(auditor);
        
        assertEq(auditorMintRequests.length, 3);
        assertEq(auditorCashRequests.length, 1);
        
        // 测试已审计兑换查询
        uint256[] memory auditedCashRequests = greenTrace.getAllAuditedCashRequests();
        assertEq(auditedCashRequests.length, 1);
        assertEq(auditedCashRequests[0], cashId);
    }

    /**
     * @dev 测试前端查询功能 - 系统统计
     */
    function test_SystemStatsQueries() public {
        // 创建各种状态的申请
        vm.startPrank(user1);
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        uint256 requestFee3 = greenTrace.calculateRequestFee(3000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2 + requestFee3);
        
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        uint256 requestId3 = greenTrace.requestMintNFT("Story3", "Details3", 3000 ether, "ipfs://hash3");
        vm.stopPrank();
        
        // 审核申请
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId1, 800 ether, "Approved");
        greenTrace.submitMintAudit(requestId2, 0, "Rejected");
        // requestId3 保持待审核状态
        vm.stopPrank();
        
        // 测试系统统计
        (uint256 totalMintRequests, uint256 totalCashRequests, uint256 pendingMintRequests, 
         uint256 pendingCashRequests, uint256 approvedMintRequests, uint256 approvedCashRequests) = 
            greenTrace.getSystemStats();
        
        assertEq(totalMintRequests, 3);
        assertEq(totalCashRequests, 0);
        assertEq(pendingMintRequests, 1); // requestId3
        assertEq(pendingCashRequests, 0);
        assertEq(approvedMintRequests, 1); // requestId1
        assertEq(approvedCashRequests, 0);
    }

    /**
     * @dev 测试NFT关联查询功能
     */
    function test_NFTRelatedQueries() public {
        // 铸造NFT
        uint256 nftId = _mintTestNFT(user1, 1000 ether, 800 ether);
        
        // 创建兑换申请
        vm.startPrank(user1);
        uint256 exchangeFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftId);
        vm.stopPrank();
        
        // 测试根据NFT ID查询关联申请
        uint256[] memory mintRequests = greenTrace.getRequestsByNFTId(nftId);
        uint256[] memory cashRequests = greenTrace.getCashByNFTId(nftId);
        
        assertEq(mintRequests.length, 1);
        assertEq(cashRequests.length, 1);
        
        // 验证申请详情
        GreenTrace.Audit memory mintAudit = greenTrace.getRequestById(mintRequests[0]);
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashRequests[0]);
        
        assertEq(mintAudit.nftTokenId, nftId);
        assertEq(cashAudit.nftTokenId, nftId);
        assertEq(cashAudit.requestId, cashId);
    }

    /**
     * @dev 测试审计意见查询功能
     */
    function test_AuditCommentQueries() public {
        vm.startPrank(user1);
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        vm.stopPrank();
        
        // 测试铸造审计意见
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId, 800 ether, "Excellent environmental impact");
        vm.stopPrank();
        
        string memory mintComment = greenTrace.getMintAuditComment(requestId);
        assertEq(mintComment, "Excellent environmental impact");
        
        // 测试兑换审计意见
        uint256 nftId = _mintTestNFT(user1, 1500 ether, 1200 ether);
        vm.startPrank(user1);
        uint256 exchangeFee = greenTrace.calculateRequestFee(1200 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftId);
        vm.stopPrank();
        
        vm.startPrank(auditor);
        greenTrace.submitExchangeAudit(cashId, 1000 ether, "Exchange value confirmed");
        vm.stopPrank();
        
        string memory cashComment = greenTrace.getCashAuditComment(cashId);
        assertEq(cashComment, "Exchange value confirmed");
    }
} 
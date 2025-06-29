// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTrace.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTrace Test Cases
 * @dev Tests complete functionality of the new GreenTrace contract, including independent ID system, audit opinion storage, etc.
 * 
 * Test coverage:
 * 1. Basic setup and initialization
 * 2. Mint request-audit-payment-mint flow
 * 3. Exchange request-audit-exchange flow
 * 4. Audit opinion storage and query
 * 5. ID system independence verification
 * 6. Permission control and error handling
 * 7. Data query functionality
 */
contract GreenTraceTest is Test {
    GreenTrace public greenTrace;        // GreenTrace contract instance
    CarbonToken public carbonToken;      // Carbon token contract instance
    GreenTalesNFT public nft;            // NFT contract instance
    
    address public owner;                // Contract owner
    address public auditor;              // Auditor
    address public user1;                // Test user 1
    address public user2;                // Test user 2
    
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // Initial supply

    /**
     * @dev Test environment setup
     */
    function setUp() public {
        owner = address(this);
        auditor = makeAddr("auditor");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // 1. Deploy CarbonToken
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        // 2. Deploy GreenTrace contract
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        
        // 3. Deploy NFT contract
        nft = new GreenTalesNFT(address(greenTrace));
        
        // 4. Set contract relationships
        carbonToken.setGreenTrace(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        greenTrace.addAuditor(auditor);

        // 5. Allocate carbon tokens to test users
        carbonToken.transfer(user1, 10000 ether);
        carbonToken.transfer(user2, 10000 ether);
    }

    /**
     * @dev Test contract initial state
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
     * @dev Test complete minting flow: Request → Audit → Payment → Mint
     */
    function test_CompleteMintFlow() public {
        vm.startPrank(user1);
        
        // 1. Calculate request fee
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        
        // 2. Approve and request NFT minting
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT(
            "Test Green Story",
            "This is a test environmental story",
            carbonReduction,
            "ipfs://QmTestHash"
        );
        
        // Verify request record
        assertEq(requestId, 1); // First request ID should be 1
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(audit.requester, user1);
        assertEq(audit.requestId, requestId);
        assertEq(audit.nftTokenId, 0); // Not minted yet, NFT ID is 0
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Pending));
        assertEq(uint256(audit.auditType), uint256(GreenTrace.AuditType.Mint));
        
        vm.stopPrank();
        
        // 3. Auditor reviews and approves
        vm.prank(auditor);
        uint256 carbonValue = 800 ether;
        greenTrace.submitMintAudit(requestId, carbonValue, "Data accurate, excellent quality");
        
        // Verify audit result
        audit = greenTrace.getRequestById(requestId);
        assertEq(audit.auditor, auditor);
        assertEq(audit.carbonValue, carbonValue);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Approved));
        assertEq(audit.auditComment, "Data accurate, excellent quality");
        
        // 4. User pays fees and mints NFT
        vm.startPrank(user1);
        uint256 systemFee = greenTrace.calculateSystemFee(carbonValue);
        uint256 auditFee = greenTrace.calculateAuditFee(carbonValue);
        uint256 totalFee = systemFee + auditFee;
        
        carbonToken.approve(address(greenTrace), totalFee);
        uint256 nftTokenId = greenTrace.payAndMintNFT(requestId);
        
        // Verify NFT minting
        assertEq(nft.ownerOf(nftTokenId), user1);
        assertEq(nftTokenId, 0); // First NFT ID should be 0
        
        // Verify request record update
        audit = greenTrace.getRequestById(requestId);
        assertEq(audit.nftTokenId, nftTokenId);
        
        // Verify NFT metadata
        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(nftTokenId);
        assertEq(meta.storyTitle, "Test Green Story");
        assertEq(meta.carbonReduction, carbonReduction);
        assertEq(meta.initialPrice, carbonValue);
        
        vm.stopPrank();
    }

    /**
     * @dev Test audit rejection flow
     */
    function test_MintAuditRejection() public {
        vm.startPrank(user1);
        
        // Request NFT minting
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT(
            "Invalid Story",
            "This story has inaccurate data",
            carbonReduction,
            "ipfs://QmInvalidHash"
        );
        
        vm.stopPrank();
        
        // Auditor rejects request
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, 0, "Insufficient data, please provide more detailed supporting materials");
        
        // Verify rejection result
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Rejected));
        assertEq(audit.auditComment, "Insufficient data, please provide more detailed supporting materials");
        assertEq(audit.carbonValue, 0);
        
        // Verify cannot mint NFT
        vm.startPrank(user1);
        vm.expectRevert("Mint audit not approved");
        greenTrace.payAndMintNFT(requestId);
        vm.stopPrank();
    }

    /**
     * @dev Test exchange flow: Request → Audit → Exchange
     */
    function test_CompleteExchangeFlow() public {
        // First mint an NFT
        uint256 nftTokenId = _mintTestNFT(user1, 1000 ether, 800 ether);
        
        vm.startPrank(user1);
        
        // 1. Request NFT exchange
        uint256 requestFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftTokenId);
        
        // Verify exchange request
        assertEq(cashId, 1); // First exchange request ID should be 1
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashId);
        assertEq(cashAudit.requester, user1);
        assertEq(cashAudit.nftTokenId, nftTokenId);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Pending));
        assertEq(uint256(cashAudit.auditType), uint256(GreenTrace.AuditType.Exchange));
        
        vm.stopPrank();
        
        // 2. Auditor reviews exchange
        vm.prank(auditor);
        uint256 exchangeValue = 700 ether;
        greenTrace.submitExchangeAudit(cashId, exchangeValue, "Exchange approved");
        
        // Verify exchange audit result
        cashAudit = greenTrace.getCashById(cashId);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Approved));
        assertEq(cashAudit.carbonValue, exchangeValue);
        assertEq(cashAudit.auditComment, "Exchange approved");
        
        // 3. Execute exchange
        vm.startPrank(user1);
        nft.approve(address(greenTrace), nftTokenId);
        
        uint256 beforeBalance = carbonToken.balanceOf(user1);
        greenTrace.exchangeNFT(cashId);
        
        // Verify NFT destroyed
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(nftTokenId);
        
        // Verify carbon increase
        uint256 returnAmount = greenTrace.calculateReturnAmount(exchangeValue);
        assertEq(carbonToken.balanceOf(user1), beforeBalance + returnAmount);
        
        vm.stopPrank();
    }

    /**
     * @dev Test audit opinion storage functionality
     */
    function test_AuditCommentStorage() public {
        vm.startPrank(user1);
        
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2);
        
        // Create two requests
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        
        vm.stopPrank();
        
        vm.startPrank(auditor);
        
        // Approve request - with comment
        greenTrace.submitMintAudit(requestId1, 800 ether, "Quality excellent, data detailed");
        
        // Reject request - must have reason
        greenTrace.submitMintAudit(requestId2, 0, "Incomplete data, need more materials");
        
        vm.stopPrank();
        
        // Verify audit opinion storage
        assertEq(greenTrace.getMintAuditComment(requestId1), "Quality excellent, data detailed");
        assertEq(greenTrace.getMintAuditComment(requestId2), "Incomplete data, need more materials");
        
        // Verify through complete record query
        GreenTrace.Audit memory audit1 = greenTrace.getRequestById(requestId1);
        GreenTrace.Audit memory audit2 = greenTrace.getRequestById(requestId2);
        assertEq(audit1.auditComment, "Quality excellent, data detailed");
        assertEq(audit2.auditComment, "Incomplete data, need more materials");
    }

    /**
     * @dev Test rejection must have reason
     */
    function test_RejectionReasonRequired() public {
        vm.startPrank(user1);
        
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        
        vm.stopPrank();
        
        // Test rejection without reason fails
        vm.prank(auditor);
        vm.expectRevert("Rejection reason is required");
        greenTrace.submitMintAudit(requestId, 0, "");
        
        // Test providing reason after rejection
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, 0, "Data does not meet requirements");
        
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Rejected));
    }

    /**
     * @dev Test query functionality
     */
    function test_QueryFunctions() public {
        // Create multiple request and exchange records
        uint256 nftId1 = _mintTestNFT(user1, 1000 ether, 800 ether);
        uint256 nftId2 = _mintTestNFT(user2, 2000 ether, 1500 ether);
        
        // Create exchange request
        vm.startPrank(user1);
        uint256 requestFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 cashId1 = greenTrace.requestExchangeNFT(nftId1);
        vm.stopPrank();
        
        // Test user request query
        uint256[] memory userMintRequests = greenTrace.getUserMintRequests(user1);
        uint256[] memory userCashRequests = greenTrace.getUserCashRequests(user1);
        
        assertEq(userMintRequests.length, 1);
        assertEq(userCashRequests.length, 1);
        assertEq(userCashRequests[0], cashId1);
        
        // Test pending audit query
        uint256[] memory pendingCash = greenTrace.getPendingCashAudits();
        assertEq(pendingCash.length, 1);
        assertEq(pendingCash[0], cashId1);
        
        // Test system stats
        (uint256 totalMint, uint256 totalCash, uint256 pendingMint, uint256 pendingCashCount,,) = greenTrace.getSystemStats();
        assertEq(totalMint, 2); // Two mint requests
        assertEq(totalCash, 1); // One exchange request
        assertEq(pendingMint, 0); // All audited
        assertEq(pendingCashCount, 1); // One pending exchange
    }

    /**
     * @dev Test permission control
     */
    function test_AccessControl() public {
        vm.startPrank(user1);
        
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        
        // Non-auditor cannot submit audit
        vm.expectRevert("Not authorized auditor");
        greenTrace.submitMintAudit(requestId, 800 ether, "");
        
        vm.stopPrank();
        
        // Non-owner cannot add auditor
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        greenTrace.addAuditor(user2);
    }

    /**
     * @dev Test ID system independence
     */
    function test_IDSystemIndependence() public {
        // Create multiple requests, verify ID independence
        vm.startPrank(user1);
        
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        uint256 requestFee3 = greenTrace.calculateRequestFee(3000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2 + requestFee3);
        
        // Create 3 mint requests
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        uint256 requestId3 = greenTrace.requestMintNFT("Story3", "Details3", 3000 ether, "ipfs://hash3");
        
        // Verify request ID continuity
        assertEq(requestId1, 1);
        assertEq(requestId2, 2);
        assertEq(requestId3, 3);
        
        vm.stopPrank();
        
        // Only approve 2nd and 3rd requests
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId2, 1500 ether, "");
        greenTrace.submitMintAudit(requestId3, 2500 ether, "");
        vm.stopPrank();
        
        // Mint in order (2nd first)
        vm.startPrank(user1);
        uint256 totalFee2 = greenTrace.calculateSystemFee(1500 ether) + greenTrace.calculateAuditFee(1500 ether);
        uint256 totalFee3 = greenTrace.calculateSystemFee(2500 ether) + greenTrace.calculateAuditFee(2500 ether);
        
        carbonToken.approve(address(greenTrace), totalFee2 + totalFee3);
        
        uint256 nftId2 = greenTrace.payAndMintNFT(requestId2);
        uint256 nftId3 = greenTrace.payAndMintNFT(requestId3);
        
        // Verify NFT ID continuity (from 0)
        assertEq(nftId2, 0);
        assertEq(nftId3, 1);
        
        // Verify NFT ID in request record
        GreenTrace.Audit memory audit2 = greenTrace.getRequestById(requestId2);
        GreenTrace.Audit memory audit3 = greenTrace.getRequestById(requestId3);
        assertEq(audit2.nftTokenId, nftId2);
        assertEq(audit3.nftTokenId, nftId3);
        
        vm.stopPrank();
    }

    /**
     * @dev Helper function: Mint test NFT
     */
    function _mintTestNFT(address user, uint256 carbonReduction, uint256 carbonValue) internal returns (uint256 nftTokenId) {
        vm.startPrank(user);
        
        // Request minting
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT(unicode"Test Story", unicode"Test Details", carbonReduction, "ipfs://test");
        
        vm.stopPrank();
        
        // Audit approved
        vm.prank(auditor);
        greenTrace.submitMintAudit(requestId, carbonValue, "");
        
        // Pay and mint
        vm.startPrank(user);
        uint256 totalFee = greenTrace.calculateSystemFee(carbonValue) + greenTrace.calculateAuditFee(carbonValue);
        carbonToken.approve(address(greenTrace), totalFee);
        nftTokenId = greenTrace.payAndMintNFT(requestId);
        
        vm.stopPrank();
        
        return nftTokenId;
    }

    /**
     * @dev Test event listening functionality
     */
    function test_EventListening() public {
        vm.startPrank(user1);
        
        uint256 carbonReduction = 1000 ether;
        uint256 requestFee = greenTrace.calculateRequestFee(carbonReduction);
        carbonToken.approve(address(greenTrace), requestFee);
        
        // Test MintRequested event - Request NFT minting
        uint256 requestId = greenTrace.requestMintNFT("Test Story", "Test Details", carbonReduction, "ipfs://test");
        assertEq(requestId, 1); // Verify request ID
        
        vm.stopPrank();
        
        // Test AuditSubmitted event - Auditor reviews
        vm.startPrank(auditor);
        uint256 carbonValue = 800 ether;
        greenTrace.submitMintAudit(requestId, carbonValue, "Good quality");
        
        // Verify audit result
        GreenTrace.Audit memory audit = greenTrace.getRequestById(requestId);
        assertEq(audit.auditor, auditor);
        assertEq(audit.carbonValue, carbonValue);
        assertEq(uint256(audit.status), uint256(GreenTrace.AuditStatus.Approved));
        vm.stopPrank();
        
        // Test NFTMintedAfterAudit event - Pay and mint NFT
        vm.startPrank(user1);
        uint256 totalFee = greenTrace.calculateSystemFee(carbonValue) + greenTrace.calculateAuditFee(carbonValue);
        carbonToken.approve(address(greenTrace), totalFee);
        uint256 nftTokenId = greenTrace.payAndMintNFT(requestId);
        assertEq(nftTokenId, 0); // Verify NFT ID
        vm.stopPrank();
        
        // Test ExchangeRequested event - Request NFT exchange
        vm.startPrank(user1);
        nft.approve(address(greenTrace), nftTokenId);
        uint256 exchangeFee = greenTrace.calculateRequestFee(carbonValue);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftTokenId);
        assertEq(cashId, 1); // Verify exchange request ID
        vm.stopPrank();
        
        // Test AuditSubmitted event - Exchange audit
        vm.startPrank(auditor);
        uint256 exchangeValue = 700 ether;
        greenTrace.submitExchangeAudit(cashId, exchangeValue, "Exchange approved");
        
        // Verify exchange audit result
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashId);
        assertEq(cashAudit.auditor, auditor);
        assertEq(cashAudit.carbonValue, exchangeValue);
        assertEq(uint256(cashAudit.status), uint256(GreenTrace.AuditStatus.Approved));
        vm.stopPrank();
        
        // Test NFTExchanged event - Execute exchange
        vm.startPrank(user1);
        uint256 beforeBalance = carbonToken.balanceOf(user1);
        greenTrace.exchangeNFT(cashId);
        
        // Verify exchange result
        uint256 returnAmount = greenTrace.calculateReturnAmount(exchangeValue);
        assertEq(carbonToken.balanceOf(user1), beforeBalance + returnAmount);
        
        // Verify NFT destroyed
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(nftTokenId);
        vm.stopPrank();
    }

    /**
     * @dev Test frontend query functionality - User request record
     */
    function test_FrontendQueryFunctions() public {
        // Create multiple request records
        uint256 nftId1 = _mintTestNFT(user1, 1000 ether, 800 ether);
        uint256 nftId2 = _mintTestNFT(user2, 2000 ether, 1500 ether);
        
        // Create exchange request
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
        
        // Test user request record query
        uint256[] memory user1MintRequests = greenTrace.getUserMintRequests(user1);
        uint256[] memory user1CashRequests = greenTrace.getUserCashRequests(user1);
        uint256[] memory user2MintRequests = greenTrace.getUserMintRequests(user2);
        uint256[] memory user2CashRequests = greenTrace.getUserCashRequests(user2);
        
        assertEq(user1MintRequests.length, 1);
        assertEq(user1CashRequests.length, 1);
        assertEq(user2MintRequests.length, 1);
        assertEq(user2CashRequests.length, 1);
        
        // Test audited request query
        uint256[] memory user1AuditedMint = greenTrace.getUserAuditedMintRequests(user1);
        uint256[] memory allAuditedMint = greenTrace.getAllAuditedMintRequests();
        
        assertEq(user1AuditedMint.length, 1);
        assertEq(allAuditedMint.length, 2);
        
        // Test exchange history query
        uint256[] memory user1CashHistory = greenTrace.getUserCashHistory(user1);
        uint256[] memory allCashHistory = greenTrace.getAllCashHistory();
        
        assertEq(user1CashHistory.length, 1);
        assertEq(allCashHistory.length, 2);
        
        // Test filter query by status
        uint256[] memory pendingMint = greenTrace.getMintRequestsByStatus(GreenTrace.AuditStatus.Pending);
        uint256[] memory approvedMint = greenTrace.getMintRequestsByStatus(GreenTrace.AuditStatus.Approved);
        uint256[] memory pendingCash = greenTrace.getCashRequestsByStatus(GreenTrace.AuditStatus.Pending);
        
        assertEq(pendingMint.length, 0); // All audited
        assertEq(approvedMint.length, 2); // Two approved
        assertEq(pendingCash.length, 2); // Two pending exchange
    }

    /**
     * @dev Test frontend query functionality - Auditor center
     */
    function test_AuditCenterQueries() public {
        // Create pending audit request
        vm.startPrank(user1);
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2);
        
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        vm.stopPrank();
        
        // Create exchange request
        uint256 nftId = _mintTestNFT(user2, 1500 ether, 1200 ether);
        vm.startPrank(user2);
        uint256 exchangeFee = greenTrace.calculateRequestFee(1200 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftId);
        vm.stopPrank();
        
        // Test pending audit query
        uint256[] memory pendingMintAudits = greenTrace.getPendingMintAudits();
        uint256[] memory pendingCashAudits = greenTrace.getPendingCashAudits();
        
        assertEq(pendingMintAudits.length, 2);
        assertEq(pendingCashAudits.length, 1);
        assertEq(pendingMintAudits[0], requestId1);
        assertEq(pendingMintAudits[1], requestId2);
        assertEq(pendingCashAudits[0], cashId);
        
        // Test auditor work record
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId1, 800 ether, "Approved");
        greenTrace.submitMintAudit(requestId2, 0, "Rejected - insufficient data");
        greenTrace.submitExchangeAudit(cashId, 1000 ether, "Exchange approved");
        vm.stopPrank();
        
        (uint256[] memory auditorMintRequests, uint256[] memory auditorCashRequests) = 
            greenTrace.getAuditorHistory(auditor);
        
        assertEq(auditorMintRequests.length, 3);
        assertEq(auditorCashRequests.length, 1);
        
        // Test audited exchange query
        uint256[] memory auditedCashRequests = greenTrace.getAllAuditedCashRequests();
        assertEq(auditedCashRequests.length, 1);
        assertEq(auditedCashRequests[0], cashId);
    }

    /**
     * @dev Test frontend query functionality - System stats
     */
    function test_SystemStatsQueries() public {
        // Create various status requests
        vm.startPrank(user1);
        uint256 requestFee1 = greenTrace.calculateRequestFee(1000 ether);
        uint256 requestFee2 = greenTrace.calculateRequestFee(2000 ether);
        uint256 requestFee3 = greenTrace.calculateRequestFee(3000 ether);
        carbonToken.approve(address(greenTrace), requestFee1 + requestFee2 + requestFee3);
        
        uint256 requestId1 = greenTrace.requestMintNFT("Story1", "Details1", 1000 ether, "ipfs://hash1");
        uint256 requestId2 = greenTrace.requestMintNFT("Story2", "Details2", 2000 ether, "ipfs://hash2");
        uint256 requestId3 = greenTrace.requestMintNFT("Story3", "Details3", 3000 ether, "ipfs://hash3");
        vm.stopPrank();
        
        // Audit requests
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId1, 800 ether, "Approved");
        greenTrace.submitMintAudit(requestId2, 0, "Rejected");
        // requestId3 remains pending
        vm.stopPrank();
        
        // Test system stats
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
     * @dev Test NFT related query functionality
     */
    function test_NFTRelatedQueries() public {
        // Mint NFT
        uint256 nftId = _mintTestNFT(user1, 1000 ether, 800 ether);
        
        // Create exchange request
        vm.startPrank(user1);
        uint256 exchangeFee = greenTrace.calculateRequestFee(800 ether);
        carbonToken.approve(address(greenTrace), exchangeFee);
        uint256 cashId = greenTrace.requestExchangeNFT(nftId);
        vm.stopPrank();
        
        // Test query by NFT ID for related requests
        uint256[] memory mintRequests = greenTrace.getRequestsByNFTId(nftId);
        uint256[] memory cashRequests = greenTrace.getCashByNFTId(nftId);
        
        assertEq(mintRequests.length, 1);
        assertEq(cashRequests.length, 1);
        
        // Verify request details
        GreenTrace.Audit memory mintAudit = greenTrace.getRequestById(mintRequests[0]);
        GreenTrace.Audit memory cashAudit = greenTrace.getCashById(cashRequests[0]);
        
        assertEq(mintAudit.nftTokenId, nftId);
        assertEq(cashAudit.nftTokenId, nftId);
        assertEq(cashAudit.requestId, cashId);
    }

    /**
     * @dev Test audit opinion query functionality
     */
    function test_AuditCommentQueries() public {
        vm.startPrank(user1);
        uint256 requestFee = greenTrace.calculateRequestFee(1000 ether);
        carbonToken.approve(address(greenTrace), requestFee);
        uint256 requestId = greenTrace.requestMintNFT("Story", "Details", 1000 ether, "ipfs://hash");
        vm.stopPrank();
        
        // Test mint audit opinion
        vm.startPrank(auditor);
        greenTrace.submitMintAudit(requestId, 800 ether, "Excellent environmental impact");
        vm.stopPrank();
        
        string memory mintComment = greenTrace.getMintAuditComment(requestId);
        assertEq(mintComment, "Excellent environmental impact");
        
        // Test exchange audit opinion
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
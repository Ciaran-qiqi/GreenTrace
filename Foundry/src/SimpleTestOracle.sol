// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title SimpleTestOracle
 * @dev 最小化测试预言机，用于诊断问题
 */
contract SimpleTestOracle is FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;
    
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit;
    
    event TestRequestSent(bytes32 indexed requestId);
    event TestRequestFulfilled(bytes32 indexed requestId, bytes response);
    
    constructor(
        address router,
        bytes32 _donId,
        uint64 _subscriptionId
    ) FunctionsClient(router) Ownable() {
        donId = _donId;
        subscriptionId = _subscriptionId;
        gasLimit = 1000000;
    }
    
    function testRequest() external onlyOwner {
        // 最简单的JavaScript代码
        string memory source = "return Functions.encodeString('Hello World');";
        
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        bytes memory encodedRequest = req.encodeCBOR();
        
        bytes32 requestId = _sendRequest(
            encodedRequest,
            subscriptionId,
            gasLimit,
            donId
        );
        
        emit TestRequestSent(requestId);
    }
    
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            return;
        }
        
        emit TestRequestFulfilled(requestId, response);
    }
} 
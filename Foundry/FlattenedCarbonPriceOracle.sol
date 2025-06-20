// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol

// solhint-disable-next-line interface-starts-with-i
interface AggregatorV3Interface {
  function decimals() external view returns (uint8);

  function description() external view returns (string memory);

  function version() external view returns (uint256);

  function getRoundData(
    uint80 _roundId
  ) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vendor/@ensdomains/buffer/v0.1.0/Buffer.sol

/**
* @dev A library for working with mutable byte buffers in Solidity.
*
* Byte buffers are mutable and expandable, and provide a variety of primitives
* for appending to them. At any time you can fetch a bytes object containing the
* current contents of the buffer. The bytes object should not be stored between
* operations, as it may change due to resizing of the buffer.
*/
library Buffer {
    /**
    * @dev Represents a mutable buffer. Buffers have a current value (buf) and
    *      a capacity. The capacity may be longer than the current value, in
    *      which case it can be extended without the need to allocate more memory.
    */
    struct buffer {
        bytes buf;
        uint capacity;
    }

    /**
    * @dev Initializes a buffer with an initial capacity.
    * @param buf The buffer to initialize.
    * @param capacity The number of bytes of space to allocate the buffer.
    * @return The buffer, for chaining.
    */
    function init(buffer memory buf, uint capacity) internal pure returns(buffer memory) {
        if (capacity % 32 != 0) {
            capacity += 32 - (capacity % 32);
        }
        // Allocate space for the buffer data
        buf.capacity = capacity;
        assembly {
            let ptr := mload(0x40)
            mstore(buf, ptr)
            mstore(ptr, 0)
            let fpm := add(32, add(ptr, capacity))
            if lt(fpm, ptr) {
                revert(0, 0)
            }
            mstore(0x40, fpm)
        }
        return buf;
    }

    /**
    * @dev Initializes a new buffer from an existing bytes object.
    *      Changes to the buffer may mutate the original value.
    * @param b The bytes object to initialize the buffer with.
    * @return A new buffer.
    */
    function fromBytes(bytes memory b) internal pure returns(buffer memory) {
        buffer memory buf;
        buf.buf = b;
        buf.capacity = b.length;
        return buf;
    }

    function resize(buffer memory buf, uint capacity) private pure {
        bytes memory oldbuf = buf.buf;
        init(buf, capacity);
        append(buf, oldbuf);
    }

    /**
    * @dev Sets buffer length to 0.
    * @param buf The buffer to truncate.
    * @return The original buffer, for chaining..
    */
    function truncate(buffer memory buf) internal pure returns (buffer memory) {
        assembly {
            let bufptr := mload(buf)
            mstore(bufptr, 0)
        }
        return buf;
    }

    /**
    * @dev Appends len bytes of a byte string to a buffer. Resizes if doing so would exceed
    *      the capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @param len The number of bytes to copy.
    * @return The original buffer, for chaining.
    */
    function append(buffer memory buf, bytes memory data, uint len) internal pure returns(buffer memory) {
        require(len <= data.length);

        uint off = buf.buf.length;
        uint newCapacity = off + len;
        if (newCapacity > buf.capacity) {
            resize(buf, newCapacity * 2);
        }

        uint dest;
        uint src;
        assembly {
            // Memory address of the buffer data
            let bufptr := mload(buf)
            // Length of existing buffer data
            let buflen := mload(bufptr)
            // Start address = buffer address + offset + sizeof(buffer length)
            dest := add(add(bufptr, 32), off)
            // Update buffer length if we're extending it
            if gt(newCapacity, buflen) {
                mstore(bufptr, newCapacity)
            }
            src := add(data, 32)
        }

        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        unchecked {
            uint mask = (256 ** (32 - len)) - 1;
            assembly {
                let srcpart := and(mload(src), not(mask))
                let destpart := and(mload(dest), mask)
                mstore(dest, or(destpart, srcpart))
            }
        }

        return buf;
    }

    /**
    * @dev Appends a byte string to a buffer. Resizes if doing so would exceed
    *      the capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @return The original buffer, for chaining.
    */
    function append(buffer memory buf, bytes memory data) internal pure returns (buffer memory) {
        return append(buf, data, data.length);
    }

    /**
    * @dev Appends a byte to the buffer. Resizes if doing so would exceed the
    *      capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @return The original buffer, for chaining.
    */
    function appendUint8(buffer memory buf, uint8 data) internal pure returns(buffer memory) {
        uint off = buf.buf.length;
        uint offPlusOne = off + 1;
        if (off >= buf.capacity) {
            resize(buf, offPlusOne * 2);
        }

        assembly {
            // Memory address of the buffer data
            let bufptr := mload(buf)
            // Address = buffer address + sizeof(buffer length) + off
            let dest := add(add(bufptr, off), 32)
            mstore8(dest, data)
            // Update buffer length if we extended it
            if gt(offPlusOne, mload(bufptr)) {
                mstore(bufptr, offPlusOne)
            }
        }

        return buf;
    }

    /**
    * @dev Appends len bytes of bytes32 to a buffer. Resizes if doing so would
    *      exceed the capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @param len The number of bytes to write (left-aligned).
    * @return The original buffer, for chaining.
    */
    function append(buffer memory buf, bytes32 data, uint len) private pure returns(buffer memory) {
        uint off = buf.buf.length;
        uint newCapacity = len + off;
        if (newCapacity > buf.capacity) {
            resize(buf, newCapacity * 2);
        }

        unchecked {
            uint mask = (256 ** len) - 1;
            // Right-align data
            data = data >> (8 * (32 - len));
            assembly {
                // Memory address of the buffer data
                let bufptr := mload(buf)
                // Address = buffer address + sizeof(buffer length) + newCapacity
                let dest := add(bufptr, newCapacity)
                mstore(dest, or(and(mload(dest), not(mask)), data))
                // Update buffer length if we extended it
                if gt(newCapacity, mload(bufptr)) {
                    mstore(bufptr, newCapacity)
                }
            }
        }
        return buf;
    }

    /**
    * @dev Appends a bytes20 to the buffer. Resizes if doing so would exceed
    *      the capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @return The original buffer, for chhaining.
    */
    function appendBytes20(buffer memory buf, bytes20 data) internal pure returns (buffer memory) {
        return append(buf, bytes32(data), 20);
    }

    /**
    * @dev Appends a bytes32 to the buffer. Resizes if doing so would exceed
    *      the capacity of the buffer.
    * @param buf The buffer to append to.
    * @param data The data to append.
    * @return The original buffer, for chaining.
    */
    function appendBytes32(buffer memory buf, bytes32 data) internal pure returns (buffer memory) {
        return append(buf, data, 32);
    }

    /**
     * @dev Appends a byte to the end of the buffer. Resizes if doing so would
     *      exceed the capacity of the buffer.
     * @param buf The buffer to append to.
     * @param data The data to append.
     * @param len The number of bytes to write (right-aligned).
     * @return The original buffer.
     */
    function appendInt(buffer memory buf, uint data, uint len) internal pure returns(buffer memory) {
        uint off = buf.buf.length;
        uint newCapacity = len + off;
        if (newCapacity > buf.capacity) {
            resize(buf, newCapacity * 2);
        }

        uint mask = (256 ** len) - 1;
        assembly {
            // Memory address of the buffer data
            let bufptr := mload(buf)
            // Address = buffer address + sizeof(buffer length) + newCapacity
            let dest := add(bufptr, newCapacity)
            mstore(dest, or(and(mload(dest), not(mask)), data))
            // Update buffer length if we extended it
            if gt(newCapacity, mload(bufptr)) {
                mstore(bufptr, newCapacity)
            }
        }
        return buf;
    }
}

// lib/openzeppelin-contracts/contracts/utils/Context.sol

// OpenZeppelin Contracts v4.4.1 (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsResponse.sol

/// @title Library of types that are used for fulfillment of a Functions request
library FunctionsResponse {
  // Used to send request information from the Router to the Coordinator
  struct RequestMeta {
    bytes data; // ══════════════════╸ CBOR encoded Chainlink Functions request data, use FunctionsRequest library to encode a request
    bytes32 flags; // ═══════════════╸ Per-subscription flags
    address requestingContract; // ══╗ The client contract that is sending the request
    uint96 availableBalance; // ═════╝ Common LINK balance of the subscription that is controlled by the Router to be used for all consumer requests.
    uint72 adminFee; // ═════════════╗ Flat fee (in Juels of LINK) that will be paid to the Router Owner for operation of the network
    uint64 subscriptionId; //        ║ Identifier of the billing subscription that will be charged for the request
    uint64 initiatedRequests; //     ║ The number of requests that have been started
    uint32 callbackGasLimit; //      ║ The amount of gas that the callback to the consuming contract will be given
    uint16 dataVersion; // ══════════╝ The version of the structure of the CBOR encoded request data
    uint64 completedRequests; // ════╗ The number of requests that have successfully completed or timed out
    address subscriptionOwner; // ═══╝ The owner of the billing subscription
  }

  enum FulfillResult {
    FULFILLED, // 0
    USER_CALLBACK_ERROR, // 1
    INVALID_REQUEST_ID, // 2
    COST_EXCEEDS_COMMITMENT, // 3
    INSUFFICIENT_GAS_PROVIDED, // 4
    SUBSCRIPTION_BALANCE_INVARIANT_VIOLATION, // 5
    INVALID_COMMITMENT // 6
  }

  struct Commitment {
    bytes32 requestId; // ═════════════════╸ A unique identifier for a Chainlink Functions request
    address coordinator; // ═══════════════╗ The Coordinator contract that manages the DON that is servicing a request
    uint96 estimatedTotalCostJuels; // ════╝ The maximum cost in Juels (1e18) of LINK that will be charged to fulfill a request
    address client; // ════════════════════╗ The client contract that sent the request
    uint64 subscriptionId; //              ║ Identifier of the billing subscription that will be charged for the request
    uint32 callbackGasLimit; // ═══════════╝ The amount of gas that the callback to the consuming contract will be given
    uint72 adminFee; // ═══════════════════╗ Flat fee (in Juels of LINK) that will be paid to the Router Owner for operation of the network
    uint72 donFee; //                      ║ Fee (in Juels of LINK) that will be split between Node Operators for servicing a request
    uint40 gasOverheadBeforeCallback; //   ║ Represents the average gas execution cost before the fulfillment callback.
    uint40 gasOverheadAfterCallback; //    ║ Represents the average gas execution cost after the fulfillment callback.
    uint32 timeoutTimestamp; // ═══════════╝ The timestamp at which a request will be eligible to be timed out
  }
}

// src/interfaces/ICarbonPriceOracle.sol

// wake-disable unsafe-erc20-call 

/**
 * @title ICarbonPriceOracle
 * @dev 碳价预言机接口
 * @notice 用于获取碳价的参考价格
 */
interface ICarbonPriceOracle {
    /**
     * @dev 获取最新碳价（美元）
     * @return 碳价（美元）
     */
    function getLatestCarbonPriceUSD() external view returns (uint256);

    /**
     * @dev 获取最新碳价（欧元）
     * @return 碳价（欧元）
     */
    function getLatestCarbonPriceEUR() external view returns (uint256);
} 

// lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsClient.sol

/// @title Chainlink Functions client interface.
interface IFunctionsClient {
  /// @notice Chainlink Functions response handler called by the Functions Router
  /// during fullilment from the designated transmitter node in an OCR round.
  /// @param requestId The requestId returned by FunctionsClient.sendRequest().
  /// @param response Aggregated response from the request's source code.
  /// @param err Aggregated error either from the request's source code or from the execution pipeline.
  /// @dev Either response or error parameter will be set, but never both.
  function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external;
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vendor/solidity-cborutils/v2.0.0/CBOR.sol

/**
* @dev A library for populating CBOR encoded payload in Solidity.
*
* https://datatracker.ietf.org/doc/html/rfc7049
*
* The library offers various write* and start* methods to encode values of different types.
* The resulted buffer can be obtained with data() method.
* Encoding of primitive types is staightforward, whereas encoding of sequences can result
* in an invalid CBOR if start/write/end flow is violated.
* For the purpose of gas saving, the library does not verify start/write/end flow internally,
* except for nested start/end pairs.
*/

library CBOR {
    using Buffer for Buffer.buffer;

    struct CBORBuffer {
        Buffer.buffer buf;
        uint256 depth;
    }

    uint8 private constant MAJOR_TYPE_INT = 0;
    uint8 private constant MAJOR_TYPE_NEGATIVE_INT = 1;
    uint8 private constant MAJOR_TYPE_BYTES = 2;
    uint8 private constant MAJOR_TYPE_STRING = 3;
    uint8 private constant MAJOR_TYPE_ARRAY = 4;
    uint8 private constant MAJOR_TYPE_MAP = 5;
    uint8 private constant MAJOR_TYPE_TAG = 6;
    uint8 private constant MAJOR_TYPE_CONTENT_FREE = 7;

    uint8 private constant TAG_TYPE_BIGNUM = 2;
    uint8 private constant TAG_TYPE_NEGATIVE_BIGNUM = 3;

    uint8 private constant CBOR_FALSE = 20;
    uint8 private constant CBOR_TRUE = 21;
    uint8 private constant CBOR_NULL = 22;
    uint8 private constant CBOR_UNDEFINED = 23;

    function create(uint256 capacity) internal pure returns(CBORBuffer memory cbor) {
        Buffer.init(cbor.buf, capacity);
        cbor.depth = 0;
        return cbor;
    }

    function data(CBORBuffer memory buf) internal pure returns(bytes memory) {
        require(buf.depth == 0, "Invalid CBOR");
        return buf.buf.buf;
    }

    function writeUInt256(CBORBuffer memory buf, uint256 value) internal pure {
        buf.buf.appendUint8(uint8((MAJOR_TYPE_TAG << 5) | TAG_TYPE_BIGNUM));
        writeBytes(buf, abi.encode(value));
    }

    function writeInt256(CBORBuffer memory buf, int256 value) internal pure {
        if (value < 0) {
            buf.buf.appendUint8(
                uint8((MAJOR_TYPE_TAG << 5) | TAG_TYPE_NEGATIVE_BIGNUM)
            );
            writeBytes(buf, abi.encode(uint256(-1 - value)));
        } else {
            writeUInt256(buf, uint256(value));
        }
    }

    function writeUInt64(CBORBuffer memory buf, uint64 value) internal pure {
        writeFixedNumeric(buf, MAJOR_TYPE_INT, value);
    }

    function writeInt64(CBORBuffer memory buf, int64 value) internal pure {
        if(value >= 0) {
            writeFixedNumeric(buf, MAJOR_TYPE_INT, uint64(value));
        } else{
            writeFixedNumeric(buf, MAJOR_TYPE_NEGATIVE_INT, uint64(-1 - value));
        }
    }

    function writeBytes(CBORBuffer memory buf, bytes memory value) internal pure {
        writeFixedNumeric(buf, MAJOR_TYPE_BYTES, uint64(value.length));
        buf.buf.append(value);
    }

    function writeString(CBORBuffer memory buf, string memory value) internal pure {
        writeFixedNumeric(buf, MAJOR_TYPE_STRING, uint64(bytes(value).length));
        buf.buf.append(bytes(value));
    }

    function writeBool(CBORBuffer memory buf, bool value) internal pure {
        writeContentFree(buf, value ? CBOR_TRUE : CBOR_FALSE);
    }

    function writeNull(CBORBuffer memory buf) internal pure {
        writeContentFree(buf, CBOR_NULL);
    }

    function writeUndefined(CBORBuffer memory buf) internal pure {
        writeContentFree(buf, CBOR_UNDEFINED);
    }

    function startArray(CBORBuffer memory buf) internal pure {
        writeIndefiniteLengthType(buf, MAJOR_TYPE_ARRAY);
        buf.depth += 1;
    }

    function startFixedArray(CBORBuffer memory buf, uint64 length) internal pure {
        writeDefiniteLengthType(buf, MAJOR_TYPE_ARRAY, length);
    }

    function startMap(CBORBuffer memory buf) internal pure {
        writeIndefiniteLengthType(buf, MAJOR_TYPE_MAP);
        buf.depth += 1;
    }

    function startFixedMap(CBORBuffer memory buf, uint64 length) internal pure {
        writeDefiniteLengthType(buf, MAJOR_TYPE_MAP, length);
    }

    function endSequence(CBORBuffer memory buf) internal pure {
        writeIndefiniteLengthType(buf, MAJOR_TYPE_CONTENT_FREE);
        buf.depth -= 1;
    }

    function writeKVString(CBORBuffer memory buf, string memory key, string memory value) internal pure {
        writeString(buf, key);
        writeString(buf, value);
    }

    function writeKVBytes(CBORBuffer memory buf, string memory key, bytes memory value) internal pure {
        writeString(buf, key);
        writeBytes(buf, value);
    }

    function writeKVUInt256(CBORBuffer memory buf, string memory key, uint256 value) internal pure {
        writeString(buf, key);
        writeUInt256(buf, value);
    }

    function writeKVInt256(CBORBuffer memory buf, string memory key, int256 value) internal pure {
        writeString(buf, key);
        writeInt256(buf, value);
    }

    function writeKVUInt64(CBORBuffer memory buf, string memory key, uint64 value) internal pure {
        writeString(buf, key);
        writeUInt64(buf, value);
    }

    function writeKVInt64(CBORBuffer memory buf, string memory key, int64 value) internal pure {
        writeString(buf, key);
        writeInt64(buf, value);
    }

    function writeKVBool(CBORBuffer memory buf, string memory key, bool value) internal pure {
        writeString(buf, key);
        writeBool(buf, value);
    }

    function writeKVNull(CBORBuffer memory buf, string memory key) internal pure {
        writeString(buf, key);
        writeNull(buf);
    }

    function writeKVUndefined(CBORBuffer memory buf, string memory key) internal pure {
        writeString(buf, key);
        writeUndefined(buf);
    }

    function writeKVMap(CBORBuffer memory buf, string memory key) internal pure {
        writeString(buf, key);
        startMap(buf);
    }

    function writeKVArray(CBORBuffer memory buf, string memory key) internal pure {
        writeString(buf, key);
        startArray(buf);
    }

    function writeFixedNumeric(
        CBORBuffer memory buf,
        uint8 major,
        uint64 value
    ) private pure {
        if (value <= 23) {
            buf.buf.appendUint8(uint8((major << 5) | value));
        } else if (value <= 0xFF) {
            buf.buf.appendUint8(uint8((major << 5) | 24));
            buf.buf.appendInt(value, 1);
        } else if (value <= 0xFFFF) {
            buf.buf.appendUint8(uint8((major << 5) | 25));
            buf.buf.appendInt(value, 2);
        } else if (value <= 0xFFFFFFFF) {
            buf.buf.appendUint8(uint8((major << 5) | 26));
            buf.buf.appendInt(value, 4);
        } else {
            buf.buf.appendUint8(uint8((major << 5) | 27));
            buf.buf.appendInt(value, 8);
        }
    }

    function writeIndefiniteLengthType(CBORBuffer memory buf, uint8 major)
        private
        pure
    {
        buf.buf.appendUint8(uint8((major << 5) | 31));
    }

    function writeDefiniteLengthType(CBORBuffer memory buf, uint8 major, uint64 length)
        private
        pure
    {
        writeFixedNumeric(buf, major, length);
    }

    function writeContentFree(CBORBuffer memory buf, uint8 value) private pure {
        buf.buf.appendUint8(uint8((MAJOR_TYPE_CONTENT_FREE << 5) | value));
    }
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsRouter.sol

/// @title Chainlink Functions Router interface.
interface IFunctionsRouter {
  /// @notice The identifier of the route to retrieve the address of the access control contract
  /// The access control contract controls which accounts can manage subscriptions
  /// @return id - bytes32 id that can be passed to the "getContractById" of the Router
  function getAllowListId() external view returns (bytes32);

  /// @notice Set the identifier of the route to retrieve the address of the access control contract
  /// The access control contract controls which accounts can manage subscriptions
  function setAllowListId(bytes32 allowListId) external;

  /// @notice Get the flat fee (in Juels of LINK) that will be paid to the Router owner for operation of the network
  /// @return adminFee
  function getAdminFee() external view returns (uint72 adminFee);

  /// @notice Sends a request using the provided subscriptionId
  /// @param subscriptionId - A unique subscription ID allocated by billing system,
  /// a client can make requests from different contracts referencing the same subscription
  /// @param data - CBOR encoded Chainlink Functions request data, use FunctionsClient API to encode a request
  /// @param dataVersion - Gas limit for the fulfillment callback
  /// @param callbackGasLimit - Gas limit for the fulfillment callback
  /// @param donId - An identifier used to determine which route to send the request along
  /// @return requestId - A unique request identifier
  function sendRequest(
    uint64 subscriptionId,
    bytes calldata data,
    uint16 dataVersion,
    uint32 callbackGasLimit,
    bytes32 donId
  ) external returns (bytes32);

  /// @notice Sends a request to the proposed contracts
  /// @param subscriptionId - A unique subscription ID allocated by billing system,
  /// a client can make requests from different contracts referencing the same subscription
  /// @param data - CBOR encoded Chainlink Functions request data, use FunctionsClient API to encode a request
  /// @param dataVersion - Gas limit for the fulfillment callback
  /// @param callbackGasLimit - Gas limit for the fulfillment callback
  /// @param donId - An identifier used to determine which route to send the request along
  /// @return requestId - A unique request identifier
  function sendRequestToProposed(
    uint64 subscriptionId,
    bytes calldata data,
    uint16 dataVersion,
    uint32 callbackGasLimit,
    bytes32 donId
  ) external returns (bytes32);

  /// @notice Fulfill the request by:
  /// - calling back the data that the Oracle returned to the client contract
  /// - pay the DON for processing the request
  /// @dev Only callable by the Coordinator contract that is saved in the commitment
  /// @param response response data from DON consensus
  /// @param err error from DON consensus
  /// @param juelsPerGas - current rate of juels/gas
  /// @param costWithoutFulfillment - The cost of processing the request (in Juels of LINK ), without fulfillment
  /// @param transmitter - The Node that transmitted the OCR report
  /// @param commitment - The parameters of the request that must be held consistent between request and response time
  /// @return fulfillResult -
  /// @return callbackGasCostJuels -
  function fulfill(
    bytes memory response,
    bytes memory err,
    uint96 juelsPerGas,
    uint96 costWithoutFulfillment,
    address transmitter,
    FunctionsResponse.Commitment memory commitment
  ) external returns (FunctionsResponse.FulfillResult, uint96);

  /// @notice Validate requested gas limit is below the subscription max.
  /// @param subscriptionId subscription ID
  /// @param callbackGasLimit desired callback gas limit
  function isValidCallbackGasLimit(uint64 subscriptionId, uint32 callbackGasLimit) external view;

  /// @notice Get the current contract given an ID
  /// @param id A bytes32 identifier for the route
  /// @return contract The current contract address
  function getContractById(bytes32 id) external view returns (address);

  /// @notice Get the proposed next contract given an ID
  /// @param id A bytes32 identifier for the route
  /// @return contract The current or proposed contract address
  function getProposedContractById(bytes32 id) external view returns (address);

  /// @notice Return the latest proprosal set
  /// @return ids The identifiers of the contracts to update
  /// @return to The addresses of the contracts that will be updated to
  function getProposedContractSet() external view returns (bytes32[] memory, address[] memory);

  /// @notice Proposes one or more updates to the contract routes
  /// @dev Only callable by owner
  function proposeContractsUpdate(bytes32[] memory proposalSetIds, address[] memory proposalSetAddresses) external;

  /// @notice Updates the current contract routes to the proposed contracts
  /// @dev Only callable by owner
  function updateContracts() external;

  /// @dev Puts the system into an emergency stopped state.
  /// @dev Only callable by owner
  function pause() external;

  /// @dev Takes the system out of an emergency stopped state.
  /// @dev Only callable by owner
  function unpause() external;
}

// lib/openzeppelin-contracts/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol

/// @title Library for encoding the input data of a Functions request into CBOR
library FunctionsRequest {
  using CBOR for CBOR.CBORBuffer;

  uint16 public constant REQUEST_DATA_VERSION = 1;
  uint256 internal constant DEFAULT_BUFFER_SIZE = 256;

  enum Location {
    Inline, // Provided within the Request
    Remote, // Hosted through remote location that can be accessed through a provided URL
    DONHosted // Hosted on the DON's storage
  }

  enum CodeLanguage {
    JavaScript
    // In future version we may add other languages
  }

  struct Request {
    Location codeLocation; // ════════════╸ The location of the source code that will be executed on each node in the DON
    Location secretsLocation; // ═════════╸ The location of secrets that will be passed into the source code. *Only Remote secrets are supported
    CodeLanguage language; // ════════════╸ The coding language that the source code is written in
    string source; // ════════════════════╸ Raw source code for Request.codeLocation of Location.Inline, URL for Request.codeLocation of Location.Remote, or slot decimal number for Request.codeLocation of Location.DONHosted
    bytes encryptedSecretsReference; // ══╸ Encrypted URLs for Request.secretsLocation of Location.Remote (use addSecretsReference()), or CBOR encoded slotid+version for Request.secretsLocation of Location.DONHosted (use addDONHostedSecrets())
    string[] args; // ════════════════════╸ String arguments that will be passed into the source code
    bytes[] bytesArgs; // ════════════════╸ Bytes arguments that will be passed into the source code
  }

  error EmptySource();
  error EmptySecrets();
  error EmptyArgs();
  error NoInlineSecrets();

  /// @notice Encodes a Request to CBOR encoded bytes
  /// @param self The request to encode
  /// @return CBOR encoded bytes
  function encodeCBOR(Request memory self) internal pure returns (bytes memory) {
    CBOR.CBORBuffer memory buffer = CBOR.create(DEFAULT_BUFFER_SIZE);

    buffer.writeString("codeLocation");
    buffer.writeUInt256(uint256(self.codeLocation));

    buffer.writeString("language");
    buffer.writeUInt256(uint256(self.language));

    buffer.writeString("source");
    buffer.writeString(self.source);

    if (self.args.length > 0) {
      buffer.writeString("args");
      buffer.startArray();
      for (uint256 i = 0; i < self.args.length; ++i) {
        buffer.writeString(self.args[i]);
      }
      buffer.endSequence();
    }

    if (self.encryptedSecretsReference.length > 0) {
      if (self.secretsLocation == Location.Inline) {
        revert NoInlineSecrets();
      }
      buffer.writeString("secretsLocation");
      buffer.writeUInt256(uint256(self.secretsLocation));
      buffer.writeString("secrets");
      buffer.writeBytes(self.encryptedSecretsReference);
    }

    if (self.bytesArgs.length > 0) {
      buffer.writeString("bytesArgs");
      buffer.startArray();
      for (uint256 i = 0; i < self.bytesArgs.length; ++i) {
        buffer.writeBytes(self.bytesArgs[i]);
      }
      buffer.endSequence();
    }

    return buffer.buf.buf;
  }

  /// @notice Initializes a Chainlink Functions Request
  /// @dev Sets the codeLocation and code on the request
  /// @param self The uninitialized request
  /// @param codeLocation The user provided source code location
  /// @param language The programming language of the user code
  /// @param source The user provided source code or a url
  function initializeRequest(
    Request memory self,
    Location codeLocation,
    CodeLanguage language,
    string memory source
  ) internal pure {
    if (bytes(source).length == 0) revert EmptySource();

    self.codeLocation = codeLocation;
    self.language = language;
    self.source = source;
  }

  /// @notice Initializes a Chainlink Functions Request
  /// @dev Simplified version of initializeRequest for PoC
  /// @param self The uninitialized request
  /// @param javaScriptSource The user provided JS code (must not be empty)
  function initializeRequestForInlineJavaScript(Request memory self, string memory javaScriptSource) internal pure {
    initializeRequest(self, Location.Inline, CodeLanguage.JavaScript, javaScriptSource);
  }

  /// @notice Adds Remote user encrypted secrets to a Request
  /// @param self The initialized request
  /// @param encryptedSecretsReference Encrypted comma-separated string of URLs pointing to off-chain secrets
  function addSecretsReference(Request memory self, bytes memory encryptedSecretsReference) internal pure {
    if (encryptedSecretsReference.length == 0) revert EmptySecrets();

    self.secretsLocation = Location.Remote;
    self.encryptedSecretsReference = encryptedSecretsReference;
  }

  /// @notice Adds DON-hosted secrets reference to a Request
  /// @param self The initialized request
  /// @param slotID Slot ID of the user's secrets hosted on DON
  /// @param version User data version (for the slotID)
  function addDONHostedSecrets(Request memory self, uint8 slotID, uint64 version) internal pure {
    CBOR.CBORBuffer memory buffer = CBOR.create(DEFAULT_BUFFER_SIZE);

    buffer.writeString("slotID");
    buffer.writeUInt64(slotID);
    buffer.writeString("version");
    buffer.writeUInt64(version);

    self.secretsLocation = Location.DONHosted;
    self.encryptedSecretsReference = buffer.buf.buf;
  }

  /// @notice Sets args for the user run function
  /// @param self The initialized request
  /// @param args The array of string args (must not be empty)
  function setArgs(Request memory self, string[] memory args) internal pure {
    if (args.length == 0) revert EmptyArgs();

    self.args = args;
  }

  /// @notice Sets bytes args for the user run function
  /// @param self The initialized request
  /// @param args The array of bytes args (must not be empty)
  function setBytesArgs(Request memory self, bytes[] memory args) internal pure {
    if (args.length == 0) revert EmptyArgs();

    self.bytesArgs = args;
  }
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol

/// @title The Chainlink Functions client contract
/// @notice Contract developers can inherit this contract in order to make Chainlink Functions requests
abstract contract FunctionsClient is IFunctionsClient {
  using FunctionsRequest for FunctionsRequest.Request;

  IFunctionsRouter internal immutable i_router;

  event RequestSent(bytes32 indexed id);
  event RequestFulfilled(bytes32 indexed id);

  error OnlyRouterCanFulfill();

  constructor(address router) {
    i_router = IFunctionsRouter(router);
  }

  /// @notice Sends a Chainlink Functions request
  /// @param data The CBOR encoded bytes data for a Functions request
  /// @param subscriptionId The subscription ID that will be charged to service the request
  /// @param callbackGasLimit the amount of gas that will be available for the fulfillment callback
  /// @return requestId The generated request ID for this request
  function _sendRequest(
    bytes memory data,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    bytes32 donId
  ) internal returns (bytes32) {
    bytes32 requestId = i_router.sendRequest(
      subscriptionId,
      data,
      FunctionsRequest.REQUEST_DATA_VERSION,
      callbackGasLimit,
      donId
    );
    emit RequestSent(requestId);
    return requestId;
  }

  /// @notice User defined function to handle a response from the DON
  /// @param requestId The request ID, returned by sendRequest()
  /// @param response Aggregated response from the execution of the user's source code
  /// @param err Aggregated error from the execution of the user code or from the execution pipeline
  /// @dev Either response or error parameter will be set, but never both
  function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal virtual;

  /// @inheritdoc IFunctionsClient
  function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external override {
    if (msg.sender != address(i_router)) {
      revert OnlyRouterCanFulfill();
    }
    fulfillRequest(requestId, response, err);
    emit RequestFulfilled(requestId);
  }
}

// src/CarbonPriceOracle.sol

// wake-disable unsafe-erc20-call

/**
 * @title CarbonPriceOracle
 * @dev 碳价预言机合约，使用Chainlink Functions获取API碳价并转换为美元价格
 * @notice 通过Chainlink Functions调用API获取碳价(欧元计价)，并通过EUR/USD价格预言机转换为美元价格
 */
contract CarbonPriceOracle is FunctionsClient, ICarbonPriceOracle, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;
    
    // 状态变量
    uint256 public carbonPriceEUR;      // 欧元碳价
    uint256 public carbonPriceUSD;      // 美元碳价
    
    // Chainlink Functions 配置
    bytes32 public donId;               // DON ID
    uint64 public subscriptionId;       // 订阅ID
    uint32 public gasLimit;             // Gas限制
    bytes32 public secretsLocation;     // 密钥位置
    
    // EUR/USD 价格预言机
    AggregatorV3Interface public eurUsdPriceFeed;
    
    // 授权操作员映射
    mapping(address => bool) public authorizedOperators;
    
    // LINK代币地址
    IERC20 public linkToken;
    
    // 事件
    event PriceUpdated(uint256 eurPrice, uint256 usdPrice, uint256 timestamp);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event FunctionsRequestSent(bytes32 indexed requestId, string source);
    event RequestProcessed(bytes32 indexed requestId, bool success, string errorMessage);
    event PriceCalculation(uint256 eurPrice, uint256 eurUsdRate, uint256 usdPrice);
    event RequestInitiated(address indexed caller, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    event RequestValidationFailed(string reason);
    event JavaScriptSourceBuilt(string source);
    event RequestObjectCreated();
    event RequestEncoded(bytes encodedRequest);
    event RequestSent(bytes32 indexed requestId, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    event FulfillRequestStarted(bytes32 indexed requestId, uint256 responseLength, uint256 errorLength);
    event ResponseDecoded(uint256 priceEUR);
    event EurUsdPriceFetched(int256 eurUsdPrice);
    event UsdPriceCalculated(uint256 usdPrice);
    event FulfillRequestCompleted(bytes32 indexed requestId);
    
    /**
     * @dev 构造函数
     * @param router Chainlink Functions Router地址
     * @param _donId DON ID
     * @param _eurUsdPriceFeed EUR/USD价格预言机地址
     * @param _linkToken LINK代币地址
     */
    constructor(
        address router,
        bytes32 _donId,
        address _eurUsdPriceFeed,
        address _linkToken
    ) FunctionsClient(router) Ownable() {
        donId = _donId;
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        gasLimit = 1000000; // 设置更高的初始gas限制
        linkToken = IERC20(_linkToken);
    }
    
    /**
     * @dev 设置订阅ID-订阅ID关联了你的付费账户
     * @param _subscriptionId 订阅ID
     * @notice 只有合约所有者可以调用此函数
     */
    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }
    
    /**
     * @dev 设置Gas限制
     * @param _gasLimit Gas限制
     * @notice 只有合约所有者可以调用此函数
     */
    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }
    
    /**
     * @dev 添加授权操作员-操作员可以调用requestCarbonPrice函数
     * @param _operator 操作员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator address");
        authorizedOperators[_operator] = true;
        emit OperatorAdded(_operator);
    }
    
    /**
     * @dev 移除授权操作员
     * @param _operator 操作员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function removeOperator(address _operator) external onlyOwner {
        authorizedOperators[_operator] = false;
        emit OperatorRemoved(_operator);
    }
    
    /**
     * @dev 权限检查修饰器
     * @notice 只有合约所有者或授权操作员可以调用
     */
    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorizedOperators[msg.sender], "Not authorized");
        _;
    }
    
    /**
     * @dev 请求更新碳价
     * @notice 使用Chainlink Functions调用API获取最新碳价
     * @notice 需要确保有足够的订阅余额支付费用
     * @notice 只有合约所有者或授权操作员可以调用此函数
     */
    function requestCarbonPrice() public onlyAuthorized {
        // 验证订阅ID
        if (subscriptionId == 0) {
            emit RequestValidationFailed("Subscription ID not set");
            revert("Subscription ID not set");
        }
        
        // 验证gas限制
        if (gasLimit == 0) {
            emit RequestValidationFailed("Gas limit not set");
            revert("Gas limit not set");
        }
        
        // 验证DON ID
        if (donId == bytes32(0)) {
            emit RequestValidationFailed("DON ID not set");
            revert("DON ID not set");
        }
        
        // 记录请求开始
        emit RequestInitiated(msg.sender, subscriptionId, gasLimit, donId);
        
        // 构建JavaScript源代码
        string memory source = "const response = await Functions.makeHttpRequest({"
            "url: 'https://greentrace-api.onrender.com/api/carbon-price',"
            "method: 'GET'"
            "});"
            "if (response.error) {"
            "  throw Error('Request failed');"
            "}"
            "const data = response.data;"
            "if (!data || !data.price) {"
            "  throw Error('Invalid response format');"
            "}"
            "return Functions.encodeUint256(Math.round(data.price * 1e8));";
        
        // 记录JavaScript源代码构建完成
        emit JavaScriptSourceBuilt(source);
        
        // 构建请求
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        // 记录请求对象创建完成
        emit RequestObjectCreated();
        
        // 编码请求
        bytes memory encodedRequest = req.encodeCBOR();
        emit RequestEncoded(encodedRequest);
        
        // 发送请求
        bytes32 requestId = _sendRequest(
            encodedRequest,
            subscriptionId,
            gasLimit,
            donId
        );
        
        // 记录请求发送完成
        emit RequestSent(requestId, subscriptionId, gasLimit, donId);
        emit FunctionsRequestSent(requestId, source);
    }
    
    /**
     * @dev fulfillRequest：Chainlink Functions回调处理（EUR-USD价格预言机）
     * @param requestId 请求ID
     * @param response 响应数据
     * @param err 错误信息
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // 记录回调开始
        emit FulfillRequestStarted(requestId, response.length, err.length);
        
        if (err.length > 0) {
            // 处理错误 - 记录错误信息
            string memory errorMessage = string(err);
            emit RequestProcessed(requestId, false, errorMessage);
            return;
        }
        
        // 检查响应数据是否为空
        require(response.length > 0, "Empty response from Functions");
        
        // 解码价格数据
        uint256 priceEUR = abi.decode(response, (uint256)); // 8位精度
        carbonPriceEUR = priceEUR;
        
        // 记录价格解码完成
        emit ResponseDecoded(priceEUR);
        
        // 获取EUR/USD价格（8位精度）
        (, int256 eurUsdPrice,,,) = eurUsdPriceFeed.latestRoundData();
        require(eurUsdPrice > 0, "Invalid EUR/USD price");
        
        // 记录EUR/USD价格获取完成
        emit EurUsdPriceFetched(eurUsdPrice);
        
        // 计算USD价格：两个8位精度相乘，除以1e8得到8位精度结果
        carbonPriceUSD = (priceEUR * uint256(eurUsdPrice)) / 1e8;
        
        // 记录USD价格计算完成
        emit UsdPriceCalculated(carbonPriceUSD);
        
        // 发出价格计算事件
        emit PriceCalculation(priceEUR, uint256(eurUsdPrice), carbonPriceUSD);
        emit RequestProcessed(requestId, true, "");
        
        emit PriceUpdated(carbonPriceEUR, carbonPriceUSD, block.timestamp);
        
        // 记录回调完成
        emit FulfillRequestCompleted(requestId);
    }
    
    /**
     * @dev 提取合约中的LINK代币（管理合约中link币数量）
     * @param _to 接收地址
     * @param _amount 提取数量
     * @notice 只有合约所有者可以调用此函数
     */
    function withdrawLink(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 contractBalance = linkToken.balanceOf(address(this));
        require(_amount <= contractBalance, "Insufficient LINK balance");
        
        // 检查提取后是否还有足够余额支付费用
        uint256 remainingBalance = contractBalance - _amount;
        require(remainingBalance >= 0.1 * 1e18, "Insufficient balance after withdrawal");
        
        require(linkToken.transfer(_to, _amount), "LINK transfer failed");
    }
    
    /**
     * @dev 获取最新碳价（美元）
     * @return 碳价（美元）
     */
    function getLatestCarbonPriceUSD() external view override returns (uint256) {
        return carbonPriceUSD;
    }
    
    /**
     * @dev 获取最新碳价（欧元）
     * @return 碳价（欧元）
     */
    function getLatestCarbonPriceEUR() external view override returns (uint256) {
        return carbonPriceEUR;
    }
    
    /**
     * @dev 仅测试用：设置碳价（欧元）
     */
    function setTestCarbonPriceEUR(uint256 value) external {
        carbonPriceEUR = value;
    }
    /**
     * @dev 仅测试用：设置碳价（美元）
     */
    function setTestCarbonPriceUSD(uint256 value) external {
        carbonPriceUSD = value;
    }
}

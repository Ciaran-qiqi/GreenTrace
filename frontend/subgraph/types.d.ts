// The Graph AssemblyScript 类型声明
// 这个文件为 @graphprotocol/graph-ts 提供类型声明

declare module "@graphprotocol/graph-ts" {
  export class BigInt {
    constructor(value: i32);
    static fromI32(value: i32): BigInt;
    static fromString(value: string): BigInt;
    toString(): string;
    toI32(): i32;
    plus(other: BigInt): BigInt;
    minus(other: BigInt): BigInt;
    times(other: BigInt): BigInt;
    div(other: BigInt): BigInt;
    mod(other: BigInt): BigInt;
    equals(other: BigInt): boolean;
    notEqual(other: BigInt): boolean;
    lt(other: BigInt): boolean;
    le(other: BigInt): boolean;
    gt(other: BigInt): boolean;
    ge(other: BigInt): boolean;
  }

  export class Address {
    constructor(value: string);
    toHexString(): string;
    toString(): string;
    equals(other: Address): boolean;
    notEqual(other: Address): boolean;
  }

  export class Bytes {
    constructor(value: string);
    toHexString(): string;
    toString(): string;
    length: i32;
  }

  export class String {
    constructor(value: string);
    toString(): string;
    length: i32;
    concat(other: String): String;
  }

  export class Array<T> {
    constructor();
    push(value: T): void;
    pop(): T;
    length: i32;
    get(index: i32): T;
    set(index: i32, value: T): void;
  }

  export class TypedMap<K, V> {
    constructor();
    set(key: K, value: V): void;
    get(key: K): V | null;
    getEntry(key: K): TypedMapEntry<K, V> | null;
    isSet(key: K): boolean;
    unset(key: K): void;
  }

  export class TypedMapEntry<K, V> {
    key: K;
    value: V;
  }

  export class ethereum {
    static Value: Value;
    static Event: Event;
    static Transaction: Transaction;
    static Block: Block;
    static CallResult: CallResult;
  }

  export class Value {
    toAddress(): Address;
    toBoolean(): boolean;
    toBytes(): Bytes;
    toI32(): i32;
    toBigInt(): BigInt;
    toString(): String;
    toArray(): Array<Value>;
    toTuple(): Array<Value>;
  }

  export class Event {
    address: Address;
    logIndex: BigInt;
    transactionLogIndex: BigInt;
    logType: String | null;
    block: Block | null;
    transaction: Transaction;
    parameters: Array<EventParam>;
    receipt: TransactionReceipt | null;
  }

  export class EventParam {
    value: Value;
    name: String;
  }

  export class Transaction {
    hash: Bytes;
    index: BigInt;
    from: Address;
    to: Address | null;
    value: BigInt;
    gasLimit: BigInt;
    gasPrice: BigInt;
    input: Bytes;
    nonce: BigInt;
  }

  export class Block {
    hash: Bytes;
    parentHash: Bytes;
    unclesHash: Bytes;
    author: Address;
    stateRoot: Bytes;
    transactionsRoot: Bytes;
    receiptsRoot: Bytes;
    number: BigInt;
    gasUsed: BigInt;
    gasLimit: BigInt;
    timestamp: BigInt;
    difficulty: BigInt;
    totalDifficulty: BigInt;
    size: BigInt | null;
    baseFeePerGas: BigInt | null;
  }

  export class CallResult {
    reverted: boolean;
    value: Value;
  }

  export class TransactionReceipt {
    transactionHash: Bytes;
    transactionIndex: BigInt;
    blockHash: Bytes;
    blockNumber: BigInt;
    cumulativeGasUsed: BigInt;
    gasUsed: BigInt;
    contractAddress: Address | null;
    logs: Array<Log>;
    status: BigInt;
    root: Bytes | null;
    logsBloom: Bytes;
  }

  export class Log {
    address: Address;
    topics: Array<Bytes>;
    data: Bytes;
    blockHash: Bytes;
    blockNumber: BigInt;
    transactionHash: Bytes;
    transactionIndex: BigInt;
    logIndex: BigInt;
    transactionLogIndex: BigInt;
    removed: boolean | null;
  }

  export class crypto {
    static keccak256(input: Bytes): Bytes;
  }

  export class ByteArray {
    constructor(value: string);
    toHexString(): string;
    toString(): string;
    length: i32;
  }
} 
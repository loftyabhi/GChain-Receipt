// src/services/classifier/types.ts

import { ethers } from 'ethers';

// ==================== CORE PRIMITIVES ====================

export type Address = string;
export type HexString = string;
export type BigIntString = string; // String representation of a large integer

// Strict Log Interface
export interface Log {
    address: Address;
    topics: HexString[];
    data: HexString;
    blockNumber: number;
    transactionHash: string;
    transactionIndex: number;
    logIndex: number;
    removed?: boolean;
}

// Strict Transaction Interface (Normalized)
export interface Transaction {
    hash: string;
    nonce: number;
    blockHash: string | null;
    blockNumber: number | null;
    transactionIndex: number | null;
    from: Address;
    to: Address | null; // null for contract creation
    value: BigIntString;
    gasPrice: BigIntString | null;
    maxPriorityFeePerGas?: BigIntString | null;
    maxFeePerGas?: BigIntString | null;
    gasLimit: BigIntString;
    data: HexString;
    type?: number | null;
    chainId: number;
    r?: string;
    s?: string;
    v?: number;
}

// Strict Receipt Interface
export interface Receipt {
    to: Address | null;
    from: Address;
    contractAddress: Address | null;
    transactionIndex: number;
    gasUsed: BigIntString;
    logsBloom: string;
    blockHash: string;
    transactionHash: string;
    logs: Log[];
    blockNumber: number;
    cumulativeGasUsed: BigIntString;
    status: number | null; // 1 success, 0 failure
    effectiveGasPrice?: BigIntString;
    type?: number;
}

// ==================== CLASSIFICATION OUTPUT ====================

export enum TransactionType {
    // Token Operations
    TOKEN_TRANSFER = 'token_transfer',
    TOKEN_APPROVAL = 'token_approval',
    TOKEN_MINT = 'token_mint',
    TOKEN_BURN = 'token_burn',
    BULK_TRANSFER = 'bulk_transfer',

    // DEX Operations
    SWAP = 'swap',
    ADD_LIQUIDITY = 'add_liquidity',
    REMOVE_LIQUIDITY = 'remove_liquidity',

    // NFT Operations
    NFT_MINT = 'nft_mint',
    NFT_TRANSFER = 'nft_transfer',
    NFT_SALE = 'nft_sale',
    NFT_LISTING = 'nft_listing',
    NFT_CANCEL_LISTING = 'nft_cancel_listing',
    NFT_BID = 'nft_bid',

    // Lending & Borrowing
    LENDING_DEPOSIT = 'lending_deposit',
    LENDING_WITHDRAW = 'lending_withdraw',
    LENDING_BORROW = 'lending_borrow',
    LENDING_REPAY = 'lending_repay',
    LENDING_LIQUIDATION = 'lending_liquidation',
    FLASH_LOAN = 'flash_loan',

    // Staking
    STAKING_DEPOSIT = 'staking_deposit',
    STAKING_WITHDRAW = 'staking_withdraw',
    STAKING_CLAIM_REWARDS = 'staking_claim_rewards',

    // Bridge Operations
    BRIDGE_DEPOSIT = 'bridge_deposit',
    BRIDGE_WITHDRAW = 'bridge_withdraw',

    // Governance
    GOVERNANCE_VOTE = 'governance_vote',
    GOVERNANCE_PROPOSE = 'governance_propose',
    GOVERNANCE_DELEGATE = 'governance_delegate',

    // L2 Specific
    L2_DEPOSIT = 'l2_deposit',
    L2_WITHDRAWAL = 'l2_withdrawal',
    L2_PROVE_WITHDRAWAL = 'l2_prove_withdrawal',
    L2_FINALIZE_WITHDRAWAL = 'l2_finalize_withdrawal',

    // System / Fallback
    CONTRACT_DEPLOYMENT = 'contract_deployment',
    CONTRACT_INTERACTION = 'contract_interaction',
    NATIVE_TRANSFER = 'native_transfer',
    UNCLASSIFIED_COMPLEX = 'unclassified_complex',
    UNKNOWN = 'unknown',
}

export enum TransactionEnvelopeType {
    LEGACY = 0,
    EIP2930 = 1,
    EIP1559 = 2,
    EIP4844 = 3,
}

export enum ExecutionType {
    DIRECT = 'direct',
    MULTISIG = 'multisig',
    ACCOUNT_ABSTRACTION = 'account_abstraction',
    META_TRANSACTION = 'meta_transaction',
    RELAYED = 'relayed',
    UNKNOWN = 'unknown',
}

export interface ConfidenceScore {
    score: number; // 0.0 to 1.0
    reasons: string[]; // Explainer for why this score was given
}

export interface ClassificationDetails {
    protocol?: string;
    method?: string;
    eventSignatures?: string[];
    contractAddress?: Address;
    value?: string;
    tokensIn?: { address: Address; amount: string; symbol?: string }[];
    tokensOut?: { address: Address; amount: string; symbol?: string }[];
    nft?: {
        contract: Address;
        tokenId: string;
        amount: string; // usually 1 for 721
        standard: 'ERC-721' | 'ERC-1155';
    }[];
    isProxy?: boolean;
    proxyType?: 'Safe' | 'Diamond' | 'Transparent' | 'Beacon' | 'UUPS';
}

export interface ClassificationResult {
    functionalType: TransactionType;
    executionType: ExecutionType;
    confidence: ConfidenceScore;
    details: ClassificationDetails;
    // For backward compatibility (optional)
    type?: TransactionType;
    protocol?: string;
    secondary?: ClassificationResult[];
}

// ==================== RESOLVER INTERFACES ====================

export interface ProtocolMatch {
    name: string;
    confidence: number;
    type: TransactionType;
    metadata?: any;
}

export interface IProtocolDetector {
    id: string; // e.g., 'uniswap_v2'
    detect(
        tx: Transaction,
        receipt: Receipt
    ): Promise<ProtocolMatch | null>;
}

export interface IExecutionResolver {
    resolve(
        tx: Transaction,
        receipt: Receipt,
        logs: Log[]
    ): Promise<ExecutionType>;
}

export interface TokenMovement {
    asset: string;
    amount: string;
    type: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155';
    tokenId?: string;
}

export interface TokenFlow {
    [address: string]: {
        incoming: TokenMovement[];
        outgoing: TokenMovement[];
    };
}

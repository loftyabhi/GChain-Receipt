// src/services/classifier/core/types.ts

// ==================== PRIMITIVES ====================
export type Address = string;
export type HexString = string;
export type BigIntString = string;

// ==================== INPUT TYPES ====================
export interface Log {
    address: Address;
    topics: HexString[];
    data: HexString;
    blockNumber: number;
    transactionHash: string;
    transactionIndex: number;
    logIndex: number;
}

export interface Transaction {
    hash: string;
    from: Address;
    to: Address | null;
    value: BigIntString;
    data: HexString;
    chainId: number;
    nonce: number;
    gasLimit: BigIntString;
    // Optional fields must be handled defensively
    type?: number | null;
    maxFeePerGas?: BigIntString | null;
    maxPriorityFeePerGas?: BigIntString | null;
}

export interface Receipt {
    status: number | null;
    logs: Log[];
    from: Address;
    to: Address | null;
    contractAddress: Address | null;
    gasUsed: BigIntString;
    effectiveGasPrice?: BigIntString;
}

// ==================== CLASSIFICATION TYPES ====================

export enum TransactionType {
    SWAP = 'swap',
    ADD_LIQUIDITY = 'add_liquidity',
    REMOVE_LIQUIDITY = 'remove_liquidity',
    NFT_SALE = 'nft_sale',
    NFT_MINT = 'nft_mint',
    NFT_TRANSFER = 'nft_transfer',
    NFT_LISTING = 'nft_listing',
    NFT_CANCEL_LISTING = 'nft_cancel_listing',
    NFT_BID = 'nft_bid',
    TOKEN_TRANSFER = 'token_transfer',
    TOKEN_APPROVAL = 'token_approval',
    TOKEN_MINT = 'token_mint',
    TOKEN_BURN = 'token_burn',
    BULK_TRANSFER = 'bulk_transfer',
    LENDING_DEPOSIT = 'lending_deposit',
    LENDING_WITHDRAW = 'lending_withdraw',
    LENDING_BORROW = 'lending_borrow',
    LENDING_REPAY = 'lending_repay',
    LENDING_LIQUIDATION = 'lending_liquidation',
    STAKING_DEPOSIT = 'staking_deposit',
    STAKING_WITHDRAW = 'staking_withdraw',
    STAKING_CLAIM_REWARDS = 'staking_claim_rewards',
    BRIDGE_DEPOSIT = 'bridge_deposit',
    BRIDGE_WITHDRAW = 'bridge_withdraw',
    GOVERNANCE_VOTE = 'governance_vote',
    GOVERNANCE_PROPOSAL = 'governance_proposal',
    GOVERNANCE_DELEGATION = 'governance_delegation',
    GOVERNANCE_EXECUTION = 'governance_execution',
    L2_DEPOSIT = 'l2_deposit',
    L2_WITHDRAWAL = 'l2_withdrawal',
    L2_PROVE_WITHDRAWAL = 'l2_prove_withdrawal',
    L2_FINALIZE_WITHDRAWAL = 'l2_finalize_withdrawal',
    CONTRACT_DEPLOYMENT = 'contract_deployment',
    CONTRACT_INTERACTION = 'contract_interaction', // Use with caution (low confidence fallback)
    NATIVE_TRANSFER = 'native_transfer',
    UNCLASSIFIED_COMPLEX = 'unclassified_complex', // Complex tx that failed specific rule matching
    UNKNOWN = 'unknown', // Explicit fallback
}

export enum ExecutionType {
    DIRECT = 'direct',
    MULTISIG = 'multisig', // Safe
    ACCOUNT_ABSTRACTION = 'account_abstraction', // ERC-4337
    META_TRANSACTION = 'meta_transaction', // GSN / Relayer
    RELAYED = 'relayed', // Generic Proxy / Forwarder
    UNKNOWN = 'unknown',
}

export enum TransactionEnvelopeType {
    LEGACY = 0,
    EIP2930 = 1,
    EIP1559 = 2,
    EIP4844 = 3,
}

// ==================== CONFIDENCE & SCORING ====================

export interface ConfidenceBreakdown {
    eventMatch: number;      // 0.0 - 1.0 (Exact event signature matches)
    methodMatch: number;     // 0.0 - 1.0 (Function selector matches)
    addressMatch: number;    // 0.0 - 1.0 (Known contract addresses)
    tokenFlowMatch: number;  // 0.0 - 1.0 (Asset movement validation)
    executionMatch: number;  // 0.0 - 1.0 (Structure of execution)
}

export interface ConfidenceScore {
    score: number; // Normalized 0.0 - 1.0
    breakdown?: ConfidenceBreakdown; // Made optional for Fallback/Unknown
    reasons: string[];
}

export interface ClassificationResult {
    functionalType: TransactionType;
    executionType: ExecutionType;
    confidence: ConfidenceScore;
    details: ClassificationDetails;
    protocol?: string; // e.g., 'Uniswap V3', 'Seaport', 'Gnosis Safe'
    secondary?: ClassificationResult[]; // High-confidence alternatives
}

export interface ClassificationDetails {
    method?: string;
    decodedMethod?: string;
    contractAddress?: Address;
    isProxy?: boolean;
    proxyImplementation?: Address;
    // Flexible metadata container
    [key: string]: any;
}

// ==================== INTERFACES ====================

export type FlowRole =
    | 'USER_IN'
    | 'USER_OUT'
    | 'PROTOCOL_IN'
    | 'PROTOCOL_OUT'
    | 'FEE'
    | 'REWARD'
    | 'UNKNOWN';

export interface TokenMovement {
    asset: Address;
    amount: string; // BigInt string
    type: 'ERC20' | 'ERC721' | 'ERC1155' | 'NATIVE';
    tokenId?: string;
    symbol?: string; // Optional metadata

    // Semantic Fields
    from: Address;
    to: Address;
    role: FlowRole;
}

export interface TokenFlow {
    [address: string]: {
        incoming: TokenMovement[];
        outgoing: TokenMovement[];
        netValueUSD?: number;
    };
}

export interface IExecutionResolver {
    resolve(
        tx: Transaction,
        receipt: Receipt,
        logs: Log[]
    ): Promise<ExecutionType>;
}

export interface ProtocolMatch {
    name: string;
    confidence: number;
    type: TransactionType;
    metadata?: any;
}

export interface IProtocolDetector {
    id: string;
    detect(
        tx: Transaction,
        receipt: Receipt
    ): Promise<ProtocolMatch | null>;
}

export interface BillRequest {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
    forceRegenerate?: boolean;
}

export interface BillResponse {
    pdfPath: string;
    billData: BillViewModel;
}

export interface TokenItemViewModel {
    direction: 'in' | 'out';
    isIn: boolean;
    tokenIcon: string;
    tokenSymbol: string;
    tokenAddress: string;
    fromShort: string;
    toShort: string;
    amountFormatted: string;
    usdValue: string;
}

export interface InternalTxViewModel {
    from: string;
    to: string;
    fromShort: string;
    toShort: string;
    amount: string;
    symbol: string;
    isError: boolean;
}

export interface BillViewModel {
    BILL_ID: string;
    BILL_VERSION: string;
    GENERATED_AT: string;
    STATUS: string;
    STATUS_CONFIRMED: boolean;

    // Network
    CHAIN_NAME: string;
    CHAIN_ID: number;
    CONTRACT_ADDRESS: string;
    DATE: string;
    CHAIN_SYMBOL: string;
    CHAIN_ICON: string;
    HOME_URL: string;

    // Transaction
    TRANSACTION_HASH: string;
    BLOCK_NUMBER: string;
    BLOCK_HASH_SHORT: string;
    TIMESTAMP: string;
    TIMESTAMP_RELATIVE: string;
    CONFIRMATIONS: number;

    // Classification
    TYPE: string;
    TYPE_READABLE: string;
    TYPE_ICON: string;
    IS_MULTISIG: boolean;
    IS_SMART_ACCOUNT: boolean;
    ENVELOPE_LABEL: string;
    PROTOCOL_TAG?: string;

    // Participants
    FROM_ADDRESS: string;
    FROM_ENS: string | null;
    FROM_AVATAR: string;
    TO_ADDRESS: string;
    TO_ENS: string | null;
    TO_AVATAR: string;

    // Items
    ITEMS: TokenItemViewModel[];
    ITEMS_COUNT: number;
    INTERNAL_TXS: InternalTxViewModel[];
    HAS_INTERNAL_TXS: boolean;

    // Fees
    GAS_USED: string;
    GAS_PRICE_GWEI: string;
    TOTAL_FEE: string;
    TOTAL_FEE_USD: string;

    // Totals
    TOTAL_IN_USD: string;
    TOTAL_OUT_USD: string;
    TOKENS_IN_COUNT: number;
    TOKENS_OUT_COUNT: number;
    NET_CHANGE_USD: string;
    NET_CHANGE_SIGN: string;
    NET_CHANGE_POSITIVE: boolean;

    // Audit
    RPC_PROVIDER: string;
    CONFIDENCE_PERCENT: number;
    QR_CODE_DATA_URL: string;
    EXPLORER_URL: string;
    INCLUDE_AUDIT: boolean;
    PRICE_SOURCE: string;
    CLASSIFICATION_METHOD: string;
    REORG_DETECTED: boolean;
    CONFIDENCE: number;
    CURRENT_YEAR: number;
    FRONTEND_URL: string;
    DISCLAIMER_URL: string;
    CONTACT_URL: string;

    // Ad
    hasAd: boolean;
    adContent: string;
    adUrl?: string;
    adId?: string;
}

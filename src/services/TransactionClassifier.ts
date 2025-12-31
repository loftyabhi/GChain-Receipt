// src/services/TransactionClassifier.ts
// ============================================================================
// ADVANCED TRANSACTION CLASSIFICATION ENGINE
// Supports L1 (Ethereum, BSC, Avalanche) and L2 (Base, Optimism, Arbitrum, Polygon)
// ============================================================================

import { ethers } from 'ethers';

// ==================== TYPES & INTERFACES ====================

export enum TransactionEnvelopeType {
    LEGACY = 0,
    EIP2930 = 1,
    EIP1559 = 2,
    EIP4844 = 3,
}

export enum TransactionType {
    // Token Operations
    TOKEN_TRANSFER = 'token_transfer',
    TOKEN_APPROVAL = 'token_approval',
    TOKEN_MINT = 'token_mint',
    TOKEN_BURN = 'token_burn',

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

    // Staking
    STAKING_DEPOSIT = 'staking_deposit',
    STAKING_WITHDRAW = 'staking_withdraw',
    STAKING_CLAIM_REWARDS = 'staking_claim_rewards',

    // Bridge Operations
    BRIDGE_DEPOSIT = 'bridge_deposit',
    BRIDGE_WITHDRAW = 'bridge_withdraw',

    // Contract Operations
    CONTRACT_DEPLOYMENT = 'contract_deployment',
    CONTRACT_INTERACTION = 'contract_interaction',

    // Native Transfers
    NATIVE_TRANSFER = 'native_transfer',
    BULK_TRANSFER = 'bulk_transfer',

    // Advanced DeFi
    YIELD_FARM_STAKE = 'yield_farm_stake',
    YIELD_FARM_UNSTAKE = 'yield_farm_unstake',
    YIELD_FARM_HARVEST = 'yield_farm_harvest',

    // Governance
    GOVERNANCE_VOTE = 'governance_vote',
    GOVERNANCE_PROPOSE = 'governance_propose',
    GOVERNANCE_DELEGATE = 'governance_delegate',

    // L2 Specific
    L2_DEPOSIT = 'l2_deposit',
    L2_WITHDRAWAL = 'l2_withdrawal',
    L2_PROVE_WITHDRAWAL = 'l2_prove_withdrawal',
    L2_FINALIZE_WITHDRAWAL = 'l2_finalize_withdrawal',

    // Advanced Execution
    MULTISIG_EXECUTION = 'multisig_execution',
    META_TRANSACTION = 'meta_transaction',
    ACCOUNT_ABSTRACTION = 'account_abstraction',

    // Unknown
    UNKNOWN = 'unknown',
}

export interface ClassificationResult {
    type: TransactionType;
    envelopeType?: TransactionEnvelopeType;
    subType?: string;
    confidence: number;
    protocol?: string;
    details: ClassificationDetails;
    matches: string[];
    warnings: string[];
}

export interface ClassificationDetails {
    method?: string;
    eventSignatures?: string[];
    tokenStandard?: 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'Native';
    dexProtocol?: string;
    marketplace?: string;
    lendingProtocol?: string;
    bridge?: string;
    isMultiSig?: boolean;
    isProxy?: boolean;
    gasOptimized?: boolean;
    sender?: string;
    target?: string;
    value?: string;
    data?: string;
}

// ==================== EVENT SIGNATURES ====================

const EVENT_SIGNATURES = {
    // ERC-20
    TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    APPROVAL: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',

    // ERC-721
    TRANSFER_721: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    APPROVAL_FOR_ALL: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',

    // ERC-1155
    TRANSFER_SINGLE: '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62',
    TRANSFER_BATCH: '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb',

    // Uniswap V2
    SWAP_V2: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
    MINT_V2: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    BURN_V2: '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496',

    // Uniswap V3
    SWAP_V3: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
    MINT_V3: '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde',
    BURN_V3: '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c',

    // SushiSwap
    SWAP_SUSHI: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',

    // Curve
    TOKEN_EXCHANGE: '0x8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140',
    ADD_LIQUIDITY_CURVE: '0x26f55a85081d24974e85c6c00045d0f0453991e95873f52bff0d21af4079a768',

    // Balancer
    SWAP_BALANCER: '0x2170c741c41531aec20e7c107c24eecfdd15e69c9bb0a8dd37b1840b9e0b207b',

    // OpenSea (Seaport)
    ORDER_FULFILLED: '0x9d9af8e38d66c62e2c12f0225249fd9d721c54b83f48d9352c97c6cacdcb6f31',

    // LooksRare
    TAKER_ASK: '0x68cd251d4d267c6e2034ff0088b990352b97b2002c0476587d0c4da889c11330',
    TAKER_BID: '0x95fb6205e23ff6bda16a2d1dba56b9ad7c783f67c96fa149785052f47696f2be',

    // Blur
    ORDER_MATCHED: '0x61cbb2a3dee0b6064c2e681aadd61677fb4ef319f0b547508d495626f5a62f64',

    // Aave
    DEPOSIT: '0xde6857219544bb5b7746f48ed30be6386fefc61b2f864cacf559893bf50fd951',
    WITHDRAW: '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7',
    BORROW: '0xc6a898309e823ee50bac64e45ca8adba6690e99e7841c45d754e2a38e9019d9b',
    REPAY: '0x4cdde6e09bb755c9a5589ebaec640bbfedff1362d4b255ebf8339782b9942faa',
    LIQUIDATION_CALL: '0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286',

    // Compound
    MINT_COMPOUND: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    REDEEM_COMPOUND: '0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929',

    // Lido
    SUBMITTED: '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a',
    WITHDRAWAL_REQUESTED: '0x0000000000000000000000000000000000000000000000000000000000000000',

    // Bridge Events
    BRIDGE_TRANSFER_SENT: '0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e',
    BRIDGE_TRANSFER_RECEIVED: '0x1b2a7ff080b8cb6ff436ce0372e399692bbfb6d4ae5766fd8d58a7b8cc6142e6',

    // L2 Specific
    MESSAGE_PASSED: '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054',
    RELAYED_MESSAGE: '0x4641df4a962071e12719d8c8c8e5ac7fc4d97b927346a3d7a335b1f7517e133c',
    WITHDRAWAL_INITIATED: '0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e',
    WITHDRAWAL_FINALIZED: '0xdb5c7652857aa163daadd670e116628fb42e869d8ac4251ef8971d9e5727df1b',

    // Governance
    VOTE_CAST: '0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4',
    PROPOSAL_CREATED: '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0',

    // Staking
    STAKED: '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d',
    UNSTAKED: '0x0f5bb82176feb1b5e747e28471aa92156a04d9f3ab9f45f28e2d704232b93f75',
    REWARDS_CLAIMED: '0x47cee97cb7acd717b3c0aa1435d004cd5b3c8c57d70dbceb4e4458bbd60e39d4',

    // Account Abstraction
    USER_OPERATION_EVENT: '0x49628fd147100edb3ef1d7634f6e33006d4e28293976af321d22cb2b05c751a3',

    // Multisig (Safe)
    EXECUTION_SUCCESS: '0x442e715f626346e8c54381002da614f62bee8cf2088c564363b46925e01e4756',
    SAFE_SETUP: '0x141df868a6331af528e38c83b7aa0329a80ef809609568f4f618a452aeee4ef0',
};

// ==================== METHOD SIGNATURES ====================

const METHOD_SIGNATURES = {
    // DEX
    SWAP_EXACT_TOKENS_FOR_TOKENS: '0x38ed1739',
    SWAP_TOKENS_FOR_EXACT_TOKENS: '0x8803dbee',
    SWAP_EXACT_ETH_FOR_TOKENS: '0x7ff36ab5',
    SWAP_TOKENS_FOR_EXACT_ETH: '0x4a25d94a',
    ADD_LIQUIDITY: '0xe8e33700',
    REMOVE_LIQUIDITY: '0xbaa2abde',

    // Uniswap V3
    EXACT_INPUT: '0xc04b8d59',
    EXACT_OUTPUT: '0xf28c0498',

    // ERC-20
    TRANSFER: '0xa9059cbb',
    TRANSFER_FROM: '0x23b872dd',
    APPROVE: '0x095ea7b3',

    // ERC-721
    SAFE_TRANSFER_FROM_721: '0x42842e0e',
    SAFE_TRANSFER_FROM_WITH_DATA: '0xb88d4fde',

    // ERC-1155
    SAFE_TRANSFER_FROM_1155: '0xf242432a',
    SAFE_BATCH_TRANSFER_FROM: '0x2eb2c2d6',

    // OpenSea/Seaport
    FULFILL_ORDER: '0xb3a34c4c',
    FULFILL_AVAILABLE_ORDERS: '0xed98a574',

    // Aave
    DEPOSIT_AAVE: '0xe8eda9df',
    WITHDRAW_AAVE: '0x69328dec',
    BORROW_AAVE: '0xa415bcad',
    REPAY_AAVE: '0x573ade81',

    // Compound
    MINT_COMPOUND: '0xa0712d68',
    REDEEM_COMPOUND: '0xdb006a75',

    // Staking
    STAKE: '0xa694fc3a',
    UNSTAKE: '0x2e1a7d4d',
    GET_REWARD: '0x3d18b912',

    // Governance
    CAST_VOTE: '0x56781388',
    PROPOSE: '0xda95691a',

    // Bridge
    BRIDGE_ETH: '0x9a2ac6d5',
    BRIDGE_ERC20: '0x838b2520',
    FINALIZE_BRIDGE: '0x8c3152e9',

    // L2 Specific
    DEPOSIT_TRANSACTION: '0xe9e05c42',
    PROVE_WITHDRAWAL: '0x4870496f',
    FINALIZE_WITHDRAWAL: '0x8c3152e9',

    // Account Abstraction
    HANDLE_OPS: '0x1fad948c',
    HANDLE_AGGREGATED_OPS: '0x4b1d7cf5',

    // Multisig (Safe)
    EXEC_TRANSACTION: '0x6a761202',
};

// ==================== KNOWN CONTRACTS ====================

const KNOWN_CONTRACTS = {
    // DEX Routers
    UNISWAP_V2_ROUTER: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    UNISWAP_V3_ROUTER: '0xe592427a0aece92de3edee1f18e0157c05861564',
    UNISWAP_V3_ROUTER_2: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45',
    SUSHISWAP_ROUTER: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
    PANCAKESWAP_ROUTER: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
    CURVE_ROUTER: '0x8e764bc2e6b4a6f35e5b4f7c7c2f3b6f9f3f3f3f',

    // NFT Marketplaces
    OPENSEA_SEAPORT: '0x00000000000000adc04c56bf30ac9d3c0aaf14dc',
    LOOKSRARE: '0x59728544b08ab483533076417fbbb2fd0b17ce3a',
    BLUR: '0x000000000000ad05ccc4f10045630fb830b95127',
    X2Y2: '0x74312363e45dcaba76c59ec49a7aa8a65a67eed3',

    // Lending Protocols
    AAVE_V2_POOL: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9',
    AAVE_V3_POOL: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
    COMPOUND_COMPTROLLER: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b',

    // Staking
    LIDO_STETH: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    ROCKET_POOL: '0x2cac916b2a963bf162f076c0a8a4a8200bcfbfb4',

    // Bridges
    OPTIMISM_BRIDGE: '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1',
    ARBITRUM_BRIDGE: '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a',
    BASE_BRIDGE: '0x49048044d57e1c92a77f79988d21fa8faf74e97e',
    POLYGON_BRIDGE: '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',

    // L2 Specific Contracts
    OPTIMISM_PORTAL: '0xbeb5fc579115071764c7423a4f12edde41f106ed',
    ARBITRUM_INBOX: '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f',
    BASE_PORTAL: '0x49048044d57e1c92a77f79988d21fa8faf74e97e',

    // Account Abstraction
    ENTRY_POINT_0_6: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
    ENTRY_POINT_0_7: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
};

// ==================== CLASSIFIER SERVICE ====================

class TransactionClassifierService {
    /**
     * Main classification method
     */
    async classify(
        receipt: any,
        transaction: any,
        chainId: number,
    ): Promise<ClassificationResult> {
        const logs = receipt.logs || [];
        const inputData = transaction.data || transaction.input || '0x';
        const toAddress = transaction.to?.toLowerCase();
        const value = transaction.value?.toString() || '0';

        // Extract method signature
        const methodSig = inputData.slice(0, 10);

        // Classify Envelope Type
        const envelopeType = this.classifyEnvelope(transaction);

        // 1. Check for contract deployment
        if (!toAddress || toAddress === '0x0000000000000000000000000000000000000000') {
            const result = this.classifyContractDeployment(receipt, transaction);
            result.envelopeType = envelopeType;
            return result;
        }

        // 2. Check for L2-specific operations
        if (this.isL2Chain(chainId)) {
            const l2Result = this.classifyL2Operation(
                receipt,
                transaction,
                logs,
                methodSig,
                toAddress,
            );
            if (l2Result) {
                l2Result.envelopeType = envelopeType;
                return l2Result;
            }
        }

        // 3. Check for DEX swaps
        const swapResult = this.classifySwap(logs, methodSig, toAddress);
        if (swapResult) {
            swapResult.envelopeType = envelopeType;
            return swapResult;
        }

        // 4. Check for NFT operations
        const nftResult = this.classifyNFT(logs, methodSig, toAddress);
        if (nftResult) {
            nftResult.envelopeType = envelopeType;
            return nftResult;
        }

        // 5. Check for lending/borrowing
        const lendingResult = this.classifyLending(logs, methodSig, toAddress);
        if (lendingResult) {
            lendingResult.envelopeType = envelopeType;
            return lendingResult;
        }

        // 6. Check for staking
        const stakingResult = this.classifyStaking(logs, methodSig, toAddress);
        if (stakingResult) {
            stakingResult.envelopeType = envelopeType;
            return stakingResult;
        }

        // 7. Check for bridge operations
        const bridgeResult = this.classifyBridge(logs, methodSig, toAddress);
        if (bridgeResult) {
            bridgeResult.envelopeType = envelopeType;
            return bridgeResult;
        }

        // 8. Check for liquidity operations
        const liquidityResult = this.classifyLiquidity(logs, methodSig);
        if (liquidityResult) {
            liquidityResult.envelopeType = envelopeType;
            return liquidityResult;
        }

        // 9. Check for governance
        const govResult = this.classifyGovernance(logs, methodSig);
        if (govResult) {
            govResult.envelopeType = envelopeType;
            return govResult;
        }

        // 10. Check for token operations
        const tokenResult = this.classifyTokenOperation(logs, methodSig, value);
        if (tokenResult) {
            tokenResult.envelopeType = envelopeType;
            return tokenResult;
        }

        // 10.5 Check for Advanced Execution (Multisig / AA)
        // Checks AFTER specific functional types to prioritize "What happened" over "How it executed"
        // But if no specific function found, we identify the execution layer.
        const advancedResult = this.classifyAdvancedExecution(receipt, transaction, logs, methodSig, toAddress);
        if (advancedResult) {
            advancedResult.envelopeType = envelopeType;
            return advancedResult;
        }

        // 11. Native transfer
        if (value !== '0' && logs.length === 0) {
            const result = this.classifyNativeTransfer(transaction, receipt);
            result.envelopeType = envelopeType;
            return result;
        }

        // 12. Bulk transfer detection
        if (logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER).length > 3) {
            const result = this.classifyBulkTransfer(logs);
            result.envelopeType = envelopeType;
            return result;
        }

        // Fallback to contract interaction
        const result = this.classifyGenericContractInteraction(receipt, transaction, logs);
        result.envelopeType = envelopeType;
        return result;
    }

    // ==================== CLASSIFICATION METHODS ====================

    private classifySwap(
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        const swapLogs = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.SWAP_V2 ||
                l.topics[0] === EVENT_SIGNATURES.SWAP_V3 ||
                l.topics[0] === EVENT_SIGNATURES.SWAP_SUSHI ||
                l.topics[0] === EVENT_SIGNATURES.SWAP_BALANCER,
        );

        if (swapLogs.length === 0) return null;

        const transferLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER);
        if (transferLogs.length < 2) return null;

        let protocol = 'Unknown DEX';
        let confidence = 0.85;

        // Detect protocol
        if (toAddress === KNOWN_CONTRACTS.UNISWAP_V2_ROUTER) {
            protocol = 'Uniswap V2';
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.UNISWAP_V3_ROUTER ||
            toAddress === KNOWN_CONTRACTS.UNISWAP_V3_ROUTER_2) {
            protocol = 'Uniswap V3';
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.SUSHISWAP_ROUTER) {
            protocol = 'SushiSwap';
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.PANCAKESWAP_ROUTER) {
            protocol = 'PancakeSwap';
            confidence = 0.95;
        }

        return {
            type: TransactionType.SWAP,
            confidence,
            protocol,
            details: {
                method: methodSig,
                eventSignatures: swapLogs.map((l: any) => l.topics[0]),
                dexProtocol: protocol,
            },
            matches: ['DEX Swap', `${transferLogs.length} token transfers detected`],
            warnings: [],
        };
    }

    private classifyNFT(
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        const erc721Transfers = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER_721 && l.topics.length === 4,
        );

        const erc1155Transfers = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER_SINGLE ||
                l.topics[0] === EVENT_SIGNATURES.TRANSFER_BATCH,
        );

        const nftTransfers = [...erc721Transfers, ...erc1155Transfers];
        if (nftTransfers.length === 0) return null;

        // Check for marketplace
        let marketplace: string | undefined;
        let type = TransactionType.NFT_TRANSFER;
        let confidence = 0.9;

        if (toAddress === KNOWN_CONTRACTS.OPENSEA_SEAPORT) {
            marketplace = 'OpenSea';
            type = TransactionType.NFT_SALE;
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.LOOKSRARE) {
            marketplace = 'LooksRare';
            type = TransactionType.NFT_SALE;
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.BLUR) {
            marketplace = 'Blur';
            type = TransactionType.NFT_SALE;
            confidence = 0.95;
        }

        // Check for mint (from address 0x0)
        const isMint = nftTransfers.some(
            (l: any) => l.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000',
        );

        if (isMint) {
            type = TransactionType.NFT_MINT;
            confidence = 0.95;
        }

        const tokenStandard = erc1155Transfers.length > 0 ? 'ERC-1155' : 'ERC-721';

        return {
            type,
            confidence,
            protocol: marketplace,
            details: {
                method: methodSig,
                eventSignatures: nftTransfers.map((l: any) => l.topics[0]),
                tokenStandard,
                marketplace,
            },
            matches: [`${tokenStandard} transfer detected`, marketplace || 'Direct transfer'],
            warnings: [],
        };
    }

    private classifyLending(
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        const depositLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.DEPOSIT);
        const withdrawLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.WITHDRAW);
        const borrowLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.BORROW);
        const repayLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.REPAY);
        const liquidationLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.LIQUIDATION_CALL);

        let protocol: string | undefined;
        let type: TransactionType | null = null;
        let confidence = 0.9;

        if (toAddress === KNOWN_CONTRACTS.AAVE_V2_POOL ||
            toAddress === KNOWN_CONTRACTS.AAVE_V3_POOL) {
            protocol = 'Aave';
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.COMPOUND_COMPTROLLER) {
            protocol = 'Compound';
            confidence = 0.95;
        }

        if (depositLogs.length > 0) {
            type = TransactionType.LENDING_DEPOSIT;
        } else if (withdrawLogs.length > 0) {
            type = TransactionType.LENDING_WITHDRAW;
        } else if (borrowLogs.length > 0) {
            type = TransactionType.LENDING_BORROW;
        } else if (repayLogs.length > 0) {
            type = TransactionType.LENDING_REPAY;
        } else if (liquidationLogs.length > 0) {
            type = TransactionType.LENDING_LIQUIDATION;
            confidence = 1.0;
        }

        if (!type) return null;

        return {
            type,
            confidence,
            protocol,
            details: {
                method: methodSig,
                lendingProtocol: protocol,
            },
            matches: ['Lending protocol interaction'],
            warnings: [],
        };
    }

    private classifyStaking(
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        const stakedLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.STAKED);
        const unstakedLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.UNSTAKED);
        const rewardsLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.REWARDS_CLAIMED);

        let type: TransactionType | null = null;
        let protocol: string | undefined;
        let confidence = 0.9;

        if (toAddress === KNOWN_CONTRACTS.LIDO_STETH) {
            protocol = 'Lido';
            confidence = 0.95;
        } else if (toAddress === KNOWN_CONTRACTS.ROCKET_POOL) {
            protocol = 'Rocket Pool';
            confidence = 0.95;
        }

        if (stakedLogs.length > 0 || methodSig === METHOD_SIGNATURES.STAKE) {
            type = TransactionType.STAKING_DEPOSIT;
        } else if (unstakedLogs.length > 0 || methodSig === METHOD_SIGNATURES.UNSTAKE) {
            type = TransactionType.STAKING_WITHDRAW;
        } else if (rewardsLogs.length > 0 || methodSig === METHOD_SIGNATURES.GET_REWARD) {
            type = TransactionType.STAKING_CLAIM_REWARDS;
        }

        if (!type) return null;

        return {
            type,
            confidence,
            protocol,
            details: {
                method: methodSig,
            },
            matches: ['Staking interaction'],
            warnings: [],
        };
    }

    private classifyBridge(
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        const bridgeLogs = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.BRIDGE_TRANSFER_SENT ||
                l.topics[0] === EVENT_SIGNATURES.BRIDGE_TRANSFER_RECEIVED,
        );

        if (bridgeLogs.length === 0 &&
            toAddress !== KNOWN_CONTRACTS.OPTIMISM_BRIDGE &&
            toAddress !== KNOWN_CONTRACTS.ARBITRUM_BRIDGE &&
            toAddress !== KNOWN_CONTRACTS.BASE_BRIDGE &&
            toAddress !== KNOWN_CONTRACTS.POLYGON_BRIDGE) {
            return null;
        }

        let bridge: string | undefined;
        let type = TransactionType.BRIDGE_DEPOSIT;

        if (toAddress === KNOWN_CONTRACTS.OPTIMISM_BRIDGE) {
            bridge = 'Optimism Bridge';
        } else if (toAddress === KNOWN_CONTRACTS.ARBITRUM_BRIDGE) {
            bridge = 'Arbitrum Bridge';
        } else if (toAddress === KNOWN_CONTRACTS.BASE_BRIDGE) {
            bridge = 'Base Bridge';
        } else if (toAddress === KNOWN_CONTRACTS.POLYGON_BRIDGE) {
            bridge = 'Polygon Bridge';
        }

        const isSent = bridgeLogs.some((l: any) => l.topics[0] === EVENT_SIGNATURES.BRIDGE_TRANSFER_SENT);
        if (!isSent) {
            type = TransactionType.BRIDGE_WITHDRAW;
        }

        return {
            type,
            confidence: 0.95,
            protocol: bridge,
            details: {
                method: methodSig,
                bridge,
            },
            matches: ['Bridge operation detected'],
            warnings: [],
        };
    }

    private classifyL2Operation(
        receipt: any,
        transaction: any,
        logs: any[],
        methodSig: string,
        toAddress: string,
    ): ClassificationResult | null {
        // Check for L2 portal operations
        const depositLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.MESSAGE_PASSED);
        const withdrawalLogs = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.WITHDRAWAL_INITIATED ||
                l.topics[0] === EVENT_SIGNATURES.WITHDRAWAL_FINALIZED,
        );

        let type: TransactionType | null = null;
        let confidence = 0.9;

        if (toAddress === KNOWN_CONTRACTS.OPTIMISM_PORTAL ||
            toAddress === KNOWN_CONTRACTS.ARBITRUM_INBOX ||
            toAddress === KNOWN_CONTRACTS.BASE_PORTAL) {

            if (methodSig === METHOD_SIGNATURES.DEPOSIT_TRANSACTION) {
                type = TransactionType.L2_DEPOSIT;
                confidence = 0.95;
            } else if (methodSig === METHOD_SIGNATURES.PROVE_WITHDRAWAL) {
                type = TransactionType.L2_PROVE_WITHDRAWAL;
                confidence = 0.95;
            } else if (methodSig === METHOD_SIGNATURES.FINALIZE_WITHDRAWAL) {
                type = TransactionType.L2_FINALIZE_WITHDRAWAL;
                confidence = 0.95;
            } else if (depositLogs.length > 0) {
                type = TransactionType.L2_DEPOSIT;
            } else if (withdrawalLogs.length > 0) {
                type = TransactionType.L2_WITHDRAWAL;
            }
        }

        if (!type) return null;

        return {
            type,
            confidence,
            details: {
                method: methodSig,
            },
            matches: ['L2 operation detected'],
            warnings: [],
        };
    }

    private classifyLiquidity(
        logs: any[],
        methodSig: string,
    ): ClassificationResult | null {
        const mintLogs = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.MINT_V2 ||
                l.topics[0] === EVENT_SIGNATURES.MINT_V3,
        );

        const burnLogs = logs.filter(
            (l: any) => l.topics[0] === EVENT_SIGNATURES.BURN_V2 ||
                l.topics[0] === EVENT_SIGNATURES.BURN_V3,
        );

        let type: TransactionType | null = null;
        let confidence = 0.85;

        if (mintLogs.length > 0 || methodSig === METHOD_SIGNATURES.ADD_LIQUIDITY) {
            type = TransactionType.ADD_LIQUIDITY;
            confidence = 0.9;
        } else if (burnLogs.length > 0 || methodSig === METHOD_SIGNATURES.REMOVE_LIQUIDITY) {
            type = TransactionType.REMOVE_LIQUIDITY;
            confidence = 0.9;
        }

        if (!type) return null;

        return {
            type,
            confidence,
            details: {
                method: methodSig,
                eventSignatures: [...mintLogs, ...burnLogs].map((l: any) => l.topics[0]),
            },
            matches: ['Liquidity operation detected'],
            warnings: [],
        };
    }

    private classifyGovernance(
        logs: any[],
        methodSig: string,
    ): ClassificationResult | null {
        const voteLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.VOTE_CAST);
        const proposalLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.PROPOSAL_CREATED);

        let type: TransactionType | null = null;
        let confidence = 0.9;

        if (voteLogs.length > 0 || methodSig === METHOD_SIGNATURES.CAST_VOTE) {
            type = TransactionType.GOVERNANCE_VOTE;
            confidence = 0.95;
        } else if (proposalLogs.length > 0 || methodSig === METHOD_SIGNATURES.PROPOSE) {
            type = TransactionType.GOVERNANCE_PROPOSE;
            confidence = 0.95;
        }

        if (!type) return null;

        return {
            type,
            confidence,
            details: {
                method: methodSig,
                eventSignatures: [...voteLogs, ...proposalLogs].map((l: any) => l.topics[0]),
            },
            matches: ['Governance interaction'],
            warnings: [],
        };
    }

    private classifyTokenOperation(
        logs: any[],
        methodSig: string,
        value: string,
    ): ClassificationResult | null {
        const transferLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER);
        const approvalLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.APPROVAL);

        if (transferLogs.length === 0 && approvalLogs.length === 0) {
            return null;
        }

        let type: TransactionType = TransactionType.TOKEN_TRANSFER;
        let confidence = 0.9;
        let tokenStandard: 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'Native' = 'ERC-20';

        // Check for approval
        if (approvalLogs.length > 0 || methodSig === METHOD_SIGNATURES.APPROVE) {
            type = TransactionType.TOKEN_APPROVAL;
            confidence = 0.95;
        }

        // Check for mint (from 0x0)
        const isMint = transferLogs.some(
            (l: any) => l.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000',
        );

        // Check for burn (to 0x0)
        const isBurn = transferLogs.some(
            (l: any) => l.topics[2] === '0x0000000000000000000000000000000000000000000000000000000000000000',
        );

        if (isMint) {
            type = TransactionType.TOKEN_MINT;
            confidence = 0.95;
        } else if (isBurn) {
            type = TransactionType.TOKEN_BURN;
            confidence = 0.95;
        }

        return {
            type,
            confidence,
            details: {
                method: methodSig,
                tokenStandard,
                eventSignatures: [...transferLogs, ...approvalLogs].map((l: any) => l.topics[0]),
            },
            matches: [`${transferLogs.length} ERC-20 transfer(s)`],
            warnings: [],
        };
    }

    private classifyNativeTransfer(
        transaction: any,
        receipt: any,
    ): ClassificationResult {
        const value = transaction.value?.toString() || '0';
        const valueInEth = ethers.formatEther(value);

        return {
            type: TransactionType.NATIVE_TRANSFER,
            confidence: 1.0,
            details: {
                tokenStandard: 'Native',
            },
            matches: [`Native transfer of ${valueInEth} ETH`],
            warnings: [],
        };
    }

    private classifyBulkTransfer(logs: any[]): ClassificationResult {
        const transferLogs = logs.filter((l: any) => l.topics[0] === EVENT_SIGNATURES.TRANSFER);

        return {
            type: TransactionType.BULK_TRANSFER,
            confidence: 0.95,
            details: {
                tokenStandard: 'ERC-20',
                eventSignatures: transferLogs.map((l: any) => l.topics[0]),
            },
            matches: [`Bulk transfer detected: ${transferLogs.length} transfers`],
            warnings: [],
        };
    }

    private classifyContractDeployment(
        receipt: any,
        transaction: any,
    ): ClassificationResult {
        const contractAddress = receipt.contractAddress || 'Unknown';

        return {
            type: TransactionType.CONTRACT_DEPLOYMENT,
            confidence: 1.0,
            details: {
                method: 'contract_deployment',
            },
            matches: [`Contract deployed at ${contractAddress}`],
            warnings: [],
        };
    }

    private classifyGenericContractInteraction(
        receipt: any,
        transaction: any,
        logs: any[],
    ): ClassificationResult {
        const inputData = transaction.data || transaction.input || '0x';
        const methodSig = inputData.slice(0, 10);

        return {
            type: TransactionType.CONTRACT_INTERACTION,
            confidence: 0.5,
            details: {
                method: methodSig,
                eventSignatures: logs.map((l: any) => l.topics[0]),
            },
            matches: ['Generic contract interaction'],
            warnings: ['Unable to classify transaction type with high confidence'],
        };
    }

    private classifyAdvancedExecution(
        receipt: any,
        transaction: any,
        logs: any[],
        methodSig: string,
        toAddress: string
    ): ClassificationResult | null {
        // 1. Account Abstraction (ERC-4337)
        if (
            toAddress === KNOWN_CONTRACTS.ENTRY_POINT_0_6 ||
            toAddress === KNOWN_CONTRACTS.ENTRY_POINT_0_7 ||
            methodSig === METHOD_SIGNATURES.HANDLE_OPS ||
            methodSig === METHOD_SIGNATURES.HANDLE_AGGREGATED_OPS
        ) {
            const userOpEvent = logs.find((l: any) => l.topics[0] === EVENT_SIGNATURES.USER_OPERATION_EVENT);
            let sender = undefined;

            if (userOpEvent) {
                console.log('DEBUG: Found UserOperationEvent', userOpEvent.topics);
            } else {
                console.log('DEBUG: UserOperationEvent NOT found in logs');
            }

            if (userOpEvent && userOpEvent.topics.length > 1) {
                // Determine Sender Index based on EntryPoint version
                // v0.6: topics = [Sig, Sender, Paymaster] -> Sender is index 1
                // v0.7: topics = [Sig, UserOpHash, Sender, Paymaster] -> Sender is index 2
                const senderIndex = userOpEvent.topics.length === 4 ? 2 : 1;

                try {
                    // Check if index exists
                    if (userOpEvent.topics[senderIndex]) {
                        sender = ethers.stripZerosLeft(userOpEvent.topics[senderIndex]);
                    }
                } catch (e) {
                    sender = userOpEvent.topics[senderIndex];
                }
            }

            return {
                type: TransactionType.ACCOUNT_ABSTRACTION,
                confidence: 0.95,
                details: {
                    method: methodSig,
                    eventSignatures: userOpEvent ? [EVENT_SIGNATURES.USER_OPERATION_EVENT] : [],
                    isProxy: true,
                    sender: sender
                },
                matches: ['ERC-4337 UserOperation detected'],
                warnings: []
            };
        }

        // 2. Multisig (Gnosis Safe)
        const isSafeExec = methodSig === METHOD_SIGNATURES.EXEC_TRANSACTION;
        const safeSuccess = logs.some((l: any) => l.topics[0] === EVENT_SIGNATURES.EXECUTION_SUCCESS);

        if (isSafeExec || safeSuccess) {
            return {
                type: TransactionType.MULTISIG_EXECUTION,
                confidence: 0.95,
                details: {
                    method: methodSig,
                    isMultiSig: true,
                    eventSignatures: safeSuccess ? [EVENT_SIGNATURES.EXECUTION_SUCCESS] : []
                },
                matches: ['Multisig execution detected'],
                warnings: []
            };
        }

        return null;
    }

    private classifyEnvelope(transaction: any): TransactionEnvelopeType {
        // Handle Ethers v6 vs v5 vs RPC response structures
        // RPC often returns type as hex string '0x2' or number 2

        let typeVal = transaction.type;

        if (typeof typeVal === 'string') {
            typeVal = parseInt(typeVal, 16);
        }

        if (typeVal === 0 || typeVal === undefined || typeVal === null) return TransactionEnvelopeType.LEGACY;
        if (typeVal === 1) return TransactionEnvelopeType.EIP2930;
        if (typeVal === 2) return TransactionEnvelopeType.EIP1559;
        if (typeVal === 3) return TransactionEnvelopeType.EIP4844;

        return TransactionEnvelopeType.LEGACY;
    }

    // ==================== HELPER METHODS ====================

    private isL2Chain(chainId: number): boolean {
        // Base: 8453, Optimism: 10, Arbitrum: 42161, Polygon: 137
        return [8453, 10, 42161, 137].includes(chainId);
    }

    /**
     * Get human-readable transaction type
     */
    getReadableType(type: TransactionType): string {
        const typeMap: Record<TransactionType, string> = {
            [TransactionType.TOKEN_TRANSFER]: 'Token Transfer',
            [TransactionType.TOKEN_APPROVAL]: 'Token Approval',
            [TransactionType.TOKEN_MINT]: 'Token Mint',
            [TransactionType.TOKEN_BURN]: 'Token Burn',
            [TransactionType.SWAP]: 'Token Swap',
            [TransactionType.ADD_LIQUIDITY]: 'Add Liquidity',
            [TransactionType.REMOVE_LIQUIDITY]: 'Remove Liquidity',
            [TransactionType.NFT_MINT]: 'NFT Mint',
            [TransactionType.NFT_TRANSFER]: 'NFT Transfer',
            [TransactionType.NFT_SALE]: 'NFT Sale',
            [TransactionType.NFT_LISTING]: 'NFT Listing',
            [TransactionType.NFT_CANCEL_LISTING]: 'Cancel NFT Listing',
            [TransactionType.NFT_BID]: 'NFT Bid',
            [TransactionType.LENDING_DEPOSIT]: 'Lending Deposit',
            [TransactionType.LENDING_WITHDRAW]: 'Lending Withdraw',
            [TransactionType.LENDING_BORROW]: 'Borrow',
            [TransactionType.LENDING_REPAY]: 'Repay Loan',
            [TransactionType.LENDING_LIQUIDATION]: 'Liquidation',
            [TransactionType.STAKING_DEPOSIT]: 'Stake',
            [TransactionType.STAKING_WITHDRAW]: 'Unstake',
            [TransactionType.STAKING_CLAIM_REWARDS]: 'Claim Staking Rewards',
            [TransactionType.BRIDGE_DEPOSIT]: 'Bridge Deposit',
            [TransactionType.BRIDGE_WITHDRAW]: 'Bridge Withdraw',
            [TransactionType.CONTRACT_DEPLOYMENT]: 'Contract Deployment',
            [TransactionType.CONTRACT_INTERACTION]: 'Contract Interaction',
            [TransactionType.NATIVE_TRANSFER]: 'Native Transfer',
            [TransactionType.BULK_TRANSFER]: 'Bulk Transfer',
            [TransactionType.YIELD_FARM_STAKE]: 'Yield Farm Stake',
            [TransactionType.YIELD_FARM_UNSTAKE]: 'Yield Farm Unstake',
            [TransactionType.YIELD_FARM_HARVEST]: 'Yield Farm Harvest',
            [TransactionType.GOVERNANCE_VOTE]: 'Governance Vote',
            [TransactionType.GOVERNANCE_PROPOSE]: 'Create Proposal',
            [TransactionType.GOVERNANCE_DELEGATE]: 'Delegate Votes',
            [TransactionType.L2_DEPOSIT]: 'L2 Deposit',
            [TransactionType.L2_WITHDRAWAL]: 'L2 Withdrawal',
            [TransactionType.L2_PROVE_WITHDRAWAL]: 'Prove L2 Withdrawal',
            [TransactionType.L2_FINALIZE_WITHDRAWAL]: 'Finalize L2 Withdrawal',
            [TransactionType.MULTISIG_EXECUTION]: 'Multisig Transaction',
            [TransactionType.ACCOUNT_ABSTRACTION]: 'Account Abstraction',
            [TransactionType.META_TRANSACTION]: 'Meta-Transaction',
            [TransactionType.UNKNOWN]: 'Unknown Transaction',
        };

        return typeMap[type] || 'Unknown';
    }

    /**
     * Get emoji icon for transaction type
     */
    getTypeIcon(type: TransactionType): string {
        const iconMap: Record<TransactionType, string> = {
            [TransactionType.TOKEN_TRANSFER]: '💸',
            [TransactionType.TOKEN_APPROVAL]: '✅',
            [TransactionType.TOKEN_MINT]: '🏭',
            [TransactionType.TOKEN_BURN]: '🔥',
            [TransactionType.SWAP]: '🔄',
            [TransactionType.ADD_LIQUIDITY]: '💧',
            [TransactionType.REMOVE_LIQUIDITY]: '📤',
            [TransactionType.NFT_MINT]: '🎨',
            [TransactionType.NFT_TRANSFER]: '🖼️',
            [TransactionType.NFT_SALE]: '🛒',
            [TransactionType.NFT_LISTING]: '📋',
            [TransactionType.NFT_CANCEL_LISTING]: '❌',
            [TransactionType.NFT_BID]: '💰',
            [TransactionType.LENDING_DEPOSIT]: '🏦',
            [TransactionType.LENDING_WITHDRAW]: '💵',
            [TransactionType.LENDING_BORROW]: '📊',
            [TransactionType.LENDING_REPAY]: '💳',
            [TransactionType.LENDING_LIQUIDATION]: '⚠️',
            [TransactionType.STAKING_DEPOSIT]: '🔒',
            [TransactionType.STAKING_WITHDRAW]: '🔓',
            [TransactionType.STAKING_CLAIM_REWARDS]: '🎁',
            [TransactionType.BRIDGE_DEPOSIT]: '🌉',
            [TransactionType.BRIDGE_WITHDRAW]: '🌁',
            [TransactionType.CONTRACT_DEPLOYMENT]: '🚀',
            [TransactionType.CONTRACT_INTERACTION]: '⚙️',
            [TransactionType.NATIVE_TRANSFER]: '💎',
            [TransactionType.BULK_TRANSFER]: '📦',
            [TransactionType.YIELD_FARM_STAKE]: '🌾',
            [TransactionType.YIELD_FARM_UNSTAKE]: '🌱',
            [TransactionType.YIELD_FARM_HARVEST]: '🌻',
            [TransactionType.GOVERNANCE_VOTE]: '🗳️',
            [TransactionType.GOVERNANCE_PROPOSE]: '📜',
            [TransactionType.GOVERNANCE_DELEGATE]: '👥',
            [TransactionType.L2_DEPOSIT]: '⬇️',
            [TransactionType.L2_WITHDRAWAL]: '⬆️',
            [TransactionType.L2_PROVE_WITHDRAWAL]: '🔍',
            [TransactionType.L2_FINALIZE_WITHDRAWAL]: '✔️',
            [TransactionType.MULTISIG_EXECUTION]: '🔐',
            [TransactionType.ACCOUNT_ABSTRACTION]: '🛡️',
            [TransactionType.META_TRANSACTION]: '🎭',
            [TransactionType.UNKNOWN]: '❓',
        };

        return iconMap[type] || '❓';
    }
}

// Export singleton instance
export const transactionClassifier = new TransactionClassifierService();

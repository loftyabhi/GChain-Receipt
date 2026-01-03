import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { renderBillHtml } from './PdfTemplateHelper';
import { PriceOracleService } from './PriceOracleService';
import { transactionClassifier, ClassificationResult, ExecutionType, TransactionEnvelopeType } from './TransactionClassifier';
import { AdminService } from './AdminService';
import { ERC20_ABI, ERC721_ABI, ERC1155_ABI } from '../abis/Common';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';

// --- Strict Interfaces ---

export interface BillRequest {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
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
    usdValue: string; // Display Value (Current)
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

    // Ads
    hasAd: boolean;
    adLink: string;
    adContent: string;
}

// Internal Data Structures (Pre-View Model)
interface RawTokenMovement {
    type: 'ERC20' | 'ERC721' | 'ERC1155' | 'NATIVE';
    address: string;
    from: string;
    to: string;
    amount: bigint;
    symbol: string;
    decimals: number;
    tokenId?: string;
}

interface PricedTokenMovement extends RawTokenMovement {
    historicPrice: number;
    currentPrice: number;
    historicValueUsd: number;
    currentValueUsd: number;
    isIn: boolean;
}

// --- Formatting Helpers ---

const formatGasUsed = (gas: bigint | number): string => {
    return Number(gas).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatEth = (val: string): string => {
    const num = parseFloat(val);
    if (num === 0) return "0";
    // Max 6 decimals, strip trailing zeros
    return parseFloat(num.toFixed(6)).toString();
};

const formatUsd = (val: number): string => {
    if (val === 0) return "0.00";
    if (val < 0.01) return "< 0.01";
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- Service ---

export class BillService {
    private oracle: PriceOracleService;
    private adminService: AdminService;
    private rpcs: { [key: number]: string } = {
        1: 'https://eth.llamarpc.com',
        8453: 'https://mainnet.base.org',
        137: 'https://polygon-rpc.com',
        11155111: 'https://rpc.sepolia.org',
        42161: 'https://arb1.arbitrum.io/rpc',
        10: 'https://mainnet.optimism.io',
        56: 'https://bsc-dataseed.binance.org',
        43114: 'https://api.avax.network/ext/bc/C/rpc'
    };

    private alchemyCallsMade = false;

    constructor() {
        this.oracle = new PriceOracleService();
        this.adminService = new AdminService();
    }

    /**
     * Main Entry Point: Generate a PDF Bill for a transaction.
     */
    async generateBill(request: BillRequest): Promise<BillResponse> {
        const { txHash, chainId } = request;
        console.log(`[BillService] Generating bill for ${txHash} on chain ${chainId}`);

        try {
            // 1. Fetch Basic Info first (Cost: 1 RPC Call) to derive the ID
            // We need Block Number to construct the standard Bill ID
            const provider = new ethers.JsonRpcProvider(this.getRpcUrl(chainId));
            const receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) throw new Error('Transaction Receipt not found');

            // Construct Readable Bill ID
            // Format: BILL-{chainId}-{blockNumber}-{txHashShort}
            const shortHash = txHash.slice(0, 6).toLowerCase();
            const billId = `BILL-${chainId}-${receipt.blockNumber}-${shortHash}`;

            const jsonKey = `${billId}.json`;
            const pdfKey = `${billId}.pdf`;
            const publicPath = `/bills/${billId}.pdf`;

            console.log(`[BillService] ID Resolved: ${billId}`);

            // 2. Check Cache (Database First)
            const { data: dbBill, error: dbError } = await supabase
                .from('bills')
                .select('bill_json, status')
                .eq('tx_hash', txHash)
                .eq('chain_id', chainId)
                .single();

            if (dbBill && dbBill.bill_json) {
                console.log(`[BillService] DB Cache Hit! Returning existing bill.`);

                // Sliding Window: Reset deletion timer on access
                this.touchBill(txHash, chainId).catch(err => console.error("Touch failed", err));

                return {
                    pdfPath: publicPath,
                    billData: dbBill.bill_json as BillViewModel
                };
            }

            // Fallback: Check Storage (Legacy/PDF check)
            const { data: existingData } = await supabase
                .storage
                .from('receipts')
                .download(jsonKey);

            if (existingData) {
                console.log(`[BillService] Storage Cache Hit! Returning existing bill.`);
                const jsonString = await existingData.text();
                const cachedViewModel = JSON.parse(jsonString);

                // Background: Migrate to DB & Reset Timer
                this.saveToDb(txHash, chainId, request.connectedWallet || '', cachedViewModel, true);

                return {
                    pdfPath: publicPath,
                    billData: cachedViewModel
                };
            }

            // 3. Cache Miss - Resume Generation
            console.log(`[BillService] Cache Miss. Fetching full data...`);

            // Fetch remaining data (Tx, Block, Timestamp) - Receipt is already fetched
            // We can reuse the provider but we need to match the signature of fetchTransactionData or call it fully.
            // For simplicity and robustness, we can call fetchTransactionData but pass the known receipt if we refactored.
            // But fetchTransactionData fetches everything in parallel.
            // Let's just let it fetch. It's 1 extra call on a MISS. Acceptable.
            const { tx, block, timestamp } = await this.fetchFullData(provider, txHash, receipt);

            // Classify Transaction
            const classification = await transactionClassifier.classify(receipt, tx, chainId);

            // Resolve Identity
            const userAddress = this.resolveUserIdentity(request, tx, classification);

            // Resolve ENS
            const { fromName, toName } = await this.resolveNames(classification.details?.sender || tx.from, tx.to, chainId);

            // Raw Token Parsing
            const rawMovements = await this.parseRawMovements(receipt.logs, chainId, provider);

            // Add Native Transfer if exists
            if (tx.value > BigInt(0)) {
                rawMovements.push({
                    type: 'NATIVE',
                    address: 'native',
                    from: tx.from.toLowerCase(),
                    to: tx.to?.toLowerCase() || 'contract',
                    amount: tx.value,
                    symbol: this.getNativeSymbol(chainId),
                    decimals: 18
                });
            }

            // Apply Pricing & Direction
            const pricedMovements = await this.applyPricingAndDirection(
                rawMovements,
                userAddress,
                classification,
                chainId,
                receipt.blockNumber,
                timestamp,
                tx.from.toLowerCase()
            );

            // Internal Txs
            const internalTxs = await this.fetchInternalTransactions(txHash, chainId, receipt.blockNumber);

            // Fees
            const feeData = await this.calculateFees(receipt, chainId, timestamp);

            // View Model construction
            const billData = await this.buildBillViewModel({
                request, tx, receipt, timestamp, classification,
                userAddress, fromName, toName,
                pricedMovements, internalTxs, feeData,
                // Pass derived ID to ensure consistency
                forcedBillId: billId
            });

            // 4. Render PDF (Returns Buffer)
            const pdfBuffer = await this.renderPdfBuffer(billData);

            // 5. Upload to Supabase (Parallel)
            console.log(`[BillService] Uploading ${billId} to Supabase...`);

            // Upload PDF
            const pdfUpload = supabase.storage
                .from('receipts')
                .upload(pdfKey, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            // Upload JSON (Metadata for future 0-RPC retrieval)
            const jsonBuffer = Buffer.from(JSON.stringify(billData));
            const jsonUpload = supabase.storage
                .from('receipts')
                .upload(jsonKey, jsonBuffer, {
                    contentType: 'application/json',
                    upsert: true
                });

            await Promise.all([pdfUpload, jsonUpload]);

            // Save to DB (Cache)
            await this.saveToDb(txHash, chainId, userAddress, billData, receipt.status === 1);

            // Trigger Cleanup (Async/Fire-and-forget)
            this.cleanupOldBills().catch(err => console.error("Cleanup failed", err));

            console.log(`[BillService] Generation & Upload Complete.`);
            return { pdfPath: publicPath, billData };

        } catch (error: any) {
            console.error(`[BillService] Generation Failed: ${error.message}`);
            throw error;
        }
    }

    // --- Data Fetching ---

    private async fetchTransactionData(txHash: string, chainId: number) {
        const rpcUrl = this.getRpcUrl(chainId);
        if (!rpcUrl) throw new Error(`Unsupported Chain ID: ${chainId}`);

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const [tx, receipt] = await Promise.all([
            provider.getTransaction(txHash),
            provider.getTransactionReceipt(txHash)
        ]);

        if (!tx || !receipt) throw new Error('Transaction not found');
        const block = await provider.getBlock(receipt.blockNumber);
        if (!block) throw new Error('Block not found');

        return { provider, tx, receipt, block, timestamp: block.timestamp };
    }

    // New Helper to complete data fetching after receipt is known
    private async fetchFullData(provider: ethers.JsonRpcProvider, txHash: string, receipt: ethers.TransactionReceipt) {
        const [tx, block] = await Promise.all([
            provider.getTransaction(txHash),
            provider.getBlock(receipt.blockNumber)
        ]);
        if (!tx) throw new Error('Transaction not found');
        if (!block) throw new Error('Block not found');

        return { provider, tx, receipt, block, timestamp: block.timestamp };
    }

    private resolveUserIdentity(request: BillRequest, tx: ethers.TransactionResponse, classification: ClassificationResult): string {
        if (request.connectedWallet) return request.connectedWallet.toLowerCase();
        if (classification.details?.sender) return classification.details.sender.toLowerCase();
        return tx.from.toLowerCase();
    }

    // --- Parsing (Raw) ---

    private async parseRawMovements(logs: readonly any[], chainId: number, provider: ethers.Provider): Promise<RawTokenMovement[]> {
        const movements: RawTokenMovement[] = [];
        const erc20 = new ethers.Interface(ERC20_ABI);
        const erc721 = new ethers.Interface(ERC721_ABI);
        const erc1155 = new ethers.Interface(ERC1155_ABI);

        const topics = {
            transfer: erc20.getEvent('Transfer')?.topicHash,
            transferSingle: erc1155.getEvent('TransferSingle')?.topicHash,
            transferBatch: erc1155.getEvent('TransferBatch')?.topicHash
        };

        const tokenCache: Record<string, { symbol: string, decimals: number }> = {};

        for (const log of logs) {
            // ERC20 & 721
            if (log.topics[0] === topics.transfer) {
                if (log.topics.length === 3) {
                    // ERC20
                    try {
                        const parsed = erc20.parseLog(log);
                        if (parsed) {
                            if (!tokenCache[log.address]) {
                                const c = new ethers.Contract(log.address, ERC20_ABI, provider);
                                try {
                                    const [s, d] = await Promise.all([c.symbol(), c.decimals()]);
                                    tokenCache[log.address] = { symbol: s, decimals: Number(d) };
                                } catch { tokenCache[log.address] = { symbol: 'TOKEN', decimals: 18 }; }
                            }
                            movements.push({
                                type: 'ERC20',
                                address: log.address,
                                from: parsed.args[0].toLowerCase(),
                                to: parsed.args[1].toLowerCase(),
                                amount: parsed.args[2],
                                symbol: tokenCache[log.address].symbol,
                                decimals: tokenCache[log.address].decimals
                            });
                        }
                    } catch { }
                } else if (log.topics.length === 4) {
                    // ERC721
                    try {
                        const parsed = erc721.parseLog(log);
                        if (parsed) {
                            movements.push({
                                type: 'ERC721',
                                address: log.address,
                                from: parsed.args[0].toLowerCase(),
                                to: parsed.args[1].toLowerCase(),
                                amount: BigInt(1),
                                symbol: `NFT`,
                                decimals: 0,
                                tokenId: parsed.args[2].toString()
                            });
                        }
                    } catch { }
                }
            }
            // ERC1155
            else if (log.topics[0] === topics.transferSingle) {
                try {
                    const parsed = erc1155.parseLog(log);
                    if (parsed) {
                        movements.push({
                            type: 'ERC1155',
                            address: log.address,
                            from: parsed.args[1].toLowerCase(),
                            to: parsed.args[2].toLowerCase(),
                            amount: parsed.args[4],
                            symbol: `ID #${parsed.args[3]}`,
                            decimals: 0,
                            tokenId: parsed.args[3].toString()
                        });
                    }
                } catch { }
            }
        }
        return movements;
    }

    // --- Valuation & Direction (Enterprise Layer) ---

    private async applyPricingAndDirection(
        raw: RawTokenMovement[],
        userAddress: string,
        classification: ClassificationResult,
        chainId: number,
        blockNumber: number,
        timestamp: number,
        txOrigin: string
    ): Promise<PricedTokenMovement[]> {
        const priced: PricedTokenMovement[] = [];
        const aliasAddress = classification.executionType === ExecutionType.ACCOUNT_ABSTRACTION ? txOrigin : undefined;

        const isRelevent = (addr: string): boolean => addr === userAddress || (aliasAddress !== undefined && addr === aliasAddress);

        let relevantRaw = raw.filter(m => isRelevent(m.from) || isRelevent(m.to));

        if (relevantRaw.length === 0) {
            // Fallback: If no movements for User, try movements involving Tx Origin
            if (userAddress !== txOrigin) {
                relevantRaw = raw.filter(m => m.from === txOrigin || m.to === txOrigin);
            }
        }

        // Dedup Check: If still empty, maybe return all NON-spam (non-zero) movements? 
        // For now, strict: only irrelevant if truly 0 movements.
        if (relevantRaw.length === 0 && raw.length > 0) {
            // Last resort: Just show everything (Observer mode for unrelated tx)
            relevantRaw = raw;
        }

        for (const m of relevantRaw) {
            let isIn = isRelevent(m.to);
            if (!isRelevent(m.from) && !isRelevent(m.to)) {
                // If neither, assume IN if TO is closer to being 'recipient-like'? 
                // Or just default OUT if FROM matches txOrigin.
                if (m.from === txOrigin) isIn = false;
                else isIn = true;
            }

            let histPrice = 0;
            let currPrice = 0;

            if ((m.type === 'ERC20' || m.type === 'NATIVE') && m.amount > BigInt(0)) {
                try {
                    const [h, c] = await Promise.all([
                        this.oracle.getAccountingPrice({ chainId, tokenAddress: m.address, blockNumber, txTimestamp: timestamp }).catch(() => ({ price: 0 })),
                        this.oracle.getDisplayPrice({ chainId, tokenAddress: m.address }).catch(() => ({ price: 0 }))
                    ]);
                    histPrice = h.price;
                    currPrice = c.price;
                } catch (e) {
                    console.warn(`[BillService] Pricing failed for ${m.address}:`, e);
                }
            }

            const amountFmt = ethers.formatUnits(m.amount, m.decimals);
            const amountFloat = parseFloat(amountFmt);

            priced.push({
                ...m,
                historicPrice: histPrice,
                currentPrice: currPrice,
                historicValueUsd: amountFloat * histPrice,
                currentValueUsd: amountFloat * currPrice,
                isIn
            });
        }

        return priced;
    }

    private async calculateFees(receipt: ethers.TransactionReceipt, chainId: number, timestamp: number) {
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || BigInt(0);
        const feeWei = gasUsed * gasPrice;
        const feeEth = ethers.formatEther(feeWei);
        const feeEthNum = parseFloat(feeEth);

        let feeUsdNum = 0;
        try {
            const price = await this.oracle.getAccountingPrice({
                chainId,
                tokenAddress: 'native',
                blockNumber: receipt.blockNumber,
                txTimestamp: timestamp
            });
            feeUsdNum = feeEthNum * price.price;
        } catch (e) { console.warn('Fee pricing failed'); }

        const feeUSD = formatUsd(feeUsdNum).replace('< 0.01', '< $0.01'); // Ad-hoc fix for prefix

        return { gasUsed, gasPrice, feeEth, feeUSD, feeUsdNum };
    }

    // --- Internal Txs ---

    private async fetchInternalTransactions(txHash: string, chainId: number, blockNumber: number): Promise<InternalTxViewModel[]> {
        try {
            if (this.isAlchemySupported(chainId)) {
                const alc = await this.fetchInternalFromAlchemy(txHash, chainId, blockNumber);
                if (alc.length > 0) return alc;
            }
            return await this.fetchInternalTransactionsFromBlockscout(txHash, chainId);
        } catch { return []; }
    }

    private async fetchInternalFromAlchemy(txHash: string, chainId: number, blockNumber: number): Promise<InternalTxViewModel[]> {
        const key = process.env.ALCHEMY_API_KEY;
        if (!key) return [];
        let url = '';
        switch (chainId) {
            case 1: url = `https://eth-mainnet.g.alchemy.com/v2/${key}`; break;
            case 8453: url = `https://base-mainnet.g.alchemy.com/v2/${key}`; break;
            case 137: url = `https://polygon-mainnet.g.alchemy.com/v2/${key}`; break;
            case 42161: url = `https://arb-mainnet.g.alchemy.com/v2/${key}`; break;
            case 10: url = `https://opt-mainnet.g.alchemy.com/v2/${key}`; break;
            case 11155111: url = `https://eth-sepolia.g.alchemy.com/v2/${key}`; break;
            default: return [];
        }

        try {
            const hexBlock = `0x${blockNumber.toString(16)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'alchemy_getAssetTransfers',
                    params: [{ fromBlock: hexBlock, toBlock: hexBlock, category: ['internal'], withMetadata: false, excludeZeroValue: true }]
                })
            });
            const data = await res.json();
            if (data.result?.transfers) {
                return data.result.transfers
                    .filter((t: any) => t.hash && t.hash.toLowerCase() === txHash.toLowerCase())
                    .map((t: any) => ({
                        from: t.from,
                        to: t.to,
                        fromShort: `${t.from.slice(0, 6)}...${t.from.slice(-4)}`,
                        toShort: `${t.to?.slice(0, 6)}...${t.to?.slice(-4)}`,
                        amount: t.value?.toString() || '0',
                        symbol: this.getNativeSymbol(chainId),
                        isError: false
                    }));
            }
        } catch { }
        return [];
    }

    private async fetchInternalTransactionsFromBlockscout(txHash: string, chainId: number): Promise<InternalTxViewModel[]> {
        let domain = '';
        if (chainId === 8453) domain = 'https://base.blockscout.com';
        else if (chainId === 10) domain = 'https://optimism.blockscout.com';
        else return [];

        try {
            const res = await fetch(`${domain}/api/v2/transactions/${txHash}/internal-transactions`);
            if (res.ok) {
                const data = await res.json();
                if (data.items?.length > 0) {
                    return data.items.map((tx: any) => ({
                        from: tx.from?.hash || tx.from,
                        to: tx.to?.hash || tx.to,
                        fromShort: (tx.from?.hash || tx.from).slice(0, 10),
                        toShort: (tx.to?.hash || tx.to).slice(0, 10),
                        amount: ethers.formatEther(tx.value || '0'),
                        symbol: this.getNativeSymbol(chainId),
                        isError: tx.success === false
                    }));
                }
            }
        } catch { }
        return [];
    }

    // --- ViewModel ---

    private async buildBillViewModel(data: any): Promise<BillViewModel> {
        const { request, tx, receipt, timestamp, classification, userAddress, fromName, toName, pricedMovements, internalTxs, feeData, forcedBillId } = data;
        const chainId = request.chainId;
        const now = new Date();
        const txDate = new Date(timestamp * 1000);

        // Aggregation
        let totalIn = 0;
        let totalOut = 0;
        let countIn = 0;
        let countOut = 0;

        const items: TokenItemViewModel[] = pricedMovements.map((m: PricedTokenMovement) => {
            if (m.isIn) { totalIn += m.historicValueUsd; countIn++; }
            else { totalOut += m.historicValueUsd; countOut++; }

            // Safe Unicode Icons:
            // IN:  ▲ (U+25B2) or 📥 (Avoid emoji if possible, prefer simple chars) -> Using Arrow Up
            // OUT: ▼ (U+25BC) or 📤 -> Using Arrow Down
            // Actually, user requested SAFE unicode. 
            // Let's use: IN = ▼ (Green in CSS), OUT = ▲ (Red in CSS)? 
            // Or typically In = +, Out = -.
            // The template uses specific classes (.direction-in/out).
            // We just need a symbol. + / - is safest.
            const dirSymbol = m.isIn ? "+" : "-";

            return {
                direction: m.isIn ? 'in' : 'out',
                isIn: m.isIn,
                tokenIcon: "", // Removed emoji, let template handle Layout or use CSS content
                tokenSymbol: m.symbol,
                tokenAddress: m.address,
                fromShort: `${m.from.slice(0, 6)}...${m.from.slice(-4)}`,
                toShort: `${m.to.slice(0, 6)}...${m.to.slice(-4)}`,
                amountFormatted: formatEth(ethers.formatUnits(m.amount, m.decimals)), // Clean decimals
                usdValue: `$${formatUsd(m.currentValueUsd)}`
            };
        });

        const netChange = totalIn - (totalOut + feeData.feeUsdNum);

        const randomAd = await this.adminService.getRandomAd('pdf');
        const qrCodeDataUrl = await QRCode.toDataURL(this.getExplorerUrl(chainId, tx.hash));

        return {
            BILL_ID: forcedBillId || `BILL-${chainId}-${receipt.blockNumber}-${tx.hash.slice(0, 6)}`,
            BILL_VERSION: "2.6.0 (Enterprise)",
            GENERATED_AT: now.toLocaleString(),
            STATUS: receipt.status === 1 ? "confirmed" : "failed",
            STATUS_CONFIRMED: receipt.status === 1,
            CHAIN_NAME: this.getChainName(chainId),
            CHAIN_ID: chainId,
            CHAIN_SYMBOL: this.getNativeSymbol(chainId),
            CHAIN_ICON: "", // Removed Emoji
            HOME_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
            TRANSACTION_HASH: tx.hash,
            BLOCK_NUMBER: receipt.blockNumber.toLocaleString(),
            BLOCK_HASH_SHORT: `${receipt.blockHash.slice(0, 10)}...`,
            TIMESTAMP: txDate.toLocaleString(),
            TIMESTAMP_RELATIVE: this.getRelativeTime(txDate),
            CONFIRMATIONS: 12,
            TYPE: classification.functionalType,
            TYPE_READABLE: transactionClassifier.getTypeLabel(classification.functionalType),
            TYPE_ICON: "", // Removed Emoji
            IS_MULTISIG: classification.executionType === ExecutionType.MULTISIG,
            IS_SMART_ACCOUNT: classification.executionType === ExecutionType.ACCOUNT_ABSTRACTION,
            ENVELOPE_LABEL: tx.type !== undefined ? this.getEnvelopeLabel(tx.type) : 'LEGACY',
            PROTOCOL_TAG: classification.protocol?.toUpperCase() || classification.details.protocol?.toUpperCase(),
            FROM_ADDRESS: classification.details?.sender || tx.from,
            FROM_ENS: fromName,
            FROM_AVATAR: this.getAvatar(classification.details?.sender || tx.from, fromName),
            TO_ADDRESS: tx.to || "Contract Creation",
            TO_ENS: toName,
            TO_AVATAR: this.getAvatar(tx.to || "0x00", toName),
            ITEMS: items,
            ITEMS_COUNT: items.length,
            INTERNAL_TXS: internalTxs,
            HAS_INTERNAL_TXS: internalTxs.length > 0,
            GAS_USED: formatGasUsed(feeData.gasUsed),
            GAS_PRICE_GWEI: ethers.formatUnits(feeData.gasPrice, 'gwei'),
            TOTAL_FEE: formatEth(feeData.feeEth),
            TOTAL_FEE_USD: feeData.feeUSD,
            TOTAL_IN_USD: formatUsd(totalIn),
            TOTAL_OUT_USD: formatUsd(totalOut),
            TOKENS_IN_COUNT: countIn,
            TOKENS_OUT_COUNT: countOut,
            NET_CHANGE_USD: formatUsd(Math.abs(netChange)),
            NET_CHANGE_SIGN: netChange >= 0 ? "+" : "-",
            NET_CHANGE_POSITIVE: netChange >= 0,
            RPC_PROVIDER: "Enterprise RPC",
            CONFIDENCE_PERCENT: Math.round(classification.confidence.score * 100),
            QR_CODE_DATA_URL: qrCodeDataUrl,
            EXPLORER_URL: this.getExplorerUrl(chainId, tx.hash),
            hasAd: !!randomAd,
            adLink: randomAd?.clickUrl || "",
            adContent: randomAd?.contentHtml || "",
            INCLUDE_AUDIT: true,
            PRICE_SOURCE: 'Combined Oracle (Hist+Curr)',
            CLASSIFICATION_METHOD: 'Determinisitic Rule Engine',
            REORG_DETECTED: false,
            CONFIDENCE: Math.round(classification.confidence.score * 100),
            CURRENT_YEAR: new Date().getFullYear(),
            FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
            DISCLAIMER_URL: process.env.DISCLAIMER_URL || 'http://localhost:3000/disclaimer'
        };
    }

    // --- Render ---

    private async renderPdfBuffer(data: BillViewModel): Promise<Uint8Array> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            // Enterprise Layout Strategy:
            // Single HTML source + CSS toggling for First Page vs Running Header pages
            const html = renderBillHtml(data);

            // Generate in-memory buffers
            const page1 = await browser.newPage();

            // Unified Margin Strategy
            const pdfMargin = { top: '60px', bottom: '60px', left: '60px', right: '60px' };

            const resetPaddingCss = `
                .page-content { padding: 0 !important; }
                .header { margin-top: 0 !important; } 
            `;

            await page1.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
            await page1.addStyleTag({ content: resetPaddingCss });

            const p1Buffer = await page1.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: false,
                margin: pdfMargin,
                pageRanges: '1'
            });
            await page1.close();

            const page2 = await browser.newPage();
            await page2.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
            await page2.addStyleTag({ content: resetPaddingCss });

            const p2Buffer = await page2.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `
                    <div style="width:100%; font-family: 'Inter', sans-serif; font-size: 9px; padding: 0 60px; color: #64748b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;">
                        <span style="font-weight: 600; color: #0f172a;">CHAIN RECEIPT</span>
                        <span>${data.BILL_ID} <span style="margin: 0 8px;">|</span> Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </div>
                `,
                footerTemplate: `<div style="width:100%;font-size:7px;text-align:center;color:#94a3b8;">Generated by Chain Receipt Assurance Protocols</div>`,
                margin: pdfMargin,
                pageRanges: '2-'
            });
            await page2.close();

            // --- Merge ---
            const pdfDoc = await PDFDocument.create();
            const p1 = await PDFDocument.load(p1Buffer);

            // Copy Page 1
            const [cov] = await pdfDoc.copyPages(p1, [0]);
            pdfDoc.addPage(cov);

            // Copy Page 2+
            try {
                const p2 = await PDFDocument.load(p2Buffer);
                if (p2.getPageCount() > 0) {
                    const indices = Array.from({ length: p2.getPageCount() }, (_, i) => i);
                    const others = await pdfDoc.copyPages(p2, indices);
                    others.forEach(o => pdfDoc.addPage(o));
                }
            } catch (e) { }

            return await pdfDoc.save();

        } finally {
            await browser.close();
        }
    }

    // --- Helpers (Private) ---

    private getRpcUrl(chainId: number): string {
        const k = process.env.ALCHEMY_API_KEY;
        if (k && this.isAlchemySupported(chainId)) {
            switch (chainId) {
                case 8453: return `https://base-mainnet.g.alchemy.com/v2/${k}`;
                case 137: return `https://polygon-mainnet.g.alchemy.com/v2/${k}`;
                case 42161: return `https://arb-mainnet.g.alchemy.com/v2/${k}`;
                case 10: return `https://opt-mainnet.g.alchemy.com/v2/${k}`;
                case 11155111: return `https://eth-sepolia.g.alchemy.com/v2/${k}`;
                default: return `https://eth-mainnet.g.alchemy.com/v2/${k}`;
            }
        }
        if (chainId === 1) return 'https://eth.llamarpc.com';
        return this.rpcs[chainId] || 'https://eth.llamarpc.com';
    }

    private isAlchemySupported(chainId: number) { return [1, 137, 8453, 10, 42161, 11155111].includes(chainId); }

    private getChainName(chainId: number) {
        if (chainId === 1) return 'Ethereum Mainnet';
        if (chainId === 8453) return 'Base Mainnet';
        if (chainId === 137) return 'Polygon';
        if (chainId === 42161) return 'Arbitrum One';
        if (chainId === 10) return 'Optimism';
        return 'Chain ' + chainId;
    }

    private getNativeSymbol(chainId: number) {
        if (chainId === 137) return 'MATIC';
        if (chainId === 56) return 'BNB';
        if (chainId === 43114) return 'AVAX';
        return 'ETH';
    }

    private getExplorerUrl(chainId: number, hash: string) {
        let domain = 'etherscan.io';
        if (chainId === 8453) domain = 'basescan.org';
        if (chainId === 10) domain = 'optimistic.etherscan.io';
        if (chainId === 137) domain = 'polygonscan.com';
        if (chainId === 42161) domain = 'arbiscan.io';
        return `https://${domain}/tx/${hash}`;
    }

    private async resolveNames(from: string, to: string | null, chain: number) {
        const p = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        const resolve = async (a: string) => { try { return await p.lookupAddress(a); } catch { return null; } };
        return { fromName: await resolve(from), toName: to ? await resolve(to) : null };
    }

    private getAvatar(addr: string, name: string | null) { return name ? name.slice(0, 2).toUpperCase() : addr.slice(2, 4).toUpperCase(); }

    private getRelativeTime(d: Date) {
        const diff = Date.now() - d.getTime();
        const hrs = Math.floor(diff / 36e5);
        return hrs < 24 ? `${hrs} hours ago` : `${Math.floor(hrs / 24)} days ago`;
    }

    private getEnvelopeLabel(t: number) {
        if (t === 1) return 'EIP-2930';
        if (t === 2) return 'EIP-1559';
        if (t === 3) return 'EIP-4844';
        return 'Legacy';
    }
    private async saveToDb(txHash: string, chainId: number, wallet: string, data: BillViewModel, isConfirmed: boolean) {
        // [IMPROVEMENT] Auto-create user if missing to avoid FK error
        // minimizing logs and ensuring data consistency.
        if (wallet) {
            try {
                // Try to create the user (idempotent)
                const { error } = await supabase.from('users').upsert(
                    { wallet_address: wallet, is_registered: false },
                    { onConflict: 'wallet_address', ignoreDuplicates: true } // Don't overwrite existing
                );
                if (error) console.warn('[BillService] Failed to auto-create user:', error.message);
            } catch (uErr) {
                // Ignore, proceed to save bill
            }
        }

        try {
            await this.performUpsert(txHash, chainId, wallet, data, isConfirmed);
        } catch (e: any) {
            // If it still fails (e.g. unknown chain), log and retry without wallet as last resort
            console.warn('[BillService] Save failed. Retrying without wallet linkage...', e.code);
            try {
                await this.performUpsert(txHash, chainId, null, data, isConfirmed);
            } catch (retryError) {
                console.error('[BillService] CRITICAL: Failed to save to DB cache even without wallet.', retryError);
            }
        }
    }

    private async performUpsert(txHash: string, chainId: number, wallet: string | null, data: BillViewModel, isConfirmed: boolean) {
        const payload: any = {
            tx_hash: txHash,
            chain_id: chainId,
            bill_json: data,
            status: isConfirmed ? 'COMPLETED' : 'PENDING',
            updated_at: new Date().toISOString()
        };

        // Only include wallet_address if explicitly provided and not null
        if (wallet) {
            payload.wallet_address = wallet;
        }

        const { error } = await supabase.from('bills').upsert(payload, { onConflict: 'tx_hash,chain_id' });
        if (error) throw error;
    }
    private async touchBill(txHash: string, chainId: number) {
        // Just update updated_at to now
        await supabase
            .from('bills')
            .update({ updated_at: new Date().toISOString() })
            .eq('tx_hash', txHash)
            .eq('chain_id', chainId);
    }

    private async cleanupOldBills() {
        // 1. Get Expired Confirmed Bills (updated > 30 Days ago)
        // We need them first to delete files, then delete rows.
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: expiredBills } = await supabase
            .from('bills')
            .select('tx_hash, chain_id, bill_json')
            .eq('status', 'COMPLETED')
            .lt('updated_at', thirtyDaysAgo)
            .limit(50); // Batch size to limit memory/execution time

        if (expiredBills && expiredBills.length > 0) {
            console.log(`[BillService] Cleaning up ${expiredBills.length} expired bills...`);

            const filesToDelete: string[] = [];

            // Collect Files
            for (const bill of expiredBills) {
                // We need to reconstruct Bill ID to find the file
                // Or retrieve it from bill_json if stored there.
                // BillViewModel has BILL_ID.
                const vm = bill.bill_json as BillViewModel;
                if (vm && vm.BILL_ID) {
                    filesToDelete.push(`${vm.BILL_ID}.pdf`);
                    filesToDelete.push(`${vm.BILL_ID}.json`);
                }
            }

            // Delete from Storage
            if (filesToDelete.length > 0) {
                await supabase.storage.from('receipts').remove(filesToDelete);
            }

            // Delete from DB
            // We delete by ID pair
            for (const bill of expiredBills) {
                await supabase
                    .from('bills')
                    .delete()
                    .eq('tx_hash', bill.tx_hash)
                    .eq('chain_id', bill.chain_id);
            }
        }

        // 2. Delete Unconfirmed > 24 Hours (No files usually, just DB clutter)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabase
            .from('bills')
            .delete()
            .neq('status', 'COMPLETED')
            .lt('created_at', oneDayAgo);
    }
}

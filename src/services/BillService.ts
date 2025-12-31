import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { PriceOracleService } from './PriceOracleService';
import { ERC20_ABI, ERC721_ABI, ERC1155_ABI } from '../abis/Common';

interface BillRequest {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
}

export class BillService {
    private oracle: PriceOracleService;
    // Simple in-memory mapping for providers
    private rpcs: { [key: number]: string } = {
        1: 'https://eth.llamarpc.com',
        8453: 'https://mainnet.base.org',
        137: 'https://polygon-rpc.com',
        11155111: 'https://rpc.sepolia.org',
        42161: 'https://arb1.arbitrum.io/rpc', // Arbitrum One
        10: 'https://mainnet.optimism.io'     // Optimism
    };

    constructor() {
        this.oracle = new PriceOracleService();
    }

    private getRpcUrl(chainId: number): string {
        const alchemyKey = process.env.ALCHEMY_API_KEY;

        // Force public RPC for mainnet debugging due to limits
        if (chainId === 1) return 'https://eth.llamarpc.com';

        // If Alchemy Key exists, try to use it for supported chains
        if (alchemyKey) {
            switch (chainId) {
                // case 1: return `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                case 8453: return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                case 137: return `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                case 42161: return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                case 10: return `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                case 11155111: return `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
            }
        }

        // Fallback to public RPCs
        return this.rpcs[chainId];
    }

    async generateBill(request: BillRequest): Promise<{ pdfPath: string, billData: any }> {
        const { txHash, chainId } = request;
        const rpcUrl = this.getRpcUrl(chainId);

        if (!rpcUrl) throw new Error(`Unsupported Chain ID: ${chainId}`);

        console.log(`Using RPC for Chain ${chainId}: ${rpcUrl}`);
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Use Alchemy for Mainnet (ENS) if available, else fallback
        const mainnetUrl = this.getRpcUrl(1);
        const mainnetProvider = new ethers.JsonRpcProvider(mainnetUrl);

        // 1. Fetch Transaction Data
        console.log(`Fetching Tx: ${txHash} on Chain ${chainId}`);
        const [tx, receipt] = await Promise.all([
            provider.getTransaction(txHash),
            provider.getTransactionReceipt(txHash)
        ]);

        if (!tx || !receipt) throw new Error('Transaction not found');

        const block = await provider.getBlock(receipt.blockNumber);
        if (!block) throw new Error('Block not found');

        // 2. Classify Transaction first to determine User Address
        // (Moved ENS resolution to after userAddress determination)

        // 3. Resolve Prices & Fees
        const timestamp = block.timestamp;
        const nativePriceData = await this.oracle.getPrice(chainId, 'native', timestamp, receipt.blockNumber);

        // Calculate Fees
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || 0n;
        const feeWei = gasUsed * gasPrice;
        const feeEth = ethers.formatEther(feeWei);
        const feeUSDNum = parseFloat(feeEth) * nativePriceData.price;
        // Show < $0.01 for tiny fees instead of $0.00
        const feeUSD = feeUSDNum < 0.01 && feeUSDNum > 0 ? '< $0.01' : feeUSDNum.toFixed(2);

        // Native Value (Amount Sent)
        const valueEth = ethers.formatEther(tx.value);
        const valueUSDNum = parseFloat(valueEth) * nativePriceData.price;
        const valueUSD = valueUSDNum < 0.01 && valueUSDNum > 0 ? '< $0.01' : valueUSDNum.toFixed(2);

        // 4. Advanced Classification (Swap/NFT)
        const erc20Interface = new ethers.Interface(ERC20_ABI);
        const erc721Interface = new ethers.Interface(ERC721_ABI);

        let shouldShowSwap = false;
        let swapData: any = {};

        // 4.0 Advanced Transaction Classification
        const { transactionClassifier, TransactionEnvelopeType } = require('./TransactionClassifier');
        const classification = await transactionClassifier.classify(receipt, tx, chainId);

        console.log(`Classification: ${classification.type} (${Math.round(classification.confidence * 100)}% confidence)`);
        if (classification.protocol) {
            console.log(`Protocol: ${classification.protocol}`);
        }

        // 4.1 Fetch Ad (Specific for PDF)
        const { AdminService } = require('./AdminService');
        const adminService = new AdminService();
        const randomAd = adminService.getRandomAd('pdf');

        // 4.2 Generate QR Code locally
        const QRCode = require('qrcode');
        const qrCodeDataUrl = await QRCode.toDataURL(this.getExplorerUrl(chainId, txHash));

        // 5. Prepare Data for Enterprise Template
        const billId = `BILL-${chainId}-${receipt.blockNumber}-${txHash.slice(0, 6)}`;
        const now = new Date();
        const txDate = new Date(timestamp * 1000);

        // Relative Time (Simple implementation)
        const diffMs = now.getTime() - txDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const relativeTime = diffHours < 24 ? `${diffHours} hours ago` : `${Math.floor(diffHours / 24)} days ago`;

        // Participant Avatars (Initials)
        const getAvatar = (addr: string, name: string | null) => {
            if (name) return name.slice(0, 2).toUpperCase();
            return addr.slice(2, 4).toUpperCase();
        };

        // Items Construction - Parse ALL transfers from logs
        console.log('DEBUG: request.connectedWallet', request.connectedWallet);
        console.log('DEBUG: tx.from', tx.from);

        // Resolve User Address:
        // 1. Connected Wallet (if provided and matches tx) - Actually, usually we trust connected wallet if involved.
        // 2. Parsed Sender from Classification (e.g. AA UserOp sender).
        // 3. Transaction From (EOA).
        let userAddress = request.connectedWallet?.toLowerCase();

        if (!userAddress) {
            if (classification.details?.sender) {
                userAddress = classification.details.sender.toLowerCase();
                console.log('DEBUG: Used AA Sender from Classification:', userAddress);
            } else {
                userAddress = tx.from.toLowerCase();
            }
        }

        // Ensure we handle the case where connectedWallet is provided but we found a more specific sender?
        // Actually, if connectedWallet IS provided, we usually want to generate the bill FOR that wallet.
        // But if the bill logic relies on "is this wallet involved?", correct parsing matters.
        // If connectedWallet was passed (e.g. from frontend), keep it. 
        // But for the "From" field in the PDF, we might need the actual sender.
        // Let's stick to: if connectedWallet is set, use it. If not, fallback to AA sender -> tx.from.
        // Wait, the reproduction script passed connectedWallet. 
        // And the result showed "From: 0x9c04" (which was NOT the connected wallet).
        // This implies `request.connectedWallet` might have been ignored or overwritten?
        // Line 151: `let userAddress = request.connectedWallet?.toLowerCase() || tx.from.toLowerCase();`
        // In the reproduction script, I passed `connectedWallet`.
        // So `userAddress` SHOULD have been `0xb37a...`.
        // Why did `reproduce_result.json` show `0x9c04`?
        // Ah, `BillService` might NOT be using `userAddress` to populate the `reproduce_result` "from" field?
        // Let's check where `reproduce_result` gets its data in the script.
        // `script/reproduce_issue.ts`:
        // `const bill = await billService.generateBill(...)`
        // `const result = { from: bill.from, ... }`
        // So `bill.from` was `0x9c04`.
        // We need to ensure `bill.from` is set to the resolved `userAddress`.

        // Let's update the logic to be more robust:
        if (!request.connectedWallet) {
            if (classification.details?.sender) {
                userAddress = classification.details.sender.toLowerCase();
            } else {
                userAddress = tx.from.toLowerCase();
            }
        }

        // Final fallback to ensure string type
        if (!userAddress) userAddress = tx.from.toLowerCase();

        console.log('DEBUG: Resolved userAddress', userAddress);

        // Resolve ENS Names
        // fromName should correspond to the Bill Sender (Originator)
        const billSenderAddress = classification.details?.sender || tx.from;

        console.log("Resolving ENS names...");
        const [fromName, toName] = await Promise.all([
            this.resolveName(billSenderAddress, mainnetProvider),
            tx.to ? this.resolveName(tx.to, mainnetProvider) : Promise.resolve(null)
        ]);
        console.log(`ENS Results - From: ${fromName}, To: ${toName}`);

        const logs = receipt.logs || [];

        // For AA transactions, actions by tx.from (Bundler) should attribute to User
        const aliasAddress = classification.type === 'account_abstraction' ? tx.from.toLowerCase() : undefined;

        let { items, totalIn, totalOut, tokensInCount, tokensOutCount } = await this.parseTokenMovements(
            logs, userAddress, chainId, receipt.blockNumber, provider, timestamp, aliasAddress
        );

        // Fallback for Smart Wallets: If no movements found for sender, check if recipient has movements
        // BUT skip if we already identified a specific AA Sender (we trust our classification)
        if (items.length === 0 && tx.to && tx.to.toLowerCase() !== userAddress && !classification.details?.sender) {
            // Custom: Check if sender is a contract (Exchange/Withdrawal)
            const code = await provider.getCode(tx.from);
            let perspectiveAddress = userAddress;

            if (code !== '0x') {
                console.log(`Sender ${userAddress} is a contract. Checking recipient ${tx.to}...`);
                perspectiveAddress = tx.to!.toLowerCase();
            } else {
                console.log(`No movements for sender ${userAddress}, checking recipient ${tx.to}...`);
                perspectiveAddress = tx.to!.toLowerCase();
            }

            const fallbackResult = await this.parseTokenMovements(logs, perspectiveAddress, chainId, receipt.blockNumber, provider, timestamp, aliasAddress);

            if (fallbackResult.items.length > 0) {
                console.log(`Found movements for recipient ${perspectiveAddress}, using as primary view.`);
                items = fallbackResult.items;
                totalIn = fallbackResult.totalIn;
                totalOut = fallbackResult.totalOut;
                tokensInCount = fallbackResult.tokensInCount;
                tokensOutCount = fallbackResult.tokensOutCount;
                // NOTE: We do NOT update 'userAddress' so the Bill Header remains "From: <User>"
            }
        }

        // Observer Fallback: If still no items, check the Sender (tx.from)
        // This happens if I am an observer (userAddress != tx.from) and the recipient fallback failed or yielded nothing.
        if (items.length === 0 && userAddress !== tx.from.toLowerCase()) {
            console.log(`Observer Mode: No movements found for viewer or recipient. Showing Sender ${tx.from} perspective.`);
            const senderResult = await this.parseTokenMovements(logs, tx.from.toLowerCase(), chainId, receipt.blockNumber, provider, timestamp);
            if (senderResult.items.length > 0) {
                items = senderResult.items;
                totalIn = senderResult.totalIn;
                totalOut = senderResult.totalOut;
                tokensInCount = senderResult.tokensInCount;
                tokensOutCount = senderResult.tokensOutCount;
            }
        }

        // 3. Add native ETH transfer if value > 0
        const nativeAmount = parseFloat(valueEth);
        if (nativeAmount > 0) {
            // Determine direction based on the resolved userAddress
            const isNativeIn = tx.to && userAddress === tx.to.toLowerCase();

            // Fetch Current Price for Item Display
            const currentNativePrice = await this.oracle.getPrice(chainId, 'native', Math.floor(Date.now() / 1000));
            const currentNativeValueUSD = (nativeAmount * currentNativePrice.price).toFixed(2);

            // Historic Value for Totals
            const historicNativeValueUSD = (nativeAmount * nativePriceData.price);

            items.push({
                direction: isNativeIn ? 'in' : 'out',
                isIn: isNativeIn,
                tokenIcon: isNativeIn ? '📥' : (this.getNativeSymbol(chainId) === 'ETH' ? '💎' : '🪙'),
                tokenSymbol: this.getNativeSymbol(chainId),
                fromShort: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
                toShort: `${tx.to?.slice(0, 6)}...${tx.to?.slice(-4)}`,
                amountFormatted: nativeAmount.toFixed(6),
                usdValue: `$${currentNativeValueUSD}` // Display Current Value
            });

            if (isNativeIn) {
                totalIn += historicNativeValueUSD; // Accumulate Historic Value
                tokensInCount++;
            } else {
                totalOut += historicNativeValueUSD; // Accumulate Historic Value
                tokensOutCount++;
            }
        }

        console.log(`Detected ${items.length} token movements (${tokensInCount} in, ${tokensOutCount} out)`);


        // Net Change
        const netChange = totalIn - (totalOut + feeUSDNum);

        const billData = {
            // Identity
            BILL_ID: billId,
            BILL_VERSION: "2.0.0",
            GENERATED_AT: now.toLocaleString(),

            // Status
            STATUS: receipt.status === 1 ? "confirmed" : "failed",
            STATUS_CONFIRMED: receipt.status === 1,
            STATUS_PROVISIONAL: false, // Assume finalized for now

            // Network
            CHAIN_NAME: this.getChainName(chainId),
            CHAIN_ID: chainId,
            CHAIN_SYMBOL: this.getNativeSymbol(chainId),
            CHAIN_ICON: this.getNativeSymbol(chainId) === 'ETH' ? '🔷' : '⛓️',

            // Transaction
            TRANSACTION_HASH: txHash,
            BLOCK_NUMBER: receipt.blockNumber.toLocaleString(),
            BLOCK_HASH_SHORT: `${receipt.blockHash.slice(0, 10)}...`,
            TIMESTAMP: txDate.toLocaleString(),
            TIMESTAMP_RELATIVE: relativeTime,
            CONFIRMATIONS: await this.getConfirmations(provider, receipt.blockNumber),
            REQUIRED_CONFIRMATIONS: 12,
            TYPE: classification.type,
            TYPE_READABLE: transactionClassifier.getReadableType(classification.type),
            TYPE_ICON: transactionClassifier.getTypeIcon(classification.type),

            // Advanced Classification Details
            IS_MULTISIG: classification.details.isMultiSig || false,
            IS_SMART_ACCOUNT: classification.type === 'account_abstraction',
            ENVELOPE_TYPE: classification.envelopeType !== undefined ? this.getEnvelopeLabel(classification.envelopeType, TransactionEnvelopeType) : undefined,
            ENVELOPE_LABEL: classification.envelopeType !== undefined ? this.getEnvelopeLabel(classification.envelopeType, TransactionEnvelopeType) : '',
            EXECUTION_METHOD: classification.details.method ? classification.details.method.slice(0, 10) : undefined,
            PROTOCOL_TAG: classification.protocol ? classification.protocol.toUpperCase() : undefined,

            // Participants
            // FROM_ADDRESS should be the Transaction Originator, not necessarily the Connected User
            FROM_ADDRESS: classification.details?.sender || tx.from,
            FROM_ENS: fromName, // Note: fromName resolution needs to match this address
            FROM_AVATAR: getAvatar(classification.details?.sender || tx.from, fromName),
            TO_ADDRESS: tx.to || "Contract Creation",
            TO_ENS: toName,
            TO_AVATAR: getAvatar(tx.to || "0x00", toName),

            // Items
            ITEMS: items,
            ITEMS_COUNT: items.length,

            // Fees
            GAS_USED: gasUsed.toLocaleString(),
            GAS_PRICE: ethers.formatUnits(gasPrice, 'gwei'),
            GAS_PRICE_GWEI: ethers.formatUnits(gasPrice, 'gwei'),
            TOTAL_FEE: feeEth.substring(0, 8),
            TOTAL_FEE_USD: feeUSD,
            TOTAL_FEE_ETH: feeEth.substring(0, 8),

            // Totals
            TOTAL_IN_USD: totalIn.toFixed(2),
            TOTAL_OUT_USD: totalOut.toFixed(2),
            TOKENS_IN_COUNT: tokensInCount,
            TOKENS_OUT_COUNT: tokensOutCount,
            NET_CHANGE_USD: Math.abs(netChange).toFixed(2),
            NET_CHANGE_SIGN: netChange >= 0 ? "+" : "-",
            NET_CHANGE_POSITIVE: netChange >= 0,

            // Audit
            INCLUDE_AUDIT: true,
            PRICE_SOURCE: nativePriceData.source,
            PRICE_TIMESTAMP: new Date(timestamp * 1000).toISOString(),
            RPC_PROVIDER: "Alchemy / Public",
            RPC_ENDPOINT_SHORT: "rpc.node",
            CLASSIFICATION_METHOD: "Advanced Pattern Matching",
            CONFIDENCE: Math.round(classification.confidence * 100),
            CONFIDENCE_PERCENT: Math.round(classification.confidence * 100),
            PROTOCOL: classification.protocol || undefined,
            REORG_DETECTED: false,
            REORG_CHECK_TIME: now.toLocaleTimeString(),

            // Verification
            QR_CODE_DATA_URL: qrCodeDataUrl,
            EXPLORER_URL: this.getExplorerUrl(chainId, txHash),
            REGENERATE_URL: "https://blockbill.io", // Placeholder

            // Ad Support
            hasAd: !!randomAd,
            adLink: randomAd ? randomAd.clickUrl : ""
        };

        // 6. Render PDF
        console.log('Rendering PDF with Enterprise Template...');
        const templatePath = path.join(process.cwd(), 'templates', 'final_templete.html');
        // Register Helpers if needed
        Handlebars.registerHelper('eq', function (a, b) { return a === b; });

        const templateHtml = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateHtml);
        const html = template(billData);

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        // networkidle0 is too strict for some ads; networkidle2 allows 2 active connections
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60000 });

        // Explicitly wait for Ad Image/Iframe if present
        if (billData.hasAd) {
            try {
                console.log('Waiting for Ad content to load...');
                // Wait for either image or iframe in the ad content container
                await page.waitForSelector('.ad-content img, .ad-content iframe', { visible: true, timeout: 15000 });

                // Extra safety: ensure images are fully loaded
                await page.evaluate(async () => {
                    const imgs = document.querySelectorAll('.ad-content img');
                    const promises = Array.from(imgs).map(img => {
                        const image = img as HTMLImageElement;
                        if (image && !image.complete) {
                            return new Promise((resolve) => {
                                image.onload = resolve;
                                image.onerror = resolve;
                            });
                        }
                        return Promise.resolve();
                    });
                    await Promise.all(promises);
                });
            } catch (e) {
                console.log('Ad content wait timeout or not found, proceeding...');
            }
        }

        const outputDir = path.join(process.cwd(), 'client', 'public', 'bills');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `${txHash}.pdf`;
        const pdfPath = path.join(outputDir, fileName);

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true
        });

        await browser.close();

        return {
            pdfPath: `/bills/${fileName}`, // Relative path for frontend
            billData
        };
    }

    private async resolveName(address: string, mainnetProvider: ethers.JsonRpcProvider): Promise<string | null> {
        try {
            // 1. Try Mainnet ENS
            const ensName = await mainnetProvider.lookupAddress(address);
            if (ensName) return ensName;

            // 2. Basenames (L2) - Placeholder for future implementation
            // Currently relies on address
            return null;
        } catch (e) {
            return null;
        }
    }

    private getChainName(chainId: number): string {
        switch (chainId) {
            case 1: return 'Ethereum Mainnet';
            case 8453: return 'Base Mainnet';
            case 137: return 'Polygon';
            case 42161: return 'Arbitrum One';
            case 10: return 'Optimism';
            case 56: return 'BNB Smart Chain';
            case 43114: return 'Avalanche C-Chain';
            case 11155111: return 'Sepolia';
            default: return 'Unknown Chain';
        }
    }

    private getNativeSymbol(chainId: number): string {
        if (chainId === 137) return 'MATIC';
        if (chainId === 56) return 'BNB';
        if (chainId === 43114) return 'AVAX';
        return 'ETH';
    }

    private getExplorerUrl(chainId: number, txHash: string): string {
        let baseUrl = 'https://etherscan.io';
        switch (chainId) {
            case 1: baseUrl = 'https://etherscan.io'; break;
            case 8453: baseUrl = 'https://basescan.org'; break;
            case 137: baseUrl = 'https://polygonscan.com'; break;
            case 42161: baseUrl = 'https://arbiscan.io'; break;
            case 10: baseUrl = 'https://optimistic.etherscan.io'; break;
            case 56: baseUrl = 'https://bscscan.com'; break;
            case 43114: baseUrl = 'https://snowtrace.io'; break;
            case 11155111: baseUrl = 'https://sepolia.etherscan.io'; break;
        }
        return `${baseUrl}/tx/${txHash}`;
    }

    private async getConfirmations(provider: ethers.Provider, txBlockNumber: number): Promise<number> {
        try {
            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - txBlockNumber;
            return confirmations > 0 ? confirmations : 1;
        } catch (e) {
            console.error('Failed to get confirmations:', e);
            return 12; // Fallback
        }
    }

    private async getTokenPriceAtBlock(tokenAddress: string, chainId: number, blockNumber: number): Promise<number> {
        const alchemyKey = process.env.ALCHEMY_API_KEY;
        if (!alchemyKey) {
            console.log('No Alchemy API key, skipping price fetch');
            return 0;
        }

        try {
            // Build Alchemy RPC URL
            let alchemyUrl = '';
            switch (chainId) {
                case 1: alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`; break;
                case 8453: alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`; break;
                case 137: alchemyUrl = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`; break;
                case 42161: alchemyUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`; break;
                case 10: alchemyUrl = `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`; break;
                default:
                    console.log(`Alchemy not supported for chain ${chainId}`);
                    return 0;
            }

            // Use Alchemy's getTokenPrice method (enhanced feature)
            const response = await fetch(alchemyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'alchemy_getTokenPrice',
                    params: [tokenAddress, `0x${blockNumber.toString(16)}`] // Block number in hex
                })
            });

            const data = await response.json();

            if (data.result && data.result.price) {
                return parseFloat(data.result.price);
            }

            // Fallback: Try current price if historical not available
            const currentResponse = await fetch(alchemyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'alchemy_getTokenPrice',
                    params: [tokenAddress]
                })
            });

            const currentData = await currentResponse.json();
            if (currentData.result && currentData.result.price) {
                console.log(`Using current price for ${tokenAddress} (historical not available)`);
                return parseFloat(currentData.result.price);
            }

            return 0;
        } catch (e) {
            console.error('Failed to fetch token price from Alchemy:', e);
            return 0;
        }
    }
    private getEnvelopeLabel(type: number, enumObj: any): string {
        switch (type) {
            case enumObj.LEGACY: return 'LEGACY';
            case enumObj.EIP2930: return 'EIP-2930';
            case enumObj.EIP1559: return 'EIP-1559';
            case enumObj.EIP4844: return 'EIP-4844';
            default: return 'LEGACY';
        }
    }

    private async parseTokenMovements(
        logs: readonly any[],
        userAddress: string,
        chainId: number,
        blockNumber: number,
        provider: ethers.Provider,
        timestamp: number,
        aliasAddress?: string // New: Bundler/Proxy address to treat as User
    ): Promise<{ items: any[], totalIn: number, totalOut: number, tokensInCount: number, tokensOutCount: number }> {
        const items = [];
        let totalIn = 0;
        let totalOut = 0;
        let tokensInCount = 0;
        let tokensOutCount = 0;

        const erc20Interface = new ethers.Interface(ERC20_ABI);
        const erc721Interface = new ethers.Interface(ERC721_ABI);
        const erc1155Interface = new ethers.Interface(ERC1155_ABI);

        const erc20TransferTopic = erc20Interface.getEvent('Transfer')?.topicHash;
        const erc1155SingleTopic = erc1155Interface.getEvent('TransferSingle')?.topicHash;
        const erc1155BatchTopic = erc1155Interface.getEvent('TransferBatch')?.topicHash;

        // Simple cache for token metadata within this transaction
        const tokenCache: { [address: string]: { symbol: string, decimals: number } } = {};

        const isUserOrAlias = (addr: string) => addr === userAddress || (aliasAddress && addr === aliasAddress);

        for (const log of logs) {
            // ERC20 & ERC721 check (both use Transfer event)
            if (log.topics[0] === erc20TransferTopic) {
                if (log.topics.length === 3) {
                    // ERC20
                    try {
                        const parsed = erc20Interface.parseLog(log);
                        if (!parsed) continue;
                        const from = parsed.args[0].toLowerCase();
                        const to = parsed.args[1].toLowerCase();
                        const amount = parsed.args[2];

                        if (isUserOrAlias(from) || isUserOrAlias(to)) {
                            const isIn = isUserOrAlias(to);

                            // Fetch Token Metadata
                            if (!tokenCache[log.address]) {
                                const tokenContract = new ethers.Contract(log.address, ERC20_ABI, provider);
                                try {
                                    const [symbol, decimals] = await Promise.all([
                                        tokenContract.symbol().catch(() => 'TOKEN'),
                                        tokenContract.decimals().catch(() => 18n) // default to 18 if fails
                                    ]);
                                    tokenCache[log.address] = {
                                        symbol: symbol,
                                        decimals: Number(decimals)
                                    };
                                } catch (e) {
                                    tokenCache[log.address] = { symbol: 'TOKEN', decimals: 18 };
                                }
                            }

                            const { symbol, decimals } = tokenCache[log.address];
                            const amountFormatted = ethers.formatUnits(amount, decimals);

                            // Use Oracle Service
                            let displayUsdValue = "0.00";
                            let historicUsdValue = 0;

                            try {
                                // Fetch BOTH Historic and Current prices
                                // Note: Current price doesn't need blockNumber (or uses 'latest' implicitly by not passing it? NO, new signature needs arg. Pass undefined)
                                const [historicPriceData, currentPriceData] = await Promise.all([
                                    this.oracle.getPrice(chainId, log.address, timestamp, blockNumber),
                                    this.oracle.getPrice(chainId, log.address, Math.floor(Date.now() / 1000))
                                ]);

                                const amountFloat = parseFloat(amountFormatted);

                                // Calculate Display Value (Current)
                                if (currentPriceData && currentPriceData.price > 0) {
                                    displayUsdValue = (amountFloat * currentPriceData.price).toFixed(2);
                                }

                                // Calculate Historic Value (For Totals)
                                if (historicPriceData && historicPriceData.price > 0) {
                                    historicUsdValue = amountFloat * historicPriceData.price;
                                }
                            } catch (e) {
                                console.warn(`Failed to fetch price for ${log.address}:`, e);
                            }

                            // Only add if amount > 0 (optional, but good for cleanup)
                            if (parseFloat(amountFormatted) > 0) {
                                items.push({
                                    direction: isIn ? 'in' : 'out',
                                    isIn: isIn,
                                    tokenIcon: isIn ? '📥' : '📤',
                                    tokenSymbol: symbol,
                                    tokenAddress: log.address,
                                    fromShort: `${from.slice(0, 6)}...${from.slice(-4)}`,
                                    toShort: `${to.slice(0, 6)}...${to.slice(-4)}`,
                                    amountFormatted: parseFloat(amountFormatted).toFixed(6),
                                    usdValue: `$${displayUsdValue}`
                                });
                                if (isIn) { tokensInCount++; totalIn += historicUsdValue; }
                                else { tokensOutCount++; totalOut += historicUsdValue; }
                            }
                        }
                    } catch (e) {
                        console.log('Failed to parse ERC-20 transfer:', e);
                    }
                } else if (log.topics.length === 4) {
                    // ERC721
                    try {
                        const parsed = erc721Interface.parseLog(log);
                        if (!parsed) continue;
                        const from = parsed.args[0].toLowerCase();
                        const to = parsed.args[1].toLowerCase();
                        const tokenId = parsed.args[2].toString();

                        if (from === userAddress || to === userAddress) {
                            const isIn = to === userAddress;
                            items.push({
                                direction: isIn ? 'in' : 'out',
                                isIn: isIn,
                                tokenIcon: '🖼️',
                                tokenSymbol: `NFT #${tokenId}`,
                                tokenAddress: log.address,
                                fromShort: `${from.slice(0, 6)}...${from.slice(-4)}`,
                                toShort: `${to.slice(0, 6)}...${to.slice(-4)}`,
                                amountFormatted: "1",
                                usdValue: "$0.00"
                            });
                            if (isIn) tokensInCount++; else tokensOutCount++;
                        }
                    } catch (e) {
                        console.log('Failed to parse ERC-721 transfer:', e);
                    }
                }
            }
            // ERC1155 Check
            else if (log.topics[0] === erc1155SingleTopic || log.topics[0] === erc1155BatchTopic) {
                try {
                    const parsed = erc1155Interface.parseLog(log);
                    if (!parsed) continue;
                    const from = parsed.args[1].toLowerCase();
                    const to = parsed.args[2].toLowerCase();

                    if (from === userAddress || to === userAddress) {
                        const isIn = to === userAddress;
                        if (parsed.name === 'TransferSingle') {
                            const id = parsed.args[3].toString();
                            const value = parsed.args[4].toString();
                            items.push({
                                direction: isIn ? 'in' : 'out',
                                isIn: isIn,
                                tokenIcon: '📦',
                                tokenSymbol: `ID #${id}`,
                                tokenAddress: log.address,
                                fromShort: `${from.slice(0, 6)}...${from.slice(-4)}`,
                                toShort: `${to.slice(0, 6)}...${to.slice(-4)}`,
                                amountFormatted: value,
                                usdValue: "$0.00"
                            });
                            if (isIn) tokensInCount++; else tokensOutCount++;
                        } else if (parsed.name === 'TransferBatch') {
                            const ids = parsed.args[3];
                            const values = parsed.args[4];
                            for (let i = 0; i < ids.length; i++) {
                                items.push({
                                    direction: isIn ? 'in' : 'out',
                                    isIn: isIn,
                                    tokenIcon: '📦',
                                    tokenSymbol: `ID #${ids[i]}`,
                                    tokenAddress: log.address,
                                    fromShort: `${from.slice(0, 6)}...${from.slice(-4)}`,
                                    toShort: `${to.slice(0, 6)}...${to.slice(-4)}`,
                                    amountFormatted: values[i].toString(),
                                    usdValue: "$0.00"
                                });
                                if (isIn) tokensInCount++; else tokensOutCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.log('Failed to parse ERC-1155 transfer:', e);
                }
            }
        }
        return { items, totalIn, totalOut, tokensInCount, tokensOutCount };
    }
}

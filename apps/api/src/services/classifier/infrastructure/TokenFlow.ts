// src/services/classifier/infrastructure/TokenFlow.ts
import { Log, Address, TokenFlow, TokenMovement, FlowRole } from '../core/types';
import { Decoder } from '../utils';

// Minimum significant value to track (Wei)
// 1000 Wei is negligible for flow analysis but filters dust attacks/spam
const DUST_THRESHOLD = BigInt(1000);

export class TokenFlowAnalyzer {

    /**
     * Pure, Deterministic Token Flow Construction
     * 
     * @param logs Transaction Logs
     * @param nativeValue Top-level Transaction Value
     * @param from Transaction Sender (User)
     * @param to Transaction Target
     * @param internalTransactions Internal Trace Data (for Native Transfers)
     */
    static analyze(
        logs: Log[],
        nativeValue: string,
        from: Address,
        to: Address | null,
        internalTransactions: any[] = []
    ): TokenFlow {
        const flow: TokenFlow = {};
        const user = from.toLowerCase();

        // Helper to ensure address entry exists
        const record = (addr: Address) => {
            const normalized = addr.toLowerCase();
            if (!flow[normalized]) {
                flow[normalized] = { incoming: [], outgoing: [] };
            }
            return normalized;
        };

        // Helper to Create Movement with Role
        const addMovement = (
            asset: Address,
            amountVal: bigint,
            type: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155',
            sender: Address,
            receiver: Address,
            tokenId?: string
        ) => {
            // Dust Filter
            if (amountVal <= DUST_THRESHOLD) return;

            const normalizedSender = record(sender);
            const normalizedReceiver = record(receiver);

            // Determine Role relative to USER (tx.from)
            let role: FlowRole = 'UNKNOWN';

            if (normalizedSender === user) {
                role = 'USER_OUT';
            } else if (normalizedReceiver === user) {
                role = 'USER_IN';
            } else {
                // Protocol to Protocol or Third Party
                role = 'PROTOCOL_IN'; // Needs refinement? 
                // Using generic 'PROTOCOL' for non-user flows.
                // Or check if sender/receiver are contracts?
                // Simplification: If not user, it's external.
                // We'll map 'PROTOCOL_IN' (Received by non-user) ??
                // Let's stick to simple logic:
                // If it's not User, it's Protocol/Other.
                // Determining "IN" vs "OUT" for a third party needs a subject.
                // For the "Movement" object, 'role' usually describes the User's relationship?
                // OR the movement's nature? 
                // User Request: "If from === user -> USER_OUT ... Else -> PROTOCOL_IN / PROTOCOL_OUT"
                // It's ambiguous which one. 
                // Let's assume:
                // If Sender != User AND Receiver != User -> It's a Protocol-internal move (e.g. Swap router to Pool).
                // We will label it 'PROTOCOL_IN' for consistency with "Received by someone strictly".
                // Actually, let's use 'UNKNOWN' for 3rd party?? 
                // User said: "Else -> PROTOCOL_IN / PROTOCOL_OUT".
                // I will use 'PROTOCOL_IN' as default for "Protocol Received".
                role = 'PROTOCOL_IN';
            }

            // Correction: "PROTOCOL_OUT" if Sender is Protocol?
            // If Sender != User (Protocol sent), and Receiver != User (Protocol received).
            // It's Protocol -> Protocol.
            // Let's refine:
            if (normalizedSender !== user && normalizedReceiver !== user) {
                // Determine if one is a known "Protocol"? Hard without config.
                // Use 'PROTOCOL_IN' (Receiver centric)
            }


            const movement: TokenMovement = {
                asset: asset.toLowerCase(),
                amount: amountVal.toString(),
                type,
                tokenId,
                from: normalizedSender,
                to: normalizedReceiver,
                role
            };

            flow[normalizedSender].outgoing.push(movement);
            flow[normalizedReceiver].incoming.push(movement);
        };

        // 1. Top-Level Native Transfer
        // Exclude Gas: The 'nativeValue' passed in IS the `value` field of tx.
        // Gas is paid separately. So this IS the transferred value.
        // We only process if > 0.
        try {
            const val = BigInt(nativeValue);
            if (val > BigInt(0) && to) {
                addMovement('native', val, 'NATIVE', from, to);
            }
        } catch (e) { /* Ignore invalid value */ }

        // 2. Internal Transactions (Native)
        for (const itx of internalTransactions) {
            try {
                const val = BigInt(itx.value || '0');
                if (val > BigInt(0) && itx.to && itx.from) {
                    addMovement('native', val, 'NATIVE', itx.from, itx.to);
                }
            } catch (e) { /* Ignore */ }
        }

        // 3. Process Logs
        for (const log of logs) {
            const logAddr = log.address;

            // ERC20 Transfer
            const erc20 = Decoder.decodeERC20Transfer(log);
            if (erc20) {
                addMovement(logAddr, BigInt(erc20.args[2].toString()), 'ERC20', erc20.args[0], erc20.args[1]);
                continue;
            }

            // ERC721 Transfer (Single)
            const erc721 = Decoder.decodeERC721Transfer(log);
            if (erc721) {
                // Fixed Amount 1
                addMovement(logAddr, BigInt(1), 'ERC721', erc721.args[0], erc721.args[1], erc721.args[2].toString());
                continue;
            }

            // ERC1155 TransferSingle
            const erc1155Single = Decoder.decodeERC1155TransferSingle(log);
            if (erc1155Single) {
                // operator, from, to, id, value
                const id = erc1155Single.args[3].toString();
                const val = BigInt(erc1155Single.args[4].toString());
                addMovement(logAddr, val, 'ERC1155', erc1155Single.args[1], erc1155Single.args[2], id);
                continue;
            }

            // ERC1155 TransferBatch (Split)
            const erc1155Batch = Decoder.decodeERC1155TransferBatch(log);
            if (erc1155Batch) {
                // operator, from, to, ids[], values[]
                const ids = erc1155Batch.args[3];
                const values = erc1155Batch.args[4];
                const fromArg = erc1155Batch.args[1];
                const toArg = erc1155Batch.args[2];

                if (Array.isArray(ids) && Array.isArray(values) && ids.length === values.length) {
                    for (let i = 0; i < ids.length; i++) {
                        addMovement(logAddr, BigInt(values[i].toString()), 'ERC1155', fromArg, toArg, ids[i].toString());
                    }
                }
                continue;
            }
        }

        return flow;
    }
}

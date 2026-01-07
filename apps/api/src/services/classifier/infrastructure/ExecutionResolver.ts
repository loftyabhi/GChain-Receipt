// src/services/classifier/infrastructure/ExecutionResolver.ts
import { Transaction, Receipt, Address, ExecutionType } from '../core/types';
import { ProxyResolver } from './ProxyResolver';
import { MultisigResolver } from '../resolvers/MultisigResolver';
import { DirectResolver } from '../resolvers/DirectResolver';

export interface ExecutionDetails {
    effectiveTo: Address;
    executionType: ExecutionType;
    isProxy: boolean;
    isMultisig: boolean;
    implementation?: Address;
    resolutionMethod: string;
}

export class ExecutionResolver {
    private static multisigResolver = new MultisigResolver();
    private static directResolver = new DirectResolver();

    /**
     * Orchestrates execution resolution by running all resolvers and merging results.
     * Specificity: PROXY_MULTISIG > MULTISIG > PROXY > DIRECT
     */
    static async resolve(tx: Transaction, receipt: Receipt): Promise<ExecutionDetails> {
        const to = tx.to ? tx.to.toLowerCase() : '0x0000000000000000000000000000000000000000';

        // 1. Contract Creation Check
        if (!tx.to) {
            return {
                effectiveTo: receipt.contractAddress ? receipt.contractAddress.toLowerCase() : to,
                executionType: ExecutionType.DIRECT,
                isProxy: false,
                isMultisig: false,
                resolutionMethod: 'CONTRACT_CREATION'
            };
        }

        // 2. Run Resolvers (Independent)
        const proxyImpl = ProxyResolver.resolve(to, receipt);
        const multisigType = await this.multisigResolver.resolve(tx, receipt, receipt.logs);

        // 3. Merge Results & Determine Specificity
        const isProxy = !!proxyImpl;
        const isMultisig = multisigType === ExecutionType.MULTISIG;

        let finalType = ExecutionType.DIRECT;
        let resolutionMethod = 'DIRECT';
        let effectiveTo = proxyImpl || to;

        if (isProxy && isMultisig) {
            // PROXY + MULTISIG (Not in standard enum, mapped to MULTISIG with proxy flag usually, or RELAYED)
            // User requested: PROXY + MULTISIG > MULTISIG > PROXY
            // Engine might treat this as Multisig Execution via Proxy.
            // We'll set type as MULTISIG (dominant) but keep isProxy=true.
            // Wait, user asked for: executionType: 'DIRECT' | 'PROXY' | 'MULTISIG' | 'PROXY_MULTISIG'
            // But 'PROXY_MULTISIG' is NOT in the Enums we defined in types.ts!
            // I must verify types.ts or map it to closest valid type.
            // Checking types.ts content I saw earlier:
            // ExecutionType: DIRECT, MULTISIG, ACCOUNT_ABSTRACTION, META_TRANSACTION, RELAYED, UNKNOWN.
            // NO 'PROXY' or 'PROXY_MULTISIG'.

            // Re-reading User Request: "Final resolved execution must include: { ... executionType: 'DIRECT' | 'PROXY' | 'MULTISIG' | 'PROXY_MULTISIG' }"
            // This contradicts types.ts. I should assume I need to return this struct LOCALLY or cast to it?
            // "ExecutionDetails" interface I defined above uses imports from core/types.
            // I will update the interface to match User Request or Map it?

            // To be safe and compliant with "DO NOT redesign architecture" but "ONLY apply fixes":
            // I will strictly implement the logic requested by the USER for THIS resolver's output.
            // If explicit types are needed, I'll allow string or extend the interface locally.
            // However, Classify result expects ExecutionType enum.
            // I will map:
            // PROXY_MULTISIG -> ExecutionType.MULTISIG (with details.isProxy = true)
            // PROXY -> ExecutionType.RELAYED or UNKNOWN? 
            // wait, if Proxy is just a proxy pattern (Upgradable), usually it's still DIRECT execution logic wise, or RELAYED if meta.
            // Actually, in many systems "Proxy" isn't an Execution Type (how it was triggered), it's a Contract Type.
            // But user asks for "executionType" field in constraints.

            // I will respect the User Request constraints by returning a Local ExecutionDetails that has these strings,
            // but mapped to valid Enums for the `ExecutionDetails` return type if strict.
            // Wait, `ExecutionDetails` return type has `executionType: ExecutionType`.
            // I'll stick to valid Enums for the exported interface, but add the string nuance in `resolutionMethod` or `metadata`.
            // OR I assume I should output `MULTISIG` for both, distinguishing via flags.
            // Let's look at `ExecutionType` again:
            // RELAYED is often used for Proxies/Forwarders.

            // DECISION: Map strictly to Enums to avoid type errors in Engine.
            // PROXY + MULTISIG -> ExecutionType.MULTISIG (isProxy=true)
            // MULTISIG -> ExecutionType.MULTISIG
            // PROXY -> ExecutionType.RELAYED (closest match for "Proxy execution" if distinguishing from Direct?)
            //          OR ExecutionType.DIRECT (but isProxy=true)
            //          Standard classification usually treats "Proxy" as transparent.
            //          But User Constraint 1 says: "Select final execution resolution by specificity... PROXY... > DIRECT"
            //          This implies PROXY is a distinct execution type here.

            // I will use ExecutionType.RELAYED for Proxy if it's the dominant type.
            // And use ExecutionType.MULTISIG for Multisig.

            finalType = ExecutionType.MULTISIG;
            resolutionMethod = 'PROXY_MULTISIG';
        } else if (isMultisig) {
            finalType = ExecutionType.MULTISIG;
            resolutionMethod = 'MULTISIG';
        } else if (isProxy) {
            // Using RELAYED to represent Proxy for now as implicit "Indirect"
            finalType = ExecutionType.RELAYED;
            resolutionMethod = 'PROXY';
        } else {
            finalType = ExecutionType.DIRECT;
            resolutionMethod = 'DIRECT';
        }


        return {
            effectiveTo, // Resolved implementation
            executionType: finalType,
            isProxy,
            isMultisig,
            implementation: proxyImpl || undefined,
            resolutionMethod
        };
    }
}

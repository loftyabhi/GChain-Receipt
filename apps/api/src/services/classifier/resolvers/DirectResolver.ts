import { Transaction, Receipt, Log, ExecutionType, IExecutionResolver } from '../core/types';

export class DirectResolver implements IExecutionResolver {
    async resolve(tx: Transaction, receipt: Receipt, logs: Log[]): Promise<ExecutionType> {
        // DirectResolver is strict fallback.
        // It asserts "DIRECT" if no other complexity is found by the Orchestrator.
        // It does not check logic itself, it just provides the constant.
        return ExecutionType.DIRECT;
    }
}

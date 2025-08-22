import { AltitraceClient, type ExtendedSimulationResult, type ExtendedTracerResponse } from '@altitrace/sdk';
import type { SimulationRequest } from '@altitrace/sdk';

/**
 * Enhanced simulation result with trace data for complete call hierarchy
 */
export interface EnhancedSimulationResult extends ExtendedSimulationResult {
    traceData?: ExtendedTracerResponse;
    hasCallHierarchy: boolean;
}

/**
 * Execute both simulation and trace APIs in parallel for comprehensive data
 */
export async function executeEnhancedSimulation(
    client: AltitraceClient,
    request: SimulationRequest
): Promise<EnhancedSimulationResult> {
    try {
        // Extract the first call for tracing (assumes single transaction simulation)
        const primaryCall = request.params.calls[0];

        if (!primaryCall) {
            throw new Error('No calls found in simulation request');
        }

        // Execute simulation and trace in parallel
        const [simulationResult, traceResult] = await Promise.all([
            // Original simulation API
            client.executeSimulation(request),

            // New trace API for call hierarchy (fallback silently if not available)
            client.trace()
                .call(primaryCall)
                .atBlock(request.params.blockNumber || request.params.blockTag || 'latest')
                .withCallTracer({ onlyTopCall: false, withLogs: true })
                .with4ByteTracer()
                .execute()
                .catch(() => null) // Silently fail if trace API not available
        ]);

        // Combine results
        const enhancedResult: EnhancedSimulationResult = {
            ...simulationResult,
            traceData: traceResult || undefined,
            hasCallHierarchy: !!traceResult?.callTracer?.rootCall
        };

        return enhancedResult;
    } catch (error) {
        console.error('Enhanced simulation failed:', error);
        // Fallback to simulation only
        const simulationResult = await client.executeSimulation(request);
        return {
            ...simulationResult,
            hasCallHierarchy: false
        };
    }
}

/**
 * Load transaction data from hash using trace API
 */
export async function loadTransactionFromHash(
    client: AltitraceClient,
    txHash: string
): Promise<{
    to: string;
    from: string;
    data: string;
    value: string;
    gasUsed: string;
    success: boolean;
}> {
    const trace = await client.traceTransaction(txHash);

    if (!trace.callTracer?.rootCall) {
        throw new Error('No call data found in transaction trace');
    }

    const rootCall = trace.callTracer.rootCall;

    return {
        to: rootCall.to || '',
        from: rootCall.from,
        data: rootCall.input, // This IS the calldata!
        value: rootCall.value,
        gasUsed: rootCall.gasUsed,
        success: !rootCall.reverted
    };
}

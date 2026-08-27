const prices = {
    'gemini-2.5-pro': { input: 1.25, output: 10, batchInput: 0.625, batchOutput: 5 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50, batchInput: 0.15, batchOutput: 1.25 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, batchInput: 0.05, batchOutput: 0.20 },
}

export function calculateCost({ model, inputTokens = 0, outputTokens = 0, mode = 'standard' }) {
    const price = prices[model]
    if (!price) return 0
    const batch = mode === 'batch' || mode === 'flex'
    return (inputTokens / 1_000_000) * (batch ? price.batchInput : price.input) +
        (outputTokens / 1_000_000) * (batch ? price.batchOutput : price.output)
}

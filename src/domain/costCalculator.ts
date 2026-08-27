export type BillingMode = 'standard' | 'batch' | 'flex' | 'priority'
export interface ModelPrice { provider: 'google'; model: string; label: string; inputPerMillion: number; outputPerMillion: number; batchInputPerMillion?: number; batchOutputPerMillion?: number; currency: 'USD'; sourceUpdatedAt: string }
export interface UsageSample { model: string; inputTokens: number; outputTokens: number; mode?: BillingMode }
export const GEMINI_PRICES: Record<string, ModelPrice> = {
    'gemini-2.5-pro': { provider: 'google', model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', inputPerMillion: 1.25, outputPerMillion: 10, batchInputPerMillion: 0.625, batchOutputPerMillion: 5, currency: 'USD', sourceUpdatedAt: '2026-08-27' },
    'gemini-2.5-flash': { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', inputPerMillion: 0.30, outputPerMillion: 2.50, batchInputPerMillion: 0.15, batchOutputPerMillion: 1.25, currency: 'USD', sourceUpdatedAt: '2026-08-27' },
    'gemini-2.5-flash-lite': { provider: 'google', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', inputPerMillion: 0.10, outputPerMillion: 0.40, batchInputPerMillion: 0.05, batchOutputPerMillion: 0.20, currency: 'USD', sourceUpdatedAt: '2026-08-27' },
}
export function calculateUsageCost(usage: UsageSample, prices = GEMINI_PRICES): number {
    const price = prices[usage.model]
    if (!price) return 0
    const isBatch = usage.mode === 'batch' || usage.mode === 'flex'
    const inputPrice = isBatch ? (price.batchInputPerMillion ?? price.inputPerMillion) : price.inputPerMillion
    const outputPrice = isBatch ? (price.batchOutputPerMillion ?? price.outputPerMillion) : price.outputPerMillion
    return (usage.inputTokens / 1_000_000) * inputPrice + (usage.outputTokens / 1_000_000) * outputPrice
}
export function calculateTotalCost(usages: UsageSample[], prices = GEMINI_PRICES): number { return usages.reduce((total, usage) => total + calculateUsageCost(usage, prices), 0) }

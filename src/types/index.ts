// Standalone types after Zero removal
// These types were previously generated from Zero schema

export interface Asset {
    id: string;
    asset: string;
    assetName: string;
    cusip: string | null;
}

export interface Superinvestor {
    id: string;
    cik: string;
    cikName: string;
    cikTicker?: string | null;
    activePeriods?: string | null;
}

export interface CusipQuarterInvestorActivity {
    id?: number;
    cusip: string | null;
    ticker: string | null;
    quarter: string | null;
    numOpen: number | null;
    numAdd: number | null;
    numReduce: number | null;
    numClose: number | null;
    numHold: number | null;
}

export interface Search {
    id: number;
    code: string;
    name: string;
    category: string;
    cusip?: string | null;
}

export interface Entity {
    id: string;
    name: string;
    category: string;
    createdAt?: string;
}

export interface ValueQuarter {
    quarter: string;
    value: number;
}

export interface InvestorFlow {
    quarter: string;
    inflow: number;
    outflow: number;
}

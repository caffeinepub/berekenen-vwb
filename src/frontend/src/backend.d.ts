import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AssetView {
    currentPrice: number;
    ticker: string;
    name: string;
    assetType: AssetType;
    transactions: Array<TransactionView>;
}
export interface LoanTransactionView {
    id: bigint;
    transactionType: LoanTransactionType;
    date: Time;
    loanId: bigint;
    notes?: string;
    amount: number;
}
export type Time = bigint;
export interface AssetHistoryView {
    timestamp: Time;
    price: number;
}
export interface StakingRewardView {
    date: Time;
    quantity: number;
}
export interface LoanView {
    id: bigint;
    status: LoanStatus;
    endDate?: Time;
    name: string;
    durationMonths?: bigint;
    notes?: string;
    interestRatePercent?: number;
    transactions: Array<LoanTransactionView>;
    loanedAmount: number;
    startDate: Time;
}
export interface TransactionView {
    euroValue?: number;
    transactionType: TransactionType;
    asset: string;
    date: Time;
    fees?: number;
    pricePerUnit: number;
    hasOngoingCosts?: boolean;
    notes?: string;
    quantity: number;
}
export enum AssetType {
    stock = "stock",
    crypto = "crypto"
}
export enum LoanStatus {
    repaid = "repaid",
    active = "active",
    defaulted = "defaulted"
}
export enum LoanTransactionType {
    interestReceived = "interestReceived",
    repaymentReceived = "repaymentReceived"
}
export enum TransactionType {
    buy = "buy",
    dividend = "dividend",
    sell = "sell",
    stakingReward = "stakingReward"
}
export interface backendInterface {
    addAsset(name: string, ticker: string, assetType: AssetType, currentPrice: number): Promise<void>;
    addHistoricalData(asset: string, timestamp: Time, price: number): Promise<void>;
    addLoan(name: string, startDate: Time, loanedAmount: number, interestRatePercent: number | null, endDate: Time | null, durationMonths: bigint | null, notes: string | null): Promise<bigint>;
    addLoanTransaction(loanId: bigint, transactionType: LoanTransactionType, date: Time, amount: number, notes: string | null): Promise<bigint>;
    addStakingReward(asset: string, date: Time, quantity: number): Promise<void>;
    addTransaction(transaction: TransactionView): Promise<void>;
    deleteAsset(ticker: string): Promise<void>;
    deleteLoan(id: bigint): Promise<void>;
    deleteLoanTransaction(loanId: bigint, txId: bigint): Promise<void>;
    deleteTransaction(ticker: string, index: bigint): Promise<void>;
    getAllAssets(): Promise<Array<AssetView>>;
    getAllLoans(): Promise<Array<LoanView>>;
    getAsset(ticker: string): Promise<AssetView>;
    getHistoricalData(asset: string): Promise<Array<AssetHistoryView>>;
    getStakingRewards(asset: string): Promise<Array<StakingRewardView>>;
    getTransactions(asset: string): Promise<Array<TransactionView>>;
    updateAsset(ticker: string, name: string, assetType: AssetType, currentPrice: number): Promise<void>;
    updateLoan(id: bigint, name: string, startDate: Time, loanedAmount: number, interestRatePercent: number | null, endDate: Time | null, durationMonths: bigint | null, notes: string | null, status: LoanStatus): Promise<void>;
    updateTransaction(ticker: string, index: bigint, transaction: TransactionView): Promise<void>;
}

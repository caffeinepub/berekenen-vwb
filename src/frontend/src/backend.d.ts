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
export type Time = bigint;
export interface AssetHistoryView {
    timestamp: Time;
    price: number;
}
export interface StakingRewardView {
    date: Time;
    quantity: number;
}
export interface TransactionView {
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
export enum TransactionType {
    buy = "buy",
    sell = "sell",
    stakingReward = "stakingReward"
}
export interface backendInterface {
    addAsset(name: string, ticker: string, assetType: AssetType, currentPrice: number): Promise<void>;
    addHistoricalData(asset: string, timestamp: Time, price: number): Promise<void>;
    addStakingReward(asset: string, date: Time, quantity: number): Promise<void>;
    addTransaction(transaction: TransactionView): Promise<void>;
    deleteAsset(ticker: string): Promise<void>;
    deleteTransaction(ticker: string, index: bigint): Promise<void>;
    getAllAssets(): Promise<Array<AssetView>>;
    getAsset(ticker: string): Promise<AssetView>;
    getHistoricalData(asset: string): Promise<Array<AssetHistoryView>>;
    getStakingRewards(asset: string): Promise<Array<StakingRewardView>>;
    getTransactions(asset: string): Promise<Array<TransactionView>>;
    updateAsset(ticker: string, name: string, assetType: AssetType, currentPrice: number): Promise<void>;
    updateTransaction(ticker: string, index: bigint, transaction: TransactionView): Promise<void>;
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { AssetType, AssetView, TransactionView, LoanView, LoanStatus, LoanTransactionType } from "../backend.d";

// ─── Queries ────────────────────────────────────────────────────────────────

export function useAllAssets() {
  const { actor, isFetching } = useActor();
  return useQuery<AssetView[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAssets();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAsset(ticker: string) {
  const { actor, isFetching } = useActor();
  return useQuery<AssetView>({
    queryKey: ["asset", ticker],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getAsset(ticker);
    },
    enabled: !!actor && !isFetching && !!ticker,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useAddAsset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      ticker,
      assetType,
      currentPrice,
    }: {
      name: string;
      ticker: string;
      assetType: AssetType;
      currentPrice: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.addAsset(name, ticker, assetType, currentPrice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useAddTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transaction: TransactionView) => {
      if (!actor) throw new Error("No actor");
      return actor.addTransaction(transaction);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", variables.asset] });
    },
  });
}

export function useAddStakingReward() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      asset,
      date,
      quantity,
    }: {
      asset: string;
      date: bigint;
      quantity: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.addStakingReward(asset, date, quantity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useUpdateAssetPrice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      ticker,
      assetType,
      currentPrice,
    }: {
      name: string;
      ticker: string;
      assetType: AssetType;
      currentPrice: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateAsset(ticker, name, assetType, currentPrice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useDeleteAsset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticker: string) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteAsset(ticker);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useUpdateAsset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticker,
      name,
      assetType,
      currentPrice,
    }: {
      ticker: string;
      name: string;
      assetType: AssetType;
      currentPrice: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateAsset(ticker, name, assetType, currentPrice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticker, index }: { ticker: string; index: number }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteTransaction(ticker, BigInt(index));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useUpdateTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticker,
      index,
      transaction,
    }: {
      ticker: string;
      index: number;
      transaction: TransactionView;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateTransaction(ticker, BigInt(index), transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

// ─── Loans ───────────────────────────────────────────────────────────────────

export function useAllLoans() {
  const { actor, isFetching } = useActor();
  return useQuery<LoanView[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllLoans();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddLoan() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      startDate,
      loanedAmount,
      interestRatePercent,
      endDate,
      durationMonths,
      notes,
    }: {
      name: string;
      startDate: bigint;
      loanedAmount: number;
      interestRatePercent?: number;
      endDate?: bigint;
      durationMonths?: bigint;
      notes?: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.addLoan(
        name,
        startDate,
        loanedAmount,
        interestRatePercent ?? null,
        endDate ?? null,
        durationMonths ?? null,
        notes ?? null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useUpdateLoan() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      startDate,
      loanedAmount,
      interestRatePercent,
      endDate,
      durationMonths,
      notes,
      status,
    }: {
      id: bigint;
      name: string;
      startDate: bigint;
      loanedAmount: number;
      interestRatePercent?: number;
      endDate?: bigint;
      durationMonths?: bigint;
      notes?: string;
      status: LoanStatus;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateLoan(
        id,
        name,
        startDate,
        loanedAmount,
        interestRatePercent ?? null,
        endDate ?? null,
        durationMonths ?? null,
        notes ?? null,
        status
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeleteLoan() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteLoan(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useAddLoanTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      loanId,
      transactionType,
      date,
      amount,
      notes,
    }: {
      loanId: bigint;
      transactionType: LoanTransactionType;
      date: bigint;
      amount: number;
      notes?: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.addLoanTransaction(loanId, transactionType, date, amount, notes ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeleteLoanTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, txId }: { loanId: bigint; txId: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteLoanTransaction(loanId, txId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

// Re-export types for convenience
export type { LoanView, LoanStatus, LoanTransactionType };

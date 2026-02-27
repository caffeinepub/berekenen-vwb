import Time "mo:core/Time";
import Text "mo:core/Text";
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

actor {
  // Public type definitions
  type AssetType = {
    #stock;
    #crypto;
  };

  type TransactionType = {
    #buy;
    #sell;
    #stakingReward;
    #dividend;
  };

  type LoanTransactionType = {
    #interestReceived;
    #repaymentReceived;
  };

  type LoanStatus = {
    #active;
    #repaid;
    #defaulted;
  };

  public type AssetView = {
    name : Text;
    ticker : Text;
    assetType : AssetType;
    currentPrice : Float;
    transactions : [TransactionView];
  };

  public type TransactionView = {
    asset : Text;
    date : Time.Time;
    transactionType : TransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
    euroValue : ?Float;
  };

  public type StakingRewardView = {
    date : Time.Time;
    quantity : Float;
  };

  public type AssetHistoryView = {
    timestamp : Time.Time;
    price : Float;
  };

  public type LoanTransactionView = {
    id : Nat;
    loanId : Nat;
    transactionType : LoanTransactionType;
    date : Time.Time;
    amount : Float;
    notes : ?Text;
  };

  public type LoanView = {
    id : Nat;
    name : Text;
    startDate : Time.Time;
    loanedAmount : Float;
    interestRatePercent : ?Float;
    endDate : ?Time.Time;
    durationMonths : ?Nat;
    notes : ?Text;
    status : LoanStatus;
    transactions : [LoanTransactionView];
  };

  // Internal type definitions
  type Asset = {
    name : Text;
    ticker : Text;
    assetType : AssetType;
    currentPrice : Float;
    transactions : List.List<Transaction>;
  };

  type Transaction = {
    asset : Text;
    date : Time.Time;
    transactionType : TransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
    euroValue : ?Float;
  };

  type StakingReward = {
    date : Time.Time;
    quantity : Float;
  };

  type AssetHistory = {
    timestamp : Time.Time;
    price : Float;
  };

  type LoanTransaction = {
    id : Nat;
    loanId : Nat;
    transactionType : LoanTransactionType;
    date : Time.Time;
    amount : Float;
    notes : ?Text;
  };

  type Loan = {
    id : Nat;
    name : Text;
    startDate : Time.Time;
    loanedAmount : Float;
    interestRatePercent : ?Float;
    endDate : ?Time.Time;
    durationMonths : ?Nat;
    notes : ?Text;
    status : LoanStatus;
    transactions : List.List<LoanTransaction>;
  };

  // Data storage
  let assets = Map.empty<Text, Asset>();
  let stakingRewards = Map.empty<Text, List.List<StakingReward>>();
  let historicalData = Map.empty<Text, List.List<AssetHistory>>();
  let loans = Map.empty<Nat, Loan>();

  var nextLoanId = 0;
  var nextLoanTxId = 0;

  // Conversion functions
  func toAssetView(asset : Asset) : AssetView {
    let transactions = asset.transactions.toArray().map(func(tx) { toTransactionView(tx) });
    {
      name = asset.name;
      ticker = asset.ticker;
      assetType = asset.assetType;
      currentPrice = asset.currentPrice;
      transactions;
    };
  };

  func toTransactionView(transaction : Transaction) : TransactionView {
    {
      asset = transaction.asset;
      date = transaction.date;
      transactionType = transaction.transactionType;
      quantity = transaction.quantity;
      pricePerUnit = transaction.pricePerUnit;
      fees = transaction.fees;
      hasOngoingCosts = transaction.hasOngoingCosts;
      notes = transaction.notes;
      euroValue = transaction.euroValue;
    };
  };

  func toStakingRewardView(reward : StakingReward) : StakingRewardView {
    {
      date = reward.date;
      quantity = reward.quantity;
    };
  };

  func toAssetHistoryView(history : AssetHistory) : AssetHistoryView {
    {
      timestamp = history.timestamp;
      price = history.price;
    };
  };

  func toLoanTransactionView(loanTx : LoanTransaction) : LoanTransactionView {
    {
      id = loanTx.id;
      loanId = loanTx.loanId;
      transactionType = loanTx.transactionType;
      date = loanTx.date;
      amount = loanTx.amount;
      notes = loanTx.notes;
    };
  };

  func toLoanView(loan : Loan) : LoanView {
    let txs = loan.transactions.toArray().map(func(tx) { toLoanTransactionView(tx) });
    {
      id = loan.id;
      name = loan.name;
      startDate = loan.startDate;
      loanedAmount = loan.loanedAmount;
      interestRatePercent = loan.interestRatePercent;
      endDate = loan.endDate;
      durationMonths = loan.durationMonths;
      notes = loan.notes;
      status = loan.status;
      transactions = txs;
    };
  };

  // Asset management functions
  public shared ({ caller }) func addAsset(name : Text, ticker : Text, assetType : AssetType, currentPrice : Float) : async () {
    let asset = {
      name;
      ticker;
      assetType;
      currentPrice;
      transactions = List.empty<Transaction>();
    };
    assets.add(ticker, asset);
  };

  public shared ({ caller }) func updateAsset(ticker : Text, name : Text, assetType : AssetType, currentPrice : Float) : async () {
    switch (assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?existingAsset) {
        let updatedAsset = {
          name;
          ticker;
          assetType;
          currentPrice;
          transactions = existingAsset.transactions;
        };
        assets.add(ticker, updatedAsset);
      };
    };
  };

  public shared ({ caller }) func deleteAsset(ticker : Text) : async () {
    if (not assets.containsKey(ticker)) {
      Runtime.trap("Asset does not exist");
    };

    assets.remove(ticker);
    stakingRewards.remove(ticker);
    historicalData.remove(ticker);
  };

  public query ({ caller }) func getAsset(ticker : Text) : async AssetView {
    switch (assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) { toAssetView(asset) };
    };
  };

  public query ({ caller }) func getAllAssets() : async [AssetView] {
    assets.values().map(func(asset) { toAssetView(asset) }).toArray();
  };

  public shared ({ caller }) func addTransaction(transaction : TransactionView) : async () {
    if (not assets.containsKey(transaction.asset)) {
      Runtime.trap("Asset does not exist");
    };

    let internalTransaction = {
      asset = transaction.asset;
      date = transaction.date;
      transactionType = transaction.transactionType;
      quantity = transaction.quantity;
      pricePerUnit = transaction.pricePerUnit;
      fees = transaction.fees;
      hasOngoingCosts = transaction.hasOngoingCosts;
      notes = transaction.notes;
      euroValue = transaction.euroValue;
    };

    switch (assets.get(transaction.asset)) {
      case (null) { Runtime.trap("Asset not found after existence check") };
      case (?asset) {
        asset.transactions.add(internalTransaction);
        assets.add(transaction.asset, asset);
      };
    };
  };

  public shared ({ caller }) func updateTransaction(ticker : Text, index : Nat, transaction : TransactionView) : async () {
    switch (assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) {
        let transactionsArray = asset.transactions.toArray();
        if (index >= transactionsArray.size()) {
          Runtime.trap("Transaction does not exist");
        };

        let updatedTransactions = Array.tabulate(
          transactionsArray.size(),
          func(i) {
            if (i == index) {
              {
                asset = transaction.asset;
                date = transaction.date;
                transactionType = transaction.transactionType;
                quantity = transaction.quantity;
                pricePerUnit = transaction.pricePerUnit;
                fees = transaction.fees;
                hasOngoingCosts = transaction.hasOngoingCosts;
                notes = transaction.notes;
                euroValue = transaction.euroValue;
              };
            } else {
              transactionsArray[i];
            };
          },
        );

        let newTransactions = List.fromArray<Transaction>(updatedTransactions);
        let updatedAsset = {
          asset with transactions = newTransactions
        };
        assets.add(ticker, updatedAsset);
      };
    };
  };

  public shared ({ caller }) func deleteTransaction(ticker : Text, index : Nat) : async () {
    switch (assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) {
        let transactionsArray = asset.transactions.toArray();
        if (index >= transactionsArray.size()) {
          Runtime.trap("Transaction does not exist");
        };

        let filteredTransactions = Array.tabulate(
          transactionsArray.size() - 1,
          func(i) {
            if (i < index) { transactionsArray[i] } else { transactionsArray[i + 1] };
          },
        );

        let newTransactions = List.fromArray<Transaction>(filteredTransactions);
        let updatedAsset = {
          asset with transactions = newTransactions
        };
        assets.add(ticker, updatedAsset);
      };
    };
  };

  public query ({ caller }) func getTransactions(asset : Text) : async [TransactionView] {
    switch (assets.get(asset)) {
      case (null) { [] };
      case (?asset) {
        let transactionArray = asset.transactions.toArray();
        transactionArray.sort(
          func(t1, t2) {
            Int.compare(t1.date, t2.date);
          }
        ).map(func(tx) { toTransactionView(tx) });
      };
    };
  };

  // Staking rewards
  public shared ({ caller }) func addStakingReward(asset : Text, date : Time.Time, quantity : Float) : async () {
    if (not assets.containsKey(asset)) {
      Runtime.trap("Asset does not exist");
    };

    let stakingReward = { date; quantity };

    var rewardsList = switch (stakingRewards.get(asset)) {
      case (?list) { list };
      case (null) { List.empty<StakingReward>() };
    };

    rewardsList.add(stakingReward);
    stakingRewards.add(asset, rewardsList);
  };

  public query ({ caller }) func getStakingRewards(asset : Text) : async [StakingRewardView] {
    switch (stakingRewards.get(asset)) {
      case (null) { [] };
      case (?list) {
        let rewardsArray = list.toArray();
        rewardsArray.sort(
          func(r1, r2) {
            Int.compare(r1.date, r2.date);
          }
        ).map(func(reward) { toStakingRewardView(reward) });
      };
    };
  };

  // Historical data management
  public shared ({ caller }) func addHistoricalData(asset : Text, timestamp : Time.Time, price : Float) : async () {
    if (not assets.containsKey(asset)) {
      Runtime.trap("Asset does not exist");
    };

    let entry = { timestamp; price };

    var historyList = switch (historicalData.get(asset)) {
      case (?list) { list };
      case (null) { List.empty<AssetHistory>() };
    };

    historyList.add(entry);
    historicalData.add(asset, historyList);
  };

  public query ({ caller }) func getHistoricalData(asset : Text) : async [AssetHistoryView] {
    switch (historicalData.get(asset)) {
      case (null) { [] };
      case (?list) {
        let historyArray = list.toArray();
        historyArray.sort(
          func(a1, a2) {
            Int.compare(a1.timestamp, a2.timestamp);
          }
        ).map(func(history) { toAssetHistoryView(history) });
      };
    };
  };

  // Loan management functions

  public shared ({ caller }) func addLoan(
    name : Text,
    startDate : Time.Time,
    loanedAmount : Float,
    interestRatePercent : ?Float,
    endDate : ?Time.Time,
    durationMonths : ?Nat,
    notes : ?Text,
  ) : async Nat {
    let id = nextLoanId;
    nextLoanId += 1;

    let loan = {
      id;
      name;
      startDate;
      loanedAmount;
      interestRatePercent;
      endDate;
      durationMonths;
      notes;
      status = #active : LoanStatus;
      transactions = List.empty<LoanTransaction>();
    };

    loans.add(id, loan);
    id;
  };

  public shared ({ caller }) func updateLoan(
    id : Nat,
    name : Text,
    startDate : Time.Time,
    loanedAmount : Float,
    interestRatePercent : ?Float,
    endDate : ?Time.Time,
    durationMonths : ?Nat,
    notes : ?Text,
    status : LoanStatus,
  ) : async () {
    switch (loans.get(id)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?existingLoan) {
        let updatedLoan = {
          id;
          name;
          startDate;
          loanedAmount;
          interestRatePercent;
          endDate;
          durationMonths;
          notes;
          status;
          transactions = existingLoan.transactions;
        };
        loans.add(id, updatedLoan);
      };
    };
  };

  public shared ({ caller }) func deleteLoan(id : Nat) : async () {
    if (not loans.containsKey(id)) {
      Runtime.trap("Loan does not exist");
    };
    loans.remove(id);
  };

  public query ({ caller }) func getAllLoans() : async [LoanView] {
    loans.values().map(func(loan) { toLoanView(loan) }).toArray();
  };

  public shared ({ caller }) func addLoanTransaction(
    loanId : Nat,
    transactionType : LoanTransactionType,
    date : Time.Time,
    amount : Float,
    notes : ?Text,
  ) : async Nat {
    switch (loans.get(loanId)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?loan) {
        let txId = nextLoanTxId;
        nextLoanTxId += 1;

        let loanTransaction = {
          id = txId;
          loanId;
          transactionType;
          date;
          amount;
          notes;
        };

        loan.transactions.add(loanTransaction);
        loans.add(loanId, loan);
        txId;
      };
    };
  };

  public shared ({ caller }) func deleteLoanTransaction(loanId : Nat, txId : Nat) : async () {
    switch (loans.get(loanId)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?loan) {
        let transactionsArray = loan.transactions.toArray();
        let filteredTransactions = transactionsArray.filter(func(tx) { tx.id != txId });
        let newTransactions = List.fromArray<LoanTransaction>(filteredTransactions);
        let updatedLoan = { loan with transactions = newTransactions };
        loans.add(loanId, updatedLoan);
      };
    };
  };
};

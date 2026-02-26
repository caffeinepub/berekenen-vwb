import Time "mo:core/Time";
import Text "mo:core/Text";
import Map "mo:core/Map";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";



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
  };

  public type AssetView = {
    name : Text;
    ticker : Text;
    assetType : AssetType;
    currentPrice : Float;
    transactions : [TransactionView];
  };

  public type TransactionView = {
    asset : Text; // Ticker symbol
    date : Time.Time;
    transactionType : TransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
  };

  public type StakingRewardView = {
    date : Time.Time;
    quantity : Float;
  };

  public type AssetHistoryView = {
    timestamp : Time.Time;
    price : Float;
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
    asset : Text; // Ticker symbol
    date : Time.Time;
    transactionType : TransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
  };

  type StakingReward = {
    date : Time.Time;
    quantity : Float;
  };

  type AssetHistory = {
    timestamp : Time.Time;
    price : Float;
  };

  // Data storage
  let assets = Map.empty<Text, Asset>();
  let stakingRewards = Map.empty<Text, List.List<StakingReward>>();
  let historicalData = Map.empty<Text, List.List<AssetHistory>>();

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

  // Asset management
  public shared ({ caller }) func addAsset(name : Text, ticker : Text, assetType : AssetType, currentPrice : Float) : async () {
    var transactions = List.empty<Transaction>();

    switch (assets.get(ticker)) {
      case (?existingAsset) {
        transactions := existingAsset.transactions;
      };
      case (null) {};
    };

    let asset = {
      name;
      ticker;
      assetType;
      currentPrice;
      transactions;
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
        let transactions = asset.transactions.toArray();
        if (index >= transactions.size()) {
          Runtime.trap("Transaction does not exist");
        };

        let updatedTransactions = Array.tabulate(
          transactions.size(),
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
              };
            } else {
              transactions[i];
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
        let transactions = asset.transactions.toArray();
        if (index >= transactions.size()) {
          Runtime.trap("Transaction does not exist");
        };

        let filteredTransactions = Array.tabulate(
          transactions.size() - 1,
          func(i) {
            if (i < index) { transactions[i] } else { transactions[i + 1] };
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
};

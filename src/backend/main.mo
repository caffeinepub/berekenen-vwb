import Time "mo:core/Time";
import Text "mo:core/Text";
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

// Specify the data migration function in with-clause
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

  public type UserProfile = {
    name : Text;
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

  type UserData = {
    assets : Map.Map<Text, Asset>;
    stakingRewards : Map.Map<Text, List.List<StakingReward>>;
    historicalData : Map.Map<Text, List.List<AssetHistory>>;
    loans : Map.Map<Nat, Loan>;
    userName : Text;
    nextLoanId : Nat;
    nextLoanTxId : Nat;
  };

  // Initialize the user system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Global user data storage
  let userData = Map.empty<Principal, UserData>();

  // User profiles storage
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Helper functions for isolated user state
  func getOrCreateUserData(principal : Principal) : UserData {
    switch (userData.get(principal)) {
      case (null) {
        let newUserData : UserData = {
          assets = Map.empty<Text, Asset>();
          stakingRewards = Map.empty<Text, List.List<StakingReward>>();
          historicalData = Map.empty<Text, List.List<AssetHistory>>();
          loans = Map.empty<Nat, Loan>();
          userName = "";
          nextLoanId = 0;
          nextLoanTxId = 0;
        };
        userData.add(principal, newUserData);
        newUserData;
      };
      case (?data) { data };
    };
  };

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

  // User profile management functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Asset management functions
  public shared ({ caller }) func addAsset(name : Text, ticker : Text, assetType : AssetType, currentPrice : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add assets");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
      case (null) {
        let asset = {
          name;
          ticker;
          assetType;
          currentPrice;
          transactions = List.empty<Transaction>();
        };
        callerData.assets.add(ticker, asset);
        userData.add(caller, callerData);
      };
      case (?_) { Runtime.trap("Asset already exists") };
    };
  };

  public shared ({ caller }) func updateAsset(ticker : Text, name : Text, assetType : AssetType, currentPrice : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update assets");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?existingAsset) {
        let updatedAsset = {
          name;
          ticker;
          assetType;
          currentPrice;
          transactions = existingAsset.transactions;
        };
        callerData.assets.add(ticker, updatedAsset);
        userData.add(caller, callerData);
      };
    };
  };

  public shared ({ caller }) func deleteAsset(ticker : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete assets");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?_) {
        callerData.assets.remove(ticker);
        callerData.stakingRewards.remove(ticker);
        callerData.historicalData.remove(ticker);
        userData.add(caller, callerData);
      };
    };
  };

  public query ({ caller }) func getAsset(ticker : Text) : async AssetView {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assets");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) { toAssetView(asset) };
    };
  };

  public query ({ caller }) func getAllAssets() : async [AssetView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assets");
    };

    let callerData = getOrCreateUserData(caller);
    callerData.assets.values().map(func(asset) { toAssetView(asset) }).toArray();
  };

  public shared ({ caller }) func addTransaction(transaction : TransactionView) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(transaction.asset)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) {
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

        asset.transactions.add(internalTransaction);
        callerData.assets.add(transaction.asset, asset);
        userData.add(caller, callerData);
      };
    };
  };

  public shared ({ caller }) func updateTransaction(ticker : Text, index : Nat, transaction : TransactionView) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?asset) {
        let transactionsArray = asset.transactions.toArray();
        if (index >= transactionsArray.size()) {
          Runtime.trap("Transaction does not exist");
        };

        let updatedTransactions = List.fromArray<Transaction>(
          Array.tabulate(
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
          )
        );

        let updatedAsset = {
          asset with transactions = updatedTransactions
        };
        callerData.assets.add(ticker, updatedAsset);
        userData.add(caller, callerData);
      };
    };
  };

  public shared ({ caller }) func deleteTransaction(ticker : Text, index : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(ticker)) {
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
        callerData.assets.add(ticker, updatedAsset);
        userData.add(caller, callerData);
      };
    };
  };

  public query ({ caller }) func getTransactions(asset : Text) : async [TransactionView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(asset)) {
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add staking rewards");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(asset)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?_) {
        let stakingReward = { date; quantity };

        var rewardsList = switch (callerData.stakingRewards.get(asset)) {
          case (?list) { list };
          case (null) { List.empty<StakingReward>() };
        };

        rewardsList.add(stakingReward);
        callerData.stakingRewards.add(asset, rewardsList);
        userData.add(caller, callerData);
      };
    };
  };

  public query ({ caller }) func getStakingRewards(asset : Text) : async [StakingRewardView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view staking rewards");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.stakingRewards.get(asset)) {
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add historical data");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.assets.get(asset)) {
      case (null) { Runtime.trap("Asset does not exist") };
      case (?_) {
        let entry = { timestamp; price };

        var historyList = switch (callerData.historicalData.get(asset)) {
          case (?list) { list };
          case (null) { List.empty<AssetHistory>() };
        };

        historyList.add(entry);
        callerData.historicalData.add(asset, historyList);
        userData.add(caller, callerData);
      };
    };
  };

  public query ({ caller }) func getHistoricalData(asset : Text) : async [AssetHistoryView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view historical data");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.historicalData.get(asset)) {
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add loans");
    };

    let callerData = getOrCreateUserData(caller);
    let id = callerData.nextLoanId;

    let newLoan = {
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

    callerData.loans.add(id, newLoan);
    let updatedCallerData = {
      callerData with
      loans = callerData.loans;
      nextLoanId = callerData.nextLoanId + 1;
    };
    userData.add(caller, updatedCallerData);
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update loans");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.loans.get(id)) {
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
        callerData.loans.add(id, updatedLoan);
        userData.add(caller, callerData);
      };
    };
  };

  public shared ({ caller }) func deleteLoan(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete loans");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.loans.get(id)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?_) {
        callerData.loans.remove(id);
        userData.add(caller, callerData);
      };
    };
  };

  public query ({ caller }) func getAllLoans() : async [LoanView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view loans");
    };

    let callerData = getOrCreateUserData(caller);
    callerData.loans.values().map(func(loan) { toLoanView(loan) }).toArray();
  };

  public shared ({ caller }) func addLoanTransaction(
    loanId : Nat,
    transactionType : LoanTransactionType,
    date : Time.Time,
    amount : Float,
    notes : ?Text,
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add loan transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.loans.get(loanId)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?loan) {
        let txId = callerData.nextLoanTxId;

        let loanTransaction = {
          id = txId;
          loanId;
          transactionType;
          date;
          amount;
          notes;
        };

        loan.transactions.add(loanTransaction);
        callerData.loans.add(loanId, loan);

        let updatedCallerData = {
          callerData with
          loans = callerData.loans;
          nextLoanTxId = callerData.nextLoanTxId + 1;
        };
        userData.add(caller, updatedCallerData);
        txId;
      };
    };
  };

  public shared ({ caller }) func deleteLoanTransaction(loanId : Nat, txId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete loan transactions");
    };

    let callerData = getOrCreateUserData(caller);

    switch (callerData.loans.get(loanId)) {
      case (null) { Runtime.trap("Loan does not exist") };
      case (?loan) {
        let transactionsArray = loan.transactions.toArray();
        let filteredTransactions = transactionsArray.filter(func(tx) { tx.id != txId });
        let newTransactions = List.fromArray<LoanTransaction>(filteredTransactions);
        let updatedLoan = { loan with transactions = newTransactions };
        callerData.loans.add(loanId, updatedLoan);
        userData.add(caller, callerData);
      };
    };
  };

  // User name management
  public shared ({ caller }) func setUserName(name : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set user name");
    };

    let callerData = getOrCreateUserData(caller);
    let updatedCallerData = { callerData with userName = name };
    userData.add(caller, updatedCallerData);
  };

  public query ({ caller }) func getUserName() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get user name");
    };

    let callerData = getOrCreateUserData(caller);
    callerData.userName;
  };
};

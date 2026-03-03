import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import Iter "mo:core/Iter";

module {
  // Old types (without #ongoingCosts)
  type OldTransactionType = {
    #buy;
    #sell;
    #stakingReward;
    #dividend;
  };

  type OldUserData = {
    assets : Map.Map<Text, OldAsset>;
    stakingRewards : Map.Map<Text, List.List<OldStakingReward>>;
    historicalData : Map.Map<Text, List.List<OldAssetHistory>>;
    loans : Map.Map<Nat, OldLoan>;
    userName : Text;
    nextLoanId : Nat;
    nextLoanTxId : Nat;
    commodityTickers : List.List<Text>;
    terEntries : Map.Map<Text, Float>;
    ongoingCostsEntries : Map.Map<Text, Bool>;
    twelveDataApiKey : Text;
  };

  type OldAsset = {
    name : Text;
    ticker : Text;
    assetType : {
      #stock;
      #crypto;
    };
    currentPrice : Float;
    transactions : List.List<OldTransaction>;
  };

  type OldTransaction = {
    asset : Text;
    date : Int;
    transactionType : OldTransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
    euroValue : ?Float;
  };

  type OldStakingReward = {
    date : Int;
    quantity : Float;
  };

  type OldAssetHistory = {
    timestamp : Int;
    price : Float;
  };

  type OldLoan = {
    id : Nat;
    name : Text;
    startDate : Int;
    loanedAmount : Float;
    interestRatePercent : ?Float;
    endDate : ?Int;
    durationMonths : ?Nat;
    notes : ?Text;
    status : {
      #active;
      #repaid;
      #defaulted;
    };
    transactions : List.List<OldLoanTransaction>;
  };

  type OldLoanTransaction = {
    id : Nat;
    loanId : Nat;
    transactionType : {
      #interestReceived;
      #repaymentReceived;
    };
    date : Int;
    amount : Float;
    notes : ?Text;
  };

  type OldActor = {
    userData : Map.Map<Principal, OldUserData>;
    userProfiles : Map.Map<Principal, { name : Text }>;
    accessControlState : AccessControl.AccessControlState;
  };

  // New types (with #ongoingCosts)
  type NewTransactionType = {
    #buy;
    #sell;
    #stakingReward;
    #dividend;
    #ongoingCosts;
  };

  type NewUserData = {
    assets : Map.Map<Text, NewAsset>;
    stakingRewards : Map.Map<Text, List.List<NewStakingReward>>;
    historicalData : Map.Map<Text, List.List<NewAssetHistory>>;
    loans : Map.Map<Nat, NewLoan>;
    userName : Text;
    nextLoanId : Nat;
    nextLoanTxId : Nat;
    commodityTickers : List.List<Text>;
    terEntries : Map.Map<Text, Float>;
    ongoingCostsEntries : Map.Map<Text, Bool>;
    twelveDataApiKey : Text;
  };

  type NewAsset = {
    name : Text;
    ticker : Text;
    assetType : {
      #stock;
      #crypto;
    };
    currentPrice : Float;
    transactions : List.List<NewTransaction>;
  };

  type NewTransaction = {
    asset : Text;
    date : Int;
    transactionType : NewTransactionType;
    quantity : Float;
    pricePerUnit : Float;
    fees : ?Float;
    hasOngoingCosts : ?Bool;
    notes : ?Text;
    euroValue : ?Float;
  };

  type NewStakingReward = {
    date : Int;
    quantity : Float;
  };

  type NewAssetHistory = {
    timestamp : Int;
    price : Float;
  };

  type NewLoan = {
    id : Nat;
    name : Text;
    startDate : Int;
    loanedAmount : Float;
    interestRatePercent : ?Float;
    endDate : ?Int;
    durationMonths : ?Nat;
    notes : ?Text;
    status : {
      #active;
      #repaid;
      #defaulted;
    };
    transactions : List.List<NewLoanTransaction>;
  };

  type NewLoanTransaction = {
    id : Nat;
    loanId : Nat;
    transactionType : {
      #interestReceived;
      #repaymentReceived;
    };
    date : Int;
    amount : Float;
    notes : ?Text;
  };

  type NewActor = {
    userData : Map.Map<Principal, NewUserData>;
    userProfiles : Map.Map<Principal, { name : Text }>;
    accessControlState : AccessControl.AccessControlState;
  };

  // Conversion helper functions
  func convertTransaction(transaction : OldTransaction) : NewTransaction {
    { transaction with transactionType = convertTransactionType(transaction.transactionType) };
  };

  func convertTransactionType(oldType : OldTransactionType) : NewTransactionType {
    switch (oldType) {
      case (#buy) { #buy };
      case (#sell) { #sell };
      case (#stakingReward) { #stakingReward };
      case (#dividend) { #dividend };
    };
  };

  func convertAsset(asset : OldAsset) : NewAsset {
    let transactions = asset.transactions.map<OldTransaction, NewTransaction>(convertTransaction);
    { asset with transactions };
  };

  func convertStakingReward(reward : OldStakingReward) : NewStakingReward {
    reward;
  };

  func convertAssetHistory(history : OldAssetHistory) : NewAssetHistory {
    history;
  };

  func convertLoan(loan : OldLoan) : NewLoan {
    let transactions = loan.transactions.map<OldLoanTransaction, NewLoanTransaction>(func(tx) { tx });
    { loan with transactions };
  };

  func convertUserData(userData : OldUserData) : NewUserData {
    let assets = userData.assets.map<Text, OldAsset, NewAsset>(
      func(_ticker, asset) { convertAsset(asset) }
    );
    let stakingRewards = userData.stakingRewards.map<Text, List.List<OldStakingReward>, List.List<NewStakingReward>>(
      func(_key, rewards) {
        rewards.map<OldStakingReward, NewStakingReward>(convertStakingReward);
      }
    );
    let historicalData = userData.historicalData.map<Text, List.List<OldAssetHistory>, List.List<NewAssetHistory>>(
      func(_key, history) {
        history.map<OldAssetHistory, NewAssetHistory>(convertAssetHistory);
      }
    );
    let loans = userData.loans.map<Nat, OldLoan, NewLoan>(
      func(_id, loan) { convertLoan(loan) }
    );
    {
      userData with
      assets;
      stakingRewards;
      historicalData;
      loans;
    };
  };

  // Main migration function
  public func run(old : OldActor) : NewActor {
    let userData = old.userData.map<Principal, OldUserData, NewUserData>(
      func(_p, data) { convertUserData(data) }
    );
    { old with userData };
  };
};

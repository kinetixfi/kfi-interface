import { ethers } from "ethers";
import { gql } from "@apollo/client";
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";

import OrderBook from "../abis/OrderBook.json";
import PositionManager from "../abis/PositionManager.json";
import Vault from "../abis/Vault.json";
import Router from "../abis/Router.json";
import VaultReader from "../abis/VaultReader.json";
import ReferralStorage from "../abis/ReferralStorage.json";
import PositionRouter from "../abis/PositionRouter.json";
import FeeKlpDistributor from "../abis/FeeKlpDistributor.json";
import TokenDistributor from "../abis/TokenDistributor.json";

import { getContract,  } from "../Addresses";
import { getConstant } from "../Constants";
import {
  bigNumberify,
  getExplorerUrl,
  getServerBaseUrl,
  setGasPrice,
  getGasLimit,
  replaceNativeTokenAddress,
  getProvider,
  getOrderKey,
  fetcher,
  expandDecimals,
  getInfoTokens,
  isAddressZero,
  helperToast,
  KAVA,
  FIRST_DATE_TS,
  getUsd,
  USD_DECIMALS,
  HIGH_EXECUTION_FEES_MAP,
  SWAP,
  INCREASE,
  DECREASE,
} from "../Helpers";
import { getTokens, getWhitelistedTokens } from "../data/Tokens";

import { kavaGraphClient, positionsGraphClient } from "./common";
import { groupBy } from "lodash";
import { TradeFailed } from "../components/Exchange/TradeFailed";
export * from "./prices";

const { AddressZero } = ethers.constants;

function getKfiGraphClient(chainId) {
  if (chainId === KAVA) {
    return kavaGraphClient;
  }
  throw new Error(`Unsupported chain ${chainId}`);
}

export function useAllOrdersStats(chainId) {
  const query = gql(`{
    orderStat(id: "total") {
      openSwap
      openIncrease
      openDecrease
      executedSwap
      executedIncrease
      executedDecrease
      cancelledSwap
      cancelledIncrease
      cancelledDecrease
    }
  }`);

  const [res, setRes] = useState();

  useEffect(() => {
    getKfiGraphClient(chainId).query({ query }).then(setRes).catch(console.warn);
  }, [setRes, query, chainId]);

  return res ? res.data.orderStat : null;
}

export function useInfoTokens(library, chainId, active, tokenBalances, fundingRateInfo, vaultPropsLength) {
  const tokens = getTokens(chainId);
  const vaultReaderAddress = getContract(chainId, "VaultReader");
  const vaultAddress = getContract(chainId, "Vault");
  const positionRouterAddress = getContract(chainId, "PositionRouter");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");

  const whitelistedTokens = getWhitelistedTokens(chainId);
  const whitelistedTokenAddresses = whitelistedTokens.map((token) => token.address);

  const { data: vaultTokenInfo } = useSWR(
    [`useInfoTokens:${active}`, chainId, vaultReaderAddress, "getVaultTokenInfoV4"],
    {
      fetcher: fetcher(library, VaultReader, [
        vaultAddress,
        positionRouterAddress,
        nativeTokenAddress,
        expandDecimals(1, 18),
        whitelistedTokenAddresses,
      ]),
    }
  );

  const indexPrices = [];

  return {
    infoTokens: getInfoTokens(
      tokens,
      tokenBalances,
      whitelistedTokens,
      vaultTokenInfo,
      fundingRateInfo,
      vaultPropsLength,
      indexPrices,
      nativeTokenAddress
    ),
  };
}

export function useCoingeckoPrices(symbol) {
  // token ids https://api.coingecko.com/api/v3/coins
  const _symbol = {
    BTC: "bitcoin",
    ETH: "ethereum",
    KAVA: "kava",
    ATOM: "cosmos-hub",
    USDT: "tether",
    PKFI: "pkfi",
  }[symbol];

  const _defaultPrice = {
    BTC: 27000,
    ETH: 1800,
    KAVA: 0.8,
    ATOM: 7,
    USDT: 1,
    PKFI: 0.02,
  }[symbol];

  const { res, error } = useSWR(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`, {
    dedupingInterval: 60000,
    fetcher: fetcher,
  });

  const data = useMemo(() => {
    if (!res || res[symbol] ||  res[symbol]["usd"] === 0) {
      return expandDecimals(_defaultPrice * 1e6, 24);
    }

    return expandDecimals(Number(res[_symbol]["usd"]) * 1e6, 24);
  }, [res]);

  return data;
}

export function useUserStat(chainId) {
  const query = gql(`{
    userStat(id: "total") {
      id
      uniqueCount
    }
  }`);

  const [res, setRes] = useState();

  useEffect(() => {
    getKfiGraphClient(chainId).query({ query }).then(setRes).catch(console.warn);
  }, [setRes, query, chainId]);

  return res ? res.data.userStat : null;
}

export function useAllTokensPerInterval(library, chainId) {
  const [allTokensPerInterval, setAllTokensPerInterval] = useState([]);
  useEffect(() => {
    const provider = getProvider(library, chainId);
    const feeKlpDistributorAddress = getContract(chainId, "FeeKlpDistributor");
    const contract = new ethers.Contract(feeKlpDistributorAddress, FeeKlpDistributor.abi, provider);
    const _allTokensPerInterval = []
    contract.getAllRewardTokens().then(tokens => {
      for (let i = 0; i < tokens.length; i++) {
        const tokenAddress = tokens[i];
        contract.tokensPerInterval(tokenAddress).then(tokensPerInterval => {
          _allTokensPerInterval.push([tokenAddress, tokensPerInterval])
          if (_allTokensPerInterval.length === tokens.length) {
            setAllTokensPerInterval(_allTokensPerInterval);
          }
        })
      }
    })
      .catch((e) => { console.log("e", e) });
  }, [setAllTokensPerInterval, library, chainId])

  return [allTokensPerInterval, setAllTokensPerInterval]
}


export function useIsAccountRegisteredOnVolumeMining(library, chainId, account) {
  const [isRegistered, setIsRegistered] = useState(undefined);
  useEffect(() => {
    if(!account) {
      setIsRegistered(undefined)
      return
    };
    const provider = getProvider(library, chainId);
    const tokenDistributorAddress = getContract(chainId, "TokenDistributor");
    const contract = new ethers.Contract(tokenDistributorAddress, TokenDistributor.abi, provider);
    contract.activeAccounts(account).then(result => {
      setIsRegistered(result)
    })
    .catch((e) => { console.log("e", e) });
  }, [setIsRegistered, library, chainId, account])

  return [isRegistered, setIsRegistered]
}

export function useLiquidationsData(chainId, account) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (account) {
      const query = gql(`{
         liquidatedPositions(
           where: {account: "${account.toLowerCase()}"}
           first: 100
           orderBy: timestamp
           orderDirection: desc
         ) {
           key
           timestamp
           borrowFee
           loss
           collateral
           size
           markPrice
           type
         }
      }`);
      const graphClient = getKfiGraphClient(chainId);
      graphClient
        .query({ query })
        .then((res) => {
          const _data = res.data.liquidatedPositions.map((item) => {
            return {
              ...item,
              size: bigNumberify(item.size),
              collateral: bigNumberify(item.collateral),
              markPrice: bigNumberify(item.markPrice),
            };
          });
          setData(_data);
        })
        .catch(console.warn);
    }
  }, [setData, chainId, account]);

  return data;
}

export function useAllPositions(chainId, library) {
  const count = 1000;
  const query = gql(`{
    aggregatedTradeOpens(
      first: ${count}
    ) {
      account
      initialPosition{
        indexToken
        collateralToken
        isLong
        sizeDelta
      }
      increaseList {
        sizeDelta
      }
      decreaseList {
        sizeDelta
      }
    }
  }`);

  const [res, setRes] = useState();

  useEffect(() => {
    positionsGraphClient.query({ query }).then(setRes).catch(console.warn);
  }, [setRes, query]);

  const key = res ? `allPositions${count}__` : false;
  const { data: positions = [] } = useSWR(key, async () => {
    const provider = getProvider(library, chainId);
    const vaultAddress = getContract(chainId, "Vault");
    const contract = new ethers.Contract(vaultAddress, Vault.abi, provider);
    const ret = await Promise.all(
      res.data.aggregatedTradeOpens.map(async (dataItem) => {
        try {
          const { indexToken, collateralToken, isLong } = dataItem.initialPosition;
          const positionData = await contract.getPosition(dataItem.account, collateralToken, indexToken, isLong);
          const position = {
            size: bigNumberify(positionData[0]),
            collateral: bigNumberify(positionData[1]),
            entryFundingRate: bigNumberify(positionData[3]),
            account: dataItem.account,
          };
          position.fundingFee = await contract.getFundingFee(collateralToken, position.size, position.entryFundingRate);
          position.marginFee = position.size.div(1000);
          position.fee = position.fundingFee.add(position.marginFee);

          const THRESHOLD = 5000;
          const collateralDiffPercent = position.fee.mul(10000).div(position.collateral);
          position.danger = collateralDiffPercent.gt(THRESHOLD);

          return position;
        } catch (ex) {
          console.error(ex);
        }
      })
    );

    return ret.filter(Boolean);
  });

  return positions;
}

export function useAllOrders(chainId, library) {
  const query = gql(`{
    orders(
      first: 1000,
      orderBy: createdTimestamp,
      orderDirection: desc,
      where: {status: "open", createdTimestamp_gt: 1666206221}
    ) {
      type
      account
      index
      status
      createdTimestamp
    }
  }`);

  const [res, setRes] = useState();

  useEffect(() => {
    getKfiGraphClient(chainId).query({ query }).then(setRes);
  }, [setRes, query, chainId]);

  const key = res ? res.data.orders.map((order) => `${order.type}-${order.account}-${order.index}`) : null;
  const { data: orders = [] } = useSWR(key, () => {
    const provider = getProvider(library, chainId);
    const orderBookAddress = getContract(chainId, "OrderBook");
    const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, provider);
    return Promise.all(
      res.data.orders.map(async (order) => {
        try {
          const type = order.type.charAt(0).toUpperCase() + order.type.substring(1);
          const method = `get${type}Order`;
          const orderFromChain = await contract[method](order.account, order.index);
          const ret = {};
          for (const [key, val] of Object.entries(orderFromChain)) {
            ret[key] = val;
          }
          if (order.type === "swap") {
            ret.path = [ret.path0, ret.path1, ret.path2].filter((address) => address !== AddressZero);
          }
          ret.type = type;
          ret.index = order.index;
          ret.account = order.account;
          ret.createdTimestamp = order.createdTimestamp;
          return ret;
        } catch (ex) {
          console.error(ex);
        }
      })
    );
  });

  return orders.filter(Boolean);
}

export function usePositionsForOrders(chainId, library, orders) {
  const key = orders ? orders.map((order) => getOrderKey(order) + "____") : null;
  const { data: positions = {} } = useSWR(key, async () => {
    const provider = getProvider(library, chainId);
    const vaultAddress = getContract(chainId, "Vault");
    const contract = new ethers.Contract(vaultAddress, Vault.abi, provider);
    const data = await Promise.all(
      orders.map(async (order) => {
        try {
          const position = await contract.getPosition(
            order.account,
            order.collateralToken,
            order.indexToken,
            order.isLong
          );
          if (position[0].eq(0)) {
            return [null, order];
          }
          return [position, order];
        } catch (ex) {
          console.error(ex);
        }
      })
    );
    return data.reduce((memo, [position, order]) => {
      memo[getOrderKey(order)] = position;
      return memo;
    }, {});
  });

  return positions;
}

function invariant(condition, errorMsg) {
  if (!condition) {
    throw new Error(errorMsg);
  }
}

export function useTradesFromGraph(chainId, account) {
  const [trades, setTrades] = useState();

  useEffect(() => {
    const queryString = account && account.length > 0 ? `where : { account: "${account.toLowerCase()}"}` : `where : { account: "0x111"}`;
    const query = gql(`{
      actionDatas ( orderBy: timestamp orderDirection: desc first:50 ${queryString} ) {
        id
        action
        account
        txhash
        blockNumber
        timestamp
        params
      }
    }`);

      getKfiGraphClient(chainId).query({ query }).then(setTrades);
  }, [setTrades, chainId, account]);

  return { trades };
}

export function useTrades(chainId, account) {
  const url =
    account && account.length > 0
      ? `${getServerBaseUrl(chainId)}/actions?account=${account}`
      : `${getServerBaseUrl(chainId)}/actions`;
  const { data: trades, mutate: updateTrades } = useSWR(url, {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  if (trades) {
    trades.sort((item0, item1) => {
      const data0 = item0.data;
      const data1 = item1.data;
      const time0 = parseInt(data0.timestamp);
      const time1 = parseInt(data1.timestamp);
      if (time1 > time0) {
        return 1;
      }
      if (time1 < time0) {
        return -1;
      }

      const block0 = parseInt(data0.blockNumber);
      const block1 = parseInt(data1.blockNumber);

      if (isNaN(block0) && isNaN(block1)) {
        return 0;
      }

      if (isNaN(block0)) {
        return 1;
      }

      if (isNaN(block1)) {
        return -1;
      }

      if (block1 > block0) {
        return 1;
      }

      if (block1 < block0) {
        return -1;
      }

      return 0;
    });
  }

  return { trades, updateTrades };
}

export function useMinExecutionFee(library, active, chainId, infoTokens) {
  const positionRouterAddress = getContract(chainId, "PositionRouter");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");

  const { data: minExecutionFee } = useSWR([active, chainId, positionRouterAddress, "minExecutionFee"], {
      dedupingInterval: 60000,
      fetcher: fetcher(library, PositionRouter),
  });

  const { data: gasPrice } = useSWR(["gasPrice", chainId], {
      dedupingInterval: 30000,
      fetcher: () => {
      return new Promise(async (resolve, reject) => {
        const provider = getProvider(library, chainId);
        if (!provider) {
          resolve(undefined);
          return;
        }

        try {
          const gasPrice = await provider.getGasPrice();
          resolve(gasPrice);
        } catch (e) {
          console.error(e);
        }
      });
    },
  });

  let multiplier;

  // multiplier for kava is just the average gas usage
  if (chainId === KAVA) {
    multiplier = 700000;
  }

  let finalExecutionFee = minExecutionFee;

  if (gasPrice && minExecutionFee) {
    const estimatedExecutionFee = gasPrice.mul(multiplier);
    if (estimatedExecutionFee.gt(minExecutionFee)) {
      finalExecutionFee = estimatedExecutionFee;
    }
  }

  const finalExecutionFeeUSD = getUsd(finalExecutionFee, nativeTokenAddress, false, infoTokens);
  const isFeeHigh = finalExecutionFeeUSD?.gt(expandDecimals(HIGH_EXECUTION_FEES_MAP[chainId], USD_DECIMALS));
  const errorMessage =
    isFeeHigh &&
    `The network cost to send transactions is high at the moment, please check the "Execution Fee" value before proceeding.`;

  return {
    minExecutionFee: finalExecutionFee,
    minExecutionFeeUSD: finalExecutionFeeUSD,
    minExecutionFeeErrorMessage: errorMessage,
  };
}



export function useUserReferralCode(library, chainId, account) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const { data: userReferralCode, mutate: mutateUserReferralCode } = useSWR(
    account && [`ReferralStorage:traderReferralCodes`, chainId, referralStorageAddress, "traderReferralCodes", account],
    {
      fetcher: fetcher(library, ReferralStorage),
    }
  );
  return {
    userReferralCode,
    mutateUserReferralCode,
  };
}
export function useReferrerTier(library, chainId, account) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const { data: referrerTier, mutate: mutateReferrerTier } = useSWR(
    account && [`ReferralStorage:referrerTiers`, chainId, referralStorageAddress, "referrerTiers", account],
    {
      dedupingInterval: 60000,
      fetcher: fetcher(library, ReferralStorage),
    }
  );
  return {
    referrerTier,
    mutateReferrerTier,
  };
}
export function useCodeOwner(library, chainId, account, code) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const { data: codeOwner, mutate: mutateCodeOwner } = useSWR(
    account && code && [`ReferralStorage:codeOwners`, chainId, referralStorageAddress, "codeOwners", code],
    {
      dedupingInterval: 30000,
      fetcher: fetcher(library, ReferralStorage),
    }
  );
  return {
    codeOwner,
    mutateCodeOwner,
  };
}

export async function approvePlugin(
  chainId,
  pluginAddress,
  { library, pendingTxns, setPendingTxns, sentMsg, failMsg }
) {
  const routerAddress = getContract(chainId, "Router");
  const contract = new ethers.Contract(routerAddress, Router.abi, library.getSigner());
  return callContract(chainId, contract, "approvePlugin", [pluginAddress], {
    gasLimit: bigNumberify(100000),
    sentMsg,
    failMsg,
    pendingTxns,
    setPendingTxns,
  });
}

export async function registerReferralCode(chainId, referralCode, { library, ...props }) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const contract = new ethers.Contract(referralStorageAddress, ReferralStorage.abi, library.getSigner());
  return callContract(chainId, contract, "registerCode", [referralCode], { ...props,gasLimit: bigNumberify(100000) });
}
export async function setTraderReferralCodeByUser(chainId, referralCode, { library, ...props }) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const contract = new ethers.Contract(referralStorageAddress, ReferralStorage.abi, library.getSigner());
  const codeOwner = await contract.codeOwners(referralCode);
  if (isAddressZero(codeOwner)) {
    helperToast.error("Referral code does not exist");
    return new Promise((resolve, reject) => {
      reject();
    });
  }
  return callContract(chainId, contract, "setTraderReferralCodeByUser", [referralCode], {
    ...props,
    gasLimit: bigNumberify(100000)
  });
}
export async function getReferralCodeOwner(chainId, referralCode) {
  const referralStorageAddress = getContract(chainId, "ReferralStorage");
  const provider = getProvider(null, chainId);
  const contract = new ethers.Contract(referralStorageAddress, ReferralStorage.abi, provider);
  const codeOwner = await contract.codeOwners(referralCode);
  return codeOwner;
}

export async function createSwapOrder(
  chainId,
  library,
  path,
  amountIn,
  minOut,
  triggerRatio,
  nativeTokenAddress,
  opts = {}
) {
  const executionFee = getConstant(chainId, "SWAP_ORDER_EXECUTION_GAS_FEE");
  const triggerAboveThreshold = false;
  let shouldWrap = false;
  let shouldUnwrap = false;
  opts.value = executionFee;

  if (path[0] === AddressZero) {
    shouldWrap = true;
    opts.value = opts.value.add(amountIn);
  }
  if (path[path.length - 1] === AddressZero) {
    shouldUnwrap = true;
  }
  path = replaceNativeTokenAddress(path, nativeTokenAddress);

  const params = [path, amountIn, minOut, triggerRatio, triggerAboveThreshold, executionFee, shouldWrap, shouldUnwrap];

  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());
  opts.gasLimit = bigNumberify(400000);

  return callContract(chainId, contract, "createSwapOrder", params, opts);
}

export async function createIncreaseOrder(
  chainId,
  library,
  nativeTokenAddress,
  path,
  amountIn,
  indexTokenAddress,
  minOut,
  sizeDelta,
  collateralTokenAddress,
  isLong,
  triggerPrice,
  opts = {}
) {
  invariant(!isLong || indexTokenAddress === collateralTokenAddress, "invalid token addresses");
  invariant(indexTokenAddress !== AddressZero, "indexToken is 0");
  invariant(collateralTokenAddress !== AddressZero, "collateralToken is 0");

  const fromETH = path[0] === AddressZero;

  path = replaceNativeTokenAddress(path, nativeTokenAddress);
  const shouldWrap = fromETH;
  const triggerAboveThreshold = !isLong;
  const executionFee = getConstant(chainId, "INCREASE_ORDER_EXECUTION_GAS_FEE");

  const params = [
    path,
    amountIn,
    indexTokenAddress,
    minOut,
    sizeDelta,
    collateralTokenAddress,
    isLong,
    triggerPrice,
    triggerAboveThreshold,
    executionFee,
    shouldWrap,
  ];

  if (!opts.value) {
    opts.value = fromETH ? amountIn.add(executionFee) : executionFee;
  }

  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());

  opts.gasLimit = bigNumberify(500000);

  return callContract(chainId, contract, "createIncreaseOrder", params, opts);
}

export async function createDecreaseOrder(
  chainId,
  library,
  indexTokenAddress,
  sizeDelta,
  collateralToken,
  receiveToken,
  collateralDelta,
  isLong,
  triggerPrice,
  triggerAboveThreshold,
  minOut,
  withdrawETH,
  opts = {}
) {
  invariant(!isLong || indexTokenAddress === collateralToken, "invalid token addresses");
  invariant(indexTokenAddress !== AddressZero, "indexToken is 0");
  invariant(collateralToken !== AddressZero, "collateralToken is 0");

  const executionFee = getConstant(chainId, "DECREASE_ORDER_EXECUTION_GAS_FEE");

  const params = [
    indexTokenAddress,
    sizeDelta,
    collateralToken,
    receiveToken,
    collateralDelta,
    isLong,
    triggerPrice,
    triggerAboveThreshold,
    minOut,
    withdrawETH,
  ];
  opts.value = executionFee;
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());

  opts.gasLimit = bigNumberify(400000);

  return callContract(chainId, contract, "createDecreaseOrder", params, opts);
}

export async function cancelSwapOrder(chainId, library, index, opts) {
  const params = [index];
  const method = "cancelSwapOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());

  opts.gasLimit = bigNumberify(300000);

  return callContract(chainId, contract, method, params, opts);
}

export async function cancelDecreaseOrder(chainId, library, index, opts) {
  const params = [index];
  const method = "cancelDecreaseOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());

  opts.gasLimit = bigNumberify(400000);

  return callContract(chainId, contract, method, params, opts);
}

export async function cancelIncreaseOrder(chainId, library, index, opts) {
  const params = [index];
  const method = "cancelIncreaseOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());

  opts.gasLimit = bigNumberify(400000);

  return callContract(chainId, contract, method, params, opts);
}

export function handleCancelOrder(chainId, library, order, opts) {
  let func;
  if (order.type === SWAP) {
    func = cancelSwapOrder;
  } else if (order.type === INCREASE) {
    func = cancelIncreaseOrder;
  } else if (order.type === DECREASE) {
    func = cancelDecreaseOrder;
  }

  return func(chainId, library, order.index, {
    successMsg: "Order cancelled.",
    failMsg: "Cancel failed.",
    sentMsg: "Cancel submitted.",
    pendingTxns: opts.pendingTxns,
    setPendingTxns: opts.setPendingTxns,
  });
}

export async function cancelMultipleOrders(chainId, library, allIndexes = [], opts) {
  const ordersWithTypes = groupBy(allIndexes, (v) => v.split("-")[0]);
  function getIndexes(key) {
    if (!ordersWithTypes[key]) return;
    return ordersWithTypes[key].map((d) => d.split("-")[1]);
  }
  // params order => swap, increase, decrease
  const params = ["Swap", "Increase", "Decrease"].map((key) => getIndexes(key) || []);
  const method = "cancelMultiple";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());
  return callContract(chainId, contract, method, params, opts);
}

export async function updateDecreaseOrder(
  chainId,
  library,
  index,
  collateralDelta,
  sizeDelta,
  triggerPrice,
  triggerAboveThreshold,
  opts
) {
  const params = [index, collateralDelta, sizeDelta, triggerPrice, triggerAboveThreshold];
  const method = "updateDecreaseOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());
  
  opts.gasLimit = bigNumberify(100000);

  return callContract(chainId, contract, method, params, opts);
}

export async function updateIncreaseOrder(
  chainId,
  library,
  index,
  sizeDelta,
  triggerPrice,
  triggerAboveThreshold,
  opts
) {
  const params = [index, sizeDelta, triggerPrice, triggerAboveThreshold];
  const method = "updateIncreaseOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());
  opts.gasLimit = bigNumberify(100000);
  return callContract(chainId, contract, method, params, opts);
}

export async function updateSwapOrder(chainId, library, index, minOut, triggerRatio, triggerAboveThreshold, opts) {
  const params = [index, minOut, triggerRatio, triggerAboveThreshold];
  const method = "updateSwapOrder";
  const orderBookAddress = getContract(chainId, "OrderBook");
  const contract = new ethers.Contract(orderBookAddress, OrderBook.abi, library.getSigner());
  opts.gasLimit = bigNumberify(100000);

  return callContract(chainId, contract, method, params, opts);
}

export async function _executeOrder(chainId, library, method, account, index, feeReceiver, opts) {
  const params = [account, index, feeReceiver];
  const positionManagerAddress = getContract(chainId, "PositionManager");
  const contract = new ethers.Contract(positionManagerAddress, PositionManager.abi, library.getSigner());
  return callContract(chainId, contract, method, params, opts);
}

export function executeSwapOrder(chainId, library, account, index, feeReceiver, opts) {
  return _executeOrder(chainId, library, "executeSwapOrder", account, index, feeReceiver, opts);
}

export function executeIncreaseOrder(chainId, library, account, index, feeReceiver, opts) {
  return _executeOrder(chainId, library, "executeIncreaseOrder", account, index, feeReceiver, opts);
}

export function executeDecreaseOrder(chainId, library, account, index, feeReceiver, opts) {
  return _executeOrder(chainId, library, "executeDecreaseOrder", account, index, feeReceiver, opts);
}

const NOT_ENOUGH_FUNDS = "NOT_ENOUGH_FUNDS";
const USER_DENIED = "USER_DENIED";
const SLIPPAGE = "SLIPPAGE";
const TX_ERROR_PATTERNS = {
  [NOT_ENOUGH_FUNDS]: ["not enough funds for gas", "failed to execute call with revert code InsufficientGasFunds"],
  [USER_DENIED]: ["User denied transaction signature", "user rejected transaction"],
  [SLIPPAGE]: ["Router: mkt. price lower than limit", "Router: mkt. price higher than limit"],
};
export function extractError(ex) {
  if (!ex) {
    return [];
  }
  const message = ex.data?.message || ex.message;
  if (!message) {
    return [];
  }
  for (const [type, patterns] of Object.entries(TX_ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (message.includes(pattern)) {
        return [message, type];
      }
    }
  }
  return [message];
}

function ToastifyDebug(props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="Toastify-debug">
      {!open && (
        <span className="Toastify-debug-button" onClick={() => setOpen(true)}>
          Show error
        </span>
      )}
      {open && props.children}
    </div>
  );
}

export async function callContract(chainId, contract, method, params, opts) {
  try {
    if (!Array.isArray(params) && typeof params === "object" && opts === undefined) {
      opts = params;
      params = [];
    }
    if (!opts) {
      opts = {};
    }

    const txnOpts = {};

    if (opts.value) {
      txnOpts.value = opts.value;
    }

    txnOpts.gasLimit = opts.gasLimit ? opts.gasLimit : await getGasLimit(contract, method, params, opts.value);

    await setGasPrice(txnOpts, contract.provider, chainId);
    const res = await contract[method](...params, txnOpts);
    const txUrl = getExplorerUrl(chainId) + "tx/" + res.hash;
    const sentMsg = opts.sentMsg || "Transaction sent.";
    helperToast.success(
      <div>
        {sentMsg}{" "}
        <a style={{ color: "#FF7847" }} href={txUrl} target="_blank" rel="noopener noreferrer">
          View status.
        </a>
        <br />
      </div>
    );
    if (opts.setPendingTxns) {
      const pendingTxn = {
        hash: res.hash,
        message: opts.successMsg || "Transaction completed!",
      };
      opts.setPendingTxns((pendingTxns) => [...pendingTxns, pendingTxn]);
    }
    return res;
  } catch (e) {
    let failMsg;
    const [message, type] = extractError(e);
    switch (type) {
      case NOT_ENOUGH_FUNDS:
        failMsg = <div>There is not enough KAVA in your account on KAVA to send this transaction.</div>;
        if (opts.showModal) {
          opts.showModal(<TradeFailed />)
        }
        break;
      case USER_DENIED:
        failMsg = "Transaction was cancelled.";
        break;
      case SLIPPAGE:
        failMsg =
          'The mkt. price has changed, consider increasing your Allowed Slippage by clicking on the "..." icon next to your address.';
        if (opts.showModal) {
          opts.showModal(<TradeFailed />)
        }
        break;
      default:
        failMsg = (
          <div>
            {opts.failMsg || "Transaction failed."}
            <br />
            {message && <ToastifyDebug>{message}</ToastifyDebug>}
          </div>
        );
        if (opts.showModal) {
          opts.showModal(<TradeFailed />)
        }
    }
    helperToast.error(failMsg);
    throw e;
  }
}

export function useTotalVolume() {
  const swrKey = ["getTotalVolume"];
  let { data: totalVolume } = useSWR(swrKey, {
    fetcher: async (...args) => {
      try {
        return await getTotalVolumeFromGraph();
      } catch (ex2) {
        console.warn("getTotalVolumeFromGraph failed");
        console.warn(ex2);
        return [];
      }
      // }
    },
    dedupingInterval: 30000,
    focusThrottleInterval: 60000 * 5,
  });

  return totalVolume;
}

function getTotalVolumeFromGraph() {
  const requests = [];
  const nowTs = parseInt(Date.now() / 1000);

  const query = gql(`{
      volumeStats( 
        where: {period: total , timestamp_lte: ${nowTs}}  
        ) 
     {  
       margin    
       liquidation    
       swap    
       mint    
       burn
      }
    }`);
  requests.push(kavaGraphClient.query({ query }));

  return Promise.all(requests)
    .then((chunks) => {
      let totalVolume;
      chunks.forEach((chunk) => {
        chunk.data.volumeStats.forEach((item) => {
          totalVolume = bigNumberify(item.margin)
            .add(bigNumberify(item.liquidation))
            .add(bigNumberify(item.swap))
            .add(bigNumberify(item.mint))
            .add(bigNumberify(item.burn));
        });
      });

      return totalVolume;
    })
    .catch((err) => {
      console.error(err);
    });
}

export function useHourlyVolume() {
  const swrKey = ["getHourlyVolume"];
  let { data: hourlyVolume } = useSWR(swrKey, {
    fetcher: async (...args) => {
      try {
        return await getHourlyVolumeFromGraph();
      } catch (ex2) {
        console.warn("getHourlyVolumeFromGraph failed");
        console.warn(ex2);
        return [];
      }
      // }
    },
    dedupingInterval: 30000,
    focusThrottleInterval: 60000 * 5,
  });

  return hourlyVolume;
}

function getHourlyVolumeFromGraph() {
  const requests = [];
  const secondsPerHour = 60 * 60;
  const minTime = parseInt(Date.now() / 1000 / secondsPerHour) * secondsPerHour - 24 * secondsPerHour;
  const nowTs = parseInt(Date.now() / 1000);

  const query = gql(`{
      volumeStats(
        where: {period: hourly, timestamp_gte: ${minTime}, timestamp_lte: ${nowTs}}
        orderBy: timestamp
        orderDirection: desc
        first: 50
      ) {
        timestamp
        margin
        liquidation
        swap
        mint
        burn
        __typename
      }
    }`);
  requests.push(kavaGraphClient.query({ query }));

  return Promise.all(requests)
    .then((chunks) => {
      let hourlyVolume = bigNumberify(0);
      chunks.forEach((chunk) => {
        chunk.data.volumeStats.forEach((item) => {
          hourlyVolume = hourlyVolume
            .add(bigNumberify(item.margin))
            .add(bigNumberify(item.liquidation))
            .add(bigNumberify(item.swap))
            .add(bigNumberify(item.mint))
            .add(bigNumberify(item.burn));
        });
      });
      return hourlyVolume;
    })
    .catch((err) => {
      console.error(err);
    });
}

export function useTotalFees() {
  const swrKey = ["getTotalFees"];
  let { data: totalFees } = useSWR(swrKey, {
    fetcher: async (...args) => {
      try {
        return await getTotalFeesFromGraph();
      } catch (ex2) {
        console.warn("getTotalFeesFromGraph failed");
        console.warn(ex2);
        return [];
      }
      // }
    },
    dedupingInterval: 30000,
    focusThrottleInterval: 60000 * 5,
  });

  return totalFees;
}

function getTotalFeesFromGraph() {
  const requests = [];

  const nowTs = parseInt(Date.now() / 1000);

  const query = gql(`{
    feeStats(
      first: 1000
      orderBy: id
      orderDirection: desc
      where: { period: daily, timestamp_gte: ${FIRST_DATE_TS}, timestamp_lte: ${nowTs} }
    ) {
      id
      margin
      marginAndLiquidation
      swap
      mint
      burn
      timestamp
    }
  }`);

  requests.push(kavaGraphClient.query({ query }));

  return Promise.all(requests)
    .then((chunks) => {
      let totalFees = bigNumberify(0);
      chunks.forEach((chunk) => {
        chunk.data.feeStats.forEach((item) => {
          totalFees = totalFees
            .add(bigNumberify(item.marginAndLiquidation))
            .add(bigNumberify(item.swap))
            .add(bigNumberify(item.mint))
            .add(bigNumberify(item.burn));
        });
      });

      return totalFees;
    })
    .catch((err) => {
      console.error(err);
    });
}

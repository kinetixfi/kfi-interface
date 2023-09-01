import React, { useState, useEffect, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import useSWR from "swr";
import { ethers } from "ethers";

import Tab from "../Tab/Tab";
import cx from "classnames";

import { getToken, getTokens, getWhitelistedTokens, getWrappedToken, getNativeToken } from "../../data/Tokens";
import { getContract } from "../../Addresses";
import {
  helperToast,
  useLocalStorageByChainId,
  getTokenInfo,
  // getChainName,
  useChainId,
  expandDecimals,
  fetcher,
  bigNumberify,
  formatAmount,
  formatAmountFree,
  formatKeyAmount,
  // formatDateTime,
  getBuyKlpToAmount,
  getBuyKlpFromAmount,
  getSellKlpFromAmount,
  getSellKlpToAmount,
  parseValue,
  approveTokens,
  getUsd,
  adjustForDecimals,
  KLP_DECIMALS,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  KLP_COOLDOWN_DURATION,
  SECONDS_PER_YEAR,
  USDK_DECIMALS,
  KAVA,
  PLACEHOLDER_ACCOUNT,
  KLP_DISPLAY_DECIMALS,
} from "../../Helpers";

import { callContract, useAllTokensPerInterval, useInfoTokens } from "../../Api";

import TokenSelector from "../Exchange/TokenSelector";
import BuyInputSection from "../BuyInputSection/BuyInputSection";
import Tooltip from "../Tooltip/Tooltip";

import Reader from "../../abis/Reader.json";
import RewardReader from "../../abis/RewardReader.json";
import Vault from "../../abis/Vault.json";
import KlpManager from "../../abis/KlpManager.json";
import RewardTracker from "../../abis/RewardTracker.json";
import RewardRouter from "../../abis/RewardRouter.json";
import Token from "../../abis/Token.json";
import FeeKlpTracker from "../../abis/FeeKlpTracker.json";

import klp24Icon from "../../img/ic_klp_24.svg";
import klp40Icon from "../../assets/icons/klpCoin.svg";
import arrowIcon from "../../img/ic_convert_down.svg";

import "./KlpSwap.css";
import AssetDropdown from "../../views/Dashboard/AssetDropdown";
import { getImageUrl } from "../../cloudinary/getImageUrl";
import Stake from "../../views/Stake/Stake";
import useWeb3Onboard from "../../hooks/useWeb3Onboard";

const { AddressZero } = ethers.constants;

export default function KlpSwap(props) {
  const { savedSlippageAmount, isBuying, setPendingTxns, connectWallet, setIsBuying } = props;
  const history = useHistory();
  const swapLabel = isBuying ? "Add Liquidity" : "Withdraw Liquidity";
  const tabLabel = isBuying ? "Add Liquidity" : "Withdraw Liquidity";
  const { active, library, account } = useWeb3Onboard();
  const { chainId } = useChainId();
  // const chainName = getChainName(chainId)
  const tokens = getTokens(chainId);
  const whitelistedTokens = getWhitelistedTokens(chainId);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);
  const [swapValue, setSwapValue] = useState("");
  const [klpValue, setKlpValue] = useState("");
  const [swapTokenAddress, setSwapTokenAddress] = useLocalStorageByChainId(
    chainId,
    `${swapLabel}-swap-token-address`,
    AddressZero
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anchorOnSwapAmount, setAnchorOnSwapAmount] = useState(true);
  const [feeBasisPoints, setFeeBasisPoints] = useState("");

  const readerAddress = getContract(chainId, "Reader");
  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const feeKlpTrackerAddress = getContract(chainId, "FeeKlpTracker");
  const usdkAddress = getContract(chainId, "USDK");
  const klpAddress = getContract(chainId, "KLP");
  const klpManagerAddress = getContract(chainId, "KlpManager");
  const rewardRouterAddress = getContract(chainId, "RewardRouter");
  const tokensForBalanceAndSupplyQuery = [klpAddress, usdkAddress];

  const tokenAddresses = tokens.map((token) => token.address);


  const { data: tokenBalances } = useSWR(
    [`KlpSwap:getTokenBalances:${active}`, chainId, readerAddress, "getTokenBalances", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, Reader, [tokenAddresses]),
    }
  );
  const { infoTokens } = useInfoTokens(library, chainId, active, tokenBalances, undefined);
  const nativeToken = getTokenInfo(infoTokens, AddressZero);

  const { data: balancesAndSupplies } = useSWR(
    [
      `KlpSwap:getTokenBalancesWithSupplies:${active}`,
      chainId,
      readerAddress,
      "getTokenBalancesWithSupplies",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(library, Reader, [tokensForBalanceAndSupplyQuery]),
    }
  );

  const { data: aums } = useSWR([`KlpSwap:getAums:${active}`, chainId, klpManagerAddress, "getAums"], {
    fetcher: fetcher(library, KlpManager),
  });

  const { data: totalTokenWeights } = useSWR(
    [`KlpSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      fetcher: fetcher(library, Vault),
    }
  );

  const tokenAllowanceAddress = swapTokenAddress === AddressZero ? nativeTokenAddress : swapTokenAddress;
  const { data: tokenAllowance } = useSWR(
    [active, chainId, tokenAllowanceAddress, "allowance", account || PLACEHOLDER_ACCOUNT, klpManagerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const { data: lastPurchaseTime } = useSWR(
    [`KlpSwap:lastPurchaseTime:${active}`, chainId, klpManagerAddress, "lastAddedAt", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, KlpManager),
    }
  );

  const { data: klpBalance } = useSWR(
    [`KlpSwap:klpBalance:${active}`, chainId, feeKlpTrackerAddress, "stakedAmounts", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, RewardTracker),
    }
  );

  const redemptionTime = lastPurchaseTime ? lastPurchaseTime.add(KLP_COOLDOWN_DURATION) : undefined;
  const inCooldownWindow = redemptionTime && parseInt(Date.now() / 1000) < redemptionTime;

  const klpSupply = balancesAndSupplies ? balancesAndSupplies[1] : bigNumberify(0);
  const usdkSupply = balancesAndSupplies ? balancesAndSupplies[3] : bigNumberify(0);
  let aum;
  if (aums && aums.length > 0) {
    aum = isBuying ? aums[0] : aums[1];
  }
  const klpPrice =
    aum && aum.gt(0) && klpSupply.gt(0)
      ? aum.mul(expandDecimals(1, KLP_DECIMALS)).div(klpSupply)
      : expandDecimals(1, USD_DECIMALS);
  let klpBalanceUsd;
  if (klpBalance) {
    klpBalanceUsd = klpBalance.mul(klpPrice).div(expandDecimals(1, KLP_DECIMALS));
  }
  const klpSupplyUsd = klpSupply.mul(klpPrice).div(expandDecimals(1, KLP_DECIMALS));

  const reservedAmount = bigNumberify(0);

  let reserveAmountUsd;
  if (reservedAmount) {
    reserveAmountUsd = reservedAmount.mul(klpPrice).div(expandDecimals(1, KLP_DECIMALS));
  }

  const swapToken = getToken(chainId, swapTokenAddress);
  const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);

  const swapTokenBalance = swapTokenInfo && swapTokenInfo.balance ? swapTokenInfo.balance : bigNumberify(0);

  const swapAmount = parseValue(swapValue, swapToken && swapToken.decimals);
  const klpAmount = parseValue(klpValue, KLP_DECIMALS);

  const needApproval =
    isBuying && swapTokenAddress !== AddressZero && tokenAllowance && swapAmount && swapAmount.gt(tokenAllowance);

  const swapUsdMin = getUsd(swapAmount, swapTokenAddress, false, infoTokens);
  const klpUsdMax =
    klpAmount && klpPrice ? klpAmount.mul(klpPrice).div(expandDecimals(1, KLP_DECIMALS)) : undefined;

  let isSwapTokenCapReached;
  if (swapTokenInfo.managedUsd && swapTokenInfo.maxUsdkAmount) {
    isSwapTokenCapReached = swapTokenInfo.managedUsd.gt(
      adjustForDecimals(swapTokenInfo.maxUsdkAmount, USDK_DECIMALS, USD_DECIMALS)
    );
  }

  const onSwapValueChange = (e) => {
    setAnchorOnSwapAmount(true);
    setSwapValue(e.target.value);
  };

  const onKlpValueChange = (e) => {
    setAnchorOnSwapAmount(false);
    setKlpValue(e.target.value);
  };

  const onSelectSwapToken = (token) => {
    setSwapTokenAddress(token.address);
    setIsWaitingForApproval(false);
  };

  const pkfiPrice = expandDecimals(2, 28);


  let totalApr = useRef(bigNumberify(0));
  let totalRewardsInUsd = useRef(bigNumberify(0));


  const { data: claimableAll } = useSWR(
    [`Stake:claimableAll:${active}`, chainId, feeKlpTrackerAddress, "claimableAll", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, FeeKlpTracker, []),
    }
  );

  const [allTokensPerInterval,] = useAllTokensPerInterval(library, chainId)


  const [apr, tokensApr] = useMemo(() => {
    let annualRewardsInUsd = bigNumberify(0);
    let tokensApr = []
    if (!Array.isArray(allTokensPerInterval) && allTokensPerInterval.length === 0) return [,];
    if (klpSupply.eq(0)) return  [,];
    if (klpSupply.lt(expandDecimals(1, USDK_DECIMALS))) return  [,];
    if (klpPrice.eq(0)) return  [,];
    for (let i = 0; i < allTokensPerInterval.length; i++) {
      let tokenApr = {}
      const [tokenAddress, tokensPerInterval] = allTokensPerInterval[i];
      let tokenPrice = bigNumberify(0)
      let tokenDecimals = 18;
      if (tokenAddress === getContract(chainId, "PKFI")) {
        tokenPrice = pkfiPrice;
        tokenApr.symbol = "PKFI"
      } else {
        const token = infoTokens[tokenAddress];
        if (token && token.maxPrice) {
          tokenApr.symbol = token.symbol
          tokenPrice = token.maxPrice;
          tokenDecimals = token.decimals
        }
      }

      const tokenAnnualRewardsInUsd = tokenPrice.mul(tokensPerInterval).mul(86400).mul(365).div(expandDecimals(1, 30)).div(expandDecimals(1, tokenDecimals))
      tokenApr.apr = tokenAnnualRewardsInUsd.mul(10000).mul(expandDecimals(1, USD_DECIMALS)).div(klpPrice).div(klpSupply.div(expandDecimals(1, USDK_DECIMALS)))/100
      tokensApr.push(tokenApr)
      annualRewardsInUsd = annualRewardsInUsd.add(tokenAnnualRewardsInUsd);
    }

    const apr = annualRewardsInUsd.mul(10000).mul(expandDecimals(1, USD_DECIMALS)).div(klpPrice).div(klpSupply.div(expandDecimals(1, USDK_DECIMALS)))
    return [apr.toNumber() / 100, tokensApr];
  }, [allTokensPerInterval, pkfiPrice, infoTokens, klpSupply, klpPrice, chainId])

  const rewardTokens = useMemo(() => {
    if (!Array.isArray(claimableAll) || claimableAll.length !== 2) return [];
    const [claimableTokens, claimableRewards] = claimableAll
    const result = [];
    for (let i = 0; i < claimableTokens.length; i++) {
      const reward = claimableRewards[i];
      if (claimableTokens[i] === getContract(chainId, "PKFI")) {
        const rewardInUsd = pkfiPrice.mul(reward).div(expandDecimals(1, 18))
        totalRewardsInUsd.current = totalRewardsInUsd.current.add(rewardInUsd);
        totalApr.current = totalRewardsInUsd.current.mul
        result.push({ token: { address: claimableTokens[i], symbol: "PKFI", rewardDisplayDecimals: 2 }, reward, rewardInUsd });
      } else {
        const token = infoTokens[claimableTokens[i]];
        if (token) {
          const rewardInUsd = token.maxPrice && token.maxPrice.mul(reward).div(expandDecimals(1, token.decimals))
          result.push({ token, reward, rewardInUsd });
        }
      }
    }
    return result;
  }, [claimableAll, chainId, pkfiPrice, infoTokens])

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnSwapAmount) {
        if (!swapAmount) {
          setKlpValue("");
          setFeeBasisPoints("");
          return;
        }

        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyKlpToAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            klpPrice,
            usdkSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, KLP_DECIMALS, KLP_DECIMALS);
          setKlpValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellKlpFromAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            klpPrice,
            usdkSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, KLP_DECIMALS, KLP_DECIMALS);
          setKlpValue(nextValue);
          setFeeBasisPoints(feeBps);
        }

        return;
      }

      if (!klpAmount) {
        setSwapValue("");
        setFeeBasisPoints("");
        return;
      }

      if (swapToken) {
        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyKlpFromAmount(
            klpAmount,
            swapTokenAddress,
            infoTokens,
            klpPrice,
            usdkSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellKlpToAmount(
            klpAmount,
            swapTokenAddress,
            infoTokens,
            klpPrice,
            usdkSupply,
            totalTokenWeights,
            true
          );

          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        }
      }
    };

    updateSwapAmounts();
  }, [
    isBuying,
    anchorOnSwapAmount,
    swapAmount,
    klpAmount,
    swapToken,
    swapTokenAddress,
    infoTokens,
    klpPrice,
    usdkSupply,
    totalTokenWeights,
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const switchSwapOption = (hash = "") => {
    history.push(`${history.location.pathname}#${hash}`);
    props.setIsBuying(hash === "redeem" ? false : true);
  };

  const fillMaxAmount = () => {
    if (isBuying) {
      setAnchorOnSwapAmount(true);
      setSwapValue(formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals));
      return;
    }

    setAnchorOnSwapAmount(false);
    setKlpValue(formatAmountFree(maxSellAmount, KLP_DECIMALS, KLP_DECIMALS));
  };

  const getError = () => {
    if (!isBuying && inCooldownWindow) {
      return [`Redemption time not yet reached`];
    }

    if (!swapAmount || swapAmount.eq(0)) {
      return ["Enter an amount"];
    }
    if (!klpAmount || klpAmount.eq(0)) {
      return ["Enter an amount"];
    }

    if (isBuying) {
      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (swapTokenInfo && swapTokenInfo.balance && swapAmount && swapAmount.gt(swapTokenInfo.balance)) {
        return [`Insufficient ${swapTokenInfo.symbol} Balance`];
      }

      if (swapTokenInfo.maxUsdkAmount && swapTokenInfo.usdkAmount && swapUsdMin) {
        const usdkFromAmount = adjustForDecimals(swapUsdMin, USD_DECIMALS, USDK_DECIMALS);
        const nextUsdkAmount = swapTokenInfo.usdkAmount.add(usdkFromAmount);
        if (swapTokenInfo.maxUsdkAmount.gt(0) && nextUsdkAmount.gt(swapTokenInfo.maxUsdkAmount)) {
          return [`${swapTokenInfo.symbol} pool exceeded, try different token`, true];
        }
      }
    }

    if (!isBuying) {
      if (maxSellAmount && klpAmount && klpAmount.gt(maxSellAmount)) {
        return [`Insufficient KLP Balance`];
      }

      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (
        swapTokenInfo &&
        swapTokenInfo.availableAmount &&
        swapAmount &&
        swapAmount.gt(swapTokenInfo.availableAmount)
      ) {
        return [`Insufficient Liquidity`];
      }
    }

    return [false];
  };

  const isPrimaryEnabled = () => {
    if (!active) {
      return true;
    }
    const [error, modal] = getError();
    if (error) {
      // console.error(error);
    }
    if (error && !modal) {
      return false;
    }
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }
    if (isBuying && isSwapTokenCapReached) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    if (!active) {
      return "Connect Wallet";
    }
    const [error, modal] = getError();
    if (error) {
      // console.error(error);
    }

    if (error && !modal) {
      return error;
    }
    if (isBuying && isSwapTokenCapReached) {
      return `Max Capacity for ${swapToken.symbol} Reached`;
    }

    if (needApproval && isWaitingForApproval) {
      return "Waiting for Approval";
    }
    if (isApproving) {
      return `Approving ${swapToken.symbol}...`;
    }
    if (needApproval) {
      return `Approve ${swapToken.symbol}`;
    }

    if (isSubmitting) {
      return isBuying ? `Providing...` : `Removing Liquidity ...`;
    }

    return isBuying ? "Add Liquidity" : "Withdraw Liquidity";
  };

  const approveFromToken = () => {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: swapToken.address,
      spender: klpManagerAddress,
      chainId: chainId,
      onApproveSubmitted: () => {
        setIsWaitingForApproval(true);
      },
      infoTokens,
      getTokenInfo,
    });
  };

  const buyKlp = () => {
    setIsSubmitting(true);

    const minKlp = klpAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "mintAndStakeKlpETH" : "mintAndStakeKlp";
    const params = swapTokenAddress === AddressZero ? [0, minKlp] : [swapTokenAddress, swapAmount, 0, minKlp];
    const value = swapTokenAddress === AddressZero ? swapAmount : 0;

    callContract(chainId, contract, method, params, {
      gasLimit: bigNumberify(1600000),
      value,
      sentMsg: "Providing...",
      failMsg: "Add Liquidity failed.",
      successMsg: `${formatAmount(swapAmount, swapTokenInfo.decimals, 4, true)} ${swapTokenInfo.symbol
        } provided for ${formatAmount(klpAmount, 18, 4, true)} KLP !`,
      setPendingTxns,
    })
      .then(async () => { })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const sellKlp = () => {
    setIsSubmitting(true);

    const minOut = swapAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "unstakeAndRedeemKlpETH" : "unstakeAndRedeemKlp";

    const params =
      swapTokenAddress === AddressZero
        ? [klpAmount, minOut, account]
        : [swapTokenAddress, klpAmount, minOut, account];

    callContract(chainId, contract, method, params, {
      gasLimit: bigNumberify(1500000),
      sentMsg: "Providing...",
      failMsg: "Remove Liquidity failed.",
      successMsg: `${formatAmount(klpAmount, 18, 4, true)} KLP removed for ${formatAmount(
        swapAmount,
        swapTokenInfo.decimals,
        4,
        true
      )} ${swapTokenInfo.symbol}!`,
      setPendingTxns,
    })
      .then(async () => { })
      .finally(() => {
        setIsSubmitting(false);
      });
  };


  const migrateStaking = () => {
    setIsSubmitting(true);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = "migrateStaking";

    callContract(chainId, contract, method, [], {
      sentMsg: "Migrate Staking submitted!",
      failMsg: "Migrate Staking failed.",
      successMsg: `Migration succeeded`,
      setPendingTxns,
    })
      .then(async () => { })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const onClickPrimary = () => {
    if (!active) {
      connectWallet();
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    const [error, modal] = getError();
    if (error) {
      // console.error(error);
    }

    if (modal) {
      return;
    }

    if (isBuying) {
      buyKlp();
    } else {
      sellKlp();
    }
  };

  let payLabel = "Pay";
  let receiveLabel = "Receive";
  let payBalance = "$0.00";
  let receiveBalance = "$0.00";
  if (isBuying) {
    if (swapUsdMin) {
      payBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
    if (klpUsdMax) {
      receiveBalance = `$${formatAmount(klpUsdMax, USD_DECIMALS, 2, true)}`;
    }
  } else {
    if (klpUsdMax) {
      payBalance = `$${formatAmount(klpUsdMax, USD_DECIMALS, 2, true)}`;
    }
    if (swapUsdMin) {
      receiveBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
  }

  const selectToken = (token) => {
    setAnchorOnSwapAmount(false);
    setSwapTokenAddress(token.address);
    helperToast.success(`${token.symbol} selected in order form`);
  };

  let feePercentageText = formatAmount(feeBasisPoints, 2, 2, true, "-");
  if (feeBasisPoints !== undefined && feeBasisPoints.toString().length > 0) {
    feePercentageText += "%";
  }

  let maxSellAmount = klpBalance;
  if (klpBalance && reservedAmount) {
    maxSellAmount = klpBalance.sub(reservedAmount);
  }

  const wrappedTokenSymbol = getWrappedToken(chainId).symbol;
  const nativeTokenSymbol = getNativeToken(chainId).symbol;

  const onSwapOptionChange = (opt) => {
    if (opt === "Withdraw Liquidity") {
      switchSwapOption("redeem");
    } else {
      switchSwapOption();
    }
  };

  return (
    <div className="KlpSwap">
      <div className="KlpSwap-content">
        <div className="App-card KlpSwap-stats-card">
          <div className="App-card-title">
            <div className="App-card-title-mark">
              <div className="App-card-title-mark-icon">
                <img style={{ width: 48, height: 48 }} src={klp40Icon} alt="klp40Icon" />
              </div>
              <div className="App-card-title-mark-info">
                <div className="App-card-title-mark-title">KLP</div>
              </div>
            </div>
          </div>
          <div className="App-card-divider"></div>
          <div className="App-card-content">
            <div className="App-card-row">
              <div className="label">Price</div>
              <div className="value">${formatAmount(klpPrice, USD_DECIMALS, KLP_DISPLAY_DECIMALS, true)}</div>
            </div>
            <div className="App-card-row">
              <div className="label">Wallet</div>
              <div className="value">
                {formatAmount(klpBalance, KLP_DECIMALS, 4, true)} KLP ($
                {formatAmount(klpBalanceUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
            
          </div>
          <div className="App-card-divider"></div>
          <div className="App-card-content">
            {/* {!isBuying && (
              <div className="App-card-row">
                <div className="label">Reserved</div>
                <div className="value">
                  <Tooltip
                    handle={`${formatAmount(reservedAmount, 18, 4, true)} KLP ($${formatAmount(
                      reserveAmountUsd,
                      USD_DECIMALS,
                      2,
                      true
                    )})`}
                    position="right-bottom"
                    renderContent={() => `${formatAmount(reservedAmount, 18, 4, true)} Reserved KLP for vesting.`}
                  />
                </div>
              </div>
            )} */}
            <div className="App-airdrop-row">
              <div>
                <div className="label">APR</div>
                <div className="value flex">
                  {/* <span className="positive" style={{ marginRight: 6 }}>
                    {apr || "..."}%
                  </span> */}
                  <Tooltip
                    className="positive"
                    handle={`${apr || "..."}%`}
                    position="right-bottom"
                    renderContent={() => {
                      console.log("tokensApr", tokensApr);
                      return (
                        <>
                          {tokensApr && tokensApr.map(t => {
                            return (
                            <div className="Tooltip-row">
                              <span className="label">
                                {t.symbol} APR
                              </span>
                              <span>{t.apr}%</span>
                            </div>
                            )
                          })
                          }
                        </>
                      );
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="App-card-row">
              <div className="label">Total Supply</div>
              <div className="value">
                {formatAmount(klpSupply, KLP_DECIMALS, 4, true)} KLP ($
                {formatAmount(klpSupplyUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
          </div>
        </div>
        <div className="KlpSwap-box App-box basis-mobile">
          <Tab
            options={["Add Liquidity", "Withdraw Liquidity"]}
            option={tabLabel}
            onChange={onSwapOptionChange}
            className="Exchange-swap-option-tabs"
          />
          {isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              showMaxButton={swapValue !== formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              selectedToken={swapToken}
              balance={payBalance}
            >
              <TokenSelector
                label="Pay"
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                className="KlpSwap-from-token"
                showSymbolImage={true}
                showTokenImgInDropdown={true}
              />
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={`Available: `}
              tokenBalance={`${formatAmount(maxSellAmount, KLP_DECIMALS, 4, true)}`}
              inputValue={klpValue}
              onInputValueChange={onKlpValueChange}
              showMaxButton={klpValue !== formatAmountFree(maxSellAmount, KLP_DECIMALS, KLP_DECIMALS)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              balance={payBalance}
              defaultTokenName={"KLP"}
            >
              <div className="selected-token">
                <img width={24} height={24} src={klp24Icon} alt="klp24Icon" />KLP
              </div>
            </BuyInputSection>
          )}

          <div className="AppOrder-ball-container">
            <div className="AppOrder-ball">
              <img
                src={arrowIcon}
                alt="arrowIcon"
                onClick={() => {
                  setIsBuying(!isBuying);
                  switchSwapOption(isBuying ? "redeem" : "");
                }}
              />
            </div>
          </div>

          {isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(klpBalance, KLP_DECIMALS, 4, true)}`}
              inputValue={klpValue}
              onInputValueChange={onKlpValueChange}
              balance={receiveBalance}
              defaultTokenName={"KLP"}
            >
              <div className="selected-token">
                <img width={24} height={24} src={klp24Icon} alt="klp24Icon" /> KLP
              </div>
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              balance={receiveBalance}
              selectedToken={swapToken}
            >
              <TokenSelector
                label="Receive"
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                className="KlpSwap-from-token"
                showSymbolImage={true}
                showTokenImgInDropdown={true}
              />
            </BuyInputSection>
          )}
          <div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">{feeBasisPoints > 50 ? "Warning: High Fees" : "Fees"}</div>
              <div className="align-right fee-block">
                {isBuying && (
                  <Tooltip
                    handle={isBuying && isSwapTokenCapReached ? "NA" : feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          {feeBasisPoints > 50 && (
                            <div>Select an alternative asset for providing liquidity to reduce fees.</div>
                          )}
                          To get the lowest fee percentages, look in the "Save Fees" section below.
                        </>
                      );
                    }}
                  />
                )}
                {!isBuying && (
                  <Tooltip
                    handle={feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          {feeBasisPoints > 50 && (
                            <div>To reduce fees, select a different asset to remove liquidity.</div>
                          )}
                          To get the lowest fee percentages, look in the "Save Fees" section below.
                        </>
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="KlpSwap-cta Exchange-swap-button-container">
            <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
              {getPrimaryText()}
            </button>
          </div>
        </div>
      </div>
      <Stake rewardTokens={rewardTokens} />
      <div className="Tab-title-section" style={{ marginLeft: -12 }}>
        <div className="Page-title">Save Fees</div>
        {isBuying && (
          <div className="Page-description">
            The fees can  vary based on the asset you wish to add liquidity for KLP.
            <br /> Enter the requested amount of KLP or asset to be added into the interface and compare the fees here.
          </div>
        )}
        {!isBuying && (
          <div className="Page-description">
            The fees can  vary based on the asset you wish to add liquidity for KLP.
            <br /> Enter the requested amount of KLP or asset to be added into the interface and compare the fees here.
          </div>
        )}
      </div>
      <div className="KlpSwap-token-list">
        {/* <div className="KlpSwap-token-list-content"> */}
        <table className="token-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Price</th>
              <th>
                {isBuying ? (
                  <Tooltip
                    handle={"Available"}
                    tooltipIconPosition="right"
                    position="right-bottom text-none"
                    renderContent={() => "Available amount to deposit into KLP."}
                  />
                ) : (
                  <Tooltip
                    handle={"Available"}
                    tooltipIconPosition="right"
                    position="right-bottom text-none"
                    renderContent={() => {
                      return (
                        <>
                          <div>Available amount to -LIQ. from KLP.</div>
                          <div>Funds that are not being utilized by current open positions.</div>
                        </>
                      );
                    }}
                  />
                )}
              </th>
              <th>Wallet</th>
              <th>
                <Tooltip
                  handle={"Fees"}
                  tooltipIconPosition="right"
                  position="right-bottom text-none"
                  renderContent={() => {
                    return (
                      <>
                        <div>Fees will be shown once you have entered an amount in the order form.</div>
                      </>
                    );
                  }}
                />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tokenList.map((token) => {
              let tokenFeeBps;
              if (isBuying) {
                const { feeBasisPoints: feeBps } = getBuyKlpFromAmount(
                  klpAmount,
                  token.address,
                  infoTokens,
                  klpPrice,
                  usdkSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              } else {
                const { feeBasisPoints: feeBps } = getSellKlpToAmount(
                  klpAmount,
                  token.address,
                  infoTokens,
                  klpPrice,
                  usdkSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              }
              const tokenInfo = getTokenInfo(infoTokens, token.address);
              let managedUsd;
              if (tokenInfo && tokenInfo.managedUsd) {
                managedUsd = tokenInfo.managedUsd;
              }
              let availableAmountUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
                availableAmountUsd = tokenInfo.availableAmount
                  .mul(tokenInfo.minPrice)
                  .div(expandDecimals(1, token.decimals));
              }
              let balanceUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
                balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
              }

              var tokenImage = null;

              try {
                tokenImage = getImageUrl({
                  path: `coins/others/${token.symbol.toLowerCase()}-original`,
                  format: "png"
                });
              } catch (error) {
                console.error(error);
              }
              let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdkAmount);

              let amountLeftToDeposit;
              if (tokenInfo.maxUsdkAmount && tokenInfo.maxUsdkAmount.gt(0)) {
                amountLeftToDeposit = adjustForDecimals(tokenInfo.maxUsdkAmount, USDK_DECIMALS, USD_DECIMALS).sub(
                  tokenInfo.managedUsd
                );
              }
              function renderFees() {
                const swapUrl =`https://equilibrefinance.com/swap?currency0=${token.address}`;
                switch (true) {
                  case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                    return (
                      <Tooltip
                        handle="NA"
                        position="right-bottom"
                        renderContent={() => (
                          <div>
                            Max pool capacity reached for {tokenInfo.symbol}
                            <br />
                            <br />
                            Please mint KLP using another token
                            <br />
                            <p>
                              <a href={swapUrl} target="_blank" rel="noreferrer">
                                Swap on Equilibre
                              </a>
                            </p>
                          </div>
                        )}
                      />
                    );
                  case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                    return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                      }`;
                  default:
                    return "";
                }
              }

              return (
                <tr key={token.symbol}>
                  <td>
                    <div className="App-card-title-info">
                      <div className="App-card-title-info-icon">
                        <img
                          style={{ objectFit: "contain" }}
                          src={tokenImage || tokenImage.default}
                          alt={token.symbol}
                          width="40px"
                          height="40px"
                        />
                      </div>
                      <div className="App-card-title-info-text">
                        <div style={{ display: "flex", alignItems: "center" }} className="App-card-info-title">
                          {token.symbol}
                          {token.symbol === "BUSD" && (
                            <span
                              style={{
                                background: "#FF7847",
                                fontWeight: "bold",
                                fontSize: 12,
                                padding: "0 10px",
                                color: "black",
                                borderRadius: 30,
                                userSelect: "none",
                              }}
                            >
                              NEW
                            </span>
                          )}
                          <div>
                            <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                          </div>
                        </div>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 13 }}
                          className="App-card-info-subtitle"
                        >
                          {token.name}
                        </div>

                      </div>
                    </div>
                  </td>
                  <td>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, tokenInfo.displayDecimals, true)}</td>
                  <td>
                    {isBuying && (
                      <div>
                        <Tooltip
                          handle={
                            amountLeftToDeposit && amountLeftToDeposit.lt(0)
                              ? "$0.00"
                              : `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`
                          }
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => {
                            return (
                              <>
                                Current Pool Amount: ${formatAmount(managedUsd, USD_DECIMALS, 2, true)} (
                                {formatKeyAmount(tokenInfo, "poolAmount", token.decimals, 2, true)} {token.symbol})
                                <br />
                                <br />
                                Max Pool Capacity: ${formatAmount(tokenInfo.maxUsdkAmount, 18, 0, true)}
                              </>
                            );
                          }}
                        />
                      </div>
                    )}
                    {!isBuying && (
                      <div>
                        {formatKeyAmount(tokenInfo, "availableAmount", token.decimals, 2, true)} {token.symbol} ($
                        {formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)})
                      </div>
                    )}
                  </td>
                  <td>
                    {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                    {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                  </td>
                  <td>{renderFees()}</td>
                  <td>
                    <button
                      className={cx("App-button-option action-btn", isBuying ? "buying" : "selling")}
                      onClick={() => selectToken(token)}
                    >
                      {isBuying ? "+ Liquidity with " + token.symbol : "- Liquidity for " + token.symbol}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="token-grid">
          {tokenList.map((token) => {
            let tokenFeeBps;
            if (isBuying) {
              const { feeBasisPoints: feeBps } = getBuyKlpFromAmount(
                klpAmount,
                token.address,
                infoTokens,
                klpPrice,
                usdkSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            } else {
              const { feeBasisPoints: feeBps } = getSellKlpToAmount(
                klpAmount,
                token.address,
                infoTokens,
                klpPrice,
                usdkSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            }
            const tokenInfo = getTokenInfo(infoTokens, token.address);
            let managedUsd;
            if (tokenInfo && tokenInfo.managedUsd) {
              managedUsd = tokenInfo.managedUsd;
            }
            let availableAmountUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
              availableAmountUsd = tokenInfo.availableAmount
                .mul(tokenInfo.minPrice)
                .div(expandDecimals(1, token.decimals));
            }
            let balanceUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
              balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
            }

            let amountLeftToDeposit;
            if (tokenInfo.maxUsdkAmount && tokenInfo.maxUsdkAmount.gt(0)) {
              amountLeftToDeposit = adjustForDecimals(tokenInfo.maxUsdkAmount, USDK_DECIMALS, USD_DECIMALS).sub(
                tokenInfo.managedUsd
              );
            }
            let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdkAmount);

            var tokenImage = null;

            try {
              tokenImage = getImageUrl({
                path: `coins/others/${token.symbol.toLowerCase()}-original`,
                format: "png"
              });
            } catch (error) {
              console.error(error);
            }

            function renderFees() {
              switch (true) {
                case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                  return (
                    <Tooltip
                      handle="NA"
                      position="right-bottom"
                      renderContent={() =>
                        `Maximum pool capacity reached for ${tokenInfo.symbol}. Please add Liquidity with another token for the KLP`
                      }
                    />
                  );
                case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                  return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                    }`;
                default:
                  return "";
              }
            }

            return (
              <div className="App-card" key={token.symbol}>
                <div
                  style={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 8,
                    display: "flex",
                  }}
                  className="App-card-title"
                >
                  <img src={tokenImage || tokenImage.default} alt={token.symbol} width="40px" />

                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span>{token.name}</span>
                    {token.symbol === "BUSD" && (
                      <span
                        style={{
                          background: "#FF7847",
                          fontWeight: "bold",
                          fontSize: 12,
                          padding: "0 10px",
                          color: "black",
                          borderRadius: 30,
                          userSelect: "none",
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                </div>
                <div className="App-card-divider"></div>
                <div className="App-card-content">
                  <div className="App-card-row">
                    <div className="label">Price</div>
                    <div>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, tokenInfo.displayDecimals, true)}</div>
                  </div>
                  {isBuying && (
                    <div className="App-card-row">
                      <Tooltip
                        className="label"
                        handle="Available"
                        position="right-bottom"
                        renderContent={() => "Available amount to deposit into KLP."}
                      />
                      <div>
                        <Tooltip
                          handle={amountLeftToDeposit && `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`}
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => {
                            return (
                              <>
                                Current Pool Amount: ${formatAmount(managedUsd, USD_DECIMALS, 2, true)} (
                                {formatKeyAmount(tokenInfo, "poolAmount", token.decimals, 2, true)} {token.symbol})
                                <br />
                                <br />
                                Maximum Pool Capacity: ${formatAmount(tokenInfo.maxUsdkAmount, 18, 0, true)}
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {!isBuying && (
                    <div className="App-card-row">
                      <Tooltip
                        handle="Available"
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <div>Available amount to withdraw from KLP.</div>
                              <div>Funds not utilized by current open positions.</div>
                            </>
                          );
                        }}
                      />
                      <div>
                        {formatKeyAmount(tokenInfo, "availableAmount", token.decimals, 2, true)} {token.symbol} ($
                        {formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)})
                      </div>
                    </div>
                  )}

                  <div className="App-card-row">
                    <div className="label">Wallet</div>
                    <div>
                      {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                      {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">
                      {tokenFeeBps ? (
                        "Fees"
                      ) : (
                        <Tooltip
                          handle={`Fees`}
                          renderContent={() => `Please enter an amount to see fee percentages`}
                        />
                      )}
                    </div>
                    <div>{renderFees()}</div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div style={{ paddingLeft: 0 }} className="App-card-options">
                    {isBuying && (
                      <button
                        style={{ marginLeft: 0, marginRight: 0 }}
                        className="App-button-option App-card-option"
                        onClick={() => selectToken(token)}
                      >
                        Add Liquidity with {token.symbol}
                      </button>
                    )}
                    {!isBuying && (
                      <button
                        style={{ marginLeft: 0, marginRight: 0 }}
                        className="App-button-option App-card-option"
                        onClick={() => selectToken(token)}
                      >
                        Withdraw Liquidity for {token.symbol}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* </div> */}
      </div>
    </div>
  );
}
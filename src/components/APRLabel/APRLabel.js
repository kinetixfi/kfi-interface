import React from "react";
import useSWR from "swr";

import {
  PLACEHOLDER_ACCOUNT,
  fetcher,
  formatKeyAmount,
  getBalanceAndSupplyData,
  getDepositBalanceData,
  getProcessedData,
  getStakingData,
} from "../../Helpers";

import KlpManager from "../../abis/KlpManager.json";
import Reader from "../../abis/Reader.json";
import RewardReader from "../../abis/RewardReader.json";
import Vault from "../../abis/Vault.json";

import { getContract } from "../../Addresses";
import useWeb3Onboard from "../../hooks/useWeb3Onboard";

export default function APRLabel({ chainId, label }) {
  let { active } = useWeb3Onboard();

  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const readerAddress = getContract(chainId, "Reader");

  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const klpAddress = getContract(chainId, "KLP");

  const feeKlpTrackerAddress = getContract(chainId, "FeeKlpTracker");

  const klpManagerAddress = getContract(chainId, "KlpManager");

  const walletTokens = [klpAddress];
  const depositTokens = [klpAddress];
  const rewardTrackersForDepositBalances = [feeKlpTrackerAddress];
  const rewardTrackersForStakingInfo = [ feeKlpTrackerAddress];

  const { data: walletBalances } = useSWR(
    [`StakeV2:walletBalances:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, Reader, [walletTokens]),
    }
  );

  const { data: depositBalances } = useSWR(
    [`StakeV2:depositBalances:${active}`, chainId, rewardReaderAddress, "getDepositBalances", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, RewardReader, [depositTokens, rewardTrackersForDepositBalances]),
    }
  );

  const { data: stakingInfo } = useSWR(
    [`StakeV2:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const { data: aums } = useSWR([`StakeV2:getAums:${active}`, chainId, klpManagerAddress, "getAums"], {
    fetcher: fetcher(undefined, KlpManager),
  });

  const { data: nativeTokenPrice } = useSWR(
    [`StakeV2:nativeTokenPrice:${active}`, chainId, vaultAddress, "getMinPrice", nativeTokenAddress],
    {
      fetcher: fetcher(undefined, Vault),
    }
  );

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  const { balanceData, supplyData } = getBalanceAndSupplyData(walletBalances);
  const depositBalanceData = getDepositBalanceData(depositBalances);
  const stakingData = getStakingData(stakingInfo);

  const processedData = getProcessedData(
    balanceData,
    supplyData,
    depositBalanceData,
    stakingData,
    aum,
    nativeTokenPrice
  );

  return <>{`${formatKeyAmount(processedData, label, 2, 2, true)}%`}</>;
}

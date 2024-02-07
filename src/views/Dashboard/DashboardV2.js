import React, { useState } from "react";
import { Link } from "react-router-dom";

import useSWR from "swr";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import TooltipComponent from "../../components/Tooltip/Tooltip";
import hexToRgba from "hex-to-rgba";
import { ethers } from "ethers";
import { getImageUrl } from "../../cloudinary/getImageUrl";
import { getWhitelistedTokens } from "../../data/Tokens";
import { getFeeHistory } from "../../data/Fees";
import klp40Icon from "../../assets/icons/klpCoin.svg";

import {
  fetcher,
  formatAmount,
  formatKeyAmount,
  expandDecimals,
  bigNumberify,
  numberWithCommas,
  getServerUrl,
  getChainName,
  useChainId,
  USD_DECIMALS,
  KLP_DISPLAY_DECIMALS,
  KLP_DECIMALS,
  BASIS_POINTS_DIVISOR,
  KAVA,
  KLPPOOLCOLORS,
  getPageTitle,
} from "../../Helpers";
import { useInfoTokens } from "../../Api";
import { getContract } from "../../Addresses";

import Vault from "../../abis/Vault.json";
import Reader from "../../abis/Reader.json";
import KlpManager from "../../abis/KlpManager.json";
import Footer from "../../Footer";

import "./DashboardV2.css";

import externalLinkIcon from "../../img/ic_external_link.svg";
import showInExplorerIcon from "../../img/ic_show_in_explorer.svg";
import AssetDropdown from "./AssetDropdown";
import SEO from "../../components/Common/SEO";

import { useTotalVolume, useHourlyVolume, useTotalFees } from "../../Api";
import useWeb3Onboard from "../../hooks/useWeb3Onboard";

const { AddressZero } = ethers.constants;

function getCurrentFeesUsd(tokenAddresses, fees, infoTokens) {
  if (!fees || !infoTokens) {
    return bigNumberify(0);
  }

  let currentFeesUsd = bigNumberify(0);
  for (let i = 0; i < tokenAddresses.length; i++) {
    const tokenAddress = tokenAddresses[i];
    const tokenInfo = infoTokens[tokenAddress];
    if (!tokenInfo || !tokenInfo.contractMinPrice) {
      continue;
    }

    const feeUsd = fees[i].mul(tokenInfo.contractMinPrice).div(expandDecimals(1, tokenInfo.decimals));
    currentFeesUsd = currentFeesUsd.add(feeUsd);
  }

  return currentFeesUsd;
}

export default function DashboardV2() {
  const { active, library } = useWeb3Onboard();
  const { chainId } = useChainId();

  const chainName = getChainName(chainId);

  const positionStatsUrl = getServerUrl(chainId, "/position_stats");
  const { data: positionStats } = useSWR([positionStatsUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  const volumeInfo = useHourlyVolume();

  // const hourlyVolumeUrl = getServerUrl(chainId, "/hourly_volume");
  // const { data: hourlyVolume } = useSWR([hourlyVolumeUrl], {
  //   fetcher: (...args) => fetch(...args).then((res) => res.json()),
  // });

  const totalVolumeSum = useTotalVolume();

  // const totalVolumeUrl = getServerUrl(chainId, "/total_volume");
  // const { data: totalVolume } = useSWR([totalVolumeUrl], {
  //   fetcher: (...args) => fetch(...args).then((res) => res.json()),
  // });

  // const totalVolumeSum = getTotalVolumeSum(totalVolume);

  const totalFees = useTotalFees();

  let totalLongPositionSizes;
  let totalShortPositionSizes;
  if (positionStats && positionStats.totalLongPositionSizes && positionStats.totalShortPositionSizes) {
    totalLongPositionSizes = bigNumberify(positionStats.totalLongPositionSizes);
    totalShortPositionSizes = bigNumberify(positionStats.totalShortPositionSizes);
  }

  //const volumeInfo = getVolumeInfo(hourlyVolume);

  const whitelistedTokens = getWhitelistedTokens(chainId);
  const whitelistedTokenAddresses = whitelistedTokens.map((token) => token.address);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);

  const readerAddress = getContract(chainId, "Reader");
  const vaultAddress = getContract(chainId, "Vault");
  const klpManagerAddress = getContract(chainId, "KlpManager");

  const klpAddress = getContract(chainId, "KLP");
  const usdkAddress = getContract(chainId, "USDK");

  const tokensForSupplyQuery = [klpAddress, usdkAddress];

  const { data: aums } = useSWR([`Dashboard:getAums:${active}`, chainId, klpManagerAddress, "getAums"], {
    dedupingInterval: 20000,
    fetcher: fetcher(library, KlpManager),
  });

  const { data: fees } = useSWR([`Dashboard:fees:${active}`, chainId, readerAddress, "getFees", vaultAddress], {
    dedupingInterval: 30000,
    fetcher: fetcher(library, Reader, [whitelistedTokenAddresses]),
  });

  const { data: totalSupplies } = useSWR(
    [`Dashboard:totalSupplies:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", AddressZero],
    {
      dedupingInterval: 30000,
      fetcher: fetcher(library, Reader, [tokensForSupplyQuery]),
    }
  );

  const { data: totalTokenWeights } = useSWR(
    [`KlpSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      dedupingInterval: 30000,
      fetcher: fetcher(library, Vault),
    }
  );

  const { infoTokens } = useInfoTokens(library, chainId, active, undefined, undefined);

  const currentFeesUsd = getCurrentFeesUsd(whitelistedTokenAddresses, fees, infoTokens);

  const feeHistory = getFeeHistory(chainId);
  // const shouldIncludeCurrrentFees = feeHistory.length && parseInt(Date.now() / 1000) - feeHistory[0].to > 60 * 60;
  const shouldIncludeCurrrentFees = true;
  let totalFeesDistributed = shouldIncludeCurrrentFees
    ? parseFloat(bigNumberify(formatAmount(currentFeesUsd, USD_DECIMALS - 2, 0, false)).toNumber()) / 100
    : 0;
  for (let i = 0; i < feeHistory.length; i++) {
    totalFeesDistributed += parseFloat(feeHistory[i].feeUsd);
  }

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  let klpPrice;
  let klpSupply;
  let klpMarketCap;
  if (aum && totalSupplies && totalSupplies[1]) {
    klpSupply = totalSupplies[1];
    klpPrice =
      aum && aum.gt(0) && klpSupply.gt(0)
        ? aum.mul(expandDecimals(1, KLP_DECIMALS)).div(klpSupply)
        : expandDecimals(1, USD_DECIMALS);

    klpMarketCap = klpPrice.mul(klpSupply).div(expandDecimals(1, KLP_DECIMALS));
  }

  let tvl;
  if (klpMarketCap) {
    tvl = klpMarketCap;
  }

  let adjustedUsdkSupply = bigNumberify(0);

  for (let i = 0; i < tokenList.length; i++) {
    const token = tokenList[i];
    const tokenInfo = infoTokens[token.address];
    if (tokenInfo && tokenInfo.usdkAmount) {
      adjustedUsdkSupply = adjustedUsdkSupply.add(tokenInfo.usdkAmount);
    }
  }

  const getWeightText = (tokenInfo) => {
    if (
      !tokenInfo.weight ||
      !tokenInfo.usdkAmount ||
      !adjustedUsdkSupply ||
      adjustedUsdkSupply.eq(0) ||
      !totalTokenWeights
    ) {
      return "...";
    }

    const currentWeightBps = tokenInfo.usdkAmount.mul(BASIS_POINTS_DIVISOR).div(adjustedUsdkSupply);
    const targetWeightBps = tokenInfo.weight.mul(BASIS_POINTS_DIVISOR).div(totalTokenWeights);

    const weightText = `${formatAmount(currentWeightBps, 2, 2, false)}% / ${formatAmount(
      targetWeightBps,
      2,
      2,
      false
    )}%`;

    return (
      <TooltipComponent
        handle={weightText}
        position="right-bottom"
        renderContent={() => {
          return (
            <>
              Current Weight: {formatAmount(currentWeightBps, 2, 2, false)}%<br />
              Target Weight: {formatAmount(targetWeightBps, 2, 2, false)}%<br />
              <br />
              {currentWeightBps.lt(targetWeightBps) && (
                <div>
                  {tokenInfo.symbol} is below its target weight.
                  <br />
                  <br />
                  Get lower fees to{" "}
                  <Link to="/liquidity" target="_blank" rel="noopener noreferrer">
                    + liq.
                  </Link>{" "}
                  with {tokenInfo.symbol},&nbsp; and to{" "}
                  <Link to="/trade" target="_blank" rel="noopener noreferrer">
                    swap
                  </Link>{" "}
                  {tokenInfo.symbol} for other tokens.
                </div>
              )}
              {currentWeightBps.gt(targetWeightBps) && (
                <div>
                  {tokenInfo.symbol} is above its target weight.
                  <br />
                  <br />
                  Get lower fees to{" "}
                  <Link to="/trade" target="_blank" rel="noopener noreferrer">
                    swap
                  </Link>{" "}
                  tokens for {tokenInfo.symbol}.
                </div>
              )}
              <br />
              <div>
                <a href="https://docs.kinetix.finance/kinetix-architecture/kinetix-tokenomics/klp-pool" target="_blank" rel="noopener noreferrer">
                  More Info
                </a>
              </div>
            </>
          );
        }}
      />
    );
  };

  const totalStatsStartDate = "30 Aug 2023";

  let stableKlp = 0;
  let totalKlp = 0;

  let klpPool = tokenList.map((token) => {
    const tokenInfo = infoTokens[token.address];
    if (tokenInfo.usdkAmount && adjustedUsdkSupply && adjustedUsdkSupply > 0) {
      const currentWeightBps = tokenInfo.usdkAmount.mul(BASIS_POINTS_DIVISOR).div(adjustedUsdkSupply);
      if (tokenInfo.isStable) {
        stableKlp += parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`);
      }
      totalKlp += parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`);
      return {
        fullname: token.name,
        name: token.symbol,
        value: parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`),
      };
    }
    return null;
  });

  let stablePercentage = totalKlp > 0 ? ((stableKlp * 100) / totalKlp).toFixed(2) : "0.0";

  klpPool = klpPool.filter(function (element) {
    return element !== null;
  });

  klpPool = klpPool.sort(function (a, b) {
    if (a.value < b.value) return 1;
    else return -1;
  });

  const [klpActiveIndex, setKLPActiveIndex] = useState(null);

  const onKLPPoolChartEnter = (_, index) => {
    setKLPActiveIndex(index);
  };

  const onKLPPoolChartLeave = (_, index) => {
    setKLPActiveIndex(null);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="stats-label">
          <div className="stats-label-color" style={{ backgroundColor: payload[0].color }}></div>
          {payload[0].name}: {payload[0].value}%
        </div>
      );
    }

    return null;
  };

  return (
    <SEO title={getPageTitle("Dashboard")}>
      <div className="default-container DashboardV2 page-layout">
        <div className="section-title-block2 mb-3 sectionsmallscreen">
          <div className="section-title-content">
            <div className="Page-title">Dashboard</div>
            <div className="Page-description">
              Kinetix Perps was launched on {chainName} on {totalStatsStartDate}.{/* <br /> In-depth statistics:{" "} */}
              {/* {chainId === KAVA && (
                <a
                  href="https://stats.kinetix.finance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ahreftextcolor"
                >
                  https://stats.kinetix.finance
                </a>
              )} */}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: "40px" }} className="DashboardV2-content">
          <div className="DashboardV2-cards ">
            <div className="App-card">
              <div className="App-card-title">Total Stats</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row padding-left">
                  <div className="label">Total Volume</div>
                  <div>${formatAmount(totalVolumeSum, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Last 24hr Volume</div>
                  <div>${formatAmount(volumeInfo, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Long Positions</div>
                  <div>${formatAmount(totalLongPositionSizes, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Short Positions</div>
                  <div>${formatAmount(totalShortPositionSizes, USD_DECIMALS, 0, true)}</div>
                </div>
              </div>
            </div>
            <div className="App-card ">
              <div className="App-card-title">Overview</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row padding-left">
                  <div className="label">AUM</div>
                  <div>
                    <TooltipComponent
                      handle={`$${formatAmount(tvl, USD_DECIMALS, 0, true)}`}
                      position="right-bottom"
                      renderContent={() => `Assets Under Management`}
                    />
                  </div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Kinetix Perps Liquidity Pool</div>
                  <div>
                    {formatAmount(klpSupply, 18, 0, true)} KLP (
                    <TooltipComponent
                      handle={`$${formatAmount(aum, USD_DECIMALS, 0, true)}`}
                      position="right-bottom"
                      renderContent={() => `Total value of tokens in KLP pool (${chainName})`}
                    />
                    )
                  </div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Total collected fees</div>
                  <div>${formatAmount(totalFees, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row padding-left">
                  <div className="label">Collected fees from Feb 07, 2024</div>
                  <div>${numberWithCommas(totalFeesDistributed.toFixed(0))}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="section-title-block2  mt-5 mb-4 sectionsmallscreen">
            <div className="section-title-content">
              <div className="Page-title">Token</div>
              <div className="Page-description">Kinetix Perps Liquidity Token Index</div>
            </div>
          </div>

          <div className="DashboardV2-token-cards">
            <div className="stats-wrapper stats-wrapper--qpx" style={{ display: "block" }}>
              <div className="App-card">
                <div className="App-card-title">
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                    className="App-card-title-mark"
                  >
                    {/* <div style={{ margin: 0 }} className="App-card-title-mark-icon">
                      <img
                        style={{ width: "60px", height: "60px", marginRight: "5px" }}
                        src={getImageUrl({
                          path: "coins/klp-original",
                          format: "png",
                        })}
                        alt="KLP Token"
                      />
                    </div> */}
                    <div className="App-card-title-mark-icon">
                      <img style={{ width: 48, height: 48 }} src={klp40Icon} alt="klp40Icon" />
                    </div>
                    <div className="App-card-title-mark-info" style={{ marginRight: "auto" }}>
                      <div className="App-card-title-mark-title">KLP</div>
                    </div>
                    <div>
                      <a href="https://kavascan.com/address/0xa721f9f61CECf902B2BCBDDbd83E71c191dEcd8b" target="_blank">
                        <img src={showInExplorerIcon} style={{ width: 150, height: 20 }} alt="Proof of Reserves" />
                        <img src={externalLinkIcon} style={{ width: 20, height: 20, marginInlineStart: 5 }} alt="Proof of Reserves" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="stats-block">
                  <div className="App-card-divider"></div>

                  <div className="App-card-content basis-chart">
                    <div className="App-card-row">
                      <div className="label">Price</div>
                      <div>${formatAmount(klpPrice, USD_DECIMALS, KLP_DISPLAY_DECIMALS, true)}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Supply</div>
                      <div>{formatAmount(klpSupply, KLP_DECIMALS, 0, true)} KLP</div>
                    </div>
                    {/*     <div className="App-card-row">
                      <div className="label">Total Staked</div>
                      <div>${formatAmount(klpMarketCap, USD_DECIMALS, 0, true)}</div>
                    </div> */}
                    <div className="App-card-row">
                      <div className="label">Market Cap</div>
                      <div>${formatAmount(klpMarketCap, USD_DECIMALS, 0, true)}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Stablecoin Percentage</div>
                      <div>{stablePercentage}%</div>
                    </div>
                  </div>
                  <div className="stats-piechart" onMouseOut={onKLPPoolChartLeave}>
                    {klpPool.length > 0 && (
                      <PieChart width={210} height={210}>
                        <Pie
                          data={klpPool}
                          cx={100}
                          cy={100}
                          innerRadius={73}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                          onMouseEnter={onKLPPoolChartEnter}
                          onMouseOut={onKLPPoolChartLeave}
                          onMouseLeave={onKLPPoolChartLeave}
                          paddingAngle={2}
                        >
                          {klpPool.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={KLPPOOLCOLORS[entry.name]}
                              style={{
                                filter:
                                  klpActiveIndex === index
                                    ? `drop-shadow(0px 0px 6px ${hexToRgba(KLPPOOLCOLORS[entry.name], 0.7)})`
                                    : "none",
                                cursor: "pointer",
                              }}
                              stroke={KLPPOOLCOLORS[entry.name]}
                              strokeWidth={klpActiveIndex === index ? 1 : 1}
                            />
                          ))}
                        </Pie>
                        <text x={"50%"} y={"50%"} fill="white" textAnchor="middle" dominantBaseline="middle">
                          KLP Pool
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="token-table-wrapper App-card">
              <div className="App-card-title">Kinetix Perps Liquidity Pool</div>
              <div className="App-card-divider"></div>
              <table className="token-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Price</th>
                    <th>Pool</th>
                    <th>Weight</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenList.map((token) => {
                    const tokenInfo = infoTokens[token.address];
                    let utilization = bigNumberify(0);
                    if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                      utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                    }
                    const maxUsdkAmount = tokenInfo.maxUsdkAmount;

                    var tokenImage = null;

                    try {
                      tokenImage = getImageUrl({
                        path: `coins/others/${token.symbol.toLowerCase()}-original`,
                        format: "png",
                      });
                    } catch (error) {
                      console.error(error);
                    }

                    return (
                      <tr key={token.symbol}>
                        <td>
                          <div className="token-symbol-wrapper">
                            <div className="App-card-title-info">
                              <div className="App-card-title-info-icon">
                                <img
                                  style={{ objectFit: "contain" }}
                                  src={tokenImage}
                                  alt={token.symbol}
                                  width={40}
                                  height={40}
                                />
                              </div>
                              <div className="App-card-title-info-text">
                                <div
                                  style={{
                                    fontSize: "16px",
                                    letterSpacing: "-0.01em",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                  className="App-card-info-title"
                                >
                                  {token.name}
                                  <div>
                                    <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    lineHeight: "23px",
                                    color: "#696c80",
                                    display: "flex",
                                    alignItems: "center",

                                    gap: 13,
                                  }}
                                  className="App-card-info-subtitle"
                                >
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
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          ${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, tokenInfo.displayDecimals, true)}
                        </td>
                        <td>
                          <TooltipComponent
                            handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                            position="right-bottom"
                            renderContent={() => {
                              return (
                                <>
                                  Pool Amount: {formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 2, true)}{" "}
                                  {token.symbol}
                                  <br />
                                  <br />
                                  Target Min Amount:{" "}
                                  {formatKeyAmount(tokenInfo, "bufferAmount", token.decimals, 2, true)} {token.symbol}
                                  <br />
                                  <br />
                                  Max {tokenInfo.symbol} Capacity: ${formatAmount(maxUsdkAmount, 18, 0, true)}
                                </>
                              );
                            }}
                          />
                        </td>
                        <td>{getWeightText(tokenInfo)}</td>
                        <td>{formatAmount(utilization, 2, 2, false)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="token-grid">
              {tokenList.map((token) => {
                const tokenInfo = infoTokens[token.address];
                let utilization = bigNumberify(0);
                if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                  utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                }
                const maxUsdkAmount = tokenInfo.maxUsdkAmount;
                var tokenImage = null;

                try {
                  tokenImage = getImageUrl({
                    path: `coins/others/${token.symbol.toLowerCase()}-original`,
                    format: "png",
                  });
                } catch (error) {
                  console.error(error);
                }

                return (
                  <div className="App-card" key={token.symbol}>
                    <div className="App-card-title">
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <img style={{ objectFit: "contain" }} src={tokenImage} alt={token.symbol} width="40px" />
                        <span className="mx-1">{token.symbol}</span>
                        <div className="">
                          <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                        </div>
                      </div>
                    </div>
                    <div className="App-card-divider"></div>
                    <div className="App-card-content">
                      <div className="App-card-row">
                        <div className="label">Price</div>
                        <div>
                          ${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, tokenInfo.displayDecimals, true)}
                        </div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Pool</div>
                        <div>
                          <TooltipComponent
                            handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                            position="right-bottom"
                            renderContent={() => {
                              return (
                                <>
                                  Pool Amount: {formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 2, true)}{" "}
                                  {token.symbol}
                                  <br />
                                  <br />
                                  Max {tokenInfo.symbol} Capacity: ${formatAmount(maxUsdkAmount, 18, 0, true)}
                                </>
                              );
                            }}
                          />
                        </div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Weight</div>
                        <div>{getWeightText(tokenInfo)}</div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Utilization</div>
                        <div>{formatAmount(utilization, 2, 2, false)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </SEO>
  );
}

import { ethers } from "ethers";
import { getContract } from "../Addresses";

const TOKENS = {
  2222: [
    {
      name: "Kava",
      symbol: "KAVA",
      decimals: 18,
      address: ethers.constants.AddressZero,
      coingeckoUrl: "https://www.coingecko.com/en/coins/kava",
      isNative: true,
      isShortable: true,
      displayDecimals:4,
      rewardDisplayDecimals: 4,
    },
    {
      name: "W.Kava",
      symbol: "WKAVA",
      decimals: 18,
      address: "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b",
      coingeckoUrl: "https://www.coingecko.com/en/coins/kava",
      isWrapped: true,
      baseSymbol: "KAVA",
      displayDecimals:4,
      rewardDisplayDecimals: 4,
    },
    {
      name: "axlWBTC",
      symbol: "BTC",
      address: "0x1a35EE4640b0A3B87705B0A4B45D227Ba60Ca2ad",
      coingeckoUrl: "https://www.coingecko.com/en/coins/bitcoin",
      decimals: 8,
      isShortable: true,
      displayDecimals:2,
      rewardDisplayDecimals: 4,
    },
    {
      name: "axlETH",
      symbol: "ETH",
      decimals: 18,
      address: "0xb829b68f57CC546dA7E5806A929e53bE32a4625D",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
      isShortable: true,
      displayDecimals:2,
      rewardDisplayDecimals: 4,
    },
    {
      name: "Atom",
      symbol: "ATOM",
      address: "0x15932E26f5BD4923d46a2b205191C4b5d5f43FE3",
      coingeckoUrl: "https://www.coingecko.com/en/coins/cosmos-hub",
      decimals: 6,
      isShortable: false,
      displayDecimals:3,
      rewardDisplayDecimals: 4,
    },
    {
      name: "USDt",
      symbol: "USDT",
      address: "0x919c1c267bc06a7039e03fcc2ef738525769109c",
      coingeckoUrl: "https://www.coingecko.com/en/coins/tether",
      decimals: 6,
      isStable: true,
      displayDecimals:4,
      rewardDisplayDecimals: 2,
    },
  ],
};

const ADDITIONAL_TOKENS = {
  2222: [
    {
      name: "Kinetix LP",
      symbol: "KLP",
      address: getContract(2222, "KLP"),
      decimals: 18,
    },
  ],
};

const CHAIN_IDS = [2222];

const TOKENS_MAP = {};
const TOKENS_BY_SYMBOL_MAP = {};

for (let j = 0; j < CHAIN_IDS.length; j++) {
  const chainId = CHAIN_IDS[j];
  TOKENS_MAP[chainId] = {};
  TOKENS_BY_SYMBOL_MAP[chainId] = {};
  let tokens = TOKENS[chainId];
  if (ADDITIONAL_TOKENS[chainId]) {
    tokens = tokens.concat(ADDITIONAL_TOKENS[chainId]);
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    TOKENS_MAP[chainId][token.address] = token;
    TOKENS_BY_SYMBOL_MAP[chainId][token.symbol] = token;
  }
}

const WRAPPED_TOKENS_MAP = {};
const NATIVE_TOKENS_MAP = {};
for (const chainId of CHAIN_IDS) {
  for (const token of TOKENS[chainId]) {
    if (token.isWrapped) {
      WRAPPED_TOKENS_MAP[chainId] = token;
    } else if (token.isNative) {
      NATIVE_TOKENS_MAP[chainId] = token;
    }
  }
}

export function getWrappedToken(chainId) {
  return WRAPPED_TOKENS_MAP[chainId];
}

export function getNativeToken(chainId) {
  return NATIVE_TOKENS_MAP[chainId];
}

export function getTokens(chainId) {
  return TOKENS[chainId];
}

export function isValidToken(chainId, address) {
  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  return address in TOKENS_MAP[chainId];
}

export function getToken(chainId, address) {
  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  if (!TOKENS_MAP[chainId][address]) {
    localStorage.removeItem("Exchange-token-selection-v2");
    localStorage.removeItem("BuyKlp-swap-token-address");
    //window.location.reload();
  }
  return TOKENS_MAP[chainId][address];
}

export function getTokenBySymbol(chainId, symbol) {
  const token = TOKENS_BY_SYMBOL_MAP[chainId][symbol];
  if (!token) {
    throw new Error(`Incorrect symbol "${symbol}" for chainId ${chainId}`);
  }
  return token;
}

export function getWhitelistedTokens(chainId) {
  return TOKENS[chainId].filter((token) => token.symbol !== "USDK");
}

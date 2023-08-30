const CONTRACTS = {
  2222: {
    Vault: "0xa721f9f61CECf902B2BCBDDbd83E71c191dEcd8b",
    Router: "0x833B6252Ab67dE11cB777f571C7686bb4cd055FC",
    VaultReader: "0xEc41cD8b041bF65ddB72DddD56bd9662646dD491",
    Reader: "0xE027Ee35939Dd0A5Dd6C7701656159e2f6e2BAE7",
    KlpManager: "0x53E6D11B66aBF344028b69f2468120c6afA47F53",
    RewardRouter: "0x69bDEEc7d36BBB5Ac08c82eeCa7EfC94275F4D46",
    RewardReader: "0x6cEBBd36485d9C261472D02962721ad176642E7e",
    KLP: "0x5d370C8Fb021cfaa663D35a7c26fb59699ff42DA",
    USDK: "0x9c016CB0E380ACFD71872D1F78c100D9Ade66C18",
    FeeKlpTracker: "0xbD1a3CBD6E391A01eD98289cC82D1b0b5D14b1f1",
    FeeKlpDistributor: "0x8118809948d348D0c122FFC204D2e6d156741EE0",
    OrderBook: "0xd3a9680EF9B0a5Fc96087e0635f530537759d915",
    OrderExecutor: "0x7f6160Ade45Ac98EA595134971137F5057A5094A",
    OrderBookReader: "0x7f6160Ade45Ac98EA595134971137F5057A5094A",
    PositionRouter: "0x7a8350387D7CF1d8cA741B778C30C682a0C80294",
    ReferralStorage: "0xc80E5E811B74455721c3119DF9EF661D25a64788",
    ReferralReader: "0xEbe01B916AC03e3e36C3c5C389e9904d680826d3",
    NATIVE_TOKEN: "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b",
    PKFI: "0xb61c7093B827F114B85bF14B99E623842Dc042E9",
  },
};




const tryRequire = (path) => {
  try {
    return require(`${path}`);
  } catch (err) {
    return undefined;
  }
};
const devAddresses = tryRequire("./development.Addresses.js");

export function getContract(chainId, name) {
  const contracts = process.env.NODE_ENV === "development" && devAddresses ? devAddresses.CONTRACTS : CONTRACTS;

  if (!contracts[chainId]) {
    throw new Error(`Unknown chainId ${chainId}`);
  }
  if (!contracts[chainId][name]) {
    throw new Error(`Unknown constant "${name}" for chainId ${chainId}`);
  }
  return contracts[chainId][name];
}


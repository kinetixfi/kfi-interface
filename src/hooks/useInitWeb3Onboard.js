import kinetixPerpIcon from "../assets/logos/logo.svg";

import { init } from "@web3-onboard/react";
import injectedModule, { ProviderLabel } from "@web3-onboard/injected-wallets";
import walletConnectModule from "@web3-onboard/walletconnect";
import trustModule from "@web3-onboard/trust";
import { useEffect, useState } from "react";

const WALLET_CONNECT_PROJECT_ID = "1cb7739f49d5b770ffc86dd5a319b1da";
const WEB3_ONBOARD_DAPP_ID = "71ea938c-67a7-49c5-839d-131465bceb73";

const DEFAULT_CHAIN_ID = 2222;


export default function useInitWeb3Onboard() {
  const [web3Onboard, setWeb3Onboard] = useState(null);

  const injected = injectedModule({
    displayUnavailable: true,
    displayUnavailable: [
      ProviderLabel.MetaMask,
      ProviderLabel.Brave,
    ],
    custom: [],
    filter: {
      //[ProviderLabel.Detected]: false,
    },
    sort: (wallets) => {
      const metaMask = wallets.find(({ label }) => label === ProviderLabel.MetaMask);
      const brave = wallets.find(({ label }) => label === ProviderLabel.Brave);

      return (
        [
          metaMask,
          brave,
          ...wallets.filter(
            ({ label }) =>
              label !== ProviderLabel.MetaMask &&
              label !== ProviderLabel.Brave
          ),
        ]
          // remove undefined values
          .filter((wallet) => wallet)
      );
    },
  });

  const walletConnect = walletConnectModule({
    connectFirstChainId: true,
    version: 2,
    handleUri: (uri) => console.log(uri),
    projectId: WALLET_CONNECT_PROJECT_ID,
    requiredChains: [DEFAULT_CHAIN_ID],
    qrcodeModalOptions: {
      mobileLinks: ["rainbow", "metamask", "argent", "trust", "imtoken", "pillar"],
    },
  });

  const trust = trustModule();

  const initWeb3Onboard = init({
    connect: {
      autoConnectAllPreviousWallet: true,
    },
    wallets: [
      walletConnect,
      injected,
    ],
    chains: [
      {
        id: "0x8AE",
        token: "KAVA",
        label: "KAVA",
        rpcUrl: "https://evm.kava.io",
        icon: "https://res.cloudinary.com/kinetix/image/upload/v1693303545/website-assets/coins/others/kava-original.svg",
      },
    ],
    appMetadata: {
      name: "Kinetix Perpetual",
      icon: kinetixPerpIcon,
      description: "Decentralized spot & perpetual exchange",
      recommendedInjectedWallets: [
        { name: "MetaMask", url: "https://metamask.io" },
        { name: "WalletConnect", url: "https://walletconnect.com" },
      ],
//agreement: {
//version: "1.0.0",
//termsUrl: "https://docs.google.com/document/d/1Gglh43oxUZHdgrS2L9lZfsI4f6HYNF6MbBDsDPJVFkM/edit?pli=1", */
//},
      gettingStartedGuide: "https://info.kinetix.finance/",
      explore: "https://info.kinetix.finance/kinetix-architecture/smart-contract-overview",
    },
    accountCenter: {
      desktop: {
        position: "topRight",
        enabled: false,
        minimal: false,
      },
    },
    apiKey: WEB3_ONBOARD_DAPP_ID,
    notify: {
      transactionHandler: (transaction) => {
        console.log({ transaction });
        if (transaction.eventCode === "txPool") {
          return {
            // autoDismiss set to zero will persist the notification until the user excuses it
            autoDismiss: 0,
            // message: `Your transaction is pending, click <a href="https://goerli.etherscan.io/tx/${transaction.hash}" rel="noopener noreferrer" target="_blank">here</a> for more info.`,
            // or you could use onClick for when someone clicks on the notification itself
            onClick: () => window.open(`https://kavascan.com/tx/${transaction.hash}`),
          };
        }
      },
    },
    theme: "dark",
  });

  useEffect(() => {
    setWeb3Onboard(initWeb3Onboard);
  }, []);

  return { web3Onboard };
}

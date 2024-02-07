import { Menu } from "@headlessui/react";
import { FiChevronDown } from "react-icons/fi";
import "./AssetDropdown.css";
import coingeckoIcon from "../../img/coingecko.png";
import externalLinkIcon from "../../img/ic_external_link.svg";
import metamaskIcon from "../../img/ic_metamask_hover_16.svg";
import { addTokenToMetamask, ICONLINKS, platformTokens, useChainId } from "../../Helpers";

import useWeb3Onboard from "../../hooks/useWeb3Onboard";

function AssetDropdown({ assetSymbol, assetInfo }) {
  const { active } = useWeb3Onboard();
  const { chainId } = useChainId();
  let { coingecko, kava } = ICONLINKS[chainId][assetSymbol];
  const unavailableTokenSymbols = {
    2222: ["KAVA"],
  };

  return (
    <Menu>
      <Menu.Button as="div" className="dropdown-arrow">
        <FiChevronDown size={20} />
      </Menu.Button>
      <Menu.Items as="div" className="asset-menu-items">
        <Menu.Item>
          <>
            {coingecko && (
              <a href={coingecko} className="asset-item" target="_blank" rel="noopener noreferrer">
                <img style={{ width: 30, height: 30 }} src={coingeckoIcon} alt="Show on Coingecko" />
                <p>Show on Coingecko</p>
              </a>
            )}
          </>
        </Menu.Item>
        <Menu.Item>
          <>
            {assetSymbol === 'KLP' && (
              <a
                href="https://kavascan.io/address/0xa721f9f61CECf902B2BCBDDbd83E71c191dEcd8b" //DONT FORGET
                className="asset-item"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={externalLinkIcon} style={{ width: 30, height: 30 }} alt="Proof of Reserves" />
                <p>Proof of Reserves</p>
              </a>
            )}
          </>
        </Menu.Item>
        <Menu.Item>
          <>
            {kava && (
              <a href={kava} className="asset-item" target="_blank" rel="noopener noreferrer">
                <img src={externalLinkIcon} style={{ width: 30, height: 30 }} alt="Show in explorer" />
                <p>Show in Explorer</p>
              </a>
            )}
          </>
        </Menu.Item>

        <Menu.Item>
          <>
            {active && unavailableTokenSymbols[chainId].indexOf(assetSymbol) < 0 && (
              <div
                onClick={() => {
                  let token = assetInfo
                    ? { ...assetInfo, image: assetInfo.imageUrl }
                    : platformTokens[chainId][assetSymbol];
                  addTokenToMetamask(token);
                }}
                className="asset-item"
              >
                <img style={{ width: 30, height: 30 }} src={metamaskIcon} alt="Add to Metamask" />
                <p>Add to Metamask</p>
              </div>
            )}
          </>
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}

export default AssetDropdown;

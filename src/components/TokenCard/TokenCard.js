import React, { useCallback } from "react";
import { Link } from "react-router-dom";

import RightArr from "../../assets/icons/RightArr";

import { KAVA, switchNetwork, useChainId } from "../../Helpers";

import APRLabel from "../APRLabel/APRLabel";

import { getImageUrl } from "../../cloudinary/getImageUrl";
import useWeb3Onboard from "../../hooks/useWeb3Onboard";

export default function TokenCard() {
  const { chainId } = useChainId();
  const { active } = useWeb3Onboard();

  const changeNetwork = useCallback(
    (network) => {
      if (network === chainId) {
        return;
      }
      if (!active) {
        setTimeout(() => {
          return switchNetwork(network, active);
        }, 500);
      } else {
        return switchNetwork(network, active);
      }
    },
    [chainId, active]
  );

  return (
    <div className="Home-token-card-options mb-180 ">
      <div className="Home-token-card-option borderradius token-card-flex ">
        <div style={{ display: "flex", flexDirection: "column" }} className="">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
            <img
              style={{ width: 100, height: 100, marginRight: 15 }}
              src={getImageUrl({
                path: "coins/klp-original",
                format: "png",
              })}
              alt="klpBigIcon"
            />{" "}
            <span className="text-bigger">KLP</span>
          </div>
          <div>
            <p className="token-card-paragraph">
              The platform's liquidity token, KLP, receives 70% of the fees collected.
            </p>
          </div>
        </div>
        <div className="Home-token-card-option-info">
          <div style={{ fontSize: 17, lineHeight: "28px", fontWeight: 600 }} className="Home-token-card-option-apr">
            <p style={{ opacity: "80%" }} className="token-apr">
              APR: <APRLabel chainId={KAVA} label="klpAprTotal" key="KAVA" />
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 30 }}
              className="Home-token-card-option-action card-flex-2"
            >
              <div className="card-flex">
                <Link
                  style={{ background: "#FF7847", color: "#000" }}
                  to="/liquidity"
                  className="buy-kava2 basis-212"
                  onClick={() => changeNetwork(KAVA)}
                >
                  + LIQ.
                </Link>
                <Link
                  style={{
                    background: "#625df5",
                  }}
                  to="/liquidity#redeem"
                  className="buy-kava basis-76 purple-hover"
                  onClick={() => changeNetwork(KAVA)}
                >
                  - LIQ.
                </Link>
              </div>

              <a
                href="https://docs.kinetix.finance/kinetix-architecture/kinetix-tokenomics/klp-pool"
                target="_blank"
                rel="noreferrer"
                className="btn-read-more"
              >
                Read More <RightArr />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

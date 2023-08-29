import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import KlpSwap from "../../components/Klp/KlpSwap";
import Footer from "../../Footer";
import "./BuyKlp.css";

import { useChainId } from "../../Helpers";
import { getNativeToken } from "../../data/Tokens";

export default function BuyKlp(props) {
  const { chainId } = useChainId();
  const history = useHistory();
  const [isBuying, setIsBuying] = useState(true);
  const nativeTokenSymbol = getNativeToken(chainId).symbol;

  useEffect(() => {
    const hash = history.location.hash.replace("#", "");
    const buying = hash === "redeem" ? false : true;
    setIsBuying(buying);
  }, [history.location.hash]);

  return (
    <div className="default-container buy-klp-content page-layout"
      style={{zIndex:"10"}}
    >
          <div className="section-title-content mb-3">
          <div className="Page-title">+/- Liquidity</div>
          <div className="Page-description">
            Add liquidity and get tokens to earn fees from swaps and leverage trading in {nativeTokenSymbol}.
          </div>
        </div>
      <KlpSwap {...props} isBuying={isBuying} setIsBuying={setIsBuying} />
      <Footer />
    </div>
  );
}

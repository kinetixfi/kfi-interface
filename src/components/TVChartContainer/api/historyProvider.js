const axios = require("axios").default;
const api_root = process.env.REACT_APP_STATS_API_URL;
const history = {};

export default {
  history: history,

  getBars: function (symbolInfo, resolution, periodParams) {
    var split_symbol = symbolInfo.name.split(/[:/]/);

    let url = split_symbol[0];
    if(url === 'BTC'){url = 'axlWBTC'}
    if(url === 'WBTC'){url = 'axlWBTC'}
    if(url === 'ETH'){url = 'axlETH'}
    return axios
      .get(`${api_root}/api/candles/${url}`, {
        params: {
          preferableChainId: "2222",
          period:
            resolution === "1D"
              ? "1d"
              : resolution === "240"
              ? "4h"
              : resolution === "60"
              ? "1h"
              : resolution === "15"
              ? "15m"
              : "5m",
          preferableSource: "fast",
          from: periodParams.from,
          to: !periodParams.firstDataRequest ? periodParams.to : "",
        },
      })
      .then((response) => {
        if (response.status && response.status.toString() !== "200") {
          console.log(" API error:", response.statusText);
          return [];
        }
        if (response.data.prices.length) {
          var bars = response.data.prices.map((el) => {
            return {
              time: el.t * 1000, //TradingView requires bar time in ms
              low: el.l,
              high: el.h,
              open: el.o,
              close: el.c,
            };
          });
          if (periodParams.firstDataRequest) {
            var lastBar = bars[bars.length - 1];
            history[symbolInfo.name] = { lastBar: lastBar };
          }
          return bars;
        } else {
          return [];
        }
      });
  },
};

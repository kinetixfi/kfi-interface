const SECONDS_PER_WEEK = 604800;

const FEES = {
  2222: []
};

export function getFeeHistory(chainId) {
  return FEES[chainId].concat([]).reverse();
}

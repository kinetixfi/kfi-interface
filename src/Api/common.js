import { ApolloClient, InMemoryCache } from "@apollo/client";

export const chainlinkClient = createClient(process.env.REACT_APP_PRICE_SUBGRAPH);

export const kavaGraphClient = createClient(process.env.REACT_APP_CORE_SUBGRAPH);

// All Positions
export const positionsGraphClient = createClient(process.env.REACT_APP_QPX_POSITIONS_SUBGRAPH);

export const kavaReferralsGraphClient = createClient(process.env.REACT_APP_REFERRAL_SUBGRAPH);


function createClient(uri) {
  return new ApolloClient({
    uri,
    cache: new InMemoryCache(),
  });
}

export const INSERT_MANY = /* GraphQL */ `
  mutation INSERT_MANY($address: String!, $address_type: String!, $gohm_balance: numeric!) {
    insert_erc20_snapshot(objects: { address: $address, address_type: $address_type, gohm_balance: $gohm_balance }) {
      affected_rows
    }
  }
`;

export const GET_BATCH = /* GraphQL */ `
  query GET_BATCH($limit: Int) {
    erc20_snapshot(
      limit: $limit
    ) {
      address
    }
  }
`;
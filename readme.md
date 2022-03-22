# ERC20 Token Snapshot

This command-line utility creates a snapshot of any ERC20 token and writes that snapshot to Hasura and/or to local file in JSON/CSV format. Regarding the Hasura load, the logic is made so that both initial and incremental loads can be performed.

- Works without a local Ethereum node.
- Automatically resumes from the last loaded block.
- Tested to work with Infura.

## Hasura

Create a table on Hasura named `erc20_snapshot` with the following columns and respective types/params:

- `address` (text, primary key, unique)
- `gOHM_balance` (numeric)
- `address_type` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

And _Primary Key_ as: `address - erc20_snapshot_pkey`

## Configuration File / Prompt Parameters

1. Create a `.env` file at the project root with the same Hasura variables present in `.env.example`.

2. Create a `snapshot.config.json` file at the project root, with the following variables:

```json
{
  "provider": "https://mainnet.infura.io/v3/<key>",
  "contractAddress": "0x0ab87046fBb341D058F17CBC4c1133F25a20a52f",
  "fromBlock": 13675914,
  "toBlock": "latest",
  "writeToHasura": true,
  "writeToLocalFile": true,
  "format": "csv",
  "blocksPerBatch": 3000,
  "delay": 0,
  "checkIfContract": false
}
```
### provider

Enter your fully synced Ethereum node. Could be a local node or remote services like Infura.

### contractAddress

Address of your ERC20 token.

### fromBlock

The block height to scan from. To save time, enter the block number of the transaction your token was created on. Note: if a higher block number has already been downloaded, the scan will start at that block number instead.

### toBlock

The block height to end the scan at.

### writeToHasura

Write addresses and balances to Hasura.

### writeToLocalFile

Writes addresses and balances to local JSON/CSV file.

### blocksPerBatch

The number of blocks to query per batch.

If you are using remote service like Infura, keep this number relative low (2000-5000) to avoid rate limits. If you are using a dedicated Ethereum node, you can increase this number to suit your needs.

### delay

The delay (in ms) between each request in the loop. Tweak this if you are experiencing rate limit from your provider.

### checkIfContract

Checks each address to determine whether it is a smart contract or an Ethereum wallet.

## How to Use Token Snapshot?

- Run `npm run start` at the root of the project.

### Initial load

If there's no file `./.cache/previous-hasura-write.json` (which is the case when you're running this command-line utility for the first time), an initial load will be done. This means that all the addresses that made transactions in the blocks indexes from `fromBlock` to `toBlock` will be written to Hasura, as well as their respective balances. After a successful initial load, the file `./.cache/previous-hasura-write.json` will be created, and will look something like this:

```json
{
  "startTime": "Mon, 21 Mar 2022 19:08:48 GMT",
  "endTime": "Mon, 21 Mar 2022 19:10:13 GMT",
  "outcome": {
    "mode": "INITIAL-LOAD",
    "lastScannedBlock": 14431495
  }
}
```

### Incremental load

If there's a file `./.cache/previous-hasura-write.json` (which will always be the case after the initial load has been done), an incremental load will be performed. That means only the addresses that made transactions after block `lastScannedBlock` defined in `previous-hasura-write.json` will be inserted/updated into Hasura, as well as their respective balances.

Note: Doesn't matter whether it's initial or incremental load, if the parameter `writeToLocalFile` is set to `true` all the addresses and respective balances will be written to the local file, not just the new ones. As such, the latest local balances file will be, at every moment, a carbon copy of the data that is present in Hasura (assuming that there are no errors during the writing to Hasura).
## raydium-amm scripts (Devnet)

このディレクトリには、以下の5つの手順をDevnet上で実行するためのJSスクリプトが含まれます。

- 1. スモークテスト: `1-smoke.js`
- 2. 2種の SPL トークン作成: `2-create-tokens.js`
- 3. プール初期化: `3-init-pool.js`
- 4. 入金: `4-deposit.js`
- 5. スワップ: `5-swap.js`

### 事前準備
- Node v18+ を推奨
- 依存インストール

```
cd scripts
npm i
```

`.env` を用意します（例）。

```
cp .env.example .env
```

`.env` に最低限必要な変数:

```
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_PATH=${HOME}/.config/solana/id.json
RAYDIUM_AMM_PROGRAM_ID=<あなたがデプロイしたProgramID>
OPENBOOK_PROGRAM_ID=EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj
```

### 1) スモークテスト
```
npm run smoke
```
エラーでも構いません（到達確認）。

### 2) 2種の SPL トークン作成
```
npm run create:tokens
```
出力値 `COIN_MINT`, `PC_MINT`, `USER_COIN_ACCOUNT`, `USER_PC_ACCOUNT` を `.env` に反映。

### 3) プール初期化
OpenBook のマーケット（`MARKET_ADDRESS` ほか bids/asks/eventQ/vault 等のアドレス）が必要です（別途 `openbook-dex` の list-market で作成）。

`.env` へ以下を設定:

```
COIN_MINT=
PC_MINT=
MARKET_ADDRESS=
MARKET_BIDS=
MARKET_ASKS=
MARKET_EVENT_Q=
MARKET_COIN_VAULT=
MARKET_PC_VAULT=
MARKET_VAULT_SIGNER=
```

実行:
```
npm run init:pool
```
出力の `AMM_*` と `USER_LP_ACCOUNT` は以降で使用。

注意: `CreateConfigAccount`（管理者専用PDA作成）はプール初期化の前提ではありません。Devnet Feature では手数料アドレス・OpenBook Program は `processor.rs` の `config_feature` で固定されています。

### 4) 入金（LPミント受取）
必要: `MARKET_EVENT_Q`, `.env` に `DEPOSIT_MAX_COIN`, `DEPOSIT_MAX_PC` 等を任意設定可。

```
npm run deposit
```

### 5) スワップ
スワップ元/先ATA を `.env` に設定:

```
SWAP_SOURCE_ATA=<COIN か PC のATA>
SWAP_DEST_ATA=<反対側のATA>
SWAP_AMOUNT_IN=100
SWAP_MINIMUM_OUT=1
```

実行:
```
npm run swap
```

### トラブルシュート
- Program ID ミス: `.env` の `RAYDIUM_AMM_PROGRAM_ID` を確認
- SOL 不足: `solana airdrop 2` 等で補充
- OpenBook アカウント不一致: マーケットのミント/ボルトと `COIN_MINT`/`PC_MINT` が一致しているかを確認


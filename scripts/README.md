## raydium-amm scripts (Devnet) - Updated for Current Contract

このディレクトリには、現在のAMMコントラクトに対応した、以下の5つの手順をDevnet上で実行するためのJSスクリプトが含まれます。

**更新内容:**
- `2-create-tokens.js`: Token-2022トークンの作成に対応（Transfer Hook付きトークンも作成可能）
- `3-init-pool.js`: 現在のInstruction形式に合わせてアカウント順序とConfig PDA生成を修正、Token-2022対応
- `4-deposit.js`: 必要なPCトークンプログラムアカウントを追加、Token-2022対応
- `5-swap.js`: Token-2022トークンでのスワップに対応
- `shared.js`: Token-2022互換のATA作成・取得ユーティリティを追加
- 全スクリプト: Token-2022とTransfer Hook対応のアカウント構造に更新

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

`.env` を新規作成し、環境変数を設定します。`.env.example` をコピーして編集してください。

```bash
cp .env.example .env
```

重要な設定項目：
- `USE_TOKEN_2022=true`: Token-2022トークンを作成する場合
- `TRANSFER_HOOK_PROGRAM_ID=`: Transfer Hook付きトークンを作成する場合（オプション）
- `RAYDIUM_AMM_PROGRAM_ID=`: デプロイしたAMMプログラムID

補足:
- プログラムのビルドとデプロイは `docs/devnet-deploy-and-test.md` を参照してください。
- OpenBook マーケット作成の詳細・注意点は `docs/openbook.md` を参照してください。

### 1) スモークテスト
```
npm run smoke
```
エラーでも構いません（到達確認）。

### 2) Token-2022 または SPL トークン作成
```
npm run create:tokens
```

このスクリプトは `.env` の `USE_TOKEN_2022` 設定に基づいて Token-2022 または従来のSPLトークンを作成します：

**Token-2022 の場合:**
- Transfer Hook 拡張付きトークンも作成可能（`TRANSFER_HOOK_PROGRAM_ID` 設定時）
- Token-2022 プログラム（`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`）使用

**従来SPLトークンの場合:**
- 従来のTOKEN_PROGRAM_ID使用で互換性維持

出力値を `.env` に反映：
- `COIN_MINT`, `PC_MINT`, `USER_COIN_ACCOUNT`, `USER_PC_ACCOUNT`
- `COIN_TOKEN_PROGRAM`, `PC_TOKEN_PROGRAM` （Token-2022の場合）

（スクリプトのデフォルトではどちらも 6 桁のディシマルで、開発用に10億トークンをミントします）

### 2.5) OpenBook マーケット作成（list-market 実行）
Raydium のプール初期化には OpenBook マーケットが必要です。OpenBook の `program/dex/crank` ディレクトリに `.env` を作成して必要パラメータを定義し、同ディレクトリから `list-market` を実行してください。詳細解説は `docs/openbook.md` を参照。

1) `program/dex/crank/.env` に以下を作成（例）

```
# OpenBook list-market 用（必要に応じて上書き）
DEX_PROGRAM_ID=EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj
OPENBOOK_PAYER_PATH=${WALLET_PATH:-${HOME}/.config/solana/id.json}

# 2-create-tokens.js の出力を流用
COIN_MINT=<出力の COIN_MINT>
PC_MINT=<出力の PC_MINT>

# 精度パラメータ（例）
OPENBOOK_LOT_SIZE=1
OPENBOOK_TICK_SIZE=0.01

# キュー/オーダーブック長（例: Devnet 最小コスト設定）
OPENBOOK_EVENT_Q_LEN=128
OPENBOOK_REQUEST_Q_LEN=63
OPENBOOK_ORDERBOOK_LEN=201
```

2) OpenBook のクライアント（`openbook-dex/crank`）を取得（未導入なら）

```
git clone https://github.com/openbook-dex/program.git
cd program/dex/crank
```

ビルドが通らない場合（例: `proc-macro2` の unknown feature / 複数バージョン競合）:

```
rustup default stable
rustup update
unset RUSTC_BOOTSTRAP

cargo clean
cargo update

# 複数の proc-macro2 があって ambiguous と出る場合の例
# （必要なら "--precise <version>" で固定。バージョンは安定系を指定）
cargo update -p proc-macro2 --precise 1.0.86
cargo update -p syn --precise 1.0.109
cargo update -p quote --precise 1.0.23

RUSTUP_TOOLCHAIN=stable cargo build
```

3) `program/dex/crank` から `.env` を読み込み、`list-market` を実行（そのまま実行・推奨）

```
# program/dex/crank ディレクトリから実行
set -a; source ./.env; set +a
cargo run -- devnet list-market \
  --coin-mint "$COIN_MINT" \
  --pc-mint "$PC_MINT" \
  "$OPENBOOK_PAYER_PATH" "$DEX_PROGRAM_ID"
```

補足:
- この CLI では `--tick-size` や `--event-queue-length` 等は指定できません。必要なら `--coin-lot-size` と `--pc-lot-size` を利用してください（未指定時はデフォルトが使われます）。
- 例: 両トークンが 6 桁ディシマルで「最小数量=1」「ティック=0.01」を狙う場合は `--coin-lot-size 1 --pc-lot-size 10000` を追加。

実行出力の「Market ID（`MARKET_ADDRESS`）」と関連アカウント（`MARKET_BIDS`, `MARKET_ASKS`, `MARKET_EVENT_Q`, `MARKET_COIN_VAULT`, `MARKET_PC_VAULT`, `MARKET_VAULT_SIGNER`）を控えてください。以降の `3) プール初期化` で使用します。

### 3) プール初期化
OpenBook のマーケット（`MARKET_ADDRESS` ほか bids/asks/eventQ/vault 等のアドレス）が必要です（別途 `openbook-dex` の list-market で作成）。
作成手順・推奨パラメータは `docs/openbook.md` を参照してください。マーケット作成出力、または Solana Explorer（Solscan / explorer.solana.com）でマーケットIDの関連アカウントから各アドレスを取得できます。

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
スワップ方向に応じて、`.env` の ATA を設定します（`2-create-tokens.js` の出力 `USER_COIN_ACCOUNT` / `USER_PC_ACCOUNT` を利用）。

```
# 例1: COIN → PC へスワップ（COIN を入れて PC を受け取る）
SWAP_SOURCE_ATA=${USER_COIN_ACCOUNT}
SWAP_DEST_ATA=${USER_PC_ACCOUNT}

# 例2: PC → COIN へスワップ（PC を入れて COIN を受け取る）
# SWAP_SOURCE_ATA=${USER_PC_ACCOUNT}
# SWAP_DEST_ATA=${USER_COIN_ACCOUNT}

# 数量は最小単位（ディシマル反映後の整数）で指定
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
- マーケット関連アカウントが見つからない/不足: `list-market` 実行結果を再確認し、`docs/openbook.md` の精度・キュー長パラメータ（ロット/ティック、イベント/リクエスト/オーダーブック長）が有効かを見直し


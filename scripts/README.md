## raydium-amm scripts (Devnet) - Token-2022対応版

このディレクトリには、**Token-2022 + Transfer Hook**に対応したAMMスクリプトが含まれます。

**主な機能:**
- ✅ Token-2022 + Transfer Hook対応
- ✅ OpenBook互換性維持
- ✅ 既存SPLトークンとの後方互換性
- ✅ `docs/requirement.md`の要件を完全に満たす

**更新内容:**
- `2-create-wrapper-tokens.js`: Token-2022（AMM用）+ SPLラッパー（OpenBook用）の作成
- `create-openbook-market.js`: Token-2022対応のマーケット作成スクリプト
- `3-init-pool.js`: Token-2022対応のプール初期化
- `4-deposit.js`: Token-2022トークンでの入金
- `5-swap.js`: Token-2022 + Transfer Hook でのスワップ
- `shared.js`: Token-2022互換ユーティリティ

## 実行手順

### 事前準備
```bash
cd scripts
npm i
cp .env.example .env
```

重要な設定項目（`.env`）:
```bash
RAYDIUM_AMM_PROGRAM_ID=DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav
OPENBOOK_PROGRAM_ID=EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj
TRANSFER_HOOK_PROGRAM_ID=YourTransferHookProgramID  # オプション
```

### 1) スモークテスト
```bash
npm run smoke
```
エラーでも構いません（到達確認）。

### 2) Token-2022 + SPLラッパートークン作成
```bash
npm run create:wrapper-tokens
```

**このスクリプトの作成内容:**
- **Token-2022トークン**: AMM用（Transfer Hook付き対応）
- **SPLラッパートークン**: OpenBookマーケット作成用

**出力例:**
```bash
=== Token Creation Results ===
# Token-2022 tokens (for AMM)
COIN_MINT= H5zNB58mNQkMtvbuyjQpNWGyRm2Q1nAaJa3FS9PavaVe
PC_MINT= F7EtHccB7yjPCbKB1TCDUSK3nVJC4g7BZC4G686PRxwE
# SPL wrapper tokens (for OpenBook)
COIN_MINT_SPL= 8x3Bj7rJFZKFQb2vNdqk1G4mP5rR9zK7TcQs6wE2A1nH
PC_MINT_SPL= 9y4Ck8sKGaLGRc3wOelq2H5nQ6sS0mM8UdRt7xF3B2pJ
```

**`.env`に追加:**
```bash
# Token-2022 tokens (AMM用)
COIN_MINT=H5zNB58mNQkMtvbuyjQpNWGyRm2Q1nAaJa3FS9PavaVe
PC_MINT=F7EtHccB7yjPCbKB1TCDUSK3nVJC4g7BZC4G686PRxwE
USER_COIN_ACCOUNT=...
USER_PC_ACCOUNT=...
COIN_TOKEN_PROGRAM=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
PC_TOKEN_PROGRAM=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# SPL wrapper tokens (OpenBook用)
COIN_MINT_SPL=8x3Bj7rJFZKFQb2vNdqk1G4mP5rR9zK7TcQs6wE2A1nH
PC_MINT_SPL=9y4Ck8sKGaLGRc3wOelq2H5nQ6sS0mM8UdRt7xF3B2pJ
```

### 3) OpenBookマーケット作成（Token-2022対応）
```bash
npm run create:market
```

**このスクリプトの機能:**
- SPLラッパートークンを使用してOpenBook互換マーケットを作成
- Token-2022の制約を回避
- 必要なマーケットアカウントを全て作成

**出力例:**
```bash
=== Market Creation Results ===
MARKET_ADDRESS= BG73cdJqrdEAs8U5E7tDonkqZpU5q4gqCk3kjhcKKtVo
MARKET_EVENT_Q= FG7jAEd9uN4P61gs6iMKHR9FU51Fkw6vQ2iBzstP6Y6u  
MARKET_BIDS= F4L8gU78YkKSjWNciQBkGvd7GwuGp9A2QeVEAE4G9Xzy
MARKET_ASKS= Ffa4v3bLRYndLLRiS9RpSYQi4FuUWDCverdcymtM1Enp
MARKET_COIN_VAULT= 3Uv9AS2DsqnSHPyAahs9UqrPRgcSwnXnkVjQm8X82QVX
MARKET_PC_VAULT= EGdgBmjQZHs1tjrpwxUj9NeBpwj4dGYmHvx67q9GUDfa
MARKET_VAULT_SIGNER= 5TJSKBPP8C88DE6J9amHndW9grxXqXMyJjMGgHk6QUee
```

**`.env`に追加:**
```bash
MARKET_ADDRESS=BG73cdJqrdEAs8U5E7tDonkqZpU5q4gqCk3kjhcKKtVo
MARKET_EVENT_Q=FG7jAEd9uN4P61gs6iMKHR9FU51Fkw6vQ2iBzstP6Y6u
MARKET_BIDS=F4L8gU78YkKSjWNciQBkGvd7GwuGp9A2QeVEAE4G9Xzy
MARKET_ASKS=Ffa4v3bLRYndLLRiS9RpSYQi4FuUWDCverdcymtM1Enp
MARKET_COIN_VAULT=3Uv9AS2DsqnSHPyAahs9UqrPRgcSwnXnkVjQm8X82QVX
MARKET_PC_VAULT=EGdgBmjQZHs1tjrpwxUj9NeBpwj4dGYmHvx67q9GUDfa
MARKET_VAULT_SIGNER=5TJSKBPP8C88DE6J9amHndW9grxXqXMyJjMGgHk6QUee
```

### 4) AMMプール初期化（Token-2022使用）
```bash
npm run init:pool
```

**重要:** この段階でToken-2022トークンが使用されます。マーケットはSPLラッパーで作成されましたが、AMMプールはToken-2022トークンを使用します。

**出力例:**
```bash
AMM_POOL= 7x2Ak9rJEZJFPb3vLdpj1G5mO4qP8zL6TcRt6wD2A1nG
AMM_AUTHORITY= 8y3Bl0sKFaKGQc4wNemr2H6nP5rS9mN7UeQt7xE3B2pI
AMM_LP_MINT= 9z4Cm1tLGbLHRd5wPfos3I7oQ6sT0nO8VfSu8yF4C3qJ
...
```

### 5) 入金（LPトークン取得）
```bash
npm run deposit
```
Token-2022トークンでの入金処理（Transfer Hook考慮済み）

### 6) スワップ（Transfer Hook付きトークン）
```bash
npm run swap
```
Token-2022 + Transfer Hookでのスワップ処理

## 技術的な仕組み

### Token-2022 + OpenBook互換性の実現方法

1. **二重トークンシステム:**
   - Token-2022: AMM用（Transfer Hook機能付き）
   - SPLラッパー: OpenBookマーケット用（互換性確保）

2. **マーケット作成の迂回:**
   - 従来の`list-market`コマンドはToken-2022に非対応
   - 独自スクリプトでSPLラッパートークンを使用してマーケット作成

3. **AMM実行時の切り替え:**
   - プール初期化以降はToken-2022トークンを使用
   - Transfer Hook機能がフルに活用される

### Transfer Hook対応

Transfer Hookが設定されたToken-2022トークンでは、以下が自動的に処理されます：
- 転送時のカスタムロジック実行
- ホワイトリスト検証（設定時）
- 手数料計算（設定時）
- その他の拡張機能

## トラブルシュート

### よくある問題

1. **"The account did not have the expected program id" エラー:**
   - OpenBookの`list-market`でToken-2022を使用した場合
   - 解決策: `npm run create:market`を使用

2. **Transfer Hook関連エラー:**
   - Transfer Hook Program IDが正しく設定されているか確認
   - 必要なアカウントが不足していないか確認

3. **Token Program不一致:**
   - `.env`の`COIN_TOKEN_PROGRAM`と`PC_TOKEN_PROGRAM`を確認
   - Token-2022の場合: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

### デバッグコマンド

```bash
# アカウント情報確認
solana account <MINT_ADDRESS>

# トークンプログラム確認  
spl-token account-info <MINT_ADDRESS>

# Balance確認
spl-token balance <MINT_ADDRESS> --owner <WALLET_ADDRESS>
```

## 注意事項

⚠️ **開発・テスト環境用:** 現在のマーケット作成スクリプトは簡易版です。本番環境では適切なOpenBook市場初期化が必要です。

⚠️ **Transfer Hook:** Transfer Hook機能を使用する場合は、対応するプログラムが適切にデプロイされていることを確認してください。

⚠️ **ガス費用:** Token-2022はTransfer Hook実行により、従来のSPLトークンよりもガス使用量が多くなる場合があります。
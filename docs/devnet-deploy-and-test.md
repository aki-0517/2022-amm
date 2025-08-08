## raydium-amm Devnet デプロイ & テスト手順

このドキュメントは、`raydium-amm` を Solana Devnet にデプロイし、動作確認（スモークテスト）と基本的な機能テストの入口を示します。

### 概要
- **ビルド**: `cargo build-sbf --features devnet`
- **デプロイ**: `solana program deploy target/deploy/raydium_amm.so`（環境によりパスは異なる）
- **スモークテスト**: 最小のトランザクションで到達確認
- **機能テストの入口**: OpenBookマーケットに紐づけてプール初期化 → デポジット → スワップ

---

### 前提条件（環境準備）
- Rust がインストール済み
- Solana CLI（2.1.x）
  - 例: `solana-install init 2.1.4`
- キーペア作成と Devnet 設定

```
solana config set --url https://api.devnet.solana.com
solana-keygen new --outfile ~/.config/solana/id.json --force
solana airdrop 2
solana balance
```

---

### ビルド（Devnet）
`program` ディレクトリで devnet フラグを付けて SBF ビルドします。

```
cd raydium-amm/program
cargo build-sbf --features devnet
# .so の出力場所（いずれかに配置されます）
ls target/deploy/raydium_amm.so || ls target/sbf-solana-solana/release/raydium_amm.so
```

メモ:
- `program/src/lib.rs` は `--features devnet` 指定で `declare_id!("DRaya7...")` を用います。これは参照用の定数であり、実際の実行時は「あなたがデプロイした Program ID」に基づきます。

---

### デプロイ（Devnet）
ビルド成果物（`.so`）を Devnet にデプロイします。山括弧（`< >`）は使わず、実際のパスを指定してください。

```
cd raydium-amm/program
# どちらか存在する方を使う
ls target/deploy/raydium_amm.so || ls target/sbf-solana-solana/release/raydium_amm.so

# 自動選択（macOSのzshで動作する簡易版）
PROGRAM_SO=$( [ -f target/deploy/raydium_amm.so ] && echo target/deploy/raydium_amm.so || echo target/sbf-solana-solana/release/raydium_amm.so )

solana program deploy "$PROGRAM_SO" --url https://api.devnet.solana.com
# 出力された Program Id を控える（以降 <YOUR_PROGRAM_ID> と表記）
solana program show <YOUR_PROGRAM_ID>
```

重要:
- クライアント／スクリプトでは必ずあなたの `<YOUR_PROGRAM_ID>` を使用してください。
- 公式の devnet 既存 ID（`DRaya7...`）とは別物です。

---

### スモークテスト（到達確認）
最小のトランザクションで「プログラムが反応する」ことを確認します。エラーで構いません（到達確認目的）。

1) 依存追加

```
npm init -y
npm i @solana/web3.js
```

2) `smoke.js`（Program へ空データで呼び出し）

```javascript
// smoke.js
const {Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction} = require('@solana/web3.js');
const fs = require('fs');

(async () => {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const secret = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));
  const programId = new PublicKey(process.env.RAYDIUM_AMM_PROGRAM_ID); // ← デプロイ結果を使用

  const ix = new TransactionInstruction({ programId, keys: [], data: Buffer.alloc(0) });
  const tx = new Transaction().add(ix);
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer], {commitment: 'confirmed'});
    console.log('unexpected success', sig);
  } catch (e) {
    console.log('program responded (expected error):', e.message);
  }
})();
```

3) 実行

```
RAYDIUM_AMM_PROGRAM_ID=<YOUR_PROGRAM_ID> node smoke.js
# エラーでも OK（プログラムが実行されていれば目的達成）
```

ログ確認（任意）

```
solana logs -u devnet | grep -i raydium_amm
```

---

### OpenBook マーケット作成（Devnet・要点）

Raydium AMM の機能テストには、OpenBook マーケット（CLOB）の用意が前提です。以下は要点のみです。手順の背景説明・落とし穴・推奨パラメータは `docs/openbook.md` を参照してください。

- 目的: Base/Quote の 2 種 SPL トークンを用意し、OpenBook 上に取引ペアのマーケットを作成する
- Devnet の OpenBook Program ID: `EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj`

1) ツール準備（未導入なら実施）

```
cargo install spl-token-cli
```

2) SPL トークンを 2 種（Base/Quote）作成

```
# 例: Base は 9 桁、Quote は 6 桁
spl-token create-token --decimals 9     # => <BASE_MINT>
spl-token create-token --decimals 6     # => <QUOTE_MINT>
```

3) 各ミント用の ATA を作成

```
spl-token create-account <BASE_MINT>
spl-token create-account <QUOTE_MINT>
```

4) 初期供給をミント（単位は最小単位＝ディシマル反映後の整数）

```
# 例: それぞれ 1,000,000 トークン相当をミント
spl-token mint <BASE_MINT> 1000000000000   # 9 桁の最小単位で 1,000,000
spl-token mint <QUOTE_MINT> 1000000000000  # 6 桁の最小単位で 1,000,000
```

5) OpenBook でマーケット作成（list-market）

- 指定する主な引数: `--coin-mint <BASE_MINT> --pc-mint <QUOTE_MINT> --lot-size <LOT> --tick-size <TICK> --event-queue-length <N> --request-queue-length <N> --orderbook-length <N>`
- 精度の注意: ロット/ティックの精度は基盤トークンのディシマルと整合させ、過剰な精度は避ける
- コストの注意: キュー/オーダーブック長を短くすると作成コストは下がるが、スループットが低下
- 実コマンド例や推奨値の一覧は `docs/openbook.md` の表・解説を参照

得られた「Market ID」を控えてください（後続の Raydium プール初期化で使用）。

---

### 機能テストの入口（プール初期化〜入金〜スワップ）
Raydium AMM は OpenBook の既存マーケットに紐づけてプールを初期化します。最短ルートとして Rust の `raydium-library` を利用します。

1) OpenBook マーケットを用意
- Devnet 上で 2 種の SPL トークン（Base/Quote）を作成し、`openbook-dex` でマーケットを作成（`list-market`）
- Devnet の OpenBook Program ID: `EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj`
- 手順とパラメータ選定の詳細は `docs/openbook.md` を参照（精度・コストの注意点を含む）

2) Rust クライアント（`raydium-library`）依存例（devnet）

```toml
# Cargo.toml
[dependencies]
amm-cli = { git = "https://github.com/raydium-io/raydium-library" }
common  = { git = "https://github.com/raydium-io/raydium-library" }
solana-client = "<1.17.0"
solana-sdk    = "<1.17.0"
anyhow = "1"
clap = { version = "4.1.8", features = ["derive"] }

[features]
devnet = ["amm-cli/devnet", "common/devnet"]
```

初期化時の主な設定（例）：

```rust
// 省略: use, setup など
let mut config = common::common_types::CommonConfig::default();
config.set_cluster("https://api.devnet.solana.com", "wss://api.devnet.solana.com");
config.set_wallet("/Users/you/.config/solana/id.json");
config.set_amm_program("<YOUR_PROGRAM_ID>");
// devnet の OpenBook Program は devnet feature で自動設定されます（明示する場合）
// config.set_openbook_program("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
```

以降は README の QuickStart 通りに `amm_cli::process_amm_commands` を用いて:
- `CreatePool`（OpenBook マーケット、ミント、初期残高などを指定）
- `Deposit`（LPを受け取り）
- `Swap`（BaseIn / BaseOut）
の順に `Instruction` を組み立て、`solana_client` 経由で送信します。

注意:
- `processor.rs` の `config_feature` で owner, fee 先, OpenBook Program が devnet 値に切り替わります（`--features devnet`）。
- Admin 系（Config 作成・更新、AdminCancel 等）は `amm_owner` の署名が必要です。通常検証では不要です。
- あなたの `<YOUR_PROGRAM_ID>` が公式 Devnet Program とは別空間であることに留意してください。

---

### つまずきやすい点
- Solana と依存のバージョン差異: `solana --version` が 2.1.x、`cargo build-sbf` が成功することを確認
- .so の出力パス相違: `target/deploy/` または `target/sbf-solana-solana/release/`
- 手数料 SOL 不足: `solana airdrop` で補充
- Program ID ミス: クライアント側で必ず `<YOUR_PROGRAM_ID>` を使う

---

### 参考リンク
- 監査・開発ドキュメントは本家 README を参照
  - Audit: `https://github.com/raydium-io/raydium-docs/tree/master/audit`
  - Dev Resources: `https://github.com/raydium-io/raydium-docs/tree/master/dev-resources`
  - OpenBook マーケット作成ガイド（本リポジトリ内）: `docs/openbook.md`


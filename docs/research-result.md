## Token-2022 + Transfer Hook リサーチ結果（回答集）

この文書は、`docs/research-requests-token2022.md` の各トピック（01〜12）に対する回答を、実装時に参照しやすい形で要点整理したものです。オンチェーン（Rust）およびオフチェーン（TypeScript）の観点、ベストプラクティス、既知の注意点を含みます。

---

### 01. Token-2022 Transfer Hook 仕様の正確な把握

- **公式仕様リンク（参考先の種類）**
  - SPL リポジトリ内の Transfer Hook 拡張ドキュメント（`extensions/transfer-hook/README` 等）
  - SPL Token-2022 拡張のドキュメントポータル内セクション
- **フック要求アカウント（transfer/transfer_checked 時）**
  - フック有効 mint では、標準アカウント（source, mint, destination, authority）に加え、フック向け追加アカウントが要求される
  - アカウントは、標準キーの後ろ・呼び出し元提供の `remaining_accounts` より前に配置される前提で検証される
  - 代表構成（順序・要件の例）
    - 1: `extra_account_meta_list` PDA（writable: false, signer: false）
    - 2: `mint`（writable: false, signer: false）
    - 3: `source`（writable: true, signer: false）
    - 4: `destination`（writable: true, signer: false）
    - 5〜: フック定義のカスタムアカウント（writable/signer は定義に依存）
- **呼び出し順序の要点**
  - AMM → spl-token-2022（transfer_checked）→（内部CPI）フックプログラム
  - spl-token-2022 は `extra_account_meta_list` と `remaining_accounts` を検証してからフックを呼び出す
- **主なエラー条件（例）**
  - `AccountMissing` / `MissingRequiredAccount`
  - `AccountNotWritable` / `AccountNotSigner`
  - `InvalidAccountData` / `IncorrectProgramId`
  - フック実行時の `InvalidInstructionData` など
- **最小参考実装（種類）**
  - SPL リポジトリの transfer hook example（最小フックプログラム）
  - コミュニティの最小サンプル（Execute 命令処理・アカウント解決の参考）

---

### 02. Token-2022 における `transfer_checked` の要件

- **API と差分（Token-2020 vs Token-2022）**
  - コア引数は概ね同等（source, mint, destination, authority, amount, decimals）
  - Token-2022 は拡張対応・フック有効時に追加アカウントの前提があり、`remaining_accounts` の適切な伝播が必須
  - `decimals` の検証はミント実値と照合される（不一致で失敗）
- **remaining_accounts（順序の要点）**
  - 先頭に `extra_account_meta_list`、続いて mint / source / destination、以降カスタム定義
  - 順序・個数・writable/signer が一致しない場合に失敗
- **CPI 構築のポイント（Rust）**
  - `spl_token_2022::instruction::transfer_checked` を生成
  - ミント拡張から `extra_account_meta_list` を取得・解決し、`Vec<AccountMeta>` を組み立てて結合
  - `invoke` / `invoke_signed` 実行
- **`decimals` の安全な取得**
  - `spl_token_2022::extension::StateWithExtensions<Mint>` で mint をアンパックし、オンチェーン状態から取得
  - ユーザー入力やキャッシュに依存しない（不正確な `decimals` はエラーや不正転送の原因）

---

### 03. Associated Token Account (ATA) の Token-2022 対応

- **導出（token program 指定）**
  - Rust: `spl_associated_token_account::get_associated_token_address_with_program_id(...)`
  - TS: `getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve?, programId, associatedTokenProgramId?)`
- **作成（token program 指定）**
  - Rust: `spl_associated_token_account::instruction::create_associated_token_account(...)` に `spl_token_2022::id()` を指定
  - TS: `createAssociatedTokenAccountInstruction(payer, ata, owner, mint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)`
- **既存/非存在の分岐**
  - 事前に存在チェック（Rust: `get_account_info`、TS: `connection.getAccountInfo`）
  - 存在時は作成命令をスキップ（冪等性担保）

---

### 04. Mint/Account のアンパック（拡張対応）

- **`StateWithExtensions` を用いたアンパック（Rust）**
  - `StateWithExtensions<Mint>` / `StateWithExtensions<Account>` で基本状態＋拡張へアクセス
  - `get_extension` で `TransferHook` / `MetadataPointer` 等を取得
- **Token-2020/2022 を同一コードで扱う分岐**
  - `account_info.owner` を `spl_token::id()` / `spl_token_2022::id()` で判定して分岐
  - 共通フィールドの抽象化（トレイト/Enum）で処理の統一を検討
- **owner 検証のベストプラクティス**
  - アンパック前に `owner == token_program_id` を厳格にチェック
  - 誤アカウント注入の防止

---

### 05. initialize_account / initialize_mint の Token-2022 対応API

- **API 選択指針**
  - ユーザー主口座: ATA 作成APIを優先（`create_associated_token_account`）
  - 新規 mint（拡張あり）: `initialize_mint2`（Token-2022）
  - プログラム所有の一時口座: `initialize_account3`（Token-2022）
- **サイズ見積と rent**
  - サイズ = `base_size + Σ(extension_size)`
  - Rent 例: `Rent::get()?.minimum_balance(size)`
- **推奨**
  - 可能な限り ATA 作成APIへ統一（標準化・互換性・保守性）

---

### 06. Transfer Hook のホワイトリスト設計

- **保存先と構造**
  - `amm_config` などの PDA に `HashMap<Pubkey, HookConfig>` を保持
  - `HookConfig`: `is_reentrant_safe` / `max_compute_units` / `expected_additional_accounts_hash` など
- **検証手順（スワップ時）**
  - mint を拡張対応でアンパック → `TransferHook` 有効性を確認
  - `transfer_hook_program_id` を抽出し、オンチェーンのホワイトリスト照合
  - `extra_account_meta_list` と呼び出し元 `remaining_accounts` を厳格照合（数・順序・writable/signer）
- **想定攻撃と対策（例）**
  - フック差し替え → ホワイトリスト厳格化
  - 追加アカウント偽装 → `extra_account_meta_list` との突合
  - 任意CPI/再入 → 監査／再入ガード／`HookConfig` 制限
  - DoS（CU 枯渇）→ 監視・問題フックの隔離

---

### 07. TypeScript 側の実装テンプレート

- **推奨パッケージ**
  - `@solana/spl-token`（0.3.x 系）：Token-2020/2022 機能統合、`TOKEN_2022_PROGRAM_ID` 利用可
- **Transfer Hook 付き mint の作成（概略）**
  - 必要 `space`（拡張分含む）を計算 → `createInitializeMint(2)` → `setTransferHook` 相当命令
- **ATA 作成（token program 指定版）**
  - `createAssociatedTokenAccountInstruction(..., programId = TOKEN_2022_PROGRAM_ID)`
- **remaining accounts の付与**
  - mint から `extra_account_meta_list` を取得 → `AccountMeta` に変換 → AMM スワップ命令の `keys` 末尾へ付与

---

### 08. 既存AMMとの統合事例・参考

- **公開情報の傾向**
  - 各AMM（Raydium/Orca/Meteora）は Token-2022/Hook への対応を検討・限定対応の段階的導入の傾向
- **共通知見**
  - remaining_accounts の動的組み立てがクライアント/コントラクト双方に複雑性を追加
  - ホワイトリスト/監査の運用負荷
  - 計算予算の逼迫リスク
- **ベストプラクティス**
  - 段階的ロールアウト、モジュール化、広範なE2Eテスト、情報共有

---

### 09. Devnet/Testnet の対応状況

- **安定度**
  - `spl-token-2022`（フック含む）と ATA Program は Devnet/Testnet で利用可能
- **ツール/SDK**
  - CLI 1.17 系以降、`@solana/web3.js` 1.80 系以降を推奨（互換性目安）
- **既知の注意**
  - 高負荷時の反映遅延（`getProgramAccounts` 等）にはリトライ
  - 古い `solana-program` × 新しい `spl-token-2022` の組合せで逆シリアライズ注意

---

### 10. E2E テスト観点のベストプラクティス

- **代表シナリオ**
  - フック有効・ホワイトリスト一致・正しいアカウント → 成功
  - フック有効・一致・不足/不正順序 → 失敗（トークンプログラム）
  - フック有効・ホワイトリスト不一致 → 失敗（AMM）
  - フックがパニック → 失敗（フック伝播）
  - フック無効 → 成功（フック呼出なし）
- **環境**
  - `solana-test-validator` / `solana-program-test`、ローカルデプロイ、初期化自動化
- **目的**
  - 機能検証＋セキュリティ（攻撃シナリオ下での安全な失敗）

---

### 11. 依存ライブラリの最新安定版（Rust/TS）

- **Rust（目安）**
  - `solana-program` 1.17.x
  - `spl-token` 4.0（`no-entrypoint`）
  - `spl-token-2022` 0.6.x（`no-entrypoint`）
  - `spl-associated-token-account` 2.0.x（`no-entrypoint`）
- **TypeScript（目安）**
  - `@solana/web3.js` ^1.80.0
  - `@solana/spl-token` ^0.3.x
- **方針**
  - Cargo.toml / package.json でバージョン固定、計画的アップグレード
  - 依存の互換性（特に `solana-program` と spl クレート群）を統一

---

### 12. ガス/手数料/サイズ影響

- **サイズと rent（例）**
  - Mint: 82B（ベース）→ + TransferHook ≈ +100B → 合計 ≈ 182B
  - Rent: `minimum_balance(サイズ)` に比例して増加
- **手数料・CU（目安）**
  - Token-2020: transfer 1 CPI / ≈4k–5k CU
  - Token-2022 + Hook: transfer 2 CPI（token→hook）/ ≈10k–30k CU（フック次第）
- **影響**
  - 低額/高頻度トランザクションではコスト負担増
  - 400k CU 制限により複合オペレーションは設計上の最適化が必須

---

### 結論と推奨事項（要点）

- **仕様準拠の徹底**: remaining_accounts の順序/内容・decimals 検証を厳格に
- **セキュリティ境界の再定義**: フックはホワイトリスト・監査必須
- **アカウント処理の拡張対応**: `StateWithExtensions`、token program 指定の ATA を標準化
- **コスト/性能の把握**: 追加CPI・拡張処理による CU/レント増を設計に反映
- **段階的導入＋E2E テスト**: 限定対応から開始し、包括的テストをCIに組込み
- **依存の厳格管理**: Rust/TS の推奨組合せを固定して再現性を確保
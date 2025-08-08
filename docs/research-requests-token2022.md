### Token-2022 + Transfer Hook 対応に向けたリサーチ依頼（プロンプト集）

このMDは、`docs/amm-token-2022-transfer-hook-guide.md` の実装方針を完了させるために必要な不明点を、リサーチ用AIにそのまま渡せる形で整理したものです。

対象リポジトリの主要ファイル:
- `amm/program/src/instruction.rs`
- `amm/program/src/processor.rs`
- `amm/program/src/invokers.rs`
- `scripts/*.js`, `demo-ui/*`

---

### 01. Token-2022 Transfer Hook 仕様の正確な把握
- 目的: Transfer Hook が有効なMintで、token-2022 がどのようにフックを実行し、どの追加アカウントを要求するかを正確に把握する。
- 成果物: 公式仕様リンク、要求される追加アカウント一覧、呼び出し順序、エラー条件、最低限の参考実装リンク。

プロンプト:
```text
調べてほしいこと:
- Solana Token-2022 の Transfer Hook 拡張の公式仕様・ドキュメントのURL
- Transfer Hookが有効なMintで、transfer/transfer_checked 時にトークンプログラムがフックプログラムへ渡す追加アカウントの要件（構成、順序、writable/signer 要件）
- Hookプログラム側の受け取りインターフェース（命令データ形式、主要アカウント）
- 失敗時のエラーコードと再現条件
- 参考になる最小フックプログラム実装（公式/コミュニティ）のURL

前提/コンテキスト:
- 当方のオンチェーンはRust（Anchor未使用）。`amm/program/src/invokers.rs` でCPIを組み立てる予定。
- Token-2022 の場合は `transfer_checked` と追加アカウント前方伝播を採用予定。
```

---

### 02. Token-2022 における `transfer_checked` の要件
- 目的: token-2022 で `transfer_checked` を使う際の引数・追加アカウントの最小/必須要件を整理する。
- 成果物: Rustでの具体的なCPI構築例（`Instruction`生成〜invoke）、必要なdecimalsの取得方法、`remaining_accounts` 取り回しの注意点。

プロンプト:
```text
調べてほしいこと:
- `spl_token_2022::instruction::transfer_checked` のシグネチャと、Token-2020との差分
- Transfer Hook有効時に `remaining_accounts` に含めるべきアカウントの詳細と順序
- Rustサンプル: CPI 調用例（`Instruction`作成、`invoke(_signed)`、追加アカウントの付与）
- `decimals` が必要な場合の安全な取得方法（Mint拡張を含む）

前提/コンテキスト:
- `amm/program/src/invokers.rs` の `token_transfer(_with_authority)` をトークンプログラム切替可能にしたい。
```

---

### 03. Associated Token Account (ATA) の Token-2022 対応
- 目的: ATA の導出/作成を token program ごとに正しく行うための最新API確認。
- 成果物: Rust/TS それぞれでの `get_associated_token_address_with_program_id` の利用例と、`create_associated_token_account` のトークンプログラム指定版の実装例。

プロンプト:
```text
調べてほしいこと:
- `spl_associated_token_account` で token program を指定して ATA を導出する関数名・正確なシグネチャ
- token-2022 用の ATA 作成命令（program id を明示する版）の使い方（Rust/TS両方）
- 既存ATAがある場合/無い場合の分岐サンプル

前提/コンテキスト:
- `amm/program/src/processor.rs` で従来の `initialize_account` ベースの割当を使用している箇所を、可能なら ATA 作成APIに統一したい。
```

---

### 04. Mint/Account のアンパック（拡張対応）
- 目的: Token-2022 の Mint/Account を拡張対応でアンパックするベストプラクティスを確認。
- 成果物: `StateWithExtensions` を用いたアンパック例、`decimals`/`mint_authority` の取得、安全なownerチェック手順。

プロンプト:
```text
調べてほしいこと:
- Rustで Token-2022 の Mint/Account を拡張対応でアンパックするサンプル（`StateWithExtensions`）
- Token-2020/SPL-Token と Token-2022 を同一コードで扱う際の分岐パターン
- owner検証（アカウントの `owner == token_program_id`）に関する注意点

前提/コンテキスト:
- `amm/program/src/processor.rs` の `unpack_token_account` / `unpack_mint` を差し替える。
```

---

### 05. initialize_account / initialize_mint の Token-2022 対応API
- 目的: 2022拡張を考慮した初期化API（`initialize_account3`/`initialize_mint2` など）の適切な利用指針。
- 成果物: いつ `*_2` / `*_3` を使うべきか、ATA作成APIで十分か、自前割当時の必要サイズ計算方法。

プロンプト:
```text
調べてほしいこと:
- Token-2022 での `initialize_account`/`initialize_mint` 系APIの選択基準
- 拡張有りMint/Accountのサイズ見積りと rent 計算の方法
- 可能な限り ATA 作成APIに寄せるべきかの推奨事項（公式/有識者見解）

前提/コンテキスト:
- `amm/program/src/processor.rs` は現在 allocate + initialize を直接呼んでいる。
```

---

### 06. Transfer Hook のホワイトリスト設計
- 目的: 許可フックのみを実行可能とする安全な設計（オンチェーン保存/検証）を確立。
- 成果物: 保存場所（`amm_config` PDA等）、検証ロジック、変更権限設計、攻撃ベクタと対策。

プロンプト:
```text
調べてほしいこと:
- Transfer Hook をホワイトリスト制御する設計の実例（PDAに許可するhook program idとconfigアカウントを保持）
- スワップ時の検証手順（Mint拡張確認 → remaining_accounts 検証 → 不一致時に拒否）
- 想定攻撃と対策（別hook差し替え、追加アカウント偽装、任意CPI誘発など）

前提/コンテキスト:
- `amm/program/src/processor.rs` に検証ロジックを実装予定。
```

---

### 07. TypeScript 側の実装テンプレート
- 目的: UI/スクリプトから Token-2022 + フック対応トランザクションを組むための具体例を収集。
- 成果物: `@solana/spl-token(2022)` の使用例、`TOKEN_2022_PROGRAM_ID` 定数の所在、Transfer Hook mint作成/設定、remaining accounts 付与手順。

プロンプト:
```text
調べてほしいこと:
- npmの最新パッケージで Token-2022 を扱う際の推奨（`@solana/spl-token` に統合? 別パッケージ?）
- Transfer Hook 拡張付きMintの作成・設定（TS）の最小サンプル
- `createAssociatedTokenAccount` の token program 指定版のTS例
- スワップ時に `remaining accounts` を命令末尾へ付与する実装例

前提/コンテキスト:
- `scripts/*.js` と `demo-ui` を更新予定。
```

---

### 08. 既存AMMとの統合事例・参考
- 目的: Raydium/Orca/Meteora が Token-2022 をどう捉えているか、統合のベストプラクティスを学ぶ。
- 成果物: 公開Issue/PR/設計ドキュメントのURL、既知の制約や落とし穴。

プロンプト:
```text
調べてほしいこと:
- Raydium / Orca / Meteora が Token-2022 + Transfer Hook へ対応/検討した公開情報（Issue/PR/ブログ/設計ノート）
- 統合時の制約、課題、ベストプラクティスの抜粋
```

---

### 09. Devnet/Testnet の対応状況
- 目的: Devnet/Testnet で Token-2022（ATA含む）がどの程度安定して使えるかを確認。
- 成果物: 既知の不具合、必要なクラスター/feature gate、テスト時の注意点。

プロンプト:
```text
調べてほしいこと:
- Devnet/Testnetで Token-2022 と Associated Token Account Program の対応状況
- Feature gate の有無、必要なCLI/SDKバージョン
- 既知の問題とワークアラウンド
```

---

### 10. E2E テスト観点のベストプラクティス
- 目的: Hook有/無、白黒リスト一致/不一致、成功/失敗のE2Eテスト設計事例を収集。
- 成果物: 代表的なテスト行程、アサーション例、再現性の高いセットアップ手順。

プロンプト:
```text
調べてほしいこと:
- Token-2022 + Transfer Hook を使うプロトコルで実施されているE2Eテストの例
- Hook有効/無効、remaining accounts 不足、不一致時の想定エラーの検証方法
```

---

### 11. 依存ライブラリの最新安定版（Rust/TS）
- 目的: 利用すべきクレート/npmのバージョンと互換性情報を整理。
- 成果物: `spl-token-2022`、`associated-token-account`、`@solana/web3.js`、`@solana/spl-token` の推奨バージョンと互換情報。

プロンプト:
```text
調べてほしいこと:
- Rust: `spl_token_2022`, `spl_associated_token_account`, `solana-program` の推奨バージョン組み合わせ
- TS: `@solana/web3.js`, `@solana/spl-token`（または別パッケージ）で Token-2022 を扱う際の推奨バージョン
- 互換性の注意点（breaking changes）
```

---

### 12. ガス/手数料/サイズ影響
- 目的: Token-2022 の拡張利用が手数料や口座サイズに与える影響を把握。
- 成果物: 代表的拡張（TransferHook, MetadataPointer など）使用時の口座サイズと必要lamports、手数料差分の参考値。

プロンプト:
```text
調べてほしいこと:
- TransferHook拡張付きMint/Accountのサイズと必要lamportsの目安
- Token-2020 と Token-2022 の手数料面の差異（invoke回数・追加アカウント増による）
```

---

### 優先度（上から順に）
1. 01, 02（Transfer Hookとtransfer_checkedの仕様確定）
2. 03, 04, 05（ATA/アンパック/初期化の実装詳細）
3. 06（ホワイトリスト設計）
4. 07（TS側の実装テンプレート）
5. 09, 11（環境と依存バージョン）
6. 10, 12（テスト計画とコスト概算）


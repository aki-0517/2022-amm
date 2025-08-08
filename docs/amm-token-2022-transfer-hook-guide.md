### AMM を Token-2022 + Transfer Hook 対応にするための修正手順

このドキュメントは、`docs/requirement.md` の要件（Token-2022 の Transfer Hook を用いたトークンをAMMで取引可能にする）を満たすために、`amm/` のオンチェーン・プログラムおよび周辺（クライアント/スクリプト）の変更点をまとめた実装ガイドです。

---

### 対応範囲（スコープ）
- **対応方針**: 既存AMMを拡張し、Token-2022 によるフック付きトークンの入出金・スワップを可能にする。
- **互換性**: 既存の SPL-Token（Token-2020）も引き続き動作。スイッチ可能な実装にする。
- **フックの扱い**: 任意フックは不要。安全と判断したフックのみを**ホワイトリスト**で許可。

---

### 現状の問題点（修正が必要な箇所の抜粋）
- `spl_token` へのハード依存（プログラムID固定、Stateのアンパック、CPI呼び出し）。
  - `amm/program/src/instruction.rs` で `spl_token::id()` を直接参照:

```27:35:amm/program/src/instruction.rs
// ... 省略 ...
AccountMeta::new_readonly(spl_token::id(), false),
// ... 省略 ...
```

- `amm/program/src/processor.rs` で `spl_token::state::{Account, Mint}` のアンパック・サイズ固定を前提:

```154:179:amm/program/src/processor.rs
pub fn unpack_token_account(
    account_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<spl_token::state::Account, AmmError> {
    if account_info.owner != token_program_id {
        Err(AmmError::InvalidSplTokenProgram)
    } else {
        spl_token::state::Account::unpack(&account_info.data.borrow())
            .map_err(|_| AmmError::ExpectedAccount)
    }
}

pub fn unpack_mint(
    account_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<spl_token::state::Mint, AmmError> {
    if account_info.owner != token_program_id {
        Err(AmmError::InvalidSplTokenProgram)
    } else {
        spl_token::state::Mint::unpack(&account_info.data.borrow())
            .map_err(|_| AmmError::ExpectedMint)
    }
}
```

- `amm/program/src/invokers.rs` で `transfer/mint_to/burn/close/set_authority` などが **すべて `spl_token` 固定**:

```44:69:amm/program/src/invokers.rs
let ix = spl_token::instruction::burn(
// ... 省略 ...
let ix = spl_token::instruction::transfer(
// ... 省略 ...
let ix = spl_token::instruction::mint_to(
// ... 省略 ...
let ix = spl_token::instruction::set_authority(
```

- ATA生成・サイズ計算が `spl_token` 前提:

```610:662:amm/program/src/processor.rs
// initialize_account を直接使用（Token-2022 の拡張サイズを考慮していない）
invoke(
    &spl_token::instruction::initialize_account(
        spl_token_program_id,
        associated_token_account.key,
        token_mint_account.key,
        associated_owner_account.key,
    )?,
    // ...
)
```

---

### 変更設計の全体像
- **トークンプログラムの外部化**: すべての入出金・スワップ系命令で `token_program` をアカウントとして受け取り、実行時に `spl_token` / `spl_token_2022` を切り替える。
- **CPIの抽象化**: `invokers.rs` をトークンプログラム非依存のラッパに変更。Token-2022 の場合は Transfer Hook を考慮した呼び出し（`transfer_checked` と追加アカウントの前方伝播）を行う。
- **ATAの導出/作成**: `spl_associated_token_account::get_associated_token_address_with_program_id` を用い、`token_program` 毎に ATA を計算/生成する。
- **Stateアンパック**: `token_program` を見て `spl_token` or `spl_token_2022` の `Account/Mint` をアンパック。Token-2022 では拡張（`TransferHook`など）に備えて extension-aware なAPIを利用する。
- **フックのホワイトリスト**: AMMの `amm_config` などに許可フックプログラムIDと関連設定アカウントを記録し、検証する。
- **後方互換**: `spl_token` の既存フローは維持し、引数に与えられた `token_program` が `spl_token::id()` なら従来通り動作。

---

### 手順（オンチェーン側）

1) 命令のアカウントに `token_program` を追加し、固定参照を排除
- `amm/program/src/instruction.rs` の各ビルダーで `AccountMeta::new_readonly(spl_token::id(), false)` を削除し、呼び出し側から渡される `token_program` を差し込む。
- `processor.rs` の各ハンドラで `token_program` アカウントを取得して以降の処理に渡す。

2) ATA の導出/生成をトークンプログラム別に対応
- `get_associated_token_address_with_program_id(owner, mint, token_program_id)` を使用。
- ATA作成は `spl_associated_token_account::instruction::create_associated_token_account(funding, owner, mint, token_program)` を利用（既存コードの `create_ata_spl_token` を更新）。

3) Token Account / Mint のアンパックを動的化
- `processor.rs` の `unpack_token_account` / `unpack_mint` を以下の方針に変更:
  - `if token_program_id == spl_token_2022::ID {` Token-2022 の API（拡張対応）でアンパック `}`
  - `else {` 従来通り `spl_token` `}`
- Token-2022 側では `StateWithExtensionsOwned` など extension-aware なアンパックを用いて `decimals` や `mint_authority` 等を取得。

4) CPI ラッパ（`invokers.rs`）をトークン非依存化
- `token_transfer(_with_authority)` は次のように分岐:
  - `spl_token` の場合: 従来の `spl_token::instruction::transfer`。
  - `spl_token_2022` の場合: `spl_token_2022::instruction::transfer_checked` を使用し、Transfer Hook が有効なMintでは必要な `remaining_accounts` をそのまま前方伝播。
- `mint_to / burn / set_authority / close_account` も同様にトークンプログラム別に分岐するヘルパへ置き換え。

5) Hook 追加アカウントの前方伝播（可変長）
- スワップ/入金/出金系の各命令に「フック用 追加アカウント（可変長）」を受け取るスロットを追加。
- `processor.rs` で受け取った `remaining_accounts` を Token-2022 の `transfer_checked` 呼び出しへそのまま渡す（AMM自体は解釈しない）。

6) フックのホワイトリスト検証
- `amm_config` などの状態に、許可する Transfer Hook プログラムIDと設定用アカウント（例: program-config PDA）を保持。
- スワップ時に、対象Mintに `TransferHook` 拡張が有効な場合:
  - 追加アカウント集合に含まれるフックプログラムID/設定アカウントがホワイトリストに存在することを検証。
  - 不一致なら `Err(UnauthorizedHook)` で拒否。

7) LP Mint / Vault の扱い
- 既存LP Mintは互換性重視で `spl_token` のままでも可。
- Vaultは対象Mintに従うため、Token-2022 のMintなら Token-2022 のATAを利用（手順2）。
- `initialize_account` / `initialize_mint` を直接使う箇所は、極力 ATA作成APIに寄せるか、Token-2022 時は `initialize_account3` / `initialize_mint2` など適切なAPIに分岐する。

8) サイズ/レント計算
- Token-2022 のトークン口座/ミントは拡張によりサイズが増える可能性があるため、**自前で allocate しない**方針を推奨（ATA作成に委ねる）。
- やむを得ず自前割当する場合は、Token-2022 の拡張を考慮したパックド長を計算してレントを見積もる。

---

### 手順（クライアント/UI/スクリプト）

1) Token-2022 + Transfer Hook のミント作成フローを追加
- `spl-token-2022` ライブラリで Mint を作成し、`TransferHook` 拡張を設定。
- フックプログラム（許可済み）と設定PDAを用意し、ミントの `TransferHook` に紐づけ。

2) AMM呼び出し時に `token_program` と `remaining_accounts` を渡す
- 既存の `scripts/*.js` / `demo-ui` のトランザクション生成を更新。
- 取引対象が Token-2022 の場合:
  - `token_program = spl_token_2022::ID`
  - フックが要求する追加アカウント（プログラム、config、検証に必要な各種PDA等）を命令末尾の `remaining_accounts` として付与。

3) 既存（SPL-Token）トークンは従来通り
- `token_program = spl_token::ID`
- 追加アカウント無しでOK。

---

### セキュリティ/検証
- フックのホワイトリスト:
  - デプロイ時に `amm_config` に許可リストを設定（Upgrade後の初期化手順を用意）。
  - 変更は権限者のみ実行可能に。
- フックの不正すり抜け防止:
  - Token-2022 Mintに `TransferHook` 拡張がある場合、追加アカウントが未指定/不一致なら即エラー。
  - CPI先 `token_program` が `spl_token_2022::ID` であることを厳格に検証。

---

### テスト観点（最低限）
- Token-2022 + フック有効Mintでの:
  - 入金（deposit）でフック成功/失敗（追加アカウント欠如）
  - 出金（withdraw）でフック成功
  - スワップ（swap）でフック成功/失敗（ホワイトリスト不一致）
- 既存 SPL-Token Mint での回帰（全フロー成功）
- 複数種フック（ボーナスポイント）でも取引可能であることの確認

---

### 実装チェックリスト（抜粋）
- [ ] すべての命令に `token_program` を追加し、`spl_token::id()` の直参照を排除
- [ ] `invokers.rs` をトークンプログラム非依存のCPIラッパに変更（`transfer_checked` + 追加アカウント）
- [ ] `remaining_accounts` を前方伝播する口を命令に追加
- [ ] ATA導出/作成で `get_associated_token_address_with_program_id` を使用
- [ ] Token-2022 の State アンパックに対応（拡張対応API）
- [ ] フックのホワイトリスト検証を `processor.rs` に実装
- [ ] 既存フロー（SPL-Token）との後方互換を維持
- [ ] E2E テスト（フック有/無、成功/失敗、ホワイトリスト不一致）

---

### 補足メモ
- 実装シンプル化のため、LP Mint は当面 `spl_token` のままとし、基軸トークン（coin/pc）は各Mintの `token_program` に追従する設計を推奨。
- 必要に応じて、将来的に LP Mint も Token-2022 化（例: `MetadataPointer`/`MintCloseAuthority` 等の拡張）可能。

---

### 参考（該当コードへのリンク）
- `spl_token` 固定参照:
  - `amm/program/src/instruction.rs` での `spl_token::id()` 参照
  - `amm/program/src/processor.rs` の `unpack_token_account` / `unpack_mint`
  - `amm/program/src/invokers.rs` の `transfer/mint_to/burn/...`

これらを本ガイドの方針に沿って段階的に抽象化/置換してください。


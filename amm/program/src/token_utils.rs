//! Token program utilities for supporting both SPL Token and SPL Token-2022
//! 
//! This module provides abstractions for working with both token programs
//! to support Token-2022 Transfer Hooks while maintaining backwards compatibility.

use solana_program::{
    account_info::AccountInfo,
    program_pack::Pack,
    pubkey::Pubkey,
};
use spl_token::state as spl_token_state;
use spl_token_2022::{
    extension::{StateWithExtensions, ExtensionType, BaseStateWithExtensions},
    state as spl_token_2022_state,
};
use crate::error::AmmError;

/// Unified representation of token account data
#[derive(Debug, Clone)]
pub struct TokenAccount {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub delegate: Option<Pubkey>,
    pub state: u8,
    pub is_native: Option<u64>,
    pub delegated_amount: u64,
    pub close_authority: Option<Pubkey>,
}

/// Unified representation of mint data
#[derive(Debug, Clone)]
pub struct TokenMint {
    pub mint_authority: Option<Pubkey>,
    pub supply: u64,
    pub decimals: u8,
    pub is_initialized: bool,
    pub freeze_authority: Option<Pubkey>,
}

impl From<spl_token_state::Account> for TokenAccount {
    fn from(account: spl_token_state::Account) -> Self {
        Self {
            mint: account.mint,
            owner: account.owner,
            amount: account.amount,
            delegate: account.delegate.into(),
            state: account.state as u8,
            is_native: account.is_native.into(),
            delegated_amount: account.delegated_amount,
            close_authority: account.close_authority.into(),
        }
    }
}

impl From<spl_token_2022_state::Account> for TokenAccount {
    fn from(account: spl_token_2022_state::Account) -> Self {
        Self {
            mint: account.mint,
            owner: account.owner,
            amount: account.amount,
            delegate: account.delegate.into(),
            state: account.state as u8,
            is_native: account.is_native.into(),
            delegated_amount: account.delegated_amount,
            close_authority: account.close_authority.into(),
        }
    }
}

impl From<spl_token_state::Mint> for TokenMint {
    fn from(mint: spl_token_state::Mint) -> Self {
        Self {
            mint_authority: mint.mint_authority.into(),
            supply: mint.supply,
            decimals: mint.decimals,
            is_initialized: mint.is_initialized,
            freeze_authority: mint.freeze_authority.into(),
        }
    }
}

impl From<spl_token_2022_state::Mint> for TokenMint {
    fn from(mint: spl_token_2022_state::Mint) -> Self {
        Self {
            mint_authority: mint.mint_authority.into(),
            supply: mint.supply,
            decimals: mint.decimals,
            is_initialized: mint.is_initialized,
            freeze_authority: mint.freeze_authority.into(),
        }
    }
}

/// Unpack token account with program-specific handling
pub fn unpack_token_account(
    account_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<TokenAccount, AmmError> {
    if account_info.owner != token_program_id {
        return Err(AmmError::InvalidSplTokenProgram);
    }

    if *token_program_id == spl_token::id() {
        let account = spl_token_state::Account::unpack(&account_info.data.borrow())
            .map_err(|_| AmmError::ExpectedAccount)?;
        Ok(account.into())
    } else if *token_program_id == spl_token_2022::id() {
        let account_data = account_info.data.borrow();
        let account = StateWithExtensions::<spl_token_2022_state::Account>::unpack(&account_data)
            .map_err(|_| AmmError::ExpectedAccount)?;
        Ok(account.base.into())
    } else {
        Err(AmmError::InvalidSplTokenProgram)
    }
}

/// Unpack mint with program-specific handling
pub fn unpack_mint(
    account_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<TokenMint, AmmError> {
    if account_info.owner != token_program_id {
        return Err(AmmError::InvalidSplTokenProgram);
    }

    if *token_program_id == spl_token::id() {
        let mint = spl_token_state::Mint::unpack(&account_info.data.borrow())
            .map_err(|_| AmmError::ExpectedMint)?;
        Ok(mint.into())
    } else if *token_program_id == spl_token_2022::id() {
        let mint_data = account_info.data.borrow();
        let mint = StateWithExtensions::<spl_token_2022_state::Mint>::unpack(&mint_data)
            .map_err(|_| AmmError::ExpectedMint)?;
        Ok(mint.base.into())
    } else {
        Err(AmmError::InvalidSplTokenProgram)
    }
}

/// Check if a mint has transfer hooks enabled
pub fn has_transfer_hook(
    mint_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<bool, AmmError> {
    if *token_program_id != spl_token_2022::id() {
        return Ok(false); // SPL Token doesn't support hooks
    }

    let mint_data = mint_info.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022_state::Mint>::unpack(&mint_data)
        .map_err(|_| AmmError::ExpectedMint)?;

    Ok(mint.get_extension::<spl_token_2022::extension::transfer_hook::TransferHook>().is_ok())
}

/// Get transfer hook program ID if enabled
pub fn get_transfer_hook_program_id(
    mint_info: &AccountInfo,
    token_program_id: &Pubkey,
) -> Result<Option<Pubkey>, AmmError> {
    if *token_program_id != spl_token_2022::id() {
        return Ok(None);
    }

    let mint_data = mint_info.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022_state::Mint>::unpack(&mint_data)
        .map_err(|_| AmmError::ExpectedMint)?;

    match mint.get_extension::<spl_token_2022::extension::transfer_hook::TransferHook>() {
        Ok(extension) => {
            // Handle OptionalNonZeroPubkey - convert to Option<Pubkey>
            let pubkey: Option<Pubkey> = extension.program_id.into();
            Ok(pubkey)
        },
        Err(_) => Ok(None),
    }
}

/// Get the account length for a mint with extensions
pub fn get_mint_len_for_token_2022(extension_types: &[ExtensionType]) -> usize {
    ExtensionType::try_calculate_account_len::<spl_token_2022_state::Mint>(extension_types)
        .unwrap_or(spl_token_2022_state::Mint::LEN)
}

/// Get the account length for an account with extensions
pub fn get_account_len_for_token_2022(extension_types: &[ExtensionType]) -> usize {
    ExtensionType::try_calculate_account_len::<spl_token_2022_state::Account>(extension_types)
        .unwrap_or(spl_token_2022_state::Account::LEN)
}

/// Check if two token programs are compatible for a swap operation
pub fn are_programs_compatible(program_a: &Pubkey, program_b: &Pubkey) -> bool {
    // 両方が SPL Token または Token-2022 のいずれかである場合のみ互換とみなす
    (program_a == &spl_token::id() || program_a == &spl_token_2022::id())
        && (program_b == &spl_token::id() || program_b == &spl_token_2022::id())
}
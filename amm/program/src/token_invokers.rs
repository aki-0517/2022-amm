//! Token program invokers with support for both SPL Token and SPL Token-2022
//! 
//! This module provides CPI wrappers that handle the differences between 
//! SPL Token and SPL Token-2022, including transfer hook support.

use solana_program::{
    account_info::AccountInfo,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
};
use spl_token_2022::extension::BaseStateWithExtensions;
use crate::error::AmmError;

/// Token transfer with automatic hook handling
pub fn token_transfer_with_hook<'a>(
    token_program: AccountInfo<'a>,
    source: AccountInfo<'a>,
    destination: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    remaining_accounts: &[AccountInfo<'a>],
    amount: u64,
    authority_signature_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if *token_program.key == spl_token::id() {
        // Standard SPL Token transfer
        let ix = spl_token::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?;

        invoke_signed(
            &ix,
            &[source, destination, authority, token_program],
            &[authority_signature_seeds],
        )
    } else if *token_program.key == spl_token_2022::id() {
        // Token-2022 transfer with potential hooks (unchecked)
        let ix = spl_token_2022::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?;

        // Prepare accounts including remaining accounts for hooks
        let mut accounts = vec![
            source.clone(),
            destination.clone(),
            authority.clone(),
            token_program.clone(),
        ];
        // Add remaining accounts for transfer hooks
        accounts.extend_from_slice(remaining_accounts);

        invoke_signed(&ix, &accounts, &[authority_signature_seeds])
    } else {
        Err(ProgramError::InvalidArgument)
    }
}

/// Token mint_to with program selection
pub fn token_mint_to<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    destination: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
    authority_signature_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if *token_program.key == spl_token::id() {
        let ix = spl_token::instruction::mint_to(
            token_program.key,
            mint.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?;

        invoke_signed(
            &ix,
            &[mint, destination, authority, token_program],
            &[authority_signature_seeds],
        )
    } else if *token_program.key == spl_token_2022::id() {
        let ix = spl_token_2022::instruction::mint_to(
            token_program.key,
            mint.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?;

        invoke_signed(
            &ix,
            &[mint, destination, authority, token_program],
            &[authority_signature_seeds],
        )
    } else {
        Err(ProgramError::InvalidArgument)
    }
}

/// Token burn with program selection
pub fn token_burn<'a>(
    token_program: AccountInfo<'a>,
    burn_account: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    owner: AccountInfo<'a>,
    burn_amount: u64,
    authority_signature_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if *token_program.key == spl_token::id() {
        let ix = spl_token::instruction::burn(
            token_program.key,
            burn_account.key,
            mint.key,
            owner.key,
            &[],
            burn_amount,
        )?;

        invoke_signed(
            &ix,
            &[burn_account, mint, owner, token_program],
            &[authority_signature_seeds],
        )
    } else if *token_program.key == spl_token_2022::id() {
        let ix = spl_token_2022::instruction::burn(
            token_program.key,
            burn_account.key,
            mint.key,
            owner.key,
            &[],
            burn_amount,
        )?;

        invoke_signed(
            &ix,
            &[burn_account, mint, owner, token_program],
            &[authority_signature_seeds],
        )
    } else {
        Err(ProgramError::InvalidArgument)
    }
}

/// Token close_account with program selection
pub fn token_close_account<'a>(
    token_program: AccountInfo<'a>,
    close_account: AccountInfo<'a>,
    destination_account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    authority_signature_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if *token_program.key == spl_token::id() {
        let ix = spl_token::instruction::close_account(
            token_program.key,
            close_account.key,
            destination_account.key,
            authority.key,
            &[],
        )?;

        invoke_signed(
            &ix,
            &[close_account, destination_account, authority, token_program],
            &[authority_signature_seeds],
        )
    } else if *token_program.key == spl_token_2022::id() {
        let ix = spl_token_2022::instruction::close_account(
            token_program.key,
            close_account.key,
            destination_account.key,
            authority.key,
            &[],
        )?;

        invoke_signed(
            &ix,
            &[close_account, destination_account, authority, token_program],
            &[authority_signature_seeds],
        )
    } else {
        Err(ProgramError::InvalidArgument)
    }
}

/// Set authority with program selection
pub fn token_set_authority<'a>(
    token_program: AccountInfo<'a>,
    owned_account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    authority_type: u8,
    new_authority: Option<&Pubkey>,
    authority_signature_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if *token_program.key == spl_token::id() {
        let authority_type = match authority_type {
            0 => spl_token::instruction::AuthorityType::MintTokens,
            1 => spl_token::instruction::AuthorityType::FreezeAccount,
            2 => spl_token::instruction::AuthorityType::AccountOwner,
            3 => spl_token::instruction::AuthorityType::CloseAccount,
            _ => return Err(ProgramError::InvalidArgument),
        };

        let ix = spl_token::instruction::set_authority(
            token_program.key,
            owned_account.key,
            new_authority,
            authority_type,
            authority.key,
            &[],
        )?;

        invoke_signed(
            &ix,
            &[owned_account, authority, token_program],
            &[authority_signature_seeds],
        )
    } else if *token_program.key == spl_token_2022::id() {
        let authority_type = match authority_type {
            0 => spl_token_2022::instruction::AuthorityType::MintTokens,
            1 => spl_token_2022::instruction::AuthorityType::FreezeAccount,
            2 => spl_token_2022::instruction::AuthorityType::AccountOwner,
            3 => spl_token_2022::instruction::AuthorityType::CloseAccount,
            _ => return Err(ProgramError::InvalidArgument),
        };

        let ix = spl_token_2022::instruction::set_authority(
            token_program.key,
            owned_account.key,
            new_authority,
            authority_type,
            authority.key,
            &[],
        )?;

        invoke_signed(
            &ix,
            &[owned_account, authority, token_program],
            &[authority_signature_seeds],
        )
    } else {
        Err(ProgramError::InvalidArgument)
    }
}

/// Create associated token account with program selection
pub fn create_associated_token_account<'a>(
    associated_account: AccountInfo<'a>,
    funding_account: AccountInfo<'a>,
    wallet_account: AccountInfo<'a>,
    token_mint_account: AccountInfo<'a>,
    token_program_account: AccountInfo<'a>,
    ata_program_account: AccountInfo<'a>,
    system_program_account: AccountInfo<'a>,
) -> Result<(), ProgramError> {
    let ix = spl_associated_token_account::instruction::create_associated_token_account(
        funding_account.key,
        wallet_account.key,
        token_mint_account.key,
        token_program_account.key,
    );

    invoke_signed(
        &ix,
        &[
            associated_account,
            funding_account,
            wallet_account,
            token_mint_account,
            token_program_account,
            ata_program_account,
            system_program_account,
        ],
        &[],
    )
}

/// Validate transfer hook accounts for Token-2022
pub fn validate_transfer_hook_accounts(
    mint_info: &AccountInfo,
    token_program_id: &Pubkey,
    remaining_accounts: &[AccountInfo],
) -> Result<(), ProgramError> {
    if *token_program_id != spl_token_2022::id() {
        return Ok(());
    }

    // Check if mint has transfer hooks
    let mint_data = mint_info.data.borrow();
    let mint = spl_token_2022::extension::StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)
        .map_err(|_| AmmError::ExpectedMint)?;

    if let Ok(transfer_hook) = mint.get_extension::<spl_token_2022::extension::transfer_hook::TransferHook>() {
        let hook_program: Option<Pubkey> = transfer_hook.program_id.into();
        msg!("Transfer hook program: {:?}", hook_program);
        
        // Basic validation that we have the minimum required accounts
        // The exact validation would depend on the specific hook implementation
        if remaining_accounts.is_empty() {
            msg!("Transfer hook enabled but no additional accounts provided");
            return Err(AmmError::InvalidTransferHookAccounts.into());
        }
    }

    Ok(())
}
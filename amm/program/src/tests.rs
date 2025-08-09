#[cfg(test)]
mod tests {
    use solana_program::{
        pubkey::Pubkey,
        program_pack::Pack,
    };
    use solana_program_test::*;
    
    use crate::{
        error::AmmError,
        token_utils::{TokenAccount, TokenMint},
        whitelist::*,
    };

    /// Test token program compatibility checking
    #[test]
    fn test_token_program_compatibility() {
        let spl_token_id = spl_token::id();
        let spl_token_2022_id = spl_token_2022::id();
        let invalid_program = Pubkey::new_unique();

        // Valid combinations
        assert!(crate::token_utils::are_programs_compatible(&spl_token_id, &spl_token_id));
        assert!(crate::token_utils::are_programs_compatible(&spl_token_2022_id, &spl_token_2022_id));
        assert!(crate::token_utils::are_programs_compatible(&spl_token_id, &spl_token_2022_id));
        assert!(crate::token_utils::are_programs_compatible(&spl_token_2022_id, &spl_token_id));

        // Invalid combinations
        assert!(!crate::token_utils::are_programs_compatible(&invalid_program, &spl_token_id));
        assert!(!crate::token_utils::are_programs_compatible(&spl_token_id, &invalid_program));
    }

    /// Test default whitelist initialization
    #[test]
    fn test_default_whitelist() {
        let whitelist = get_default_whitelist();
        // Default whitelist should be empty for security
        assert!(whitelist.is_empty());
    }

    /// Test hook safety validation
    #[test] 
    fn test_hook_safety() {
        let safe_config = HookConfig {
            is_reentrant_safe: true,
            max_compute_units: 10000,
            expected_accounts_hash: None,
        };

        let unsafe_config = HookConfig {
            is_reentrant_safe: false,
            max_compute_units: 100000, // Too high
            expected_accounts_hash: None,
        };

        assert!(is_hook_safe(&safe_config));
        assert!(!is_hook_safe(&unsafe_config));
    }

    /// Test error code mapping
    #[test]
    fn test_error_codes() {
        use solana_program::program_error::ProgramError;
        
        let hook_error: ProgramError = AmmError::InvalidTransferHookAccounts.into();
        match hook_error {
            ProgramError::Custom(code) => {
                assert_eq!(code, AmmError::InvalidTransferHookAccounts as u32);
            }
            _ => panic!("Expected custom error"),
        }

        let whitelist_error: ProgramError = AmmError::UnauthorizedTransferHook.into();
        match whitelist_error {
            ProgramError::Custom(code) => {
                assert_eq!(code, AmmError::UnauthorizedTransferHook as u32);
            }
            _ => panic!("Expected custom error"),
        }
    }

    /// Mock test for token account unpacking
    #[test]
    fn test_token_account_conversion() {
        // Test SPL Token account conversion
        let spl_account = spl_token::state::Account {
            mint: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            amount: 1000,
            delegate: Default::default(),
            state: spl_token::state::AccountState::Initialized,
            is_native: Default::default(),
            delegated_amount: 0,
            close_authority: Default::default(),
        };

        let converted: TokenAccount = spl_account.into();
        assert_eq!(converted.amount, 1000);

        // Test Token-2022 account conversion  
        let token_2022_account = spl_token_2022::state::Account {
            mint: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            amount: 2000,
            delegate: Default::default(),
            state: spl_token_2022::state::AccountState::Initialized,
            is_native: Default::default(),
            delegated_amount: 0,
            close_authority: Default::default(),
        };

        let converted_2022: TokenAccount = token_2022_account.into();
        assert_eq!(converted_2022.amount, 2000);
    }

    /// Mock test for mint conversion
    #[test]
    fn test_token_mint_conversion() {
        // Test SPL Token mint conversion
        let spl_mint = spl_token::state::Mint {
            mint_authority: Default::default(),
            supply: 1000000,
            decimals: 6,
            is_initialized: true,
            freeze_authority: Default::default(),
        };

        let converted: TokenMint = spl_mint.into();
        assert_eq!(converted.supply, 1000000);
        assert_eq!(converted.decimals, 6);

        // Test Token-2022 mint conversion
        let token_2022_mint = spl_token_2022::state::Mint {
            mint_authority: Default::default(),
            supply: 2000000,
            decimals: 9,
            is_initialized: true,
            freeze_authority: Default::default(),
        };

        let converted_2022: TokenMint = token_2022_mint.into();
        assert_eq!(converted_2022.supply, 2000000);
        assert_eq!(converted_2022.decimals, 9);
    }

    /// Test extension type calculations
    #[test]
    fn test_extension_lengths() {
        use spl_token_2022::extension::ExtensionType;

        // Test mint length calculation
        let mint_extensions = vec![ExtensionType::TransferHook];
        let mint_len = crate::token_utils::get_mint_len_for_token_2022(&mint_extensions);
        assert!(mint_len >= <spl_token_2022::state::Mint as Pack>::LEN);

        // Test account length calculation  
        let account_extensions = vec![];
        let account_len = crate::token_utils::get_account_len_for_token_2022(&account_extensions);
        assert_eq!(account_len, <spl_token_2022::state::Account as Pack>::LEN);
    }

    /// Integration test placeholder
    #[tokio::test]
    async fn test_token_2022_integration() {
        // This would be a comprehensive integration test
        // using solana-program-test to create a full testing environment
        
        // Steps would include:
        // 1. Create a test validator
        // 2. Deploy the AMM program
        // 3. Create Token-2022 mints with transfer hooks
        // 4. Initialize AMM pools
        // 5. Test deposits, withdrawals, and swaps
        // 6. Verify hook execution
        
        // For now, this is a placeholder to show structure
        assert!(true);
    }
}
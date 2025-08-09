import 'dotenv/config';
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeMint2Instruction,
  createInitializeTransferHookInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMintLen,
  ExtensionType,
} from '@solana/spl-token';
import {
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getConnection, getPayer, getEnv } from './shared.js';

/**
 * This approach creates both Token-2022 tokens (for AMM) and SPL wrapper tokens (for OpenBook market)
 * The AMM will use Token-2022 with transfer hooks, but the market creation uses standard SPL tokens
 */

async function createToken2022MintWithTransferHook(connection, payer, decimals, transferHookProgramId = null) {
  const mint = Keypair.generate();
  
  // Calculate mint size with TransferHook extension if transfer hook is provided
  const extensions = transferHookProgramId ? [ExtensionType.TransferHook] : [];
  const mintLen = getMintLen(extensions);
  const rent = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction();
  
  // Create mint account
  tx.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    lamports: rent,
    space: mintLen,
    programId: TOKEN_2022_PROGRAM_ID,
  }));

  // Initialize TransferHook extension if transfer hook program is provided
  if (transferHookProgramId) {
    tx.add(createInitializeTransferHookInstruction(
      mint.publicKey,
      payer.publicKey, // authority
      transferHookProgramId,
      TOKEN_2022_PROGRAM_ID
    ));
  }

  // Initialize mint
  tx.add(createInitializeMint2Instruction(
    mint.publicKey,
    decimals,
    payer.publicKey, // mint authority
    null, // freeze authority
    TOKEN_2022_PROGRAM_ID
  ));

  // Create ATA for Token-2022
  const ata = getAssociatedTokenAddressSync(
    mint.publicKey, 
    payer.publicKey, 
    false, // allowOwnerOffCurve
    TOKEN_2022_PROGRAM_ID
  );
  
  tx.add(createAssociatedTokenAccountInstruction(
    payer.publicKey, // payer
    ata, // ata
    payer.publicKey, // owner
    mint.publicKey, // mint
    TOKEN_2022_PROGRAM_ID
  ));

  // Mint some supply for dev testing
  tx.add(createMintToInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    1_000_000_000n, // 1 billion tokens
    [], // multiSigners
    TOKEN_2022_PROGRAM_ID
  ));

  await connection.sendTransaction(tx, [payer, mint], { skipPreflight: true });
  return { 
    mint: mint.publicKey, 
    ata, 
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    hasTransferHook: !!transferHookProgramId,
    transferHookProgramId 
  };
}

// Create standard SPL token for OpenBook market compatibility
async function createSplTokenMintAndAta(connection, payer, decimals) {
  const mint = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const tx = new Transaction();
  tx.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    lamports: rent,
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  }));
  tx.add(createInitializeMintInstruction(mint.publicKey, decimals, payer.publicKey, null));

  const ata = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey);
  tx.add(createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey
  ));

  // Mint some supply for dev testing
  tx.add(createMintToInstruction(mint.publicKey, ata, payer.publicKey, 1_000_000_000n));

  await connection.sendTransaction(tx, [payer, mint], { skipPreflight: true });
  return { 
    mint: mint.publicKey, 
    ata,
    tokenProgram: TOKEN_PROGRAM_ID,
    hasTransferHook: false,
    transferHookProgramId: null
  };
}

async function main() {
  const connection = getConnection();
  const payer = getPayer();

  const transferHookProgram = process.env.TRANSFER_HOOK_PROGRAM_ID || null;

  console.log('Creating Token-2022 tokens for AMM (with Transfer Hook support)...');
  
  // Create Token-2022 tokens for AMM usage
  const coinToken2022 = await createToken2022MintWithTransferHook(connection, payer, 6, transferHookProgram);
  const pcToken2022 = await createToken2022MintWithTransferHook(connection, payer, 6, transferHookProgram);
  
  console.log('Creating SPL wrapper tokens for OpenBook market compatibility...');
  
  // Create SPL wrapper tokens for OpenBook market
  const coinSpl = await createSplTokenMintAndAta(connection, payer, 6);
  const pcSpl = await createSplTokenMintAndAta(connection, payer, 6);

  console.log('\\n=== Token Creation Results ===');
  console.log('\\n--- Token-2022 Tokens (for AMM) ---');
  console.log('COIN_MINT_2022=', coinToken2022.mint.toBase58());
  console.log('PC_MINT_2022=', pcToken2022.mint.toBase58());
  console.log('USER_COIN_ACCOUNT_2022=', coinToken2022.ata.toBase58());
  console.log('USER_PC_ACCOUNT_2022=', pcToken2022.ata.toBase58());
  
  console.log('\\n--- SPL Wrapper Tokens (for OpenBook Market) ---');
  console.log('COIN_MINT_SPL=', coinSpl.mint.toBase58());
  console.log('PC_MINT_SPL=', pcSpl.mint.toBase58());
  console.log('USER_COIN_ACCOUNT_SPL=', coinSpl.ata.toBase58());
  console.log('USER_PC_ACCOUNT_SPL=', pcSpl.ata.toBase58());
  
  if (coinToken2022.hasTransferHook) {
    console.log('\\nTRANSFER_HOOK_PROGRAM=', coinToken2022.transferHookProgramId.toBase58());
  }
  
  console.log('\\n=== Add these to your .env file ===');
  console.log('# Token-2022 tokens for AMM');
  console.log(`COIN_MINT=${coinToken2022.mint.toBase58()}`);
  console.log(`PC_MINT=${pcToken2022.mint.toBase58()}`);
  console.log(`USER_COIN_ACCOUNT=${coinToken2022.ata.toBase58()}`);
  console.log(`USER_PC_ACCOUNT=${pcToken2022.ata.toBase58()}`);
  console.log(`COIN_TOKEN_PROGRAM=${coinToken2022.tokenProgram.toBase58()}`);
  console.log(`PC_TOKEN_PROGRAM=${pcToken2022.tokenProgram.toBase58()}`);
  
  console.log('\\n# SPL wrapper tokens for OpenBook market creation');
  console.log(`COIN_MINT_SPL=${coinSpl.mint.toBase58()}`);
  console.log(`PC_MINT_SPL=${pcSpl.mint.toBase58()}`);
  
  if (transferHookProgram) {
    console.log(`TRANSFER_HOOK_PROGRAM_ID=${transferHookProgram}`);
  }
  
  console.log('\\n=== Next Steps ===');
  console.log('1. Use COIN_MINT_SPL and PC_MINT_SPL for OpenBook market creation');
  console.log('2. Use COIN_MINT and PC_MINT (Token-2022) for AMM pool initialization');
  console.log('3. The AMM will support Token-2022 with transfer hooks while maintaining OpenBook compatibility');
}

main().catch((e) => { console.error(e); process.exit(1); });
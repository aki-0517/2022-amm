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

// Fallback function for regular SPL tokens (for compatibility)
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

  // Check if we should create Token-2022 tokens or regular SPL tokens
  const useToken2022 = getEnv('USE_TOKEN_2022', 'true').toLowerCase() === 'true';
  const transferHookProgram = process.env.TRANSFER_HOOK_PROGRAM_ID || null;

  console.log(`Creating tokens with Token-${useToken2022 ? '2022' : '2020 (SPL)'} program...`);
  
  let coin, pc;
  
  if (useToken2022) {
    // Create Token-2022 tokens with optional transfer hook
    coin = await createToken2022MintWithTransferHook(connection, payer, 6, transferHookProgram);
    pc = await createToken2022MintWithTransferHook(connection, payer, 6, transferHookProgram);
  } else {
    // Create regular SPL tokens for compatibility
    coin = await createSplTokenMintAndAta(connection, payer, 6);
    pc = await createSplTokenMintAndAta(connection, payer, 6);
  }

  console.log('\n=== Token Creation Results ===');
  console.log('COIN_MINT=', coin.mint.toBase58());
  console.log('PC_MINT=', pc.mint.toBase58());
  console.log('USER_COIN_ACCOUNT=', coin.ata.toBase58());
  console.log('USER_PC_ACCOUNT=', pc.ata.toBase58());
  console.log('COIN_TOKEN_PROGRAM=', coin.tokenProgram.toBase58());
  console.log('PC_TOKEN_PROGRAM=', pc.tokenProgram.toBase58());
  
  if (coin.hasTransferHook) {
    console.log('COIN_TRANSFER_HOOK_PROGRAM=', coin.transferHookProgramId.toBase58());
  }
  
  if (pc.hasTransferHook) {
    console.log('PC_TRANSFER_HOOK_PROGRAM=', pc.transferHookProgramId.toBase58());
  }
  
  console.log('\n=== Add these to your .env file ===');
  console.log(`COIN_MINT=${coin.mint.toBase58()}`);
  console.log(`PC_MINT=${pc.mint.toBase58()}`);
  console.log(`USER_COIN_ACCOUNT=${coin.ata.toBase58()}`);
  console.log(`USER_PC_ACCOUNT=${pc.ata.toBase58()}`);
  console.log(`COIN_TOKEN_PROGRAM=${coin.tokenProgram.toBase58()}`);
  console.log(`PC_TOKEN_PROGRAM=${pc.tokenProgram.toBase58()}`);
  
  if (transferHookProgram) {
    console.log(`TRANSFER_HOOK_PROGRAM_ID=${transferHookProgram}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
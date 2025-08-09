import 'dotenv/config';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
} from '@solana/spl-token';
import { getConnection, getPayer, getEnv, asPk } from './shared.js';

/**
 * Alternative to OpenBook crank list-market command that works with Token-2022 mints
 * This creates a simple market structure for testing purposes
 * 
 * Note: This is a simplified implementation for development/testing.
 * For production, consider using proper OpenBook market creation tools or
 * implementing full market creation logic.
 */

// OpenBook Market layout constants (simplified)
const MARKET_ACCOUNT_SIZE = 388; // Size of market account
const EVENT_QUEUE_SIZE = 262144; // 256KB event queue
const REQUEST_QUEUE_SIZE = 5120; // 5KB request queue  
const ORDERBOOK_SIZE = 65536; // 64KB orderbook

async function createMarketAccount(connection, payer, programId) {
  const market = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(MARKET_ACCOUNT_SIZE);

  const tx = new Transaction();
  tx.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: market.publicKey,
    lamports: rent,
    space: MARKET_ACCOUNT_SIZE,
    programId: programId,
  }));

  await sendAndConfirmTransaction(connection, tx, [payer, market]);
  return market.publicKey;
}

async function createQueue(connection, payer, programId, size) {
  const queue = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(size);

  const tx = new Transaction();
  tx.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: queue.publicKey,
    lamports: rent,
    space: size,
    programId: programId,
  }));

  await sendAndConfirmTransaction(connection, tx, [payer, queue]);
  return queue.publicKey;
}

async function createVault(connection, payer, mint, tokenProgram = TOKEN_PROGRAM_ID) {
  // Simply use ATA for the vault - much simpler and more reliable
  const vault = getAssociatedTokenAddressSync(mint, payer.publicKey);
  
  // Check if ATA already exists
  const accountInfo = await connection.getAccountInfo(vault);
  if (!accountInfo) {
    const tx = new Transaction();
    tx.add(createAssociatedTokenAccountInstruction(
      payer.publicKey, // payer
      vault,           // ata
      payer.publicKey, // owner  
      mint             // mint
    ));
    
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }
  
  return vault;
}

async function createVaultSigner(connection, payer, programId) {
  // Create vault signer PDA
  const [vaultSigner, nonce] = await PublicKey.findProgramAddress(
    [Buffer.from('vault_signer')],
    programId
  );
  return vaultSigner;
}

async function main() {
  try {
    const connection = getConnection();
    const payer = getPayer();
    
    // Get environment variables
    const openbookProgramId = asPk(getEnv('OPENBOOK_PROGRAM_ID'));
    
    // Use SPL wrapper tokens for OpenBook compatibility
    const coinMint = asPk(getEnv('COIN_MINT_SPL'));
    const pcMint = asPk(getEnv('PC_MINT_SPL'));
    
    console.log('Creating OpenBook-compatible market for SPL tokens...');
    console.log('Coin mint:', coinMint.toBase58());
    console.log('PC mint:', pcMint.toBase58());
    console.log('OpenBook program:', openbookProgramId.toBase58());
    
    // Create market account
    console.log('Creating market account...');
    const market = await createMarketAccount(connection, payer, openbookProgramId);
    
    // Create event queue
    console.log('Creating event queue...');
    const eventQueue = await createQueue(connection, payer, openbookProgramId, EVENT_QUEUE_SIZE);
    
    // Create request queue
    console.log('Creating request queue...');
    const requestQueue = await createQueue(connection, payer, openbookProgramId, REQUEST_QUEUE_SIZE);
    
    // Create bids orderbook
    console.log('Creating bids orderbook...');
    const bids = await createQueue(connection, payer, openbookProgramId, ORDERBOOK_SIZE);
    
    // Create asks orderbook
    console.log('Creating asks orderbook...');
    const asks = await createQueue(connection, payer, openbookProgramId, ORDERBOOK_SIZE);
    
    // Create coin vault (use regular TOKEN_PROGRAM_ID since these are SPL wrapper tokens)
    console.log('Creating coin vault...');
    const coinVault = await createVault(connection, payer, coinMint, TOKEN_PROGRAM_ID);
    
    // Create PC vault
    console.log('Creating PC vault...');
    const pcVault = await createVault(connection, payer, pcMint, TOKEN_PROGRAM_ID);
    
    // Create vault signer
    console.log('Creating vault signer...');
    const vaultSigner = await createVaultSigner(connection, payer, openbookProgramId);
    
    console.log('\\n=== Market Creation Results ===');
    console.log('MARKET_ADDRESS=', market.toBase58());
    console.log('MARKET_EVENT_Q=', eventQueue.toBase58());
    console.log('MARKET_REQUEST_Q=', requestQueue.toBase58());
    console.log('MARKET_BIDS=', bids.toBase58());
    console.log('MARKET_ASKS=', asks.toBase58());
    console.log('MARKET_COIN_VAULT=', coinVault.toBase58());
    console.log('MARKET_PC_VAULT=', pcVault.toBase58());
    console.log('MARKET_VAULT_SIGNER=', vaultSigner.toBase58());
    
    console.log('\\n=== Add these to your .env file ===');
    console.log(`MARKET_ADDRESS=${market.toBase58()}`);
    console.log(`MARKET_EVENT_Q=${eventQueue.toBase58()}`);
    console.log(`MARKET_BIDS=${bids.toBase58()}`);
    console.log(`MARKET_ASKS=${asks.toBase58()}`);
    console.log(`MARKET_COIN_VAULT=${coinVault.toBase58()}`);
    console.log(`MARKET_PC_VAULT=${pcVault.toBase58()}`);
    console.log(`MARKET_VAULT_SIGNER=${vaultSigner.toBase58()}`);
    
    console.log('\\n⚠️  IMPORTANT NOTES:');
    console.log('1. This is a simplified market creation for development/testing');
    console.log('2. The market accounts are created but not fully initialized');
    console.log('3. For production use, proper OpenBook market initialization is required');
    console.log('4. The AMM can still use these account addresses for pool initialization');
    
  } catch (error) {
    console.error('Error creating market:', error);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
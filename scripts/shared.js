import 'dotenv/config';
import fs from 'fs';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

export function getEnv(name, fallback) {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`環境変数 ${name} が未設定です`);
}

export function getConnection() {
  const url = getEnv('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
  return new Connection(url, 'confirmed');
}

function expandPath(p) {
  if (!p) return p;
  let out = p;
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (out.startsWith('~')) {
    out = out.replace(/^~(?=$|\/)/, home);
  }
  out = out.replace(/\$\{?HOME\}?/g, home);
  return out;
}

export function loadKeypairFromFile(path) {
  const resolved = expandPath(path);
  const raw = fs.readFileSync(resolved, 'utf8');
  const arr = JSON.parse(raw);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function getPayer() {
  const def = `${process.env.HOME}/.config/solana/id.json`;
  const walletPath = getEnv('WALLET_PATH', def);
  return loadKeypairFromFile(walletPath);
}

export function asPk(v) {
  return new PublicKey(v);
}

export function u64ToLeBytes(num) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(num));
  return buf;
}

export function u16ToLeBytes(num) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(num);
  return buf;
}

export function ensureAtaIx(owner, mint, ata, tokenProgram = TOKEN_PROGRAM_ID) {
  return createAssociatedTokenAccountInstruction(
    owner, // payer
    ata,
    owner, // owner of ATA
    mint,
    tokenProgram
  );
}

// Token-2022 compatible ATA creation
export function ensureAta2022Ix(owner, mint, ata) {
  return createAssociatedTokenAccountInstruction(
    owner, // payer
    ata,
    owner, // owner of ATA
    mint,
    TOKEN_2022_PROGRAM_ID
  );
}

export async function ensureAta(connection, payer, owner, mint, tokenProgram = TOKEN_PROGRAM_ID) {
  const ata = tokenProgram.equals(TOKEN_2022_PROGRAM_ID) 
    ? getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID)
    : await getAssociatedTokenAddress(mint, owner);
  
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    const ix = ensureAtaIx(payer.publicKey, mint, ata, tokenProgram);
    const tx = new Transaction().add(ix);
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }
  return ata;
}

// Helper to get ATA address for any token program
export function getAtaAddress(mint, owner, tokenProgram = TOKEN_PROGRAM_ID) {
  return tokenProgram.equals(TOKEN_2022_PROGRAM_ID)
    ? getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID)
    : getAssociatedTokenAddressSync(mint, owner);
}

export const SEEDS = {
  AUTHORITY_AMM: 'amm authority',
  AMM_ASSOCIATED_SEED: 'amm_associated_seed',
  TARGET_ASSOCIATED_SEED: 'target_associated_seed',
  OPEN_ORDER_ASSOCIATED_SEED: 'open_order_associated_seed',
  COIN_VAULT_ASSOCIATED_SEED: 'coin_vault_associated_seed',
  PC_VAULT_ASSOCIATED_SEED: 'pc_vault_associated_seed',
  LP_MINT_ASSOCIATED_SEED: 'lp_mint_associated_seed',
  AMM_CONFIG_SEED: 'amm_config_account_seed',
};

export function findAmmPdaForMarket(programId, market, seed) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [programId.toBuffer(), market.toBuffer(), Buffer.from(seed)],
    programId
  );
  return { pda, bump };
}

export function findAuthority(programId) {
  const [pda, bump] = PublicKey.findProgramAddressSync([
    Buffer.from(SEEDS.AUTHORITY_AMM),
  ], programId);
  return { pda, bump };
}

export function findConfig(programId) {
  const [pda, bump] = PublicKey.findProgramAddressSync([
    Buffer.from(SEEDS.AMM_CONFIG_SEED),
  ], programId);
  return { pda, bump };
}

export const TOKEN_PID = TOKEN_PROGRAM_ID;
export const TOKEN_2022_PID = TOKEN_2022_PROGRAM_ID;

// Helper to determine token program from mint account
export async function getTokenProgramFromMint(connection, mint) {
  const accountInfo = await connection.getAccountInfo(mint);
  if (!accountInfo) {
    throw new Error(`Mint account ${mint.toBase58()} not found`);
  }
  
  if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  } else if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    return TOKEN_PROGRAM_ID;
  } else {
    throw new Error(`Unknown token program: ${accountInfo.owner.toBase58()}`);
  }
}

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function airdropIfNeeded(connection, pubkey, minLamports = 1_000_000_000n) {
  const bal = await connection.getBalance(pubkey);
  if (BigInt(bal) < minLamports) {
    const sig = await connection.requestAirdrop(pubkey, Number(minLamports));
    await connection.confirmTransaction(sig, 'confirmed');
  }
}

export function ix(accountMetas, programId, data) {
  return new TransactionInstruction({ programId, keys: accountMetas, data });
}

export function meta(pubkey, isWritable = false, isSigner = false) {
  return { pubkey, isWritable, isSigner };
}


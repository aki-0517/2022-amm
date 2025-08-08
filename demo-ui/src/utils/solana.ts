import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';

export const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('56o5kHAhG17ArhSC2qdpm3GFYfzGDeguwwMrxUk2fz49');
export const OPENBOOK_PROGRAM_ID = new PublicKey('EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj');

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

export function u64ToLeBytes(num: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(num));
  return buf;
}

export function findAmmPdaForMarket(programId: PublicKey, market: PublicKey, seed: string) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [programId.toBuffer(), market.toBuffer(), Buffer.from(seed)],
    programId
  );
  return { pda, bump };
}

export function findAuthority(programId: PublicKey) {
  const [pda, bump] = PublicKey.findProgramAddressSync([
    Buffer.from(SEEDS.AUTHORITY_AMM),
  ], programId);
  return { pda, bump };
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function meta(pubkey: PublicKey, isWritable = false, isSigner = false) {
  return { pubkey, isWritable, isSigner };
}

export function ix(accountMetas: Array<{pubkey: PublicKey, isWritable: boolean, isSigner: boolean}>, programId: PublicKey, data: Buffer) {
  return new TransactionInstruction({ programId, keys: accountMetas, data });
}

export async function createMintAndAta(
  connection: Connection, 
  payer: PublicKey, 
  sendTransaction: (transaction: Transaction, signers?: Keypair[]) => Promise<string>,
  decimals: number
): Promise<{ mint: PublicKey; ata: PublicKey }> {
  const mint = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const tx = new Transaction();
  tx.add(SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: mint.publicKey,
    lamports: rent,
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  }));
  
  tx.add(createInitializeMintInstruction(mint.publicKey, decimals, payer, null));

  const ata = await getAssociatedTokenAddress(mint.publicKey, payer);
  tx.add(createAssociatedTokenAccountInstruction(
    payer,
    ata,
    payer,
    mint.publicKey
  ));

  // Mint some supply for dev testing
  tx.add(createMintToInstruction(mint.publicKey, ata, payer, 1_000_000_000n));

  await sendTransaction(tx, [mint]);
  return { mint: mint.publicKey, ata };
}

export function packInitialize2({ nonce, openTime, initPcAmount, initCoinAmount }: {
  nonce: number;
  openTime: number;
  initPcAmount: bigint;
  initCoinAmount: bigint;
}): Buffer {
  const tag = Buffer.from([1]);
  return Buffer.concat([
    tag,
    Buffer.from([nonce & 0xff]),
    u64ToLeBytes(BigInt(openTime)),
    u64ToLeBytes(initPcAmount),
    u64ToLeBytes(initCoinAmount),
  ]);
}

export function packDeposit({ maxCoin, maxPc, baseSide, otherAmountMin }: {
  maxCoin: bigint;
  maxPc: bigint;
  baseSide: bigint;
  otherAmountMin?: bigint;
}): Buffer {
  const tag = Buffer.from([3]);
  const parts = [
    tag,
    u64ToLeBytes(maxCoin),
    u64ToLeBytes(maxPc),
    u64ToLeBytes(baseSide),
  ];
  if (otherAmountMin !== undefined && otherAmountMin !== null) {
    parts.push(u64ToLeBytes(otherAmountMin));
  }
  return Buffer.concat(parts);
}

export function packSwapBaseIn({ amountIn, minimumOut }: {
  amountIn: bigint;
  minimumOut: bigint;
}): Buffer {
  const tag = Buffer.from([9]);
  return Buffer.concat([
    tag,
    u64ToLeBytes(amountIn),
    u64ToLeBytes(minimumOut),
  ]);
}
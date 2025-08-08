import 'dotenv/config';
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import {
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getConnection, getPayer } from './shared.js';

async function createMintAndAta(connection, payer, decimals) {
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

  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey);
  tx.add(createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey
  ));

  // Mint some supply for dev testing
  tx.add(createMintToInstruction(mint.publicKey, ata, payer.publicKey, 1_000_000_000n));

  await connection.sendTransaction(tx, [payer, mint], { skipPreflight: true });
  return { mint: mint.publicKey, ata };
}

async function main() {
  const connection = getConnection();
  const payer = getPayer();

  const coin = await createMintAndAta(connection, payer, 6);
  const pc = await createMintAndAta(connection, payer, 6);

  console.log('COIN_MINT=', coin.mint.toBase58());
  console.log('PC_MINT=', pc.mint.toBase58());
  console.log('USER_COIN_ACCOUNT=', coin.ata.toBase58());
  console.log('USER_PC_ACCOUNT=', pc.ata.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });


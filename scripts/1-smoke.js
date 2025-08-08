import 'dotenv/config';
import { Transaction } from '@solana/web3.js';
import { getConnection, getEnv, getPayer, ix, meta, asPk } from './shared.js';

async function main() {
  const connection = getConnection();
  const payer = getPayer();
  const programId = asPk(getEnv('RAYDIUM_AMM_PROGRAM_ID'));

  const instruction = ix([], programId, Buffer.alloc(0));
  const tx = new Transaction().add(instruction);
  try {
    const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: true });
    await connection.confirmTransaction(sig, 'confirmed');
    console.log('unexpected success', sig);
  } catch (e) {
    console.log('program responded (expected error):', e.message ?? e.toString());
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


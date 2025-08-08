import 'dotenv/config';
import { Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  getConnection,
  getEnv,
  getPayer,
  asPk,
  findAuthority,
  findAmmPdaForMarket,
  SEEDS,
  meta,
  ix,
  u64ToLeBytes,
} from './shared.js';

function packSwapBaseIn({ amountIn, minimumOut }) {
  const tag = Buffer.from([9]);
  return Buffer.concat([
    tag,
    u64ToLeBytes(amountIn),
    u64ToLeBytes(minimumOut),
  ]);
}

async function main() {
  const connection = getConnection();
  const payer = getPayer();
  const programId = asPk(getEnv('RAYDIUM_AMM_PROGRAM_ID'));
  const market = asPk(getEnv('MARKET_ADDRESS'));

  const marketProgram = asPk(getEnv('OPENBOOK_PROGRAM_ID'));
  const marketBids = asPk(getEnv('MARKET_BIDS'));
  const marketAsks = asPk(getEnv('MARKET_ASKS'));
  const marketEventQ = asPk(getEnv('MARKET_EVENT_Q'));
  const marketCoinVault = asPk(getEnv('MARKET_COIN_VAULT'));
  const marketPcVault = asPk(getEnv('MARKET_PC_VAULT'));
  const marketVaultSigner = asPk(getEnv('MARKET_VAULT_SIGNER'));

  const { pda: ammPool } = findAmmPdaForMarket(programId, market, SEEDS.AMM_ASSOCIATED_SEED);
  const { pda: authority } = findAuthority(programId);
  const { pda: openOrders } = findAmmPdaForMarket(programId, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
  const { pda: coinVault } = findAmmPdaForMarket(programId, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
  const { pda: pcVault } = findAmmPdaForMarket(programId, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);

  const userSource = asPk(getEnv('SWAP_SOURCE_ATA'));
  const userDest = asPk(getEnv('SWAP_DEST_ATA'));

  const amountIn = BigInt(getEnv('SWAP_AMOUNT_IN', '100'));
  const minimumOut = BigInt(getEnv('SWAP_MINIMUM_OUT', '1'));
  const data = packSwapBaseIn({ amountIn, minimumOut });

  const keys = [
    meta(TOKEN_PROGRAM_ID, false, false),
    meta(ammPool, true, false),
    meta(authority, false, false),
    meta(openOrders, true, false),
    // meta(targetOrders) is optional for swap ixs v2, so省略
    meta(coinVault, true, false),
    meta(pcVault, true, false),
    meta(marketProgram, false, false),
    meta(market, true, false),
    meta(marketBids, true, false),
    meta(marketAsks, true, false),
    meta(marketEventQ, true, false),
    meta(marketCoinVault, true, false),
    meta(marketPcVault, true, false),
    meta(marketVaultSigner, false, false),
    meta(userSource, true, false),
    meta(userDest, true, false),
    meta(payer.publicKey, false, true),
  ];

  const instruction = ix(keys, programId, data);
  const tx = new Transaction().add(instruction);
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: true });
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('Swap tx:', sig);
}

main().catch((e) => { console.error(e); process.exit(1); });


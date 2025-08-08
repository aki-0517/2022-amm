import 'dotenv/config';
import { Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
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

function packDeposit({ maxCoin, maxPc, baseSide, otherAmountMin }) {
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

async function main() {
  const connection = getConnection();
  const payer = getPayer();
  const programId = asPk(getEnv('RAYDIUM_AMM_PROGRAM_ID'));
  const market = asPk(getEnv('MARKET_ADDRESS'));
  const marketEventQ = asPk(getEnv('MARKET_EVENT_Q'));

  const { pda: ammPool } = findAmmPdaForMarket(programId, market, SEEDS.AMM_ASSOCIATED_SEED);
  const { pda: authority } = findAuthority(programId);
  const { pda: openOrders } = findAmmPdaForMarket(programId, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
  const { pda: targetOrders } = findAmmPdaForMarket(programId, market, SEEDS.TARGET_ASSOCIATED_SEED);
  const { pda: lpMint } = findAmmPdaForMarket(programId, market, SEEDS.LP_MINT_ASSOCIATED_SEED);
  const { pda: coinVault } = findAmmPdaForMarket(programId, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
  const { pda: pcVault } = findAmmPdaForMarket(programId, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);

  const userCoin = asPk(getEnv('USER_COIN_ACCOUNT'));
  const userPc = asPk(getEnv('USER_PC_ACCOUNT'));
  const userLp = await getAssociatedTokenAddress(lpMint, payer.publicKey);

  const maxCoin = BigInt(getEnv('DEPOSIT_MAX_COIN', '1000'));
  const maxPc = BigInt(getEnv('DEPOSIT_MAX_PC', '1000'));
  const baseSide = BigInt(getEnv('DEPOSIT_BASE_SIDE', '0')); // 0: coin base, 1: pc base
  const otherMinEnv = process.env.DEPOSIT_OTHER_AMOUNT_MIN;
  const otherAmountMin = otherMinEnv ? BigInt(otherMinEnv) : undefined;

  const data = packDeposit({ maxCoin, maxPc, baseSide, otherAmountMin });

  const keys = [
    meta(TOKEN_PROGRAM_ID, false, false),
    meta(ammPool, true, false),
    meta(authority, false, false),
    meta(openOrders, false, false),
    meta(targetOrders, true, false),
    meta(lpMint, true, false),
    meta(coinVault, true, false),
    meta(pcVault, true, false),
    meta(market, false, false),
    meta(userCoin, true, false),
    meta(userPc, true, false),
    meta(userLp, true, false),
    meta(payer.publicKey, false, true),
    meta(marketEventQ, false, false),
  ];

  const instruction = ix(keys, programId, data);
  const tx = new Transaction().add(instruction);
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: true });
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('Deposit tx:', sig);
}

main().catch((e) => { console.error(e); process.exit(1); });


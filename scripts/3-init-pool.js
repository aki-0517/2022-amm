import 'dotenv/config';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  getConnection,
  getEnv,
  getPayer,
  asPk,
  findAuthority,
  findConfig,
  findAmmPdaForMarket,
  SEEDS,
  u64ToLeBytes,
  nowInSeconds,
  meta,
  ix,
} from './shared.js';

function packInitialize2({ nonce, openTime, initPcAmount, initCoinAmount }) {
  const tag = Buffer.from([1]);
  const b = Buffer.concat([
    tag,
    Buffer.from([nonce & 0xff]),
    u64ToLeBytes(initOpenTime(openTime)),
    u64ToLeBytes(initPcAmount),
    u64ToLeBytes(initCoinAmount),
  ]);
  return b;
}

function initOpenTime(t) {
  if (!t || Number.isNaN(Number(t))) return nowInSeconds() - 30;
  return Number(t);
}

async function main() {
  const connection = getConnection();
  const payer = getPayer();
  const programId = asPk(getEnv('RAYDIUM_AMM_PROGRAM_ID'));
  const market = asPk(getEnv('MARKET_ADDRESS'));

  const openbookProgram = asPk(getEnv('OPENBOOK_PROGRAM_ID', 'EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj'));
  const createFeeDest = asPk(getEnv('CREATE_POOL_FEE_DEST', '9y8ENuuZ3b19quffx9hQvRVygG5ky6snHfRvGpuSfeJy'));

  const coinMint = asPk(getEnv('COIN_MINT'));
  const pcMint = asPk(getEnv('PC_MINT'));

  const { pda: authority, bump: nonce } = findAuthority(programId);

  const { pda: ammPool } = findAmmPdaForMarket(programId, market, SEEDS.AMM_ASSOCIATED_SEED);
  const { pda: openOrders } = findAmmPdaForMarket(programId, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
  const { pda: targetOrders } = findAmmPdaForMarket(programId, market, SEEDS.TARGET_ASSOCIATED_SEED);
  const { pda: lpMint } = findAmmPdaForMarket(programId, market, SEEDS.LP_MINT_ASSOCIATED_SEED);
  const { pda: coinVault } = findAmmPdaForMarket(programId, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
  const { pda: pcVault } = findAmmPdaForMarket(programId, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);
  // Config PDA (independent of market)
  const { pda: configPda } = findConfig(programId);

  const userCoin = asPk(getEnv('USER_COIN_ACCOUNT'));
  const userPc = asPk(getEnv('USER_PC_ACCOUNT'));

  // Token program must be single and consistent. For Token-2022, both coin/pc must be 2022.
  const tokenProgram = asPk(getEnv('COIN_TOKEN_PROGRAM', TOKEN_PROGRAM_ID.toBase58()));
  
  const userLp = getAssociatedTokenAddressSync(lpMint, payer.publicKey);

  const initPc = BigInt(getEnv('INIT_PC', '1000000'));
  const initCoin = BigInt(getEnv('INIT_COIN', '1000000'));
  const openTime = Number(getEnv('OPEN_TIME', String(nowInSeconds() - 30)));

  const data = packInitialize2({ nonce, openTime, initPcAmount: initPc, initCoinAmount: initCoin });

  const keys = [
    meta(tokenProgram, false, false), // Token program (single)
    meta(ASSOCIATED_TOKEN_PROGRAM_ID, false, false),
    meta(SystemProgram.programId, false, false),
    meta(SYSVAR_RENT_PUBKEY, false, false),
    meta(ammPool, true, false),
    meta(authority, false, false),
    meta(openOrders, true, false),
    meta(lpMint, true, false),
    meta(coinMint, false, false),
    meta(pcMint, false, false),
    meta(coinVault, true, false),
    meta(pcVault, true, false),
    meta(targetOrders, true, false),
    meta(configPda, false, false),
    meta(createFeeDest, true, false),
    meta(openbookProgram, false, false),
    meta(market, false, false),
    meta(payer.publicKey, true, true),
    meta(userCoin, false, false),
    meta(userPc, false, false),
    meta(userLp, true, false),
  ];

  const instruction = ix(keys, programId, data);
  const tx = new Transaction().add(instruction);
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: true });
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('Init pool tx:', sig);
  console.log('AMM_POOL=', ammPool.toBase58());
  console.log('AMM_AUTHORITY=', authority.toBase58());
  console.log('AMM_OPEN_ORDERS=', openOrders.toBase58());
  console.log('AMM_LP_MINT=', lpMint.toBase58());
  console.log('AMM_COIN_VAULT=', coinVault.toBase58());
  console.log('AMM_PC_VAULT=', pcVault.toBase58());
  console.log('AMM_TARGET_ORDERS=', targetOrders.toBase58());
  console.log('AMM_CONFIG=', configPda.toBase58());
  console.log('USER_LP_ACCOUNT=', userLp.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });


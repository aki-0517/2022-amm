import React, { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, Transaction, SYSVAR_RENT_PUBKEY, SystemProgram, Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import './App.css'
import { 
  RAYDIUM_AMM_PROGRAM_ID, 
  OPENBOOK_PROGRAM_ID, 
  createMintAndAta,
  findAmmPdaForMarket,
  findAuthority,
  SEEDS,
  packInitialize2,
  packDeposit,
  packSwapBaseIn,
  meta,
  ix,
  nowInSeconds,
} from './utils/solana'

type ScriptFormData = {
  [key: string]: string
}

type ScriptConfig = {
  name: string
  description: string
  fields: Array<{
    key: string
    label: string
    type: 'text' | 'number'
    placeholder?: string
    required?: boolean
  }>
}

const SCRIPTS: Record<string, ScriptConfig> = {
  'create-tokens': {
    name: 'Create Tokens',
    description: 'Create new SPL tokens (COIN and PC)',
    fields: []
  },
  'init-pool': {
    name: 'Initialize Pool',
    description: 'Initialize AMM pool with tokens',
    fields: [
      { key: 'COIN_MINT', label: 'Coin Mint', type: 'text', required: true },
      { key: 'PC_MINT', label: 'PC Mint', type: 'text', required: true },
      { key: 'MARKET_ADDRESS', label: 'Market Address', type: 'text', required: true },
      { key: 'INIT_PC', label: 'Initial PC Amount', type: 'number', placeholder: '1000000' },
      { key: 'INIT_COIN', label: 'Initial Coin Amount', type: 'number', placeholder: '1000000' }
    ]
  },
  'deposit': {
    name: 'Deposit Liquidity',
    description: 'Add liquidity to the AMM pool',
    fields: [
      { key: 'DEPOSIT_MAX_COIN', label: 'Max Coin Amount', type: 'number', placeholder: '1000' },
      { key: 'DEPOSIT_MAX_PC', label: 'Max PC Amount', type: 'number', placeholder: '1000' },
      { key: 'DEPOSIT_BASE_SIDE', label: 'Base Side (0: coin, 1: pc)', type: 'number', placeholder: '0' }
    ]
  },
  'swap': {
    name: 'Swap Tokens',
    description: 'Swap tokens through the AMM',
    fields: [
      { key: 'SWAP_AMOUNT_IN', label: 'Amount In', type: 'number', placeholder: '100' },
      { key: 'SWAP_MINIMUM_OUT', label: 'Minimum Out', type: 'number', placeholder: '1' },
      { key: 'SWAP_SOURCE_ATA', label: 'Source Token Account', type: 'text', required: true },
      { key: 'SWAP_DEST_ATA', label: 'Destination Token Account', type: 'text', required: true }
    ]
  }
}

function ScriptForm({ scriptId, onExecute }: { scriptId: string; onExecute: (scriptId: string, data: ScriptFormData) => Promise<void> }) {
  const config = SCRIPTS[scriptId]
  const [formData, setFormData] = useState<ScriptFormData>({})
  const [isExecuting, setIsExecuting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsExecuting(true)
    try {
      await onExecute(scriptId, formData)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="script-form">
      <h3>{config.name}</h3>
      <p>{config.description}</p>
      <form onSubmit={handleSubmit}>
        {config.fields.map((field) => (
          <div key={field.key} className="field">
            <label htmlFor={field.key}>{field.label}:</label>
            <input
              type={field.type}
              id={field.key}
              value={formData[field.key] || ''}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              required={field.required}
            />
          </div>
        ))}
        <button type="submit" disabled={isExecuting}>
          {isExecuting ? 'Executing...' : `Execute ${config.name}`}
        </button>
      </form>
    </div>
  )
}

function App() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const executeScript = async (scriptId: string, data: ScriptFormData) => {
    if (!publicKey || !connection || !sendTransaction) {
      addLog('Error: Wallet not connected')
      return
    }

    addLog(`Executing ${scriptId} script...`)
    
    try {
      let txSig: string;
      
      switch (scriptId) {
        case 'create-tokens':
          txSig = await executeCreateTokens();
          break;
        case 'init-pool':
          txSig = await executeInitPool(data);
          break;
        case 'deposit':
          txSig = await executeDeposit(data);
          break;
        case 'swap':
          txSig = await executeSwap(data);
          break;
        default:
          throw new Error(`Unknown script: ${scriptId}`);
      }
      
      addLog(`✅ Transaction successful: ${txSig}`);
    } catch (error) {
      addLog(`❌ Error executing ${scriptId}: ${error}`);
      console.error(error);
    }
  }

  const executeCreateTokens = async (): Promise<string> => {
    addLog('Creating COIN and PC tokens...');
    
    // Create wrapper function that matches expected signature
    const txSender = (tx: Transaction, signers?: Keypair[]) => {
      return sendTransaction(tx, signers || []);
    };
    
    const coin = await createMintAndAta(connection, publicKey!, txSender, 6);
    const pc = await createMintAndAta(connection, publicKey!, txSender, 6);
    
    addLog(`COIN_MINT: ${coin.mint.toBase58()}`);
    addLog(`PC_MINT: ${pc.mint.toBase58()}`);
    addLog(`USER_COIN_ACCOUNT: ${coin.ata.toBase58()}`);
    addLog(`USER_PC_ACCOUNT: ${pc.ata.toBase58()}`);
    
    return 'batch-create-tokens';
  }

  const executeInitPool = async (data: ScriptFormData): Promise<string> => {
    addLog('Initializing AMM pool...');
    
    const coinMint = new PublicKey(data.COIN_MINT);
    const pcMint = new PublicKey(data.PC_MINT);
    const market = new PublicKey(data.MARKET_ADDRESS);
    
    const { pda: authority, bump: nonce } = findAuthority(RAYDIUM_AMM_PROGRAM_ID);
    const { pda: ammPool } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.AMM_ASSOCIATED_SEED);
    const { pda: openOrders } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
    const { pda: targetOrders } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.TARGET_ASSOCIATED_SEED);
    const { pda: lpMint } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.LP_MINT_ASSOCIATED_SEED);
    const { pda: coinVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
    const { pda: pcVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);
    
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AMM_CONFIG_SEED)], RAYDIUM_AMM_PROGRAM_ID);
    const createFeeDest = new PublicKey('9y8ENuuZ3b19quffx9hQvRVygG5ky6snHfRvGpuSfeJy');
    
    const userCoin = await getAssociatedTokenAddress(coinMint, publicKey!);
    const userPc = await getAssociatedTokenAddress(pcMint, publicKey!);
    const userLp = await getAssociatedTokenAddress(lpMint, publicKey!);
    
    const initPc = BigInt(data.INIT_PC || '1000000');
    const initCoin = BigInt(data.INIT_COIN || '1000000');
    const openTime = nowInSeconds() - 30;
    
    const instructionData = packInitialize2({ nonce, openTime, initPcAmount: initPc, initCoinAmount: initCoin });
    
    const keys = [
      meta(TOKEN_PROGRAM_ID, false, false),
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
      meta(OPENBOOK_PROGRAM_ID, false, false),
      meta(market, false, false),
      meta(publicKey!, true, true),
      meta(userCoin, true, false),
      meta(userPc, true, false),
      meta(userLp, true, false),
    ];
    
    const instruction = ix(keys, RAYDIUM_AMM_PROGRAM_ID, instructionData);
    const tx = new Transaction().add(instruction);
    
    const txSig = await sendTransaction(tx, []);
    await connection.confirmTransaction(txSig, 'confirmed');
    
    addLog(`AMM_POOL: ${ammPool.toBase58()}`);
    addLog(`USER_LP_ACCOUNT: ${userLp.toBase58()}`);
    
    return txSig;
  }

  const executeDeposit = async (data: ScriptFormData): Promise<string> => {
    addLog('Depositing liquidity...');
    
    // Get market address from env or previous execution
    const market = new PublicKey(process.env.REACT_APP_MARKET_ADDRESS || 'EAETbNvW1gjozcTs8CwJV4dennML9p9myF2ueYyvEFSz');
    const marketEventQ = new PublicKey(process.env.REACT_APP_MARKET_EVENT_Q || 'DoYAs3s4Tv8PtHWTLFJtZj692tRMUy9QGj4e73jcH4er');
    
    const { pda: ammPool } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.AMM_ASSOCIATED_SEED);
    const { pda: authority } = findAuthority(RAYDIUM_AMM_PROGRAM_ID);
    const { pda: openOrders } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
    const { pda: targetOrders } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.TARGET_ASSOCIATED_SEED);
    const { pda: lpMint } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.LP_MINT_ASSOCIATED_SEED);
    const { pda: coinVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
    const { pda: pcVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);
    
    // Use addresses from env or user input
    const userCoin = new PublicKey(process.env.REACT_APP_USER_COIN_ACCOUNT || 'F2vDTdFQtEXvfYHEiZcmfkRtawqyAk3DSPHXwvLL1Lv6');
    const userPc = new PublicKey(process.env.REACT_APP_USER_PC_ACCOUNT || 'F3HXa7SxjXU5SXHW6jtZNdKj4JVa4M437M9b66M79AMB');
    const userLp = await getAssociatedTokenAddress(lpMint, publicKey!);
    
    const maxCoin = BigInt(data.DEPOSIT_MAX_COIN || '1000');
    const maxPc = BigInt(data.DEPOSIT_MAX_PC || '1000');
    const baseSide = BigInt(data.DEPOSIT_BASE_SIDE || '0');
    
    const instructionData = packDeposit({ maxCoin, maxPc, baseSide });
    
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
      meta(publicKey!, false, true),
      meta(marketEventQ, false, false),
    ];
    
    const instruction = ix(keys, RAYDIUM_AMM_PROGRAM_ID, instructionData);
    const tx = new Transaction().add(instruction);
    
    const txSig = await sendTransaction(tx, []);
    await connection.confirmTransaction(txSig, 'confirmed');
    
    return txSig;
  }

  const executeSwap = async (data: ScriptFormData): Promise<string> => {
    addLog('Swapping tokens...');
    
    const market = new PublicKey(process.env.REACT_APP_MARKET_ADDRESS || 'EAETbNvW1gjozcTs8CwJV4dennML9p9myF2ueYyvEFSz');
    const marketBids = new PublicKey(process.env.REACT_APP_MARKET_BIDS || '8J1Mh4JFGbvg5DFetEsJ9BXsNTwnEowSjFT7qsWFETQq');
    const marketAsks = new PublicKey(process.env.REACT_APP_MARKET_ASKS || '9RF4WaiUvnsmrK4XuVVpeNPN4zHb1tm1gDm93ShCMhe4');
    const marketEventQ = new PublicKey(process.env.REACT_APP_MARKET_EVENT_Q || 'DoYAs3s4Tv8PtHWTLFJtZj692tRMUy9QGj4e73jcH4er');
    const marketCoinVault = new PublicKey(process.env.REACT_APP_MARKET_COIN_VAULT || '3kYo4RcPNyJF7biMAHWemGLuiicxMcSnC5DNWnXFmjsJ');
    const marketPcVault = new PublicKey(process.env.REACT_APP_MARKET_PC_VAULT || 'ynFv9n1Sz3ZZtjCu3RmzASGBGKYXdskizFbiSXSv8uV');
    const marketVaultSigner = new PublicKey(process.env.REACT_APP_MARKET_VAULT_SIGNER || 'AQcpgZMa4RdPCUktLsKHrjesTxBjEihA8N3aZsynV9zf');
    
    const { pda: ammPool } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.AMM_ASSOCIATED_SEED);
    const { pda: authority } = findAuthority(RAYDIUM_AMM_PROGRAM_ID);
    const { pda: openOrders } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.OPEN_ORDER_ASSOCIATED_SEED);
    const { pda: coinVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.COIN_VAULT_ASSOCIATED_SEED);
    const { pda: pcVault } = findAmmPdaForMarket(RAYDIUM_AMM_PROGRAM_ID, market, SEEDS.PC_VAULT_ASSOCIATED_SEED);
    
    const userSource = new PublicKey(data.SWAP_SOURCE_ATA);
    const userDest = new PublicKey(data.SWAP_DEST_ATA);
    
    const amountIn = BigInt(data.SWAP_AMOUNT_IN || '100');
    const minimumOut = BigInt(data.SWAP_MINIMUM_OUT || '1');
    
    const instructionData = packSwapBaseIn({ amountIn, minimumOut });
    
    const keys = [
      meta(TOKEN_PROGRAM_ID, false, false),
      meta(ammPool, true, false),
      meta(authority, false, false),
      meta(openOrders, true, false),
      meta(coinVault, true, false),
      meta(pcVault, true, false),
      meta(OPENBOOK_PROGRAM_ID, false, false),
      meta(market, true, false),
      meta(marketBids, true, false),
      meta(marketAsks, true, false),
      meta(marketEventQ, true, false),
      meta(marketCoinVault, true, false),
      meta(marketPcVault, true, false),
      meta(marketVaultSigner, false, false),
      meta(userSource, true, false),
      meta(userDest, true, false),
      meta(publicKey!, false, true),
    ];
    
    const instruction = ix(keys, RAYDIUM_AMM_PROGRAM_ID, instructionData);
    const tx = new Transaction().add(instruction);
    
    const txSig = await sendTransaction(tx, []);
    await connection.confirmTransaction(txSig, 'confirmed');
    
    return txSig;
  }

  return (
    <div className="app">
      <header>
        <h1>AMM Script Runner</h1>
        <WalletMultiButton />
      </header>
      
      {publicKey ? (
        <main>
          <div className="wallet-info">
            <p>Connected: {publicKey.toBase58()}</p>
          </div>
          
          <div className="scripts-grid">
            {Object.entries(SCRIPTS).map(([id, config]) => (
              <div key={id} className="script-card">
                <h3>{config.name}</h3>
                <p>{config.description}</p>
                <button onClick={() => setSelectedScript(selectedScript === id ? null : id)}>
                  {selectedScript === id ? 'Hide' : 'Configure & Run'}
                </button>
                {selectedScript === id && (
                  <ScriptForm scriptId={id} onExecute={executeScript} />
                )}
              </div>
            ))}
          </div>
          
          {logs.length > 0 && (
            <div className="logs">
              <h3>Execution Log</h3>
              <div className="log-content">
                {logs.map((log, i) => (
                  <div key={i} className="log-entry">{log}</div>
                ))}
              </div>
              <button onClick={() => setLogs([])} className="clear-logs">
                Clear Logs
              </button>
            </div>
          )}
        </main>
      ) : (
        <div className="connect-wallet">
          <p>Please connect your wallet to use the AMM scripts</p>
        </div>
      )}
    </div>
  )
}

export default App

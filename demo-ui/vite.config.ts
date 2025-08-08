import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    define: {
      'process.env': {
        REACT_APP_RAYDIUM_AMM_PROGRAM_ID: JSON.stringify(env.RAYDIUM_AMM_PROGRAM_ID),
        REACT_APP_OPENBOOK_PROGRAM_ID: JSON.stringify(env.OPENBOOK_PROGRAM_ID),
        REACT_APP_COIN_MINT: JSON.stringify(env.COIN_MINT),
        REACT_APP_PC_MINT: JSON.stringify(env.PC_MINT),
        REACT_APP_USER_COIN_ACCOUNT: JSON.stringify(env.USER_COIN_ACCOUNT),
        REACT_APP_USER_PC_ACCOUNT: JSON.stringify(env.USER_PC_ACCOUNT),
        REACT_APP_MARKET_ADDRESS: JSON.stringify(env.MARKET_ADDRESS),
        REACT_APP_MARKET_BIDS: JSON.stringify(env.MARKET_BIDS),
        REACT_APP_MARKET_ASKS: JSON.stringify(env.MARKET_ASKS),
        REACT_APP_MARKET_EVENT_Q: JSON.stringify(env.MARKET_EVENT_Q),
        REACT_APP_MARKET_COIN_VAULT: JSON.stringify(env.MARKET_COIN_VAULT),
        REACT_APP_MARKET_PC_VAULT: JSON.stringify(env.MARKET_PC_VAULT),
        REACT_APP_MARKET_VAULT_SIGNER: JSON.stringify(env.MARKET_VAULT_SIGNER),
        REACT_APP_SWAP_SOURCE_ATA: JSON.stringify(env.SWAP_SOURCE_ATA),
        REACT_APP_SWAP_DEST_ATA: JSON.stringify(env.SWAP_DEST_ATA),
      }
    }
  }
})

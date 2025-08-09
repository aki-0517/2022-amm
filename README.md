# 2022 AMM 

This project is based on the Raydium AMM protocol, featuring a complete Solana-based automated market maker implementation with Token-2022 support and OpenBook integration.

## Project Structure

- **`amm/`** - Core AMM program implementation
- **`program/`** - OpenBook DEX program and related utilities
- **`demo-ui/`** - React/TypeScript frontend demo application
- **`scripts/`** - JavaScript automation scripts for pool operations
- **`docs/`** - Comprehensive documentation and guides

## Key Features

- **Token-2022 Compatibility** - Full support for the new Token-2022 standard
- **OpenBook Integration** - Seamless liquidity sharing with OpenBook DEX
- **Transfer Hook Support** - Advanced token transfer hook functionality
- **Permissionless AMM** - Decentralized constant product market maker
- **Fibonacci Liquidity** - Optimized liquidity distribution using Fibonacci sequences

## Quick Start

### Prerequisites

1. Install [Rust](https://rustup.rs/) (v1.75.0+)
2. Install [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v2.1.0+)
3. Install [Node.js](https://nodejs.org/) (for scripts and demo UI)

### Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd 2022-amm

# Set Solana config (choose devnet or mainnet)
solana config set --url https://api.devnet.solana.com
```

### Build Programs

```bash
# Build AMM program
cd amm
cargo build-sbf --release --features devnet

# Build OpenBook DEX program
cd ../program/dex
cargo build-sbf --release
```

### Run Demo UI

```bash
cd demo-ui
npm install
npm run dev
```

### Execute Scripts

```bash
cd scripts
npm install

# Run the complete AMM setup sequence
npm run smoke-test
```

## Program Deployments

| Program | Devnet |
|---------|---------|
| AMM | `DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav` |
| OpenBook DEX | `EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj` |

## Documentation

- [Token-2022 Transfer Hook Guide](docs/amm-token-2022-transfer-hook-guide.md)
- [Devnet Deployment Guide](docs/devnet-deploy-and-test.md)
- [OpenBook Integration](docs/openbook.md)
- [Requirements & Research](docs/requirement.md)

## Development Scripts

The `scripts/` directory contains automated workflows:

1. **Smoke Test** - Complete system validation
2. **Token Creation** - Create standard and wrapper tokens
3. **Pool Initialization** - Set up AMM pools
4. **Liquidity Operations** - Deposit/withdraw liquidity
5. **Swap Operations** - Execute token swaps

## Testing

```bash
# Test AMM program
cd amm
cargo test

# Test OpenBook program
cd program/dex
cargo test

# Run frontend tests
cd demo-ui
npm test
```

## Contributing

1. Ensure all tests pass before submitting PRs
2. Follow Rust formatting standards (`cargo fmt`)
3. Update documentation for new features
4. Test on devnet before mainnet deployments

## Security

This is experimental software. Use at your own risk. See [SECURITY.md](amm/SECURITY.md) for security considerations.

## License

Licensed under the Apache License 2.0. See individual program directories for specific license information.

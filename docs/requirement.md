🧠 Context
Token-2022 is a critical upgrade for the Solana ecosystem — enabling whitelisting, KYC gating, conditional transfers, and other programmable behaviors via Transfer Hooks.

This makes Token-2022 the perfect foundation for tokenizing real-world assets (RWA) and serving enterprise use cases.

However, no major AMMs (Raydium, Orca, Meteora, etc.) currently support trading Token-2022 with active transfer hooks.

This limits the adoption of Token-2022 as a DeFi primitive.

🎯 Objective
Build a working solution that makes Token-2022 with Transfer Hooks tradable on a Solana AMM.

Your project can solve this in one of two ways:

✅ Build a new AMM that supports Token-2022 + Transfer Hook

✅ Patch or extend an existing AMM (Raydium, Orca, Meteora) to support whitelisted hook programs

The solution does not need to support arbitrary hooks. A whitelisted list of safe hook programs is acceptable.

✅ Submission Requirements
Your project must:

Provide a UI to:

Create a Token-2022 with a Transfer Hook

Create an LP pool (e.g., SOL-token pair)

Enable trading

Include a:

Video demo (walkthrough of the flow)

Live demo (deployed to devnet or testnet)

Source code


Bonus points for:

Expanding support to multiple hooks

Architecting a permissionless but safe hook approval system

Integrating directly with existing AMM protocols

💡 Inspiration
Some potential approaches:

Use pre-transfer simulation to approve trades

Whitelist a known-safe set of hook programs

Introduce proxy token wrappers to temporarily bypass restrictions with hook confirmation

Build a middleware relayer to validate hooks


🛠️ Tech Stack
Solana Token-2022

Anchor, Solana Program Library

Orca / Raydium / Meteora protocols (open-source)

TypeScript for UI + SDK

👩‍⚖️ Judging Criteria
Functionality: Does the system support real trading of Token-2022?

Security: Does it prevent bypass of Transfer Hook logic?

Scalability: Can the system work for other hooks / tokens?

Developer UX: How smooth is the UI and toolchain?

Documentation & Clarity: Is the code easy to understand and reuse?
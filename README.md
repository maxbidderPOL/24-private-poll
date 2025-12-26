# Private Poll

Anonymous polling platform powered by Fully Homomorphic Encryption (FHE). Create polls where participants submit encrypted numeric responses. Poll creators can view aggregated statistics without accessing individual answers.

## Live Demo

**Production URL:** https://24-private-poll.vercel.app

## Contract

**Address:** `0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff`  
**Network:** Sepolia Testnet  
**Explorer:** [View on Etherscan](https://sepolia.etherscan.io/address/0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff)

---

## Architecture Overview

### Application Architecture

The application follows a client-server-blockchain architecture:

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
         ├──► FHE Relayer SDK (Client-side encryption)
         │
         ├──► Ethereum Sepolia (Smart Contract)
         │
         └──► localStorage (User data cache)
```

**Key Components:**

1. **Frontend (Next.js/React)**
   - User interface for creating and participating in polls
   - Wallet connection via RainbowKit
   - FHE encryption client using Zama SDK
   - Local storage for user's own responses

2. **FHE Encryption Layer**
   - Zama FHEVM Relayer SDK for client-side encryption
   - Encrypts numeric responses before blockchain submission
   - Handles conversion of FHE handles to bytes32 format

3. **Smart Contract Layer**
   - Stores poll metadata (questions, ranges, timestamps)
   - Stores encrypted responses as bytes32 handles
   - Manages poll lifecycle (create, respond, close)
   - Enforces one response per participant

4. **Blockchain Storage**
   - Poll definitions stored in plain text (public information)
   - Responses stored as encrypted FHE handles (private)
   - Response metadata (timestamps, respondent addresses)

### Contract Architecture

The `PrivatePoll` smart contract is designed for privacy-preserving polling:

**Core Data Structures:**

```solidity
struct Poll {
    address creator;        // Poll creator address
    string question;        // Poll question text
    uint256 minValue;       // Minimum allowed response value
    uint256 maxValue;       // Maximum allowed response value
    uint256 endTime;        // Poll expiration timestamp
    uint256 createdAt;      // Creation timestamp
    uint256 responseCount;  // Number of responses received
    bool isActive;          // Poll status flag
}

struct EncryptedResponse {
    address respondent;     // Who submitted the response
    bytes32 encryptedValue; // FHE handle - encrypted numeric value
    uint256 submittedAt;    // Submission timestamp
}
```

**Storage Mappings:**

- `polls[pollId]` - Poll definitions by ID
- `pollResponses[pollId]` - Array of encrypted responses per poll
- `hasResponded[pollId][address]` - Prevents duplicate responses
- `userPolls[address]` - Polls created by user
- `userResponses[address]` - Polls user has responded to

**Function Categories:**

1. **Poll Management**
   - `createPoll()` - Create new poll with question and value range
   - `closePoll()` - Deactivate poll (creator only)

2. **Response Submission**
   - `submitResponse()` - Submit encrypted response to poll
   - Validates poll exists, is active, not expired
   - Ensures one response per participant
   - Stores encrypted bytes32 handle

3. **Data Retrieval**
   - `getPoll()` - Get poll metadata
   - `getPollResponses()` - Get all encrypted responses for poll
   - `getActivePolls()` - List active polls
   - `getUserPolls()` - User's created polls
   - `getUserResponses()` - Polls user has responded to

**Security Features:**

- One response per participant enforced on-chain
- Poll expiration enforced by timestamp
- Only creator can close polls
- Encrypted responses cannot be decrypted on-chain
- Response addresses visible but values remain encrypted

---

## FHE Encryption Flow

### Encryption Process

1. **User Submits Response**
   ```
   User selects value (e.g., 4 out of 1-5 scale)
   ```

2. **Client-Side Encryption**
   ```javascript
   // Initialize FHE Relayer
   relayerInstance.createEncryptedInput(contractAddress, userAddress)
   
   // Add numeric value
   inputBuilder.add32(value) // euint32
   
   // Encrypt
   encryptedInput = await inputBuilder.encrypt()
   ```

3. **Handle Conversion**
   ```javascript
   // Convert FHE handle to bytes32
   handle = encryptedInput.handles[0]
   bytes32Handle = convertToBytes32(handle) // 0x + 64 hex chars
   ```

4. **Blockchain Submission**
   ```solidity
   submitResponse(pollId, bytes32Handle, attestation)
   ```

5. **On-Chain Storage**
   ```
   EncryptedResponse {
       respondent: 0x...,
       encryptedValue: 0x1234...,  // FHE handle
       submittedAt: timestamp
   }
   ```

### Privacy Guarantees

- **On-Chain Privacy:** Response values never appear in plain text on blockchain
- **Verifiable:** Response submissions are verifiable without revealing values
- **Aggregatable:** Future FHE operations can compute statistics on encrypted data
- **Local Access:** Users see their own responses stored in browser localStorage

---

## Key Features

### Poll Creation

- Define custom numeric ranges (e.g., 1-5, 0-10, 1-100)
- Set poll expiration time
- Write custom questions
- Automatic poll activation

### Response Submission

- FHE encryption of all responses
- One response per participant enforced
- Client-side encryption before submission
- Local storage of user's own responses

### Poll Management

- View all active polls
- Track your created polls
- See polls you've responded to
- Close polls you created

### Privacy Features

- Responses encrypted before blockchain storage
- Individual values never revealed on-chain
- Poll creators see response count but not values
- Future: aggregate statistics computation on encrypted data

---

## Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18 with TypeScript
- Tailwind CSS for styling

**Blockchain:**
- Ethereum Sepolia Testnet
- Wagmi 2.0 for Ethereum interactions
- RainbowKit 2.0 for wallet connection
- Ethers.js 6.9 for contract interaction

**FHE:**
- Zama FHEVM Relayer SDK v0.3.0-6
- Client-side encryption using FHE

**Development:**
- Hardhat for contract compilation
- Solidity 0.8.20

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet
- Sepolia testnet ETH

### Installation

```bash
npm install --legacy-peer-deps
```

### Configuration

Create `.env.local`:

```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_POLL_CONTRACT_ADDRESS=0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
PRIVATE_KEY=your_private_key_for_deployment
```

### Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### Deploy Contract

```bash
npm run deploy:poll
```

The script will automatically update `.env.local` with the deployed contract address.

---

## Contract Details

### Main Functions

**Poll Creation:**
```solidity
function createPoll(
    string memory _question,
    uint256 _minValue,
    uint256 _maxValue,
    uint256 _endTime
) external returns (uint256)
```

**Response Submission:**
```solidity
function submitResponse(
    uint256 _pollId,
    bytes32 _encryptedValue,  // FHE handle
    bytes calldata _attestation
) external
```

**Poll Management:**
```solidity
function closePoll(uint256 _pollId) external
```

### Events

```solidity
event PollCreated(
    uint256 indexed pollId,
    address indexed creator,
    string question,
    uint256 minValue,
    uint256 maxValue,
    uint256 endTime
)

event ResponseSubmitted(
    uint256 indexed pollId,
    address indexed respondent,
    bytes32 encryptedValue
)

event PollClosed(
    uint256 indexed pollId,
    address indexed creator
)
```

---

## Project Structure

```
24-private-poll/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── providers.tsx       # Web3 providers
│   └── globals.css         # Global styles
├── components/
│   └── PrivatePoll.tsx     # Main component
├── contracts/
│   └── PrivatePoll.sol     # Smart contract
├── lib/
│   └── provider.ts         # Ethereum provider helpers
├── scripts/
│   └── deploy-poll.js      # Deployment script
└── package.json
```

---

## Usage Guide

### Creating a Poll

1. Connect your wallet
2. Navigate to "Create Poll" tab
3. Enter poll question
4. Set minimum and maximum values
5. Set expiration date and time
6. Click "Create Poll"
7. Poll is created on-chain and becomes active

### Responding to a Poll

1. Browse active polls
2. Select a poll to respond to
3. Choose your numeric response within the range
4. Click "Submit Response"
5. Response is encrypted and submitted to blockchain
6. Your response is saved locally for your reference

### Managing Polls

- View your created polls in "My Polls" tab
- View polls you've responded to in "My Responses" tab
- Close polls you created (cannot be reopened)
- See response counts for your polls

---

## Security Considerations

### Privacy Protection

- All responses encrypted using FHE before blockchain submission
- Individual response values never stored in plain text on-chain
- Users can only see their own responses (stored locally)
- Poll creators see response counts, not individual values

### On-Chain Security

- One response per participant enforced by smart contract
- Poll expiration enforced by timestamp validation
- Only poll creator can close polls
- All transactions require wallet signature

### Limitations

- Response values visible to poll creator in future FHE computation (not yet implemented)
- Respondent addresses are public on-chain
- Poll questions and metadata are public

---

## Development

### Compile Contract

```bash
npm run compile
```

### Test Locally

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## Resources

- **Zama Documentation:** https://docs.zama.ai/fhevm
- **Ethereum Sepolia Explorer:** https://sepolia.etherscan.io
- **Sepolia Faucet:** https://sepoliafaucet.com
- **Wagmi Documentation:** https://wagmi.sh

---

## License

MIT

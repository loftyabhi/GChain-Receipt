
import { ethers } from 'ethers';

const RPC_URL = 'https://mainnet.base.org';
const TX_HASH = '0x0833adaf46b6f6eb5084e7b2b3d6d0c10a1a7ff9a6416ee6fbe4298f60f253fe';

const ERC20_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

async function main() {
    console.log(`Checking tx: ${TX_HASH}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const tx = await provider.getTransaction(TX_HASH);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!tx || !receipt) {
        console.error("Tx not found");
        return;
    }

    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Logs: ${receipt.logs.length}`);

    const userAddress = tx.from.toLowerCase();
    const erc20Interface = new ethers.Interface(ERC20_ABI);
    const erc20TransferTopic = erc20Interface.getEvent('Transfer')?.topicHash;

    const erc20Logs = receipt.logs.filter(log => log.topics[0] === erc20TransferTopic && log.topics.length === 3);
    console.log(`ERC20 Logs: ${erc20Logs.length}`);

    for (const log of erc20Logs) {
        try {
            const parsed = erc20Interface.parseLog({
                topics: [...log.topics],
                data: log.data
            });
            if (!parsed) continue;

            const from = parsed.args[0].toLowerCase();
            const to = parsed.args[1].toLowerCase();
            const amount = parsed.args[2];

            console.log(`Transfer: ${from} -> ${to} Amount: ${amount}`);
            console.log(`  User Match? From: ${from === userAddress}, To: ${to === userAddress}`);

            if (from === userAddress || to === userAddress) {
                console.log("  MATCHED!");
            } else {
                console.log("  IGNORED");
            }
        } catch (e) {
            console.log('Failed to parse:', e);
        }
    }
}

main().catch(console.error);

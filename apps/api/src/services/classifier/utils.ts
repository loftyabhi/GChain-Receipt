import { ethers } from 'ethers';
import { Log, Address } from './core/types';

export const COMMON_ABIS = {
    ERC20: [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    ],
    ERC721: [
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
        'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
        'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
        'function safeTransferFrom(address from, address to, uint256 tokenId)',
        'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
    ],
    ERC1155: [
        'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
        'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
        'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
        'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)',
    ],
};

export class Decoder {
    private static erc20Interface = new ethers.Interface(COMMON_ABIS.ERC20);
    private static erc721Interface = new ethers.Interface(COMMON_ABIS.ERC721);
    private static erc1155Interface = new ethers.Interface(COMMON_ABIS.ERC1155);

    static decodeERC20Transfer(log: Log) {
        try {
            return this.erc20Interface.parseLog({
                topics: log.topics,
                data: log.data,
            });
        } catch {
            return null;
        }
    }

    static decodeERC721Transfer(log: Log) {
        try {
            return this.erc721Interface.parseLog({
                topics: log.topics,
                data: log.data,
            });
        } catch {
            return null;
        }
    }

    static decodeERC1155TransferSingle(log: Log) {
        try {
            return this.erc1155Interface.parseLog({
                topics: log.topics,
                data: log.data,
            });
        } catch {
            return null;
        }
    }

    static decodeERC1155TransferBatch(log: Log) {
        try {
            return this.erc1155Interface.parseLog({
                topics: log.topics,
                data: log.data,
            });
        } catch {
            return null;
        }
    }

    /**
     * Normalize Address to Checksum or Lowercase (Deterministic)
     */
    static normalizeAddress(address: string): Address {
        try {
            return ethers.getAddress(address);
        } catch {
            return address.toLowerCase(); // Fallback for non-checksum safe addresses
        }
    }

    /**
     * Safe Address Comparison
     */
    static sameAddress(a: Address, b: Address): boolean {
        if (!a || !b) return false;
        return a.toLowerCase() === b.toLowerCase();
    }

    static isZeroAddress(a: Address): boolean {
        if (!a) return true;
        return /^0x0+$/.test(a);
    }

    /**
     * Safe BigInt Parsing (No coercion)
     */
    static toBigInt(val: string | number | undefined): bigint {
        if (!val) return BigInt(0);
        try {
            return BigInt(val);
        } catch {
            return BigInt(0);
        }
    }
}

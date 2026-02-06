'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useRouter } from 'next/navigation';

export interface UserProfile {
    id: string;
    wallet: string;
    name?: string;
    email?: string;
}

interface AuthState {
    token: string | null;
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface ConsoleAuthContextType extends AuthState {
    login: () => Promise<void>;
    logout: () => void;
}

const ConsoleAuthContext = createContext<ConsoleAuthContextType | undefined>(undefined);

export function ConsoleAuthProvider({ children }: { children: React.ReactNode }) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const router = useRouter();

    const [state, setState] = useState<AuthState>({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: true
    });

    // Check local storage on mount
    useEffect(() => {
        const token = localStorage.getItem('txproof_console_token');
        const userStr = localStorage.getItem('txproof_console_user');

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                setState({
                    token,
                    user,
                    isAuthenticated: true,
                    isLoading: false
                });
            } catch (e) {
                // Invalid storage
                localStorage.removeItem('txproof_console_token');
                localStorage.removeItem('txproof_console_user');
                setState(s => ({ ...s, isLoading: false }));
            }
        } else {
            setState(s => ({ ...s, isLoading: false }));
        }
    }, []);

    // Monitor Wallet Changes logic moved to bottom


    const login = useCallback(async () => {
        if (!address) throw new Error('Wallet not connected');

        try {
            setState(s => ({ ...s, isLoading: true }));

            // 1. Get Nonce
            const nonceRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/auth/nonce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address })
            });

            if (!nonceRes.ok) throw new Error('Failed to generate nonce');
            const { nonce } = await nonceRes.json();

            // 2. Sign Message
            const signature = await signMessageAsync({ message: nonce });

            // 3. Login
            const loginRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    signature,
                    nonce
                })
            });

            if (!loginRes.ok) throw new Error('Login failed');
            const data = await loginRes.json(); // { token, user }

            // 4. Store & Set State
            localStorage.setItem('txproof_console_token', data.token);
            localStorage.setItem('txproof_console_user', JSON.stringify(data.user));

            setState({
                token: data.token,
                user: data.user,
                isAuthenticated: true,
                isLoading: false
            });

            router.refresh();

        } catch (error) {
            console.error('Login Error:', error);
            setState(s => ({ ...s, isLoading: false }));
            throw error;
        }
    }, [address, signMessageAsync, router]);

    const logout = useCallback(() => {
        localStorage.removeItem('txproof_console_token');
        localStorage.removeItem('txproof_console_user');
        setState({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false
        });
        router.push('/developers');
    }, [router]);

    // Monitor Wallet Changes
    useEffect(() => {
        if (state.isAuthenticated && state.user && address) {
            // If connected wallet is different from session wallet, logout
            if (address.toLowerCase() !== state.user.wallet.toLowerCase()) {
                logout();
            }
        } else if (state.isAuthenticated && !address) {
            // Optional: If wallet disconnects completely, do we logout? 
            // Ideally yes, for security, or at least lock the session.
            // For now, let's strictly enforce: No Wallet = No Session
            logout();
        }
    }, [address, state.isAuthenticated, state.user, logout]);

    return (
        <ConsoleAuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </ConsoleAuthContext.Provider>
    );
}

export function useConsoleAuth() {
    const context = useContext(ConsoleAuthContext);
    if (context === undefined) {
        throw new Error('useConsoleAuth must be used within a ConsoleAuthProvider');
    }
    return context;
}

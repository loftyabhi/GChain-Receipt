'use client';

import { Navbar } from '@/components/Navbar';
import { ArrowRight, Search, Sparkles, FileText } from 'lucide-react';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import AdBanner from '../components/AdBanner';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [billData, setBillData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');

  const [chainId, setChainId] = useState(8453);

  const generateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHash) return;

    setLoading(true);
    setError('');
    setBillData(null);
    setPdfUrl('');

    try {
      // 1. Initiate Job
      const response = await fetch('http://localhost:3002/api/v1/bills/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          chainId,
          connectedWallet: address // Pass connected wallet to determine IN/OUT direction
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start generation');
      }

      const jobId = data.jobId;
      // console.log(`Job Started: ${jobId}, polling...`);

      // 2. Poll for Completion
      const pollInterval = setInterval(async () => {
        try {
          const jobRes = await fetch(`http://localhost:3002/api/v1/bills/job/${jobId}`);
          const jobData = await jobRes.json();

          // console.log('Poll Status:', jobData.state);

          if (jobData.state === 'completed') {
            clearInterval(pollInterval);
            setBillData(jobData.data);
            setPdfUrl(`http://localhost:3002${jobData.pdfUrl}`);
            setLoading(false);
          } else if (jobData.state === 'failed') {
            clearInterval(pollInterval);
            setError(jobData.error || 'Job Failed');
            setLoading(false);
          }
          // else: active/waiting, keep polling
        } catch (pollErr) {
          clearInterval(pollInterval);
          setError('Polling failed');
          setLoading(false);
        }
      }, 2000); // Check every 2s

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        {/* Geometric Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen filter" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen filter" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-purple-300 text-xs font-bold tracking-wide uppercase mb-6 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Live on Multiple Chains
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-[1.1] mb-6 tracking-tight"
          >
            Blockchain Receipts <br /> Made Beautiful.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12 max-w-2xl mx-auto text-lg text-slate-400"
          >
            Turn transaction hashes into professional, audit-ready PDF receipts in seconds. Perfect for accounting, tax compliance, and business records.
          </motion.p>

          {/* Input Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-xl mx-auto"
          >
            <form onSubmit={generateBill} className="group relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-purple-900/10 backdrop-blur-xl transition-all focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:border-purple-500/50">

              {/* Chain Selector */}
              <div className="pl-4 pr-2 border-r border-white/10">
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  className="bg-transparent text-white outline-none border-none font-medium cursor-pointer appearance-none text-sm uppercase tracking-wide [&>option]:text-black"
                >
                  <option value={8453}>Base</option>
                  <option value={1}>Ethereum</option>
                  <option value={137}>Polygon</option>
                  <option value={42161}>Arbitrum</option>
                  <option value={10}>Optimism</option>
                  <option value={56}>BSC</option>
                  <option value={43114}>Avax</option>
                  <option value={11155111}>Sepolia</option>
                </select>
              </div>

              <div className="pl-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Transaction Hash (0x...)"
                className="flex-1 bg-transparent px-2 py-4 text-lg outline-none placeholder:text-slate-500 text-white"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition-all active:scale-95 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
              >
                {loading ? 'Processing...' : 'Generate'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
            <div className="mt-4 flex justify-center gap-4 text-sm text-slate-500">
              <span className="cursor-pointer hover:text-purple-400 transition-colors" onClick={() => setTxHash('0x76001a88ee97e50fccfe43730b3f3aec7eea5598a5d16446aa4163435c1cef4f')}>Try: 0x7600...1cef4f</span>
              <span>•</span>
              <span>Supports: ETH, Base, Polygon</span>
            </div>
          </motion.div>

          {/* Results Section */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 max-w-xl mx-auto backdrop-blur-sm"
            >
              Error: {error}
            </motion.div>
          )}

          {billData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-16 w-full max-w-6xl mx-auto"
            >
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                {/* Left: Summary Card */}
                <div className="flex-1 w-full bg-[#131B2C] rounded-2xl shadow-2xl border border-white/5 p-8 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                  <div className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400 uppercase mb-6 tracking-wide border border-green-500/20">
                    Status: {billData.STATUS}
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-6 relative z-10">Receipt Ready</h3>

                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-slate-400 font-medium">Type</span>
                      <span className="text-slate-200 font-mono font-bold bg-white/5 px-2 py-1 rounded border border-white/5">{billData.TYPE}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-slate-400 font-medium">Network Fee</span>
                      <span className="text-slate-200 font-mono font-bold">${billData.TOTAL_FEE_USD}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-slate-400 font-medium">Date</span>
                      <span className="text-slate-200 font-medium text-right">{billData.TIMESTAMP}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="text-slate-400 font-medium">Chain</span>
                      <span className="flex items-center gap-2 font-bold text-slate-200">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        {billData.CHAIN_NAME}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                    <a
                      href={pdfUrl}
                      target="_blank"
                      className="w-full flex justify-center items-center gap-2 rounded-xl bg-purple-600 px-6 py-4 font-bold text-white transition-all hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-600/20 active:translate-y-0.5"
                    >
                      <FileText size={20} />
                      Download PDF Receipt
                    </a>
                  </div>
                </div>

                {/* Right: PDF Preview */}
                <div className="w-full lg:w-1/2 aspect-[210/297] bg-[#e2e8f0] rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden group">
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-100">
                    <div className="text-center">
                      <FileText size={64} className="mx-auto mb-4 opacity-50" />
                      <span className="font-medium">Loading Preview...</span>
                    </div>
                  </div>
                  <iframe src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="relative z-10 w-full h-full" />
                </div>
              </div>
            </motion.div>
          )}

          <div className="mt-20 mb-10">
            <AdBanner />
          </div>

        </div>



      </main >
    </div >
  );
}

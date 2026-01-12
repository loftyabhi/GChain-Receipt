
import { Navbar } from '@/components/Navbar';
import { BillGenerator } from '@/components/home/BillGenerator';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      <Navbar />

      <main id="main-content" className="relative pt-32 pb-20 px-6">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] opacity-50" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] opacity-50" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Static Hero Branding - No Fade In for LCP */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-violet-300 text-xs font-bold tracking-wide uppercase mb-8 shadow-sm backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            Live on Multiple Chains
          </div>

          <h1
            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-tight mb-8 pb-2 tracking-tight"
          >
            Professional Blockchain <br /> Intelligence.
          </h1>

          <p
            className="mb-12 max-w-2xl mx-auto text-lg text-zinc-300"
          >
            Transform on-chain data into audit-grade documentation. Zero data retention, global compliance standards.
          </p>

          {/* Interactive Bill Generator (Client Component) */}
          <BillGenerator />

        </div>
      </main >
    </div >
  );
}

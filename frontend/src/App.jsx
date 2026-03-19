import React from 'react';
import { Linkedin } from 'lucide-react';
import CapitalCityCareers from './components/CapitalCityCareers';
import BusinessSignals from './components/BusinessSignals';
import NeighborhoodEconomyMap from './components/NeighborhoodEconomyMap';
import MontgomeryPulse from './components/MontgomeryPulse';
import ChatbotOverlay from './components/ChatbotOverlay';

function App() {
  return (
    <div className="min-h-screen bg-mgm-navy text-gray-100 p-6 relative font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-mgm-gold">
          MGM Assist
        </h1>
        <p className="text-gray-400 mt-2">Montgomery's Smart Civic Intelligence Platform</p>
      </header>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
        <CapitalCityCareers />
        <BusinessSignals />
        <NeighborhoodEconomyMap />
        <MontgomeryPulse />
      </div>

      <footer className="mb-20 lg:mb-8">
        <div className="bg-mgm-card border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300 font-semibold">Contact</p>
            <p className="text-xs text-gray-500">Connect with the project creator</p>
          </div>
          <a
            href="https://linkedin.com/in/francis-natus-mugisha-66415529a"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn profile"
            className="inline-flex items-center gap-2 rounded-lg border border-mgm-blue/40 bg-mgm-blue/10 px-3 py-2 text-sm text-mgm-cyan hover:bg-mgm-blue/20 hover:border-mgm-cyan transition-colors"
          >
            <Linkedin className="w-4 h-4" />
            LinkedIn
          </a>
        </div>
      </footer>

      <ChatbotOverlay />
    </div>
  );
}

export default App;

import React from 'react';
import CapitalCityCareers from './components/CapitalCityCareers';
import BusinessSignals from './components/BusinessSignals';
import NeighborhoodEconomyMap from './components/NeighborhoodEconomyMap';
import OpportunityFinder from './components/OpportunityFinder';
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
        <OpportunityFinder />
      </div>

      <ChatbotOverlay />
    </div>
  );
}

export default App;

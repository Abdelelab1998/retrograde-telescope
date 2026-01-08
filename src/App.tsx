import { useState, useMemo, useRef, useEffect } from 'react';
import { Map, MapControls, MapMarker, MarkerContent, MapRef } from '@/components/ui/map';
import { useFlights, Flight } from '@/hooks/useFlights';
import { useAirports, Airport } from '@/hooks/useAirports';
import { useWeather } from '@/hooks/useWeather';
import { SessionTimeout } from '@/components/SessionTimeout';
import { Search, Plane, X, MapPin, Gauge, Navigation, Wind, TrendingUp, TrendingDown, Radio, ArrowRight, Cloud, Droplets, Eye, Compass, Database, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from 'next-themes';

export default function App() {
  const [useDummyData, setUseDummyData] = useState(false);
  const { theme, setTheme } = useTheme();
  const currentTheme = (theme as 'light' | 'dark') || 'dark';
  const { flights, error } = useFlights(useDummyData);
  const { airports } = useAirports();
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const mapRef = useRef<MapRef>(null);

  const toggleTheme = () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  const selectedFlight = useMemo(() =>
    flights.find((f: Flight) => f.icao24 === selectedFlightId),
    [flights, selectedFlightId]
  );

  // Get origin and destination airport coordinates
  const originAirport = useMemo(() => {
    if (!selectedFlight?.origin) return null;
    return airports.find((a: Airport) =>
      a.iata === selectedFlight.origin || a.icao === selectedFlight.origin
    );
  }, [selectedFlight, airports]);

  const destinationAirport = useMemo(() => {
    if (!selectedFlight?.destination) return null;
    return airports.find((a: Airport) =>
      a.iata === selectedFlight.destination || a.icao === selectedFlight.destination
    );
  }, [selectedFlight, airports]);

  // Fetch weather for origin and destination airports
  const originLat = originAirport?.latitude ?? null;
  const originLng = originAirport?.longitude ?? null;
  const { weather: originWeather } = useWeather(originLat, originLng);

  const destLat = destinationAirport?.latitude ?? null;
  const destLng = destinationAirport?.longitude ?? null;
  const { weather: destinationWeather } = useWeather(destLat, destLng);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-open mobile panel when flight selected
  useEffect(() => {
    if (selectedFlight && isMobile) {
      setIsMobilePanelOpen(true);
    }
  }, [selectedFlight, isMobile]);

  // Enhanced search with better matching
  const searchResults = useMemo(() => {
    if (searchQuery.length < 1) return { flights: [], airports: [] };
    const q = searchQuery.toLowerCase().trim();

    // Search flights with priority scoring
    const matchedFlights = flights
      .map((f: Flight) => {
        let score = 0;
        const callsign = f.callsign.toLowerCase();
        const icao = f.icao24.toLowerCase();
        const airline = f.airline?.toLowerCase() || '';
        const country = f.origin_country.toLowerCase();
        const origin = f.origin?.toLowerCase() || '';
        const dest = f.destination?.toLowerCase() || '';

        // Exact matches get highest priority
        if (callsign === q) score += 100;
        if (icao === q) score += 100;
        if (origin === q || dest === q) score += 90;

        // Starts with gets high priority
        if (callsign.startsWith(q)) score += 50;
        if (icao.startsWith(q)) score += 50;
        if (airline.startsWith(q)) score += 40;

        // Contains gets medium priority
        if (callsign.includes(q)) score += 20;
        if (airline.includes(q)) score += 15;
        if (country.includes(q)) score += 10;
        if (origin.includes(q) || dest.includes(q)) score += 25;

        return { flight: f, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.flight);

    // Search airports with priority scoring
    const matchedAirports = airports
      .map((a: Airport) => {
        let score = 0;
        const iata = a.iata?.toLowerCase() || '';
        const icao = a.icao?.toLowerCase() || '';
        const name = a.name?.toLowerCase() || '';
        const city = a.city?.toLowerCase() || '';
        const country = a.country?.toLowerCase() || '';

        // Exact IATA/ICAO match gets highest priority
        if (iata === q || icao === q) score += 100;

        // Starts with for codes
        if (iata.startsWith(q)) score += 80;
        if (icao.startsWith(q)) score += 80;

        // Name/city matches
        if (name.startsWith(q)) score += 60;
        if (city.startsWith(q)) score += 50;

        // Contains
        if (name.includes(q)) score += 30;
        if (city.includes(q)) score += 25;
        if (country.includes(q)) score += 15;

        return { airport: a, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.airport);

    return { flights: matchedFlights, airports: matchedAirports };
  }, [flights, airports, searchQuery]);

  const handleAirportClick = (airport: Airport) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [airport.longitude, airport.latitude],
        zoom: 12,
        duration: 2500,
        pitch: 45
      });
      setSearchQuery('');
    }
  };

  const handleFlightClick = (flight: Flight) => {
    setSelectedFlightId(flight.icao24);
    setSearchQuery('');
  };

  const handleCenterOnFlight = () => {
    if (mapRef.current && selectedFlight) {
      const lng = selectedFlight.interpolatedLng ?? selectedFlight.longitude;
      const lat = selectedFlight.interpolatedLat ?? selectedFlight.latitude;

      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 10,
        pitch: 60,
        bearing: selectedFlight.heading - 90,
        duration: 2500
      });
    }
  };

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden antialiased ${currentTheme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-gray-100 text-gray-900'}`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Search HUD - Responsive */}
      <div className={`absolute ${isMobile ? 'top-4 left-4 right-4' : 'top-6 left-6'} z-20 flex flex-col gap-3 ${isMobile ? 'w-auto' : 'max-w-md w-full'} pointer-events-none`}>
        <div className={`rounded-lg p-1 flex flex-col shadow-xl border pointer-events-auto overflow-hidden backdrop-blur-xl ${currentTheme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Search className={`w-4 h-4 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search flights or airports..."
              className={`bg-transparent border-none outline-none text-sm w-full font-medium ${currentTheme === 'dark' ? 'placeholder:text-white/30 text-white' : 'placeholder:text-gray-400 text-gray-900'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '16px' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`p-1 rounded transition-colors ${currentTheme === 'dark' ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results */}
          {(searchResults.flights.length > 0 || searchResults.airports.length > 0) && (
            <div className={`border-t max-h-[60vh] overflow-y-auto ${currentTheme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="p-1.5 space-y-2">
                {/* Flights */}
                {searchResults.flights.length > 0 && (
                  <div>
                    <div className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Flights</div>
                    <div className="space-y-0.5">
                      {searchResults.flights.map((flight) => (
                        <button
                          key={flight.icao24}
                          onClick={() => handleFlightClick(flight)}
                          className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded transition-colors ${currentTheme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded flex items-center justify-center border ${currentTheme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'}`}>
                              <Plane className={`w-3.5 h-3.5 ${currentTheme === 'dark' ? 'text-white' : 'text-gray-700'}`} />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{flight.callsign}</div>
                              <div className={`text-[10px] ${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{flight.airline}</div>
                            </div>
                          </div>
                          <div className={`text-[10px] font-mono ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{flight.origin} → {flight.destination}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Airports */}
                {searchResults.airports.length > 0 && (
                  <div>
                    <div className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Airports</div>
                    <div className="space-y-0.5">
                      {searchResults.airports.map((airport) => (
                        <button
                          key={airport.icao}
                          onClick={() => handleAirportClick(airport)}
                          className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded transition-colors ${currentTheme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded flex items-center justify-center border ${currentTheme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'}`}>
                              <MapPin className={`w-3.5 h-3.5 ${currentTheme === 'dark' ? 'text-white' : 'text-gray-700'}`} />
                            </div>
                            <div className="text-left">
                              <div className={`text-xs font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{airport.name}</div>
                              <div className={`text-[10px] ${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{airport.city}, {airport.country}</div>
                            </div>
                          </div>
                          <div className={`text-[11px] font-bold ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{airport.iata || airport.icao}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {!isMobile && (
          <div className="flex items-center gap-2 px-0.5">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border shadow-lg backdrop-blur-xl ${currentTheme === 'dark' ? 'border-white/10 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentTheme === 'dark' ? 'bg-white' : 'bg-gray-900'}`}></div>
              <span className={`font-mono ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{flights.length}</span>
              <span className={`${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>Flights</span>
            </div>
            {error && (
              <div className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border backdrop-blur-xl ${currentTheme === 'dark' ? 'border-white/20 text-white/60 bg-[#1a1a1a]' : 'border-gray-200 text-gray-600 bg-white'}`}>
                <Radio className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toggle Controls - Top Right Desktop, Bottom Left Mobile */}
      <div className={`absolute ${isMobile ? 'bottom-4 left-4' : 'top-6 right-6'} z-20 pointer-events-none`}>
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors border shadow-xl backdrop-blur-xl ${currentTheme === 'dark' ? 'bg-[#1a1a1a] hover:bg-[#252525] border-white/10' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
            <span className={`text-xs font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {currentTheme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* Data Mode Toggle */}
          <button
            onClick={() => setUseDummyData(!useDummyData)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors border shadow-xl backdrop-blur-xl ${currentTheme === 'dark' ? 'bg-[#1a1a1a] hover:bg-[#252525] border-white/10' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
          >
            <Database className={`w-4 h-4 ${useDummyData ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className={`text-xs font-semibold ${useDummyData ? 'text-amber-400' : 'text-emerald-400'}`}>
              {useDummyData ? 'Dummy' : 'Real'}
            </span>
            <div className={`w-10 h-5 rounded-full transition-colors ${useDummyData ? 'bg-amber-500/30' : 'bg-emerald-500/30'}`}>
              <div className={`w-4 h-4 rounded-full shadow-lg transition-transform ${useDummyData ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5 ${currentTheme === 'dark' ? 'bg-white' : 'bg-gray-900'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Main Map */}
      <Map
        ref={mapRef}
        center={[0, 25]}
        zoom={2.8}
        className="w-full h-full"
      >
        <MapControls position="bottom-right" showCompass showLocate showFullscreen />

        {/* Aircraft Markers - No Paths */}
        {flights.map((flight: Flight) => {
          const displayLng = flight.interpolatedLng ?? flight.longitude;
          const displayLat = flight.interpolatedLat ?? flight.latitude;

          return (
            <MapMarker
              key={flight.icao24}
              longitude={displayLng}
              latitude={displayLat}
              rotation={flight.heading}
              onClick={() => {
                setSelectedFlightId(flight.icao24);
                if (isMobile) setIsMobilePanelOpen(true);
              }}
            >
              <MarkerContent>
                <div
                  className={`transition-all duration-200 cursor-pointer ${
                    selectedFlightId === flight.icao24
                      ? currentTheme === 'dark' ? 'text-white scale-125' : 'text-gray-900 scale-125'
                      : currentTheme === 'dark' ? 'text-white/60 hover:text-white hover:scale-110' : 'text-gray-700 hover:text-gray-900 hover:scale-110'
                    }`}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current drop-shadow-lg">
                    <path d="M21,16 L21,14 L13,9 L13,3.5 C13,2.67 12.33,2 11.5,2 C10.67,2 10,2.67 10,3.5 L10,9 L2,14 L2,16 L10,13.5 L10,19 L8,20.5 L8,22 L11.5,21 L15,22 L15,20.5 L13,19 L13,13.5 L21,16 Z" />
                  </svg>
                </div>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>

      {/* Flight Info Panel - Desktop */}
      {selectedFlight && !isMobile && (
        <FlightPanel
          flight={selectedFlight}
          originAirport={originAirport}
          destinationAirport={destinationAirport}
          originWeather={originWeather}
          destinationWeather={destinationWeather}
          onClose={() => setSelectedFlightId(null)}
          onCenter={handleCenterOnFlight}
          theme={currentTheme}
        />
      )}

      {/* Mobile Bottom Sheet */}
      {selectedFlight && isMobile && isMobilePanelOpen && (
        <div className={`absolute bottom-0 left-0 right-0 z-30 max-h-[70vh] flex flex-col rounded-t-2xl shadow-2xl border-t backdrop-blur-xl ${currentTheme === 'dark' ? 'border-white/10 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
          <div className={`flex items-center justify-between p-4 border-b ${currentTheme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedFlight.callsign}</h3>
            <button
              onClick={() => {
                setIsMobilePanelOpen(false);
                setSelectedFlightId(null);
              }}
              className={`p-2 rounded transition-colors ${currentTheme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            <FlightPanelContent
              flight={selectedFlight}
              originAirport={originAirport}
              destinationAirport={destinationAirport}
              originWeather={originWeather}
              destinationWeather={destinationWeather}
              onCenter={handleCenterOnFlight}
              theme={currentTheme}
            />
          </div>
        </div>
      )}

      {/* Session Timeout Widget */}
      <SessionTimeout />
    </div>
  );
}

// Desktop Panel Component
function FlightPanel({ flight, originAirport, destinationAirport, originWeather, destinationWeather, onClose, onCenter, theme }: any) {
  return (
    <div className={`absolute top-6 right-6 bottom-6 w-[400px] z-30 flex flex-col rounded-lg shadow-2xl border overflow-hidden backdrop-blur-xl ${currentTheme === 'dark' ? 'border-white/10 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
      <div className="absolute top-5 right-5 z-40">
        <button onClick={onClose} className={`p-2 rounded transition-colors ${currentTheme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6 pb-5 flex flex-col h-full overflow-y-auto">
        <FlightPanelContent
          flight={flight}
          originAirport={originAirport}
          destinationAirport={destinationAirport}
          originWeather={originWeather}
          destinationWeather={destinationWeather}
          onCenter={onCenter}
          theme={currentTheme}
        />
      </div>
    </div>
  );
}

// Shared Panel Content
function FlightPanelContent({ flight, originAirport, destinationAirport, originWeather, destinationWeather, onCenter, theme }: any) {
  return (
    <>
      <div className="mb-6">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-semibold mb-3 ${currentTheme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-100 border-gray-300 text-gray-700'}`}>
          Live Data
        </div>

        <h2 className={`text-5xl font-bold mb-5 ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {flight.callsign}
        </h2>

        <div className={`flex items-center gap-3 p-3 rounded-lg border ${currentTheme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`w-11 h-11 rounded flex items-center justify-center ${currentTheme === 'dark' ? 'bg-white/20' : 'bg-gray-200'}`}>
            <Plane className={`w-5 h-5 ${currentTheme === 'dark' ? 'text-white' : 'text-gray-700'}`} />
          </div>
          <div className="flex-1">
            <div className={`text-sm font-semibold mb-0.5 ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{flight.airline}</div>
            <div className={`text-xs ${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{flight.aircraft}</div>
          </div>
        </div>
      </div>

      {/* Weather Information for Origin and Destination - Only show if airports are known */}
      {(flight.origin !== 'N/A' || flight.destination !== 'N/A') && (
        <div className="mb-6 space-y-3">
          <div className={`text-[10px] font-semibold uppercase tracking-wide px-0.5 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Airport Weather</div>

          {/* Origin Weather */}
          {flight.origin !== 'N/A' && (
            <div>
              <div className={`text-[9px] font-medium mb-1.5 px-0.5 uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                Takeoff - {flight.origin} {originAirport && `(${originAirport.city})`}
              </div>
              {originWeather ? (
                <div className={`p-3 rounded-lg border ${currentTheme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cloud className={`w-6 h-6 ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`} />
                      <div>
                        <div className={`text-xl font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{Math.round(originWeather.temp)}°C</div>
                        <div className={`text-[10px] capitalize ${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{originWeather.weather_description}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Feels {Math.round(originWeather.feels_like)}°C</div>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 mt-2 pt-2 border-t ${currentTheme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <WeatherItem icon={Wind} label="Wind" value={`${Math.round(originWeather.wind_speed * 3.6)} km/h`} theme={currentTheme} />
                    <WeatherItem icon={Droplets} label="Humidity" value={`${originWeather.humidity}%`} theme={currentTheme} />
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-lg border flex items-center justify-center text-xs ${currentTheme === 'dark' ? 'bg-white/5 border-white/10 text-white/40' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <Cloud className="w-4 h-4 mr-2 animate-pulse" />
                  Loading...
                </div>
              )}
            </div>
          )}

          {/* Destination Weather */}
          {flight.destination !== 'N/A' && (
            <div>
              <div className={`text-[9px] font-medium mb-1.5 px-0.5 uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                Arrival - {flight.destination} {destinationAirport && `(${destinationAirport.city})`}
              </div>
              {destinationWeather ? (
                <div className={`p-3 rounded-lg border ${currentTheme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cloud className={`w-6 h-6 ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`} />
                      <div>
                        <div className={`text-xl font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{Math.round(destinationWeather.temp)}°C</div>
                        <div className={`text-[10px] capitalize ${currentTheme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{destinationWeather.weather_description}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Feels {Math.round(destinationWeather.feels_like)}°C</div>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 mt-2 pt-2 border-t ${currentTheme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <WeatherItem icon={Wind} label="Wind" value={`${Math.round(destinationWeather.wind_speed * 3.6)} km/h`} theme={currentTheme} />
                    <WeatherItem icon={Droplets} label="Humidity" value={`${destinationWeather.humidity}%`} theme={currentTheme} />
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-lg border flex items-center justify-center text-xs ${currentTheme === 'dark' ? 'bg-white/5 border-white/10 text-white/40' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <Cloud className="w-4 h-4 mr-2 animate-pulse" />
                  Loading...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Route */}
      <div className="mb-6">
        <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 px-0.5 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Flight Path</div>
        <div className={`p-5 rounded-lg border ${currentTheme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          {flight.origin !== 'N/A' || flight.destination !== 'N/A' ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 text-center">
                  <div className={`text-[10px] font-medium mb-2 uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Origin</div>
                  <div className={`text-3xl font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{flight.origin}</div>
                  {originAirport && <div className={`text-[9px] mt-1 ${currentTheme === 'dark' ? 'text-white/30' : 'text-gray-500'}`}>{originAirport.city}</div>}
                </div>

                <div className="flex items-center gap-2 px-3">
                  <div className={`w-12 h-px ${currentTheme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}></div>
                  <ArrowRight className={`w-4 h-4 ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`} />
                  <div className={`w-12 h-px ${currentTheme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}></div>
                </div>

                <div className="flex-1 text-center">
                  <div className={`text-[10px] font-medium mb-2 uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Destination</div>
                  <div className={`text-3xl font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{flight.destination}</div>
                  {destinationAirport && <div className={`text-[9px] mt-1 ${currentTheme === 'dark' ? 'text-white/30' : 'text-gray-500'}`}>{destinationAirport.city}</div>}
                </div>
              </div>

              <div className={`mt-4 pt-4 border-t flex items-center justify-center gap-2 text-xs ${currentTheme === 'dark' ? 'border-white/10 text-white/50' : 'border-gray-200 text-gray-600'}`}>
                <Plane className="w-3 h-3" />
                <span>Currently over {flight.origin_country}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <MapPin className={`w-8 h-8 mb-2 ${currentTheme === 'dark' ? 'text-white/20' : 'text-gray-300'}`} />
              <div className={`text-sm mb-1 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Route information unavailable</div>
              <div className={`text-[10px] ${currentTheme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>Currently over {flight.origin_country}</div>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <TelemetryCard icon={Gauge} label="Altitude" value={Math.round(flight.altitude).toLocaleString()} unit="FT" theme={currentTheme} />
        <TelemetryCard icon={Wind} label="Speed" value={Math.round(flight.velocity).toLocaleString()} unit="KTS" theme={currentTheme} />
        <TelemetryCard icon={flight.vertical_rate > 1 ? TrendingUp : TrendingDown} label="V/S" value={Math.abs(Math.round(flight.vertical_rate)).toLocaleString()} unit="FPM" theme={currentTheme} />
        <TelemetryCard icon={Navigation} label="Heading" value={Math.round(flight.heading).toString().padStart(3, '0')} unit="°" theme={currentTheme} />
      </div>

      {/* System Data */}
      <div className="space-y-0.5 mb-6">
        <div className={`text-[10px] font-semibold uppercase tracking-wide px-0.5 mb-1.5 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Technical Data</div>
        <InfoRow label="ICAO24" value={flight.icao24.toUpperCase()} theme={currentTheme} />
        <InfoRow label="Country" value={flight.origin_country} theme={currentTheme} />
        <InfoRow label="Updated" value={format(new Date(), 'HH:mm:ss')} theme={currentTheme} />
      </div>

      {/* Action Button */}
      <button
        onClick={onCenter}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${currentTheme === 'dark' ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
      >
        Center on Flight
      </button>
    </>
  );
}

function WeatherItem({ icon: Icon, label, value, theme }: any) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`} />
      <div className="flex-1">
        <div className={`text-[9px] ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{label}</div>
        <div className={`text-xs font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</div>
      </div>
    </div>
  );
}

function TelemetryCard({ icon: Icon, label, value, unit, theme }: any) {
  return (
    <div className={`p-4 rounded-lg border transition-colors ${currentTheme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/[0.07]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
      <div className="flex items-center justify-between mb-2.5">
        <Icon className={`w-3.5 h-3.5 ${currentTheme === 'dark' ? 'text-white/60' : 'text-gray-600'}`} />
        <div className={`text-[9px] font-semibold uppercase tracking-wide ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{label}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
        <span className={`text-[10px] font-semibold ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{unit}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: 'light' | 'dark' }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded transition-colors border-b last:border-0 ${currentTheme === 'dark' ? 'hover:bg-white/5 border-white/5' : 'hover:bg-gray-50 border-gray-100'}`}>
      <span className={`text-[11px] font-medium ${currentTheme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-xs font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
    </div>
  );
}

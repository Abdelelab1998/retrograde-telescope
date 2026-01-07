import { useState, useMemo, useRef, useEffect } from 'react';
import { Map, MapControls, MapMarker, MarkerContent, MapRef } from '@/components/ui/map';
import { useFlights, Flight } from '@/hooks/useFlights';
import { useAirports, Airport } from '@/hooks/useAirports';
import { useWeather } from '@/hooks/useWeather';
import { Search, Plane, X, MapPin, Gauge, Navigation, Wind, TrendingUp, TrendingDown, Radio, ArrowRight, Cloud, Droplets, Eye, Compass } from 'lucide-react';
import { format } from 'date-fns';

export default function App() {
  const { flights, error } = useFlights();
  const { airports } = useAirports();
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const mapRef = useRef<MapRef>(null);

  const selectedFlight = useMemo(() =>
    flights.find((f: Flight) => f.icao24 === selectedFlightId),
    [flights, selectedFlightId]
  );

  // Fetch weather for selected flight's current position
  const flightLat = selectedFlight?.interpolatedLat ?? selectedFlight?.latitude ?? null;
  const flightLng = selectedFlight?.interpolatedLng ?? selectedFlight?.longitude ?? null;
  const { weather } = useWeather(flightLat, flightLng);

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

  // Search both flights and airports
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return { flights: [], airports: [] };
    const q = searchQuery.toLowerCase();

    const matchedFlights = flights.filter((f: Flight) =>
      f.callsign.toLowerCase().includes(q) ||
      f.icao24.toLowerCase().includes(q) ||
      f.airline?.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedAirports = airports.filter((a: Airport) =>
      a.iata?.toLowerCase().startsWith(q) ||
      a.icao?.toLowerCase().startsWith(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q)
    ).slice(0, 3);

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
    <div className="relative w-full h-full bg-[#0a0a0a] overflow-hidden antialiased text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Search HUD - Responsive */}
      <div className={`absolute ${isMobile ? 'top-4 left-4 right-4' : 'top-6 left-6'} z-20 flex flex-col gap-3 ${isMobile ? 'w-auto' : 'max-w-md w-full'} pointer-events-none`}>
        <div className="rounded-lg p-1 flex flex-col shadow-xl border border-white/10 pointer-events-auto overflow-hidden bg-[#1a1a1a] backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search flights or airports..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30 font-medium text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results */}
          {(searchResults.flights.length > 0 || searchResults.airports.length > 0) && (
            <div className="bg-white/5 border-t border-white/10 max-h-[60vh] overflow-y-auto">
              <div className="p-1.5 space-y-2">
                {/* Flights */}
                {searchResults.flights.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">Flights</div>
                    <div className="space-y-0.5">
                      {searchResults.flights.map((flight) => (
                        <button
                          key={flight.icao24}
                          onClick={() => handleFlightClick(flight)}
                          className="w-full flex items-center justify-between px-2.5 py-2.5 rounded hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center border border-white/20">
                              <Plane className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-white">{flight.callsign}</div>
                              <div className="text-[10px] text-white/50">{flight.airline}</div>
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-white/60">{flight.origin} → {flight.destination}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Airports */}
                {searchResults.airports.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">Airports</div>
                    <div className="space-y-0.5">
                      {searchResults.airports.map((airport) => (
                        <button
                          key={airport.icao}
                          onClick={() => handleAirportClick(airport)}
                          className="w-full flex items-center justify-between px-2.5 py-2.5 rounded hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center border border-white/20">
                              <MapPin className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-white">{airport.name}</div>
                              <div className="text-[10px] text-white/50">{airport.city}, {airport.country}</div>
                            </div>
                          </div>
                          <div className="text-[11px] font-bold text-white/60">{airport.iata || airport.icao}</div>
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
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border border-white/10 shadow-lg backdrop-blur-xl bg-[#1a1a1a]">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
              <span className="text-white font-mono">{flights.length}</span>
              <span className="text-white/50">Flights</span>
            </div>
            {error && (
              <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-white/20 text-white/60 backdrop-blur-xl bg-[#1a1a1a]">
                <Radio className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        )}
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
                  className={`transition-all duration-200 cursor-pointer ${selectedFlightId === flight.icao24
                    ? 'text-white scale-125'
                    : 'text-white/60 hover:text-white hover:scale-110'
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
          weather={weather}
          onClose={() => setSelectedFlightId(null)}
          onCenter={handleCenterOnFlight}
        />
      )}

      {/* Mobile Bottom Sheet */}
      {selectedFlight && isMobile && isMobilePanelOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[70vh] flex flex-col rounded-t-2xl shadow-2xl border-t border-white/10 bg-[#1a1a1a] backdrop-blur-xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-lg font-bold">{selectedFlight.callsign}</h3>
            <button
              onClick={() => setIsMobilePanelOpen(false)}
              className="p-2 rounded bg-white/10 hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            <FlightPanelContent
              flight={selectedFlight}
              originAirport={originAirport}
              destinationAirport={destinationAirport}
              weather={weather}
              onCenter={handleCenterOnFlight}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Desktop Panel Component
function FlightPanel({ flight, originAirport, destinationAirport, weather, onClose, onCenter }: any) {
  return (
    <div className="absolute top-6 right-6 bottom-6 w-[400px] z-30 flex flex-col rounded-lg shadow-2xl border border-white/10 overflow-hidden bg-[#1a1a1a] backdrop-blur-xl">
      <div className="absolute top-5 right-5 z-40">
        <button onClick={onClose} className="p-2 rounded bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
      <div className="p-6 pb-5 flex flex-col h-full overflow-y-auto">
        <FlightPanelContent
          flight={flight}
          originAirport={originAirport}
          destinationAirport={destinationAirport}
          weather={weather}
          onCenter={onCenter}
        />
      </div>
    </div>
  );
}

// Shared Panel Content
function FlightPanelContent({ flight, originAirport, destinationAirport, weather, onCenter }: any) {
  return (
    <>
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 border border-white/20 text-[10px] font-semibold text-white mb-3">
          Live Data
        </div>

        <h2 className="text-5xl font-bold mb-5 text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {flight.callsign}
        </h2>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="w-11 h-11 rounded bg-white/20 flex items-center justify-center">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white mb-0.5">{flight.airline}</div>
            <div className="text-xs text-white/50">{flight.aircraft}</div>
          </div>
        </div>
      </div>

      {/* Weather Information */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2 px-0.5">Current Weather</div>
        {weather ? (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Cloud className="w-8 h-8 text-white/60" />
                <div>
                  <div className="text-2xl font-bold text-white">{Math.round(weather.temp)}°C</div>
                  <div className="text-xs text-white/50 capitalize">{weather.weather_description}</div>
                </div>
              </div>
              <div className="text-xs text-white/40">Feels {Math.round(weather.feels_like)}°C</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
              <WeatherItem icon={Wind} label="Wind" value={`${Math.round(weather.wind_speed * 3.6)} km/h`} />
              <WeatherItem icon={Droplets} label="Humidity" value={`${weather.humidity}%`} />
              <WeatherItem icon={Eye} label="Visibility" value={`${weather.visibility.toFixed(1)} km`} />
              <WeatherItem icon={Compass} label="Pressure" value={`${weather.pressure} hPa`} />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-sm">
            <Cloud className="w-5 h-5 mr-2 animate-pulse" />
            Loading weather data...
          </div>
        )}
      </div>

      {/* Route */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2 px-0.5">Flight Path</div>
        <div className="p-5 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-center">
              <div className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wide">Origin</div>
              <div className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{flight.origin}</div>
              {originAirport && <div className="text-[9px] text-white/30 mt-1">{originAirport.city}</div>}
            </div>

            <div className="flex items-center gap-2 px-3">
              <div className="w-12 h-px bg-white/20"></div>
              <ArrowRight className="w-4 h-4 text-white/60" />
              <div className="w-12 h-px bg-white/20"></div>
            </div>

            <div className="flex-1 text-center">
              <div className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wide">Destination</div>
              <div className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{flight.destination}</div>
              {destinationAirport && <div className="text-[9px] text-white/30 mt-1">{destinationAirport.city}</div>}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-white/50">
            <Plane className="w-3 h-3" />
            <span>Currently over {flight.origin_country}</span>
          </div>
        </div>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <TelemetryCard icon={Gauge} label="Altitude" value={Math.round(flight.altitude * 3.28084).toLocaleString()} unit="FT" />
        <TelemetryCard icon={Wind} label="Speed" value={Math.round(flight.velocity * 1.94384).toLocaleString()} unit="KTS" />
        <TelemetryCard icon={flight.vertical_rate > 1 ? TrendingUp : TrendingDown} label="V/S" value={Math.abs(Math.round(flight.vertical_rate * 196.85)).toLocaleString()} unit="FPM" />
        <TelemetryCard icon={Navigation} label="Heading" value={Math.round(flight.heading).toString().padStart(3, '0')} unit="°" />
      </div>

      {/* System Data */}
      <div className="space-y-0.5 mb-6">
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide px-0.5 mb-1.5">Technical Data</div>
        <InfoRow label="ICAO24" value={flight.icao24.toUpperCase()} />
        <InfoRow label="Country" value={flight.origin_country} />
        <InfoRow label="Updated" value={format(new Date(), 'HH:mm:ss')} />
      </div>

      {/* Action Button */}
      <button
        onClick={onCenter}
        className="w-full py-3 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition-colors"
      >
        Center on Flight
      </button>
    </>
  );
}

function WeatherItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-white/40" />
      <div className="flex-1">
        <div className="text-[9px] text-white/40">{label}</div>
        <div className="text-xs font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

function TelemetryCard({ icon: Icon, label, value, unit }: any) {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between mb-2.5">
        <Icon className="w-3.5 h-3.5 text-white/60" />
        <div className="text-[9px] font-semibold text-white/40 uppercase tracking-wide">{label}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
        <span className="text-[10px] font-semibold text-white/40">{unit}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0">
      <span className="text-[11px] font-medium text-white/40">{label}</span>
      <span className="text-xs font-semibold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';

export interface Flight {
    icao24: string;
    callsign: string;
    origin_country: string;
    longitude: number;
    latitude: number;
    altitude: number;
    on_ground: boolean;
    velocity: number;
    heading: number;
    vertical_rate: number;
    trail: [number, number][];
    // Interpolated position for smooth movement
    interpolatedLng?: number;
    interpolatedLat?: number;
    // Rich metadata
    origin?: string;
    destination?: string;
    airline?: string;
    aircraft?: string;
    registration?: string;
    flight_number?: string;
}

// OpenSky Network - Free, open-source flight tracking (no API key needed!)
// API: https://opensky-network.org/

const AIRLINE_MAP: Record<string, string> = {
    'UAL': 'United Airlines',
    'BAW': 'British Airways',
    'AFR': 'Air France',
    'DLH': 'Lufthansa',
    'UAE': 'Emirates',
    'AAL': 'American Airlines',
    'DAL': 'Delta Air Lines',
    'SWA': 'Southwest Airlines',
    'KLM': 'KLM Royal Dutch',
    'QFA': 'Qantas Airways',
    'THY': 'Turkish Airlines',
    'RYR': 'Ryanair',
    'EZY': 'EasyJet',
    'VLG': 'Vueling Airlines',
    'FDX': 'FedEx Express',
    'UPS': 'UPS Airlines',
    'SIA': 'Singapore Airlines',
    'QTR': 'Qatar Airways',
    'ETH': 'Ethiopian Airlines',
    'ACA': 'Air Canada',
};

export function useFlights() {
    const [flights, setFlights] = useState<Flight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const trailsRef = useRef<Record<string, [number, number][]>>({});
    const lastApiDataRef = useRef<Record<string, { lng: number; lat: number; velocity: number; heading: number; timestamp: number }>>({});
    const animationFrameRef = useRef<number>();

    // Smooth interpolation between API updates
    const interpolatePosition = (
        startLng: number,
        startLat: number,
        velocity: number,
        heading: number,
        elapsedSeconds: number
    ): [number, number] => {
        if (velocity === 0 || !velocity) return [startLng, startLat];

        // Convert velocity from m/s to degrees per second
        const speedDegreesPerSecond = velocity / 111320;
        const rad = (heading * Math.PI) / 180;

        const deltaLng = Math.sin(rad) * speedDegreesPerSecond * elapsedSeconds;
        const deltaLat = Math.cos(rad) * speedDegreesPerSecond * elapsedSeconds;

        return [startLng + deltaLng, startLat + deltaLat];
    };

    // Animation loop for smooth movement
    useEffect(() => {
        const animate = () => {
            const now = Date.now();

            setFlights(prevFlights =>
                prevFlights.map(flight => {
                    const lastKnown = lastApiDataRef.current[flight.icao24];
                    if (!lastKnown) return flight;

                    const elapsedSeconds = (now - lastKnown.timestamp) / 1000;

                    // Only interpolate for reasonable time periods (not more than 30 seconds)
                    if (elapsedSeconds > 30) return flight;

                    // Interpolate position
                    const [interpLng, interpLat] = interpolatePosition(
                        lastKnown.lng,
                        lastKnown.lat,
                        lastKnown.velocity,
                        lastKnown.heading,
                        elapsedSeconds
                    );

                    return {
                        ...flight,
                        interpolatedLng: interpLng,
                        interpolatedLat: interpLat
                    };
                })
            );

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const fetchFlights = async () => {
        try {
            const response = await fetch(
                'https://opensky-network.org/api/states/all'
            );

            if (!response.ok) {
                throw new Error(`OpenSky API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.states || data.states.length === 0) {
                throw new Error('No flight data available from OpenSky Network');
            }

            const now = Date.now();

            // OpenSky returns array of arrays - filter and limit to 100 flights
            const mappedFlights: Flight[] = data.states
                .filter((state: any[]) => {
                    const lng = state[5];
                    const lat = state[6];
                    const onGround = state[8];
                    const velocity = state[9];

                    // Filter: must have position, not on ground, and moving
                    return lng !== null && lat !== null && !onGround && velocity > 0;
                })
                .slice(0, 500) // Limit to 500 flights for fluent UX
                .map((state: any[]) => {
                    // OpenSky state vector format:
                    // 0: icao24, 1: callsign, 2: origin_country, 5: longitude, 6: latitude
                    // 7: baro_altitude, 8: on_ground, 9: velocity, 10: true_track, 11: vertical_rate

                    const icao24 = state[0] || `FLIGHT${Math.random().toString(36).substr(2, 9)}`;
                    const callsign = (state[1] || 'N/A').trim();
                    const lng = parseFloat(state[5]);
                    const lat = parseFloat(state[6]);
                    const velocity = parseFloat(state[9]) || 0; // m/s
                    const heading = parseFloat(state[10]) || 0; // degrees
                    const altitude = parseFloat(state[7]) || 0; // meters
                    const verticalRate = parseFloat(state[11]) || 0; // m/s

                    // Store API data for interpolation
                    lastApiDataRef.current[icao24] = { lng, lat, velocity, heading, timestamp: now };

                    // Update trail
                    if (!trailsRef.current[icao24]) {
                        trailsRef.current[icao24] = [];
                    }

                    const currentTrail = trailsRef.current[icao24];
                    const lastPoint = currentTrail[currentTrail.length - 1];

                    if (!lastPoint || Math.abs(lastPoint[0] - lng) > 0.001 || Math.abs(lastPoint[1] - lat) > 0.001) {
                        currentTrail.push([lng, lat]);
                        if (currentTrail.length > 50) currentTrail.shift();
                    }

                    // Try to extract airline from callsign (first 3 chars)
                    const airlineCode = callsign.substring(0, 3).toUpperCase();
                    const airlineName = AIRLINE_MAP[airlineCode] || 'Unknown Airline';

                    return {
                        icao24,
                        callsign,
                        origin_country: state[2] || 'Unknown',
                        longitude: lng,
                        latitude: lat,
                        interpolatedLng: lng,
                        interpolatedLat: lat,
                        altitude,
                        on_ground: state[8] || false,
                        velocity, // m/s (will be converted in display)
                        heading,
                        vertical_rate: verticalRate,
                        trail: [...currentTrail],
                        origin: 'N/A', // OpenSky doesn't provide origin/destination
                        destination: 'N/A',
                        airline: airlineName,
                        aircraft: 'Aircraft', // OpenSky doesn't provide aircraft type
                        registration: icao24.toUpperCase(),
                        flight_number: callsign
                    };
                });

            setFlights(mappedFlights);
            setLoading(false);
            setError(null);

            console.log(`✈️ OpenSky Network: Tracking ${mappedFlights.length} flights globally`);
        } catch (err: any) {
            console.error('OpenSky API error:', err);
            setError(`Connection issue: ${err.message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlights(); // Initial fetch
        const interval = setInterval(fetchFlights, 5000); // Update every 5 seconds for smoother movement

        return () => clearInterval(interval);
    }, []);

    return { flights, loading, error };
}

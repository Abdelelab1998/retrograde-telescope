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
    // Rich metadata from AirLabs
    origin?: string;
    destination?: string;
    airline?: string;
    aircraft?: string;
    registration?: string;
    flight_number?: string;
}

const AIRLABS_API_KEY = 'aaae345f-411d-4674-86da-b791ed3e1747';

const AIRLINE_MAP: Record<string, string> = {
    'UA': 'United Airlines',
    'BA': 'British Airways',
    'AF': 'Air France',
    'LH': 'Lufthansa',
    'EK': 'Emirates',
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'WN': 'Southwest Airlines',
    'KL': 'KLM Royal Dutch',
    'QF': 'Qantas Airways',
    'TK': 'Turkish Airlines',
    'FR': 'Ryanair',
    'U2': 'EasyJet',
    'VY': 'Vueling Airlines',
    'FX': 'FedEx Express',
    '5X': 'UPS Airlines',
    'SQ': 'Singapore Airlines',
    'QR': 'Qatar Airways',
    'ET': 'Ethiopian Airlines',
    'AC': 'Air Canada',
};

const AIRCRAFT_TYPES: Record<string, string> = {
    'B788': 'Boeing 787-8 Dreamliner',
    'B789': 'Boeing 787-9 Dreamliner',
    'B78X': 'Boeing 787-10 Dreamliner',
    'A359': 'Airbus A350-900',
    'A35K': 'Airbus A350-1000',
    'B738': 'Boeing 737-800',
    'B737': 'Boeing 737',
    'B38M': 'Boeing 737 MAX 8',
    'A321': 'Airbus A321',
    'A21N': 'Airbus A321neo',
    'B77W': 'Boeing 777-300ER',
    'B777': 'Boeing 777',
    'A388': 'Airbus A380-800',
    'B748': 'Boeing 747-8',
    'E190': 'Embraer E190',
    'E195': 'Embraer E195',
    'CRJ9': 'Bombardier CRJ-900',
    'A220': 'Airbus A220',
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

        // Convert velocity from knots to degrees per second
        const speedDegreesPerSecond = velocity / 111320; // Approximate conversion
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
                `https://airlabs.co/api/v9/flights?api_key=${AIRLABS_API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`AirLabs API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.response || data.response.length === 0) {
                throw new Error('No flight data available from AirLabs');
            }

            const now = Date.now();
            const mappedFlights: Flight[] = data.response
                .filter((f: any) => f.lat && f.lng && f.status !== 'landed')
                .slice(0, 1000) // Track 1000 flights globally
                .map((f: any) => {
                    const icao24 = f.hex || f.reg_number || `FLIGHT${Math.random().toString(36).substr(2, 9)}`;
                    const callsign = f.flight_icao || f.flight_iata || f.flight_number || 'N/A';
                    const lng = parseFloat(f.lng);
                    const lat = parseFloat(f.lat);
                    const velocity = parseFloat(f.speed) || 0;
                    const heading = parseFloat(f.dir) || 0;
                    const altitude = parseFloat(f.alt) || 0;

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

                    // Get airline name
                    const airlineCode = f.airline_iata || f.airline_icao;
                    const airlineName = airlineCode ? (AIRLINE_MAP[airlineCode] || f.airline_name || 'Unknown Airline') : 'Unknown Airline';

                    // Get aircraft type
                    const aircraftType = f.aircraft_icao ? (AIRCRAFT_TYPES[f.aircraft_icao] || f.aircraft_icao) : 'Unknown Aircraft';

                    return {
                        icao24,
                        callsign,
                        origin_country: f.flag || 'Unknown',
                        longitude: lng,
                        latitude: lat,
                        interpolatedLng: lng,
                        interpolatedLat: lat,
                        altitude,
                        on_ground: f.status === 'landed',
                        velocity,
                        heading,
                        vertical_rate: parseFloat(f.v_speed) || 0,
                        trail: [...currentTrail],
                        origin: f.dep_iata || f.dep_icao || 'N/A',
                        destination: f.arr_iata || f.arr_icao || 'N/A',
                        airline: airlineName,
                        aircraft: aircraftType,
                        registration: f.reg_number,
                        flight_number: f.flight_number || f.flight_iata
                    };
                });

            setFlights(mappedFlights);
            setLoading(false);
            setError(null);

            console.log(`✈️ AirLabs: Tracking ${mappedFlights.length} flights globally`);
        } catch (err: any) {
            console.error('AirLabs API error:', err);
            setError(`Connection issue: ${err.message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlights(); // Initial fetch
        const interval = setInterval(fetchFlights, 10000); // Update every 10 seconds (AirLabs has generous limits)

        return () => clearInterval(interval);
    }, []);

    return { flights, loading, error };
}

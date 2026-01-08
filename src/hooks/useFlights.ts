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

// AirLabs - Real-time flight tracking with route information
// API: https://airlabs.co/

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

// Generate 100 dummy flights for testing
const generateDummyFlights = (): Flight[] => {
    const airlines = Object.keys(AIRLINE_MAP);
    const airports = ['JFK', 'LAX', 'ORD', 'DFW', 'DEN', 'ATL', 'SFO', 'SEA', 'MIA', 'BOS', 'LHR', 'CDG', 'FRA', 'AMS', 'DXB'];
    const dummyFlights: Flight[] = [];

    for (let i = 0; i < 100; i++) {
        const airlineCode = airlines[Math.floor(Math.random() * airlines.length)];
        const lng = -180 + Math.random() * 360; // Random longitude
        const lat = -60 + Math.random() * 120; // Random latitude (avoid poles)
        const velocity = 400 + Math.random() * 200; // 400-600 knots
        const heading = Math.random() * 360;
        const altitude = 30000 + Math.random() * 15000; // 30k-45k feet

        dummyFlights.push({
            icao24: `DUMMY${i.toString().padStart(3, '0')}`,
            callsign: `${airlineCode}${Math.floor(100 + Math.random() * 900)}`,
            origin_country: 'Demo Country',
            longitude: lng,
            latitude: lat,
            interpolatedLng: lng,
            interpolatedLat: lat,
            altitude,
            on_ground: false,
            velocity,
            heading,
            vertical_rate: -500 + Math.random() * 1000, // -500 to +500 fpm
            trail: [[lng, lat]],
            origin: airports[Math.floor(Math.random() * airports.length)],
            destination: airports[Math.floor(Math.random() * airports.length)],
            airline: AIRLINE_MAP[airlineCode],
            aircraft: 'B738',
            registration: `N${Math.floor(10000 + Math.random() * 90000)}`,
            flight_number: `${airlineCode}${Math.floor(100 + Math.random() * 900)}`
        });
    }

    return dummyFlights;
};

export function useFlights(useDummyData: boolean = false) {
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

                    // Only interpolate for reasonable time periods (not more than 60 seconds)
                    if (elapsedSeconds > 60) return flight;

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
            // Call our secure backend API instead of AirLabs directly
            const response = await fetch('/api/flights');

            if (!response.ok) {
                throw new Error(`Backend API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.response || data.response.length === 0) {
                throw new Error('No flight data available from backend');
            }

            const now = Date.now();

            // AirLabs returns array of flight objects - filter and limit to 500 flights
            const mappedFlights: Flight[] = data.response
                .filter((flight: any) => {
                    const lng = flight.lng;
                    const lat = flight.lat;
                    const status = flight.status;

                    // Filter: must have position and be in flight
                    return lng !== null && lat !== null && status === 'en-route';
                })
                .slice(0, 500) // Limit to 500 flights for fluent UX
                .map((flight: any) => {
                    const icao24 = flight.hex || flight.reg_number || `FLIGHT${Math.random().toString(36).substr(2, 9)}`;
                    const callsign = flight.flight_icao || flight.flight_iata || 'N/A';
                    const lng = parseFloat(flight.lng);
                    const lat = parseFloat(flight.lat);
                    const velocity = parseFloat(flight.speed) || 0; // knots
                    const heading = parseFloat(flight.dir) || 0; // degrees
                    const altitude = parseFloat(flight.alt) || 0; // feet
                    const verticalRate = parseFloat(flight.v_speed) || 0; // ft/min

                    // Store API data for interpolation (convert knots to m/s for consistency)
                    lastApiDataRef.current[icao24] = {
                        lng,
                        lat,
                        velocity: velocity * 0.514444, // knots to m/s
                        heading,
                        timestamp: now
                    };

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

                    // Extract airline name
                    const airlineName = flight.airline_name || flight.airline_iata || 'Unknown Airline';

                    return {
                        icao24,
                        callsign,
                        origin_country: flight.flag || 'Unknown',
                        longitude: lng,
                        latitude: lat,
                        interpolatedLng: lng,
                        interpolatedLat: lat,
                        altitude, // feet
                        on_ground: false,
                        velocity, // knots
                        heading,
                        vertical_rate: verticalRate, // ft/min
                        trail: [...currentTrail],
                        origin: flight.dep_iata || flight.dep_icao || 'N/A',
                        destination: flight.arr_iata || flight.arr_icao || 'N/A',
                        airline: airlineName,
                        aircraft: flight.aircraft_icao || 'Aircraft',
                        registration: flight.reg_number || icao24.toUpperCase(),
                        flight_number: flight.flight_number || callsign
                    };
                });

            setFlights(mappedFlights);
            setLoading(false);
            setError(null);

            console.log(`✈️ Backend API: Tracking ${mappedFlights.length} flights globally`);
        } catch (err: any) {
            console.error('Backend API error:', err);
            setError(`Connection issue: ${err.message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        // Clear flights when switching modes
        setFlights([]);
        setLoading(true);

        if (useDummyData) {
            // Load dummy data immediately
            const dummyFlights = generateDummyFlights();
            setFlights(dummyFlights);
            setLoading(false);
            setError(null);
            console.log(`✈️ Dummy Mode: Loaded ${dummyFlights.length} fake flights`);
        } else {
            // Fetch real data from AirLabs
            fetchFlights(); // Initial fetch
            const interval = setInterval(fetchFlights, 45000); // Update every 45 seconds
            return () => clearInterval(interval);
        }
    }, [useDummyData]);

    return { flights, loading, error };
}

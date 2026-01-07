import { useState, useEffect } from 'react';

export interface Airport {
    icao: string;
    iata: string;
    name: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
}

export function useAirports() {
    const [airports, setAirports] = useState<Airport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAirports() {
            try {
                // Fetching a comprehensive airport list from a reliable source
                const response = await fetch('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json');
                const data = await response.json();

                // Transform the data to our interface
                const mappedAirports: Airport[] = Object.values(data).map((a: any) => ({
                    icao: a.icao || '',
                    iata: a.iata || '',
                    name: a.name || '',
                    city: a.city || '',
                    country: a.country || '',
                    latitude: parseFloat(a.lat),
                    longitude: parseFloat(a.lon)
                })).filter(a => a.iata || a.icao);

                setAirports(mappedAirports);
            } catch (error) {
                console.error("Failed to fetch airports:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchAirports();
    }, []);

    return { airports, loading };
}

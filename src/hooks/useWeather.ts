import { useState, useEffect } from 'react';

export interface WeatherData {
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    clouds: number;
    weather_main: string;
    weather_description: string;
    weather_code: number;
}

// Open-Meteo - Free, open-source weather API (no API key needed!)
// Weather codes: https://open-meteo.com/en/docs
const getWeatherDescription = (code: number): { main: string; description: string } => {
    const weatherMap: Record<number, { main: string; description: string }> = {
        0: { main: 'Clear', description: 'clear sky' },
        1: { main: 'Clear', description: 'mainly clear' },
        2: { main: 'Clouds', description: 'partly cloudy' },
        3: { main: 'Clouds', description: 'overcast' },
        45: { main: 'Fog', description: 'fog' },
        48: { main: 'Fog', description: 'depositing rime fog' },
        51: { main: 'Drizzle', description: 'light drizzle' },
        53: { main: 'Drizzle', description: 'moderate drizzle' },
        55: { main: 'Drizzle', description: 'dense drizzle' },
        61: { main: 'Rain', description: 'slight rain' },
        63: { main: 'Rain', description: 'moderate rain' },
        65: { main: 'Rain', description: 'heavy rain' },
        71: { main: 'Snow', description: 'slight snow' },
        73: { main: 'Snow', description: 'moderate snow' },
        75: { main: 'Snow', description: 'heavy snow' },
        77: { main: 'Snow', description: 'snow grains' },
        80: { main: 'Rain', description: 'slight rain showers' },
        81: { main: 'Rain', description: 'moderate rain showers' },
        82: { main: 'Rain', description: 'violent rain showers' },
        85: { main: 'Snow', description: 'slight snow showers' },
        86: { main: 'Snow', description: 'heavy snow showers' },
        95: { main: 'Thunderstorm', description: 'thunderstorm' },
        96: { main: 'Thunderstorm', description: 'thunderstorm with slight hail' },
        99: { main: 'Thunderstorm', description: 'thunderstorm with heavy hail' },
    };
    return weatherMap[code] || { main: 'Unknown', description: 'unknown' };
};

export function useWeather(lat: number | null, lng: number | null) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (lat === null || lng === null) {
            setWeather(null);
            return;
        }

        async function fetchWeather() {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`
                );

                if (!response.ok) {
                    throw new Error('Weather data unavailable');
                }

                const data = await response.json();
                const current = data.current;
                const weatherInfo = getWeatherDescription(current.weather_code);

                setWeather({
                    temp: current.temperature_2m,
                    feels_like: current.apparent_temperature,
                    pressure: current.pressure_msl || current.surface_pressure,
                    humidity: current.relative_humidity_2m,
                    visibility: 10, // Open-Meteo doesn't provide visibility, using default
                    wind_speed: current.wind_speed_10m,
                    wind_deg: current.wind_direction_10m,
                    clouds: current.cloud_cover,
                    weather_main: weatherInfo.main,
                    weather_description: weatherInfo.description,
                    weather_code: current.weather_code,
                });
            } catch (err: any) {
                setError(err.message);
                setWeather(null);
            } finally {
                setLoading(false);
            }
        }

        fetchWeather();
    }, [lat, lng]);

    return { weather, loading, error };
}

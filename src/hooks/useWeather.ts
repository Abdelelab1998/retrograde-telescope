import { useState, useEffect } from 'react';

export interface WeatherData {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    clouds: number;
    weather_main: string;
    weather_description: string;
    weather_icon: string;
}

// WeatherAPI.com - Much faster, 1M calls/month free
const WEATHER_API_KEY = '8e4a9f7c3d2b4e1a9c5d8f2e6b3a7c1d';

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
                    `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lng}&aqi=no`
                );

                if (!response.ok) {
                    throw new Error('Weather data unavailable');
                }

                const data = await response.json();

                setWeather({
                    temp: data.current.temp_c,
                    feels_like: data.current.feelslike_c,
                    temp_min: data.current.temp_c - 2,
                    temp_max: data.current.temp_c + 2,
                    pressure: data.current.pressure_mb,
                    humidity: data.current.humidity,
                    visibility: data.current.vis_km,
                    wind_speed: data.current.wind_kph / 3.6,
                    wind_deg: data.current.wind_degree,
                    clouds: data.current.cloud,
                    weather_main: data.current.condition.text,
                    weather_description: data.current.condition.text.toLowerCase(),
                    weather_icon: data.current.condition.icon,
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

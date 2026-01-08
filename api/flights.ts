import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from environment variable
    const API_KEY = process.env.AIRLABS_API_KEY;

    if (!API_KEY) {
      console.error('AIRLABS_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Fetch from AirLabs API
    const response = await fetch(
      `https://airlabs.co/api/v9/flights?api_key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`AirLabs API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Return the data to the frontend
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching flights:', error);
    return res.status(500).json({
      error: 'Failed to fetch flights',
      message: error.message
    });
  }
}

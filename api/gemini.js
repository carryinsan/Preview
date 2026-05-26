import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export default async function handler(req, res) {
  // Restrict to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { prompt } = req.body;

  // Validate request payload
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A valid prompt string is required.' });
  }

  // Ensure the API key is configured in the environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Define a strict JSON schema to force Gemini to return exactly what the frontend expects
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        html: {
          type: SchemaType.STRING,
          description: "Production-ready HTML5 markup. Do not include <html>, <head>, or <body> wrapper tags. Provide only the inner semantic structure."
        },
        css: {
          type: SchemaType.STRING,
          description: "Production-ready CSS3 styling. Do not include <style> wrapper tags. Use modern properties, variables, and responsive units."
        }
      },
      required: ["html", "css"]
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are an elite Frontend UI Architect. Translate user requirements into visually stunning, production-ready HTML and CSS. You strictly follow instructions and output only raw, valid JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.4, // Lower temperature for more stable, functional code output
      }
    });

    // Execute the request to Gemini
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();

    // Parse the guaranteed JSON payload
    const data = JSON.parse(textResponse);

    // Send the structured data back to the client
    return res.status(200).json({
      html: data.html || "",
      css: data.css || ""
    });

  } catch (error) {
    console.error('Gemini API Generation Error:', error);
    
    // Handle specific JSON parsing errors just in case
    if (error instanceof SyntaxError) {
      return res.status(502).json({ error: 'Failed to parse the response from the AI model.' });
    }
    
    return res.status(500).json({ error: error.message || 'An internal server error occurred during UI generation.' });
  }
}

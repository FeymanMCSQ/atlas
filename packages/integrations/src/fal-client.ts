/**
 * fal-client.ts
 * Integration with Fal.ai for ultra-fast, cheap Flux.1 image generation.
 */

export async function generateImageWithFlux(prompt: string): Promise<string> {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    throw new Error("Missing FAL_KEY in environment variables.");
  }

  const response = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: "landscape_4_3",
      safety_tolerance: "2"
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Fal.ai API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  if (!data.images || data.images.length === 0) {
    throw new Error("No images returned from Fal.ai");
  }

  // Fal.run returns the hosted image URL directly
  return data.images[0].url;
}

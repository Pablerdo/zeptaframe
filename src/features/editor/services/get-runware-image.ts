import { Runware, ITextToImage } from "@runware/sdk-js";


const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY as string });

export const generateImage = async (prompt: string): Promise<ITextToImage | null> => {
  try {
    const response = await runware.requestImages({      
      numberResults: 4,
      positivePrompt: prompt,
      model: "rundiffusion:110@101",
      width: 960,
      height: 960,
      steps: 4,
      outputType: "URL",
    });

    // According to the API spec, the response is of type ITextToImage[]
    if (response && response.length > 0) {
      return response[0];
    }
    
    return null;
  } catch (e) {
    // All errors can be caught in the catch block as per NB in the requirements
    return null;
  }
};
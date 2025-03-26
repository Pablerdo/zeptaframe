import React, { createContext, useContext, useState, useEffect } from 'react';
import { VideoGeneration } from '../types';
import { toast } from 'sonner';

// Define the context structure
interface LastFrameContextType {
  // All video generations with last frames
  lastFrameGenerations: VideoGeneration[];
  // Method to import a last frame into the active editor
  importLastFrame: (url: string) => Promise<void>;
  // The currently active editor (if any)
  setActiveEditor: (editor: any) => void;
}

// Create the context with default values
const LastFrameContext = createContext<LastFrameContextType>({
  lastFrameGenerations: [],
  importLastFrame: async () => {},
  setActiveEditor: () => {}
});

export const useLastFrames = () => useContext(LastFrameContext);

interface LastFrameProviderProps {
  children: React.ReactNode;
  videoGenerations: VideoGeneration[];
}

export const LastFrameProvider: React.FC<LastFrameProviderProps> = ({ 
  children,
  videoGenerations
}) => {
  const [activeEditor, setActiveEditor] = useState<any>(null);
  const [lastFrameGenerations, setLastFrameGenerations] = useState<VideoGeneration[]>([]);

  // Filter video generations to only include those with lastFrameUrl
  useEffect(() => {
    const generationsWithLastFrames = videoGenerations.filter(
      gen => gen.status === 'success' && gen.lastFrameUrl
    );
    setLastFrameGenerations(generationsWithLastFrames);
  }, [videoGenerations]);

  // Function to import a last frame into the current active editor
  const importLastFrame = async (url: string) => {
    if (!activeEditor) {
      console.error("No active editor to import last frame into");
      return;
    }

    try {
      // Use our proxy endpoint to fetch the image
      const proxyUrl = `/api/comfydeploy/proxy-image?url=${encodeURIComponent(url)}`;
      
      // Use the editor's addImage method to add the last frame to the canvas
      await activeEditor.addImage(proxyUrl);
      toast.success('Last frame imported successfully');
    } catch (error) {
      console.error('Error importing last frame:', error);
      toast.error('Failed to import last frame');
    }
  };

  return (
    <LastFrameContext.Provider value={{ 
      lastFrameGenerations,
      importLastFrame,
      setActiveEditor
    }}>
      {children}
    </LastFrameContext.Provider>
  );
}; 
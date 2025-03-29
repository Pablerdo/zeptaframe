'use client';

import { Download, Loader2, X, Calendar } from 'lucide-react';
import { downloadVideo } from '../services/video-timeline-service';
import { VideoExport } from '../types';

interface VideoExportsListProps {
  videoExports: VideoExport[];
}

const VideoExportsList = ({ videoExports }: VideoExportsListProps) => {
  // Format timestamp for display
  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], { 
      month: 'short',
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDownload = (videoUrl: string) => {
    if (!videoUrl) return;
    
    downloadVideo(
      videoUrl, 
      `Zeptaframe-${new Date().toISOString().slice(0, 10)}.mp4`
    );
  };

  // Calculate dynamic max height based on number of exports
  // Base height of 60px for empty state, then 60px per export with a minimum of 120px
  // and maximum of 350px to ensure it doesn't grow too large
  const getMaxHeight = () => {
    const baseHeight = 60;
    const heightPerExport = 60;
    const calculatedHeight = videoExports.length === 0 
      ? baseHeight 
      : baseHeight + (videoExports.length * heightPerExport);
    
    return Math.max(Math.min(calculatedHeight, 350), 120);
  };

  return (
    <div className="w-full mt-2 bg-black/20 rounded-md p-1">
      <div className="text-sm font-medium text-gray-300 mb-1 flex items-center px-2 py-1.5 bg-black/40 rounded">
        <Calendar className="w-4 h-4 mr-2" />
        <span>Export History</span>
      </div>
      
      <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: `${getMaxHeight()}px` }}>
        <div className="space-y-1 p-1">
          {videoExports.length === 0 && (
            <div className="flex items-center justify-center px-3 py-2 rounded bg-gray-700/30 hover:bg-gray-700/40 transition-colors">
              <span className="text-xs text-gray-100 dark:text-gray-400">No exports yet</span>
            </div>
          )}
          {videoExports.map((export_: VideoExport) => (
            <div 
              key={export_.id}
              className="flex items-center justify-between px-3 py-2 rounded bg-gray-700/30 hover:bg-gray-700/40 transition-colors"
            >
              <div className="flex items-center">
                {export_.status === 'success' && (
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                )}
                {export_.status === 'pending' && (
                  <Loader2 className="w-3 h-3 mr-2 text-blue-400 animate-spin" />
                )}
                {export_.status === 'error' && (
                  <X className="w-3 h-3 mr-2 text-red-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-300">
                    {export_.status === 'pending' 
                      ? 'Processing...' 
                      : export_.status === 'success' 
                        ? 'Timeline Export' 
                        : 'Failed Export'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(export_.createdAt)}
                  </span>
                </div>
              </div>
              
              {export_.status === 'success' && export_.videoUrl && (
                <button
                  onClick={() => handleDownload(export_.videoUrl!)}
                  className="p-1 text-blue-400 hover:text-blue-300 rounded-full hover:bg-blue-900/20"
                  title="Download video"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoExportsList; 
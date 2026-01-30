import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

/**
 * Tab bar component for multi-file code viewer
 * Shows open files as tabs with close buttons and a dropdown to open more files
 */
export function FileTabs({
  files,              // All available files: { name, language }[]
  openFiles,          // Currently open file names: string[]
  activeFile,         // Currently active file name: string
  onFileSelect,       // (fileName) => void
  onFileClose,        // (fileName) => void
  onFileOpen,         // (fileName) => void - opens a new tab
  fileDiffStats = {}  // { fileName: { addedCount, deletedCount } }
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollRef = useRef(null);
  const dropdownRef = useRef(null);

  // Files available to open (not already in tabs)
  const availableToOpen = files.filter(f => !openFiles.includes(f.name));

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <div className="flex items-center border-b border-gray-200 bg-gray-50">
      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300"
        style={{ scrollbarWidth: 'thin' }}
      >
        {openFiles.map(fileName => {
          const isActive = fileName === activeFile;
          const stats = fileDiffStats[fileName] || { addedCount: 0, deletedCount: 0 };
          const netChange = stats.addedCount - stats.deletedCount;

          // Determine glow: green if more added, red if more deleted, none if equal/zero
          let glowClass = '';
          if (netChange > 0) {
            glowClass = 'tab-glow-green';
          } else if (netChange < 0) {
            glowClass = 'tab-glow-red';
          }

          return (
            <button
              key={fileName}
              onClick={() => onFileSelect(fileName)}
              className={`group flex items-center gap-2 px-3 py-2 text-sm
                whitespace-nowrap border-r border-gray-200 transition
                ${isActive
                  ? 'bg-white text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}
                ${glowClass}`}
            >
              <span className="truncate max-w-[150px]">{fileName}</span>
              {/* Only show close button if more than one file is open */}
              {openFiles.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClose(fileName);
                  }}
                  className={`p-0.5 rounded hover:bg-gray-200 transition
                    ${isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
                >
                  <X size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add file dropdown */}
      {availableToOpen.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Open file"
          >
            <Plus size={16} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200
                          rounded-lg shadow-lg z-20 min-w-[160px] py-1">
              {availableToOpen.map(file => (
                <button
                  key={file.name}
                  onClick={() => {
                    onFileOpen(file.name);
                    setDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-sm text-left text-gray-700
                           hover:bg-gray-100 transition"
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { UploadResponse } from '../shared/types/api';
import { History } from './History';

type View = 'home' | 'history';

export const App = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<UploadResponse | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|iOS/i.test(navigator.userAgent);
  }, []);

  const allowedTypes = useMemo(
    () => ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const,
    []
  );

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setServerInfo(null);
  }, [previewUrl]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!allowedTypes.includes(file.type as (typeof allowedTypes)[number])) {
        return 'Only PNG, JPEG, GIF, or WEBP images are allowed.';
      }
      if (file.size > 4 * 1024 * 1024) {
        return 'Image must be under 4MB.';
      }
      return null;
    },
    [allowedTypes]
  );

  // Upload a single file
  // duplicate definition below removed

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setMessage(null);
      setServerInfo(null);
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-File-Name': file.name,
        },
        body: arrayBuffer,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed with ${res.status}`);
      }
      const data: UploadResponse = await res.json();
      setServerInfo(data);
      setMessage('Upload successful');
      // History view will fetch on demand
    } catch (err) {
      console.error(err);
      setMessage('Upload failed. Please try another image.');
      setServerInfo(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0]!;
      const err = validateFile(file);
      if (err) {
        setMessage(err);
        resetPreview();
        return;
      }
      setMessage(null);
      setSelectedFile(file);
      setServerInfo(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      void uploadFile(file);
    },
    [validateFile, resetPreview, uploadFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const [view, setView] = useState<View>('home');

  return (
    <div className="flex relative flex-col justify-start items-center h-full gap-4 p-4 overflow-hidden">
      {view === 'home' ? (
        <section className="w-full max-w-screen-sm mx-auto mt-6 flex-1 flex flex-col min-h-0">
          <div
            className={
              `mt-4 rounded-lg border-2 border-dashed transition-colors flex-1 max-h-full min-h-48 ` +
              (dragActive ? 'border-[#d93900] bg-[#fff4f0]' : 'border-gray-300 bg-white')
            }
            onDrop={!isMobile ? onDrop : undefined}
            onDragOver={!isMobile ? onDragOver : undefined}
            onDragLeave={!isMobile ? onDragLeave : undefined}
          >
            <div className="flex flex-col items-center justify-center p-6 gap-3 h-full">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={selectedFile?.name || 'preview'}
                  className="max-h-full w-full object-contain rounded"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="text-5xl">🖼️</div>
                  {isMobile ? (
                    <p className="text-sm text-gray-700">Tap Choose Image to pick a photo.</p>
                  ) : (
                    <p className="text-sm text-gray-700">
                      Drag & drop an image here, or
                      <button
                        className="ml-1 text-[#d93900] underline underline-offset-2"
                        onClick={() => inputRef.current?.click()}
                      >
                        browse
                      </button>
                    </p>
                  )}
                </div>
              )}

              <div
                className={`flex flex-wrap gap-3 w-full justify-center ${previewUrl ? 'mt-auto' : ''}`}
              >
                <button
                  className="px-4 py-2 rounded bg-gray-100 text-gray-800 text-sm disabled:opacity-50"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Choose Image'}
                </button>
                {selectedFile ? (
                  <button
                    className="px-4 py-2 rounded bg-gray-100 text-gray-800 text-sm disabled:opacity-50"
                    onClick={resetPreview}
                    disabled={uploading}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={allowedTypes.join(',')}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          </div>

          {message ? <p className="text-center mt-3 text-sm text-gray-700">{message}</p> : null}
          {serverInfo ? (
            <div className="mt-3 text-xs text-gray-600 text-center">
              <div>Server accepted: {serverInfo.mimeType}</div>
              <div>Size: {(serverInfo.bytes / 1024).toFixed(1)} KB</div>
              {serverInfo.fileName ? <div>File: {serverInfo.fileName}</div> : null}
            </div>
          ) : null}
        </section>
      ) : (
        <History />
      )}

      <div className="mt-4 flex justify-center">
        {view === 'home' ? (
          <button
            className="px-4 py-2 rounded bg-[#d93900] text-white text-sm"
            onClick={() => setView('history')}
          >
            History
          </button>
        ) : (
          <button
            className="px-4 py-2 rounded bg-gray-800 text-white text-sm"
            onClick={() => setView('home')}
          >
            Home
          </button>
        )}
      </div>
    </div>
  );
};

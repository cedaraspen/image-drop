import type { ListUploadsResponse, UploadedAsset } from '../shared/types/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export const History = () => {
  const [assets, setAssets] = useState<UploadedAsset[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const urlRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  const formatDate = useCallback((iso: string) => new Date(iso).toLocaleString(), []);

  const fetchMyImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/my-images');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ListUploadsResponse = await res.json();
      if (data.type !== 'listUploads') throw new Error('Unexpected response');
      setAssets(data.assets);
    } catch (err) {
      console.error('Failed to fetch my images', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyImages();
  }, [fetchMyImages]);

  const selectText = (el: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleRowClick = async (asset: UploadedAsset) => {
    setSelectedId(asset.mediaId);
    let copied = false;
    try {
      await navigator.clipboard.writeText(asset.mediaUrl);
      copied = true;
    } catch {
      // no-op; user can manually copy from selection/highlight
    }
    const el = urlRefs.current[asset.mediaId];
    if (el) selectText(el);
    if (copied) {
      setCopiedId(asset.mediaId);
      if (copiedTimer.current) {
        window.clearTimeout(copiedTimer.current);
      }
      copiedTimer.current = window.setTimeout(() => setCopiedId(null), 1500);
    }
  };
  return (
    <section className="w-full max-w-screen-sm mx-auto mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My uploads</h2>
        <button
          className="text-sm text-[#d93900] underline underline-offset-2"
          onClick={fetchMyImages}
        >
          Refresh
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Click any row to copy the URL.</p>
      {copiedId ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
          <span aria-hidden>✓</span>
          <span>Copied to clipboard</span>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-gray-600 mt-2">Loading…</p>
      ) : assets && assets.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <div className="h-60 overflow-y-auto overscroll-contain rounded border border-gray-200">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-white px-3 py-2 border-b border-gray-200">
                    Preview
                  </th>
                  <th className="px-3 py-2 border-b border-gray-200">URL</th>
                  <th className="px-3 py-2 border-b border-gray-200">Date</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.mediaId}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedId === a.mediaId ? 'bg-yellow-50' : ''}`}
                    onClick={() => void handleRowClick(a)}
                  >
                    <td
                      className={`sticky left-0 ${selectedId === a.mediaId ? 'bg-yellow-50' : 'bg-white/95'} backdrop-blur px-3 py-2 border-b border-gray-100 max-w-3`}
                    >
                      <div className="h-12 w-12 overflow-hidden rounded bg-gray-100">
                        <img src={a.mediaUrl} alt={a.mediaId} className="h-12 w-12 object-cover" />
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100">
                      <div
                        ref={(el) => {
                          urlRefs.current[a.mediaId] = el;
                        }}
                        className={`truncate text-xs text-gray-800 select-all ${
                          selectedId === a.mediaId
                            ? 'bg-yellow-50 ring-1 ring-yellow-200 px-1 rounded'
                            : ''
                        }`}
                      >
                        {a.mediaUrl}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-600">
                      {formatDate(a.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mt-2">No uploads yet.</p>
      )}
    </section>
  );
};

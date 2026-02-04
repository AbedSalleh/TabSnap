'use client';

import { useState } from 'react';
import { Camera, Download, Copy, RefreshCw, Smartphone, AlertCircle } from 'lucide-react';

export default function Home() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeScreenshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/snap');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to take screenshot');
      }
      const blob = await res.blob();
      console.log('Received blob size:', blob.size);
      if (blob.size < 100) {
        throw new Error(`Received empty or too small image (size: ${blob.size} bytes)`);
      }
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!imageSrc) return;
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-neutral-950 to-neutral-950">
      <div className="max-w-4xl w-full flex flex-col items-center space-y-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-block p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-xl mb-4">
            <Smartphone className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-5xl font-black tracking-tight tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Tab<span className="text-indigo-500">Snap</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-md mx-auto">
            Connect your device via USB and extract screenshots instantly.
          </p>
        </div>

        {/* Action Area */}
        <div className="relative group">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>

          <button
            onClick={takeScreenshot}
            disabled={loading}
            className="relative px-8 py-4 bg-white text-neutral-950 font-bold rounded-full text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
            {loading ? 'Capturing...' : 'Capture Screenshot'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Preview Area */}
        {imageSrc && (
          <div className="w-full animate-in fade-in zoom-in duration-500 space-y-6">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-900/50 backdrop-blur-sm mx-auto max-w-3xl aspect-[16/10] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="Screenshot" className="max-w-full max-h-full object-contain shadow-lg" />
            </div>

            <div className="flex justify-center gap-4">
              <a
                href={imageSrc}
                download={`screenshot-${Date.now()}.png`}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-medium transition-colors border border-white/5"
              >
                <Download className="w-5 h-5" />
                Save to Disk
              </a>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-medium transition-colors border border-white/5"
              >
                <Copy className="w-5 h-5" />
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

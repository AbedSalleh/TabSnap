'use client';

import { useState, useCallback } from 'react';
import { Camera, Download, Copy, RefreshCw, Smartphone, AlertCircle, Usb, Video, StopCircle, Film, LogOut, Wifi } from 'lucide-react';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

export default function Home() {
  const [adb, setAdb] = useState<Adb | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Screen Recording State
  const [mode, setMode] = useState<'screenshot' | 'video'>('screenshot');
  const [recording, setRecording] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // Frame State
  const [frameStyle, setFrameStyle] = useState<'none' | 'phone' | 'tablet'>('none');
  const [wirelessIp, setWirelessIp] = useState<string | null>(null);

  // Connect to USB Device
  const connectDevice = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!Manager) {
        throw new Error('WebUSB is not supported in this browser');
      }

      const device = await Manager.requestDevice();
      if (!device) {
        // User cancelled picker
        return;
      }

      const connection = await device.connect();

      const CredentialStore = new AdbWebCredentialStore();
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial,
        connection,
        credentialStore: CredentialStore,
      });

      const adbClient = new Adb(transport);

      setAdb(adbClient);
    } catch (err: any) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect to device');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectDevice = async () => {
    if (adb) {
      try {
        await adb.transport.close();
      } catch (e) {
        console.error('Disconnect failed', e);
      }
      setAdb(null);
      setMode('screenshot');
      setImageSrc(null);
      setVideoSrc(null);
      setFrameStyle('none');
    }
  };

  const enableWireless = async () => {
    if (!adb) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Get IP Address
      // Output example: "192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.5"
      const process = await adb.subprocess.noneProtocol.spawn('ip route');
      const reader = process.output.getReader();
      let output = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          output += new TextDecoder().decode(value);
        }
      } finally {
        reader.releaseLock();
      }

      const match = output.match(/src\s+(\d+\.\d+\.\d+\.\d+)/);
      if (!match) {
        throw new Error('Could not find device IP address. Is WiFi connected?');
      }
      const ip = match[1];

      // 2. Enable TCP/IP on port 5555
      // This corresponds to `adb tcpip 5555`
      // @ts-ignore - tcpip might be hidden property
      if (adb.tcpip) {
        // @ts-ignore
        await adb.tcpip.setPort(5555);
      } else {
        // Try to execute it as a shell command anyway just in case (e.g. root) 
        // or fail gracefully. Note that typical non-root shell cannot do this.
        // BUT, yume-chan adb usually has it.
        throw new Error("TCP/IP command not supported by this library version.");
      }

      setWirelessIp(ip);
      // Using a simple alert for now, could be a modal later
      alert(`Wireless Enabled! 📡\n\n1. Unplug your USB cable.\n2. Run this on your PC (or new tab):\n\nadb connect ${ip}:5555`);

    } catch (err: any) {
      console.error('Wireless setup failed:', err);
      // Fallback message for common IP route failure on some devices
      if (err.message && err.message.includes('Could not find')) {
        setError('Could not find IP. Make sure phone is on WiFi.');
      } else {
        setError('Wireless setup failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const takeScreenshot = async () => {
    if (!adb) return;
    setLoading(true);
    setError(null);
    try {
      // Execute screencap -p
      // noneProtocol uses 'exec:' which is binary-safe
      const process = await adb.subprocess.noneProtocol.spawn('screencap -p');

      // Read output into chunks
      const chunks: Uint8Array[] = [];
      const reader = process.output.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Concatenate chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combined], { type: 'image/png' });
      if (blob.size < 100) {
        throw new Error('Screenshot failed or is empty');
      }

      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setVideoSrc(null); // Clear video if taking screenshot

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!adb) return;
    setLoading(true);
    setError(null);
    setVideoSrc(null);
    setImageSrc(null);
    try {
      // Start screenrecord in background.
      // We assume it runs until we kill it. 
      // Using --time-limit 180 (3 mins) as a safety fallback.
      await adb.subprocess.noneProtocol.spawn('screenrecord --time-limit 180 /sdcard/tabsnap_rec.mp4');
      setRecording(true);
    } catch (err: any) {
      console.error('Start recording failed:', err);
      setError(err.message);
      setRecording(false);
    } finally {
      setLoading(false);
    }
  };

  const stopRecording = async () => {
    if (!adb) return;
    setLoading(true);
    try {
      // 1. Send SIGINT (-2) to screenrecord to finalize MP4 header propery
      await adb.subprocess.noneProtocol.spawn('pkill -2 screenrecord');

      // 2. Wait for it to write the file
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. Pull file
      // Check if sync service is available
      const sync = await adb.sync();
      const content = sync.read('/sdcard/tabsnap_rec.mp4');

      // 4. Read to Blob
      const chunks: Uint8Array[] = [];
      const reader = content.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Cast chunks to any to avoid TS ArrayBufferLike mismatch
      const blob = new Blob(chunks as any[], { type: 'video/mp4' });
      if (blob.size < 1024) throw new Error("Recording failed or file empty");

      setVideoSrc(URL.createObjectURL(blob));
      setRecording(false);

      // 5. Cleanup
      await adb.subprocess.noneProtocol.spawn('rm /sdcard/tabsnap_rec.mp4');

    } catch (err: any) {
      console.error('Stop recording failed:', err);
      setError(err.message);
      setRecording(false); // Force stop state on error
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!imageSrc) return;
    try {
      // If we have a frame, we need to generate it on canvas first to copy it
      // For simplicity, clipboard copy usually just copies the raw screenshot to avoid async canvas issues on some browsers 
      // or we just copy the currently visible image src if it's the raw one.

      const response = await fetch(imageSrc);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      alert('Copied original screenshot to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  };

  const compositeAndDownload = async () => {
    if (!imageSrc) return;

    // If no frame, just download original
    if (frameStyle === 'none') {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `screenshot-${Date.now()}.png`;
      link.click();
      return;
    }

    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Frame Definitions (World Class Vector Styles)
    let padding = 0;
    let borderRadius = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const aspectRatio = img.width / img.height;

    const BEZEL_COLOR = '#111';
    const BORDER_COLOR = '#333';

    if (frameStyle === 'phone') {
      padding = Math.max(img.width, img.height) * 0.04; // 4% bezel
      borderRadius = Math.max(img.width, img.height) * 0.12; // Round corners
    } else if (frameStyle === 'tablet') {
      padding = Math.max(img.width, img.height) * 0.06; // Thicker bezel
      borderRadius = Math.max(img.width, img.height) * 0.05;
    }

    // Set Canvas Size
    canvas.width = img.width + (padding * 2);
    canvas.height = img.height + (padding * 2);

    // Draw Background (Transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Frame Body (Rounded Rect)
    ctx.fillStyle = BEZEL_COLOR;
    ctx.beginPath();
    // roundRect is newish, fallback to arc logic if needed but modern browsers support it.
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, canvas.width, canvas.height, borderRadius);
    } else {
      ctx.rect(0, 0, canvas.width, canvas.height); // Fallback
    }
    ctx.fill();

    // Draw Border stroke
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = padding * 0.15;
    ctx.stroke();

    // Draw Image
    ctx.drawImage(img, padding, padding, img.width, img.height);

    // Draw Camera Notch/Island (Phone only)
    if (frameStyle === 'phone') {
      ctx.fillStyle = '#000';
      // Dynamic Island style pill
      const pillW = canvas.width * 0.3;
      const pillH = padding * 0.8;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect((canvas.width / 2) - (pillW / 2), padding * 0.5, pillW, pillH, pillH / 2);
      } else {
        ctx.rect((canvas.width / 2) - (pillW / 2), padding * 0.5, pillW, pillH);
      }
      ctx.fill();
    }

    // Export
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabsnap-${frameStyle}-${Date.now()}.png`;
      link.click();
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
            <br /><span className="text-sm text-neutral-500">(WebUSB supported browsers only)</span>
          </p>
        </div>

        {/* Mode Toggle */}
        {adb && !recording && (
          <div className="flex flex-col md:flex-row gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setMode('screenshot')}
                className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${mode === 'screenshot' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
              >
                <Camera className="w-4 h-4" /> Screenshot
              </button>
              <button
                onClick={() => setMode('video')}
                className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${mode === 'video' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
              >
                <Video className="w-4 h-4" /> Screen Record
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={enableWireless}
                className="text-neutral-500 hover:text-indigo-400 text-sm font-medium flex items-center gap-2 px-4 py-2 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                title="Enable Wireless Debugging"
              >
                <Wifi className="w-4 h-4" /> Wireless
              </button>

              <button
                onClick={disconnectDevice}
                className="text-neutral-500 hover:text-red-400 text-sm font-medium flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
              >
                <LogOut className="w-4 h-4" /> Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Action Area */}
        <div className="relative group flex gap-4">
          {!adb ? (
            <button
              onClick={connectDevice}
              disabled={connecting}
              className="relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <Usb className="w-6 h-6" />
              {connecting ? 'Connecting...' : 'Connect Device'}
            </button>
          ) : (
            <div className="relative group">
              <div className={`absolute -inset-1 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 ${recording ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}></div>

              {mode === 'screenshot' ? (
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
              ) : (
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loading}
                  className={`relative px-8 py-4 font-bold rounded-full text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none ${recording ? 'bg-red-600 text-white' : 'bg-white text-neutral-950'}`}
                >
                  {loading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : recording ? (
                    <StopCircle className="w-6 h-6" />
                  ) : (
                    <Video className="w-6 h-6" />
                  )}
                  {loading ? 'Processing...' : recording ? 'Stop Recording' : 'Start Recording'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Preview Area */}
        {(imageSrc || videoSrc) && (
          <div className="w-full animate-in fade-in zoom-in duration-500 space-y-6">

            {/* Frame Selector (Only for Screenshots) */}
            {imageSrc && !videoSrc && (
              <div className="flex justify-center gap-2 mb-4 bg-neutral-900/80 p-1.5 rounded-full border border-white/5 backdrop-blur-md w-fit mx-auto">
                <button onClick={() => setFrameStyle('none')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${frameStyle === 'none' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}>
                  No Frame
                </button>
                <button onClick={() => setFrameStyle('phone')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${frameStyle === 'phone' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}>
                  Phone
                </button>
                <button onClick={() => setFrameStyle('tablet')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${frameStyle === 'tablet' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}>
                  Tablet
                </button>
              </div>
            )}

            <div className={`relative flex items-center justify-center p-8 min-h-[50vh] transition-all duration-500 ${frameStyle !== 'none' ? 'scale-95' : 'scale-100'}`}>
              {/* CSS Preview Layer */}
              <div
                className={`relative shadow-2xl transition-all duration-500 ease-spring ${frameStyle === 'none' ? '' :
                  frameStyle === 'phone' ? 'p-3 bg-neutral-900 rounded-[2.5rem] ring-4 ring-neutral-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]' :
                    'p-6 bg-neutral-800 rounded-[2rem] ring-4 ring-neutral-700 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]'
                  }`}
                style={{
                  boxShadow: frameStyle !== 'none' ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined
                }}
              >
                {/* Notch Simulation for CSS Preview */}
                {frameStyle === 'phone' && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[30%] h-7 bg-black rounded-full z-10 pointer-events-none shadow-sm"></div>
                )}

                {videoSrc ? (
                  <video
                    src={videoSrc}
                    controls
                    className={`max-w-full max-h-[60vh] object-contain ${frameStyle !== 'none' ? 'rounded-2xl' : 'rounded-lg shadow-lg'}`}
                    autoPlay
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageSrc!}
                    alt="Screenshot"
                    className={`max-w-full max-h-[60vh] object-contain ${frameStyle !== 'none' ? 'rounded-[1.8rem]' : 'rounded-lg shadow-lg'}`}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={videoSrc ? () => {
                  // Video download
                  const link = document.createElement('a');
                  link.href = videoSrc;
                  link.download = `screenrecord-${Date.now()}.mp4`;
                  link.click();
                } : compositeAndDownload}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-neutral-900 hover:bg-neutral-200 font-bold transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                {frameStyle === 'none' || videoSrc ? 'Save to Disk' : 'Save with Frame'}
              </button>

              {!videoSrc && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-medium transition-colors border border-white/5"
                >
                  <Copy className="w-5 h-5" />
                  Copy to Clipboard
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* SEO Content / FAQ */}
      <div className="max-w-4xl w-full mt-24 pt-12 border-t border-white/5 text-neutral-400 text-sm">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Frequently Asked Questions</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <article>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">How to take a screenshot of Android on PC?</h3>
            <p className="mb-4">
              TabSnap allows you to capture high-quality screenshots from your Android phone or tablet directly to your computer using your USB cable. It works using WebUSB technology, so you don't need to install any heavy software like Android Studio.
            </p>
          </article>

          <article>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">Is TabSnap safe to use?</h3>
            <p className="mb-4">
              Yes. TabSnap runs entirely in your browser (Client-Side). Your screen data goes directly from your USB cable to your Chrome/Edge browser. No data is sent to any external server or cloud.
            </p>
          </article>

          <article>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">Device in use error?</h3>
            <p className="mb-4">
              On Windows, other applications like <strong>Phone Link</strong> or <strong>Samsung DeX</strong> often fight for control. Also, <strong>you can only connect to one Browser Tab at a time</strong>. If you have TabSnap open in another tab (or localhost), you must click <strong>Disconnect</strong> or close that tab first!
            </p>
          </article>

          <article>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">Does it record Audio?</h3>
            <p className="mb-4">
              Currently, Android's `screenrecord` command only captures video (silent). We are working on a method to capture audio in a future update!
            </p>
          </article>
        </div>

        <div className="mt-12 text-center text-xs text-neutral-600">
          <p>TabSnap is a free online ADB Screenshot Tool. No sign-up required. Open Source.</p>
        </div>
      </div>

    </main>
  );
}

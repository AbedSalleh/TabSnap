'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Camera, Download, Copy, RefreshCw, Smartphone, AlertCircle, Usb, Video, StopCircle, Film, LogOut, Wifi, FileVideo, Cast } from 'lucide-react';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { AdbScrcpyClient, AdbScrcpyOptions2_4 } from '@yume-chan/adb-scrcpy';
import { ScrcpyVideoCodecId } from '@yume-chan/scrcpy';
import { WebCodecsVideoDecoder } from '@yume-chan/scrcpy-decoder-webcodecs';
import { Consumable, ReadableStream } from '@yume-chan/stream-extra';
import GIF from 'gif.js';

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
  const [converting, setConverting] = useState(false);

  // Mirroring State
  const [mirroring, setMirroring] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stopMirror, setStopMirror] = useState<(() => void) | null>(null);

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
    if (stopMirror) {
      stopMirror();
      setStopMirror(null);
    }
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
      setMirroring(false);
    }
  };

  const startMirroring = async () => {
    if (!adb) return;
    setLoading(true);
    setMode('video');
    setError(null);

    try {
      // 1. Read Server Binary
      const response = await fetch('./bin/scrcpy-server.jar');
      if (!response.ok) throw new Error("Failed to load scrcpy-server.jar");
      const serverBuffer = await response.arrayBuffer();

      // 2. Push Server
      await AdbScrcpyClient.pushServer(
        adb,
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Consumable(new Uint8Array(serverBuffer)));
            controller.close();
          }
        })
      );

      // 3. Start Client
      const client = await AdbScrcpyClient.start(
        adb,
        '/data/local/tmp/scrcpy-server.jar',
        // @ts-ignore
        new AdbScrcpyOptions2_4({
          audio: false,
          maxSize: 1024,
          videoBitRate: 4_000_000,
        })
      );

      // 4. Start Decoder
      const decoder = new WebCodecsVideoDecoder({
        codec: ScrcpyVideoCodecId.H264,
        // @ts-ignore
        renderer: (frame: any) => {
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              if (canvasRef.current.width !== frame.displayWidth || canvasRef.current.height !== frame.displayHeight) {
                canvasRef.current.width = frame.displayWidth;
                canvasRef.current.height = frame.displayHeight;
              }
              ctx.drawImage(frame, 0, 0);
              frame.close();
            } else {
              frame.close();
            }
          } else {
            frame.close();
          }
        }
      });

      // Start streaming
      if (client.videoStream) {
        const stream = await client.videoStream;
        // @ts-ignore
        stream.pipeTo(decoder.writable).catch(e => {
          console.error("Stream piping error", e);
        });
      }

      setMirroring(true);
      setStopMirror(() => async () => {
        await client.close();
        setMirroring(false);
      });

    } catch (e: any) {
      console.error(e);
      setError("Mirroring failed: " + e.message);
      setMirroring(false);
    } finally {
      setLoading(false);
    }
  };

  const stopMirroringAction = () => {
    if (stopMirror) stopMirror();
  };

  const takeScreenshot = async () => {
    if (!adb) return;
    setLoading(true);
    setError(null);
    try {
      const process = await adb.subprocess.noneProtocol.spawn('screencap -p');
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
      setVideoSrc(null);

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
      await adb.subprocess.noneProtocol.spawn('pkill -2 screenrecord');
      await new Promise(resolve => setTimeout(resolve, 1500));

      const sync = await adb.sync();
      const content = sync.read('/sdcard/tabsnap_rec.mp4');

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

      const blob = new Blob(chunks as any[], { type: 'video/mp4' });
      if (blob.size < 1024) throw new Error("Recording failed or file empty");

      setVideoSrc(URL.createObjectURL(blob));
      setRecording(false);

      await adb.subprocess.noneProtocol.spawn('rm /sdcard/tabsnap_rec.mp4');

    } catch (err: any) {
      console.error('Stop recording failed:', err);
      setError(err.message);
      setRecording(false);
    } finally {
      setLoading(false);
    }
  };

  const enableWireless = async () => {
    if (!adb) return;
    setLoading(true);
    setError(null);
    try {
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

      // @ts-ignore
      if (adb.tcpip) {
        // @ts-ignore
        await adb.tcpip.setPort(5555);
      } else {
        throw new Error("TCP/IP command not supported by this library version.");
      }

      setWirelessIp(ip);
      alert(`Wireless Enabled! 📡\n\n1. Unplug your USB cable.\n2. Run this on your PC (or new tab):\n\nadb connect ${ip}:5555`);

    } catch (err: any) {
      console.error('Wireless setup failed:', err);
      if (err.message && err.message.includes('Could not find')) {
        setError('Could not find IP. Make sure phone is on WiFi.');
      } else {
        setError('Wireless setup failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const convertToGif = async () => {
    if (!videoSrc) return;
    setConverting(true);
    setError(null);

    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: 'gif.worker.js',
        width: 360,
        height: 640
      });

      const video = document.createElement('video');
      video.src = videoSrc;
      video.muted = true;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = 0.3;
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      (gif as any).options.width = canvas.width;
      (gif as any).options.height = canvas.height;

      const fps = 10;
      const duration = video.duration;
      const interval = 1 / fps;

      video.pause();
      video.currentTime = 0;

      for (let t = 0; t < duration; t += interval) {
        video.currentTime = t;
        await new Promise(r => video.onseeked = r);
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          gif.addFrame(ctx, { copy: true, delay: interval * 1000 });
        }
      }

      gif.on('finished', (blob) => {
        setConverting(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tabsnap-gif-${Date.now()}.gif`;
        link.click();
      });

      gif.render();

    } catch (e: any) {
      console.error(e);
      setError("GIF Conversion Failed: " + e.message);
      setConverting(false);
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
      alert('Copied original screenshot to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  };

  const compositeAndDownload = async () => {
    if (!imageSrc) return;

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

    // Frame Definitions 
    let padding = 0;
    let borderRadius = 0;

    const BEZEL_COLOR = '#111';
    const BORDER_COLOR = '#333';

    if (frameStyle === 'phone') {
      padding = Math.max(img.width, img.height) * 0.04;
      borderRadius = Math.max(img.width, img.height) * 0.12;
    } else if (frameStyle === 'tablet') {
      padding = Math.max(img.width, img.height) * 0.06;
      borderRadius = Math.max(img.width, img.height) * 0.05;
    }

    canvas.width = img.width + (padding * 2);
    canvas.height = img.height + (padding * 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = BEZEL_COLOR;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, canvas.width, canvas.height, borderRadius);
    } else {
      ctx.rect(0, 0, canvas.width, canvas.height);
    }
    ctx.fill();

    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = padding * 0.15;
    ctx.stroke();

    ctx.drawImage(img, padding, padding, img.width, img.height);

    if (frameStyle === 'phone') {
      ctx.fillStyle = '#000';
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
        {adb && !recording && !mirroring && (
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
                onClick={async () => {
                  if (mirroring) {
                    stopMirroringAction();
                  } else {
                    await startMirroring();
                  }
                }}
                className={`text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${mirroring ? 'bg-indigo-600 text-white border-indigo-500' : 'text-neutral-500 hover:text-indigo-400 hover:bg-indigo-500/10 border-transparent hover:border-indigo-500/20'}`}
                title="Real-Time Mirror"
              >
                <Cast className="w-4 h-4" /> {mirroring ? 'Stop Mirror' : 'Mirror'}
              </button>

              {/* <button
                onClick={enableWireless}
                className="text-neutral-500 hover:text-indigo-400 text-sm font-medium flex items-center gap-2 px-4 py-2 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                title="Enable Wireless Debugging"
              >
                <Wifi className="w-4 h-4" /> Wireless
              </button> */}

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
            !mirroring && (
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
            )
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Mirroring Canvas */}
        {mirroring && (
          <div className="w-full flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="relative p-6 bg-neutral-800 rounded-[2rem] ring-4 ring-neutral-700 shadow-2xl">
              <canvas
                ref={canvasRef}
                className="rounded-2xl max-h-[70vh] w-auto shadow-lg"
              />
            </div>

            <button
              onClick={stopMirroringAction}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" /> Stop Mirroring
            </button>
          </div>
        )}

        {/* Preview Area (Screenshot/Recording) */}
        {!mirroring && (imageSrc || videoSrc) && (
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
              <div
                className={`relative shadow-2xl transition-all duration-500 ease-spring ${frameStyle === 'none' ? '' :
                  frameStyle === 'phone' ? 'p-3 bg-neutral-900 rounded-[2.5rem] ring-4 ring-neutral-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]' :
                    'p-6 bg-neutral-800 rounded-[2rem] ring-4 ring-neutral-700 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]'
                  }`}
                style={{
                  boxShadow: frameStyle !== 'none' ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined
                }}
              >
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

            <div className="flex justify-center gap-4 flex-wrap">
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

              {videoSrc && (
                <button
                  onClick={convertToGif}
                  disabled={converting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors border border-white/5 shadow-lg"
                >
                  {converting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileVideo className="w-5 h-5" />}
                  {converting ? 'Converting...' : 'Save as GIF'}
                </button>
              )}

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

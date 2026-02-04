# TabSnap - WebUSB Screenshot Tool

A serverless, browser-based tool to capture screenshots from your Android device using **WebUSB**.

![Screenshot Preview](./public/preview.png)

## 🚀 How it Works
This version uses **WebUSB** to communicate directly from your browser (Chrome/Edge) to your Android device. 
**No backend server is required.** This means you can host this website anywhere (GitHub Pages, Vercel, Netlify) and it will work!

## ✨ Features
- **Instant Screenshots**: Capture high-resolution screenshots directly to your device.
- **Screen Recording**: Record seamless video of your Android screen.
- **Real-Time Mirroring**: View and control your Android screen in your browser with low latency.
- **GIF Maker**: Convert your screen recordings into shareable GIFs locally.
- **Device Frames**: Wrap your screenshots in realistic phone/tablet frames.
- **Wireless Mode**: Instructions for enabling ADB over Wi-Fi.
- **100% Client-Side**: No data leaves your device. Everything is processed locally in your browser.

## 🛠️ Prerequisites
1.  **Supported Browser**: Chrome, Edge, or Opera (WebUSB support).
2.  **ADB Drivers**: 
    -   **Windows**: You might need to install the **WinUSB** driver for your device using [Zadig](https://zadig.akeo.ie/) if the standard driver doesn't work with WebUSB.
    -   **macOS/Linux**: Usually works out of the box (Linux needs udev rules).
3.  **USB Debugging**: Enabled on your Android device.

## 🏃‍♂️ Development
```bash
npm install
npm run dev
```

## 🔧 Troubleshooting
- **"Access Denied"**: Ensure no other ADB process (like Android Studio or standard `adb.exe`) is holding the connection. detailed instructions [here](https://github.com/yume-chan/ya-webadb).

## 📄 License
MIT

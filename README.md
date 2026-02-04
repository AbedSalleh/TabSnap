# TabSnap - WebUSB Screenshot Tool

A serverless, browser-based tool to capture screenshots from your Android device using **WebUSB**.

![Screenshot Preview](./public/preview.png)

## 🚀 How it Works
This version uses **WebUSB** to communicate directly from your browser (Chrome/Edge) to your Android device. 
**No backend server is required.** This means you can host this website anywhere (GitHub Pages, Vercel, Netlify) and it will work!

## ✨ Features
- **Zero Install**: Just open the URL.
- **Client-Side Only**: Your data never leaves your browser.
- **Instant Capture**: Uses `adb exec-out` for fast binary transfer.

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

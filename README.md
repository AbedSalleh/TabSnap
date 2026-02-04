# TabSnap - USB Screenshot Tool

A modern, local web application to capture high-quality screenshots from your Android device via USB. Built with Next.js and ADB.

![Screenshot Preview](./public/preview.png)

## 🚀 Why Local?
This tool communicates directly with your Android device via USB using `adb` (Android Debug Bridge). Because browsers generally cannot run system-level binary commands like `adb.exe` directly for security reasons, **this app must be run locally on your computer** to bridge the connection. It cannot be hosted as a static page (e.g., GitHub Pages) while retaining standard ADB functionality.

## ✨ Features
- **Instant Capture**: One-click screenshot from USB-connected device.
- **Clipboard Integration**: Copy images directly to clipboard.
- **Binary Safe**: Handles data properly to ensure no image corruption.
- **Modern UI**: Dark mode, glassmorphism, and smooth animations.

## 🛠️ Prerequisites
1.  **Node.js**: [Download & Install](https://nodejs.org/)
2.  **ADB Drivers**: Ensure your device drivers are installed.
3.  **USB Debugging**: Enabled on your Android device (Developer Options).

## 🏃‍♂️ How to Run "Anytime"
Since this is a local tool, you can run it whenever you need it:

1.  **Clone this repo**:
    ```bash
    git clone https://github.com/YourUsername/TabSnap.git
    cd TabSnap
    ```

2.  **Install Dependencies** (First time only):
    ```bash
    npm install
    ```

3.  **Start the App**:
    ```bash
    npm run dev
    ```

4.  **Open**: [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration
The app attempts to locate `adb.exe` automatically. If it fails, check `lib/adb.ts` or ensure `adb` is in your system PATH.

## 📄 License
MIT

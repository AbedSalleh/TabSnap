import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function takeScreenshot(): Promise<Buffer> {
  try {
    // -p flag meant PNG output in older versions, but typically screencap writes binary to stdout.
    // However, exec captures stdout as a string by default unless encoding is specified.
    // We need to handle binary data.
    // Using simple exec with encoding 'buffer' is better.
    // Use absolute path to ADB since it's not in the system PATH for this session
    // Path found at: C:/Users/jabba/AppData/Local/Android/Sdk/platform-tools/adb.exe
    const adbPath = String.raw`C:\Users\jabba\AppData\Local\Android\Sdk\platform-tools\adb.exe`;

    return new Promise((resolve, reject) => {
      // exec-out is safer for binary data on Windows as it avoids shell EOL conversion
      exec(`"${adbPath}" exec-out screencap -p`, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          console.error('ADB Error:', error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Screenshot failed:', error);
    throw error;
  }
}

import { NextResponse } from 'next/server';
import { takeScreenshot } from '@/lib/adb';

export async function GET() {
    try {
        const screenshotBuffer = await takeScreenshot();

        const blob = new Blob([screenshotBuffer as any]);
        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error: any) {
        console.error('SERVER SIDE ERROR:', error);
        console.error('STDERR:', error.stderr);
        return NextResponse.json(
            {
                error: 'Failed to take screenshot',
                details: error.message || String(error),
                suggestion: 'Check server console for ADB output'
            },
            { status: 500 }
        );
    }
}

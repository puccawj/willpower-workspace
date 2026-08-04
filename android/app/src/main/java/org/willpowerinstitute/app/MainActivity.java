package org.willpowerinstitute.app;

import android.graphics.Rect;
import android.view.View;
import android.view.ViewTreeObserver;
import com.getcapacitor.BridgeActivity;

// Every modern Android keyboard-visibility API failed on the actual test device (a Samsung
// Galaxy Note 9 on Android 10 / API 29, with a known-quirky One UI insets implementation):
// WindowInsetsAnimationCompat (used by @capacitor/keyboard's keyboardWillShow/Hide events)
// requires API 30+ and never fires here; android:windowSoftInputMode="adjustResize" was found
// (via live Chrome DevTools inspection of the running WebView) to report a bogus, far-too-small
// viewport size once the keyboard opened; and even @capacitor/keyboard's own pre-API-30 fallback
// (resizeOnFullScreen, driven by OnApplyWindowInsetsListener) measurably never resized the
// WebView's viewport on this device either. Every one of those relies on some inset-dispatch
// mechanism that this specific OS/OEM combination doesn't deliver reliably.
//
// getWindowVisibleDisplayFrame() + ViewTreeObserver.OnGlobalLayoutListener is the old (~2012-era)
// technique that predates all of the above and works on literally any API level, because it
// doesn't depend on any inset-dispatch callback at all — it just re-measures the actually-visible
// screen area on every layout pass and compares it to the previous measurement.
public class MainActivity extends BridgeActivity {

    private int lastKeyboardHeightPx = -1;

    @Override
    public void onStart() {
        super.onStart();

        final View rootView = getWindow().getDecorView().findViewById(android.R.id.content);
        rootView
            .getViewTreeObserver()
            .addOnGlobalLayoutListener(
                () -> {
                    Rect visibleFrame = new Rect();
                    rootView.getWindowVisibleDisplayFrame(visibleFrame);
                    int screenHeight = rootView.getRootView().getHeight();
                    int keyboardHeightPx = screenHeight - visibleFrame.bottom;

                    // Ignore small fluctuations (status/nav bar visibility toggles, etc.) — a
                    // real keyboard takes a meaningful fraction of the screen.
                    boolean visible = keyboardHeightPx > screenHeight * 0.15;
                    int reportedHeightPx = visible ? keyboardHeightPx : 0;

                    if (reportedHeightPx == lastKeyboardHeightPx) return;
                    lastKeyboardHeightPx = reportedHeightPx;

                    float density = getResources().getDisplayMetrics().density;
                    int heightDp = Math.round(reportedHeightPx / density);

                    if (getBridge() != null) {
                        String data = "{keyboardHeight:" + heightDp + ",visible:" + visible + "}";
                        getBridge().triggerWindowJSEvent("nativeKeyboardHeightChange", data);
                    }
                }
            );
    }
}

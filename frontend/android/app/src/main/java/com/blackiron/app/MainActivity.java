package com.blackiron.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

// 앱은 화면을 안에 싣지 않고 서버 주소를 연다 (capacitor.config.ts).
// 그래서 서버에 못 닿으면 두 가지가 보였다 (2026-09-15, 폰에서 본 것):
//
// - **검은 화면** — 연결을 기다리는 동안. 크롬은 시간 초과까지 30초 넘게 기다린다
// - **「웹페이지를 사용할 수 없음」** — 크롬 기본 에러 화면. 뭘 하라는 말이 없다
//
// 기다리는 동안은 로고 첫 화면을 붙잡아 두고, 15초 안에 안 열리면 우리 에러 화면
// (`public/app-offline.html`, config 의 errorPath)으로 넘긴다. 바로 실패하는 경우
// (주소 없음 · 거절)는 Capacitor 가 알아서 errorPath 로 보낸다.
//
// 15초인 이유: Render 무료 서버는 자다가 깨는 데 수십 초 걸린다. 너무 짧으면 멀쩡한
// 서버를 「연결 안 됨」이라고 한다. 에러 화면이 다시 시도를 하므로 거기서 이어진다.
public class MainActivity extends BridgeActivity {

    private static final long LOAD_TIMEOUT_MS = 15000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean firstLoadDone = false;
    private boolean waiting = false;

    private final Runnable giveUp = () -> {
        if (waiting) showErrorPage();
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> !firstLoadDone);

        if (bridge == null) {
            firstLoadDone = true;
            return;
        }

        bridge.getWebView().addJavascriptInterface(new AppBridge(), "BlackIronApp");
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                settle();
            }
        });
        startWaiting();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(giveUp);
        super.onDestroy();
    }

    private void startWaiting() {
        waiting = true;
        handler.removeCallbacks(giveUp);
        handler.postDelayed(giveUp, LOAD_TIMEOUT_MS);
    }

    private void settle() {
        waiting = false;
        firstLoadDone = true;
        handler.removeCallbacks(giveUp);
    }

    private void showErrorPage() {
        settle();
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null) return;
        WebView webView = bridge.getWebView();
        webView.stopLoading();
        webView.loadUrl(errorUrl);
    }

    // 에러 화면에서 부른다. 에러 화면에는 Capacitor 플러그인이 안 붙어서 따로 연다
    private class AppBridge {

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> {
                startWaiting();
                bridge.getWebView().loadUrl(bridge.getAppUrl());
            });
        }

        @JavascriptInterface
        public String serverUrl() {
            return bridge.getServerUrl();
        }
    }
}

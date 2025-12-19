package com.hasan.lumoapp;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Edge-to-edge modunu etkinleştir
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Status bar'ı transparan yap
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        
        // Inset değerlerini hesapla ve WebView'e gönder
        View decorView = getWindow().getDecorView();
        decorView.setOnApplyWindowInsetsListener((v, insets) -> {
            // Native WindowInsets nesnesini Compat nesnesine çeviriyoruz
            WindowInsetsCompat windowInsetsCompat = WindowInsetsCompat.toWindowInsetsCompat(insets, v);
            
            // Insetleri al (androidx.core.graphics.Insets döner)
            Insets systemBars = windowInsetsCompat.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets displayCutout = windowInsetsCompat.getInsets(WindowInsetsCompat.Type.displayCutout());
            
            // En büyük değerleri al (Safe Area)
            int top = Math.max(systemBars.top, displayCutout.top);
            int bottom = Math.max(systemBars.bottom, displayCutout.bottom);
            int left = systemBars.left;
            int right = systemBars.right;
            
            // Değerleri DP olarak hesapla ve JS'e gönder
            float density = getResources().getDisplayMetrics().density;
            bridge.getWebView().post(() -> {
                String js = String.format(
                    "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');",
                    (int)(top / density),
                    (int)(bottom / density),
                    (int)(left / density),
                    (int)(right / density)
                );
                bridge.getWebView().evaluateJavascript(js, null);
            });
            
            return insets;
        });
    }
}

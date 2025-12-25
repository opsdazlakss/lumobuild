package com.hasan.lumoapp;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import android.Manifest;
import android.content.pm.PackageManager;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Edge-to-edge modunu etkinleştir
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Status bar'ı transparan yap
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        
        // Setup WebChromeClient to handle WebView permission requests (camera, microphone)
        bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    // Check if we have the Android permissions first
                    String[] resources = request.getResources();
                    List<String> requiredPermissions = new ArrayList<>();
                    
                    for (String resource : resources) {
                        if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) 
                                    != PackageManager.PERMISSION_GRANTED) {
                                requiredPermissions.add(Manifest.permission.CAMERA);
                            }
                        }
                        if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) 
                                    != PackageManager.PERMISSION_GRANTED) {
                                requiredPermissions.add(Manifest.permission.RECORD_AUDIO);
                            }
                        }
                    }
                    
                    if (requiredPermissions.isEmpty()) {
                        // All permissions granted, allow WebView access
                        request.grant(request.getResources());
                    } else {
                        // Need to request permissions first
                        pendingPermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this, 
                            requiredPermissions.toArray(new String[0]), 
                            PERMISSION_REQUEST_CODE);
                    }
                });
            }
        });
        
        // Request all permissions on app startup
        requestAllPermissions();
        
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
    
    private void requestAllPermissions() {
        List<String> permissionsToRequest = new ArrayList<>();
        
        // Camera
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) 
                != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA);
        }
        
        // Microphone
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
        }
        
        // Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            // Media permissions for Android 13+
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
        } else {
            // Storage permissions for older Android versions
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        
        if (!permissionsToRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, 
                permissionsToRequest.toArray(new String[0]), 
                PERMISSION_REQUEST_CODE);
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            // If there's a pending WebView permission request, handle it
            if (pendingPermissionRequest != null) {
                boolean allGranted = true;
                for (int result : grantResults) {
                    if (result != PackageManager.PERMISSION_GRANTED) {
                        allGranted = false;
                        break;
                    }
                }
                
                if (allGranted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
        }
    }
}

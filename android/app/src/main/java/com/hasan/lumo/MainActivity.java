package com.hasan.lumo;

import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // FCM Token al
        getFCMToken();
    }

    private void getFCMToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.e(TAG, "Token alınamadı", task.getException());
                    Toast.makeText(this, "FCM Token alınamadı!", Toast.LENGTH_SHORT).show();
                    return;
                }

                String token = task.getResult();
                Log.d(TAG, "FCM Token: " + token);
                Toast.makeText(this, "FCM aktif! Token: " + token.substring(0, 20) + "...", Toast.LENGTH_LONG).show();
            });
    }
}
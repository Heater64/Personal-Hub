package com.heater64.personalhub;

import android.os.Bundle;
import android.content.Intent;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: refresca el widget de la distancia en cuanto la web
        // guarda un valor nuevo. Hay que registrarlo ANTES de super.onCreate.
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(DeviceStatusPlugin.class);

        super.onCreate(savedInstanceState);

        // Desde targetSdk 35 (Android 15) el sistema obliga a dibujar de borde
        // a borde: el WebView queda debajo de la barra de estado y del notch.
        // El CSS usa env(safe-area-inset-*), pero el WebView de Android no
        // rellena esos valores, así que el hueco se reserva aquí con los
        // insets reales del sistema (barras + recorte de pantalla).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Wait until the tapped activity is visibly in the foreground. This
        // lets Android grant while-in-use location access to the refresh FGS.
        handleLocationRefreshIntent(getIntent());
    }

    private void handleLocationRefreshIntent(Intent intent) {
        if (intent == null || !DeviceStatusService.ACTION_USER_LOCATION_REFRESH.equals(intent.getAction())) return;
        intent.setAction(null);
        DeviceStatusService.requestLocationUpdateFromUser(this);
    }
}

package com.heater64.personalhub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Al reiniciar el móvil, Android olvida los servicios: si el seguimiento
 * estaba activo, se vuelve a solicitar cuando el sistema puede conceder ubicación.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!DeviceStatusService.isEnabled(context)) return;
        // Un BOOT_COMPLETED llega con la aplicación en segundo plano. Android
        // rechaza un FGS de ubicación si no existe el permiso «permitir
        // siempre»; esperar a que el usuario abra la app es más honesto que
        // fingir que el seguimiento continúa.
        if (!DeviceStatusService.hasBackgroundLocationPermission(context)) return;
        DeviceStatusService.start(context, null);
    }
}

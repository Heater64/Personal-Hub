package com.heater64.personalhub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Al reiniciar el móvil, Android olvida los servicios: si el seguimiento
 * estaba activo, se vuelve a arrancar. La ubicación solo se actualiza cuando
 * el sistema lo permite; batería y red siguen enviándose igual.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!DeviceStatusService.isEnabled(context)) return;
        DeviceStatusService.start(context);
    }
}

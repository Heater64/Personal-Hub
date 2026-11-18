package com.heater64.personalhub;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/**
 * Puente del seguimiento del móvil.
 *
 * `start` guarda la sesión y las credenciales y arranca el servicio en primer
 * plano; `stop` lo apaga; `status` cuenta al panel qué permisos hay, si el
 * servicio está activo y el último estado enviado. Sin este puente la web no
 * tendría forma de saber si el seguimiento sigue vivo.
 */
// `permissions` declara el alias que usa `requestNotifications`: Capacitor
// necesita saber qué permisos pide cada alias para poder lanzar el diálogo
// del sistema desde el hilo de la actividad.
@CapacitorPlugin(
        name = "DeviceStatus",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        })
public class DeviceStatusPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = DeviceStatusService.prefs(context);

        Long expiresAt = call.getLong("expiresAt", 0L);
        prefs.edit()
                .putString("url", trimUrl(call.getString("url", "")))
                .putString("anonKey", call.getString("anonKey", ""))
                .putString("accessToken", call.getString("accessToken", ""))
                .putString("refreshToken", call.getString("refreshToken", ""))
                .putLong("expiresAt", expiresAt == null ? 0L : expiresAt)
                .putString("user_id", call.getString("userId", ""))
                .putBoolean("is_admin", Boolean.TRUE.equals(call.getBoolean("isAdmin", false)))
                .putString("name", call.getString("name", ""))
                .putString("avatar", call.getString("avatar", ""))
                .putBoolean("enabled", true)
                .apply();

        DeviceStatusService.start(context);

        JSObject out = new JSObject();
        out.put("enabled", true);
        call.resolve(out);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        // Se borra también la sesión guardada: al cerrar sesión (o apagar el
        // seguimiento) el servicio no debe poder resucitarla al arrancar.
        DeviceStatusService.prefs(context)
                .edit()
                .putBoolean("enabled", false)
                .remove("accessToken")
                .remove("refreshToken")
                .remove("expiresAt")
                .remove("user_id")
                .remove("is_admin")
                .apply();
        DeviceStatusService.stop(context);
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = DeviceStatusService.prefs(context);

        JSObject out = new JSObject();
        out.put("enabled", prefs.getBoolean("enabled", false));
        out.put("location", permissionState(context, Manifest.permission.ACCESS_FINE_LOCATION));
        out.put("background", backgroundPermissionState(context));
        out.put("notifications", notificationPermissionState(context));
        out.put("batteryUnrestricted", batteryUnrestricted(context));
        out.put("lastAt", prefs.getString("last_at", ""));

        // La sesión que usa el servicio. El servicio renueva el token cuando
        // caduca y la web adopta el más reciente al abrir: así las dos partes
        // comparten un refresh token válido en vez de pisarse.
        JSObject session = new JSObject();
        session.put("accessToken", prefs.getString("accessToken", ""));
        session.put("refreshToken", prefs.getString("refreshToken", ""));
        session.put("expiresAt", prefs.getLong("expiresAt", 0L));
        session.put("userId", prefs.getString("user_id", ""));
        out.put("session", session);

        try {
            String raw = prefs.getString("last_data", "");
            out.put("data", raw.isEmpty() ? new JSONObject() : new JSONObject(raw));
        } catch (Exception ignored) {
            out.put("data", new JSONObject());
        }

        call.resolve(out);
    }

    /**
     * Pide el permiso de avisos (Android 13+). Sin él, el aviso fijo del
     * seguimiento no se ve: el servicio sigue, pero nadie sabría que está ahí.
     */
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if ("granted".equals(notificationPermissionState(getContext()))) {
            resolveNotifications(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsCallback");
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        resolveNotifications(call);
    }

    private void resolveNotifications(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", "granted".equals(notificationPermissionState(getContext())));
        call.resolve(out);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception err) {
            call.reject("No se pudieron abrir los ajustes");
        }
    }

    /* ==========================================
       PERMISOS
       ========================================== */

    private static String permissionState(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
                ? "granted"
                : "denied";
    }

    private String backgroundPermissionState(Context context) {
        // Antes de Android 10 no existía el permiso de ubicación en segundo
        // plano: con el de primer plano el servicio ya podía seguir.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "granted";
        return permissionState(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION);
    }

    private String notificationPermissionState(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        return permissionState(context, Manifest.permission.POST_NOTIFICATIONS);
    }

    private boolean batteryUnrestricted(Context context) {
        try {
            PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            return power != null && power.isIgnoringBatteryOptimizations(context.getPackageName());
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String trimUrl(String raw) {
        String value = raw == null ? "" : raw.trim();
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }
}

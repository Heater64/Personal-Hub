package com.heater64.personalhub;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class WidgetMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if ("widget_sync".equals(message.getData().get("type"))) {
            WidgetSync.request(this);
            return;
        }
        super.onMessageReceived(message);
    }

    @Override
    public void onDeletedMessages() {
        WidgetSync.request(this);
        super.onDeletedMessages();
    }
}

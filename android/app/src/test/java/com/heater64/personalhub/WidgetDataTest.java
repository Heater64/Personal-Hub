package com.heater64.personalhub;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;

@RunWith(RobolectricTestRunner.class)
public class WidgetDataTest {
    private static final String ENDPOINT = "https://hub.example/widget";
    private static final String DISTANCE = "widget_distance";
    private static final String MOOD = "widget_mood";
    private static final String GIFTS = "widget_gifts";
    private Context context;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        WidgetData.clear(context);
        WidgetData.setAccount(context, "first-user");
        assertTrue(WidgetData.configure(context, ENDPOINT, "first-token", "first-user"));
    }

    @Test
    public void delayedResponseFromPriorAccountCannotChangeNewAccount() throws Exception {
        assertTrue(WidgetData.writeLocal(context, DISTANCE, "{\"text\":\"5 km\"}", "first-user"));
        WidgetData.Snapshot delayed = WidgetData.snapshot(context, Collections.singleton(DISTANCE));

        WidgetData.setAccount(context, "second-user");
        assertNull(WidgetData.read(context, DISTANCE));
        assertFalse(WidgetData.configure(context, ENDPOINT, "old-token", "first-user"));
        assertFalse(WidgetData.writeLocal(context, DISTANCE, "{}", "first-user"));
        assertTrue(WidgetData.configure(context, ENDPOINT, "second-token", "second-user"));
        assertTrue(WidgetData.apply(context, delayed, new JSONObject().put(DISTANCE, new JSONObject())).isEmpty());
        assertFalse(WidgetData.revoke(context, delayed));
        assertTrue(WidgetData.isConfigured(context));
        assertNull(WidgetData.read(context, DISTANCE));
    }

    @Test
    public void snapshotPreservesConcurrentWritesAndOnlyClearsExplicitNull() throws Exception {
        WidgetData.writeLocal(context, DISTANCE, "{\"text\":\"5 km\"}", "first-user");
        WidgetData.writeLocal(context, MOOD, "{}", "first-user");
        WidgetData.Snapshot delayed = WidgetData.snapshot(context, new HashSet<>(Arrays.asList(DISTANCE, MOOD)));

        WidgetData.writeLocal(context, DISTANCE, "{\"text\":\"2 km\"}", "first-user");
        JSONObject older = new JSONObject().put(DISTANCE, new JSONObject().put("text", "5 km"));
        assertTrue(WidgetData.apply(context, delayed, older).isEmpty());
        assertEquals("{\"text\":\"2 km\"}", WidgetData.read(context, DISTANCE));
        assertEquals("{}", WidgetData.read(context, MOOD));

        older.put(MOOD, JSONObject.NULL);
        assertEquals(Collections.singleton(MOOD), WidgetData.apply(context, delayed, older));
        assertNull(WidgetData.read(context, MOOD));
    }

    @Test
    public void logoutRemovesDataAndPreventsDelayedWrites() {
        WidgetData.writeLocal(context, MOOD, "{}", "first-user");
        WidgetData.clear(context);

        assertFalse(WidgetData.isConfigured(context));
        assertNull(WidgetData.read(context, MOOD));
        assertFalse(WidgetData.writeLocal(context, MOOD, "{}", "first-user"));
    }

    @Test
    public void remoteGiftsPreserveOpenIdsWhenTheCalendarDayChanges() throws Exception {
        String today = WidgetSupport.todayISO();
        JSONObject local = new JSONObject().put("date", "2025-07-03")
                .put("openedIds", new JSONArray(Collections.singletonList("opened-id")));
        WidgetData.writeLocal(context, GIFTS, local.toString(), "first-user");
        WidgetData.Snapshot snapshot = WidgetData.snapshot(context, Collections.singleton(GIFTS));
        JSONObject remote = new JSONObject().put("date", today)
                .put("giftIds", new JSONArray(Arrays.asList("opened-id", "new-id", "new-id")));
        assertEquals(Collections.singleton(GIFTS), WidgetData.apply(context, snapshot,
                new JSONObject().put(GIFTS, remote)));

        JSONObject result = new JSONObject(WidgetData.read(context, GIFTS));
        assertEquals(today, result.getString("date"));
        assertEquals(2, result.getInt("total"));
        assertEquals(1, result.getInt("pending"));
        assertEquals("opened-id", result.getJSONArray("openedIds").getString(0));
    }
}

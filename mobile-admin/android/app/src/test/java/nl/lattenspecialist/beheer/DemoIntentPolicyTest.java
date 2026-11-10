package nl.lattenspecialist.beheer;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public final class DemoIntentPolicyTest {
    private static Set<String> keys(String... names) { return new HashSet<>(Arrays.asList(names)); }
    private static String target(String command, String material) {
        return DemoIntentPolicy.destination(DemoIntentPolicy.ACTION_OPEN, null,
            material == null ? Collections.singleton(DemoIntentPolicy.EXTRA_QUICK_ACTION)
                : keys(DemoIntentPolicy.EXTRA_QUICK_ACTION, DemoIntentPolicy.EXTRA_MATERIAL), command, material);
    }
    private static void rejects(Runnable operation) {
        try { operation.run(); fail("Unsafe demo command accepted"); }
        catch (IllegalArgumentException expected) { }
    }
    @Test public void normalEntryHasFixedDemoOrigin() {
        assertEquals(DemoOriginPolicy.ORIGIN, DemoIntentPolicy.destination(null, null, null, null, null));
        assertEquals(DemoOriginPolicy.ORIGIN, DemoIntentPolicy.destination(DemoIntentPolicy.ACTION_OPEN, null, null, null, null));
    }
    @Test public void quickRequestsHaveOnlyFixedQueryValues() {
        assertEquals(DemoOriginPolicy.ORIGIN + "?demoAction=new-request", target("new-request", null));
        assertEquals(DemoOriginPolicy.ORIGIN + "?demoAction=new-request&demoMaterial=Ski", target("new-request", "Ski"));
        assertEquals(DemoOriginPolicy.ORIGIN + "?demoAction=new-request&demoMaterial=Snowboard", target("new-request", "Snowboard"));
    }
    @Test public void commandsRejectCaseChangesAndUserData() {
        for (String value : new String[]{"", "NEW-REQUEST", "new-request&admin=true", "javascript:alert(1)", "https://lattenspecialist.nl/", "new-request%26demoAction=other", "new-request#x", "new-request\n"})
            rejects(() -> target(value, null));
    }
    @Test public void materialRejectsDuplicatesAndInjection() {
        for (String value : new String[]{"", "ski", "Snowboard&demoMaterial=Ski", "Ski&demoAction=new-request", "Ski%26x=y", "<script>", "../Ski", "Ski\n"})
            rejects(() -> target("new-request", value));
    }
    @Test public void everyDataUriIsRejectedIncludingSameOriginAndDuplicateQueries() {
        for (String uri : new String[]{DemoOriginPolicy.ORIGIN, DemoOriginPolicy.ORIGIN + "?demoAction=new-request&demoAction=new-request", "https://lattenspecialist.nl/", "content://private/file", "file:///data/private", "intent://open", "javascript:alert(1)"})
            rejects(() -> DemoIntentPolicy.destination(DemoIntentPolicy.ACTION_OPEN, uri, null, null, null));
    }
    @Test public void foreignActionsAndUnknownExtrasAreRejected() {
        for (String action : new String[]{"android.intent.action.VIEW", "android.intent.action.MAIN", "nl.lattenspecialist.beheer.OPEN", ""})
            rejects(() -> DemoIntentPolicy.destination(action, null, null, null, null));
        for (String key : new String[]{"url", "origin", "token", "admin_token", "quick_material", "javascript", "demoAction", "demo_quick_action[]"})
            rejects(() -> DemoIntentPolicy.destination(DemoIntentPolicy.ACTION_OPEN, null, keys(key), null, null));
    }
    @Test public void quickActionRequiresExplicitDemoAction() {
        rejects(() -> DemoIntentPolicy.destination(null, null, keys(DemoIntentPolicy.EXTRA_QUICK_ACTION), "new-request", null));
        rejects(() -> target(null, "Ski"));
    }
    @Test public void noPermissionRequestOrPostWithoutExplicitTap() {
        for (int sdk : new int[]{23, 28, 32, 33, 36}) for (boolean permitted : new boolean[]{true, false})
            assertEquals(DemoNotificationPolicy.Decision.NONE, DemoNotificationPolicy.decide(sdk, permitted, false));
    }
    @Test public void deniedAndroid13PermissionRequestsOnlyOnTap() {
        assertEquals(DemoNotificationPolicy.Decision.REQUEST_PERMISSION, DemoNotificationPolicy.decide(33, false, true));
        assertEquals(DemoNotificationPolicy.Decision.REQUEST_PERMISSION, DemoNotificationPolicy.decide(36, false, true));
        assertTrue(DemoNotificationPolicy.DENIED.contains("De fictieve demo blijft beschikbaar"));
    }
    @Test public void permittedOrOlderAndroidCanPostExplicitFictionalNotification() {
        assertEquals(DemoNotificationPolicy.Decision.POST_NOTIFICATION, DemoNotificationPolicy.decide(32, false, true));
        assertEquals(DemoNotificationPolicy.Decision.POST_NOTIFICATION, DemoNotificationPolicy.decide(36, true, true));
        assertNotEquals("maintenance_requests", DemoNotificationPolicy.CHANNEL);
        assertNotEquals(410, DemoNotificationPolicy.NOTIFICATION_ID);
        assertNotEquals(410, DemoNotificationPolicy.PERMISSION_REQUEST_ID);
    }
}

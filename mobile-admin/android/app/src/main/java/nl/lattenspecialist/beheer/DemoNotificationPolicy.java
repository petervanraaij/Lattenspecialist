package nl.lattenspecialist.beheer;

/** Pure permission decision used by the explicit demo button, not a background worker. */
public final class DemoNotificationPolicy {
    public static final String CHANNEL = "lattenspecialist_explicit_demo_notifications";
    public static final int NOTIFICATION_ID = 17417;
    public static final int PERMISSION_REQUEST_ID = 17418;
    public static final String DENIED = "Geen melding verstuurd: toestemming geweigerd. De fictieve demo blijft beschikbaar.";
    public enum Decision { NONE, REQUEST_PERMISSION, POST_NOTIFICATION }
    private DemoNotificationPolicy() {}
    public static Decision decide(int sdk, boolean permitted, boolean userTapped) {
        if (!userTapped) return Decision.NONE;
        return sdk >= 33 && !permitted ? Decision.REQUEST_PERMISSION : Decision.POST_NOTIFICATION;
    }
}

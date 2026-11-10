package nl.lattenspecialist.beheer;

import java.util.Collections;
import java.util.Set;

/** Intent values are commands, never URLs, credentials, customer data or script. */
public final class DemoIntentPolicy {
    public static final String ACTION_OPEN = "nl.lattenspecialist.beheer.demo.OPEN";
    public static final String EXTRA_QUICK_ACTION = "demo_quick_action";
    public static final String EXTRA_MATERIAL = "demo_material";
    private DemoIntentPolicy() {}

    public static String destination(String action, String data, Set<String> keys, String quickAction, String material) {
        Set<String> extras = keys == null ? Collections.emptySet() : keys;
        if (data != null) throw new IllegalArgumentException("Demo intents cannot carry a URL.");
        for (String key : extras) if (!EXTRA_QUICK_ACTION.equals(key) && !EXTRA_MATERIAL.equals(key))
            throw new IllegalArgumentException("Unexpected demo intent extra.");
        if (action == null && extras.isEmpty() && quickAction == null && material == null)
            return DemoOriginPolicy.validateOrigin(DemoOriginPolicy.ORIGIN);
        if (!ACTION_OPEN.equals(action)) throw new IllegalArgumentException("Unexpected demo intent action.");
        if (quickAction == null && material == null) return DemoOriginPolicy.validateOrigin(DemoOriginPolicy.ORIGIN);
        if (!"new-request".equals(quickAction)) throw new IllegalArgumentException("Unknown demo command.");
        if (material != null && !"Ski".equals(material) && !"Snowboard".equals(material))
            throw new IllegalArgumentException("Unknown synthetic material.");
        return DemoOriginPolicy.validateOrigin(DemoOriginPolicy.ORIGIN) + "?demoAction=new-request"
            + (material == null ? "" : "&demoMaterial=" + material);
    }
}

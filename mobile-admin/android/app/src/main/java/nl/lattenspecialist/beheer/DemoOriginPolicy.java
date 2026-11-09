package nl.lattenspecialist.beheer;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Fixed, separate synthetic demo origin. No production fallback or server picker. */
public final class DemoOriginPolicy {
    public static final String ORIGIN = "https://lattenspecialist-admin-review.stuiterbaas-456655a6.workers.dev/";
    private DemoOriginPolicy() {}

    public static String validateOrigin(String value) {
        URI uri = parse(value);
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        String path = uri.getRawPath();
        if (!"https".equalsIgnoreCase(uri.getScheme())
            || (uri.getPort() != -1 && uri.getPort() != 443)
            || uri.getRawQuery() != null || uri.getRawFragment() != null
            || (path != null && !path.isEmpty() && !"/".equals(path))
            || !host.matches("[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?")
            || !java.util.regex.Pattern.compile("(?:^|[.-])(?:demo|review)(?:[.-]|$)").matcher(host).find()) {
            throw new IllegalArgumentException("A dedicated HTTPS demo/review origin is required.");
        }
        return "https://" + host + "/";
    }

    public static boolean allows(String candidate) { return allows(ORIGIN, candidate); }

    public static boolean allows(String origin, String candidate) {
        try {
            URI base = parse(validateOrigin(origin));
            URI requested = parse(candidate);
            return "https".equalsIgnoreCase(requested.getScheme())
                && base.getHost().equalsIgnoreCase(requested.getHost())
                && (requested.getPort() == -1 || requested.getPort() == 443);
        } catch (IllegalArgumentException ignored) { return false; }
    }

    private static URI parse(String value) {
        try {
            URI uri = new URI(value == null ? "" : value);
            if (uri.isOpaque() || !uri.isAbsolute() || uri.getHost() == null || uri.getRawUserInfo() != null) {
                throw new IllegalArgumentException("Invalid demo URL.");
            }
            return uri;
        } catch (URISyntaxException ignored) { throw new IllegalArgumentException("Invalid demo URL."); }
    }
}


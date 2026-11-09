package nl.lattenspecialist.medewerkers;

public final class DemoOriginPolicyTest {
    private static int tests;
    private static void check(boolean condition, String name) { tests++; if (!condition) throw new AssertionError(name); }
    private static void rejects(String input) {
        try { DemoOriginPolicy.validateOrigin(input); throw new AssertionError("Accepted " + input); }
        catch (IllegalArgumentException expected) { tests++; }
    }
    public static void main(String[] args) {
        String origin = "https://staff-review.example.test/";
        check(DemoOriginPolicy.validateOrigin(origin).equals(origin), "canonical");
        check(DemoOriginPolicy.validateOrigin("https://STAFF-REVIEW.example.test:443").equals(origin), "case and default port");
        check(DemoOriginPolicy.allows(origin, origin+"tasks?id=fictief#work"), "same origin");
        for (String url : new String[]{
            "http://staff-review.example.test/", "https://staff-review.example.test:444/",
            "https://staff-review.example.test.attacker.test/", "https://staff-review.example.test@attacker.test/",
            "https://staff-review.example.test./", "https://other-review.example.test/",
            "file:///tmp/test", "content://synthetic/test", "javascript:alert(1)", "intent://demo",
            "wss://staff-review.example.test/"}) check(!DemoOriginPolicy.allows(origin,url), "reject external scheme/origin");
        check(DemoOriginPolicy.allows(DemoOriginPolicy.ORIGIN+"?entry=demo"), "fixed role origin");
        check(DemoOriginPolicy.ORIGIN.equals("https://lattenspecialist-staff-review.stuiterbaas-456655a6.workers.dev/"), "expected fixed deployment");
        check(!DemoOriginPolicy.allows("https://app.pierfinity.nl/"), "operational platform blocked");
        check(!DemoOriginPolicy.allows("https://lattenspecialist.nl/"), "operational website blocked");
        for (String value : new String[]{null,"https://ordinary.example.test/","https://demo.example.test/path",
            "https://demo.example.test/?x=1","https://demo.example.test/#x","https://user:pass@demo.example.test/",
            "http://demo.example.test/","https://demo.example.test:444/","https://127.0.0.1/","https://[::1]/"}) rejects(value);
        System.out.println("PASS "+tests+" synthetic demo origin checks");
    }
}


package nl.lattenspecialist.medewerkers;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** Tests the actual compiled guard against the Android unit-test stub's strict WebView call. */
public class DemoStorageLifecycleTest {
    private Field ready;
    private Method prepare;

    @Before public void setup() throws Exception {
        ready = DemoActivity.class.getDeclaredField("dataDirectoryReady");
        ready.setAccessible(true);
        prepare = DemoActivity.class.getDeclaredMethod("prepareDemoStorage");
        prepare.setAccessible(true);
        ready.setBoolean(null, false);
    }
    @After public void cleanup() throws Exception { ready.setBoolean(null, false); }

    @Test public void initializationStateBelongsToProcessAndIsSynchronized() {
        assertTrue(Modifier.isStatic(ready.getModifiers()));
        assertTrue(Modifier.isStatic(prepare.getModifiers()));
        assertTrue(Modifier.isSynchronized(prepare.getModifiers()));
    }

    @Test public void reentryAndRotationDoNotTouchAlreadyInitializedWebView() throws Exception {
        ready.setBoolean(null, true);
        for (int recreation = 0; recreation < 10; recreation++) prepare.invoke(null);
        assertTrue(ready.getBoolean(null));
    }

    @Test public void failedFirstInitializationDoesNotMarkStorageReady() throws Exception {
        // Android's local-unit-test WebView stub throws; no real WebView/device is used.
        try { prepare.invoke(null); fail("The Android WebView unit stub must not initialize a provider."); }
        catch (InvocationTargetException expected) { assertTrue(expected.getCause() instanceof RuntimeException); }
        assertFalse(ready.getBoolean(null));
    }
}

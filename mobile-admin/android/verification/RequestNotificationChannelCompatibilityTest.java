package nl.lattenspecialist.beheer;

import org.junit.Test;
import static org.junit.Assert.*;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import javax.tools.ToolProvider;

/** JDK-only unit contract: executes the actual worker prologue without Android or network requests. */
public final class RequestNotificationChannelCompatibilityTest {
    @Test public void actualWorkerSkipsChannelsOn24And25AndCreatesThemOn26And36() throws Exception {
        Path cursor=Paths.get(System.getProperty("user.dir")).toAbsolutePath(),worker=null;
        for(int i=0;i<6&&cursor!=null;i++,cursor=cursor.getParent()) {
            Path candidate=cursor.resolve("src/main/java/nl/lattenspecialist/beheer/RequestNotificationWorker.java");
            if(Files.isRegularFile(candidate)){worker=candidate;break;}
        }
        assertNotNull("Actual worker source must be tested",worker);
        String production=Files.readString(worker,StandardCharsets.UTF_8);
        String prologue=production.substring(production.indexOf("        NotificationManager manager=context.getSystemService(NotificationManager.class);"),production.indexOf("        String token="));
        assertTrue("Prologue must include actual channel construction",prologue.contains("new NotificationChannel("));
        Path temporary=Files.createTempDirectory("admin17-channel-contract-");
        try {
            String harness="public final class ChannelHarness {"
                +"static int channels,posts; static final String CHANNEL=\"test-only\";"
                +"static final class Build {static final class VERSION {static int SDK_INT;}}"
                +"static final class NotificationManager {static final int IMPORTANCE_HIGH=4; void createNotificationChannel(NotificationChannel c){posts++;}}"
                +"static final class NotificationChannel {NotificationChannel(String id,String title,int importance){if(Build.VERSION.SDK_INT<26)throw new UnsupportedOperationException(\"API26 absent\");channels++;}}"
                +"static final class Context {<T>T getSystemService(Class<T> kind){return kind.cast(new NotificationManager());}}"
                +"public static int[] run(int sdk){Build.VERSION.SDK_INT=sdk;channels=0;posts=0;Context context=new Context();"
                +prologue+"return new int[]{channels,posts};}}";
            Path source=temporary.resolve("ChannelHarness.java");Files.writeString(source,harness,StandardCharsets.UTF_8);
            assertNotNull("Existing JDK compiler required",ToolProvider.getSystemJavaCompiler());
            assertEquals(0,ToolProvider.getSystemJavaCompiler().run(null,null,null,"-d",temporary.toString(),source.toString()));
            try(URLClassLoader loader=new URLClassLoader(new java.net.URL[]{temporary.toUri().toURL()},null)) {
                java.lang.reflect.Method run=loader.loadClass("ChannelHarness").getMethod("run",int.class);
                for(int sdk:new int[]{24,25})assertArrayEquals("Android7 must not construct or register a channel",new int[]{0,0},(int[])run.invoke(null,sdk));
                for(int sdk:new int[]{26,36})assertArrayEquals("Android8+ channel behavior retained",new int[]{1,1},(int[])run.invoke(null,sdk));
            }
        } finally {
            Path safe=temporary.toRealPath(),tempRoot=Paths.get(System.getProperty("java.io.tmpdir")).toRealPath();
            if(!safe.startsWith(tempRoot)||!safe.getFileName().toString().startsWith("admin17-channel-contract-"))throw new IllegalStateException("Unexpected test cleanup path");
            try(var files=Files.walk(safe)){for(Path file:files.sorted(Comparator.reverseOrder()).toList())Files.delete(file);}
        }
    }
}

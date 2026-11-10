import com.android.aapt.Resources;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Checks receiver registration and visible demo layouts in the actual packaged AAB. */
public final class AdminDemoBundleAudit {
    private static String attribute(Resources.XmlElement element,String name) {
        for(Resources.XmlAttribute item:element.getAttributeList())if(item.getName().equals(name)) {
            if(!item.getValue().isEmpty())return item.getValue();
            if(item.getCompiledItem().hasStr())return item.getCompiledItem().getStr().getValue();
            if(item.getCompiledItem().hasPrim())return Boolean.toString(item.getCompiledItem().getPrim().getBooleanValue());
        }
        return "";
    }
    public static void main(String[] args) throws Exception {
        Map<String,String> receivers=new HashMap<>();boolean permission=false;
        try(ZipFile archive=new ZipFile(args[0])) {
            Resources.XmlElement manifest;
            try(InputStream bytes=archive.getInputStream(archive.getEntry("base/manifest/AndroidManifest.xml"))) {
                manifest=Resources.XmlNode.parseFrom(bytes).getElement();
            }
            for(Resources.XmlNode node:manifest.getChildList())if(node.hasElement()) {
                Resources.XmlElement element=node.getElement();
                if(element.getName().equals("uses-permission")&&attribute(element,"name").equals("android.permission.POST_NOTIFICATIONS"))permission=true;
                if(element.getName().equals("application"))for(Resources.XmlNode child:element.getChildList())if(child.hasElement()&&child.getElement().getName().equals("receiver")) {
                    Resources.XmlElement receiver=child.getElement();receivers.put(attribute(receiver,"name"),attribute(receiver,"exported"));
                }
            }
            for(String name:new String[]{"AdminWidgetProvider","QuickRequestWidgetProvider","DemoAdminWidgetProvider","DemoQuickRequestWidgetProvider"})
                if(!"false".equals(receivers.get("nl.lattenspecialist.beheer."+name)))throw new IllegalStateException("Packaged widget missing or exported: "+name);
            for(String name:new String[]{"layout/demo_admin_widget.xml","layout/demo_quick_request_widget.xml","xml/demo_admin_widget_info.xml","xml/demo_quick_request_widget_info.xml"}) {
                ZipEntry entry=archive.getEntry("base/res/"+name);
                if(entry==null)throw new IllegalStateException("Packaged demo widget resource missing: "+name);
                if(name.startsWith("layout/"))try(InputStream bytes=archive.getInputStream(entry)) {
                    if(!new String(bytes.readAllBytes(),StandardCharsets.UTF_8).contains("DEMO"))throw new IllegalStateException("Visible DEMO label missing from packaged layout");
                }
            }
        }
        if(!permission)throw new IllegalStateException("Existing notification permission was removed");
        System.out.println("{\"passed\":true,\"operationalWidgetsRetained\":2,\"separateDemoWidgets\":2,\"allFourWidgetReceiversUnexported\":true,\"demoLayoutsVisiblyLabeled\":true,\"existingNotificationPermissionPreserved\":true}");
    }
}

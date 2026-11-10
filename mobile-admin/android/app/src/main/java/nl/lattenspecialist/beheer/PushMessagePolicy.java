package nl.lattenspecialist.beheer;
import java.util.Map;
import java.util.Set;

final class PushMessagePolicy {
    static boolean accepts(Map<String,String> data,boolean authenticated,boolean permitted,Set<String> recent){
        if(!authenticated||!permitted||data==null||!"maintenance_request".equals(data.get("type")))return false;
        String reference=data.get("reference"),event=data.get("eventId");
        return reference!=null&&reference.matches("LS-[0-9]{4}-[A-Z2-9]{6}")
            &&("reservation:"+reference).equals(event)&&!recent.contains(event);
    }
}

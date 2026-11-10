package nl.lattenspecialist.beheer;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;

public final class PushMessagePolicyTest {
    private Map<String,String> good(){Map<String,String> value=new HashMap<>();value.put("type","maintenance_request");value.put("reference","LS-2611-ABC234");value.put("eventId","reservation:LS-2611-ABC234");return value;}
    @Test public void requiresOwnerAndPermission(){assertTrue(PushMessagePolicy.accepts(good(),true,true,Collections.emptySet()));assertFalse(PushMessagePolicy.accepts(good(),false,true,Collections.emptySet()));assertFalse(PushMessagePolicy.accepts(good(),true,false,Collections.emptySet()));}
    @Test public void duplicateAndMalformedEventsNeverNotify(){assertFalse(PushMessagePolicy.accepts(good(),true,true,Collections.singleton("reservation:LS-2611-ABC234")));Map<String,String> value=good();value.put("reference","https://attacker.test");assertFalse(PushMessagePolicy.accepts(value,true,true,Collections.emptySet()));value=good();value.put("type","admin");assertFalse(PushMessagePolicy.accepts(value,true,true,Collections.emptySet()));value=good();value.put("eventId","reservation:other");assertFalse(PushMessagePolicy.accepts(value,true,true,Collections.emptySet()));}
}

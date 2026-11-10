package nl.lattenspecialist.beheer;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePromptPolicyTest {
    @Test public void decliningDoesNotPromptOnEveryResume(){
        assertTrue(UpdatePromptPolicy.shouldOffer(100000,0));
        assertFalse(UpdatePromptPolicy.shouldOffer(100001,100000));
        assertFalse(UpdatePromptPolicy.shouldOffer(86499999,100000));
        assertTrue(UpdatePromptPolicy.shouldOffer(86500000,100000));
        assertTrue(UpdatePromptPolicy.shouldOffer(99999,100000));
    }
}

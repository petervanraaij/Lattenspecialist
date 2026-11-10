package nl.lattenspecialist.beheer;
final class UpdatePromptPolicy {
    static boolean shouldOffer(long now,long previous){return previous<=0||now<previous||now-previous>=86400000L;}
}

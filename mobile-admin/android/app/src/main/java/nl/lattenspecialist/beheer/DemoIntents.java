package nl.lattenspecialist.beheer;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/** Explicit immutable intents target only the unexported isolated demo activity. */
final class DemoIntents {
    private DemoIntents() {}
    static PendingIntent open(Context context, String command, String material, int requestCode) {
        DemoIntentPolicy.destination(DemoIntentPolicy.ACTION_OPEN, null,
            command == null ? java.util.Collections.emptySet() : material == null
                ? java.util.Collections.singleton(DemoIntentPolicy.EXTRA_QUICK_ACTION)
                : new java.util.HashSet<>(java.util.Arrays.asList(DemoIntentPolicy.EXTRA_QUICK_ACTION, DemoIntentPolicy.EXTRA_MATERIAL)), command, material);
        Intent intent = new Intent(context, DemoActivity.class).setAction(DemoIntentPolicy.ACTION_OPEN)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (command != null) intent.putExtra(DemoIntentPolicy.EXTRA_QUICK_ACTION, command);
        if (material != null) intent.putExtra(DemoIntentPolicy.EXTRA_MATERIAL, material);
        return PendingIntent.getActivity(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

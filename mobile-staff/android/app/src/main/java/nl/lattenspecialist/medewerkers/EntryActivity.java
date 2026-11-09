package nl.lattenspecialist.medewerkers;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** The same explicit choice is offered to every user, before the work app starts. */
public final class EntryActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24), dp(32), dp(24), dp(24));
        layout.setBackgroundColor(0xFFF4F2ED);
        layout.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(dp(24) + insets.getSystemWindowInsetLeft(), dp(32) + insets.getSystemWindowInsetTop(),
                dp(24) + insets.getSystemWindowInsetRight(), dp(24) + insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        TextView title = new TextView(this);
        title.setText("De Lattenspecialist · Medewerkers");
        title.setTextColor(Color.BLACK);
        title.setTextSize(26);
        layout.addView(title);
        TextView description = new TextView(this);
        description.setText("Open je beveiligde app of bekijk een afzonderlijke demonstratie met uitsluitend fictieve gegevens.");
        description.setTextColor(0xFF333333);
        description.setTextSize(16);
        description.setPadding(0, dp(20), 0, dp(24));
        layout.addView(description);
        Button work = new Button(this);
        work.setText("Open beveiligde app");
        work.setOnClickListener(view -> {
            startActivity(new Intent(this, MainActivity.class));
            finish();
        });
        layout.addView(work, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        Button demo = new Button(this);
        demo.setText("Bekijk fictieve demonstratie");
        demo.setOnClickListener(view -> {
            startActivity(new Intent(this, DemoActivity.class));
            finish();
        });
        layout.addView(demo, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView explanation = new TextView(this);
        explanation.setText("DEMO: aanvullende demonstratieomgeving. Geen account of echte klant-, personeels- of financiële gegevens nodig. De demo is herkenbaar en voor iedereen beschikbaar.");
        explanation.setTextColor(0xFF454545);
        explanation.setPadding(0, dp(16), 0, 0);
        layout.addView(explanation);
        setContentView(layout);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}


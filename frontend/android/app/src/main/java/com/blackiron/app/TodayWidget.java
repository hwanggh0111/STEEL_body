package com.blackiron.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

// 홈 화면 위젯 — **「오늘 뭐 하지」의 답 한 줄** (2026-10-16)
//
// 앱의 「오늘」 탭 첫 카드가 말하는 것을 폰 홈 화면에 얹는다. 앱을 안 열어도 보이고,
// 누르면 앱이 열린다.
//
// ── 글은 어디서 오나 ──
//
// **여기서 계산하지 않는다.** 부위가 며칠째 식었는지는 운동 기록 전부를 봐야 아는
// 값이고, 그 계산은 화면 쪽에 이미 있다(`src/data/bodyHeat.js`). 자바로 한 벌 더
// 옮기면 **같은 기록을 보고 위젯과 홈이 서로 다른 부위를 말하는 날**이 온다.
//
// 그래서 화면이 글자로 접어 넘기고(`src/data/homeWidget.js`), 이쪽은 **받아 적기만**
// 한다. 넘어오는 길은 `MainActivity` 의 `AppBridge.saveWidget` 이다.
//
// ── 언제 다시 그리나 ──
//
//   · 앱이 글을 넘길 때          `refresh()` (대개 이쪽이다)
//   · 위젯을 처음 얹을 때 · 폰이 켜질 때   `onUpdate`
//   · 30분마다                   `widget_today_info.xml` 의 updatePeriodMillis
//     (안드로이드의 최솟값이다. **배터리를 아끼려고 이보다 잦게 못 한다**)
//
// 앱을 한 번도 안 열었으면 넘어온 글이 없다 — 그때는 「앱을 열어 기록을 적어보세요」다.
// **빈 위젯을 두지 않는다**: 고장 난 것처럼 보인다.
public class TodayWidget extends AppWidgetProvider {

    /** **화면 쪽과 같은 글자여야 한다** (`src/data/homeWidget.js` 의 WIDGET_PREFS · WIDGET_KEY) */
    public static final String PREFS = "blackiron_widget";
    public static final String KEY = "today";

    /** 앱이 새 글을 넘겼을 때. 얹혀 있는 위젯 전부를 다시 그린다 */
    public static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName self = new ComponentName(context, TodayWidget.class);
        int[] ids = manager.getAppWidgetIds(self);
        if (ids == null) return;
        for (int id : ids) draw(context, manager, id);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) draw(context, manager, id);
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY, null);

        String head = "";
        String line = "앱을 열어 기록을 적어보세요";
        String sub = "";
        int sets = 0;

        if (raw != null) {
            try {
                JSONObject o = new JSONObject(raw);
                head = o.optString("head", "");
                line = o.optString("line", line);
                sub = o.optString("sub", "");
                sets = o.optInt("sets", 0);
                // 「{d}일째 식어 있습니다」의 숫자를 **오늘 기준으로 다시 센다**.
                // 글자로 박아 두면 앱을 일주일 안 여는 동안 영영 「3일째」다 —
                // 운동을 안 할수록 틀어지는 숫자이고, 하필 그때 봐야 하는 숫자다
                line = withDays(line, o.optInt("days", -1), o.optString("basedOn", ""));
            } catch (Exception e) {
                // 글을 못 읽어도 **위젯은 뭔가를 보여줘야 한다.** 위의 기본 글로 간다
            }
        }

        // 부위 이름이 없는 때가 있다 (기록이 없을 때 · 몸 전체가 고루 달아 있을 때).
        // 그때 빈 칸을 남기면 글이 가운데서 뜬 것처럼 보이므로 아예 치운다
        if (head.isEmpty()) {
            views.setViewVisibility(R.id.widget_head, android.view.View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_head, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_head, head);
        }
        views.setTextViewText(R.id.widget_line, line);

        // 아래 줄 — 최근에 달군 자리와 오늘 적은 세트. 둘 다 없으면 줄을 치운다
        String foot = sub;
        if (sets > 0) foot = foot.isEmpty() ? ("오늘 " + sets + "세트") : (foot + "  ·  오늘 " + sets + "세트");
        if (foot.isEmpty()) {
            views.setViewVisibility(R.id.widget_sub, android.view.View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_sub, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_sub, foot);
        }

        // 눌러서 앱 열기. **FLAG_IMMUTABLE 이 안드로이드 12 이상에서 필수다** —
        // 없으면 앱이 그 자리에서 죽는다(IllegalArgumentException)
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(id, views);
    }

    /**
     * 「{d}일째 …」의 숫자를 **오늘 기준으로** 채운다.
     *
     * 화면이 넘긴 것은 `days`(글을 쓴 날 기준 며칠째)와 `basedOn`(그 날짜)다.
     * 여기서 하는 일은 **뺄셈 하나** — 그 뒤로 며칠이 더 지났는지 더한다.
     * 부위를 고르는 계산은 여전히 화면 쪽(`bodyHeat.js`) 한 곳에만 있다.
     *
     * 못 읽는 값이 오면 **자리만 지운다**: 「{d}일째」가 그대로 보이는 것보다 낫다.
     */
    private static String withDays(String line, int days, String basedOn) {
        if (line == null || !line.contains("{d}")) return line;
        int shown = days;
        try {
            if (days >= 0 && basedOn != null && basedOn.length() == 10) {
                long passed = ChronoUnit.DAYS.between(LocalDate.parse(basedOn), LocalDate.now());
                // 폰 시계를 과거로 돌려둔 경우에도 **줄어들지는 않게** 한다
                if (passed > 0) shown = days + (int) passed;
            }
        } catch (Exception e) {
            shown = days;
        }
        if (shown < 0) return line.replace("{d}일째 ", "");
        return line.replace("{d}", String.valueOf(shown));
    }
}

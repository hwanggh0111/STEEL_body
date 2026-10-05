# R8 (minify) 가 지우면 안 되는 자리 — 2026-10-05
#
# `minifyEnabled true` 를 켰다. 릴리스 APK 가 3.53MB → 1.53MB 로 줄었다.
# 그런데 R8 은 **쓰이는 자리가 코드에 안 보이면 지우거나 이름을 바꾼다.**
# 이 앱에는 그런 자리가 둘 있고, 둘 다 **배포본에서만 터진다** — 디버그 빌드는
# minify 를 안 하므로 개발 중에는 절대 안 보인다.
#
# ── 1. 오프라인 화면의 「다시 시도」 ──
#
# 서버에 못 닿으면 `public/app-offline.html` 이 뜨고, 거기 단추가
# `BlackIronApp.retry()` 를 부른다. 자바 쪽은 `MainActivity$AppBridge` 의
# `@JavascriptInterface` 메서드다 — **자바 코드 어디에서도 안 부른다.**
# 이름이 바뀌면 단추가 아무 일도 안 하고, 사용자는 앱이 죽은 줄 안다.
#
# ── 2. Capacitor 플러그인 ──
#
# 플러그인은 `@CapacitorPlugin` 애너테이션을 **런타임에 뒤져서** 등록한다.
# 클래스 이름과 애너테이션이 남아 있어야 찾는다.

# ── 웹에서 부르는 자리는 통째로 남긴다 ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# 그 메서드를 담은 클래스 자체도 남겨야 한다 (안쪽 클래스라 따로 적는다)
-keep class com.blackiron.app.MainActivity { *; }
-keep class com.blackiron.app.MainActivity$* { *; }

# ── Capacitor ──
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
# 애너테이션 자체가 지워지면 위의 규칙들이 찾을 것이 없어진다
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# ── Cordova 쪽(capacitor-cordova-android-plugins) ──
-keep class org.apache.cordova.** { *; }

# ── 터졌을 때 어디서 터졌는지 읽을 수 있게 ──
# 줄 번호를 지우면 배포본 오류 보고가 `a.a.a(Unknown Source)` 가 된다.
# 원래 파일 이름은 감추고 줄 번호만 남긴다
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

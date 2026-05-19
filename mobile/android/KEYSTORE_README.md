# Release keystore

This folder contains a self-generated release keystore so the APK can be signed
locally and on CI without needing Android Studio.

* `keystore/aite-release.keystore` — RSA 2048, valid 30 years, alias `aite-release`.
* `keystore.properties` — points Gradle at the keystore and supplies the passwords.

The `keystore.properties` and the keystore file are **not** suitable for the
Play Store. Generate a fresh keystore (`keytool -genkeypair ...`) with strong,
private passwords before publishing, and never commit a production keystore /
its passwords to a public repo.

If `keystore.properties` is missing, Gradle skips signing config setup and
`assembleRelease` produces an *unsigned* APK (still installable via `adb install`
on a debuggable device, but Android Package Installer will reject it).

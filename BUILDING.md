# Building and releasing CRM for Team on Windows

## Project values

| Item | Value |
|---|---|
| App name | CRM for Team |
| App slug | `crm-for-team` |
| Application ID | `com.mahesajenar.crmforteam` |
| Gradle DSL | Kotlin (`.gradle.kts`) |
| Application module | `app` |

The scripts resolve the project from `%~dp0`, so they work from any current directory.
They always use the checked-in Gradle wrapper.

## Everyday commands

```bat
run.bat
run.bat build
run.bat install
run.bat clean
```

`run.bat` and `run.bat build` create a debug APK. `install` builds and installs the
debug app on an attached device/emulator. `clean` removes Gradle build outputs.

## One-time production signing setup

Android accepts an APK as an update only when the application ID is unchanged, the
new `versionCode` is higher, and it is signed by the same key. Back up the keystore
and its passwords in two secure places. Losing or replacing this key prevents Android
and Obtainium from updating existing installations.

The script deliberately never generates or replaces a production key. If you do not
already have one, run this yourself from a JDK command prompt and answer the prompts:

```bat
keytool -genkeypair -v -keystore "C:\secure\crm-for-team-release.jks" -alias crm-for-team -keyalg RSA -keysize 4096 -validity 10000
```

Then copy `keystore.properties.example` to the ignored `keystore.properties` and set:

```properties
storeFile=C:/secure/crm-for-team-release.jks
storePassword=YOUR_REAL_STORE_PASSWORD
keyAlias=crm-for-team
keyPassword=YOUR_REAL_KEY_PASSWORD
```

Never commit `keystore.properties`, passwords, `.jks`, or `.keystore` files. The
repository's `.gitignore` blocks all of them.

Check the credentials without building or changing the version:

```bat
run.bat check-signing
```

If the keystore opens but the private key cannot be unlocked (`Cannot recover key`),
correct `keyPassword` in `keystore.properties` using the original private-key
password. It can differ from `storePassword`. If you accepted the same password
when creating the key, both values should match. Do not generate a replacement key
to fix a password error; retrieve the original password from your secure backup.
Properties values are not quoted, and literal backslashes must be escaped as `\\`.
The check reads the existing keystore without modifying it or printing passwords.

## Release command and version transaction

Edit only `versionName` when choosing a new public semantic version, for example
`1.1.0`. Do not manually pre-increment `versionCode` for a normal release.

```bat
run.bat release
```

The command verifies that the signing private key can be unlocked and validates
both version values before changing anything. It then increments `versionCode` by
exactly one, builds `:app:assembleRelease`, locates the actual APK, and verifies its
signature with Android `apksigner`. Only then does it copy the artifact as:

```text
dist\crm-for-team-<versionName>-<versionCode>.apk
```

It never overwrites an existing release. On validation, build, signing, lookup,
copying, or retention failure, the original bytes of `version.properties` are
restored and the attempt's partial/final output is removed. Therefore a failed
attempt does not consume a `versionCode`.

After a successful copy, only the three newest files matching
`dist\crm-for-team-*.apk` are retained. Other apps' APKs and unrelated files are
untouched. Retention first confirms old files are not locked and keeps temporary
recovery copies; if pruning cannot complete, the release reports failure instead of
claiming success. Test this safely with temporary dummy files:

```bat
run.bat retention-test
```

## Publish the first GitHub Release

After `run.bat release` prints the real values, use the exact command it displays.
For a hypothetical `1.0.0` build `2`, that is:

```bat
gh release create v1.0.0 "dist\crm-for-team-1.0.0-2.apk" --title "v1.0.0" --notes "CRM for Team 1.0.0 (build 2)"
```

Check first that the tag is unused (for example, `gh release view v1.0.0`). If it
already exists, choose a new `versionName`, run `run.bat release` again, and publish
that new artifact. Do not overwrite an existing release.

No local build script pushes commits, creates tags, or publishes releases.

import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val versionPropertiesFile = rootProject.file("version.properties")
check(versionPropertiesFile.isFile) { "Missing root version.properties" }
val versionProperties = Properties().apply {
    versionPropertiesFile.inputStream().use(::load)
}
val appVersionCode = versionProperties.getProperty("versionCode")
    ?.toIntOrNull()?.takeIf { it > 0 }
    ?: error("version.properties: versionCode must be a positive integer")
val appVersionName = versionProperties.getProperty("versionName")
    ?.trim()?.takeIf { it.matches(Regex("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:[-+][0-9A-Za-z.-]+)?$")) }
    ?: error("version.properties: versionName must be a semantic version such as 1.0.0")

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.isFile) keystorePropertiesFile.inputStream().use(::load)
}
fun signingProperty(name: String): String? =
    keystoreProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }

val releaseStoreFile = signingProperty("storeFile")
val releaseStorePassword = signingProperty("storePassword")
val releaseKeyAlias = signingProperty("keyAlias")
val releaseKeyPassword = signingProperty("keyPassword")
val hasReleaseSigning = listOf(
    releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword
).all { it != null }

android {
    namespace = "com.mahesajenar.crmforteam"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mahesajenar.crmforteam"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

// Gradle itself refuses release tasks when production signing is incomplete.
// Debug builds remain available on a fresh clone.
gradle.taskGraph.whenReady {
    val wantsRelease = allTasks.any { task ->
        task.project == project && task.name.contains("release", ignoreCase = true)
    }
    if (wantsRelease) {
        check(keystorePropertiesFile.isFile) {
            "Release signing requires ignored root keystore.properties (copy keystore.properties.example)."
        }
        check(hasReleaseSigning) {
            "keystore.properties must define storeFile, storePassword, keyAlias, and keyPassword."
        }
        check(rootProject.file(releaseStoreFile!!).isFile) {
            "Release keystore does not exist: ${rootProject.file(releaseStoreFile).absolutePath}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")
    implementation("androidx.compose.ui:ui:1.6.8")
    implementation("androidx.compose.material3:material3:1.2.1")
    implementation("androidx.compose.material:material-icons-extended:1.6.8")
    implementation("androidx.compose.ui:ui-tooling-preview:1.6.8")
}

// Copyright (c) 2026 PaperAxis. All rights reserved.
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// FCM push is optional: CI drops google-services.json here when the secret exists.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// Overridable from the command line: -PversionCode=201 -PversionName=2.0.1 -PapiBase=https://...
val appVersionCode = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 200
val appVersionName = (project.findProperty("versionName") as String?) ?: "2.0.0"
val apiBase = ((project.findProperty("apiBase") as String?) ?: "https://maps.paperaxis.com").trimEnd('/')

val keystoreFile: String? = System.getenv("KEYSTORE_FILE")

android {
    namespace = "com.paperaxis.papermap"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.paperaxis.papermap"
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
        buildConfigField("String", "API_BASE", "\"$apiBase\"")
        buildConfigField(
            "String",
            "UPDATES_FEED",
            "\"https://updates.paperaxis.com/papermap-android/\"",
        )
    }

    signingConfigs {
        if (!keystoreFile.isNullOrBlank()) {
            create("release") {
                storeFile = file(keystoreFile!!)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (!keystoreFile.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // java.time on minSdk 24-25.
        isCoreLibraryDesugaringEnabled = true
    }

    // Map styles shared with iOS (apps/shared/map-style-*.json) are packaged as assets.
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets", "../../shared")
        }
    }

    lint {
        // Release builds run in CI without an emulator; lint runs separately when needed.
        checkReleaseBuilds = false
        abortOnError = false
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")

    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    // Profile fonts from Google Fonts through Play services (ui/theme/Fonts.kt).
    implementation("androidx.compose.ui:ui-text-google-fonts")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("org.maplibre.gl:android-sdk:11.5.2")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")

    implementation("io.socket:socket.io-client:2.1.1") {
        // Android ships org.json; the jar copy would clash.
        exclude(group = "org.json", module = "json")
    }
}

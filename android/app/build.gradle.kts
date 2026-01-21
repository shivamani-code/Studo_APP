plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
    buildFeatures {
        buildConfig = true
    }
  namespace = "com.studo.webview"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.studo.webview"
    minSdk = 23
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
    debug {
      isMinifyEnabled = false
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.12.0")
  implementation("androidx.appcompat:appcompat:1.6.1")
  implementation("androidx.webkit:webkit:1.10.0")
}

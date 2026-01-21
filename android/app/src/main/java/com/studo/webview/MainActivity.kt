package com.studo.webview

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private var assetLoader: WebViewAssetLoader? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webview)

    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

    val settings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.loadWithOverviewMode = true
    settings.useWideViewPort = true
    settings.javaScriptCanOpenWindowsAutomatically = true
    settings.setSupportMultipleWindows(false)

    val cookieManager = CookieManager.getInstance()
    cookieManager.setAcceptCookie(true)
    cookieManager.setAcceptThirdPartyCookies(webView, true)

    webView.webChromeClient = WebChromeClient()

    val useLocalAssets = resources.getBoolean(R.bool.use_local_assets)
    if (useLocalAssets) {
      assetLoader = WebViewAssetLoader.Builder()
        .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
        .build()
    }

    val appAssetsStartUrl = "https://appassets.androidplatform.net/index.html"

    webView.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val loader = assetLoader
        if (loader != null) {
          return loader.shouldInterceptRequest(request.url)
        }
        return super.shouldInterceptRequest(view, request)
      }

      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url.toString()
        return handleExternalSchemes(url)
      }

      @Deprecated("Deprecated in Java")
      override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
        return handleExternalSchemes(url)
      }
    }

    val remoteUrl = getString(R.string.web_app_url)
    val startUrl = if (useLocalAssets) appAssetsStartUrl else remoteUrl
    webView.loadUrl(startUrl)
  }

    private fun handleExternalSchemes(url: String): Boolean {
        val lower = url.lowercase()
        val shouldOpenExternally =
            lower.startsWith("mailto:") ||
                    lower.startsWith("tel:") ||
                    lower.startsWith("sms:") ||
                    lower.startsWith("geo:") ||
                    lower.startsWith("intent:") ||
                    lower.startsWith("market:")

        if (!shouldOpenExternally) return false

        return try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
            true
        } catch (e: Exception) {
            false
        }
    }


    @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (::webView.isInitialized && webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }
}

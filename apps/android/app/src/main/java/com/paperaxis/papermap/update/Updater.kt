// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.paperaxis.papermap.BuildConfig
import com.paperaxis.papermap.data.AndroidRelease
import com.paperaxis.papermap.data.AppJson
import com.paperaxis.papermap.data.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest

private val PACKAGE_NAME = Regex("^[A-Za-z0-9._-]+\\.apk$")
private const val DAY_MS = 24L * 60 * 60 * 1000

/**
 * PaperUpdates client. Reads releases.android.json at most once a day; download and
 * install only happen after the user confirms.
 */
class Updater(
    private val context: Context,
    private val http: OkHttpClient,
    private val session: SessionStore,
) {
    suspend fun check(force: Boolean = false): AndroidRelease? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!force && now - session.updateCheckedAt() < DAY_MS) return@withContext null
        val req = Request.Builder()
            .url(BuildConfig.UPDATES_FEED + "releases.android.json")
            .header("Cache-Control", "no-cache")
            .build()
        val release = runCatching {
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) null
                else AppJson.decodeFromString(AndroidRelease.serializer(), res.body?.string().orEmpty())
            }
        }.getOrNull()
        session.setUpdateCheckedAt(now)
        release?.takeIf {
            it.versionCode > BuildConfig.VERSION_CODE &&
                PACKAGE_NAME.matches(it.`package`) &&
                (it.minSdk == null || it.minSdk <= Build.VERSION.SDK_INT)
        }
    }

    /** Downloads the APK, checks its SHA-256 and opens the system installer. */
    suspend fun downloadAndInstall(release: AndroidRelease): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(PACKAGE_NAME.matches(release.`package`)) { "Geçersiz paket adı" }
            val dir = File(context.getExternalFilesDir(null), "updates").apply { mkdirs() }
            val target = File(dir, release.`package`)
            if (target.exists()) target.delete()

            val dm = context.getSystemService(DownloadManager::class.java)
            val request = DownloadManager.Request(Uri.parse(BuildConfig.UPDATES_FEED + release.`package`))
                .setTitle("PaperMap ${release.version}")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(context, null, "updates/${release.`package`}")
            val id = dm.enqueue(request)

            while (true) {
                delay(1000)
                val status = dm.query(DownloadManager.Query().setFilterById(id)).use { c ->
                    if (!c.moveToFirst()) DownloadManager.STATUS_FAILED
                    else c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                }
                if (status == DownloadManager.STATUS_SUCCESSFUL) break
                if (status == DownloadManager.STATUS_FAILED) error("İndirme başarısız")
            }

            if (release.sha256.isNotBlank()) {
                val actual = sha256(target)
                if (!actual.equals(release.sha256, ignoreCase = true)) {
                    target.delete()
                    error("Dosya doğrulanamadı")
                }
            }

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", target)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            withContext(Dispatchers.Main) { context.startActivity(intent) }
        }
    }

    private fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n <= 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

}

package com.mahesajenar.crmforteam

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

data class User(
    val id: String, val username: String, val displayName: String, val role: Role,
    val supervisorId: String?, val active: Boolean = true, val mustChangePassword: Boolean = false,
    val currentMonthSpks: Int = 0, val runningProspects: Int = 0
)

data class Spk(
    val id: String, val number: String, val date: LocalDate, val customerName: String,
    val consultantId: String, val supervisorId: String?, val consultantName: String?, val supervisorName: String?, val clientType: String,
    val phone: String, val carType: String, val color: String, val quantity: Int,
    val dealPrice: String?, val sameAsOtr: Boolean, val payment: String,
    val description: String?, val bonus: String, val promiseFrom: LocalDate,
    val promiseTo: LocalDate, val tenorMonths: Int?, val tdp: String?, val insurance: String?,
    val status: String, val crmDone: Boolean, val vin: String?, val vinAllocated: LocalDate?,
    val delivered: Boolean, val deliveredDate: LocalDate?, val fullyPaid: Boolean,
    val deliveryPlanned: Boolean, val planDoDate: LocalDate?, val refundCredit: Boolean, val incentiveDms: Boolean,
    val incentiveCsi: Boolean, val revision: Int
)

data class Prospect(val id: String, val consultantId: String, val name: String,
    val want: String, val stage: String, val status: String)
data class ProspectHistory(val want: String, val stage: String, val createdAt: String)
data class PageResult<T>(val items: List<T>, val total: Int)

class ApiException(val status: Int, message: String) : Exception(message)

/** Refresh tokens are kept in app-private storage and excluded from device backups. */
class ApiClient(context: Context) {
    private val base = "https://crm-for-team-server.vercel.app"
    private val session = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private var accessToken: String? = null
    private var refreshToken: String? = session.getString("refreshToken", null)
    var currentUser: User? by mutableStateOf<User?>(null)
        private set

    private suspend fun request(method: String, path: String, payload: JSONObject? = null,
                                authenticated: Boolean = true, retry: Boolean = true): JSONObject {
        val token = if (authenticated) accessToken else null
        return try {
            rawRequest(method, path, payload, token)
        } catch (e: ApiException) {
            if (e.status == 401 && authenticated && retry && refreshToken != null) {
                refresh()
                request(method, path, payload, authenticated, false)
            } else throw e
        }
    }

    private suspend fun rawRequest(method: String, path: String, payload: JSONObject?, token: String?): JSONObject =
        withContext(Dispatchers.IO) {
            val connection = (URL(base + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 15000
                readTimeout = 20000
                setRequestProperty("Accept", "application/json")
                if (token != null) setRequestProperty("Authorization", "Bearer $token")
                if (payload != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (payload != null) connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                if (status !in 200..299) throw ApiException(status, json.optString("error").ifBlank { "Server error ($status)" })
                json
            } finally { connection.disconnect() }
        }

    private fun acceptSession(json: JSONObject): User {
        accessToken = json.getString("accessToken")
        refreshToken = json.getString("refreshToken")
        session.edit().putString("refreshToken", refreshToken).apply()
        return user(json.getJSONObject("user")).also { currentUser = it }
    }

    suspend fun restoreSession(): User? {
        if (refreshToken == null) return null
        refresh()
        return currentUser
    }

    suspend fun login(username: String, password: String): User = acceptSession(
        request("POST", "/api/auth/login", JSONObject().put("username", username.trim()).put("password", password), false)
    )

    private suspend fun refresh() {
        val token = refreshToken ?: throw ApiException(401, "Silakan masuk kembali.")
        try {
            acceptSession(rawRequest("POST", "/api/auth/refresh", JSONObject().put("refreshToken", token), null))
        } catch (e: ApiException) {
            if (e.status == 401) clearSession()
            throw e
        }
    }

    suspend fun logout() {
        val token = refreshToken
        try { if (token != null) request("POST", "/api/auth/logout", JSONObject().put("refreshToken", token), false) }
        finally { clearSession() }
    }

    fun clearSession() {
        accessToken = null; refreshToken = null; currentUser = null
        session.edit().remove("refreshToken").apply()
    }

    suspend fun changePassword(old: String, next: String) {
        request("POST", "/api/auth/password", JSONObject().put("currentPassword", old).put("newPassword", next))
        clearSession()
    }

    suspend fun users(): List<User> = request("GET", "/api/users").getJSONArray("users").asObjects().map(::user)
    suspend fun accountAction(id: String, action: String, password: String? = null) {
        val body = JSONObject().put("id", id).put("action", action)
        if (password != null) body.put("password", password)
        request("PATCH", "/api/users", body)
    }
    suspend fun deleteUser(id: String) { request("DELETE", "/api/users?id=$id") }
    suspend fun createUser(username: String, name: String, role: Role, supervisorId: String?, password: String): User {
        val body = JSONObject().put("username", username.trim()).put("displayName", name.trim())
            .put("role", role.name.lowercase()).put("password", password)
        if (role == Role.CONSULTANT) body.put("supervisorId", supervisorId)
        return user(request("POST", "/api/users", body).getJSONObject("user"))
    }

    suspend fun spks(month: String? = null, outstanding: Boolean = false, page: Int = 1, status: String = "all"): PageResult<Spk> {
        val query = if (outstanding) "outstanding=true" else "month=$month&status=$status"
        val json = request("GET", "/api/spks?$query&page=$page")
        return PageResult(json.getJSONArray("spks").asObjects().map(::spk), json.getInt("total"))
    }

    suspend fun createSpk(values: JSONObject): Spk = spk(request("POST", "/api/spks", values).getJSONObject("spk"))
    suspend fun updateSpk(item: Spk, changes: JSONObject): Spk = spk(request("PATCH", "/api/spks/item?id=${item.id}",
        JSONObject().put("revision", item.revision).put("changes", changes)).getJSONObject("spk"))
    suspend fun deleteSpk(id: String) { request("DELETE", "/api/spks/item?id=$id") }

    suspend fun prospects(page: Int = 1, month: String? = null, status: String = "all", consultantId: String? = null): PageResult<Prospect> {
        val query = buildString {
            append("page=$page&status=$status")
            if (month != null) append("&month=$month")
            if (consultantId != null) append("&consultantId=$consultantId")
        }
        val json = request("GET", "/api/prospects?$query")
        return PageResult(json.getJSONArray("prospects").asObjects().map(::prospect), json.getInt("total"))
    }
    suspend fun prospectHistory(id: String): List<ProspectHistory> =
        request("GET", "/api/prospects/item?id=$id").getJSONArray("history").asObjects().map {
            ProspectHistory(it.getString("want"), it.getString("stage"), it.getString("createdAt").take(10))
        }
    suspend fun createProspect(consultantId: String, name: String, want: String, stage: String): Prospect =
        prospect(request("POST", "/api/prospects", JSONObject().put("consultantId", consultantId)
            .put("name", name).put("want", want).put("stage", stage)).getJSONObject("prospect"))
    suspend fun updateProspect(id: String, changes: JSONObject): Prospect =
        prospect(request("PATCH", "/api/prospects/item?id=$id", changes).getJSONObject("prospect"))

    private fun user(o: JSONObject) = User(o.getString("id"), o.getString("username"), o.getString("displayName"),
        Role.valueOf(o.getString("role").uppercase()), o.nullableString("supervisorId"),
        o.optBoolean("active", true), o.optBoolean("mustChangePassword"),
        o.optInt("currentMonthSpks"), o.optInt("runningProspects"))
    private fun prospect(o: JSONObject) = Prospect(o.getString("id"), o.getString("consultantId"),
        o.getString("name"), o.getString("want"), o.getString("stage"), o.getString("status"))
    private fun spk(o: JSONObject) = Spk(
        o.getString("id"), o.getString("number"), o.localDate("date")!!, o.getString("customerName"),
        o.getString("consultantId"), o.nullableString("supervisorId"), o.nullableString("consultantName"), o.nullableString("supervisorName"), o.getString("clientType"),
        o.getString("phone"), o.getString("carType"), o.getString("color"), o.getInt("quantity"),
        o.nullableString("dealPrice"), o.getBoolean("sameAsOtr"), o.getString("payment"),
        o.nullableString("description"), o.getString("bonus"), o.localDate("promiseFrom")!!,
        o.localDate("promiseTo")!!, o.optIntOrNull("tenorMonths"), o.nullableString("tdp"),
        o.nullableString("insurance"), o.getString("status"), o.getBoolean("crmDone"),
        o.nullableString("vin"), o.localDate("vinAllocated"), o.getBoolean("delivered"),
        o.localDate("deliveredDate"), o.getBoolean("fullyPaid"), o.getBoolean("deliveryPlanned"),
        o.localDate("planDoDate"), o.getBoolean("refundCredit"), o.getBoolean("incentiveDms"), o.getBoolean("incentiveCsi"), o.getInt("revision")
    )
}

private fun JSONArray.asObjects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
private fun JSONObject.localDate(key: String): LocalDate? = nullableString(key)?.let { LocalDate.parse(it.take(10)) }
private fun JSONObject.optIntOrNull(key: String): Int? = if (isNull(key)) null else getInt(key)

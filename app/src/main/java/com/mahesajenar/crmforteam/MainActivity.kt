package com.mahesajenar.crmforteam

import android.app.DatePickerDialog
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.text.NumberFormat
import java.util.Locale

enum class Role(val label: String) { MASTER("Master"), SUPERVISOR("Sales Supervisor"), CONSULTANT("Sales Consultant") }
enum class Page(val label: String) { HOME("Beranda"), SPK("SPK"), OUTSTANDING("Outstanding"), PROSPECT("Prospek"), SALES("Sales"), ACCOUNTS("Akun") }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF1E5AA8))) { LiveApp() }
        }
    }
}

@Composable
private fun LiveApp() {
    val context = LocalContext.current
    val api = remember { ApiClient(context.applicationContext) }
    var user by remember { mutableStateOf<User?>(null) }
    var changedPassword by remember { mutableStateOf(false) }
    var restoring by remember { mutableStateOf(true) }
    var restoreError by remember { mutableStateOf("") }
    var restoreAttempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(restoreAttempt) {
        restoring = true
        try { user = api.restoreSession(); restoreError = "" }
        catch (e: Exception) {
            if (e is ApiException && e.status == 401) { user = null; restoreError = "" }
            else restoreError = friendly(e)
        } finally { restoring = false }
    }
    when {
        restoring -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        restoreError.isNotBlank() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ErrorText(restoreError)
                Button({ restoreAttempt++ }) { Text("Coba lagi") }
            }
        }
        user == null -> LoginScreen(api, changedPassword) { user = it; changedPassword = false }
        user!!.mustChangePassword -> PasswordScreen(api) { user = null; changedPassword = true }
        else -> MainShell(api, user!!) { user = null }
    }
}

@Composable
private fun LoginScreen(api: ApiClient, passwordChanged: Boolean, onLogin: (User) -> Unit) {
    val scope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(Modifier.widthIn(max = 440.dp)) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Icon(Icons.Default.Groups, null, Modifier.size(48.dp))
                Text("CRM for Team", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text("Masuk dengan akun tim Anda.")
                Field(username, { username = it }, "Username")
                PasswordField(password, { password = it }, "Password")
                if (passwordChanged) Text("Password berhasil diubah. Masuk lagi dengan password baru.", color = Color(0xFF006C4C))
                ErrorText(error)
                Button(onClick = {
                    busy = true; error = ""
                    scope.launch {
                        try { onLogin(api.login(username, password)) }
                        catch (e: Exception) { error = friendly(e) }
                        finally { busy = false }
                    }
                }, enabled = !busy && username.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                    Text(if (busy) "Menghubungkan…" else "Masuk")
                }
            }
        }
    }
}

@Composable
private fun PasswordScreen(api: ApiClient, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var old by remember { mutableStateOf("") }; var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }; var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(Modifier.widthIn(max = 440.dp)) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Ubah password sementara", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Sebelum menggunakan CRM, buat password pribadi. Minimal 12 karakter.")
                listOf(Triple(old, "Password sementara", { v: String -> old = v }),
                    Triple(next, "Password baru", { v: String -> next = v }),
                    Triple(confirm, "Ulangi password baru", { v: String -> confirm = v })).forEach { (value, label, change) ->
                    PasswordField(value, change, label)
                }
                ErrorText(error)
                Button({
                    when {
                        next.length < 12 -> error = "Password baru minimal 12 karakter."
                        next != confirm -> error = "Pengulangan password belum sama."
                        else -> {
                            busy = true; error = ""
                            scope.launch {
                                try { api.changePassword(old, next); done() }
                                catch (e: Exception) { error = friendly(e) }
                                finally { busy = false }
                            }
                        }
                    }
                }, enabled = !busy) { Text(if (busy) "Menyimpan…" else "Ubah password") }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MainShell(api: ApiClient, user: User, loggedOut: () -> Unit) {
    val scope = rememberCoroutineScope()
    var page by remember { mutableStateOf(Page.HOME) }
    var reload by remember { mutableIntStateOf(0) }
    var showNewSpk by remember { mutableStateOf(false) }
    var editingSpk by remember { mutableStateOf<Spk?>(null) }
    var savingSpk by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var users by remember { mutableStateOf(listOf(user)) }
    LaunchedEffect(api.currentUser) { if (api.currentUser == null) loggedOut() }
    val pages = buildList {
        add(Page.HOME); add(Page.SPK); add(Page.OUTSTANDING); add(Page.PROSPECT)
        if (user.role == Role.SUPERVISOR) add(Page.SALES)
        if (user.role == Role.MASTER) add(Page.ACCOUNTS)
    }
    LaunchedEffect(user.id, reload) {
        if (user.role != Role.CONSULTANT) {
            try { users = api.users() } catch (e: Exception) { error = friendly(e) }
        }
    }
    val consultants = if (user.role == Role.CONSULTANT) listOf(user) else users.filter {
        it.role == Role.CONSULTANT && it.active && (it.supervisorId == null || users.any { supervisor -> supervisor.id == it.supervisorId && supervisor.active })
    }
    val inSpkForm = showNewSpk || editingSpk != null
    Scaffold(topBar = {
        TopAppBar(title = { Column { Text("CRM for Team", fontWeight = FontWeight.Bold); Text("${user.displayName} · ${user.role.label}", fontSize = 12.sp) } },
            actions = {
                IconButton({ reload++ }) { Icon(Icons.Default.Refresh, "Muat ulang") }
                IconButton({ scope.launch { try { api.logout() } catch (_: Exception) { api.clearSession() }; loggedOut() } }) {
                    Icon(Icons.Default.Logout, "Keluar") }
            })
    }, bottomBar = {
        if (!inSpkForm) NavigationBar { pages.forEach { item -> NavigationBarItem(page == item, { page = item },
            icon = { Icon(when (item) { Page.HOME -> Icons.Default.Home; Page.SPK -> Icons.Default.Description
                Page.OUTSTANDING -> Icons.Default.Schedule; Page.PROSPECT -> Icons.Default.People
                Page.SALES -> Icons.Default.Groups
                Page.ACCOUNTS -> Icons.Default.ManageAccounts }, null) }, label = { Text(item.label, fontSize = 10.sp) }) } }
    }, floatingActionButton = {
        if (page == Page.SPK && !inSpkForm) FloatingActionButton({ showNewSpk = true }) { Icon(Icons.Default.Add, "Buat SPK") }
    }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (error.isNotBlank()) ErrorBanner(error) { error = "" }
            Box(Modifier.weight(1f)) {
                if (inSpkForm) SpkFormScreen(user, consultants, editingSpk, savingSpk, error,
                    { showNewSpk = false; editingSpk = null; error = "" }) { payload ->
                    savingSpk = true; error = ""
                    scope.launch {
                        try {
                            if (editingSpk == null) api.createSpk(payload)
                            else api.updateSpk(editingSpk!!, payload)
                            showNewSpk = false; editingSpk = null; reload++
                        } catch (e: Exception) { error = friendly(e); if (e is ApiException && e.status == 409) reload++ }
                        finally { savingSpk = false }
                    }
                } else when (page) {
                    Page.HOME -> HomeScreen(api, user, reload) { page = Page.PROSPECT }
                    Page.SPK -> SpkScreen(api, user, users, false, reload, { editingSpk = it }) { reload++ }
                    Page.OUTSTANDING -> SpkScreen(api, user, users, true, reload, { editingSpk = it }) { reload++ }
                    Page.PROSPECT -> ProspectScreen(api, consultants, reload) { reload++ }
                    Page.SALES -> SalesScreen(users, user.id)
                    Page.ACCOUNTS -> AccountsScreen(api, users) { reload++ }
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(api: ApiClient, user: User, reload: Int, openProspects: () -> Unit) {
    var monthTotal by remember { mutableIntStateOf(0) }; var outstandingTotal by remember { mutableIntStateOf(0) }
    var pending by remember { mutableIntStateOf(0) }; var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(user.id, reload) {
        loading = true
        try {
            monthTotal = api.spks(YearMonth.now().toString()).total
            outstandingTotal = api.spks(outstanding = true).total
            pending = allProspects(api).count { it.status == "pending" }
            error = ""
        } catch (e: Exception) { error = friendly(e) }
        finally { loading = false }
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Selamat datang, ${user.displayName}", fontSize = 24.sp, fontWeight = FontWeight.Bold) }
        if (loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (error.isNotBlank()) item { ErrorText(error) }
        if (!loading && error.isBlank()) {
            item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard("SPK bulan ini", monthTotal.toString(), Modifier.weight(1f))
                MetricCard("Outstanding", outstandingTotal.toString(), Modifier.weight(1f))
            } }
            item { Card(Modifier.fillMaxWidth().clickable(onClick = openProspects)) {
                Column(Modifier.padding(16.dp)) { Text("Prospek menunggu tindak lanjut", fontWeight = FontWeight.Bold); Text("$pending prospek pending") }
            } }
        }
    }
}

private suspend fun allProspects(api: ApiClient, month: String? = null, status: String = "all", consultantId: String? = null): List<Prospect> {
    val first = api.prospects(month = month, status = status, consultantId = consultantId)
    val result = first.items.toMutableList()
    for (page in 2..((first.total + 24) / 25)) result += api.prospects(page, month, status, consultantId).items
    return result
}

@Composable private fun MetricCard(label: String, value: String, modifier: Modifier) = Card(modifier) {
    Column(Modifier.padding(16.dp)) { Text(value, fontSize = 30.sp, fontWeight = FontWeight.Bold); Text(label) }
}

@Composable
private fun SpkScreen(api: ApiClient, user: User, users: List<User>, outstanding: Boolean, reload: Int, edit: (Spk) -> Unit, changed: () -> Unit) {
    var month by remember { mutableStateOf(YearMonth.now()) }; var page by remember { mutableIntStateOf(1) }
    var status by remember { mutableStateOf("all") }
    var result by remember { mutableStateOf(PageResult(emptyList<Spk>(), 0)) }
    var loading by remember { mutableStateOf(true) }; var error by remember { mutableStateOf("") }
    LaunchedEffect(outstanding, month, status, page, reload) {
        loading = true
        try {
            val loaded = api.spks(month.toString(), outstanding, page, status)
            val lastPage = ((loaded.total + 24) / 25).coerceAtLeast(1)
            if (page > lastPage) page = lastPage else result = loaded
            error = ""
        }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { result = PageResult(emptyList(), 0); error = friendly(e) }
        finally { loading = false }
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (outstanding) "Outstanding" else "SPK ${month.format(DateTimeFormatter.ofPattern("MMMM yyyy", indonesian))}", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("${result.total} SPK", fontSize = 12.sp)
            }
            if (!outstanding) {
                IconButton({ month = month.minusMonths(1); page = 1 }) { Icon(Icons.Default.ChevronLeft, "Bulan lalu") }
                IconButton({ month = month.plusMonths(1); page = 1 }) { Icon(Icons.Default.ChevronRight, "Bulan berikut") }
            }
        }
        if (!outstanding) Box(Modifier.padding(horizontal = 12.dp)) {
            ChoiceRow("Filter SPK", listOf("All", "Open", "Closed", "Cancelled"), status.replaceFirstChar { it.uppercase() }) {
                status = it.lowercase(); page = 1
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (error.isNotBlank()) ErrorBanner(error) { page = 1; changed() }
        if (!loading && error.isBlank() && result.items.isEmpty()) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { Text("Belum ada SPK.") }
        LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(result.items, key = { it.id }) { item -> SpkCard(api, item, user, edit, changed) }
        }
        if (result.total > 25) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            TextButton({ page-- }, enabled = page > 1) { Text("Sebelumnya") }
            Text("$page / ${(result.total + 24) / 25}")
            TextButton({ page++ }, enabled = page * 25 < result.total) { Text("Berikutnya") }
        }
    }
}

@Composable
private fun SpkCard(api: ApiClient, spk: Spk, user: User, edit: (Spk) -> Unit, changed: () -> Unit) {
    val scope = rememberCoroutineScope(); val clipboard = LocalClipboardManager.current
    var expanded by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var confirmDelete by remember { mutableStateOf(false) }
    fun save(changes: JSONObject) {
        busy = true; error = ""
        scope.launch {
            try { api.updateSpk(spk, changes); changed() }
            catch (e: Exception) { error = friendly(e); if (e is ApiException && e.status == 409) changed() }
            finally { busy = false }
        }
    }
    val cancelled = spk.status == "cancelled"
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(
        containerColor = when (spk.status) { "closed" -> Color(0xFFC8E6C9); "cancelled" -> Color.Black; else -> Color(0xFFFFF3B0) },
        contentColor = if (cancelled) Color.White else Color(0xFF1B1B1B))) {
        Column(Modifier.clickable { expanded = !expanded }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(spk.number, fontWeight = FontWeight.Bold); Text(spk.status.uppercase()) }
            Text(spk.customerName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text("${dateLabel(spk.date)} · ${spk.carType} · ${spk.color}")
            if (error.isNotBlank()) Text(error, color = if (cancelled) Color(0xFFFFB4AB) else MaterialTheme.colorScheme.error)
            if (expanded) {
                HorizontalDivider()
                Text("SPV: ${spk.supervisorName ?: "Tanpa supervisor"}")
                Text("Sales: ${spk.consultantName ?: if (spk.consultantId == user.id) user.displayName else "Tidak diketahui"}")
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Noka: ${spk.vin ?: "Belum dialokasikan"}", Modifier.weight(1f)); if (!spk.vin.isNullOrBlank()) IconButton({ clipboard.setText(AnnotatedString(spk.vin)) }) { Icon(Icons.Default.ContentCopy, "Salin Noka") } }
                Text("Promise Delivery: ${dateRangeLabel(spk.promiseFrom, spk.promiseTo)}")
                Text("Metode Pembayaran: ${spk.payment.uppercase()} - ${if (spk.sameAsOtr) "deal sesuai OTR" else "deal dengan harga ${moneyLabel(spk.dealPrice)}"}")
                FlagControl("CRM: ${yesNo(spk.crmDone)}", spk.crmDone, busy, enabled = !spk.crmDone || !spk.delivered) { save(JSONObject().put("crmDone", it)) }
                if (user.role != Role.CONSULTANT) FlagControl("DMS: ${yesNo(spk.incentiveDms)}", spk.incentiveDms, busy,
                    enabled = !spk.incentiveDms || !spk.delivered) { save(JSONObject().put("incentiveDms", it)) }
                else Text("DMS: ${yesNo(spk.incentiveDms)}")
                if (user.role != Role.CONSULTANT) FlagControl("Lunas: ${yesNo(spk.fullyPaid)}", spk.fullyPaid, busy,
                    enabled = !spk.fullyPaid || (!spk.delivered && !spk.deliveryPlanned)) { save(JSONObject().put("fullyPaid", it)) }
                else Text("Lunas: ${yesNo(spk.fullyPaid)}")
                if (user.role != Role.CONSULTANT) {
                    FlagControl(planDoLabel(spk), spk.deliveryPlanned, busy,
                        enabled = if (spk.deliveryPlanned) !spk.delivered else spk.fullyPaid) {
                        save(JSONObject().put("deliveryPlanned", it).put("planDoDate", if (it) LocalDate.now().toString() else JSONObject.NULL))
                    }
                    if (spk.deliveryPlanned) DateButton("Tanggal Plan DO", spk.planDoDate ?: LocalDate.now(), enabled = !busy) { save(JSONObject().put("planDoDate", it.toString())) }
                    FlagControl("Dikirim: ${yesNo(spk.delivered)}", spk.delivered, busy,
                        enabled = spk.delivered || (spk.fullyPaid && spk.incentiveDms && spk.crmDone)) {
                        val changes = JSONObject().put("delivered", it).put("status", if (it) "closed" else "open")
                            .put("deliveredDate", if (it) LocalDate.now().toString() else JSONObject.NULL)
                        if (it && !spk.deliveryPlanned) changes.put("deliveryPlanned", true).put("planDoDate", LocalDate.now().toString())
                        save(changes)
                    }
                    if (!spk.fullyPaid) Text("Plan DO menunggu Lunas.", fontSize = 12.sp)
                    if (!spk.delivered && !(spk.fullyPaid && spk.incentiveDms && spk.crmDone))
                        Text("Dikirim menunggu Lunas, DMS, dan CRM.", fontSize = 12.sp)
                } else {
                    Text(planDoLabel(spk))
                    Text("Dikirim: ${yesNo(spk.delivered)}")
                }
                TextButton({ edit(spk) }, enabled = !busy, colors = ButtonDefaults.textButtonColors(contentColor = LocalContentColor.current)) { Text("Edit SPK") }
                if (user.role != Role.CONSULTANT) {
                    TextButton({ save(JSONObject().put("status", "cancelled")) }, enabled = !busy && !spk.delivered && !cancelled,
                        colors = ButtonDefaults.textButtonColors(disabledContentColor = LocalContentColor.current.copy(alpha = 0.5f))) { Text("Batalkan SPK") }
                    TextButton({ confirmDelete = true }, enabled = !busy) { Text("Hapus SPK", color = if (cancelled) Color(0xFFFFB4AB) else MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Hapus ${spk.number}?") },
        text = { Text("SPK ini akan dihapus dari server untuk seluruh tim.") },
        confirmButton = { TextButton({
            confirmDelete = false; busy = true
            scope.launch { try { api.deleteSpk(spk.id); changed() } catch (e: Exception) { error = friendly(e) } finally { busy = false } }
        }) { Text("Hapus") } }, dismissButton = { TextButton({ confirmDelete = false }) { Text("Batal") } })
}

@Composable private fun FlagControl(label: String, value: Boolean, busy: Boolean, enabled: Boolean = true, change: (Boolean) -> Unit) =
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(value, change, enabled = !busy && enabled, colors = CheckboxDefaults.colors(
            uncheckedColor = LocalContentColor.current,
            disabledCheckedColor = LocalContentColor.current.copy(alpha = 0.5f),
            disabledUncheckedColor = LocalContentColor.current.copy(alpha = 0.5f)))
        Text(label)
    }
private fun yesNo(value: Boolean) = if (value) "Ya" else "Belum"

private val indonesian = Locale("id", "ID")
private fun dateLabel(date: LocalDate): String = date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", indonesian))
private fun dateRangeLabel(from: LocalDate, to: LocalDate): String =
    if (from.year == to.year) "${from.format(DateTimeFormatter.ofPattern("d MMMM", indonesian))} - ${dateLabel(to)}"
    else "${dateLabel(from)} - ${dateLabel(to)}"
private fun planDoLabel(spk: Spk): String = if (spk.deliveryPlanned)
    "Plan DO: Ya - ${spk.planDoDate?.let(::dateLabel) ?: "Tanggal belum diisi"}"
    else "Plan DO: Belum"
private fun moneyLabel(value: String?): String = value?.toBigDecimalOrNull()?.let {
    NumberFormat.getNumberInstance(indonesian).apply { maximumFractionDigits = 2 }.format(it)
} ?: "Belum diisi"
private fun groupedDigits(value: String): String = value.reversed().chunked(3).joinToString(".").reversed()
private fun wholeMoneyDigits(value: String?): String = value?.toBigDecimalOrNull()?.let {
    runCatching { it.toBigIntegerExact().toString() }.getOrNull()
}.orEmpty()

private val carColors = linkedMapOf(
    "JAECOO J5 PREMIUM" to listOf("PRISTINE WHITE", "JET BLACK", "FOREST GREEN", "IVORY GRAY"),
    "JAECOO J5 STANDAR" to listOf("PRISTINE WHITE", "JET BLACK"),
    "JAECOO J7 SHS" to listOf("PRISTINE WHITE", "JET BLACK", "MOONLIGHT SILVER", "STONE GREY", "PRISTINE WHITE TWO TONE"),
    "JAECOO J7 AWD" to listOf("PRISTINE WHITE", "JET BLACK", "MOONLIGHT SILVER", "STONE GREY", "PRISTINE WHITE TWO TONE"),
    "JAECOO J8 SHS ARDIS" to listOf("PRISTINE WHITE TWO TONE", "JET BLACK", "LUNAR SILVER TWO TONE", "STONE GREY TWO TONE"),
    "JAECOO J8 ARDIS" to listOf("PRISTINE WHITE TWO TONE", "JET BLACK", "LUNAR SILVER TWO TONE", "STONE GREY TWO TONE")
)

@Composable
private fun SpkFormScreen(user: User, consultants: List<User>, edit: Spk?, saving: Boolean, serverError: String,
                          dismiss: () -> Unit, save: (JSONObject) -> Unit) {
    var consultant by remember(edit?.id, consultants) { mutableStateOf(consultants.firstOrNull { it.id == edit?.consultantId } ?: consultants.firstOrNull()) }
    var number by remember(edit?.id) { mutableStateOf(edit?.number?.removePrefix("LOT - ")?.takeIf { it.matches(Regex("\\d{5}")) }.orEmpty()) }
    var customer by remember(edit?.id) { mutableStateOf(edit?.customerName.orEmpty()) }
    var phone by remember(edit?.id) { mutableStateOf(edit?.phone.orEmpty()) }
    var vin by remember(edit?.id) { mutableStateOf(edit?.vin.orEmpty()) }
    var car by remember(edit?.id) { mutableStateOf(edit?.carType?.takeIf { it in carColors } ?: carColors.keys.first()) }
    var color by remember(edit?.id) { mutableStateOf(edit?.color?.takeIf { it in carColors[car].orEmpty() } ?: carColors[car]!!.first()) }
    var qty by remember(edit?.id) { mutableStateOf(edit?.quantity?.toString() ?: "1") }
    var price by remember(edit?.id) { mutableStateOf(wholeMoneyDigits(edit?.dealPrice)) }
    var sameOtr by remember(edit?.id) { mutableStateOf(edit?.sameAsOtr ?: false) }
    var clientType by remember(edit?.id) { mutableStateOf(edit?.clientType ?: "retail") }
    var payment by remember(edit?.id) { mutableStateOf(edit?.payment ?: "cash") }
    var standardBonus by remember(edit?.id) { mutableStateOf(edit == null || edit.bonus == "Bonus standar") }
    var bonus by remember(edit?.id) { mutableStateOf(if (edit == null || edit.bonus == "Bonus standar") "" else edit.bonus) }
    var description by remember(edit?.id) { mutableStateOf(edit?.description.orEmpty()) }
    var tenor by remember(edit?.id) { mutableStateOf(edit?.tenorMonths?.toString().orEmpty()) }
    var tdp by remember(edit?.id) { mutableStateOf(wholeMoneyDigits(edit?.tdp)) }
    var insurance by remember(edit?.id) { mutableStateOf(edit?.insurance ?: "Combine") }
    var date by remember(edit?.id) { mutableStateOf(edit?.date ?: LocalDate.now()) }
    var from by remember(edit?.id) { mutableStateOf(edit?.promiseFrom ?: LocalDate.now()) }
    var to by remember(edit?.id) { mutableStateOf(edit?.promiseTo ?: LocalDate.now()) }
    var refund by remember(edit?.id) { mutableStateOf(edit?.refundCredit ?: false) }
    var csi by remember(edit?.id) { mutableStateOf(edit?.incentiveCsi ?: false) }
    var error by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(dismiss) { Text("← Kembali") }
        Text(if (edit == null) "Buat SPK" else "Edit SPK", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        if (edit == null && user.role != Role.CONSULTANT)
            DropdownField("Sales", consultant?.displayName ?: "Pilih", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
        else Text("Sales: ${edit?.consultantName ?: user.displayName}")
        if (user.role != Role.CONSULTANT) Field(vin, { vin = it }, "Noka")
        else if (!edit?.vin.isNullOrBlank()) Text("Noka: ${edit?.vin}")
        OutlinedTextField(number, { number = it.filter(Char::isDigit).take(5) }, label = { Text("Nomor SPK (5 angka) *") },
            supportingText = { Text("LOT - ${number.padEnd(5, '_')}") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Field(customer, { customer = it }, "Nama pelanggan *")
        OutlinedTextField(phone, { phone = it.filter(Char::isDigit) }, label = { Text("Nomor telepon *") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        ChoiceRow("Jenis klien", listOf("retail", "fleet"), clientType) { clientType = it }
        Text("Dokumen belum dapat diunggah. Simpan dokumen identitas di tempat aman sesuai aturan tim.", color = Color.Gray)
        DropdownField("Tipe mobil", car, carColors.keys.toList()) { selected -> car = selected; color = carColors[selected]!!.first() }
        DropdownField("Warna", color, carColors[car].orEmpty()) { color = it }
        OutlinedTextField(qty, { qty = it.filter(Char::isDigit) }, label = { Text("Jumlah *") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        FlagControl("Harga sama dengan OTR", sameOtr, false) { sameOtr = it }
        if (!sameOtr) OutlinedTextField(groupedDigits(price), { price = it.filter(Char::isDigit).take(16) },
            label = { Text("Harga deal *") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        ChoiceRow("Metode Pembayaran", listOf("cash", "credit", "cop"), payment) { payment = it }
        if (payment == "credit") {
            OutlinedTextField(tenor, { tenor = it.filter(Char::isDigit) }, label = { Text("Tenor (bulan) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(groupedDigits(tdp), { tdp = it.filter(Char::isDigit).take(16) }, label = { Text("TDP *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
            DropdownField("Asuransi", insurance, listOf("Combine", "All risk full tenor", "All risk perluasan full tenor")) { insurance = it }
        }
        FlagControl("Bonus standar", standardBonus, false) { standardBonus = it }
        if (!standardBonus) Field(bonus, { bonus = it }, "Bonus dari sales atau event *")
        Field(description, { description = it }, "Deskripsi")
        DateButton("Tanggal SPK", date) { date = it }
        DateButton("Promise Delivery mulai", from) { from = it; if (to < it) to = it }
        DateButton("Promise Delivery sampai", to) { to = it }
        if (edit != null && user.role != Role.CONSULTANT) {
            Text("Status tambahan", fontWeight = FontWeight.Bold)
            FlagControl("Refund kredit cair", refund, false) { refund = it }
            FlagControl("Insentif CSI cair", csi, false) { csi = it }
        }
        ErrorText(error)
        ErrorText(serverError)
        Button({
            when {
                edit == null && consultant == null -> error = "Pilih sales."
                number.length != 5 -> error = "Nomor SPK harus tepat 5 angka."
                customer.isBlank() || phone.isBlank() || (!standardBonus && bonus.isBlank()) -> error = "Lengkapi kolom bertanda *."
                qty.toIntOrNull()?.let { it > 0 } != true -> error = "Jumlah harus lebih dari nol."
                to < from -> error = "Tanggal akhir Promise Delivery terlalu awal."
                !sameOtr && (price.isBlank() || price.length > 16) -> error = "Harga deal harus angka."
                payment == "credit" && (tenor.toIntOrNull()?.let { it in 1..600 } != true || tdp.isBlank()) -> error = "Isi tenor dan TDP berupa angka."
                else -> {
                    error = ""
                    val body = JSONObject().put("number", "LOT - $number").put("date", date.toString())
                        .put("customerName", customer.trim()).put("clientType", clientType).put("phone", phone.trim())
                        .put("carType", car).put("color", color).put("quantity", qty.toInt()).put("sameAsOtr", sameOtr)
                        .put("dealPrice", if (sameOtr) JSONObject.NULL else price).put("payment", payment)
                        .put("bonus", if (standardBonus) "Bonus standar" else bonus.trim()).put("description", description.trim())
                        .put("promiseFrom", from.toString()).put("promiseTo", to.toString())
                    if (edit == null) body.put("consultantId", consultant!!.id)
                    if (user.role != Role.CONSULTANT) body.put("vin", vin.trim().ifBlank { JSONObject.NULL })
                    if (payment == "credit") body.put("tenorMonths", tenor.toInt()).put("tdp", tdp).put("insurance", insurance)
                    else body.put("tenorMonths", JSONObject.NULL).put("tdp", JSONObject.NULL).put("insurance", JSONObject.NULL)
                    if (edit != null && user.role != Role.CONSULTANT) body.put("refundCredit", refund).put("incentiveCsi", csi)
                    save(body)
                }
            }
        }, enabled = !saving, modifier = Modifier.fillMaxWidth()) { Text(if (saving) "Menyimpan…" else "Simpan SPK") }
    }
}

@Composable
private fun ProspectScreen(api: ApiClient, consultants: List<User>, reload: Int, changed: () -> Unit) {
    val scope = rememberCoroutineScope()
    var consultant by remember(consultants) { mutableStateOf(consultants.firstOrNull()) }
    var month by remember { mutableStateOf(YearMonth.now()) }
    var completed by remember { mutableStateOf(false) }
    var prospects by remember { mutableStateOf(emptyList<Prospect>()) }; var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }; var showAdd by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf<String?>(null) }; var history by remember { mutableStateOf(emptyList<ProspectHistory>()) }
    var historyLoading by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(reload, month, completed, consultant?.id) {
        loading = true
        prospects = emptyList(); expanded = null; history = emptyList()
        try {
            prospects = if (consultant == null) emptyList() else allProspects(api, month.toString(), if (completed) "completed" else "running", consultant!!.id)
            error = ""
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { prospects = emptyList(); error = friendly(e) }
        finally { loading = false }
    }
    LaunchedEffect(expanded) {
        history = emptyList()
        val id = expanded ?: return@LaunchedEffect
        historyLoading = true
        try { history = api.prospectHistory(id) }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { error = friendly(e) }
        finally { historyLoading = false }
    }
    fun update(item: Prospect, changes: JSONObject) {
        busy = true; error = ""
        scope.launch {
            try { api.updateProspect(item.id, changes); changed() }
            catch (e: Exception) { error = friendly(e) }
            finally { busy = false }
        }
    }
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Prospek", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        ChoiceRow("Filter prospek", listOf("Prospek berjalan", "Prospek selesai"), if (completed) "Prospek selesai" else "Prospek berjalan") {
            completed = it == "Prospek selesai"
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton({ month = month.minusMonths(1) }) { Icon(Icons.Default.ChevronLeft, "Bulan lalu") }
            Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy", indonesian)), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
            IconButton({ month = month.plusMonths(1) }) { Icon(Icons.Default.ChevronRight, "Bulan berikut") }
        }
        Text("Bulan berdasarkan tanggal prospek dibuat.", fontSize = 12.sp)
        if (consultants.size > 1) DropdownField("Sales", consultant?.displayName ?: "Pilih", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
        if (!completed) Button({ showAdd = true }, enabled = consultant != null && !busy) { Text("Tambah prospek") }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        ErrorText(error)
        if (!loading && error.isBlank() && prospects.isEmpty()) Text(if (completed) "Belum ada prospek selesai pada bulan ini." else "Belum ada prospek berjalan pada bulan ini.")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(prospects, key = { it.id }) { item ->
                var want by remember(item.id, item.want) { mutableStateOf(item.want) }
                var stage by remember(item.id, item.stage) { mutableStateOf(item.stage) }
                Card(Modifier.fillMaxWidth().clickable {
                    expanded = if (expanded == item.id) null else item.id
                }, colors = CardDefaults.cardColors(
                    containerColor = when (item.status) {
                        "berhasil" -> Color(0xFFC8E6C9)
                        "gagal" -> Color(0xFFFFDAD6)
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    }, contentColor = Color(0xFF1B1B1B))) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.name, fontWeight = FontWeight.Bold); Text("Mau: ${item.want}"); Text("Tahap: ${item.stage}")
                        if (item.status != "pending") Text(if (item.status == "berhasil") "Berhasil · Arsip" else "Gagal · Arsip", fontWeight = FontWeight.SemiBold)
                        if (expanded == item.id) {
                            Text("Riwayat", fontWeight = FontWeight.Bold)
                            if (historyLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
                            history.forEach { Text("${runCatching { dateLabel(LocalDate.parse(it.createdAt)) }.getOrDefault(it.createdAt)}: ${it.want} — ${it.stage}", fontSize = 12.sp) }
                            if (item.status == "pending") {
                                Field(want, { want = it }, "Mau apa berikutnya"); Field(stage, { stage = it }, "Tahap berikutnya")
                                Button({ update(item, JSONObject().put("want", want).put("stage", stage)) }, enabled = !busy && want.isNotBlank() && stage.isNotBlank()) { Text("Simpan tindak lanjut") }
                                Row {
                                    TextButton({ update(item, JSONObject().put("status", "berhasil")) }, enabled = !busy) { Text("Berhasil") }
                                    TextButton({ update(item, JSONObject().put("status", "gagal")) }, enabled = !busy) { Text("Gagal") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (showAdd && consultant != null) AddProspectDialog(consultant!!, { showAdd = false }) { name, want, stage ->
        scope.launch { try {
            api.createProspect(consultant!!.id, name, want, stage)
            showAdd = false; completed = false; month = YearMonth.now(); changed()
        } catch (e: Exception) { error = friendly(e) } }
    }
}

@Composable
private fun AddProspectDialog(consultant: User, dismiss: () -> Unit, save: (String, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }; var want by remember { mutableStateOf("") }; var stage by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("Prospek untuk ${consultant.displayName}") },
        text = { Column { Field(name, { name = it }, "Nama"); Field(want, { want = it }, "Mau apa"); Field(stage, { stage = it }, "Tahap") } },
        confirmButton = { Button({ save(name.trim(), want.trim(), stage.trim()) }, enabled = listOf(name, want, stage).all { it.isNotBlank() }) { Text("Tambah") } },
        dismissButton = { TextButton(dismiss) { Text("Batal") } })
}

@Composable
private fun AccountsScreen(api: ApiClient, users: List<User>, changed: () -> Unit) {
    var showAdd by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<String?>(null) }
    var resetUser by remember { mutableStateOf<User?>(null) }
    var deleteUser by remember { mutableStateOf<User?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun act(account: User, action: String) {
        busy = true; error = ""
        scope.launch {
            try { api.accountAction(account.id, action); changed() }
            catch (e: Exception) { error = friendly(e) }
            finally { busy = false }
        }
    }
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Kelola akun", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Button({ showAdd = true }) { Text("Buat akun") }
        }
        ErrorText(error)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(users.filter { it.role != Role.CONSULTANT }, key = { it.id }) { account ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.fillMaxWidth().clickable { selected = if (selected == account.id) null else account.id }) {
                        Text(account.displayName, fontWeight = FontWeight.Bold)
                        Text("${account.username} · ${account.role.label}")
                        AccountStatus(account)
                    }
                    if (selected == account.id) {
                        AccountActions(account, busy, account.id != api.currentUser?.id,
                            { act(account, if (account.active) "disable" else "enable") }, { error = ""; resetUser = account })
                        if (account.id != api.currentUser?.id) TextButton({ deleteUser = account }, enabled = !busy) {
                            Text("Hapus akun", color = MaterialTheme.colorScheme.error)
                        }
                        if (account.role == Role.SUPERVISOR) {
                            HorizontalDivider()
                            Text("Sales", fontWeight = FontWeight.Bold)
                            val team = users.filter { it.role == Role.CONSULTANT && it.supervisorId == account.id }
                            if (team.isEmpty()) Text("Belum ada sales consultant.")
                            if (!account.active && team.isNotEmpty()) Text("Sales di bawah supervisor ini tidak dapat masuk sampai supervisor diaktifkan.", fontSize = 12.sp)
                            team.forEach { consultant ->
                                ConsultantAccountCard(consultant, busy,
                                    { act(consultant, if (consultant.active) "disable" else "enable") },
                                    { error = ""; resetUser = consultant }, { deleteUser = consultant })
                            }
                        }
                    }
                } }
            }
            val orphans = users.filter { it.role == Role.CONSULTANT && it.supervisorId == null }
            if (orphans.isNotEmpty()) item { Text("Sales tanpa supervisor", fontWeight = FontWeight.Bold) }
            items(orphans, key = { it.id }) { consultant ->
                ConsultantAccountCard(consultant, busy,
                    { act(consultant, if (consultant.active) "disable" else "enable") },
                    { error = ""; resetUser = consultant }, { deleteUser = consultant })
            }
        }
    }
    if (showAdd) AddAccountDialog(users, { showAdd = false }) { username, name, role, supervisorId, password ->
        scope.launch { try { api.createUser(username, name, role, supervisorId, password); showAdd = false; changed() }
            catch (e: Exception) { error = friendly(e) } }
    }
    resetUser?.let { account -> ResetPasswordDialog(account, busy, error, { resetUser = null }) { password ->
        busy = true; error = ""
        scope.launch {
            try { api.accountAction(account.id, "resetPassword", password); resetUser = null; changed() }
            catch (e: Exception) { error = friendly(e) }
            finally { busy = false }
        }
    } }
    deleteUser?.let { account -> AlertDialog(onDismissRequest = { deleteUser = null },
        title = { Text("Hapus akun ${account.displayName}?") },
        text = { Text(if (account.role == Role.SUPERVISOR)
            "Sales di bawah supervisor ini akan menjadi tanpa supervisor. Riwayat SPK tetap menyimpan nama supervisor dan sales. Akun tidak dapat masuk lagi."
            else "Akun tidak dapat masuk lagi. SPK dan prospek tetap tersimpan dengan nama sales.") },
        confirmButton = { TextButton({
            busy = true; error = ""
            scope.launch {
                try { api.deleteUser(account.id); deleteUser = null; changed() }
                catch (e: Exception) { error = friendly(e) }
                finally { busy = false }
            }
        }, enabled = !busy) { Text("Hapus") } },
        dismissButton = { TextButton({ deleteUser = null }) { Text("Batal") } }) }
}

@Composable
private fun AccountStatus(account: User) {
    val status = when {
        !account.active -> "Nonaktif"
        account.mustChangePassword -> "Menunggu perubahan password"
        else -> "Aktif"
    }
    Text(status, color = if (account.active) Color(0xFF006C4C) else MaterialTheme.colorScheme.error, fontSize = 12.sp)
}

@Composable
private fun AccountActions(account: User, busy: Boolean, canToggle: Boolean, toggle: () -> Unit, reset: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(toggle, enabled = !busy && canToggle) { Text(if (account.active) "Nonaktifkan" else "Aktifkan") }
        OutlinedButton(reset, enabled = !busy) { Text("Reset password") }
    }
}

@Composable
private fun ConsultantAccountCard(account: User, busy: Boolean, toggle: () -> Unit, reset: () -> Unit, delete: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(Modifier.fillMaxWidth().clickable { open = !open }) {
            Text(account.displayName, fontWeight = FontWeight.SemiBold)
            Text(account.username, fontSize = 12.sp)
            AccountStatus(account)
            Text("SPK bulan ini: ${account.currentMonthSpks} · Prospek berjalan: ${account.runningProspects}")
        }
        if (open) {
            AccountActions(account, busy, true, toggle, reset)
            TextButton(delete, enabled = !busy) { Text("Hapus akun", color = MaterialTheme.colorScheme.error) }
        }
    } }
}

@Composable
private fun SalesScreen(users: List<User>, supervisorId: String) {
    val team = users.filter { it.role == Role.CONSULTANT && it.supervisorId == supervisorId }
    LazyColumn(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Sales", fontSize = 24.sp, fontWeight = FontWeight.Bold) }
        if (team.isEmpty()) item { Text("Belum ada sales consultant.") }
        items(team, key = { it.id }) { account -> Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(account.displayName, fontWeight = FontWeight.Bold)
                AccountStatus(account)
                Text("SPK bulan ini: ${account.currentMonthSpks}")
                Text("Prospek berjalan: ${account.runningProspects}")
            }
        } }
    }
}

@Composable
private fun ResetPasswordDialog(account: User, busy: Boolean, serverError: String, dismiss: () -> Unit, save: (String) -> Unit) {
    var password by remember(account.id) { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("Reset password ${account.displayName}") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Buat password sementara. Berikan kepada pemilik akun agar ia dapat masuk dan membuat password baru.")
            PasswordField(password, { password = it }, "Password sementara")
            ErrorText(error)
            ErrorText(serverError)
        } },
        confirmButton = { Button({ if (password.length < 12) error = "Minimal 12 karakter." else save(password) }, enabled = !busy) { Text("Reset") } },
        dismissButton = { TextButton(dismiss) { Text("Batal") } })
}

@Composable
private fun AddAccountDialog(users: List<User>, dismiss: () -> Unit, save: (String, String, Role, String?, String) -> Unit) {
    var username by remember { mutableStateOf("") }; var name by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }; var role by remember { mutableStateOf(Role.CONSULTANT) }
    val supervisors = users.filter { it.role == Role.SUPERVISOR && it.active }
    var supervisor by remember(supervisors) { mutableStateOf(supervisors.firstOrNull()) }
    var error by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("Buat akun") }, text = {
        Column(Modifier.heightIn(max = 550.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Field(name, { name = it }, "Nama"); Field(username, { username = it }, "Username")
            PasswordField(password, { password = it }, "Password sementara")
            ChoiceRow("Peran", listOf(Role.SUPERVISOR.label, Role.CONSULTANT.label), role.label) { role = Role.entries.first { r -> r.label == it } }
            if (role == Role.CONSULTANT) DropdownField("Supervisor", supervisor?.displayName ?: "Belum ada", supervisors.map { it.displayName }) { n -> supervisor = supervisors.first { it.displayName == n } }
            Text("Pemilik akun akan diminta mengganti password saat masuk pertama kali.", fontSize = 12.sp)
            ErrorText(error)
        }
    }, confirmButton = { Button({
        when {
            username.isBlank() || name.isBlank() || password.length < 12 -> error = "Isi semua kolom. Password minimal 12 karakter."
            role == Role.CONSULTANT && supervisor == null -> error = "Pilih supervisor."
            else -> save(username, name, role, supervisor?.id, password)
        }
    }) { Text("Simpan") } }, dismissButton = { TextButton(dismiss) { Text("Batal") } })
}

@Composable private fun Field(value: String, change: (String) -> Unit, label: String) =
    OutlinedTextField(value, change, label = { Text(label) }, modifier = Modifier.fillMaxWidth())

@Composable private fun PasswordField(value: String, change: (String) -> Unit, label: String) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(value, change, label = { Text(label) }, singleLine = true,
        visualTransformation = if (visible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = { IconButton({ visible = !visible }) {
            Icon(if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                if (visible) "Sembunyikan password" else "Lihat password")
        } }, modifier = Modifier.fillMaxWidth())
}

@Composable private fun ChoiceRow(label: String, values: List<String>, selected: String, change: (String) -> Unit) {
    Column { Text(label, fontWeight = FontWeight.SemiBold); Row(Modifier.horizontalScroll(rememberScrollState())) {
        values.forEach { FilterChip(selected == it, { change(it) }, { Text(it) }); Spacer(Modifier.width(6.dp)) }
    } }
}

@Composable private fun DropdownField(label: String, selected: String, options: List<String>, changed: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box { OutlinedButton({ open = true }, Modifier.fillMaxWidth()) { Text("$label: $selected", Modifier.weight(1f)); Icon(Icons.Default.ArrowDropDown, null) }
        DropdownMenu(open, { open = false }) { options.forEach { DropdownMenuItem(text = { Text(it) }, onClick = { changed(it); open = false }) } }
    }
}

@Composable private fun DateButton(label: String, value: LocalDate, enabled: Boolean = true, changed: (LocalDate) -> Unit) {
    val context = LocalContext.current
    OutlinedButton({ DatePickerDialog(context, { _, y, m, d -> changed(LocalDate.of(y, m + 1, d)) },
        value.year, value.monthValue - 1, value.dayOfMonth).show() }, Modifier.fillMaxWidth(), enabled = enabled) { Text("$label: ${dateLabel(value)}") }
}

@Composable private fun ErrorText(message: String) { if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error) }
@Composable private fun ErrorBanner(message: String, retry: () -> Unit) { Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
    Text(message, Modifier.weight(1f), color = MaterialTheme.colorScheme.error); TextButton(retry) { Text("Coba lagi") }
} }

private fun friendly(e: Exception): String = when (e) {
    is ApiException -> when (e.status) {
        401 -> "Login atau sesi tidak valid. ${e.message}"
        409 -> "Data berubah atau sudah ada. Muat ulang lalu coba lagi."
        else -> "Server: ${e.message}"
    }
    else -> "Tidak dapat menghubungi server. Periksa internet lalu coba lagi."
}

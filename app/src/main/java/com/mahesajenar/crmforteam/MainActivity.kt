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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

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
    val api = remember { ApiClient() }
    var user by remember { mutableStateOf<User?>(null) }
    var changedPassword by remember { mutableStateOf(false) }
    when {
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
    var savingSpk by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var users by remember { mutableStateOf(listOf(user)) }
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
        it.role == Role.CONSULTANT && it.active && users.any { supervisor -> supervisor.id == it.supervisorId && supervisor.active }
    }
    Scaffold(topBar = {
        TopAppBar(title = { Column { Text("CRM for Team", fontWeight = FontWeight.Bold); Text("${user.displayName} · ${user.role.label}", fontSize = 12.sp) } },
            actions = {
                IconButton({ reload++ }) { Icon(Icons.Default.Refresh, "Muat ulang") }
                IconButton({ scope.launch { try { api.logout() } catch (_: Exception) { api.clearSession() }; loggedOut() } }) {
                    Icon(Icons.Default.Logout, "Keluar") }
            })
    }, bottomBar = {
        NavigationBar { pages.forEach { item -> NavigationBarItem(page == item, { page = item },
            icon = { Icon(when (item) { Page.HOME -> Icons.Default.Home; Page.SPK -> Icons.Default.Description
                Page.OUTSTANDING -> Icons.Default.Schedule; Page.PROSPECT -> Icons.Default.People
                Page.SALES -> Icons.Default.Groups
                Page.ACCOUNTS -> Icons.Default.ManageAccounts }, null) }, label = { Text(item.label, fontSize = 10.sp) }) } }
    }, floatingActionButton = {
        if (page == Page.SPK) FloatingActionButton({ showNewSpk = true }) { Icon(Icons.Default.Add, "Buat SPK") }
    }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (error.isNotBlank()) ErrorBanner(error) { error = "" }
            Box(Modifier.weight(1f)) {
                when (page) {
                    Page.HOME -> HomeScreen(api, user, reload) { page = Page.PROSPECT }
                    Page.SPK -> SpkScreen(api, user, users, false, reload) { reload++ }
                    Page.OUTSTANDING -> SpkScreen(api, user, users, true, reload) { reload++ }
                    Page.PROSPECT -> ProspectScreen(api, consultants, reload) { reload++ }
                    Page.SALES -> SalesScreen(users, user.id)
                    Page.ACCOUNTS -> AccountsScreen(api, users) { reload++ }
                }
            }
        }
    }
    if (showNewSpk) NewSpkDialog(user, consultants, savingSpk, { showNewSpk = false }) { payload ->
        savingSpk = true
        scope.launch {
            try { api.createSpk(payload); showNewSpk = false; reload++ }
            catch (e: Exception) { error = friendly(e) }
            finally { savingSpk = false }
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

private suspend fun allProspects(api: ApiClient): List<Prospect> {
    val first = api.prospects()
    val result = first.items.toMutableList()
    for (page in 2..((first.total + 24) / 25)) result += api.prospects(page).items
    return result
}

@Composable private fun MetricCard(label: String, value: String, modifier: Modifier) = Card(modifier) {
    Column(Modifier.padding(16.dp)) { Text(value, fontSize = 30.sp, fontWeight = FontWeight.Bold); Text(label) }
}

@Composable
private fun SpkScreen(api: ApiClient, user: User, users: List<User>, outstanding: Boolean, reload: Int, changed: () -> Unit) {
    var month by remember { mutableStateOf(YearMonth.now()) }; var page by remember { mutableIntStateOf(1) }
    var result by remember { mutableStateOf(PageResult(emptyList<Spk>(), 0)) }
    var loading by remember { mutableStateOf(true) }; var error by remember { mutableStateOf("") }
    LaunchedEffect(outstanding, month, page, reload) {
        loading = true
        try { result = api.spks(month.toString(), outstanding, page); error = "" }
        catch (e: Exception) { result = PageResult(emptyList(), 0); error = friendly(e) }
        finally { loading = false }
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (outstanding) "Outstanding" else "SPK ${month.format(DateTimeFormatter.ofPattern("MMMM yyyy"))}", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("${result.total} SPK", fontSize = 12.sp)
            }
            if (!outstanding) {
                IconButton({ month = month.minusMonths(1); page = 1 }) { Icon(Icons.Default.ChevronLeft, "Bulan lalu") }
                IconButton({ month = month.plusMonths(1); page = 1 }) { Icon(Icons.Default.ChevronRight, "Bulan berikut") }
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (error.isNotBlank()) ErrorBanner(error) { page = 1; changed() }
        if (!loading && error.isBlank() && result.items.isEmpty()) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { Text("Belum ada SPK.") }
        LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(result.items, key = { it.id }) { item -> SpkCard(api, item, user, users, changed) }
        }
        if (result.total > 25) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            TextButton({ page-- }, enabled = page > 1) { Text("Sebelumnya") }
            Text("$page / ${(result.total + 24) / 25}")
            TextButton({ page++ }, enabled = page * 25 < result.total) { Text("Berikutnya") }
        }
    }
}

@Composable
private fun SpkCard(api: ApiClient, spk: Spk, user: User, users: List<User>, changed: () -> Unit) {
    val scope = rememberCoroutineScope(); val clipboard = LocalClipboardManager.current
    var expanded by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var confirmDelete by remember { mutableStateOf(false) }
    var vin by remember(spk.id, spk.revision) { mutableStateOf(spk.vin.orEmpty()) }
    fun save(changes: JSONObject) {
        busy = true; error = ""
        scope.launch {
            try { api.updateSpk(spk, changes); changed() }
            catch (e: Exception) { error = friendly(e); if (e is ApiException && e.status == 409) changed() }
            finally { busy = false }
        }
    }
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = if (!spk.crmDone) Color(0xFFFFE9E8) else Color.White)) {
        Column(Modifier.clickable { expanded = !expanded }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(spk.number, fontWeight = FontWeight.Bold); Text(spk.status.uppercase()) }
            Text(spk.customerName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text("${spk.date} · ${spk.carType} · ${spk.color}")
            Row(verticalAlignment = Alignment.CenterVertically) { Text("CRM selesai", Modifier.weight(1f)); Switch(spk.crmDone, { save(JSONObject().put("crmDone", it)) }, enabled = !busy) }
            ErrorText(error)
            if (expanded) {
                HorizontalDivider()
                Text("Sales: ${users.firstOrNull { it.id == spk.consultantId }?.displayName ?: if (spk.consultantId == user.id) user.displayName else spk.consultantId}")
                Row(verticalAlignment = Alignment.CenterVertically) { Text("VIN: ${spk.vin ?: "Belum dialokasikan"}", Modifier.weight(1f)); if (!spk.vin.isNullOrBlank()) IconButton({ clipboard.setText(AnnotatedString(spk.vin)) }) { Icon(Icons.Default.ContentCopy, "Salin VIN") } }
                Text("Janji kirim: ${spk.promiseFrom} s.d. ${spk.promiseTo}")
                Text("Pembayaran: ${spk.payment.uppercase()} · ${spk.dealPrice ?: "Sama dengan OTR"}")
                Text("Lunas: ${yesNo(spk.fullyPaid)} · Pengiriman direncanakan: ${yesNo(spk.deliveryPlanned)}")
                Text("Dikirim: ${yesNo(spk.delivered)} · CRM: ${yesNo(spk.crmDone)}")
                if (user.role != Role.CONSULTANT) {
                    OutlinedTextField(vin, { vin = it }, label = { Text("VIN") }, modifier = Modifier.fillMaxWidth())
                    Button({ save(JSONObject().put("vin", vin.trim().ifBlank { JSONObject.NULL }).put("vinAllocated", if (vin.isBlank()) JSONObject.NULL else LocalDate.now().toString())) }, enabled = !busy) { Text("Simpan VIN") }
                    FlagControl("Sudah lunas", spk.fullyPaid, busy) { save(JSONObject().put("fullyPaid", it)) }
                    FlagControl("Pengiriman direncanakan", spk.deliveryPlanned, busy) { save(JSONObject().put("deliveryPlanned", it)) }
                    FlagControl("Sudah dikirim", spk.delivered, busy) { save(JSONObject().put("delivered", it).put("status", if (it) "closed" else "open").put("deliveredDate", if (it) LocalDate.now().toString() else JSONObject.NULL)) }
                    FlagControl("Refund kredit cair", spk.refundCredit, busy) { save(JSONObject().put("refundCredit", it)) }
                    FlagControl("Insentif DMS cair", spk.incentiveDms, busy) { save(JSONObject().put("incentiveDms", it)) }
                    FlagControl("Insentif CSI cair", spk.incentiveCsi, busy) { save(JSONObject().put("incentiveCsi", it)) }
                    TextButton({ save(JSONObject().put("status", "cancelled")) }, enabled = !busy && !spk.delivered) { Text("Batalkan SPK") }
                    TextButton({ confirmDelete = true }, enabled = !busy) { Text("Hapus SPK", color = MaterialTheme.colorScheme.error) }
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

@Composable private fun FlagControl(label: String, value: Boolean, busy: Boolean, change: (Boolean) -> Unit) =
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(value, change, enabled = !busy); Text(label) }
private fun yesNo(value: Boolean) = if (value) "Ya" else "Belum"

@Composable
private fun NewSpkDialog(user: User, consultants: List<User>, saving: Boolean, dismiss: () -> Unit, save: (JSONObject) -> Unit) {
    var consultant by remember(consultants) { mutableStateOf(consultants.firstOrNull()) }
    var number by remember { mutableStateOf("") }; var customer by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }; var car by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }; var qty by remember { mutableStateOf("1") }
    var price by remember { mutableStateOf("") }; var sameOtr by remember { mutableStateOf(false) }
    var clientType by remember { mutableStateOf("retail") }; var payment by remember { mutableStateOf("cash") }
    var bonus by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }
    var tenor by remember { mutableStateOf("") }; var tdp by remember { mutableStateOf("") }
    var insurance by remember { mutableStateOf("Combine") }
    var date by remember { mutableStateOf(LocalDate.now()) }; var from by remember { mutableStateOf(LocalDate.now()) }
    var to by remember { mutableStateOf(LocalDate.now()) }; var error by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("Buat SPK") }, confirmButton = {}, text = {
        Column(Modifier.fillMaxWidth().heightIn(max = 640.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (user.role != Role.CONSULTANT) DropdownField("Sales", consultant?.displayName ?: "Pilih", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
            else Text("Sales: ${user.displayName}")
            Field(number, { number = it }, "Nomor SPK *"); Field(customer, { customer = it }, "Nama pelanggan *")
            Field(phone, { phone = it }, "Nomor telepon *")
            ChoiceRow("Jenis klien", listOf("retail", "fleet"), clientType) { clientType = it }
            Text("Dokumen belum dapat diunggah. Simpan dokumen identitas di tempat aman sesuai aturan tim.", color = Color.Gray)
            Field(car, { car = it }, "Tipe mobil *"); Field(color, { color = it }, "Warna *")
            Field(qty, { qty = it.filter(Char::isDigit) }, "Jumlah *")
            FlagControl("Harga sama dengan OTR", sameOtr, false) { sameOtr = it }
            if (!sameOtr) Field(price, { price = it }, "Harga deal (angka) *")
            ChoiceRow("Pembayaran", listOf("cash", "credit", "cop"), payment) { payment = it }
            if (payment == "credit") {
                Field(tenor, { tenor = it.filter(Char::isDigit) }, "Tenor (bulan) *")
                Field(tdp, { tdp = it }, "TDP (angka) *")
                DropdownField("Asuransi", insurance, listOf("Combine", "All risk full tenor", "All risk perluasan full tenor")) { insurance = it }
            }
            Field(bonus, { bonus = it }, "Bonus *"); Field(description, { description = it }, "Deskripsi")
            DateButton("Tanggal SPK", date) { date = it }
            DateButton("Janji kirim mulai", from) { from = it; if (to < it) to = it }
            DateButton("Janji kirim sampai", to) { to = it }
            ErrorText(error)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(dismiss) { Text("Batal") }
                Button({
                    when {
                        consultant == null -> error = "Pilih sales."
                        listOf(number, customer, phone, car, color, bonus).any { it.isBlank() } -> error = "Lengkapi kolom bertanda *."
                        qty.toIntOrNull()?.let { it > 0 } != true -> error = "Jumlah harus lebih dari nol."
                        to < from -> error = "Tanggal akhir janji kirim terlalu awal."
                        !sameOtr && !price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) -> error = "Harga deal harus angka tanpa Rp atau titik ribuan."
                        payment == "credit" && (tenor.toIntOrNull()?.let { it in 1..600 } != true || !tdp.matches(Regex("\\d{1,16}(\\.\\d{1,2})?"))) -> error = "Isi tenor dalam bulan dan TDP berupa angka."
                        else -> {
                            val body = JSONObject().put("number", number.trim()).put("date", date.toString())
                                .put("customerName", customer.trim()).put("consultantId", consultant!!.id)
                                .put("clientType", clientType).put("phone", phone.trim()).put("carType", car.trim())
                                .put("color", color.trim()).put("quantity", qty.toInt()).put("sameAsOtr", sameOtr)
                                .put("dealPrice", if (sameOtr) JSONObject.NULL else price).put("payment", payment)
                                .put("bonus", bonus.trim()).put("description", description.trim())
                                .put("promiseFrom", from.toString()).put("promiseTo", to.toString())
                            if (payment == "credit") body.put("tenorMonths", tenor.toInt()).put("tdp", tdp).put("insurance", insurance)
                            save(body)
                        }
                    }
                }, enabled = !saving) { Text(if (saving) "Menyimpan…" else "Simpan") }
            }
        }
    })
}

@Composable
private fun ProspectScreen(api: ApiClient, consultants: List<User>, reload: Int, changed: () -> Unit) {
    val scope = rememberCoroutineScope()
    var consultant by remember(consultants) { mutableStateOf(consultants.firstOrNull()) }
    var prospects by remember { mutableStateOf(emptyList<Prospect>()) }; var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }; var showAdd by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf<String?>(null) }; var history by remember { mutableStateOf(emptyList<ProspectHistory>()) }
    LaunchedEffect(reload) {
        loading = true
        try { prospects = allProspects(api); error = "" } catch (e: Exception) { prospects = emptyList(); error = friendly(e) }
        finally { loading = false }
    }
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Prospek", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        if (consultants.size > 1) DropdownField("Sales", consultant?.displayName ?: "Pilih", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
        Button({ showAdd = true }, enabled = consultant != null) { Text("Tambah prospek") }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        ErrorText(error)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(prospects.filter { it.consultantId == consultant?.id && it.status == "pending" }, key = { it.id }) { item ->
                var want by remember(item.id, item.want) { mutableStateOf(item.want) }
                var stage by remember(item.id, item.stage) { mutableStateOf(item.stage) }
                Card(Modifier.fillMaxWidth().clickable {
                    expanded = if (expanded == item.id) null else item.id
                    if (expanded == item.id) scope.launch { try { history = api.prospectHistory(item.id) } catch (e: Exception) { error = friendly(e) } }
                }) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.name, fontWeight = FontWeight.Bold); Text("Mau: ${item.want}"); Text("Tahap: ${item.stage}")
                        if (expanded == item.id) {
                            Text("Riwayat", fontWeight = FontWeight.Bold)
                            history.forEach { Text("${it.createdAt}: ${it.want} — ${it.stage}", fontSize = 12.sp) }
                            Field(want, { want = it }, "Mau apa berikutnya"); Field(stage, { stage = it }, "Tahap berikutnya")
                            Button({ scope.launch { try { api.updateProspect(item.id, JSONObject().put("want", want).put("stage", stage)); changed() } catch (e: Exception) { error = friendly(e) } } }, enabled = want.isNotBlank() && stage.isNotBlank()) { Text("Simpan tindak lanjut") }
                            Row { TextButton({ scope.launch { try { api.updateProspect(item.id, JSONObject().put("status", "berhasil")); changed() } catch (e: Exception) { error = friendly(e) } } }) { Text("Berhasil") }
                                TextButton({ scope.launch { try { api.updateProspect(item.id, JSONObject().put("status", "gagal")); changed() } catch (e: Exception) { error = friendly(e) } } }) { Text("Gagal") } }
                        }
                    }
                }
            }
        }
    }
    if (showAdd && consultant != null) AddProspectDialog(consultant!!, { showAdd = false }) { name, want, stage ->
        scope.launch { try { api.createProspect(consultant!!.id, name, want, stage); showAdd = false; changed() } catch (e: Exception) { error = friendly(e) } }
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
                        if (account.role == Role.SUPERVISOR) {
                            HorizontalDivider()
                            Text("Sales", fontWeight = FontWeight.Bold)
                            val team = users.filter { it.role == Role.CONSULTANT && it.supervisorId == account.id }
                            if (team.isEmpty()) Text("Belum ada sales consultant.")
                            if (!account.active && team.isNotEmpty()) Text("Sales di bawah supervisor ini tidak dapat masuk sampai supervisor diaktifkan.", fontSize = 12.sp)
                            team.forEach { consultant ->
                                ConsultantAccountCard(consultant, busy,
                                    { act(consultant, if (consultant.active) "disable" else "enable") },
                                    { error = ""; resetUser = consultant })
                            }
                        }
                    }
                } }
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
private fun ConsultantAccountCard(account: User, busy: Boolean, toggle: () -> Unit, reset: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(Modifier.fillMaxWidth().clickable { open = !open }) {
            Text(account.displayName, fontWeight = FontWeight.SemiBold)
            Text(account.username, fontSize = 12.sp)
            AccountStatus(account)
            Text("SPK bulan ini: ${account.currentMonthSpks} · Prospek berjalan: ${account.runningProspects}")
        }
        if (open) AccountActions(account, busy, true, toggle, reset)
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

@Composable private fun DateButton(label: String, value: LocalDate, changed: (LocalDate) -> Unit) {
    val context = LocalContext.current
    OutlinedButton({ DatePickerDialog(context, { _, y, m, d -> changed(LocalDate.of(y, m + 1, d)) },
        value.year, value.monthValue - 1, value.dayOfMonth).show() }, Modifier.fillMaxWidth()) { Text("$label: $value") }
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

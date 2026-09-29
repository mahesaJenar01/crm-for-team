package com.mahesajenar.crmforteam

import android.app.DatePickerDialog
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.security.MessageDigest
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.UUID

enum class Role(val label: String) {
    MASTER("Master"), SUPERVISOR("Sales Supervisor"), CONSULTANT("Sales Consultant")
}

enum class SpkStatus { OPEN, CLOSED, CANCELLED }
enum class PaymentMethod { CASH, CREDIT, COP }

data class User(
    val id: String,
    val username: String,
    val displayName: String,
    val role: Role,
    val supervisorId: String? = null,
    val passwordHash: String
)

data class Spk(
    val id: String = UUID.randomUUID().toString(),
    val number: String,
    val date: LocalDate,
    val customerName: String,
    val consultantId: String,
    val supervisorId: String,
    val clientType: String,
    val phone: String,
    val carType: String,
    val color: String,
    val quantity: Int,
    val dealPrice: String,
    val sameAsOtr: Boolean,
    val payment: PaymentMethod,
    val description: String,
    val bonus: String,
    val promiseFrom: LocalDate,
    val promiseTo: LocalDate,
    val tenor: String = "",
    val tdp: String = "",
    val insurance: String = "",
    var status: SpkStatus = SpkStatus.OPEN,
    var crmDone: Boolean = false,
    var vin: String = "",
    var vinAllocated: String = "",
    var delivered: Boolean = false,
    var deliveredDate: LocalDate? = null,
    var fullyPaid: Boolean = false,
    var deliveryPlanned: Boolean = false,
    var refundCredit: Boolean = false,
    var incentiveDms: Boolean = false,
    var incentiveCsi: Boolean = false
)

data class ProspectUpdate(val at: LocalDate, val want: String, val stage: String)
data class Prospect(
    val id: String = UUID.randomUUID().toString(),
    val consultantId: String,
    val name: String,
    var want: String,
    var stage: String,
    var status: String = "Pending",
    val history: MutableList<ProspectUpdate> = mutableListOf()
)

object DemoRepository {
    // The initial master password is stored only as a SHA-256 verifier, never plaintext.
    private const val MASTER_HASH = "5aa3470f4b9db3d3049ce1ada0ca8bba8cd38cad63c40fd55ed9801435cdcaed"
    val users = mutableStateListOf(
        User("master", "MahesaJenar", "Mahesa Jenar", Role.MASTER, passwordHash = MASTER_HASH),
        User("spv-andi", "andi.spv", "Andi Pratama", Role.SUPERVISOR, passwordHash = sha256("Demo123!")),
        User("sales-sari", "sari.sales", "Sari Wulandari", Role.CONSULTANT, "spv-andi", sha256("Demo123!")),
        User("sales-budi", "budi.sales", "Budi Santoso", Role.CONSULTANT, "spv-andi", sha256("Demo123!"))
    )

    val spks: SnapshotStateList<Spk> = mutableStateListOf(
        Spk(number = "SPK-2609-001", date = LocalDate.now().minusDays(3), customerName = "Rina Hartono",
            consultantId = "sales-sari", supervisorId = "spv-andi", clientType = "Retail", phone = "081234567890",
            carType = "SUV X", color = "Pearl White", quantity = 1, dealPrice = "Rp 365.000.000", sameAsOtr = false,
            payment = PaymentMethod.CREDIT, description = "Trade-in sedang dinilai", bonus = "Talang air, kaca film",
            promiseFrom = LocalDate.now().plusDays(4), promiseTo = LocalDate.now().plusDays(9), tenor = "48 bulan",
            tdp = "Rp 75.000.000", insurance = "All risk full tenor", crmDone = false),
        Spk(number = "SPK-2609-002", date = LocalDate.now().minusDays(10), customerName = "PT Maju Terus",
            consultantId = "sales-budi", supervisorId = "spv-andi", clientType = "Fleet", phone = "0215557788",
            carType = "MPV Z", color = "Graphite", quantity = 3, dealPrice = "Sama dengan OTR", sameAsOtr = true,
            payment = PaymentMethod.CASH, description = "Unit operasional", bonus = "Karpet kabin",
            promiseFrom = LocalDate.now(), promiseTo = LocalDate.now().plusDays(2), crmDone = true,
            vin = "MHXDEMO000000123", vinAllocated = YearMonth.now().toString()),
        Spk(number = "SPK-2608-018", date = LocalDate.now().minusMonths(1), customerName = "Dimas Ardi",
            consultantId = "sales-sari", supervisorId = "spv-andi", clientType = "Retail", phone = "081355511222",
            carType = "Hatchback A", color = "Red", quantity = 1, dealPrice = "Rp 278.000.000", sameAsOtr = false,
            payment = PaymentMethod.COP, description = "Menunggu unit", bonus = "Dashcam",
            promiseFrom = LocalDate.now().minusDays(8), promiseTo = LocalDate.now().plusDays(5), crmDone = true)
    )

    val prospects = mutableStateListOf(
        Prospect(consultantId = "sales-sari", name = "Anisa", want = "Test drive SUV X", stage = "Follow up", history = mutableListOf(ProspectUpdate(LocalDate.now().minusDays(2), "Cari SUV keluarga", "Kontak awal"))),
        Prospect(consultantId = "sales-budi", name = "Pak Reza", want = "Simulasi kredit MPV Z", stage = "Kirim penawaran")
    )

    fun login(username: String, password: String): User? = users.firstOrNull {
        it.username.equals(username.trim(), true) && it.passwordHash == sha256(password)
    }

    fun addUser(username: String, name: String, role: Role, supervisorId: String?, password: String): Boolean {
        if (users.any { it.username.equals(username.trim(), true) }) return false
        users += User(UUID.randomUUID().toString(), username.trim(), name.trim(), role, supervisorId, sha256(password))
        return true
    }

    fun consultantsFor(user: User): List<User> = when (user.role) {
        Role.MASTER -> users.filter { it.role == Role.CONSULTANT }
        Role.SUPERVISOR -> users.filter { it.role == Role.CONSULTANT && it.supervisorId == user.id }
        Role.CONSULTANT -> listOf(user)
    }

    fun visibleSpks(user: User): List<Spk> = when (user.role) {
        Role.MASTER -> spks
        Role.SUPERVISOR -> spks.filter { it.supervisorId == user.id }
        Role.CONSULTANT -> spks.filter { it.consultantId == user.id }
    }

    fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CrmTheme { CrmApp() } }
    }
}

@Composable
fun CrmTheme(content: @Composable () -> Unit) {
    val colors = lightColorScheme(
        primary = Color(0xFF1E5AA8), secondary = Color(0xFF006C4C),
        background = Color(0xFFF7F7FA), surface = Color.White,
        error = Color(0xFFB3261E)
    )
    MaterialTheme(colorScheme = colors, typography = Typography(), content = content)
}

@Composable
fun CrmApp() {
    var user by remember { mutableStateOf<User?>(null) }
    if (user == null) LoginScreen { user = it } else MainShell(user!!, onLogout = { user = null })
}

@Composable
fun LoginScreen(onLogin: (User) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(24.dp), contentAlignment = Alignment.Center) {
        Card(Modifier.widthIn(max = 440.dp), shape = RoundedCornerShape(24.dp)) {
            Column(Modifier.padding(28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Icon(Icons.Default.Groups, null, Modifier.size(52.dp), tint = MaterialTheme.colorScheme.primary)
                Text("CRM for Team", fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text("Kelola SPK, prospek, dan kerja tim penjualan dalam satu tempat.", color = Color.Gray)
                OutlinedTextField(username, { username = it }, label = { Text("Username") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                Button(onClick = {
                    val found = DemoRepository.login(username, password)
                    if (found == null) error = "Username atau password tidak sesuai." else onLogin(found)
                }, Modifier.fillMaxWidth().height(50.dp)) { Text("Masuk") }
                HorizontalDivider()
                Text("Data simulasi", fontWeight = FontWeight.SemiBold)
                Text("Supervisor: andi.spv / Demo123!\nSales: sari.sales / Demo123!", fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

enum class Page(val label: String) { HOME("Beranda"), SPK("SPK"), OUTSTANDING("Outstanding"), PROSPECT("Prospek"), ACCOUNTS("Akun") }

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MainShell(user: User, onLogout: () -> Unit) {
    var page by remember { mutableStateOf(Page.HOME) }
    var showNewSpk by remember { mutableStateOf(false) }
    val pages = buildList {
        add(Page.HOME); add(Page.SPK); add(Page.OUTSTANDING)
        if (user.role != Role.CONSULTANT) add(Page.PROSPECT)
        if (user.role == Role.MASTER) add(Page.ACCOUNTS)
    }
    Scaffold(
        topBar = {
            TopAppBar(title = { Column { Text("CRM for Team", fontWeight = FontWeight.Bold); Text("${user.displayName} · ${user.role.label}", fontSize = 12.sp) } },
                actions = { IconButton(onClick = onLogout) { Icon(Icons.Default.Logout, "Keluar") } })
        },
        bottomBar = {
            NavigationBar {
                pages.forEach { item -> NavigationBarItem(selected = page == item, onClick = { page = item },
                    icon = { Icon(when(item) { Page.HOME -> Icons.Default.Home; Page.SPK -> Icons.Default.Description; Page.OUTSTANDING -> Icons.Default.Schedule; Page.PROSPECT -> Icons.Default.People; Page.ACCOUNTS -> Icons.Default.ManageAccounts }, null) },
                    label = { Text(item.label, fontSize = 10.sp) }) }
            }
        },
        floatingActionButton = { if (page == Page.SPK) FloatingActionButton(onClick = { showNewSpk = true }) { Icon(Icons.Default.Add, "Buat SPK") } }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (page) {
                Page.HOME -> HomeScreen(user) { page = Page.PROSPECT }
                Page.SPK -> SpkScreen(user, outstandingOnly = false)
                Page.OUTSTANDING -> SpkScreen(user, outstandingOnly = true)
                Page.PROSPECT -> ProspectScreen(user)
                Page.ACCOUNTS -> AccountsScreen()
            }
        }
    }
    if (showNewSpk) NewSpkDialog(user, onDismiss = { showNewSpk = false }) { DemoRepository.spks.add(it); showNewSpk = false }
}

@Composable
fun HomeScreen(user: User, openProspects: () -> Unit) {
    val visible = DemoRepository.visibleSpks(user)
    val today = LocalDate.now()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Selamat datang, ${user.displayName}", fontSize = 24.sp, fontWeight = FontWeight.Bold) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard("SPK bulan ini", visible.count { YearMonth.from(it.date) == YearMonth.now() }.toString(), Modifier.weight(1f))
                MetricCard("Outstanding", visible.count { it.status == SpkStatus.OPEN }.toString(), Modifier.weight(1f))
            }
        }
        if (user.role != Role.CONSULTANT) {
            item { Text("Agenda hari ini", fontSize = 20.sp, fontWeight = FontWeight.Bold) }
            item { TodoCard("Tanya prospek", "${DemoRepository.prospects.count { it.status == "Pending" }} prospek masih pending", openProspects) }
            item { TodoCard("Janji kirim tanpa VIN", "${visible.count { it.status == SpkStatus.OPEN && today in it.promiseFrom..it.promiseTo && it.vin.isBlank() }} pelanggan perlu ditindaklanjuti") {} }
            item { TodoCard("VIN ada, belum lunas", "${visible.count { it.status == SpkStatus.OPEN && it.vin.isNotBlank() && !it.fullyPaid }} pelanggan perlu konfirmasi pembayaran") {} }
            item { TodoCard("Lunas, pengiriman belum direncanakan", "${visible.count { it.status == SpkStatus.OPEN && it.fullyPaid && !it.deliveryPlanned }} pelanggan perlu jadwal") {} }
            item { TodoCard("Pengiriman hari ini", "${visible.count { it.deliveredDate == today }} unit dijadwalkan") {} }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F1FF))) {
                Column(Modifier.padding(16.dp)) { Text("Mode simulasi", fontWeight = FontWeight.Bold); Text("Data contoh tersedia agar alur dapat dicoba. Hubungkan API Vercel sebelum dipakai oleh tim sungguhan.") }
            }
        }
    }
}

@Composable fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) = Card(modifier) {
    Column(Modifier.padding(16.dp)) { Text(value, fontSize = 30.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary); Text(label) }
}

@Composable fun TodoCard(title: String, detail: String, onClick: () -> Unit) = Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.TaskAlt, null); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.Bold); Text(detail, color = Color.Gray) }; Icon(Icons.Default.ChevronRight, null) }
}

@Composable
fun SpkScreen(user: User, outstandingOnly: Boolean) {
    var selectedMonth by remember { mutableStateOf(YearMonth.now()) }
    var page by remember { mutableIntStateOf(0) }
    val base = DemoRepository.visibleSpks(user).filter { if (outstandingOnly) it.status == SpkStatus.OPEN else YearMonth.from(it.date) == selectedMonth }.sortedByDescending { it.date }
    val pageCount = maxOf(1, (base.size + 24) / 25)
    if (page >= pageCount) page = pageCount - 1
    val shown = base.drop(page * 25).take(25)
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column { Text(if (outstandingOnly) "Outstanding sepanjang karier" else "SPK ${selectedMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy"))}", fontSize = 20.sp, fontWeight = FontWeight.Bold); Text("${base.size} data · maks. 25 per halaman", fontSize = 12.sp, color = Color.Gray) }
            if (!outstandingOnly) Row { IconButton({ selectedMonth = selectedMonth.minusMonths(1); page = 0 }) { Icon(Icons.Default.ChevronLeft, "Bulan lalu") }; IconButton({ selectedMonth = selectedMonth.plusMonths(1); page = 0 }) { Icon(Icons.Default.ChevronRight, "Bulan berikut") } }
        }
        if (shown.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Belum ada SPK untuk pilihan ini.", color = Color.Gray) }
        else LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { items(shown, key = { it.id }) { SpkCard(it, user) } }
        if (pageCount > 1) Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) { TextButton({ page-- }, enabled = page > 0) { Text("Sebelumnya") }; Text("${page + 1} / $pageCount"); TextButton({ page++ }, enabled = page + 1 < pageCount) { Text("Berikutnya") } }
    }
}

@Composable
fun SpkCard(spk: Spk, user: User) {
    var expanded by remember { mutableStateOf(false) }
    var refresh by remember { mutableIntStateOf(0) }
    var confirmDelete by remember { mutableStateOf(false) }
    val supervisor = user.role != Role.CONSULTANT
    val clipboard = LocalClipboardManager.current
    @Suppress("UNUSED_VARIABLE") val observe = refresh
    Card(colors = CardDefaults.cardColors(containerColor = if (!spk.crmDone) Color(0xFFFFE9E8) else Color.White), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.clickable { expanded = !expanded }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(spk.number, fontWeight = FontWeight.Bold); StatusChip(spk.status) }
            Text(spk.customerName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text("${spk.date} · ${spk.carType} · ${spk.color}")
            Row(verticalAlignment = Alignment.CenterVertically) { Text("CRM selesai", Modifier.weight(1f)); Switch(spk.crmDone, { spk.crmDone = it; refresh++ }) }
            TextButton({ expanded = !expanded }) { Text(if (expanded) "Tutup detail" else "Update / lihat detail") }
            if (expanded) {
                HorizontalDivider(); Text("Sales: ${DemoRepository.users.firstOrNull { it.id == spk.consultantId }?.displayName}")
                Row(verticalAlignment = Alignment.CenterVertically) { Text("VIN: ${spk.vin.ifBlank { "Belum dialokasikan" }}${if (spk.vinAllocated.isNotBlank()) " · ${spk.vinAllocated}" else ""}", Modifier.weight(1f)); if (spk.vin.isNotBlank()) IconButton({ clipboard.setText(AnnotatedString(spk.vin)) }) { Icon(Icons.Default.ContentCopy, "Salin VIN") } }
                Text("Pengiriman: ${spk.promiseFrom} s.d. ${spk.promiseTo}")
                Text("Pembayaran: ${spk.payment} · Refund kredit ${if (spk.refundCredit) "cair" else "belum"}")
                Text("Lunas: ${if (spk.fullyPaid) "Ya" else "Belum"} · Jadwal kirim: ${if (spk.deliveryPlanned) "Ada" else "Belum"}")
                Text("Insentif DMS ${if (spk.incentiveDms) "cair" else "belum"} · CSI ${if (spk.incentiveCsi) "cair" else "belum"}")
                Text("Dikirim: ${if (spk.delivered) "Ya" else "Belum"}")
                if (supervisor) SupervisorControls(spk, { refresh++ }, { confirmDelete = true })
            }
        }
    }
    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Hapus SPK ${spk.number}?") },
        text = { Text("Tindakan ini menghapus SPK dari data simulasi tim.") },
        confirmButton = { TextButton({ DemoRepository.spks.remove(spk); confirmDelete = false }) { Text("Hapus", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton({ confirmDelete = false }) { Text("Batal") } })
}

@Composable fun StatusChip(status: SpkStatus) { AssistChip(onClick = {}, label = { Text(status.name) }, colors = AssistChipDefaults.assistChipColors(containerColor = when(status) { SpkStatus.OPEN -> Color(0xFFFFF0C2); SpkStatus.CLOSED -> Color(0xFFD8F4E8); SpkStatus.CANCELLED -> Color(0xFFFFDAD6) })) }

@Composable
fun SupervisorControls(spk: Spk, changed: () -> Unit, delete: () -> Unit) {
    var vin by remember { mutableStateOf(spk.vin) }
    Text("Kontrol supervisor", fontWeight = FontWeight.Bold)
    OutlinedTextField(vin, { vin = it }, label = { Text("VIN") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    Button({ spk.vin = vin.trim(); spk.vinAllocated = if (vin.isBlank()) "" else YearMonth.now().toString(); changed() }) { Text("Simpan VIN") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.fullyPaid, { spk.fullyPaid = it; changed() }); Text("Sudah lunas") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.deliveryPlanned, { spk.deliveryPlanned = it; changed() }); Text("Pengiriman sudah direncanakan") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.delivered, { spk.delivered = it; spk.deliveredDate = if (it) LocalDate.now() else null; if (it) spk.status = SpkStatus.CLOSED; changed() }); Text("Sudah dikirim (menutup SPK)") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.refundCredit, { spk.refundCredit = it; changed() }); Text("Refund kredit cair") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.incentiveDms, { spk.incentiveDms = it; changed() }); Text("Insentif DMS cair") }
    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(spk.incentiveCsi, { spk.incentiveCsi = it; changed() }); Text("Insentif CSI cair") }
    TextButton({ spk.status = SpkStatus.CANCELLED; changed() }) { Text("Tandai dibatalkan", color = MaterialTheme.colorScheme.error) }
    TextButton(delete) { Text("Hapus SPK", color = MaterialTheme.colorScheme.error) }
}

@Composable
fun NewSpkDialog(user: User, onDismiss: () -> Unit, onSave: (Spk) -> Unit) {
    val consultants = DemoRepository.consultantsFor(user)
    var consultant by remember { mutableStateOf(consultants.firstOrNull()) }
    var number by remember { mutableStateOf("") }; var customer by remember { mutableStateOf("") }; var phone by remember { mutableStateOf("") }
    var car by remember { mutableStateOf("") }; var color by remember { mutableStateOf("") }; var qty by remember { mutableStateOf("1") }
    var price by remember { mutableStateOf("") }; var sameOtr by remember { mutableStateOf(false) }; var clientType by remember { mutableStateOf("Retail") }
    var payment by remember { mutableStateOf(PaymentMethod.CASH) }; var bonus by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }
    var tenor by remember { mutableStateOf("") }; var tdp by remember { mutableStateOf("") }; var insurance by remember { mutableStateOf("Combine") }
    var spkDate by remember { mutableStateOf(LocalDate.now()) }; var from by remember { mutableStateOf(LocalDate.now()) }; var to by remember { mutableStateOf(LocalDate.now()) }; var error by remember { mutableStateOf("") }
    var initialCrm by remember { mutableStateOf(false) }; var initialVin by remember { mutableStateOf("") }; var initialAllocation by remember { mutableStateOf(YearMonth.now().toString()) }
    var initialDelivered by remember { mutableStateOf(false) }; var initialPaid by remember { mutableStateOf(false) }; var initialPlanned by remember { mutableStateOf(false) }; var initialRefund by remember { mutableStateOf(false) }; var initialDms by remember { mutableStateOf(false) }; var initialCsi by remember { mutableStateOf(false) }
    var currentDoc by remember { mutableStateOf("") }; val docs = remember { mutableStateMapOf<String, String>() }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null && currentDoc.isNotBlank()) docs[currentDoc] = uri.toString() }
    AlertDialog(onDismissRequest = onDismiss, confirmButton = {}, title = { Text("Buat SPK") }, text = {
        Column(Modifier.fillMaxWidth().heightIn(max = 650.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (user.role != Role.CONSULTANT) DropdownField("Sales", consultant?.displayName ?: "Pilih", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
            else Text("Sales: ${user.displayName}\nSPV: ${DemoRepository.users.firstOrNull { it.id == user.supervisorId }?.displayName}")
            Field(number, { number = it }, "Nomor SPK *"); Field(customer, { customer = it }, "Nama SPK / pelanggan *"); Field(phone, { phone = it }, "Nomor telepon *")
            ChoiceRow("Jenis klien", listOf("Retail", "Fleet"), clientType) { clientType = it; docs.clear() }
            Text("Dokumen ${if (clientType == "Retail") "(KTP, KK, NPWP; KTP STNK bila berbeda)" else "(NIB dan NPWP)"}", fontWeight = FontWeight.SemiBold)
            (if (clientType == "Retail") listOf("Foto KTP", "Foto KK", "Foto NPWP", "KTP pemilik STNK (opsional)") else listOf("Foto NIB", "Foto NPWP")).forEach { label ->
                OutlinedButton({ currentDoc = label; picker.launch("image/*") }, Modifier.fillMaxWidth()) { Icon(if (docs.containsKey(label)) Icons.Default.CheckCircle else Icons.Default.UploadFile, null); Spacer(Modifier.width(6.dp)); Text(if (docs.containsKey(label)) "$label dipilih" else "Pilih $label") }
            }
            Field(car, { car = it }, "Tipe mobil *"); Field(color, { color = it }, "Warna *"); Field(qty, { qty = it.filter(Char::isDigit) }, "Jumlah *")
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(sameOtr, { sameOtr = it }); Text("Harga deal sama dengan OTR") }
            if (!sameOtr) Field(price, { price = it }, "Harga deal *")
            ChoiceRow("Metode pembayaran", PaymentMethod.entries.map { it.name }, payment.name) { payment = PaymentMethod.valueOf(it) }
            if (payment == PaymentMethod.CREDIT) { Field(tenor, { tenor = it }, "Tenor *"); Field(tdp, { tdp = it }, "TDP *"); DropdownField("Asuransi", insurance, listOf("Combine", "All risk full tenor", "All risk perluasan full tenor")) { insurance = it } }
            Field(bonus, { bonus = it }, "Bonus * (di luar standar pabrik, contoh talang air)"); Field(description, { description = it }, "Deskripsi")
            DateButton("Tanggal SPK", spkDate) { spkDate = it }
            DateButton("Janji kirim mulai", from) { from = it; if (to < it) to = it }
            DateButton("Janji kirim sampai", to) { if (it >= from) to = it }
            if (user.role != Role.CONSULTANT) {
                Text("Kolom supervisor", fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialCrm, { initialCrm = it }); Text("CRM selesai") }
                Field(initialVin, { initialVin = it }, "VIN (opsional)")
                if (initialVin.isNotBlank()) Field(initialAllocation, { initialAllocation = it }, "Alokasi VIN (YYYY-MM)")
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialPaid, { initialPaid = it }); Text("Sudah lunas") }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialPlanned, { initialPlanned = it }); Text("Pengiriman sudah direncanakan") }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialDelivered, { initialDelivered = it }); Text("Sudah dikirim") }
                if (payment == PaymentMethod.CREDIT) Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialRefund, { initialRefund = it }); Text("Refund kredit cair") }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialDms, { initialDms = it }); Text("Insentif DMS cair") }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(initialCsi, { initialCsi = it }); Text("Insentif CSI cair") }
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton(onDismiss) { Text("Batal") }; Button({
                val c = consultant
                val supervisorId = if (c?.role == Role.CONSULTANT) c.supervisorId else if (user.role == Role.SUPERVISOR) user.id else null
                val requiredDocs = if (clientType == "Retail") listOf("Foto KTP", "Foto KK", "Foto NPWP") else listOf("Foto NIB", "Foto NPWP")
                when { c == null || supervisorId == null -> error = "Pilih sales yang memiliki supervisor."
                    listOf(number, customer, phone, car, color, bonus).any { it.isBlank() } || (!sameOtr && price.isBlank()) -> error = "Lengkapi semua kolom bertanda *."
                    qty.toIntOrNull()?.let { it < 1 } != false -> error = "Jumlah harus minimal 1."
                    requiredDocs.any { !docs.containsKey(it) } -> error = "Lengkapi dokumen wajib."
                    payment == PaymentMethod.CREDIT && listOf(tenor, tdp).any { it.isBlank() } -> error = "Lengkapi tenor dan TDP kredit."
                    DemoRepository.spks.any { it.number.equals(number, true) } -> error = "Nomor SPK sudah digunakan."
                    else -> onSave(Spk(number = number.trim(), date = spkDate, customerName = customer.trim(), consultantId = c.id, supervisorId = supervisorId, clientType = clientType, phone = phone, carType = car, color = color, quantity = qty.toInt(), dealPrice = if (sameOtr) "Sama dengan OTR" else price, sameAsOtr = sameOtr, payment = payment, description = description, bonus = bonus, promiseFrom = from, promiseTo = to, tenor = tenor, tdp = tdp, insurance = insurance, status = if (initialDelivered) SpkStatus.CLOSED else SpkStatus.OPEN, crmDone = initialCrm, vin = initialVin.trim(), vinAllocated = if (initialVin.isBlank()) "" else initialAllocation, delivered = initialDelivered, deliveredDate = if (initialDelivered) LocalDate.now() else null, fullyPaid = initialPaid, deliveryPlanned = initialPlanned, refundCredit = initialRefund, incentiveDms = initialDms, incentiveCsi = initialCsi)) }
            }) { Text("Simpan") } }
        }
    })
}

@Composable fun Field(value: String, change: (String) -> Unit, label: String) = OutlinedTextField(value, change, label = { Text(label) }, modifier = Modifier.fillMaxWidth())

@Composable
fun ChoiceRow(label: String, values: List<String>, selected: String, change: (String) -> Unit) { Column { Text(label, fontWeight = FontWeight.SemiBold); Row(Modifier.horizontalScroll(rememberScrollState())) { values.forEach { FilterChip(selected == it, { change(it) }, { Text(it) }); Spacer(Modifier.width(6.dp)) } } } }

@Composable
fun DropdownField(label: String, selected: String, options: List<String>, changed: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box { OutlinedButton({ open = true }, Modifier.fillMaxWidth()) { Text("$label: $selected", Modifier.weight(1f), overflow = TextOverflow.Ellipsis); Icon(Icons.Default.ArrowDropDown, null) }; DropdownMenu(open, { open = false }) { options.forEach { DropdownMenuItem({ Text(it) }, { changed(it); open = false }) } } }
}

@Composable
fun DateButton(label: String, value: LocalDate, changed: (LocalDate) -> Unit) {
    val context = LocalContext.current
    OutlinedButton({ DatePickerDialog(context, { _, y, m, d -> changed(LocalDate.of(y, m + 1, d)) }, value.year, value.monthValue - 1, value.dayOfMonth).show() }, Modifier.fillMaxWidth()) { Icon(Icons.Default.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text("$label: $value") }
}

@Composable
fun ProspectScreen(user: User) {
    val consultants = DemoRepository.consultantsFor(user)
    var consultant by remember { mutableStateOf(consultants.firstOrNull()) }
    var showAdd by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf<String?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    @Suppress("UNUSED_VARIABLE") val observe = refresh
    val visible = DemoRepository.prospects.filter { it.consultantId == consultant?.id && it.status == "Pending" }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Prospek tim", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        DropdownField("Sales", consultant?.displayName ?: "Tidak ada", consultants.map { it.displayName }) { name -> consultant = consultants.first { it.displayName == name } }
        Button({ showAdd = true }, enabled = consultant != null) { Icon(Icons.Default.PersonAdd, null); Spacer(Modifier.width(8.dp)); Text("Tambah prospek") }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) { items(visible, key = { it.id }) { prospect ->
            var editWant by remember(prospect.id) { mutableStateOf(prospect.want) }
            var editStage by remember(prospect.id) { mutableStateOf(prospect.stage) }
            Card(Modifier.fillMaxWidth().clickable { expanded = if (expanded == prospect.id) null else prospect.id }) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(prospect.name, fontWeight = FontWeight.Bold); Text("Mau: ${prospect.want}"); Text("Tahap: ${prospect.stage}")
                    Row(verticalAlignment = Alignment.CenterVertically) { Text("Status: ", Modifier.weight(1f)); AssistChip({ prospect.status = when(prospect.status) { "Pending" -> "Berhasil"; "Berhasil" -> "Gagal"; else -> "Pending" }; refresh++ }, { Text(prospect.status) }) }
                    if (expanded == prospect.id) { HorizontalDivider(); Text("Riwayat", fontWeight = FontWeight.Bold); prospect.history.forEach { Text("${it.at}: ${it.want} — ${it.stage}", fontSize = 12.sp) }; Field(editWant, { editWant = it }, "Mau apa berikutnya"); Field(editStage, { editStage = it }, "Tahap berikutnya"); TextButton({ if (editWant.isNotBlank() && editStage.isNotBlank()) { prospect.history.add(ProspectUpdate(LocalDate.now(), prospect.want, prospect.stage)); prospect.want = editWant; prospect.stage = editStage; refresh++ } }) { Text("Tambah tindak lanjut") } }
                }
            }
        } }
    }
    if (showAdd && consultant != null) AddProspectDialog(consultant!!, { showAdd = false }) { DemoRepository.prospects.add(it); showAdd = false }
}

@Composable fun AddProspectDialog(consultant: User, dismiss: () -> Unit, save: (Prospect) -> Unit) {
    var name by remember { mutableStateOf("") }; var want by remember { mutableStateOf("") }; var stage by remember { mutableStateOf("") }
    AlertDialog(dismiss, title = { Text("Prospek untuk ${consultant.displayName}") }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Field(name, { name = it }, "Nama"); Field(want, { want = it }, "Mau apa"); Field(stage, { stage = it }, "Tahap apa") } }, confirmButton = { Button({ if (name.isNotBlank() && want.isNotBlank() && stage.isNotBlank()) save(Prospect(consultantId = consultant.id, name = name, want = want, stage = stage)) }) { Text("Tambah") } }, dismissButton = { TextButton(dismiss) { Text("Batal") } })
}

@Composable
fun AccountsScreen() {
    var showAdd by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text("Kelola akun", fontSize = 24.sp, fontWeight = FontWeight.Bold); Button({ showAdd = true }) { Text("Buat akun") } }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) { items(DemoRepository.users, key = { it.id }) { account -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(account.displayName, fontWeight = FontWeight.Bold); Text("${account.username} · ${account.role.label}", color = Color.Gray) } } } }
    }
    if (showAdd) AddAccountDialog { showAdd = false }
}

@Composable fun AddAccountDialog(dismiss: () -> Unit) {
    var username by remember { mutableStateOf("") }; var name by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var role by remember { mutableStateOf(Role.CONSULTANT) }; var error by remember { mutableStateOf("") }
    val supervisors = DemoRepository.users.filter { it.role == Role.SUPERVISOR }; var supervisor by remember { mutableStateOf(supervisors.firstOrNull()) }
    AlertDialog(dismiss, title = { Text("Buat akun") }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Field(name, { name = it }, "Nama"); Field(username, { username = it }, "Username"); OutlinedTextField(password, { password = it }, label = { Text("Password sementara") }, visualTransformation = PasswordVisualTransformation()); ChoiceRow("Peran", listOf(Role.SUPERVISOR.label, Role.CONSULTANT.label), role.label) { role = Role.entries.first { r -> r.label == it } }; if (role == Role.CONSULTANT) DropdownField("Supervisor", supervisor?.displayName ?: "Belum ada", supervisors.map { it.displayName }) { n -> supervisor = supervisors.first { it.displayName == n } }; if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error) } },
        confirmButton = { Button({ if (username.isBlank() || name.isBlank() || password.length < 8) error = "Lengkapi data; password minimal 8 karakter." else if (role == Role.CONSULTANT && supervisor == null) error = "Buat atau pilih supervisor." else if (DemoRepository.addUser(username, name, role, supervisor?.id, password)) dismiss() else error = "Username sudah digunakan." }) { Text("Simpan") } }, dismissButton = { TextButton(dismiss) { Text("Batal") } })
}

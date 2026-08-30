using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace KopkenSyncDesktop
{
    public class MainForm : Form
    {
        private readonly string toolDir;
        private readonly string rootDir;
        private readonly string envPath;
        private readonly string nodePath;
        private Process activeProcess;
        private TextBox logBox;
        private TextBox outletBox;
        private TextBox sshBox;
        private TextBox adbBox;
        private TextBox keyBox;
        private ProgressBar progressBar;
        private Label progressLabel;
        private Label statusLabel;
        private Button stopButton;
        private Button pauseButton;
        private Button resumeButton;
        private FlowLayoutPanel actionPanel;
        private const string ScheduleTaskName = "Kopken Menu Sync - Outlet Utama";

        public MainForm()
        {
            toolDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            rootDir = Path.GetFullPath(Path.Combine(toolDir, "..", ".."));
            envPath = Path.Combine(rootDir, ".env.kopken-sync");
            string bundledNode = @"C:\Users\fachr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe";
            nodePath = File.Exists(bundledNode) ? bundledNode : @"C:\Program Files\nodejs\node.exe";
            BuildUi();
            LoadConnectionSettings();
        }

        private void BuildUi()
        {
            Text = "Kopken Menu Sync";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(920, 680);
            Size = new Size(1080, 760);
            BackColor = Color.FromArgb(246, 244, 241);
            Font = new Font("Segoe UI", 9F);

            var header = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = Color.FromArgb(33, 83, 65), Padding = new Padding(22, 14, 22, 10) };
            var title = new Label { Text = "Kopken Menu Sync", ForeColor = Color.White, Font = new Font("Segoe UI Semibold", 18F), AutoSize = true, Location = new Point(22, 12) };
            statusLabel = new Label { Text = "Siap", ForeColor = Color.FromArgb(212, 233, 221), AutoSize = true, Location = new Point(25, 48) };
            header.Controls.Add(title);
            header.Controls.Add(statusLabel);
            Controls.Add(header);

            var tabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(14, 7) };
            tabs.TabPages.Add(BuildOperationsTab());
            tabs.TabPages.Add(BuildConnectionTab());
            Controls.Add(tabs);
            tabs.BringToFront();
        }

        private TabPage BuildOperationsTab()
        {
            var page = new TabPage("Sinkronisasi") { BackColor = BackColor, Padding = new Padding(18) };
            actionPanel = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 102, WrapContents = true, AutoSize = false };
            actionPanel.Controls.Add(MakeButton("Menu Belum Ada", Color.FromArgb(224, 73, 58), delegate { StartSync("--baru", "Mencari menu yang belum ada"); }));
            actionPanel.Controls.Add(MakeButton("Sinkron Ulang Semua", Color.FromArgb(42, 112, 82), delegate { StartSync("", "Memperbarui semua menu"); }));
            actionPanel.Controls.Add(MakeButton("Update Outlet Utama", Color.FromArgb(185, 126, 43), delegate { StartSync("--utama", "Memperbarui outlet utama"); }));
            actionPanel.Controls.Add(MakeButton("Cari Outlet Baru", Color.FromArgb(52, 98, 139), delegate { StartSync("--discover-outlets", "Mencari outlet baru"); }));
            actionPanel.Controls.Add(MakeButton("Jadwalkan Update", Color.FromArgb(92, 82, 74), ConfigurePrioritySchedule));
            actionPanel.Controls.Add(MakeButton("Buka Folder Log", Color.FromArgb(92, 82, 74), OpenLogs));
            page.Controls.Add(actionPanel);

            var targetPanel = new Panel { Dock = DockStyle.Top, Height = 68, Padding = new Padding(0, 8, 0, 8) };
            var targetLabel = new Label { Text = "UPDATE SATU OUTLET", AutoSize = true, Location = new Point(0, 4), Font = new Font("Segoe UI Semibold", 8F), ForeColor = Color.FromArgb(91, 75, 66) };
            outletBox = new TextBox { Location = new Point(0, 27), Height = 31, Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top };
            outletBox.Width = 650;
            var targetButton = MakeButton("Update Sekarang", Color.FromArgb(185, 126, 43), UpdateTarget);
            targetButton.Location = new Point(665, 22);
            targetButton.Width = 150;
            targetPanel.Controls.Add(targetLabel);
            targetPanel.Controls.Add(outletBox);
            targetPanel.Controls.Add(targetButton);
            targetPanel.Resize += delegate { outletBox.Width = Math.Max(300, targetPanel.ClientSize.Width - 175); targetButton.Left = outletBox.Right + 10; };
            page.Controls.Add(targetPanel);
            targetPanel.BringToFront();

            var controlPanel = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 48, Padding = new Padding(0, 5, 0, 5) };
            pauseButton = MakeSmallButton("Pause", PauseSync);
            resumeButton = MakeSmallButton("Lanjutkan", ResumeSync);
            stopButton = MakeSmallButton("Stop", StopSync);
            stopButton.ForeColor = Color.FromArgb(165, 40, 35);
            controlPanel.Controls.Add(pauseButton);
            controlPanel.Controls.Add(resumeButton);
            controlPanel.Controls.Add(stopButton);
            page.Controls.Add(controlPanel);
            controlPanel.BringToFront();

            var progressPanel = new Panel { Dock = DockStyle.Top, Height = 54, Padding = new Padding(0, 8, 0, 8) };
            progressBar = new ProgressBar { Dock = DockStyle.Bottom, Height = 18, Style = ProgressBarStyle.Continuous };
            progressLabel = new Label { Text = "Belum berjalan", Dock = DockStyle.Top, Height = 22, ForeColor = Color.FromArgb(77, 69, 64) };
            progressPanel.Controls.Add(progressBar);
            progressPanel.Controls.Add(progressLabel);
            page.Controls.Add(progressPanel);
            progressPanel.BringToFront();

            logBox = new TextBox {
                Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Both,
                BackColor = Color.FromArgb(28, 30, 29), ForeColor = Color.FromArgb(225, 235, 228),
                Font = new Font("Consolas", 9F), BorderStyle = BorderStyle.FixedSingle, WordWrap = false
            };
            page.Controls.Add(logBox);
            logBox.BringToFront();
            SetRunningState(false);
            return page;
        }

        private TabPage BuildConnectionTab()
        {
            var page = new TabPage("Koneksi VSPhone") { BackColor = BackColor, Padding = new Padding(24) };
            var intro = new Label { Text = "Tempel data terbaru dari Local Debugging VSPhone perangkat menu.", AutoSize = true, ForeColor = Color.FromArgb(77, 69, 64), Location = new Point(24, 24) };
            page.Controls.Add(intro);
            sshBox = AddField(page, "SSH CONNECTION COMMAND", 70, false);
            adbBox = AddField(page, "ADB TARGET", 142, false);
            keyBox = AddField(page, "CONNECTION KEY", 214, true);
            var showKey = new CheckBox { Text = "Tampilkan key", AutoSize = true, Location = new Point(24, 284) };
            showKey.CheckedChanged += delegate { keyBox.UseSystemPasswordChar = !showKey.Checked; };
            page.Controls.Add(showKey);
            var save = MakeButton("Simpan dan Tes Koneksi", Color.FromArgb(42, 112, 82), SaveAndTestConnection);
            save.Location = new Point(24, 326);
            save.Width = 210;
            page.Controls.Add(save);
            return page;
        }

        private TextBox AddField(Control parent, string label, int top, bool password)
        {
            parent.Controls.Add(new Label { Text = label, AutoSize = true, Location = new Point(24, top), Font = new Font("Segoe UI Semibold", 8F), ForeColor = Color.FromArgb(91, 75, 66) });
            var box = new TextBox { Location = new Point(24, top + 23), Width = 820, Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right, UseSystemPasswordChar = password };
            parent.Controls.Add(box);
            return box;
        }

        private Button MakeButton(string text, Color color, EventHandler click)
        {
            var button = new Button { Text = text, Width = 184, Height = 42, Margin = new Padding(0, 8, 10, 5), FlatStyle = FlatStyle.Flat, BackColor = color, ForeColor = Color.White, Cursor = Cursors.Hand };
            button.FlatAppearance.BorderSize = 0;
            button.Click += click;
            return button;
        }

        private Button MakeSmallButton(string text, EventHandler click)
        {
            var button = new Button { Text = text, Width = 112, Height = 32, Margin = new Padding(0, 0, 9, 0), FlatStyle = FlatStyle.Flat, BackColor = Color.White, Cursor = Cursors.Hand };
            button.FlatAppearance.BorderColor = Color.FromArgb(190, 184, 178);
            button.Click += click;
            return button;
        }

        private void StartSync(string arguments, string label)
        {
            if (activeProcess != null && !activeProcess.HasExited) { MessageBox.Show("Proses lain masih berjalan."); return; }
            string script = Path.Combine(toolDir, "multi-vsphone-sync.mjs");
            var info = new ProcessStartInfo(nodePath, Quote(script) + (String.IsNullOrWhiteSpace(arguments) ? "" : " " + arguments));
            info.WorkingDirectory = rootDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.StandardOutputEncoding = Encoding.UTF8;
            info.StandardErrorEncoding = Encoding.UTF8;
            activeProcess = new Process { StartInfo = info, EnableRaisingEvents = true };
            activeProcess.OutputDataReceived += ProcessLine;
            activeProcess.ErrorDataReceived += ProcessLine;
            activeProcess.Exited += ProcessExited;
            logBox.Clear();
            statusLabel.Text = label;
            progressLabel.Text = "Menyiapkan VSPhone dan HTTP Toolkit...";
            progressBar.Value = 0;
            SetRunningState(true);
            activeProcess.Start();
            activeProcess.BeginOutputReadLine();
            activeProcess.BeginErrorReadLine();
        }

        private void ProcessLine(object sender, DataReceivedEventArgs e)
        {
            if (e.Data == null || IsDisposed) return;
            BeginInvoke((MethodInvoker)delegate {
                logBox.AppendText(e.Data + Environment.NewLine);
                logBox.SelectionStart = logBox.TextLength;
                logBox.ScrollToCaret();
                var match = Regex.Match(e.Data, @"\[(\d+)/(\d+)\]");
                if (match.Success) {
                    int current = Int32.Parse(match.Groups[1].Value);
                    int total = Math.Max(1, Int32.Parse(match.Groups[2].Value));
                    progressBar.Maximum = total;
                    progressBar.Value = Math.Min(current, total);
                    progressLabel.Text = String.Format("Progress {0} dari {1} outlet ({2}%)", current, total, (current * 100) / total);
                }
                if (e.Data.Contains("OK ")) statusLabel.Text = "Menu berhasil disimpan";
                else if (e.Data.Contains("Batas sesi")) statusLabel.Text = "Mengganti sesi HTTP Toolkit";
            });
        }

        private void ProcessExited(object sender, EventArgs e)
        {
            if (IsDisposed) return;
            BeginInvoke((MethodInvoker)delegate {
                int code = activeProcess == null ? -1 : activeProcess.ExitCode;
                statusLabel.Text = code == 0 ? "Selesai" : "Berhenti (lihat log)";
                SetRunningState(false);
            });
        }

        private void UpdateTarget(object sender, EventArgs e)
        {
            string outlet = outletBox.Text.Trim();
            if (outlet.Length == 0) { MessageBox.Show("Isi nama outlet terlebih dahulu."); return; }
            StartSync("--baru --outlet=" + Quote(outlet), "Memperbarui " + outlet);
        }

        private void ConfigurePrioritySchedule(object sender, EventArgs e)
        {
            var dialog = new Form { Text = "Jadwal Update Outlet Utama", Size = new Size(420, 235), StartPosition = FormStartPosition.CenterParent, BackColor = BackColor, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false };
            dialog.Controls.Add(new Label { Text = "UPDATE OUTLET UTAMA", AutoSize = true, Location = new Point(24, 22), Font = new Font("Segoe UI Semibold", 10F), ForeColor = Color.FromArgb(33, 83, 65) });
            dialog.Controls.Add(new Label { Text = "Jalankan setiap hari pada jam:", AutoSize = true, Location = new Point(24, 57), ForeColor = Color.FromArgb(77, 69, 64) });
            var time = new DateTimePicker { Format = DateTimePickerFormat.Time, ShowUpDown = true, Value = DateTime.Today.AddHours(8), Location = new Point(24, 82), Width = 130 };
            dialog.Controls.Add(time);
            dialog.Controls.Add(new Label { Text = "Hanya memakai daftar outlet utama harian.", AutoSize = true, Location = new Point(24, 118), ForeColor = Color.FromArgb(91, 75, 66) });
            var save = MakeButton("Simpan Jadwal", Color.FromArgb(42, 112, 82), delegate {
                try {
                    string batch = Path.Combine(toolDir, "Jalankan Terjadwal VSPhone.cmd");
                    string taskCommand = "\\\"" + batch + "\\\" --utama";
                    string args = "/Create /TN " + Quote(ScheduleTaskName) + " /TR " + Quote(taskCommand) + " /SC DAILY /ST " + time.Value.ToString("HH:mm") + " /F";
                    var result = Process.Start(new ProcessStartInfo("schtasks.exe", args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true });
                    result.WaitForExit();
                    if (result.ExitCode != 0) throw new Exception(result.StandardError.ReadToEnd());
                    statusLabel.Text = "Jadwal outlet utama aktif setiap hari " + time.Value.ToString("HH:mm");
                    dialog.Close();
                    MessageBox.Show("Jadwal tersimpan. Update outlet utama akan berjalan setiap hari pada " + time.Value.ToString("HH:mm") + ".");
                } catch (Exception error) { MessageBox.Show("Jadwal tidak dapat disimpan: " + error.Message); }
            });
            save.Location = new Point(24, 150);
            dialog.Controls.Add(save);
            var remove = new Button { Text = "Hapus Jadwal", Width = 120, Height = 42, Location = new Point(215, 150), FlatStyle = FlatStyle.Flat, BackColor = Color.White };
            remove.Click += delegate {
                Process.Start(new ProcessStartInfo("schtasks.exe", "/Delete /TN " + Quote(ScheduleTaskName) + " /F") { UseShellExecute = false, CreateNoWindow = true }).WaitForExit();
                statusLabel.Text = "Jadwal outlet utama dihapus";
                dialog.Close();
            };
            dialog.Controls.Add(remove);
            dialog.ShowDialog(this);
        }

        private void PauseSync(object sender, EventArgs e)
        {
            Directory.CreateDirectory(Path.Combine(toolDir, "logs"));
            File.WriteAllText(Path.Combine(toolDir, "logs", "pause-all"), DateTime.Now.ToString("O"));
            statusLabel.Text = "Pause setelah outlet aktif selesai";
        }

        private void ResumeSync(object sender, EventArgs e)
        {
            string path = Path.Combine(toolDir, "logs", "pause-all");
            if (File.Exists(path)) File.Delete(path);
            statusLabel.Text = "Dilanjutkan";
        }

        private void StopSync(object sender, EventArgs e)
        {
            if (activeProcess == null || activeProcess.HasExited) return;
            Process.Start(new ProcessStartInfo("taskkill", "/PID " + activeProcess.Id + " /T /F") { CreateNoWindow = true, UseShellExecute = false }).WaitForExit();
            statusLabel.Text = "Dihentikan";
            SetRunningState(false);
        }

        private void OpenLogs(object sender, EventArgs e)
        {
            string path = Path.Combine(toolDir, "logs");
            Directory.CreateDirectory(path);
            Process.Start("explorer.exe", Quote(path));
        }

        private void SetRunningState(bool running)
        {
            foreach (Control control in actionPanel.Controls) if (control is Button) control.Enabled = !running;
            stopButton.Enabled = running;
            pauseButton.Enabled = running;
            resumeButton.Enabled = running;
        }

        private void LoadConnectionSettings()
        {
            if (!File.Exists(envPath)) return;
            sshBox.Text = ReadEnv("VSPHONE_SSH_COMMAND");
            adbBox.Text = ReadEnv("VSPHONE_ADB_TARGET");
            keyBox.Text = ReadEnv("VSPHONE_CONNECTION_KEY");
        }

        private string ReadEnv(string name)
        {
            foreach (string line in File.ReadAllLines(envPath)) if (line.StartsWith(name + "=")) return line.Substring(name.Length + 1);
            return "";
        }

        private void SaveAndTestConnection(object sender, EventArgs e)
        {
            if (String.IsNullOrWhiteSpace(sshBox.Text) || String.IsNullOrWhiteSpace(adbBox.Text) || String.IsNullOrWhiteSpace(keyBox.Text)) {
                MessageBox.Show("Lengkapi SSH command, ADB target, dan connection key."); return;
            }
            string[] lines = File.Exists(envPath) ? File.ReadAllLines(envPath) : new string[0];
            lines = ReplaceEnv(lines, "VSPHONE_SSH_COMMAND", sshBox.Text.Trim());
            lines = ReplaceEnv(lines, "VSPHONE_CONNECTION_KEY", keyBox.Text.Trim());
            lines = ReplaceEnv(lines, "VSPHONE_ADB_TARGET", adbBox.Text.Trim());
            File.WriteAllLines(envPath, lines, new UTF8Encoding(false));
            StartSync("--setup-only", "Menguji koneksi VSPhone");
        }

        private string[] ReplaceEnv(string[] lines, string name, string value)
        {
            for (int i = 0; i < lines.Length; i++) if (lines[i].StartsWith(name + "=")) { lines[i] = name + "=" + value; return lines; }
            var result = new string[lines.Length + 1];
            Array.Copy(lines, result, lines.Length);
            result[result.Length - 1] = name + "=" + value;
            return result;
        }

        private static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}

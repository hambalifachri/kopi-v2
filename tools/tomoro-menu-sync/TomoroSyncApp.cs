using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace TomoroSyncDesktop
{
    public class MainForm : Form
    {
        private readonly string toolDir;
        private readonly string rootDir;
        private readonly string nodePath;
        private Process activeProcess;
        private TextBox logBox;
        private TextBox keywordBox;
        private TextBox storeBox;
        private NumericUpDown secondsBox;
        private Label statusLabel;
        private Button stopButton;

        public MainForm()
        {
            toolDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            rootDir = Path.GetFullPath(Path.Combine(toolDir, "..", ".."));
            string bundledNode = @"C:\Users\fachr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe";
            nodePath = File.Exists(bundledNode) ? bundledNode : @"C:\Program Files\nodejs\node.exe";
            BuildUi();
        }

        private void BuildUi()
        {
            Text = "Tomoro Menu Sync";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(820, 560);
            Size = new Size(980, 680);
            BackColor = Color.FromArgb(247, 246, 242);
            Font = new Font("Segoe UI", 9F);

            var header = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = Color.FromArgb(24, 92, 82), Padding = new Padding(22, 14, 22, 10) };
            var title = new Label { Text = "Tomoro Menu Sync", ForeColor = Color.White, Font = new Font("Segoe UI Semibold", 18F), AutoSize = true, Location = new Point(22, 12) };
            statusLabel = new Label { Text = "Siap", ForeColor = Color.FromArgb(219, 239, 233), AutoSize = true, Location = new Point(25, 48) };
            header.Controls.Add(title);
            header.Controls.Add(statusLabel);
            Controls.Add(header);

            var main = new Panel { Dock = DockStyle.Fill, Padding = new Padding(18) };
            Controls.Add(main);
            main.BringToFront();

            var actionPanel = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 54, WrapContents = false };
            actionPanel.Controls.Add(MakeButton("Capture Frida", Color.FromArgb(24, 92, 82), delegate { StartCapture(); }));
            actionPanel.Controls.Add(MakeButton("Sync Direct", Color.FromArgb(185, 126, 43), delegate { StartDirectSync(); }));
            stopButton = MakeButton("Stop", Color.FromArgb(150, 48, 42), delegate { StopProcess(); });
            actionPanel.Controls.Add(stopButton);
            main.Controls.Add(actionPanel);

            var inputPanel = new Panel { Dock = DockStyle.Top, Height = 92, Padding = new Padding(0, 8, 0, 8) };
            inputPanel.Controls.Add(new Label { Text = "KEYWORD OUTLET", AutoSize = true, Location = new Point(0, 4), Font = new Font("Segoe UI Semibold", 8F), ForeColor = Color.FromArgb(91, 75, 66) });
            keywordBox = new TextBox { Text = "bogor", Location = new Point(0, 27), Width = 220 };
            inputPanel.Controls.Add(keywordBox);
            inputPanel.Controls.Add(new Label { Text = "STORE CODE", AutoSize = true, Location = new Point(250, 4), Font = new Font("Segoe UI Semibold", 8F), ForeColor = Color.FromArgb(91, 75, 66) });
            storeBox = new TextBox { Location = new Point(250, 27), Width = 240 };
            inputPanel.Controls.Add(storeBox);
            inputPanel.Controls.Add(new Label { Text = "CAPTURE DETIK", AutoSize = true, Location = new Point(520, 4), Font = new Font("Segoe UI Semibold", 8F), ForeColor = Color.FromArgb(91, 75, 66) });
            secondsBox = new NumericUpDown { Location = new Point(520, 27), Width = 110, Minimum = 15, Maximum = 900, Value = 90 };
            inputPanel.Controls.Add(secondsBox);
            main.Controls.Add(inputPanel);
            inputPanel.BringToFront();

            logBox = new TextBox {
                Dock = DockStyle.Fill,
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Both,
                BackColor = Color.FromArgb(28, 30, 29),
                ForeColor = Color.FromArgb(225, 235, 228),
                Font = new Font("Consolas", 9F),
                BorderStyle = BorderStyle.FixedSingle,
                WordWrap = false
            };
            main.Controls.Add(logBox);
            logBox.BringToFront();
            SetRunningState(false);
        }

        private Button MakeButton(string text, Color color, EventHandler click)
        {
            var button = new Button { Text = text, Width = 170, Height = 40, Margin = new Padding(0, 6, 10, 4), FlatStyle = FlatStyle.Flat, BackColor = color, ForeColor = Color.White, Cursor = Cursors.Hand };
            button.FlatAppearance.BorderSize = 0;
            button.Click += click;
            return button;
        }

        private void StartCapture()
        {
            string keyword = keywordBox.Text.Trim();
            string args = "--seconds=" + Decimal.ToInt32(secondsBox.Value) + " --keyword=" + Quote(keyword.Length > 0 ? keyword : "bogor");
            StartNode("capture-frida.mjs", args, "Capture Tomoro via Frida");
        }

        private void StartDirectSync()
        {
            string storeCode = storeBox.Text.Trim();
            string keyword = keywordBox.Text.Trim();
            string args = storeCode.Length > 0 ? "--store=" + Quote(storeCode) : "--keyword=" + Quote(keyword.Length > 0 ? keyword : "bogor");
            StartNode("sync.mjs", args, storeCode.Length > 0 ? "Sync menu " + storeCode : "Sync outlet " + keyword);
        }

        private void StartNode(string scriptName, string arguments, string label)
        {
            if (activeProcess != null && !activeProcess.HasExited) { MessageBox.Show("Proses lain masih berjalan."); return; }
            string script = Path.Combine(toolDir, scriptName);
            var info = new ProcessStartInfo(nodePath, Quote(script) + " " + arguments);
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

        private void StopProcess()
        {
            try {
                if (activeProcess != null && !activeProcess.HasExited) activeProcess.Kill();
            } catch { }
        }

        private void SetRunningState(bool running)
        {
            stopButton.Enabled = running;
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
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
